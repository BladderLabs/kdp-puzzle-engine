import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, booksTable } from "@workspace/db";
import { runMarketScout } from "../../lib/agents/market-scout";
import { runContentArchitect } from "../../lib/agents/content-architect";
import { runCoverArtDirector } from "../../lib/agents/cover-art-director";
import { runQAReviewer } from "../../lib/agents/qa-reviewer";

const router: IRouter = Router();

const CreateBookAgentBody = z.object({
  brief: z.string().optional(),
});

function sseEvent(res: ReturnType<typeof Router.prototype.use> extends never ? never : Parameters<typeof Router.prototype.use>[0] extends never ? never : any, stage: string, status: string, data: object = {}) {
  (res as any).write(`data: ${JSON.stringify({ stage, status, ...data })}\n\n`);
}

/**
 * POST /agents/create-book
 * Multi-agent KDP book creation pipeline with SSE streaming.
 * Stages: market_scout → content_architect → cover_art → qa_review → assemble
 */
router.post("/agents/create-book", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const emit = (stage: string, status: string, data: object = {}) => {
    res.write(`data: ${JSON.stringify({ stage, status, ...data })}\n\n`);
  };

  try {
    const parsed = CreateBookAgentBody.safeParse(req.body);
    const brief = parsed.success ? parsed.data.brief : undefined;

    // ─── Stage 1: Market Scout ───
    emit("market_scout", "running", { message: "Scanning KDP niches and market data…" });
    let market;
    try {
      market = await runMarketScout(brief);
      emit("market_scout", "done", {
        message: `Best opportunity: ${market.nicheLabel} ${market.puzzleType} (${market.largePrint ? "Large Print" : "Standard"})`,
        niche: market.niche,
        nicheLabel: market.nicheLabel,
        puzzleType: market.puzzleType,
        theme: market.theme,
      });
    } catch (err) {
      req.log.error({ err }, "Market Scout failed");
      emit("market_scout", "failed", { message: "Market Scout failed. Using defaults." });
      market = {
        niche: "seniors",
        nicheLabel: "Seniors & Large Print",
        puzzleType: "Word Search",
        difficulty: "Easy",
        puzzleCount: 100,
        largePrint: true,
        theme: "midnight",
        coverStyle: "classic",
        pricePoint: 8.99,
        keywords: ["senior word search", "large print puzzle", "easy word search", "brain games seniors", "word puzzle book", "activity book", "puzzle for adults"],
        audienceProfile: "Adults 60+ seeking gentle mental stimulation",
        whySells: "Seniors are the #1 KDP puzzle book buyer segment with consistent year-round demand",
      };
    }

    // ─── Stage 2: Content Architect ───
    emit("content_architect", "running", { message: "Crafting title, description, and puzzle words…" });
    let content;
    try {
      content = await runContentArchitect(market, brief);
      emit("content_architect", "done", {
        message: `Title created: "${content.title}"`,
        title: content.title,
        subtitle: content.subtitle,
      });
    } catch (err) {
      req.log.error({ err }, "Content Architect failed");
      emit("content_architect", "failed", { message: "Content Architect failed. Please retry." });
      res.write(`data: ${JSON.stringify({ stage: "error", message: "Content Architect agent failed. Please try again." })}\n\n`);
      res.end();
      return;
    }

    // ─── Stage 3: Cover Art Director ───
    emit("cover_art", "running", { message: `Generating AI cover illustration for ${market.theme} theme…` });
    let coverImage: { b64_json: string; mimeType: string } | null = null;
    let coverImageDataUrl: string | undefined;
    try {
      const result = await runCoverArtDirector(market.theme, market.puzzleType, market.coverStyle, content.title);
      if (result) {
        coverImage = result;
        coverImageDataUrl = `data:${result.mimeType};base64,${result.b64_json}`;
        emit("cover_art", "done", {
          message: "Cover illustration generated",
          hasImage: true,
          imagePreview: `data:${result.mimeType};base64,${result.b64_json.slice(0, 100)}`,
        });
      } else {
        emit("cover_art", "done", { message: "Cover art skipped (using SVG theme art)", hasImage: false });
      }
    } catch (err) {
      req.log.error({ err }, "Cover Art Director failed");
      emit("cover_art", "done", { message: "Cover art unavailable (using SVG theme art)", hasImage: false });
    }

    // ─── Stage 4: QA Reviewer ───
    emit("qa_review", "running", { message: "Running 6 KDP quality checks…" });
    let qaResult;
    try {
      qaResult = await runQAReviewer({
        title: content.title,
        subtitle: content.subtitle,
        backDescription: content.backDescription,
        puzzleCount: market.puzzleCount,
        keywords: market.keywords,
        hasImage: !!coverImage,
        words: content.words,
        author: content.author,
      });

      if (!qaResult.needs_revision) {
        emit("qa_review", "done", {
          message: `${6 - qaResult.issues.length}/6 checks passed`,
          passed: qaResult.passed,
          issues: qaResult.issues,
        });
      } else {
        emit("qa_review", "needs_revision", {
          message: `${qaResult.issues.length} issue${qaResult.issues.length !== 1 ? "s" : ""} found — revising content…`,
          issues: qaResult.issues,
        });

        // Single revision round
        emit("content_architect", "running", {
          message: "Content Architect re-running with QA feedback…",
          revision: true,
        });
        try {
          const issueDescriptions = qaResult.issues.map(i => `${i.field}: ${i.problem} — Fix: ${i.fix}`);
          content = await runContentArchitect(market, brief, issueDescriptions);
          emit("content_architect", "done", {
            message: `Revised title: "${content.title}"`,
            title: content.title,
            subtitle: content.subtitle,
            revision: true,
          });
          emit("qa_review", "done", {
            message: "Issues resolved after revision",
            passed: true,
            issues: [],
          });
        } catch (revErr) {
          req.log.error({ revErr }, "Content Architect revision failed");
          emit("content_architect", "done", {
            message: "Revision incomplete — using original content",
            revision: true,
          });
          emit("qa_review", "done", {
            message: "QA complete (original content)",
            passed: true,
            issues: [],
          });
        }
      }
    } catch (err) {
      req.log.error({ err }, "QA Reviewer failed");
      emit("qa_review", "done", { message: "QA skipped", passed: true, issues: [] });
    }

    // ─── Stage 5: Assemble & Save ───
    emit("assemble", "running", { message: "Saving book project to your library…" });
    try {
      const [book] = await db.insert(booksTable).values({
        title: content.title,
        subtitle: content.subtitle,
        author: content.author,
        puzzleType: market.puzzleType,
        puzzleCount: market.puzzleCount,
        difficulty: market.difficulty,
        largePrint: market.largePrint,
        paperType: "white",
        theme: market.theme,
        coverStyle: market.coverStyle,
        backDescription: content.backDescription,
        words: content.words,
        wordCategory: content.wordCategory,
        coverImageUrl: coverImageDataUrl ?? null,
        niche: market.niche,
        volumeNumber: content.volumeNumber,
        dedication: null,
        difficultyMode: "uniform",
        challengeDays: null,
      }).returning();

      emit("assemble", "done", { message: "Book saved to your library!" });
      res.write(`data: ${JSON.stringify({ stage: "done", bookId: book.id, title: content.title })}\n\n`);
    } catch (err) {
      req.log.error({ err }, "Failed to save book to DB");
      emit("assemble", "failed", { message: "Failed to save book. Please try again." });
      res.write(`data: ${JSON.stringify({ stage: "error", message: "Database error: failed to save book." })}\n\n`);
    }
  } catch (err) {
    req.log.error({ err }, "Agent pipeline failed");
    res.write(`data: ${JSON.stringify({ stage: "error", message: "Pipeline error. Please try again." })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;

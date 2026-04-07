import { Router, type IRouter } from "express";
import type { Response } from "express";
import { z } from "zod";
import { db, booksTable } from "@workspace/db";
import { runMarketScout, type MarketScoutResult } from "../../lib/agents/market-scout";
import { runContentArchitect, type ContentArchitectResult } from "../../lib/agents/content-architect";
import { runCoverArtDirector } from "../../lib/agents/cover-art-director";
import { runQAReviewer, type QAIssue } from "../../lib/agents/qa-reviewer";

const router: IRouter = Router();

const CreateBookAgentBody = z.object({
  brief: z.string().optional(),
});

function emit(res: Response, stage: string, status: string, data: Record<string, unknown> = {}): void {
  res.write(`data: ${JSON.stringify({ stage, status, ...data })}\n\n`);
}

/**
 * POST /agents/create-book
 * Multi-agent KDP book creation pipeline with SSE streaming.
 * Pipeline order:
 *   1. market_scout   — research niche & puzzle config
 *   2. content_architect — title, subtitle, description, words
 *   3. cover_art      — AI-generated illustration (hasImage determined here)
 *   4. qa_review      — 6-check gate on final assembled spec incl. hasImage
 *   5. assemble       — persist to DB, emit done event
 */
router.post("/agents/create-book", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const parsed = CreateBookAgentBody.safeParse(req.body);
  const brief = parsed.success ? parsed.data.brief : undefined;

  // ─── Stage 1: Market Scout ───
  let market: MarketScoutResult;
  emit(res, "market_scout", "running", { message: "Scanning KDP niches and market data…" });
  try {
    market = await runMarketScout(brief);
    req.log.info({ niche: market.niche, puzzleType: market.puzzleType }, "Market Scout done");
    emit(res, "market_scout", "done", {
      message: `Best opportunity: ${market.nicheLabel} ${market.puzzleType} (${market.largePrint ? "Large Print" : "Standard"})`,
      niche: market.niche,
      nicheLabel: market.nicheLabel,
      puzzleType: market.puzzleType,
      theme: market.theme,
    });
  } catch (err) {
    req.log.error({ err }, "Market Scout failed — using defaults");
    emit(res, "market_scout", "failed", { message: "Market Scout failed. Using defaults." });
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
  let content: ContentArchitectResult;
  emit(res, "content_architect", "running", { message: "Crafting title, description, and puzzle words…" });
  try {
    content = await runContentArchitect(market, brief);
    req.log.info({ title: content.title }, "Content Architect done");
    emit(res, "content_architect", "done", {
      message: `Title: "${content.title}"`,
      title: content.title,
      subtitle: content.subtitle,
      wordCount: content.backDescription.trim().split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    req.log.error({ err }, "Content Architect failed");
    emit(res, "content_architect", "failed", { message: "Content Architect failed. Please retry." });
    res.write(`data: ${JSON.stringify({ stage: "error", message: "Content Architect agent failed. Please try again." })}\n\n`);
    res.end();
    return;
  }

  // ─── Stage 3: Cover Art Director (before QA so QA gets real hasImage) ───
  emit(res, "cover_art", "running", { message: `Generating AI cover illustration for ${market.theme} theme…` });
  let coverImageDataUrl: string | null = null;
  let hasCoverImage = false;
  try {
    const result = await runCoverArtDirector(market.theme, market.puzzleType, market.coverStyle, content.title);
    if (result) {
      coverImageDataUrl = `data:${result.mimeType};base64,${result.b64_json}`;
      hasCoverImage = true;
      req.log.info({ mimeType: result.mimeType, b64Length: result.b64_json.length }, "Cover Art done");
      emit(res, "cover_art", "done", {
        message: "Cover illustration generated",
        hasImage: true,
      });
    } else {
      req.log.info("Cover Art returned null — using SVG theme art");
      emit(res, "cover_art", "done", { message: "Cover art skipped (using SVG theme art)", hasImage: false });
    }
  } catch (err) {
    req.log.error({ err }, "Cover Art Director failed — degrading to SVG");
    emit(res, "cover_art", "done", { message: "Cover art unavailable — using SVG theme art", hasImage: false });
  }

  // ─── Stage 4: QA Review (with actual hasImage + one optional revision + re-check) ───
  const buildQASpec = (c: ContentArchitectResult) => ({
    title: c.title,
    subtitle: c.subtitle,
    backDescription: c.backDescription,
    puzzleCount: market.puzzleCount,
    keywords: market.keywords,
    hasImage: hasCoverImage,
    words: c.words,
    author: c.author,
  });

  let qaFailed = false;
  let finalQAIssues: QAIssue[] = [];
  let finalQAPassed = false;

  emit(res, "qa_review", "running", { message: "Running 6 KDP quality checks…" });
  try {
    const qaResult = await runQAReviewer(buildQASpec(content));
    req.log.info({ passed: qaResult.passed, issues: qaResult.issues.length }, "QA first pass done");

    if (!qaResult.needs_revision) {
      finalQAIssues = qaResult.issues;
      finalQAPassed = qaResult.passed;
      emit(res, "qa_review", "done", {
        message: qaResult.passed
          ? "All 6 checks passed"
          : `${qaResult.issues.length} minor issue(s) noted — no revision required`,
        passed: qaResult.passed,
        issues: qaResult.issues,
        checksCount: 6,
      });
    } else {
      emit(res, "qa_review", "needs_revision", {
        message: `${qaResult.issues.length} issue${qaResult.issues.length !== 1 ? "s" : ""} found — revising…`,
        issues: qaResult.issues,
      });

      // Single revision round
      emit(res, "content_architect", "running", {
        message: "Re-drafting content with QA feedback…",
        revision: true,
      });
      try {
        const issueDescriptions = qaResult.issues.map(i => `${i.field}: ${i.problem} — Fix: ${i.fix}`);
        content = await runContentArchitect(market, brief, issueDescriptions);
        req.log.info({ title: content.title }, "Content revision done");
        emit(res, "content_architect", "done", {
          message: `Revised: "${content.title}"`,
          title: content.title,
          subtitle: content.subtitle,
          revision: true,
          wordCount: content.backDescription.trim().split(/\s+/).filter(Boolean).length,
        });

        // Re-run QA on revised content — strict, no fallback
        emit(res, "qa_review", "running", { message: "Re-checking revised content…" });
        const reQA = await runQAReviewer(buildQASpec(content));
        req.log.info({ passed: reQA.passed, issues: reQA.issues.length }, "QA re-check done");
        finalQAIssues = reQA.issues;
        finalQAPassed = reQA.passed;
        emit(res, "qa_review", "done", {
          message: reQA.passed
            ? "All checks passed after revision"
            : `${reQA.issues.length} issue(s) remain — proceeding with best effort`,
          passed: reQA.passed,
          issues: reQA.issues,
          checksCount: 6,
        });
      } catch (revErr) {
        req.log.error({ revErr }, "Revision or re-QA failed");
        emit(res, "content_architect", "failed", { message: "Revision failed. Using original content.", revision: true });
        emit(res, "qa_review", "failed", { message: "Re-check failed. Proceeding with original content.", issues: qaResult.issues });
        finalQAIssues = qaResult.issues;
        qaFailed = true;
      }
    }
  } catch (err) {
    req.log.error({ err }, "QA Reviewer failed");
    emit(res, "qa_review", "failed", { message: "QA check failed — pipeline cannot continue." });
    res.write(`data: ${JSON.stringify({ stage: "error", message: "QA Reviewer failed unexpectedly. Please try again." })}\n\n`);
    res.end();
    return;
  }

  // ─── Stage 5: Assemble & Save ───
  emit(res, "assemble", "running", { message: "Saving book project to your library…" });
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
      coverImageUrl: coverImageDataUrl,
      niche: market.niche,
      volumeNumber: content.volumeNumber,
      dedication: null,
      difficultyMode: "uniform",
      challengeDays: null,
    }).returning();

    req.log.info({ bookId: book.id, title: book.title }, "Book assembled and saved");

    emit(res, "assemble", "done", { message: "Book saved to your library!" });

    // Send full cover data URL in the done event so frontend can display it
    // (only if present — omit to reduce payload size when no cover was generated)
    const donePayload: Record<string, unknown> = {
      stage: "done",
      bookId: book.id,
      title: content.title,
      subtitle: content.subtitle,
      puzzleType: market.puzzleType,
      puzzleCount: market.puzzleCount,
      theme: market.theme,
      hasCoverImage,
      qaFailed,
      qaPassed: finalQAPassed,
      qaIssues: finalQAIssues,
      descWordCount: content.backDescription.trim().split(/\s+/).filter(Boolean).length,
    };
    if (coverImageDataUrl) {
      donePayload.coverDataUrl = coverImageDataUrl;
    }

    res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Failed to save book to DB");
    emit(res, "assemble", "failed", { message: "Failed to save book. Please try again." });
    res.write(`data: ${JSON.stringify({ stage: "error", message: "Database error: failed to save book." })}\n\n`);
  }

  res.end();
});

export default router;

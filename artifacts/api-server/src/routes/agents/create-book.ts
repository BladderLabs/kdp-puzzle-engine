import { Router, type IRouter } from "express";
import type { Response } from "express";
import { z } from "zod";
import { db, booksTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { runMarketScout, type MarketScoutResult } from "../../lib/agents/market-scout";
import { runMarketIntelligenceCouncil } from "../../lib/agents/market-intelligence-council";
import type { ApifyProduct } from "../apify/market-research";
import { runContentArchitect, type ContentArchitectResult } from "../../lib/agents/content-architect";
import { runContentExcellenceCouncil, type ContentSpec } from "../../lib/agents/content-excellence-council";
import { runCoverDesignAnalyst } from "../../lib/agents/cover-design-analyst";
import { runCoverColorStrategist } from "../../lib/agents/cover-color-strategist";
import { runCoverTypographyDirector } from "../../lib/agents/cover-typography-director";
import { runCoverDirector, type CoverDesignSpec } from "../../lib/agents/cover-director";
import { runPuzzleProductionCouncil, type PuzzleSpec } from "../../lib/agents/puzzle-production-council";
import { runInteriorDesignCouncil, type LayoutSpec } from "../../lib/agents/interior-design-council";
import { runProductionPricingCouncil, type ProductionSpec } from "../../lib/agents/production-pricing-council";
import { runMasterBookDirector, type BookSpec } from "../../lib/agents/master-book-director";
import { runSeriesArcPlanner, type SeriesArc } from "../../lib/agents/series-arc-planner";
import { runCoverArtDirector } from "../../lib/agents/cover-art-director";
import { runQAReviewer, type QAIssue } from "../../lib/agents/qa-reviewer";

const router: IRouter = Router();

const ApifyProductBodySchema = z.object({
  title: z.string(),
  asin: z.string().optional(),
  bsr: z.number().nullable(),
  reviews: z.number(),
  price: z.number().nullable(),
  stars: z.number().nullable(),
  demand_score: z.number(),
  competition_level: z.enum(["Low", "Medium", "High"]),
  url: z.string().optional(),
});

const CreateBookAgentBody = z.object({
  brief: z.string().optional(),
  marketEvidence: z.array(ApifyProductBodySchema).optional(),
  usedCombos: z.array(z.string()).optional(),
  seriesName: z.string().optional(),
});

function emit(res: Response, stage: string, status: string, data: Record<string, unknown> = {}): void {
  res.write(`data: ${JSON.stringify({ stage, status, ...data })}\n\n`);
}

/**
 * POST /agents/create-book
 * Expert Book Intelligence Pipeline — 11 stages:
 *   1. market_scout        — Market Intelligence Council: 3 sub-agents evaluate niche candidates
 *   2. content_architect   — draft content
 *   3. content_council     — Content Excellence Council (parallel with cover_research)
 *   4. cover_research      — Cover Design Council: 3 specialists + director (parallel with content_council)
 *   5. puzzle_council      — Puzzle Production Council (parallel with interior + production)
 *   6. interior_council    — Interior Design Council (parallel with puzzle + production)
 *   7. production_council  — Production & Pricing Council (parallel with puzzle + interior)
 *   8. master_director     — Master Book Director (synthesises all 5 councils)
 *   9. cover_art           — AI-generated cover illustration
 *  10. qa_review           — quality gate
 *  11. assemble            — persist to DB
 */
router.post("/agents/create-book", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const parsed = CreateBookAgentBody.safeParse(req.body);
  const rawBrief = parsed.success ? parsed.data.brief : undefined;
  const requestedSeriesName = parsed.success ? parsed.data.seriesName : undefined;
  // Normalize evidence: top 3 by demand_score (contract for Market Scout grounding)
  const rawEvidence = parsed.success ? (parsed.data.marketEvidence as ApifyProduct[] | undefined) : undefined;
  const marketEvidence = rawEvidence && rawEvidence.length > 0
    ? [...rawEvidence].sort((a, b) => b.demand_score - a.demand_score).slice(0, 3)
    : undefined;

  // ── Fetch library usedCombos (supplement or replace caller-provided list) ────
  let usedCombos: string[] = parsed.success && parsed.data.usedCombos ? parsed.data.usedCombos : [];
  if (usedCombos.length === 0) {
    try {
      const existingBooks = await db.select().from(booksTable).orderBy(desc(booksTable.id));
      usedCombos = [...new Set(existingBooks.map(b => `${b.theme}+${b.coverStyle}+${b.niche ?? "general"}`))];
    } catch (_) { /* non-critical — proceed without constraint */ }
  }

  // Augment brief with series name constraint if provided
  const brief = requestedSeriesName && rawBrief
    ? `${rawBrief} — continuation of "${requestedSeriesName}" series`
    : requestedSeriesName
      ? `Next volume in "${requestedSeriesName}" series`
      : rawBrief;

  // ─── Stage 1: Market Intelligence Council ────────────────────────────────────
  let market: MarketScoutResult;
  const evidenceNote = marketEvidence && marketEvidence.length > 0
    ? ` · ${marketEvidence.length} live Amazon results provided`
    : "";
  emit(res, "market_scout", "running", { message: `Opportunity Finder scanning KDP market data…${evidenceNote}` });
  try {
    const intel = await runMarketIntelligenceCouncil(brief, (msg) => {
      emit(res, "market_scout", "running", { message: msg });
    }, marketEvidence, usedCombos);
    market = intel;
    req.log.info({ niche: market.niche, puzzleType: market.puzzleType, candidates: intel.candidates.length }, "Market Intelligence Council done");
    emit(res, "market_scout", "done", {
      message: `Best opportunity: ${market.nicheLabel} ${market.puzzleType} (${market.largePrint ? "Large Print" : "Standard"}) · ${intel.candidates.length} candidates evaluated`,
      niche: market.niche,
      nicheLabel: market.nicheLabel,
      puzzleType: market.puzzleType,
      theme: market.theme,
      winnerRationale: intel.winnerRationale,
      candidateCount: intel.candidates.length,
    });
  } catch (err) {
    req.log.error({ err }, "Market Intelligence Council failed — falling back to Market Scout");
    emit(res, "market_scout", "running", { message: "Council degraded — running Market Scout fallback…" });
    try {
      market = await runMarketScout(brief, marketEvidence, usedCombos);
      req.log.info({ niche: market.niche }, "Market Scout fallback done");
      emit(res, "market_scout", "done", {
        message: `Market Scout (fallback): ${market.nicheLabel} ${market.puzzleType}`,
        niche: market.niche,
        nicheLabel: market.nicheLabel,
        puzzleType: market.puzzleType,
        theme: market.theme,
      });
    } catch (fallbackErr) {
      req.log.error({ fallbackErr }, "Market Scout fallback also failed — using hardcoded defaults");
      emit(res, "market_scout", "failed", { message: "Market research failed. Using defaults." });
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
  }

  // ─── Stage 2: Content Architect (draft) ─────────────────────────────────────
  let draft: ContentArchitectResult;
  emit(res, "content_architect", "running", { message: "Drafting title, description, and puzzle words…" });
  try {
    draft = await runContentArchitect(market, brief);
    req.log.info({ title: draft.title }, "Content Architect done");
    emit(res, "content_architect", "done", {
      message: `Draft: "${draft.title}"`,
      title: draft.title,
      subtitle: draft.subtitle,
      wordCount: draft.backDescription.trim().split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    req.log.error({ err }, "Content Architect failed");
    emit(res, "content_architect", "failed", { message: "Content Architect failed. Please retry." });
    res.write(`data: ${JSON.stringify({ stage: "error", message: "Content Architect agent failed. Please try again." })}\n\n`);
    res.end();
    return;
  }

  // ─── Stages 3 & 4: Content Council + Cover Research (parallel) ───────────────
  let contentSpec: ContentSpec = {
    title: draft.title,
    subtitle: draft.subtitle,
    backDescription: draft.backDescription,
    hookSentence: draft.hookSentence ?? "",
    keywords: market.keywords,
    titleRationale: "Kept original draft",
    copyRationale: "Kept original draft",
    changesApplied: [],
  };
  let coverDesignSpec: CoverDesignSpec = {
    theme: market.recommendedTheme ?? market.theme,
    style: market.coverStyle,
    accentHex: "#F5C842",
    backgroundHex: "#0D1B3E",
    fontStyleDirective: "bold condensed sans-serif",
    casingDirective: "Title Case",
    compositionNotes: "Centered composition with visual weight in upper two-thirds",
    enrichedImagePrompt: "",
    conflictsResolved: [],
    rationale: "Default cover spec",
  };

  emit(res, "content_council", "running", { message: "Title Specialist + Sales Copy Expert researching…" });
  emit(res, "cover_research", "running", { message: "Design Analyst · Color Strategist · Typography Director starting…" });

  // Track cover sub-agent completion for progress messages
  const coverSubAgentDone: string[] = [];
  function coverProgress(): string {
    const icons = {
      "Design Analyst": "🎨",
      "Color Strategist": "🎨",
      "Typography Director": "🔤",
    };
    return coverSubAgentDone.map(a => `${icons[a as keyof typeof icons] ?? "·"} ${a} ✓`).join(" · ") +
      (coverSubAgentDone.length < 3 ? " · remaining running…" : " · Director synthesising…");
  }

  try {
    const [contentResult, coverResult] = await Promise.all([
      // Content Excellence Council
      runContentExcellenceCouncil(market, draft)
        .then(r => {
          req.log.info({ title: r.title }, "Content Council done");
          emit(res, "content_council", "done", {
            message: `"${r.title}" — ${r.changesApplied.length} improvement${r.changesApplied.length !== 1 ? "s" : ""} applied`,
            title: r.title,
            changesApplied: r.changesApplied,
          });
          return r;
        })
        .catch(err => {
          req.log.error({ err }, "Content Council failed — using draft");
          emit(res, "content_council", "done", { message: "Content Council degraded — using original draft" });
          return null;
        }),

      // Cover Design Council — 3 specialists in parallel, then director
      (async () => {
        const hasAiImage = true;
        const [designAnalysis, colorStrategy, typographySpec] = await Promise.all([
          runCoverDesignAnalyst(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, hasAiImage)
            .then(r => {
              coverSubAgentDone.push("Design Analyst");
              emit(res, "cover_research", "running", { message: coverProgress() });
              return r;
            }),
          runCoverColorStrategist(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, market.largePrint === true)
            .then(r => {
              coverSubAgentDone.push("Color Strategist");
              emit(res, "cover_research", "running", { message: coverProgress() });
              return r;
            }),
          runCoverTypographyDirector(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, market.largePrint === true)
            .then(r => {
              coverSubAgentDone.push("Typography Director");
              emit(res, "cover_research", "running", { message: coverProgress() });
              return r;
            }),
        ]);

        emit(res, "cover_research", "running", { message: "Cover Director synthesising council findings…" });
        const spec = await runCoverDirector(market, draft, designAnalysis, colorStrategy, typographySpec);
        req.log.info({ theme: spec.theme, style: spec.style }, "Cover Research done");
        emit(res, "cover_research", "done", {
          message: `${spec.theme} theme · ${spec.style} style · ${colorStrategy.thumbnailLegibilityScore}/10 thumbnail score`,
          theme: spec.theme,
          style: spec.style,
          accentHex: spec.accentHex,
          rationale: spec.rationale,
          conflictsResolved: spec.conflictsResolved,
        });
        return spec;
      })()
        .catch(err => {
          req.log.error({ err }, "Cover Research failed — using defaults");
          emit(res, "cover_research", "done", { message: "Cover Research degraded — using market defaults" });
          return null;
        }),
    ]);

    if (contentResult) contentSpec = contentResult;
    if (coverResult) coverDesignSpec = coverResult;
  } catch (err) {
    req.log.error({ err }, "Council group A failed");
  }

  // ─── Stages 5, 6, 7: Puzzle + Interior + Production (parallel) ────────────────
  let puzzleSpec: PuzzleSpec | null = null;
  let layoutSpec: LayoutSpec | null = null;
  let productionSpec: ProductionSpec | null = null;

  emit(res, "puzzle_council", "running", { message: "Difficulty Calibrator + Layout Engineer researching…" });
  emit(res, "interior_council", "running", { message: "Typography Expert + Page Layout Architect researching…" });
  emit(res, "production_council", "running", { message: "Format Strategist + Pricing Expert researching…" });

  try {
    const estimatedPageCount = Math.ceil((market.puzzleCount ?? 100) * 1.15) + 20;
    const [puzzle, layout, production] = await Promise.all([
      runPuzzleProductionCouncil(market)
        .then(r => {
          req.log.info({ puzzleCount: r.recommendedPuzzleCount }, "Puzzle Council done");
          emit(res, "puzzle_council", "done", {
            message: `${r.recommendedPuzzleCount} puzzles · ${r.difficultyDescriptor}`,
            puzzleCount: r.recommendedPuzzleCount,
            difficultyDescriptor: r.difficultyDescriptor,
          });
          return r;
        })
        .catch(err => {
          req.log.error({ err }, "Puzzle Council failed");
          emit(res, "puzzle_council", "done", { message: "Puzzle Council degraded — using market defaults" });
          return null;
        }),

      runInteriorDesignCouncil(market, estimatedPageCount)
        .then(r => {
          req.log.info({ bodyFont: r.bodyFontSizePt }, "Interior Council done");
          emit(res, "interior_council", "done", {
            message: `${r.bodyFontSizePt}pt body · ${r.innerMarginIn}" gutter · ${r.fontFamilyApproach.split(",")[0]}`,
            bodyFontSizePt: r.bodyFontSizePt,
            innerMarginIn: r.innerMarginIn,
          });
          return r;
        })
        .catch(err => {
          req.log.error({ err }, "Interior Council failed");
          emit(res, "interior_council", "done", { message: "Interior Council degraded — using defaults" });
          return null;
        }),

      runProductionPricingCouncil(market)
        .then(r => {
          req.log.info({ price: r.recommendedPrice, paper: r.paperType }, "Production Council done");
          emit(res, "production_council", "done", {
            message: `$${r.recommendedPrice} · ${r.paperType} paper · ~$${r.royaltyEstimate.toFixed(2)} royalty`,
            recommendedPrice: r.recommendedPrice,
            paperType: r.paperType,
            royaltyEstimate: r.royaltyEstimate,
          });
          return r;
        })
        .catch(err => {
          req.log.error({ err }, "Production Council failed");
          emit(res, "production_council", "done", { message: "Production Council degraded — using defaults" });
          return null;
        }),
    ]);

    puzzleSpec = puzzle;
    layoutSpec = layout;
    productionSpec = production;
  } catch (err) {
    req.log.error({ err }, "Council group B failed");
  }

  // ─── Stage 8: Master Book Director ───────────────────────────────────────────
  let bookSpec: BookSpec | null = null;
  emit(res, "master_director", "running", { message: "Master Director reviewing all council recommendations…" });
  try {
    if (puzzleSpec && layoutSpec && productionSpec) {
      bookSpec = await runMasterBookDirector(
        market,
        contentSpec,
        coverDesignSpec,
        puzzleSpec,
        layoutSpec,
        productionSpec,
      );
      req.log.info({ title: bookSpec.title, price: bookSpec.recommendedPrice }, "Master Director done");
      emit(res, "master_director", "done", {
        message: `Book Spec finalised · ${bookSpec.conflictsResolved.length} conflict(s) resolved`,
        councilSummary: bookSpec.councilSummary,
        conflictsResolved: bookSpec.conflictsResolved,
        overallRationale: bookSpec.overallRationale,
        recommendedPrice: bookSpec.recommendedPrice,
        royaltyEstimate: bookSpec.royaltyEstimate,
      });
    } else {
      emit(res, "master_director", "done", { message: "Master Director skipped — some councils degraded" });
    }
  } catch (err) {
    req.log.error({ err }, "Master Director failed");
    emit(res, "master_director", "done", { message: "Master Director degraded — using council outputs directly" });
  }

  // Resolve final values (bookSpec wins over council defaults, council wins over market defaults)
  const finalTheme = bookSpec?.coverTheme ?? coverDesignSpec.theme ?? market.recommendedTheme ?? market.theme;
  const finalStyle = bookSpec?.coverStyle ?? coverDesignSpec.style ?? market.coverStyle;
  const finalTitle = bookSpec?.title ?? contentSpec.title;
  const finalSubtitle = bookSpec?.subtitle ?? contentSpec.subtitle;
  const finalBackDescription = bookSpec?.backDescription ?? contentSpec.backDescription;
  const finalHookSentence = bookSpec?.hookSentence ?? contentSpec.hookSentence;
  const finalKeywords = bookSpec?.keywords ?? contentSpec.keywords;
  const finalPuzzleCount = bookSpec?.puzzleCount ?? puzzleSpec?.recommendedPuzzleCount ?? market.puzzleCount ?? 100;
  const finalPaperType = bookSpec?.paperType ?? productionSpec?.paperType ?? "white";
  const enrichedImagePrompt = bookSpec?.coverImagePrompt ?? coverDesignSpec.enrichedImagePrompt;

  // ─── Stage 9: Cover Art Director ────────────────────────────────────────────
  emit(res, "cover_art", "running", { message: `Generating AI cover with research-backed ${finalTheme} theme prompt…` });
  let coverImageDataUrl: string | null = null;
  let hasCoverImage = false;
  try {
    const result = await runCoverArtDirector(
      finalTheme,
      market.puzzleType,
      finalStyle,
      finalTitle,
      market.niche,
      enrichedImagePrompt || undefined,
    );
    if (result) {
      coverImageDataUrl = `data:${result.mimeType};base64,${result.b64_json}`;
      hasCoverImage = true;
      req.log.info({ mimeType: result.mimeType, b64Length: result.b64_json.length }, "Cover Art done");
      emit(res, "cover_art", "done", {
        message: enrichedImagePrompt
          ? "Cover generated using expert research-backed prompt"
          : "Cover illustration generated",
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

  // ─── Stage 10: QA Review ────────────────────────────────────────────────────
  const coverCombo = `${market.theme}+${market.coverStyle}+${market.niche}`;
  const buildQASpec = () => ({
    title: finalTitle,
    subtitle: finalSubtitle,
    backDescription: finalBackDescription,
    puzzleCount: finalPuzzleCount,
    keywords: finalKeywords,
    hasImage: hasCoverImage,
    words: draft.words,
    author: draft.author,
    coverCombo,
    usedCombos,
  });

  let qaFailed = false;
  let finalQAIssues: QAIssue[] = [];
  let finalQAPassed = false;

  emit(res, "qa_review", "running", { message: "Running KDP quality checks on final Book Spec…" });
  try {
    const qaResult = await runQAReviewer(buildQASpec());
    req.log.info({ passed: qaResult.passed, issues: qaResult.issues.length }, "QA first pass done");

    if (!qaResult.needs_revision) {
      finalQAIssues = qaResult.issues;
      finalQAPassed = qaResult.passed;
      emit(res, "qa_review", "done", {
        message: qaResult.passed
          ? "All checks passed"
          : `${qaResult.issues.length} minor issue(s) noted — no revision required`,
        passed: qaResult.passed,
        issues: qaResult.issues,
        checksCount: usedCombos.length > 0 ? 7 : 6,
      });
    } else {
      emit(res, "qa_review", "needs_revision", {
        message: `${qaResult.issues.length} issue${qaResult.issues.length !== 1 ? "s" : ""} found — revising content…`,
        issues: qaResult.issues,
      });

      emit(res, "content_architect", "running", {
        message: "Re-drafting content with QA feedback…",
        revision: true,
      });
      try {
        const issueDescriptions = qaResult.issues.map(i => `${i.field}: ${i.problem} — Fix: ${i.fix}`);
        const revised = await runContentArchitect(market, brief, issueDescriptions);
        req.log.info({ title: revised.title }, "Content revision done");
        emit(res, "content_architect", "done", {
          message: `Revised: "${revised.title}"`,
          title: revised.title,
          subtitle: revised.subtitle,
          revision: true,
          wordCount: revised.backDescription.trim().split(/\s+/).filter(Boolean).length,
        });

        // Re-run QA
        emit(res, "qa_review", "running", { message: "Re-checking revised content…" });
        const reQA = await runQAReviewer({
          ...buildQASpec(),
          title: revised.title,
          subtitle: revised.subtitle,
          backDescription: revised.backDescription,
          words: revised.words,
        });
        req.log.info({ passed: reQA.passed, issues: reQA.issues.length }, "QA re-check done");
        finalQAIssues = reQA.issues;
        finalQAPassed = reQA.passed;
        emit(res, "qa_review", "done", {
          message: reQA.passed
            ? "All checks passed after revision"
            : `${reQA.issues.length} issue(s) remain — proceeding with best effort`,
          passed: reQA.passed,
          issues: reQA.issues,
          checksCount: usedCombos.length > 0 ? 7 : 6,
        });
      } catch (revErr) {
        req.log.error({ revErr }, "Revision or re-QA failed");
        emit(res, "content_architect", "failed", { message: "Revision failed. Using council content.", revision: true });
        emit(res, "qa_review", "failed", { message: "Re-check failed. Proceeding with council content.", issues: qaResult.issues });
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

  // ─── Stage 11: Assemble & Save (+ Series Arc Planner in parallel) ───────────
  const finalCoverStyle = hasCoverImage ? "photo" : finalStyle;
  const fullBackDescription = finalHookSentence
    ? `${finalHookSentence}\n\n${finalBackDescription}`
    : finalBackDescription;

  emit(res, "assemble", "running", { message: "Saving Book Spec · Planning series arc…" });
  try {
    // Run DB save and Series Arc Planner concurrently
    const [bookRows, seriesArc] = await Promise.all([
      db.insert(booksTable).values({
        title: finalTitle,
        subtitle: finalSubtitle,
        author: draft.author,
        puzzleType: market.puzzleType,
        puzzleCount: finalPuzzleCount,
        difficulty: market.difficulty,
        largePrint: market.largePrint,
        paperType: finalPaperType,
        theme: finalTheme,
        coverStyle: finalCoverStyle,
        backDescription: fullBackDescription,
        words: draft.words,
        wordCategory: draft.wordCategory,
        coverImageUrl: coverImageDataUrl,
        niche: market.niche,
        volumeNumber: draft.volumeNumber,
        dedication: null,
        difficultyMode: "uniform",
        challengeDays: null,
        keywords: finalKeywords,
      }).returning(),
      runSeriesArcPlanner(
        market,
        bookSpec,
        finalTitle,
        finalTheme,
        draft.wordCategory ?? "General",
      ).catch((err) => {
        req.log.error({ err }, "Series Arc Planner failed — skipping");
        return null;
      }),
    ]);

    const book = bookRows[0];
    req.log.info({ bookId: book.id, title: book.title, hasSeriesArc: !!seriesArc }, "Book assembled and saved");
    emit(res, "assemble", "done", {
      message: seriesArc
        ? `Book saved · Series arc "${seriesArc.seriesName}" planned (${seriesArc.volumes.length} more volumes)`
        : "Book saved to your library!",
    });

    const donePayload: Record<string, unknown> = {
      stage: "done",
      bookId: book.id,
      title: finalTitle,
      subtitle: finalSubtitle,
      puzzleType: market.puzzleType,
      puzzleCount: finalPuzzleCount,
      theme: finalTheme,
      hasCoverImage,
      qaFailed,
      qaPassed: finalQAPassed,
      qaIssues: finalQAIssues,
      descWordCount: finalBackDescription.trim().split(/\s+/).filter(Boolean).length,
      // Series Arc from Series Arc Planner
      seriesArc: seriesArc ?? null,
      // Book Intelligence Report
      bookIntelligence: bookSpec ? {
        councilSummary: bookSpec.councilSummary,
        overallRationale: bookSpec.overallRationale,
        conflictsResolved: bookSpec.conflictsResolved,
        recommendedPrice: bookSpec.recommendedPrice,
        royaltyEstimate: bookSpec.royaltyEstimate,
        pricingNotes: bookSpec.pricingNotes,
        coverRationale: bookSpec.coverRationale,
        puzzleQualityNotes: bookSpec.puzzleQualityNotes,
        difficultyDescriptor: bookSpec.difficultyDescriptor,
      } : null,
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

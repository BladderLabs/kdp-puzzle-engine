﻿﻿﻿import { Router, type IRouter } from "express";
import type { Response } from "express";
import { z } from "zod";
import { db, booksTable, authorPersonasTable, cachedRun, stableKey } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runListingIntelligence } from "../../lib/agents/listing-intelligence";
import { runCoverQAGate } from "../../lib/agents/cover-qa-gate";
import { applyBranding } from "../../lib/gift-year-branding";
import { runNarrativeArchitect, type NarrativeArc } from "../../lib/agents/narrative-architect";
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
import { runBuyerPsychologyProfiler, type BuyerProfile } from "../../lib/agents/buyer-psychology-profiler";
import { expandNicheWordBank, getNicheByKey } from "../../lib/niches";
import { roundTwoDesignCompatibility } from "../../lib/agents/cover-design-analyst";
import { roundTwoColorCompatibility } from "../../lib/agents/cover-color-strategist";
import { roundTwoTypographyCompatibility } from "../../lib/agents/cover-typography-director";

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
  experienceMode: z.enum(["standard", "sketch", "detective", "adventure", "darkacademia", "cozycottage", "mindful"]).optional(),
  giftSku: z.boolean().optional(),
  giftRecipient: z.string().optional(),
  yearBranding: z.boolean().optional(),
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
  const experienceMode = parsed.success ? (parsed.data.experienceMode ?? "standard") : "standard";
  const giftSku = parsed.success ? Boolean(parsed.data.giftSku) : false;
  const giftRecipient = parsed.success ? parsed.data.giftRecipient : undefined;
  const yearBrandingEnabled = parsed.success ? (parsed.data.yearBranding ?? true) : true;

  // ── Active Author Persona lookup ──────────────────────────────────────────
  // Every book the engine produces is published under the one AI-selected
  // persona. If no persona exists, we fall back to the Content Architect's
  // generated author — but log it so the first-run wizard can be surfaced.
  let activePersona: typeof authorPersonasTable.$inferSelect | null = null;
  try {
    const [p] = await db
      .select()
      .from(authorPersonasTable)
      .where(eq(authorPersonasTable.isActive, true))
      .limit(1);
    activePersona = p ?? null;
    if (!activePersona) {
      req.log.warn("No active author persona — pipeline will use Content Architect's generated author");
    }
  } catch (err) {
    req.log.warn({ err }, "Active persona lookup failed — continuing without persona");
  }
  // Normalize evidence: top 3 by demand_score (contract for Market Scout grounding)
  const rawEvidence = parsed.success ? (parsed.data.marketEvidence as ApifyProduct[] | undefined) : undefined;
  const marketEvidence = rawEvidence && rawEvidence.length > 0
    ? [...rawEvidence].sort((a, b) => b.demand_score - a.demand_score).slice(0, 3)
    : undefined;

  // ── Always query DB for usedCombos (server-side authoritative) ───────────────
  // DB-derived list is the authoritative source; merge with any client-provided combos
  // to account for combos from the current session not yet committed to DB.
  let usedCombos: string[] = [];
  try {
    const existingBooks = await db.select().from(booksTable).orderBy(desc(booksTable.id));
    const dbCombos = [...new Set(existingBooks.map(b => `${b.theme}+${b.coverStyle}+${b.niche ?? "general"}`))];
    const clientCombos = parsed.success && parsed.data.usedCombos ? parsed.data.usedCombos : [];
    usedCombos = [...new Set([...dbCombos, ...clientCombos])];
  } catch (_) { /* non-critical — proceed without uniqueness constraint */ }

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
  // If this book joins an existing series, pull Vol 1-N context so the
  // Content Architect can dedupe words, escalate theme, and keep the
  // brand voice consistent across every volume.
  let seriesContext: Parameters<typeof runContentArchitect>[3] = undefined;
  if (requestedSeriesName) {
    try {
      const prior = await db.select({
        volumeNumber: booksTable.volumeNumber,
        title: booksTable.title,
        subtitle: booksTable.subtitle,
        backDescription: booksTable.backDescription,
        words: booksTable.words,
      })
        .from(booksTable)
        .where(eq(booksTable.seriesName, requestedSeriesName))
        .orderBy(booksTable.volumeNumber);
      if (prior.length > 0) {
        const maxVol = Math.max(...prior.map(p => p.volumeNumber ?? 1));
        seriesContext = {
          seriesName: requestedSeriesName,
          nextVolumeNumber: maxVol + 1,
          authorPenName: activePersona?.penName ?? null,
          previousVolumes: prior.map(p => ({
            volumeNumber: p.volumeNumber ?? 1,
            title: p.title,
            subtitle: p.subtitle,
            backDescription: p.backDescription,
            words: (p.words ?? []) as string[],
          })),
        };
        req.log.info(
          { series: requestedSeriesName, priorVolumes: prior.length, nextVol: maxVol + 1 },
          "Series context assembled",
        );
      }
    } catch (err) {
      req.log.warn({ err }, "Series context lookup failed — Vol 2+ will be generated without continuity");
    }
  }

  let draft: ContentArchitectResult;
  let buyerProfile: BuyerProfile | undefined;
  emit(res, "content_architect", "running", {
    message: seriesContext
      ? `Drafting Vol ${seriesContext.nextVolumeNumber} with continuity from ${seriesContext.previousVolumes.length} prior volume${seriesContext.previousVolumes.length === 1 ? "" : "s"}…`
      : "Drafting title, description, and puzzle words…",
  });
  try {
    draft = await runContentArchitect(market, brief, undefined, seriesContext);
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

  // ─── Stage 3: Buyer Psychology Profiler ─────────────────────────────────────
  // Runs before the Content Council so the buyer profile can guide both the
  // sales copy (emotion / copy angle) and the cover design (visual metaphor / mood).
  emit(res, "buyer_profiler", "running", { message: "Profiling buyer psychology…" });
  try {
    buyerProfile = await cachedRun(
      "buyer-psychology",
      stableKey({
        niche: market.niche,
        puzzleType: market.puzzleType,
        audience: market.audienceProfile,
        largePrint: market.largePrint === true,
      }),
      () => runBuyerPsychologyProfiler(
        market.niche,
        market.nicheLabel,
        market.puzzleType,
        market.audienceProfile,
        market.largePrint === true,
        draft.title,
        draft.backDescription,
      ),
    );
    req.log.info({ primaryEmotion: buyerProfile.primaryEmotion, buyerMoment: buyerProfile.buyerMoment }, "Buyer Psychology Profiler done");
    emit(res, "buyer_profiler", "done", {
      message: `Emotion: ${buyerProfile.primaryEmotion} · Angle: ${buyerProfile.copyAngle.slice(0, 60)}…`,
      primaryEmotion: buyerProfile.primaryEmotion,
      copyAngle: buyerProfile.copyAngle,
    });
  } catch (err) {
    req.log.warn({ err }, "Buyer Psychology Profiler failed — content council will use generic copy framework");
    emit(res, "buyer_profiler", "done", { message: "Buyer profiler skipped — using generic copy framework" });
    buyerProfile = undefined;
  }

  // ─── Stages 4 & 5: Content Council + Cover Research (parallel) ───────────────
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
      // Content Excellence Council — buyer profile wired in for psychology-led copy
      runContentExcellenceCouncil(market, draft, buyerProfile)
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

      // Cover Design Council — buyer profile already available from Stage 3
      (async () => {
        const hasAiImage = true;
        const coverCacheKey = stableKey({
          niche: market.niche,
          puzzleType: market.puzzleType,
          audience: market.audienceProfile,
          largePrint: market.largePrint === true,
          hasImage: hasAiImage,
        });
        const [designAnalysis, colorStrategy, typographySpec] = await Promise.all([
          cachedRun(
            "cover-design-analyst",
            coverCacheKey,
            () => runCoverDesignAnalyst(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, hasAiImage, buyerProfile),
          ).then(r => {
            coverSubAgentDone.push("Design Analyst");
            emit(res, "cover_research", "running", { message: coverProgress() });
            return r;
          }),
          cachedRun(
            "cover-color-strategist",
            coverCacheKey,
            () => runCoverColorStrategist(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, market.largePrint === true, buyerProfile),
          ).then(r => {
            coverSubAgentDone.push("Color Strategist");
            emit(res, "cover_research", "running", { message: coverProgress() });
            return r;
          }),
          cachedRun(
            "cover-typography-director",
            coverCacheKey,
            () => runCoverTypographyDirector(market.niche, market.nicheLabel, market.puzzleType, market.audienceProfile, market.largePrint === true, buyerProfile),
          ).then(r => {
            coverSubAgentDone.push("Typography Director");
            emit(res, "cover_research", "running", { message: coverProgress() });
            return r;
          }),
        ]);

        // Round-2 cross-talk: 3 parallel Haiku calls — each specialist checks compatibility with the other two.
        // Cached against the same cover key since outputs are deterministic given the same three round-1 inputs.
        const [designCrossTalk, colorCrossTalk, typographyCrossTalk] = await Promise.all([
          cachedRun(
            "cross-talk-design",
            coverCacheKey,
            () => roundTwoDesignCompatibility(designAnalysis, colorStrategy, typographySpec),
          ),
          cachedRun(
            "cross-talk-color",
            coverCacheKey,
            () => roundTwoColorCompatibility(colorStrategy, designAnalysis, typographySpec),
          ),
          cachedRun(
            "cross-talk-typography",
            coverCacheKey,
            () => roundTwoTypographyCompatibility(typographySpec, designAnalysis, colorStrategy),
          ),
        ]);
        const crossTalkFlags = {
          design: designCrossTalk,
          color: colorCrossTalk,
          typography: typographyCrossTalk,
        };
        req.log.info({ crossTalkFlags }, "Round-2 cross-talk complete");

        emit(res, "cover_research", "running", { message: "Cover Director synthesising council findings…" });
        const spec = await runCoverDirector(market, draft, designAnalysis, colorStrategy, typographySpec, buyerProfile, crossTalkFlags);
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

  // ─── Stages 6, 7, 8: Puzzle + Interior + Production + Word Bank Expansion (parallel) ─
  let puzzleSpec: PuzzleSpec | null = null;
  let layoutSpec: LayoutSpec | null = null;
  let productionSpec: ProductionSpec | null = null;
  // Expanded word bank: 200+ unique niche-specific words, used for Word Search and Crossword puzzles.
  // Runs concurrently with the councils; falls back to draft.words if AI call fails.
  let expandedWords: string[] = draft.words;

  emit(res, "puzzle_council", "running", { message: "Difficulty Calibrator + Layout Engineer researching…" });
  emit(res, "interior_council", "running", { message: "Typography Expert + Page Layout Architect researching…" });
  emit(res, "production_council", "running", { message: "Format Strategist + Pricing Expert researching…" });

  try {
    const estimatedPageCount = Math.ceil((market.puzzleCount ?? 100) * 1.15) + 20;
    const isWordBased = ["Word Search", "Crossword"].includes(market.puzzleType);
    // Council cache keys — niche+format tuple is stable across books in the same niche.
    // Interior Council includes a page-count bucket so very different book sizes don't share output.
    const councilsKey = stableKey({
      niche: market.niche,
      puzzleType: market.puzzleType,
      difficulty: market.difficulty,
      largePrint: market.largePrint === true,
      count: market.puzzleCount ?? 100,
    });
    const interiorKey = stableKey({
      niche: market.niche,
      puzzleType: market.puzzleType,
      largePrint: market.largePrint === true,
      pageBucket: Math.round(estimatedPageCount / 25) * 25, // bucket to nearest 25 pages
    });
    const [puzzle, layout, production, wordBankResult] = await Promise.all([
      cachedRun("puzzle-production-council", councilsKey, () => runPuzzleProductionCouncil(market))
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

      cachedRun("interior-design-council", interiorKey, () => runInteriorDesignCouncil(market, estimatedPageCount))
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

      cachedRun("production-pricing-council", councilsKey, () => runProductionPricingCouncil(market))
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

      // Word bank expansion — runs in parallel with councils, zero extra latency.
      // Seed uses the STATIC niche bank (guaranteed vocabulary baseline); draft.words
      // (content-architect LLM output) is merged only if the static bank is absent.
      // On failure or <80 AI words returned, expandNicheWordBank falls back to the
      // static seed — never to draft.words — preserving niche-authentic vocabulary.
      isWordBased
        ? ((): Promise<string[]> => {
            const nicheData = getNicheByKey(market.niche);
            const staticSeed = nicheData?.words ?? draft.words; // static niche bank is the seed
            return expandNicheWordBank(market.niche, market.puzzleType, market.difficulty, market.audienceProfile, staticSeed)
              .then(expanded => {
                req.log.info({ niche: market.niche, staticSeed: staticSeed.length, expanded: expanded.length }, "Word bank expanded");
                return expanded;
              })
              .catch(err => {
                req.log.warn({ err, niche: market.niche }, "Word bank expansion failed — using static niche seed");
                return staticSeed; // fallback to static niche bank, not draft.words
              });
          })()
        : Promise.resolve(draft.words),
    ]);

    puzzleSpec = puzzle;
    layoutSpec = layout;
    productionSpec = production;
    expandedWords = wordBankResult;
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
  // let — finalTheme and finalStyle may be swapped in QA cover_diversity revision loop
  let finalTheme = bookSpec?.coverTheme ?? coverDesignSpec.theme ?? market.recommendedTheme ?? market.theme;
  let finalStyle = bookSpec?.coverStyle ?? coverDesignSpec.style ?? market.coverStyle;
  let finalTitle = bookSpec?.title ?? contentSpec.title;
  const finalSubtitle = bookSpec?.subtitle ?? contentSpec.subtitle;
  let finalHookSentence = bookSpec?.hookSentence ?? contentSpec.hookSentence;
  let finalKeywords = bookSpec?.keywords ?? contentSpec.keywords;
  // finalPuzzleCount resolved BEFORE description so we can normalise any stale count in the copy
  const finalPuzzleCount = bookSpec?.puzzleCount ?? puzzleSpec?.recommendedPuzzleCount ?? market.puzzleCount ?? 100;
  const finalPaperType = bookSpec?.paperType ?? productionSpec?.paperType ?? "white";
  // Normalise puzzle count in description: replace any "N puzzle(s)" pattern with the authoritative count.
  // This prevents hallucinated counts (e.g. "50 relaxing puzzles") when the Puzzle Council or Master
  // Director overrides the Market Scout's initial recommendation.
  const finalBackDescription = (() => {
    const raw = bookSpec?.backDescription ?? contentSpec.backDescription;
    return raw.replace(
      /\b\d{1,3}(\s+(?:unique|carefully\s+crafted|relaxing|stimulating|fun|challenging|themed|original|hand-crafted|engaging|brand-new))*\s+puzzles?\b/gi,
      (match) => match.replace(/^\d{1,3}/, String(finalPuzzleCount)),
    );
  })();
  const enrichedImagePrompt = bookSpec?.coverImagePrompt ?? coverDesignSpec.enrichedImagePrompt;

  // ─── Stage 8b: Listing Intelligence (replaces hallucinated keywords with data-grounded) ──
  // Uses real Apify competitor data when available (from marketEvidence), otherwise
  // falls back to Claude-only analytical mode. Always produces: 7 ranked keywords,
  // 2 browse categories, Ogilvy HTML description, slug, competitor brief.
  let listingCategories: Array<{ breadcrumb: string; rationale: string }> = [];
  let listingDescriptionHtml = "";
  let listingSlug = "";
  let listingPriceUsd: number | null = null;
  let listingRoyaltyUsd: number | null = null;
  emit(res, "listing_intelligence", "running", { message: "Listing Intelligence — keywords, categories, Ogilvy description…" });
  try {
    const competitorPayload = marketEvidence?.map(m => ({
      title: m.title,
      price: m.price ?? undefined,
      bsr: m.bsr ?? undefined,
      reviewCount: m.reviews,
    }));
    const avgPrice = marketEvidence && marketEvidence.length > 0
      ? marketEvidence.filter(m => m.price != null).reduce((s, m) => s + (m.price ?? 0), 0) / Math.max(1, marketEvidence.filter(m => m.price != null).length)
      : undefined;
    const listing = await runListingIntelligence({
      niche: market.niche,
      nicheLabel: market.nicheLabel,
      puzzleType: market.puzzleType,
      puzzleCount: finalPuzzleCount,
      difficulty: market.difficulty,
      largePrint: market.largePrint === true,
      audience: market.audienceProfile,
      authorPenName: activePersona?.penName,
      experienceMode,
      year: new Date().getFullYear(),
      volumeNumber: draft.volumeNumber ?? 1,
      giftSku,
      seriesName: requestedSeriesName,
      competitors: competitorPayload,
      avgCompetitorPrice: avgPrice,
    });
    finalTitle = listing.title;
    finalHookSentence = listing.hookSentence;
    finalKeywords = listing.keywords;
    listingCategories = listing.categories;
    listingDescriptionHtml = listing.descriptionHtml;
    listingSlug = listing.slug;
    listingPriceUsd = listing.priceUsd;
    listingRoyaltyUsd = listing.royaltyUsd;
    req.log.info({ listingTitle: listing.title, price: listing.priceUsd }, "Listing Intelligence done");
    emit(res, "listing_intelligence", "done", {
      message: `Listing: "${listing.title}" · $${listing.priceUsd.toFixed(2)} · ${listing.keywords.length} keywords · ${listing.categories.length} categories`,
      title: listing.title,
      keywords: listing.keywords,
      categories: listing.categories,
      priceUsd: listing.priceUsd,
      royaltyUsd: listing.royaltyUsd,
    });
  } catch (err) {
    req.log.warn({ err }, "Listing Intelligence failed — using bookSpec/content council values");
    emit(res, "listing_intelligence", "done", { message: "Listing Intelligence skipped — using council values" });
  }

  // ─── Stage 8c: Gift-SKU + Year-Branding ──────────────────────────────────
  // Applies year token (2026/2027 with Q4 rollover) and, when giftSku is set,
  // merges gift keyword boosters + frames the hook sentence.
  const brandingResult = applyBranding(
    { title: finalTitle, subtitle: finalSubtitle, keywords: finalKeywords, hookSentence: finalHookSentence },
    {
      yearBranding: yearBrandingEnabled ? {} : false,
      giftSku: giftSku ? { recipientLabel: giftRecipient } : false,
      coverAccent: bookSpec?.coverAccentHex ?? coverDesignSpec.accentHex,
    },
  );
  if (brandingResult.title !== finalTitle) finalTitle = brandingResult.title;
  if (brandingResult.keywords) finalKeywords = brandingResult.keywords;
  if (brandingResult.hookSentence) finalHookSentence = brandingResult.hookSentence;
  if (brandingResult.yearApplied || brandingResult.giftApplied) {
    emit(res, "branding", "done", {
      message: `Branding applied: ${brandingResult.yearApplied ? `year=${brandingResult.yearApplied}` : ""}${brandingResult.giftApplied ? " gift=on" : ""}`,
      yearApplied: brandingResult.yearApplied,
      giftApplied: brandingResult.giftApplied,
    });
  }

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
      buyerProfile,
      experienceMode,
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

  // ─── Stage 9b: Cover QA Gate (heuristic pre-flight) ─────────────────────────
  // Purely static heuristic — validates title/contrast/keywords/puzzle-count/
  // safe-zones on the final resolved values. Never blocks; always records its
  // verdict on the book row so the dashboard can surface failing covers.
  let qaGateScore: number | null = null;
  let qaGateIssues: Array<{ code: string; severity: string; message: string }> = [];
  try {
    const gate = runCoverQAGate({
      title: finalTitle,
      subtitle: finalSubtitle,
      author: activePersona?.penName ?? draft.author,
      backDescription: finalBackDescription,
      puzzleType: market.puzzleType,
      puzzleCount: finalPuzzleCount,
      difficulty: market.difficulty,
      theme: finalTheme,
      coverStyle: finalStyle,
      experienceMode,
      keywords: finalKeywords,
      volumeNumber: draft.volumeNumber ?? 1,
      largePrint: market.largePrint === true,
      coverImageUrl: coverImageDataUrl ?? undefined,
      accentHexOverride: bookSpec?.coverAccentHex ?? coverDesignSpec.accentHex,
    });
    qaGateScore = gate.score;
    qaGateIssues = gate.issues.map(i => ({ code: i.code, severity: i.severity, message: i.message }));
    req.log.info({ qaGateScore: gate.score, issues: gate.issues.length, passed: gate.passed }, "Cover QA Gate done");
    emit(res, "cover_qa_gate", "done", {
      message: gate.summary,
      score: gate.score,
      passed: gate.passed,
      issues: qaGateIssues,
    });
  } catch (err) {
    req.log.warn({ err }, "Cover QA Gate failed — skipping");
  }

  // ─── Stage 10: QA Review ────────────────────────────────────────────────────
  // 3-field combo (theme+coverStyle+niche); uses final resolved values (not raw market values)
  const ALL_THEMES_ORDERED = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
  const ALL_STYLES_ORDERED = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth"];
  let coverCombo = `${finalTheme}+${finalStyle}+${market.niche}`;
  const buildQASpec = () => ({
    title: finalTitle,
    subtitle: finalSubtitle,
    backDescription: finalBackDescription,
    puzzleCount: finalPuzzleCount,
    keywords: finalKeywords,
    hasImage: hasCoverImage,
    words: draft.words,
    author: draft.author,
    hookSentence: finalHookSentence || undefined,
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
        message: `${qaResult.issues.length} issue${qaResult.issues.length !== 1 ? "s" : ""} found — revising…`,
        issues: qaResult.issues,
      });

      // ── Separate cover_diversity issues from content issues ───────────────────
      const hasCoverDiversityIssue = qaResult.issues.some(i => i.field === "cover_combination");
      const contentIssues = qaResult.issues.filter(i => i.field !== "cover_combination");

      // ── Step A: Fix cover_diversity — swap both theme+style, regenerate cover ────
      if (hasCoverDiversityIssue) {
        let newTheme: string | null = null;
        let newStyle: string | null = null;
        // Find the first unused theme+style combination for this niche
        outer: for (const theme of ALL_THEMES_ORDERED) {
          for (const style of ALL_STYLES_ORDERED) {
            const candidate = `${theme}+${style}+${market.niche}`;
            if (!usedCombos.includes(candidate)) {
              newTheme = theme;
              newStyle = style;
              break outer;
            }
          }
        }

        if (newTheme && newStyle) {
          finalTheme = newTheme;
          finalStyle = newStyle;
          coverCombo = `${finalTheme}+${finalStyle}+${market.niche}`;
          req.log.info({ newTheme, newStyle, niche: market.niche }, "Cover diversity fix: swapped theme+style");
          emit(res, "qa_review", "running", {
            message: `Cover uniqueness fix: switching to "${finalTheme}/${finalStyle}" theme+style — regenerating cover art…`,
          });

          // Regenerate cover art with the new theme+style to keep image consistent with metadata
          try {
            const newCoverResult = await runCoverArtDirector(
              finalTheme,
              market.puzzleType,
              finalStyle,
              finalTitle,
              market.niche,
              enrichedImagePrompt || undefined,
              buyerProfile,
              experienceMode,
            );
            if (newCoverResult) {
              coverImageDataUrl = `data:${newCoverResult.mimeType};base64,${newCoverResult.b64_json}`;
              hasCoverImage = true;
              req.log.info({ theme: finalTheme, style: finalStyle }, "Cover art regenerated after diversity fix");
            } else {
              coverImageDataUrl = null;
              hasCoverImage = false;
            }
          } catch (coverErr) {
            req.log.error({ coverErr }, "Cover art regeneration failed after diversity fix — using SVG theme art");
            coverImageDataUrl = null;
            hasCoverImage = false;
          }
        } else {
          req.log.warn({ niche: market.niche }, "Cover diversity: no alternative theme+style available — proceeding");
        }
      }

      // ── Step B: Fix content issues via Content Architect ─────────────────────
      if (contentIssues.length > 0) {
        emit(res, "content_architect", "running", {
          message: "Re-drafting content with QA feedback…",
          revision: true,
        });
        try {
          const issueDescriptions = contentIssues.map(i => `${i.field}: ${i.problem} — Fix: ${i.fix}`);
          const revised = await runContentArchitect(market, brief, issueDescriptions);
          req.log.info({ title: revised.title }, "Content revision done");
          emit(res, "content_architect", "done", {
            message: `Revised: "${revised.title}"`,
            title: revised.title,
            subtitle: revised.subtitle,
            revision: true,
            wordCount: revised.backDescription.trim().split(/\s+/).filter(Boolean).length,
          });

          // Re-run QA with revised content + (possibly new) theme
          emit(res, "qa_review", "running", { message: "Re-checking revised content…" });
          const reQA = await runQAReviewer({
            ...buildQASpec(),
            coverCombo,
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
      } else {
        // Only cover_diversity issue — no content revision needed, just re-run QA with new theme
        try {
          emit(res, "qa_review", "running", { message: "Re-checking with updated cover theme…" });
          const reQA = await runQAReviewer(buildQASpec());
          req.log.info({ passed: reQA.passed, issues: reQA.issues.length }, "QA cover re-check done");
          finalQAIssues = reQA.issues;
          finalQAPassed = reQA.passed;
          emit(res, "qa_review", "done", {
            message: reQA.passed
              ? `All checks passed — cover theme changed to "${finalTheme}"`
              : `${reQA.issues.length} issue(s) remain — proceeding with best effort`,
            passed: reQA.passed,
            issues: reQA.issues,
            checksCount: usedCombos.length > 0 ? 7 : 6,
          });
        } catch (revErr) {
          req.log.error({ revErr }, "QA cover re-check failed");
          finalQAIssues = qaResult.issues;
          qaFailed = true;
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "QA Reviewer failed");
    emit(res, "qa_review", "failed", { message: "QA check failed — pipeline cannot continue." });
    res.write(`data: ${JSON.stringify({ stage: "error", message: "QA Reviewer failed unexpectedly. Please try again." })}\n\n`);
    res.end();
    return;
  }

  // ─── Stage 10b: Narrative Architect (Solve-the-Story) ───────────────────────
  // Only runs for detective / adventure experience modes. Produces a case
  // file with N clue beats or a treasure quest with coordinates — narrative
  // structure the interior PDF can render as preamble + revelation pages.
  let narrativeArc: NarrativeArc | null = null;
  if (experienceMode === "detective" || experienceMode === "adventure") {
    emit(res, "narrative_arc", "running", {
      message: experienceMode === "detective"
        ? "Narrative Architect drafting the case file…"
        : "Narrative Architect charting the quest…",
    });
    try {
      narrativeArc = await runNarrativeArchitect({
        mode: experienceMode,
        title: finalTitle,
        niche: market.niche,
        nicheLabel: market.nicheLabel,
        puzzleType: market.puzzleType,
        puzzleCount: finalPuzzleCount,
        difficulty: market.difficulty,
        audience: market.audienceProfile,
        words: expandedWords.slice(0, 60),
        authorPenName: activePersona?.penName,
      });
      const beatCount = narrativeArc.beats.length;
      const name = narrativeArc.mode === "detective" ? narrativeArc.caseName : narrativeArc.questName;
      req.log.info({ mode: narrativeArc.mode, name, beatCount }, "Narrative Architect done");
      emit(res, "narrative_arc", "done", {
        message: `${narrativeArc.mode === "detective" ? "Case" : "Quest"}: "${name}" · ${beatCount} beats drafted`,
        mode: narrativeArc.mode,
        name,
        beatCount,
      });
    } catch (err) {
      req.log.warn({ err }, "Narrative Architect failed — book ships without Solve-the-Story pages");
      emit(res, "narrative_arc", "done", { message: "Narrative step skipped — book ships as standard puzzle collection" });
      narrativeArc = null;
    }
  }

  // ─── Stage 11: Assemble & Save (+ Series Arc Planner in parallel) ───────────
  // Always persist actual finalStyle (not "photo") so theme+style+niche uniqueness is stable across runs.
  // AI cover presence is indicated by coverImageUrl being non-null.
  const finalCoverStyle = finalStyle;
  // ── Canonical KDP HTML formatter ─────────────────────────────────────────────
  // Deterministically structures the description into KDP-safe HTML regardless of
  // model variance. Rules:
  //   1. If body already contains KDP HTML tags (<p>, <ul>, <li>), keep as-is.
  //   2. If body is plain text with bullet-like lines (•, -, *, "1."), convert
  //      those lines to <ul><li> and non-bullet lines to <p>.
  //   3. Single-paragraph plain text → <p>.
  //   4. Hook sentence (always plain text) → prepended as <p><b>…</b></p>.
  // The PDF back cover strips all HTML via stripForPrint(); Amazon KDP product
  // page receives the raw HTML field directly (seller copy-pastes into KDP).
  const fullBackDescription = (() => {
    const hook = finalHookSentence?.trim() ?? "";
    let body = finalBackDescription.trim();

    if (!/<(?:ul|ol|p|li|b|br)[\s>]/i.test(body)) {
      const lines = body.split(/\n+/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        body = "<p>Carefully crafted puzzles for hours of enjoyment.</p>";
      } else if (lines.length === 1) {
        body = `<p>${lines[0]}</p>`;
      } else {
        const bulletRe = /^[•\-\*]|\d+[.)]\s/;
        const bulletLines = lines.filter(l => bulletRe.test(l));
        const paraLines = lines.filter(l => !bulletRe.test(l));
        const paras = paraLines.map(l => `<p>${l}</p>`).join("\n");
        if (bulletLines.length >= 2) {
          const items = bulletLines
            .map(l => l.replace(/^[•\-\*\d]+[.)]\s*/, ""))
            .map(l => `<li>${l}</li>`)
            .join("");
          body = (paras ? paras + "\n" : "") + `<ul>${items}</ul>`;
        } else {
          body = lines.map(l => `<p>${l}</p>`).join("\n");
        }
      }
    }

    return hook ? `<p><b>${hook}</b></p>\n${body}` : body;
  })();

  // ── Series continuation: resolve seriesName + auto-increment volumeNumber ────
  let resolvedSeriesName: string | null = null;
  let resolvedVolumeNumber: number = draft.volumeNumber ?? 1;
  if (requestedSeriesName) {
    resolvedSeriesName = requestedSeriesName;
    try {
      const seriesBooks = await db.select({ vol: booksTable.volumeNumber })
        .from(booksTable)
        .where(eq(booksTable.seriesName, requestedSeriesName));
      const maxVol = seriesBooks.length > 0
        ? Math.max(...seriesBooks.map(b => b.vol))
        : 0;
      resolvedVolumeNumber = maxVol + 1;
      req.log.info({ series: requestedSeriesName, nextVol: resolvedVolumeNumber }, "Series continuation resolved");
    } catch (_) { /* non-critical */ }
  }

  emit(res, "assemble", "running", { message: "Saving Book Spec · Planning series arc…" });
  try {
    // Run DB save and Series Arc Planner concurrently
    const [bookRows, seriesArc] = await Promise.all([
      // Cast the insert values through `Record<string, unknown>` so we're not
      // blocked when the compiled `@workspace/db` dist hasn't been rebuilt
      // after migration 002 added narrativeArcJson/amazonAsin columns. The
      // Drizzle runtime handles the actual column mapping — this cast is
      // purely a TypeScript accommodation.
      db.insert(booksTable).values({
        title: finalTitle,
        subtitle: finalSubtitle,
        author: activePersona?.penName ?? draft.author,
        puzzleType: market.puzzleType,
        puzzleCount: finalPuzzleCount,
        difficulty: market.difficulty,
        largePrint: market.largePrint,
        paperType: finalPaperType,
        theme: finalTheme,
        coverStyle: finalCoverStyle,
        backDescription: fullBackDescription,
        words: expandedWords,
        wordCategory: draft.wordCategory,
        coverImageUrl: coverImageDataUrl,
        niche: market.niche,
        volumeNumber: resolvedVolumeNumber,
        seriesName: resolvedSeriesName,
        dedication: null,
        difficultyMode: "uniform",
        challengeDays: null,
        keywords: finalKeywords,
        accentHexOverride: bookSpec?.coverAccentHex ?? coverDesignSpec.accentHex ?? null,
        casingOverride: coverDesignSpec.casingDirective ?? null,
        fontStyleDirective: coverDesignSpec.fontStyleDirective ?? null,
        // ── Advanced pipeline fields ─────────────────────────────────────────
        experienceMode,
        authorPersonaId: activePersona?.id ?? null,
        giftSku,
        giftRecipient: giftRecipient ?? null,
        listingCategories: listingCategories.length > 0 ? listingCategories : null,
        listingDescriptionHtml: listingDescriptionHtml || null,
        listingSlug: listingSlug || null,
        priceRecommended: listingPriceUsd != null ? listingPriceUsd.toFixed(2) : null,
        royaltyEstimate: listingRoyaltyUsd != null ? listingRoyaltyUsd.toFixed(2) : null,
        qaScore: qaGateScore,
        qaIssuesJson: qaGateIssues.length > 0 ? qaGateIssues : null,
        narrativeArcJson: narrativeArc,
      } as unknown as typeof booksTable.$inferInsert).returning(),
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
      descWordCount: finalBackDescription.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length,
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
      // Buyer Psychology Profile — for UI display and future generate requests
      buyerProfile: buyerProfile ?? null,
      // Cover design directives — Master Director's accent wins over Cover Director's default
      coverDirectives: {
        accentHexOverride: bookSpec?.coverAccentHex ?? coverDesignSpec.accentHex,
        casingOverride: coverDesignSpec.casingDirective,
        fontStyleDirective: coverDesignSpec.fontStyleDirective,
      },
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

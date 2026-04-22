/**
 * GET /api/opportunities
 *
 * Resilient opportunity research endpoint.
 *
 * Strategy:
 *   1. Build a deterministic seed list of 8 opportunities from the NICHES DB,
 *      the persona's primary niches, seasonal windows, and already-used combos.
 *      This is the guaranteed baseline — if every LLM call fails, this alone
 *      produces a usable card grid.
 *   2. Attempt a Claude enrichment pass that rewrites the seeds with
 *      keyword-front-loaded titles, fresh rationale, and per-card heat level.
 *   3. If Claude succeeds → merge; if Claude fails for any reason → ship
 *      the deterministic seeds. Either way the user always gets 8 cards.
 *
 * The endpoint never throws a 500 unless the DB itself is unreachable.
 */

import { Router, type IRouter } from "express";
import { db, booksTable, authorPersonasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { z } from "zod";
import { NICHES, type NicheData } from "../lib/niches";

const router: IRouter = Router();

// ── Types ───────────────────────────────────────────────────────────────────

export type HeatLevel = "hot" | "rising" | "stable";
export type ExperienceMode =
  | "standard" | "sketch" | "detective" | "adventure"
  | "darkacademia" | "cozycottage" | "mindful";

export interface Opportunity {
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  titlePreview: string;
  subtitle: string;
  audience: string;
  experienceMode: ExperienceMode;
  theme: string;
  coverStyle: string;
  difficulty: string;
  puzzleCount: number;
  largePrint: boolean;
  whySells: string;
  heatLevel: HeatLevel;
  seasonalWindow: string | null;
  estimatedPrice: number;
  estimatedRoyalty: number;
  prefilledBrief: string;
  giftSku: boolean;
  giftRecipient: string | null;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { payload: unknown; at: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

// ── Seasonal windows ────────────────────────────────────────────────────────

interface GiftWindow { name: string; date: string; recipient?: string; niches?: string[] }
const ALL_WINDOWS: GiftWindow[] = [
  { name: "Mother's Day (US)",      date: "2026-05-10", recipient: "Mom",     niches: ["mothers-day", "grandma", "anxiety-mindfulness"] },
  { name: "Graduation season",      date: "2026-05-25", recipient: "Graduate",niches: ["graduation", "teachers"] },
  { name: "Father's Day (US)",      date: "2026-06-21", recipient: "Dad",     niches: ["fathers-day", "grandpa", "retirement"] },
  { name: "Summer travel",          date: "2026-07-15", niches: ["travel", "seniors"] },
  { name: "Back to school",         date: "2026-08-20", niches: ["teachers", "kids"] },
  { name: "Halloween",              date: "2026-10-31", niches: ["halloween", "true-crime"] },
  { name: "Thanksgiving (US)",      date: "2026-11-26", niches: ["seniors", "bible"] },
  { name: "Christmas",              date: "2026-12-25", recipient: "Gift",    niches: ["christmas", "grandma", "grandpa"] },
  { name: "New Year / brain health",date: "2027-01-01", niches: ["dementia-prevention", "brain-workout-daily", "anxiety-mindfulness"] },
  { name: "Valentine's Day",        date: "2027-02-14", recipient: "Partner", niches: ["valentines"] },
  { name: "Mother's Day 2027 (US)", date: "2027-05-09", recipient: "Mom",     niches: ["mothers-day", "grandma"] },
];

function upcomingWindows(today: Date) {
  const now = today.getTime();
  return ALL_WINDOWS
    .map(w => {
      const target = new Date(w.date).getTime();
      const daysUntil = Math.round((target - now) / (24 * 60 * 60 * 1000));
      return { ...w, daysUntil };
    })
    .filter(w => w.daysUntil >= -7 && w.daysUntil <= 180)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function estimateRoyalty(price: number, largePrint: boolean, puzzleCount: number): number {
  const totalPages = 3 + puzzleCount + Math.ceil(puzzleCount / 6) + 4;
  const fixed = largePrint ? 1.0 : 0.85;
  const perPage = largePrint ? 0.015 : 0.012;
  const print = fixed + totalPages * perPage;
  return Math.max(0, Number((price * 0.6 - print).toFixed(2)));
}

function normalizeHeat(raw: unknown): HeatLevel {
  const s = String(raw || "").toLowerCase().trim();
  if (s.includes("hot") || s.includes("urgent")) return "hot";
  if (s.includes("rise") || s.includes("rising") || s.includes("emerging")) return "rising";
  return "stable";
}

function normalizeExperience(raw: unknown): ExperienceMode {
  const s = String(raw || "standard").toLowerCase().replace(/[^a-z]/g, "");
  const valid = new Set(["standard", "sketch", "detective", "adventure", "darkacademia", "cozycottage", "mindful"]);
  return valid.has(s) ? (s as ExperienceMode) : "standard";
}

function normalizeTheme(raw: unknown): string {
  const s = String(raw || "midnight").toLowerCase().trim();
  const valid = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
  return valid.includes(s) ? s : "midnight";
}

function normalizeStyle(raw: unknown): string {
  const s = String(raw || "classic").toLowerCase().trim();
  const valid = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth", "photo"];
  return valid.includes(s) ? s : "classic";
}

function safeNumber(raw: unknown, fallback: number, min = 0, max = 10000): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function yearPrefix(today: Date): string {
  return today.getMonth() >= 9 ? String(today.getFullYear() + 1) : String(today.getFullYear());
}

// ── Deterministic seed generation (the safety net) ──────────────────────────

interface SeedContext {
  today: Date;
  primaryNiches: string[];
  usedNiches: Set<string>;
  usedCombos: Set<string>;
}

function pickThemeStyleForNiche(niche: string, usedCombos: Set<string>): { theme: string; coverStyle: string } {
  const THEMES = ["midnight", "sunrise", "parchment", "violet", "forest", "crimson", "teal", "sky", "ocean", "slate"];
  const STYLES = ["classic", "luxury", "warmth", "minimal", "geometric", "bold", "retro"];
  for (const t of THEMES) {
    for (const s of STYLES) {
      if (!usedCombos.has(`${t}+${s}+${niche}`)) return { theme: t, coverStyle: s };
    }
  }
  return { theme: "midnight", coverStyle: "classic" };
}

function buildSeedFromNiche(
  nicheData: NicheData,
  ctx: SeedContext,
  window?: { name: string; daysUntil: number; recipient?: string },
): Opportunity {
  const { theme, coverStyle } = pickThemeStyleForNiche(nicheData.key, ctx.usedCombos);
  const year = yearPrefix(ctx.today);
  const titleTemplate = nicheData.titles[0] || `${nicheData.label} Puzzle Book`;
  const hasYear = /\b20\d{2}\b/.test(titleTemplate);
  const titlePreview = (hasYear ? titleTemplate : `${year} ${titleTemplate}`).replace("{N}", "1");
  const largePrint = nicheData.key === "seniors" || nicheData.label.toLowerCase().includes("large print")
    || ["grandma", "grandpa", "dementia-prevention", "mothers-day", "fathers-day"].includes(nicheData.key);

  const isGift = Boolean(window?.recipient)
    || ["mothers-day", "fathers-day", "grandma", "grandpa", "valentines", "christmas", "birthdays", "graduation", "teachers", "nurses"].includes(nicheData.key);

  const price = largePrint ? 9.99 : 7.99;
  const difficulty = nicheData.recommendedDifficulty || "Medium";
  const puzzleCount = nicheData.recommendedCount || 100;

  let heatLevel: HeatLevel = "stable";
  if (window && window.daysUntil <= 45 && window.daysUntil >= 0) heatLevel = "hot";
  else if (window && window.daysUntil <= 120) heatLevel = "rising";

  const experienceMode: ExperienceMode =
    nicheData.key === "true-crime" ? "detective"
    : nicheData.key === "anxiety-mindfulness" ? "mindful"
    : nicheData.key === "bible" ? "mindful"
    : isGift ? "cozycottage"
    : "standard";

  const seasonalWindow = window && window.daysUntil >= 0
    ? `${window.name} — ${window.daysUntil} days`
    : null;

  const whySells = window
    ? `${nicheData.label} book published into the ${window.name} window — high buyer intent with deadline pressure.`
    : `${nicheData.label} is a proven evergreen segment — documented bestsellers in this niche and the persona's primary focus.`;

  const prefilledBrief = `${puzzleCount} ${difficulty} ${nicheData.puzzleType} puzzles for ${nicheData.label}${largePrint ? ", large print edition" : ""}${isGift && window?.recipient ? `, positioned as a gift for ${window.recipient}` : ""}.`;

  return {
    niche: nicheData.key,
    nicheLabel: nicheData.label,
    puzzleType: nicheData.puzzleType,
    titlePreview,
    subtitle: nicheData.keywords[0] || "Large print puzzles for relaxation and brain training",
    audience: nicheData.label,
    experienceMode,
    theme,
    coverStyle,
    difficulty,
    puzzleCount,
    largePrint,
    whySells,
    heatLevel,
    seasonalWindow,
    estimatedPrice: price,
    estimatedRoyalty: estimateRoyalty(price, largePrint, puzzleCount),
    prefilledBrief,
    giftSku: isGift,
    giftRecipient: isGift ? (window?.recipient ?? null) : null,
  };
}

function buildSeedOpportunities(ctx: SeedContext): Opportunity[] {
  const seeds: Opportunity[] = [];
  const used = new Set<string>();
  const windows = upcomingWindows(ctx.today).filter(w => w.daysUntil >= 0);

  // Seasonal picks first (HOT)
  for (const w of windows.slice(0, 4)) {
    for (const nicheKey of (w.niches ?? [])) {
      if (used.has(nicheKey)) continue;
      const nd = NICHES.find(n => n.key === nicheKey);
      if (!nd) continue;
      if (ctx.usedNiches.has(nicheKey) && seeds.length < 4) continue;
      seeds.push(buildSeedFromNiche(nd, ctx, w));
      used.add(nicheKey);
      if (seeds.length >= 4) break;
    }
    if (seeds.length >= 4) break;
  }

  // Persona-aligned picks
  for (const primaryRaw of ctx.primaryNiches) {
    if (seeds.length >= 6) break;
    const token = primaryRaw.toLowerCase().trim();
    const match = NICHES.find(n =>
      n.key === token ||
      n.label.toLowerCase().includes(token) ||
      n.keywords.some(k => k.toLowerCase().includes(token)),
    );
    if (match && !used.has(match.key)) {
      seeds.push(buildSeedFromNiche(match, ctx));
      used.add(match.key);
    }
  }

  // Fill to 8 with high-value evergreens not yet used
  const EVERGREEN_ORDER = [
    "dementia-prevention", "brain-workout-daily", "true-crime", "seniors",
    "anxiety-mindfulness", "foodie", "bible", "nurses", "teachers",
    "gardening", "travel", "cryptogram-adults", "sudoku-easy", "sudoku-hard",
  ];
  for (const key of EVERGREEN_ORDER) {
    if (seeds.length >= 8) break;
    if (used.has(key)) continue;
    const nd = NICHES.find(n => n.key === key);
    if (!nd) continue;
    seeds.push(buildSeedFromNiche(nd, ctx));
    used.add(key);
  }

  // Absolute fallback — anything still in NICHES
  for (const nd of NICHES) {
    if (seeds.length >= 8) break;
    if (used.has(nd.key)) continue;
    seeds.push(buildSeedFromNiche(nd, ctx));
    used.add(nd.key);
  }

  return seeds.slice(0, 8);
}

// ── Claude enrichment (optional, best-effort) ──────────────────────────────

function parseModelJson(text: string): unknown {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  // Try direct JSON.parse first
  try { return JSON.parse(cleaned); } catch {}
  // Fall back to brace-slicing
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  throw new Error("Could not parse JSON from model response");
}

async function enrichWithClaude(
  seeds: Opportunity[],
  ctx: SeedContext,
): Promise<{ enriched: Opportunity[]; researchNote: string | null }> {
  const seedSummary = seeds.map((s, i) =>
    `${i + 1}. ${s.titlePreview} — ${s.niche}/${s.puzzleType} — ${s.heatLevel}${s.seasonalWindow ? ` · ${s.seasonalWindow}` : ""}`,
  ).join("\n");

  const prompt = `You are a senior Amazon KDP market editor. I've selected 8 seed opportunities for today's publishing list.
Your job: sharpen each one. Rewrite the titlePreview, subtitle, and whySells into something more compelling and accurate.
Keep all other fields (niche, puzzleType, experienceMode, theme, coverStyle, giftSku, giftRecipient, estimatedPrice) EXACTLY as given.

Today: ${ctx.today.toISOString().slice(0, 10)}.
Persona niches: ${ctx.primaryNiches.join(", ") || "(general)"}.

Seed opportunities:
${seedSummary}

Return STRICT JSON (no markdown, no commentary):
{
  "researchNote": "1-2 sentences on the single most important window",
  "cards": [
    { "i": 1, "titlePreview": "...", "subtitle": "...", "whySells": "..." },
    ...
  ]
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = parseModelJson(text) as { researchNote?: unknown; cards?: unknown };

  const enriched = [...seeds];
  if (Array.isArray(parsed.cards)) {
    for (const cardRaw of parsed.cards) {
      const card = cardRaw as Record<string, unknown>;
      const i = safeNumber(card.i, 0, 0, enriched.length);
      const idx = Math.max(0, Math.min(enriched.length - 1, i - 1));
      if (typeof card.titlePreview === "string" && card.titlePreview.length > 4) {
        enriched[idx] = { ...enriched[idx], titlePreview: card.titlePreview };
      }
      if (typeof card.subtitle === "string" && card.subtitle.length > 4) {
        enriched[idx] = { ...enriched[idx], subtitle: card.subtitle };
      }
      if (typeof card.whySells === "string" && card.whySells.length > 10) {
        enriched[idx] = { ...enriched[idx], whySells: card.whySells };
      }
    }
  }

  return {
    enriched,
    researchNote: typeof parsed.researchNote === "string" ? parsed.researchNote : null,
  };
}

// ── Main route ──────────────────────────────────────────────────────────────

router.get("/opportunities", async (req, res) => {
  try {
    const [persona] = await db
      .select()
      .from(authorPersonasTable)
      .where(eq(authorPersonasTable.isActive, true))
      .limit(1);

    const today = new Date();
    const cacheKey = `${persona?.id ?? 0}-${today.toISOString().slice(0, 10)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < TTL_MS) {
      res.json(cached.payload);
      return;
    }

    const existing = await db
      .select({
        niche: booksTable.niche,
        theme: booksTable.theme,
        coverStyle: booksTable.coverStyle,
      })
      .from(booksTable)
      .orderBy(desc(booksTable.id))
      .limit(60);

    const usedCombos = new Set(existing.map(b => `${b.theme}+${b.coverStyle}+${b.niche ?? "general"}`));
    const usedNiches = new Set(existing.map(b => b.niche).filter((n): n is string => Boolean(n)));
    const primaryNiches = (persona?.primaryNiches as string[] | null) ?? [];

    const ctx: SeedContext = { today, primaryNiches, usedNiches, usedCombos };

    // Step 1: Build deterministic seeds (always works)
    const seeds = buildSeedOpportunities(ctx);

    // Step 2: Attempt Claude enrichment (best-effort)
    let opportunities = seeds;
    let researchNote: string | null = null;
    let enrichmentStatus: "succeeded" | "skipped" | "failed" = "skipped";
    try {
      const result = await enrichWithClaude(seeds, ctx);
      opportunities = result.enriched;
      researchNote = result.researchNote;
      enrichmentStatus = "succeeded";
    } catch (err) {
      enrichmentStatus = "failed";
      req.log.warn({ err: (err as Error).message }, "Claude enrichment failed — shipping deterministic seeds");
    }

    const payload = {
      opportunities,
      researchNote,
      generatedAt: today.toISOString(),
      personaId: persona?.id ?? null,
      personaName: persona?.penName ?? null,
      source: enrichmentStatus === "succeeded" ? "claude-enriched" : "deterministic-seed",
      enrichmentStatus,
    };
    // Only cache when Claude succeeded — failed calls should retry next request
    if (enrichmentStatus === "succeeded") {
      cache.set(cacheKey, { payload, at: Date.now() });
    }

    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Opportunities endpoint failed unexpectedly");
    res.status(500).json({
      error: (err as Error).message || "Failed to research opportunities",
      detail: "Database or server error — check DATABASE_URL and server logs",
    });
  }
});

// ── Diagnostic endpoints ────────────────────────────────────────────────────

router.get("/opportunities/debug", async (req, res) => {
  try {
    const [persona] = await db
      .select()
      .from(authorPersonasTable)
      .where(eq(authorPersonasTable.isActive, true))
      .limit(1);
    const existing = await db.select().from(booksTable).limit(20);
    const today = new Date();

    res.json({
      now: today.toISOString(),
      personaFound: !!persona,
      persona: persona ? {
        id: persona.id,
        penName: persona.penName,
        niches: persona.primaryNiches,
      } : null,
      nichesDbSize: NICHES.length,
      sampleNiches: NICHES.slice(0, 5).map(n => ({ key: n.key, label: n.label })),
      booksCount: existing.length,
      cacheSize: cache.size,
      upcomingWindows: upcomingWindows(today),
      envCheck: {
        hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/opportunities/refresh", async (_req, res) => {
  cache.clear();
  res.json({ cleared: true });
});

export default router;

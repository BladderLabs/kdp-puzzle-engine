/**
 * GET /api/opportunities
 *
 * Primary path: Claude Sonnet 4.5 researches the market with full awareness of
 * persona niches, seasonal windows, used combos, and the 37-entry niches DB —
 * producing 8 ranked shippable book opportunities.
 *
 * Fallback path: deterministic seed builder from the niches DB. Only fires if
 * Claude throws (network error, bad response, etc.). Ensures the endpoint
 * never returns 500 — the user always sees a full grid.
 *
 * Cache: 6-hour per (persona, YYYY-MM-DD) when Claude succeeds.
 */

import { Router, type IRouter } from "express";
import { db, booksTable, authorPersonasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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
  { name: "Mother's Day (US)",       date: "2026-05-10", recipient: "Mom",     niches: ["mothers-day", "grandma", "anxiety-mindfulness"] },
  { name: "Graduation season",       date: "2026-05-25", recipient: "Graduate",niches: ["graduation", "teachers"] },
  { name: "Father's Day (US)",       date: "2026-06-21", recipient: "Dad",     niches: ["fathers-day", "grandpa", "retirement"] },
  { name: "Summer travel",           date: "2026-07-15", niches: ["travel", "seniors"] },
  { name: "Back to school",          date: "2026-08-20", niches: ["teachers", "kids"] },
  { name: "Halloween",               date: "2026-10-31", niches: ["halloween", "true-crime"] },
  { name: "Thanksgiving (US)",       date: "2026-11-26", niches: ["seniors", "bible"] },
  { name: "Christmas",               date: "2026-12-25", recipient: "Gift",    niches: ["christmas", "grandma", "grandpa"] },
  { name: "New Year brain training", date: "2027-01-01", niches: ["dementia-prevention", "brain-workout-daily", "anxiety-mindfulness"] },
  { name: "Valentine's Day",         date: "2027-02-14", recipient: "Partner", niches: ["valentines"] },
  { name: "Mother's Day (2027)",     date: "2027-05-09", recipient: "Mom",     niches: ["mothers-day", "grandma"] },
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

function safeString(raw: unknown, fallback = ""): string {
  return typeof raw === "string" ? raw.trim() : fallback;
}

function safeBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.toLowerCase() === "true" || raw === "1";
  return fallback;
}

function yearPrefix(today: Date): string {
  return today.getMonth() >= 9 ? String(today.getFullYear() + 1) : String(today.getFullYear());
}

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  throw new Error("Could not parse JSON from model response");
}

// ── Lenient coercion: map any LLM response shape into a valid Opportunity ─

function coerceOpportunity(raw: unknown, today: Date): Opportunity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Niche must resolve to a known key. Accept raw key, label, or fuzzy match.
  const nicheInput = safeString(r.niche || r.nicheKey || r.nicheLabel);
  if (!nicheInput) return null;
  const nicheData = findNiche(nicheInput);
  if (!nicheData) return null;

  const titlePreview = safeString(r.titlePreview || r.title, `${yearPrefix(today)} ${nicheData.label}`);
  const subtitle = safeString(r.subtitle, nicheData.keywords[0] || "Large print puzzles for relaxation");
  const whySells = safeString(r.whySells || r.rationale, `Proven ${nicheData.label} segment.`);
  const puzzleType = safeString(r.puzzleType, nicheData.puzzleType);
  const audience = safeString(r.audience, nicheData.label);
  const experienceMode = normalizeExperience(r.experienceMode);
  const theme = normalizeTheme(r.theme);
  const coverStyle = normalizeStyle(r.coverStyle);
  const difficulty = safeString(r.difficulty, nicheData.recommendedDifficulty || "Medium");
  const puzzleCount = Math.round(safeNumber(r.puzzleCount, nicheData.recommendedCount || 100, 20, 500));
  const largePrint = safeBool(r.largePrint, true);
  const heatLevel = normalizeHeat(r.heatLevel);
  const seasonalWindow = safeString(r.seasonalWindow).length > 0 ? safeString(r.seasonalWindow) : null;
  const estimatedPrice = safeNumber(r.estimatedPrice, largePrint ? 9.99 : 7.99, 2, 99);
  const prefilledBrief = safeString(r.prefilledBrief,
    `${puzzleCount} ${difficulty} ${puzzleType} puzzles for ${nicheData.label}${largePrint ? ", large print edition" : ""}.`);
  const giftSku = safeBool(r.giftSku, false);
  const giftRecipient = giftSku ? (safeString(r.giftRecipient) || null) : null;

  return {
    niche: nicheData.key,
    nicheLabel: nicheData.label,
    puzzleType,
    titlePreview,
    subtitle,
    audience,
    experienceMode,
    theme,
    coverStyle,
    difficulty,
    puzzleCount,
    largePrint,
    whySells,
    heatLevel,
    seasonalWindow,
    estimatedPrice,
    estimatedRoyalty: estimateRoyalty(estimatedPrice, largePrint, puzzleCount),
    prefilledBrief,
    giftSku,
    giftRecipient,
  };
}

function findNiche(input: string): NicheData | null {
  const tok = input.toLowerCase().trim();
  const byKey = NICHES.find(n => n.key.toLowerCase() === tok);
  if (byKey) return byKey;
  const byLabel = NICHES.find(n => n.label.toLowerCase() === tok);
  if (byLabel) return byLabel;
  const byContains = NICHES.find(n =>
    n.key.toLowerCase().includes(tok) ||
    n.label.toLowerCase().includes(tok) ||
    tok.includes(n.key.toLowerCase()),
  );
  return byContains ?? null;
}

// ── Deterministic seed fallback ─────────────────────────────────────────────

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
  const largePrint = nicheData.key === "seniors"
    || nicheData.label.toLowerCase().includes("large print")
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
      : ["anxiety-mindfulness", "bible"].includes(nicheData.key) ? "mindful"
      : isGift ? "cozycottage"
      : "standard";
  const seasonalWindow = window && window.daysUntil >= 0
    ? `${window.name} — ${window.daysUntil} days`
    : null;
  const whySells = window
    ? `${nicheData.label} published into the ${window.name} window — buyer intent is high with deadline pressure.`
    : `${nicheData.label} is a proven evergreen with documented bestsellers.`;
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

  for (const w of windows.slice(0, 4)) {
    for (const nicheKey of (w.niches ?? [])) {
      if (used.has(nicheKey)) continue;
      const nd = NICHES.find(n => n.key === nicheKey);
      if (!nd) continue;
      seeds.push(buildSeedFromNiche(nd, ctx, w));
      used.add(nicheKey);
      if (seeds.length >= 4) break;
    }
    if (seeds.length >= 4) break;
  }

  for (const primaryRaw of ctx.primaryNiches) {
    if (seeds.length >= 6) break;
    const match = findNiche(primaryRaw);
    if (match && !used.has(match.key)) {
      seeds.push(buildSeedFromNiche(match, ctx));
      used.add(match.key);
    }
  }

  const EVERGREEN_ORDER = [
    "dementia-prevention", "brain-workout-daily", "true-crime", "seniors",
    "anxiety-mindfulness", "foodie", "bible", "nurses", "teachers",
    "gardening", "travel", "cryptogram-adults",
  ];
  for (const key of EVERGREEN_ORDER) {
    if (seeds.length >= 8) break;
    if (used.has(key)) continue;
    const nd = NICHES.find(n => n.key === key);
    if (!nd) continue;
    seeds.push(buildSeedFromNiche(nd, ctx));
    used.add(key);
  }

  for (const nd of NICHES) {
    if (seeds.length >= 8) break;
    if (used.has(nd.key)) continue;
    seeds.push(buildSeedFromNiche(nd, ctx));
    used.add(nd.key);
  }

  return seeds.slice(0, 8);
}

// ── Claude: primary research pass ───────────────────────────────────────────

async function researchWithClaude(ctx: SeedContext): Promise<{ opportunities: Opportunity[]; researchNote: string | null }> {
  const windowContext = upcomingWindows(ctx.today)
    .map(w => {
      const note = w.daysUntil < 0
        ? `passed ${Math.abs(w.daysUntil)}d ago`
        : w.daysUntil === 0 ? "TODAY"
        : w.daysUntil < 14 ? `in ${w.daysUntil}d — URGENT`
        : w.daysUntil < 45 ? `in ${w.daysUntil}d — publish now`
        : `in ${w.daysUntil}d — plan ahead`;
      return `- ${w.name} on ${w.date} (${note})${w.recipient ? ` — recipient: ${w.recipient}` : ""}`;
    }).join("\n");

  const nicheList = NICHES.map(n => `  ${n.key} — ${n.label} (${n.puzzleType}, ${n.recommendedDifficulty})`).join("\n");

  const prompt = `You are a senior Amazon KDP market researcher. Today is ${ctx.today.toISOString().slice(0, 10)}.
Produce 8 specific shippable book opportunities the publisher should write RIGHT NOW.

Active author persona niches: ${ctx.primaryNiches.length ? ctx.primaryNiches.join(", ") : "(general publisher)"}
Already-published niches (avoid repeating unless Vol 2+): ${Array.from(ctx.usedNiches).join(", ") || "(greenfield)"}
Already-used theme+style+niche combos (avoid exact repeats): ${Array.from(ctx.usedCombos).slice(0, 25).join("; ") || "(none)"}

Seasonal windows:
${windowContext}

Use EXACT niche keys from this list:
${nicheList}

Valid puzzleType: Word Search | Sudoku | Maze | Number Search | Cryptogram | Crossword
Valid experienceMode: standard | sketch | detective | adventure | darkacademia | cozycottage | mindful
Valid theme: midnight | forest | crimson | ocean | violet | slate | sunrise | teal | parchment | sky
Valid coverStyle: classic | geometric | luxury | bold | minimal | retro | warmth | photo

Rules:
- AT LEAST 3 opportunities must be hot (tied to a gift window in the next 60 days) if any window is in range.
- AT LEAST 2 opportunities must be stable (evergreen).
- Year-brand titles when the niche supports it ("${yearPrefix(ctx.today)} ...").
- For gift niches (Mom / Dad / Grandma / Teacher / Nurse), set giftSku: true and giftRecipient.
- Every titlePreview must be Amazon-ready: primary keyword in first 5 words, large-print tag when applicable.
- whySells must be one concrete data-grounded sentence, not generic.
- prefilledBrief: 1-2 sentences that will POST to create-book as the brief.

Return STRICT JSON ONLY:
{
  "researchNote": "1-2 sentences on the single most important publishing window right now",
  "opportunities": [
    {
      "niche": "exact-key-from-list",
      "nicheLabel": "...",
      "puzzleType": "...",
      "titlePreview": "...",
      "subtitle": "...",
      "audience": "...",
      "experienceMode": "...",
      "theme": "...",
      "coverStyle": "...",
      "difficulty": "Easy|Medium|Hard",
      "puzzleCount": 100,
      "largePrint": true,
      "whySells": "...",
      "heatLevel": "hot|rising|stable",
      "seasonalWindow": "e.g. Mother's Day — 18 days" or null,
      "estimatedPrice": 9.99,
      "prefilledBrief": "...",
      "giftSku": true|false,
      "giftRecipient": "Mom|Dad|null"
    }
  ]
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const raw = parseModelJson(text) as { researchNote?: unknown; opportunities?: unknown };

  const opportunities: Opportunity[] = [];
  if (Array.isArray(raw.opportunities)) {
    for (const item of raw.opportunities) {
      const opp = coerceOpportunity(item, ctx.today);
      if (opp) opportunities.push(opp);
      if (opportunities.length >= 8) break;
    }
  }

  return {
    opportunities,
    researchNote: typeof raw.researchNote === "string" ? raw.researchNote : null,
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
      .select({ niche: booksTable.niche, theme: booksTable.theme, coverStyle: booksTable.coverStyle })
      .from(booksTable)
      .orderBy(desc(booksTable.id))
      .limit(60);

    const usedCombos = new Set(existing.map(b => `${b.theme}+${b.coverStyle}+${b.niche ?? "general"}`));
    const usedNiches = new Set(existing.map(b => b.niche).filter((n): n is string => Boolean(n)));
    const primaryNiches = (persona?.primaryNiches as string[] | null) ?? [];
    const ctx: SeedContext = { today, primaryNiches, usedNiches, usedCombos };

    // Primary path: Claude research
    let opportunities: Opportunity[] = [];
    let researchNote: string | null = null;
    let source: "claude" | "deterministic-fallback" = "claude";

    try {
      const claudeResult = await researchWithClaude(ctx);
      opportunities = claudeResult.opportunities;
      researchNote = claudeResult.researchNote;
      req.log.info({ count: opportunities.length }, "Claude opportunity research done");
    } catch (err) {
      req.log.error({ err: (err as Error).message }, "Claude research failed — falling back to deterministic seeds");
      source = "deterministic-fallback";
    }

    // Backfill from seeds if Claude returned fewer than 8 (or failed entirely)
    if (opportunities.length < 8) {
      const seeds = buildSeedOpportunities(ctx);
      const have = new Set(opportunities.map(o => o.niche));
      for (const s of seeds) {
        if (opportunities.length >= 8) break;
        if (have.has(s.niche)) continue;
        opportunities.push(s);
        have.add(s.niche);
      }
    }

    const payload = {
      opportunities: opportunities.slice(0, 8),
      researchNote,
      generatedAt: today.toISOString(),
      personaId: persona?.id ?? null,
      personaName: persona?.penName ?? null,
      source,
    };
    if (source === "claude") {
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

// ── Diagnostic endpoint ─────────────────────────────────────────────────────

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

/**
 * GET /api/opportunities
 *
 * Returns a ranked list of shippable book opportunities tailored to the
 * currently-active author persona. Each opportunity includes the pre-filled
 * brief that can be POSTed directly to /api/agents/create-book for one-click
 * generation.
 *
 * Research is Claude Sonnet 4.5 grounded in: persona niches, already-used
 * theme+style+niche combos, seasonal context, and the 37-entry niches
 * database. Response is cached in-memory per (persona, YYYY-MM-DD) for 6 hours.
 */

import { Router, type IRouter } from "express";
import { db, booksTable, authorPersonasTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { z } from "zod";
import { NICHES } from "../lib/niches";

const router: IRouter = Router();

const OpportunitySchema = z.object({
  niche: z.string(),
  nicheLabel: z.string(),
  puzzleType: z.string(),
  titlePreview: z.string(),
  subtitle: z.string(),
  audience: z.string(),
  experienceMode: z.string(),
  theme: z.string(),
  coverStyle: z.string(),
  difficulty: z.string().default("Medium"),
  puzzleCount: z.number().int().min(50).max(400).default(100),
  largePrint: z.boolean().default(true),
  whySells: z.string(),
  heatLevel: z.enum(["hot", "rising", "stable"]),
  seasonalWindow: z.string().optional().nullable(),
  estimatedPrice: z.number().min(2).max(99),
  estimatedRoyalty: z.number().optional().default(0),
  prefilledBrief: z.string(),
  giftSku: z.boolean().default(false),
  giftRecipient: z.string().optional().nullable(),
});

const ResponseSchema = z.object({
  opportunities: z.array(OpportunitySchema).min(3).max(12),
  researchNote: z.string().optional(),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;

// ── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, { payload: unknown; at: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

// ── Seasonal context — known gift/holiday windows for 2026-2027 ─────────────
interface GiftWindow { name: string; date: string; daysBefore: number }
const WINDOWS_2026: GiftWindow[] = [
  { name: "Mother's Day (US)",      date: "2026-05-10", daysBefore: 28 },
  { name: "Graduation season peak", date: "2026-05-25", daysBefore: 45 },
  { name: "Father's Day (US)",      date: "2026-06-21", daysBefore: 28 },
  { name: "Summer travel peak",     date: "2026-07-15", daysBefore: 40 },
  { name: "Back to school",         date: "2026-08-20", daysBefore: 35 },
  { name: "Halloween",              date: "2026-10-31", daysBefore: 35 },
  { name: "Thanksgiving (US)",      date: "2026-11-26", daysBefore: 28 },
  { name: "Christmas",              date: "2026-12-25", daysBefore: 60 },
];
const WINDOWS_2027: GiftWindow[] = [
  { name: "New Year / resolution brain training", date: "2027-01-01", daysBefore: 21 },
  { name: "Valentine's Day",                      date: "2027-02-14", daysBefore: 21 },
  { name: "Mother's Day (US)",                    date: "2027-05-09", daysBefore: 28 },
];

function buildSeasonalContext(today: Date): string {
  const now = today.getTime();
  const windows = [...WINDOWS_2026, ...WINDOWS_2027];
  const upcoming = windows
    .map(w => {
      const target = new Date(w.date).getTime();
      const daysUntil = Math.round((target - now) / (24 * 60 * 60 * 1000));
      return { ...w, daysUntil };
    })
    .filter(w => w.daysUntil >= -7 && w.daysUntil <= 120)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcoming.length === 0) return "(no major gift windows in the next 120 days)";
  return upcoming
    .map(w => {
      const note = w.daysUntil < 0
        ? `passed ${Math.abs(w.daysUntil)} days ago — skip`
        : w.daysUntil === 0
          ? `TODAY — publishing window closed`
          : w.daysUntil < 14
            ? `in ${w.daysUntil} days — URGENT, KDP indexing takes 3-5 days`
            : w.daysUntil < 45
              ? `in ${w.daysUntil} days — publish now to catch peak`
              : `in ${w.daysUntil} days — plan ahead, prep cover`;
      return `- ${w.name} on ${w.date} (${note})`;
    })
    .join("\n");
}

function estimateRoyalty(price: number, largePrint: boolean, puzzleCount: number): number {
  const totalPages = 3 + puzzleCount + Math.ceil(puzzleCount / 6) + 4;
  const fixed = largePrint ? 1.0 : 0.85;
  const perPage = largePrint ? 0.015 : 0.012;
  const print = fixed + totalPages * perPage;
  return Number((price * 0.6 - print).toFixed(2));
}

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────

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

    // Gather already-published context
    const existing = await db
      .select({
        niche: booksTable.niche,
        theme: booksTable.theme,
        coverStyle: booksTable.coverStyle,
      })
      .from(booksTable)
      .orderBy(desc(booksTable.id))
      .limit(60);

    const usedCombos = [...new Set(existing.map(b => `${b.theme}+${b.coverStyle}+${b.niche ?? "general"}`))];
    const usedNiches = [...new Set(existing.map(b => b.niche).filter((n): n is string => Boolean(n)))];

    const primaryNiches = (persona?.primaryNiches ?? []) as string[];
    const audienceAge = persona?.audienceAge ?? "45-75";
    const availableNicheKeys = NICHES.map(n => `${n.key} (${n.label})`).join(", ");
    const seasonalContext = buildSeasonalContext(today);

    const prompt = `You are a senior Amazon KDP market researcher. Today is ${today.toISOString().slice(0, 10)}.
Your job: surface 8 specific, shippable book opportunities the active publisher should write RIGHT NOW.

Active author persona:
- Primary niches: ${primaryNiches.length ? primaryNiches.join(", ") : "(general puzzle publisher)"}
- Audience age: ${audienceAge}

Constraints:
- Already-published niches (AVOID repeating unless Volume 2+ makes sense): ${usedNiches.join(", ") || "(none — greenfield)"}
- Already-used theme+style+niche combos (AVOID exact repeats): ${usedCombos.slice(0, 25).join("; ") || "(none)"}
- Every "niche" value MUST be one of the exact keys below. NEVER invent new keys.

Available niche keys:
${availableNicheKeys}

Seasonal context:
${seasonalContext}

Valid puzzleType values: Word Search, Sudoku, Maze, Number Search, Cryptogram, Crossword
Valid experienceMode: standard, sketch, detective, adventure, darkacademia, cozycottage, mindful
Valid theme: midnight, forest, crimson, ocean, violet, slate, sunrise, teal, parchment, sky
Valid coverStyle: classic, geometric, luxury, bold, minimal, retro, warmth, photo

Produce 8 opportunities. At least 3 MUST be seasonally-urgent (hot heatLevel tied to a window in the next 60 days) if any gift window is in range. At least 2 MUST be evergreen (stable) to spread risk. Rest can be rising.

Every opportunity object MUST include ALL of these fields — omitting any field will cause a validation error:
- niche — exact key from the available niche keys list above (e.g. "seniors", "nature", "pets")
- nicheLabel — human label for that niche (e.g. "Seniors & Memory Care", "Nature Lovers")
- puzzleType — one of: Word Search, Sudoku, Maze, Number Search, Cryptogram, Crossword
- titlePreview — what the title would actually say (keyword-front-loaded, year-branded when sensible)
- subtitle — long-tail + benefit phrase
- audience — 1-sentence description of who buys this (age range, interests, buying intent)
- experienceMode — one of the valid experienceMode values above
- theme — one of the valid theme values above
- coverStyle — one of the valid coverStyle values above
- difficulty — Easy | Medium | Hard
- puzzleCount — integer between 50-400 (default 100 for most titles)
- largePrint — true or false (true for seniors/vision-impaired)
- whySells — one sentence, concrete, data-grounded reasoning
- heatLevel — "hot" | "rising" | "stable"
- seasonalWindow — e.g. "Mother's Day (May 10) — 21 days to peak" if applicable, else null
- estimatedPrice — realistic KDP price (number, e.g. 11.99)
- prefilledBrief — 1-2 sentences brief for the create-book pipeline
- giftSku — true when gift-focused positioning, else false
- giftRecipient — "Mom", "Dad", "Grandma", "Teacher" etc. when giftSku is true, else null

Return STRICT JSON ONLY (no markdown, no commentary):
{
  "opportunities": [ /* 8 entries, each with all 19 fields above */ ],
  "researchNote": "1-2 sentences on what matters most right now, the single most important window"
}`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const rawParsed = parseModelJson(text) as Record<string, unknown>;

    // Validate + deterministic royalty recomputation
    const result = ResponseSchema.parse(rawParsed);
    const opportunities = result.opportunities.map(o => ({
      ...o,
      estimatedRoyalty: estimateRoyalty(o.estimatedPrice, o.largePrint, o.puzzleCount),
    }));

    const payload = {
      opportunities,
      researchNote: result.researchNote ?? null,
      generatedAt: today.toISOString(),
      personaId: persona?.id ?? null,
      personaName: persona?.penName ?? null,
    };
    cache.set(cacheKey, { payload, at: Date.now() });

    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Failed to research opportunities");
    res.status(500).json({ error: (err as Error).message || "Failed to research opportunities" });
  }
});

// Force cache-miss on next call. Useful after publishing a book or changing persona.
router.post("/opportunities/refresh", async (req, res) => {
  cache.clear();
  res.json({ cleared: true });
});

export default router;

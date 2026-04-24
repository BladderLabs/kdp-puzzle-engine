/**
 * Listing Intelligence Agent.
 *
 * Produces every piece of the Amazon KDP product listing: title, subtitle, 7
 * backend keywords, 2 browse categories, Ogilvy-structured HTML description,
 * price recommendation with royalty math, hook sentence, URL slug, and a
 * 5-entry competitor brief.
 *
 * Two modes:
 *   1. Grounded  — uses real competitorData scraped from Amazon top-20
 *                  (when the scraper is available).
 *   2. Analytical — falls back to Claude's knowledge + niche reasoning when
 *                   scraper data isn't supplied.
 */

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ────────────────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────────────────

export const CompetitorSchema = z.object({
  title: z.string(),
  price: z.number().optional(),
  bsr: z.number().optional(),
  reviewCount: z.number().optional(),
  keywords: z.array(z.string()).optional(),
});
export type CompetitorData = z.infer<typeof CompetitorSchema>;

export const ListingInputSchema = z.object({
  niche: z.string().min(1),
  nicheLabel: z.string().optional(),
  puzzleType: z.string().min(1),
  puzzleCount: z.number().int().min(1).max(500).default(100),
  difficulty: z.string().default("Medium"),
  largePrint: z.boolean().default(true),
  audience: z.string().optional(),
  authorPenName: z.string().optional(),
  authorVoiceTone: z.string().optional(),
  authorVoiceVocabulary: z.string().optional(),
  experienceMode: z.string().default("standard"),
  year: z.number().int().min(2024).max(2030).default(new Date().getFullYear()),
  volumeNumber: z.number().int().min(0).max(10).default(0),
  giftSku: z.boolean().default(false),
  seriesName: z.string().optional(),
  competitors: z.array(CompetitorSchema).optional(),
  avgCompetitorPrice: z.number().optional(),
  medianCompetitorBsr: z.number().optional(),
  harvestedKeywords: z.array(z.string()).optional(),
});
export type ListingInput = z.infer<typeof ListingInputSchema>;

export const ListingCategorySchema = z.object({
  breadcrumb: z.string(),
  rationale: z.string(),
});

export const CompetitorBriefEntrySchema = z.object({
  title: z.string(),
  whyItRanks: z.string(),
});

export const ListingOutputSchema = z.object({
  title: z.string().min(5).max(200),
  subtitle: z.string().min(5).max(300),
  hookSentence: z.string().min(5).max(280),
  keywords: z.array(z.string()).length(7),
  categories: z.array(ListingCategorySchema).length(2),
  descriptionHtml: z.string().min(200),
  descriptionPlain: z.string().min(150),
  priceUsd: z.number().min(1.99).max(99),
  royaltyUsd: z.number(),
  priceRationale: z.string(),
  competitorBrief: z.array(CompetitorBriefEntrySchema).min(3).max(8),
  slug: z.string().min(3).max(80),
});
export type ListingOutput = z.infer<typeof ListingOutputSchema>;

// ────────────────────────────────────────────────────────────────────────────
// KDP royalty math — 60% of list price minus printing cost
// ────────────────────────────────────────────────────────────────────────────

function estimatePrintingCost(largePrint: boolean, paperPages: number): number {
  // KDP black-and-white printing: fixed $0.85 + $0.012/page (white) or $0.015/page (cream)
  // Large print uses 8.5"x11" which lands in the premium BW tier.
  const fixed = largePrint ? 1.0 : 0.85;
  const perPage = largePrint ? 0.015 : 0.012;
  return fixed + paperPages * perPage;
}

function calcRoyalty(priceUsd: number, largePrint: boolean, paperPages: number): number {
  const print = estimatePrintingCost(largePrint, paperPages);
  return Number((priceUsd * 0.6 - print).toFixed(2));
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ────────────────────────────────────────────────────────────────────────────

function buildCompetitorSection(input: ListingInput): string {
  if (input.competitors && input.competitors.length > 0) {
    const lines = input.competitors.slice(0, 10).map((c, i) => {
      const parts: string[] = [`${i + 1}. "${c.title}"`];
      if (c.price != null) parts.push(`$${c.price.toFixed(2)}`);
      if (c.bsr != null) parts.push(`BSR #${c.bsr.toLocaleString()}`);
      if (c.reviewCount != null) parts.push(`${c.reviewCount} reviews`);
      return parts.join(" · ");
    });
    return `Top ranking competitors (real Amazon data):\n${lines.join("\n")}`;
  }
  return `No scraped competitor data was supplied — draw on your knowledge of ranking patterns in the "${input.niche}" niche and current KDP bestseller conventions.`;
}

function buildKeywordSection(input: ListingInput): string {
  if (input.harvestedKeywords && input.harvestedKeywords.length > 0) {
    return `Harvested n-gram keywords from top-20 titles (pick the strongest 7, dedupe with title/subtitle):\n${input.harvestedKeywords.slice(0, 40).join(", ")}`;
  }
  return `No keyword harvest supplied — synthesise 7 slots using your knowledge of Amazon search for this niche.`;
}

function buildPriceSection(input: ListingInput): string {
  if (input.avgCompetitorPrice != null) {
    return `Average competitor price: $${input.avgCompetitorPrice.toFixed(2)}.
Our books price at a PREMIUM vs competitors because ours carry: (1) bespoke per-book palette,
(2) signature illustration style per Experience Mode, (3) Solve-the-Story narrative mechanic,
(4) author-voice listing copy — none of which a Canva-tier competitor can match.
Price $2–$3 ABOVE the competitor average unless the niche is intensely commoditised.
Large-print floor: $12.99. Standard floor: $9.99. Never undercut unless scraper data shows
our puzzle count is lower than top 3 competitors.`;
  }
  return `No price anchor supplied — use premium KDP puzzle-book pricing by format:
- Standard 6×9, 100 puzzles: $8.99–$11.99 (default $9.99)
- Large print 8.5×11, 100 puzzles: $11.99–$14.99 (DEFAULT $12.99 — this is a hard anchor)
- Themed / Solve-the-Story / niche-specialist SKUs: +$1 for the unique mechanic
- Gift-SKU (large print, themed): $13.99–$14.99
- Series volume 2+: match volume 1 pricing

PRICING STRATEGY: We do NOT compete on price. We compete on (1) bespoke per-book palette,
(2) signature illustration style per Experience Mode, (3) Solve-the-Story narrative mechanic,
(4) author-voice listing copy. Our books carry premium price because the product IS premium.
NEVER recommend below $12.99 for an LP SKU unless the top-3 competitors price below $10
AND the niche is intensely commoditised. A $3 uplift vs competitors is defensible when the
interior/cover/listing all telegraph superior craftsmanship.`;
}

function buildPrompt(input: ListingInput): string {
  const giftLine = input.giftSku
    ? "GIFT-SKU MODE: this listing must lead with gift framing. Include 'gift', 'present', or recipient language in title/subtitle/description."
    : "";
  const volumeLine = input.volumeNumber >= 1
    ? `This is Volume ${input.volumeNumber}${input.seriesName ? ` of the "${input.seriesName}" series` : ""} — reflect that in title and description.`
    : "";
  const lpTag = input.largePrint ? "Large Print edition (8.5×11). Mention 'Large Print' in the title." : "Standard 6×9 format.";

  return `You are a senior Amazon KDP listing strategist. Produce a complete, ranking-optimised product listing for this puzzle book.

Book specification:
- Niche: ${input.nicheLabel || input.niche} (${input.niche})
- Puzzle type: ${input.puzzleType}
- Puzzle count: ${input.puzzleCount}
- Difficulty: ${input.difficulty}
- Format: ${lpTag}
- Audience: ${input.audience || "(niche-default)"}
- Author pen name: ${input.authorPenName || "(not set)"}
- Author voice tone: ${input.authorVoiceTone || "(unset — use a warm, confident editorial voice)"}
- Author voice vocabulary: ${input.authorVoiceVocabulary || "(unset)"}
- Experience mode: ${input.experienceMode}
- Year: ${input.year}
${volumeLine}
${giftLine}

Competitor context:
${buildCompetitorSection(input)}

Keyword research:
${buildKeywordSection(input)}

Pricing anchor:
${buildPriceSection(input)}

Produce a listing with:
1. **title** — primary keyword in the first 5 words. Year-branded when it helps (e.g. "2026"). Large-print tag if applicable. HARD LIMITS: ≤12 words, prefer 6-9 words, ≤80 chars. Thumbnails become illegible beyond 12 words. Move detail into the subtitle if the title is getting long.
2. **subtitle** — long-tail keyword + benefit statement. One sentence. No repetition of the title.
3. **hookSentence** — one punchy opening line for the back cover (not the same as subtitle). Under 30 words.
4. **keywords** — EXACTLY 7 KDP backend keywords, ranked strongest first. Each under 50 chars. HARD RULE: every keyword must contain at least ONE token that does NOT appear in the title or subtitle — Amazon indexes title+subtitle+keywords as a union, so a keyword whose every word already appears in the title is wasted slot. Mix short-tail + long-tail. No single-word keywords.
5. **categories** — 2 Amazon browse categories as full breadcrumbs (e.g. "Books > Humor & Entertainment > Puzzles & Games > Crosswords"). Include a "whyItRanks" rationale for each.
6. **descriptionHtml** — Ogilvy-structured HTML, ready to paste into KDP:
   - <p><em>"One-line voice opener — a single italicized sentence in the author's own voice (matching the authorVoiceTone and authorVoiceVocabulary above) that captures what this author believes about this KIND of book. Not a product claim — a philosophy or a feeling. Under 22 words. This must feel written by a human, not an AI. Skip this line ONLY if authorVoiceTone is unset."</em></p>
   - <h2>BENEFIT HEADLINE</h2>
   - <p><b>Hook sentence</b></p>
   - <p>Opening paragraph (2-3 sentences, benefit-led)</p>
   - <h3>What's Inside:</h3>
   - <ul> with 5-7 <li> benefit bullets (each starts with ✓ or ★)
   - <h3>Perfect For:</h3>
   - <ul> with 3-4 audience lines
   - <p>Closing CTA paragraph (urgency + gift framing if applicable)</p>
   - Optionally <p><b>Also in the series: ...</b></p> when volumeNumber >= 2
7. **descriptionPlain** — the same message with tags stripped, for use in back-cover print copy.
8. **priceUsd** — $X.XX recommended list price.
9. **priceRationale** — one sentence on why this price.
10. **competitorBrief** — 3-6 entries of form { title, whyItRanks }. Use the real competitor data if supplied, otherwise describe canonical winners in this niche.
11. **slug** — URL-safe lowercase-dash slug derived from the title (no year, no stopwords).

Hard rules:
- NEVER invent fake awards, fake bestseller claims, or fake review counts.
- NEVER use "#1 bestseller" or "thousands of readers" or similar unverifiable claims.
- Do NOT promise physical features the engine can't produce (spiral binding, hardcover, foil stamping).
- Keep every claim falsifiable or factual.

Return ONLY strict JSON (no markdown, no commentary):
{
  "title": "...",
  "subtitle": "...",
  "hookSentence": "...",
  "keywords": ["k1","k2","k3","k4","k5","k6","k7"],
  "categories": [ {"breadcrumb": "...", "rationale": "..."}, {"breadcrumb": "...", "rationale": "..."} ],
  "descriptionHtml": "<h2>...</h2>...",
  "descriptionPlain": "...",
  "priceUsd": 12.99,
  "priceRationale": "...",
  "competitorBrief": [ {"title": "...", "whyItRanks": "..."} ],
  "slug": "..."
}`;
}

// ────────────────────────────────────────────────────────────────────────────
// JSON parser (matches pattern used elsewhere in this codebase)
// ────────────────────────────────────────────────────────────────────────────

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run the Listing Intelligence Agent. Uses Sonnet 4.5 for the bulk reasoning
 * (keywords, copy, categorisation) — the pricing math is deterministic TS.
 */
export async function runListingIntelligence(
  inputRaw: ListingInput,
): Promise<ListingOutput> {
  const input = ListingInputSchema.parse(inputRaw);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const raw = parseModelJson(text) as Record<string, unknown>;

  // ── Title: enforce ≤12 word hard limit (QA gate fails at 13+) ───────────
  const rawTitle = String(raw.title || "").trim();
  const titleWords = rawTitle.split(/\s+/).filter(Boolean);
  const title = titleWords.length > 12
    ? titleWords.slice(0, 12).join(" ")
    : rawTitle;
  const subtitle = String(raw.subtitle || "").trim();

  // ── Keywords: drop any whose tokens are all already in title+subtitle ────
  // Amazon indexes title+subtitle+keywords as a union, so a keyword whose every
  // word is in the title is a wasted slot. QA gate warns on this.
  const titleSubTokens = new Set(
    (title + " " + subtitle)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3),
  );
  const rawKws = Array.isArray(raw.keywords)
    ? (raw.keywords as unknown[]).map(String).map(s => s.trim()).filter(Boolean)
    : [];
  const fallbackPool = [
    `${input.puzzleType.toLowerCase()} ${input.nicheLabel || input.niche}`,
    `brain games activity book`,
    `${input.largePrint ? "large print " : ""}${input.puzzleType.toLowerCase()} for adults`,
    `${input.nicheLabel || input.niche} gift book`,
    `puzzle book ${new Date().getFullYear()}`,
    `${input.puzzleType.toLowerCase()} collection volume ${input.volumeNumber || 1}`,
    `solve the story ${input.puzzleType.toLowerCase()}`,
  ];
  const keywords: string[] = [];
  for (const kw of rawKws) {
    const tokens = kw.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    if (tokens.length === 0) continue;
    const novel = tokens.some(t => !titleSubTokens.has(t));
    if (novel && !keywords.includes(kw)) keywords.push(kw);
    if (keywords.length === 7) break;
  }
  for (const fb of fallbackPool) {
    if (keywords.length === 7) break;
    if (!keywords.includes(fb)) keywords.push(fb);
  }
  while (keywords.length < 7) keywords.push(`${input.puzzleType.toLowerCase()} book ${input.niche}`);
  keywords.length = 7;

  // Compute royalty deterministically from price — the model chooses price, we
  // compute the royalty (don't trust the model with money math).
  const totalPages = 3 + input.puzzleCount + Math.ceil(input.puzzleCount / 6) + 4;
  const priceUsd = Number(raw.priceUsd ?? (input.largePrint ? 12.99 : 9.99));
  const royaltyUsd = calcRoyalty(priceUsd, input.largePrint, totalPages);

  // Ensure categories has exactly 2 entries
  const rawCategories = Array.isArray(raw.categories) ? (raw.categories as Record<string, unknown>[]) : [];
  let categories: Array<{ breadcrumb: string; rationale: string }> = rawCategories
    .map(c => ({
      breadcrumb: String(c.breadcrumb || ""),
      rationale: String(c.rationale || ""),
    }))
    .filter(c => c.breadcrumb.length > 0)
    .slice(0, 2);
  while (categories.length < 2) {
    categories.push({
      breadcrumb: `Books > Humor & Entertainment > Puzzles & Games > ${input.puzzleType}`,
      rationale: `Primary browse bucket for ${input.puzzleType} puzzle books on Amazon.`,
    });
  }

  // Ensure competitor brief is at least 3 entries
  const competitorBrief = Array.isArray(raw.competitorBrief)
    ? (raw.competitorBrief as Record<string, unknown>[])
        .map(c => ({
          title: String(c.title || ""),
          whyItRanks: String(c.whyItRanks || ""),
        }))
        .filter(c => c.title.length > 0)
        .slice(0, 8)
    : [];
  while (competitorBrief.length < 3) {
    competitorBrief.push({
      title: `Top-ranking ${input.puzzleType} book for ${input.nicheLabel || input.niche}`,
      whyItRanks: "Keyword-front-loaded title, large-print format, 100+ puzzles, 4.5★ reviews.",
    });
  }

  // Slug — derive from title if missing
  const slug = typeof raw.slug === "string" && raw.slug.length > 2
    ? slugify(raw.slug)
    : slugify(String(raw.title || input.puzzleType));

  const output: ListingOutput = {
    title,
    subtitle,
    hookSentence: String(raw.hookSentence || "").trim(),
    keywords,
    categories,
    descriptionHtml: String(raw.descriptionHtml || "").trim(),
    descriptionPlain: String(raw.descriptionPlain || "").trim(),
    priceUsd,
    royaltyUsd,
    priceRationale: String(raw.priceRationale || "").trim(),
    competitorBrief,
    slug,
  };

  return ListingOutputSchema.parse(output);
}

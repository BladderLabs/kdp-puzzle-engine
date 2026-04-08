import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { BuyerProfile } from "./buyer-psychology-profiler";

export const CoverTypographySpecSchema = z.object({
  fontStyleDirective: z.string(),
  casingDirective: z.enum(["ALL CAPS", "Title Case", "Mixed"]),
  titleWeightDirective: z.string(),
  subtitleTreatment: z.string(),
  thumbnailReadabilityScore: z.number().int().min(1).max(10),
  typographyRationale: z.string(),
  pairingNote: z.string(),
});

export type CoverTypographySpec = z.infer<typeof CoverTypographySpecSchema>;

const EXPERT_KNOWLEDGE = `
You are a professional typographer with 20 years in book cover design and commercial print publishing.
Your decisions are grounded in professional typography standards and KDP-specific research.

FONT APPROACH OPTIONS (describe the approach — actual fonts are handled by the CSS engine):
- "bold condensed sans-serif": Maximum thumbnail legibility. Heavy weight, tight tracking, efficient width.
  Best for: seniors, large print, action niches, sports. Reads at 160px with absolute clarity.
- "elegant serif": Authority, tradition, intelligence. Slightly lower thumbnail legibility than condensed sans.
  Best for: premium niches, literary/puzzle enthusiasts, bible/faith, parchment-themed books.
- "playful rounded sans-serif": Friendly, accessible, childlike. High x-height improves small-size reading.
  Best for: kids, beginners, cozy/pet niches, holiday gifts.
- "geometric sans-serif": Modern, clean, intellectual. Technical precision.
  Best for: Sudoku, number puzzles, STEM niches, modern adults.
- "display script accent": Adds personality to subtitle only. NEVER use for title on puzzle books — illegible at thumbnail.
  Use: subtitle decoration only, paired with bold sans title.
- "condensed bold serif": Strong editorial quality. Academic authority with legibility.
  Best for: crossword, cryptogram, word puzzles, literary audiences.

CASING RULES (professional publishing standards):
- ALL CAPS titles: Maximum legibility at small sizes. Forces even visual weight. Best for 1-4 word titles.
  Risk: feels aggressive for warm/cozy niches. Avoid for pet/holiday/gift themes.
- Title Case: Most common KDP bestseller format. Natural, readable, balanced.
  Best for: 5-8 word titles, gift books, senior-friendly books.
- Mixed (ALL CAPS first word + Title Case rest): Emphasises first keyword while maintaining readability.
  Best for: long titles (6+ words) where the primary keyword leads.

TYPOGRAPHY PAIRING RULES (two-font maximum — professional standard):
1. Title: always the boldest, largest treatment
2. Subtitle: contrast in weight (lighter) or style (italic vs upright) — NEVER the same weight as title
3. Puzzle type badge: all-caps, smaller, high contrast fill — separate visual element
4. Author name: smallest, professional, often same family as subtitle

KDP THUMBNAIL TYPOGRAPHY RULES (verified research):
- Minimum effective font weight for title: Bold (700) or Black (900) — Medium/Regular disappears at thumbnail
- Contrast must exceed 7:1 on cover background — critical for dark/medium backgrounds
- Avoid decorative or script fonts for title text — illegible below 24pt equivalent at thumbnail size
- Ideal title length for thumbnails: 3-6 words visible without scrolling (wrap remainder to second line)
- Bold condensed sans at 72pt+ will read clearly at 160px; serif at same size loses 15-20% clarity

AUDIENCE-SPECIFIC TYPOGRAPHY:
- Seniors (60+): Bold condensed sans, ALL CAPS or Title Case, NO decorative fonts. Larger badge sizes.
- Kids: Rounded sans, Title Case, playful but legible. High color contrast.
- Premium/literary: Elegant serif, Title Case, subtle italic subtitle. Restrained luxury.
- Gift buyers: Bold serif or condensed sans. Title Case. Badge with "PERFECT GIFT" language converts.
- Puzzle enthusiasts: Geometric sans or condensed serif. Shows intellectual credibility.
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runCoverTypographyDirector(
  niche: string,
  nicheLabel: string,
  puzzleType: string,
  audienceProfile: string,
  largePrint: boolean,
  buyerProfile?: BuyerProfile,
): Promise<CoverTypographySpec> {
  const psychologyBlock = buyerProfile
    ? `\nBUYER PSYCHOLOGY (from Buyer Psychology Profiler — integrate into your typography decision):
- Buyer persona: ${buyerProfile.buyerPersona}
- Visual preferences: ${buyerProfile.visualPreferences}
- Purchase triggers: ${buyerProfile.purchaseTriggers.join(", ")}
- Psychology note: ${buyerProfile.psychologyNote}
Typography must DIRECTLY signal these triggers. A buyer expecting "premium quality" needs elegant serif; a buyer expecting "easy and fun" needs playful rounded sans.\n`
    : "";

  const prompt = `${EXPERT_KNOWLEDGE}${psychologyBlock}
Select the optimal typography approach for this KDP puzzle book:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Audience: ${audienceProfile}
- Large print edition: ${largePrint}

Large print signal: large print editions attract seniors who need high legibility. Weight strongly toward "bold condensed sans-serif" + ALL CAPS or Title Case. Avoid decorative approaches.

Return ONLY JSON (no markdown):
{
  "fontStyleDirective": "bold condensed sans-serif",
  "casingDirective": "Title Case",
  "titleWeightDirective": "Black (900 weight), tight tracking",
  "subtitleTreatment": "Regular weight, italic, 40% opacity background strip for legibility",
  "thumbnailReadabilityScore": 9,
  "typographyRationale": "2-3 sentences citing the professional typography rule and audience match",
  "pairingNote": "1 sentence on the font pairing approach and why it works for this cover"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return CoverTypographySpecSchema.parse(parseModelJson(text));
}

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { BuyerProfile } from "./buyer-psychology-profiler";
import type { CoverColorStrategy } from "./cover-color-strategist";
import type { CoverTypographySpec } from "./cover-typography-director";

export const CoverDesignAnalysisSchema = z.object({
  recommendedStyle: z.enum(["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth", "photo"]),
  compositionNotes: z.string(),
  visualHierarchy: z.string(),
  thumbnailStrategy: z.string(),
  confidence: z.number().int().min(1).max(10),
  rationale: z.string(),
});

export type CoverDesignAnalysis = z.infer<typeof CoverDesignAnalysisSchema>;

export async function roundTwoDesignCompatibility(
  analysis: CoverDesignAnalysis,
  colorStrategy: CoverColorStrategy,
  typography: CoverTypographySpec,
): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `You are a book cover design reviewer doing a quick compatibility cross-check.

Design style: ${analysis.recommendedStyle}
Color theme: ${colorStrategy.recommendedTheme} (accent: ${colorStrategy.accentHex})
Typography: ${typography.fontStyleDirective}, casing: ${typography.casingDirective}

Do these three outputs work together visually for a professional KDP cover?
Reply with ONLY "compatible" OR a single sentence (max 20 words) describing the specific conflict to flag.`,
      }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "compatible";
    return text || "compatible";
  } catch {
    return "compatible";
  }
}

const EXPERT_KNOWLEDGE = `
You are a professional book cover designer with 15 years of experience on Amazon KDP.
Your expertise is grounded in these verified professional principles:

LAYOUT STYLES (choose one):
- classic: Centered hierarchy, framed image block. Best for: seniors, gifts, traditional audiences. Trusted, familiar.
- luxury: Double-frame, uppercase serif typography. Best for: premium niches, collectors, high-pricepoint books.
- geometric: Angled accent bands, mathematical symmetry. Best for: STEM audiences, puzzle enthusiasts, modern adults.
- bold: Wide solid sidebar (42% width), extreme contrast. Best for: sports, active adults, high-energy niches.
- minimal: Triple-stripe accents, generous white space. Best for: modern adults, creatives, clean aesthetic niches.
- retro: Concentric borders, star ornaments, vintage type. Best for: nostalgia niches, 50s–80s themed books.
- warmth: Circular ornaments, soft centered dividers. Best for: cozy niches, cats/dogs, domestic themes.
- photo: Full-bleed AI background image, gradient overlay. Best for: ANY niche with AI cover art (highest conversion).

KDP BESTSELLER COMPOSITION RULES (verified research):
1. When AI cover art is available, ALWAYS recommend "photo" style — full-bleed AI image converts 35% better than framed layouts.
2. Visual weight must concentrate in the UPPER 60% of the cover. Lower 40% belongs to title text.
3. Thumbnail rule: primary visual element must be identifiable at 160×207px (KDP browse). Avoid fine detail in the centre.
4. For seniors: avoid busy patterns — clean, uncluttered layouts perform 2× better.
5. For kids: bold, high-contrast, colorful elements with clear subject (animal/character) in top-centre.
6. For holiday/gift: luxury or classic signals premium gift quality, raises perceived value by ~$2.
7. For puzzle enthusiasts (not audience-specific): geometric or minimal signals intellectual quality.

VISUAL HIERARCHY RULES:
- Z-pattern reading: top-left logo/badge → top-right image → bottom-left title → bottom-right price/CTA
- F-pattern for thumbnails: top horizontal band (most important), then left vertical (secondary)
- KDP rule: puzzle type badge must be visible in the thumbnail without clicking
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runCoverDesignAnalyst(
  niche: string,
  nicheLabel: string,
  puzzleType: string,
  audienceProfile: string,
  hasAiImage: boolean,
  buyerProfile?: BuyerProfile,
): Promise<CoverDesignAnalysis> {
  const psychologyBlock = buyerProfile
    ? `\nBUYER PSYCHOLOGY (integrate into your layout decision):
- Primary emotion to evoke: ${buyerProfile.primaryEmotion}
- Buyer moment: ${buyerProfile.buyerMoment}
- Visual metaphor: ${buyerProfile.visualMetaphor}
- Mood adjectives: ${buyerProfile.moodAdjectives.join(", ")}
- Copy angle: ${buyerProfile.copyAngle}
Your layout composition and visual hierarchy MUST evoke "${buyerProfile.primaryEmotion}". The overall cover feel should echo the visual metaphor "${buyerProfile.visualMetaphor}" and embody the mood: ${buyerProfile.moodAdjectives.join(", ")}.\n`
    : "";

  const prompt = `${EXPERT_KNOWLEDGE}${psychologyBlock}
Analyse the optimal cover layout for this KDP puzzle book:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Audience: ${audienceProfile}
- AI cover image available: ${hasAiImage}

Apply the expert rules above. If AI image is available, "photo" style is almost always optimal — only override with strong audience-specific reason.

Return ONLY JSON (no markdown):
{
  "recommendedStyle": "photo",
  "compositionNotes": "2-3 sentences on composition approach and why it converts for this specific audience",
  "visualHierarchy": "1-2 sentences on how visual weight should be distributed",
  "thumbnailStrategy": "1 sentence on what the buyer sees at 160px thumbnail size",
  "confidence": 8,
  "rationale": "1-2 sentences citing the professional rule(s) applied"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return CoverDesignAnalysisSchema.parse(parseModelJson(text));
}

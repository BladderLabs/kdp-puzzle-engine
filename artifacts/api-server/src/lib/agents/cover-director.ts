import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { CoverDesignAnalysis } from "./cover-design-analyst";
import type { CoverColorStrategy } from "./cover-color-strategist";
import type { CoverTypographySpec } from "./cover-typography-director";
import type { MarketScoutResult } from "./market-scout";
import type { ContentArchitectResult } from "./content-architect";
import type { BuyerProfile } from "./buyer-psychology-profiler";

export const CoverDesignSpecSchema = z.object({
  theme: z.string(),
  style: z.string(),
  accentHex: z.string(),
  backgroundHex: z.string(),
  fontStyleDirective: z.string(),
  casingDirective: z.string(),
  compositionNotes: z.string(),
  enrichedImagePrompt: z.string(),
  conflictsResolved: z.array(z.string()),
  rationale: z.string(),
});

export type CoverDesignSpec = z.infer<typeof CoverDesignSpecSchema>;

const STYLE_NAMES: Record<string, string> = {
  classic: "classic",
  geometric: "geometric",
  luxury: "luxury",
  bold: "bold",
  minimal: "minimal",
  retro: "retro",
  warmth: "warmth",
  photo: "photo",
};

const PRIORITY_RULES = `
CONFLICT RESOLUTION PRIORITY RULES (apply in order):
1. Thumbnail legibility always wins (thumbnailLegibilityScore and thumbnailReadabilityScore are paramount)
2. Audience alignment beats generic design convention (e.g. seniors → legibility over aesthetics)
3. Color Strategist's theme takes precedence unless Design Analyst's style is fundamentally incompatible
4. If style "photo" is recommended by Design Analyst, keep it — it outperforms all other styles with AI art
5. Typography Director's font directive must be compatible with the chosen theme's color palette
6. When in doubt, prioritise the option with highest combined legibility + emotional resonance
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runCoverDirector(
  market: MarketScoutResult,
  content: ContentArchitectResult,
  designAnalysis: CoverDesignAnalysis,
  colorStrategy: CoverColorStrategy,
  typographySpec: CoverTypographySpec,
  buyerProfile?: BuyerProfile,
): Promise<CoverDesignSpec> {

  const psychologyBlock = buyerProfile
    ? `\nBUYER PSYCHOLOGY PROFILE (from Buyer Psychology Profiler — use to maximise cover conversion):
- Buyer persona: ${buyerProfile.buyerPersona}
- Primary motivation: ${buyerProfile.primaryMotivation}
- Emotional hook: ${buyerProfile.emotionalHook}
- Purchase triggers: ${buyerProfile.purchaseTriggers.join(", ")}
- Visual preferences: ${buyerProfile.visualPreferences}
- Psychology note: ${buyerProfile.psychologyNote}
DIRECTIVE: Your enrichedImagePrompt MUST embed the emotional hook. The image must trigger "${buyerProfile.emotionalHook}" in the first 0.5 seconds of viewing. Every creative decision you make — colors, composition, subject — must serve this hook.\n`
    : "";

  const prompt = `You are the Cover Design Director for an Amazon KDP puzzle book publishing house.
Three specialist agents have submitted their recommendations. You must synthesise them into a final cover specification, resolve any conflicts, and produce an enriched image prompt for the AI image generator.

${PRIORITY_RULES}
${psychologyBlock}
BOOK DETAILS:
- Title: "${content.title}"
- Subtitle: "${content.subtitle}"
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle type: ${market.puzzleType}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}

DESIGN ANALYST RECOMMENDATION:
- Style: ${designAnalysis.recommendedStyle}
- Composition: ${designAnalysis.compositionNotes}
- Visual hierarchy: ${designAnalysis.visualHierarchy}
- Thumbnail strategy: ${designAnalysis.thumbnailStrategy}
- Confidence: ${designAnalysis.confidence}/10
- Rationale: ${designAnalysis.rationale}

COLOR STRATEGIST RECOMMENDATION:
- Theme: ${colorStrategy.recommendedTheme}
- Accent: ${colorStrategy.accentHex}
- Background: ${colorStrategy.backgroundHex}
- Thumbnail legibility: ${colorStrategy.thumbnailLegibilityScore}/10
- Emotional resonance: ${colorStrategy.emotionalResonance}
- Rationale: ${colorStrategy.colorRationale}

TYPOGRAPHY DIRECTOR RECOMMENDATION:
- Font style: ${typographySpec.fontStyleDirective}
- Casing: ${typographySpec.casingDirective}
- Title weight: ${typographySpec.titleWeightDirective}
- Subtitle treatment: ${typographySpec.subtitleTreatment}
- Readability score: ${typographySpec.thumbnailReadabilityScore}/10
- Rationale: ${typographySpec.typographyRationale}

Your tasks:
1. Accept or override each recommendation (cite priority rule if overriding)
2. Build the enrichedImagePrompt — a detailed paragraph for the Gemini AI image generator that describes the visual scene, mood, colors, and style. This replaces generic theme descriptions. Be highly specific: describe what the image should show (scene, objects, lighting, mood, color palette, composition), written as a professional AI art director's brief. Target 60-100 words. If a buyer psychology profile is provided, the scene must trigger the stated emotional hook.

The enrichedImagePrompt format: "A [scene/subject description], [lighting and atmosphere], [color palette notes], [mood/feeling], [composition notes — where subject sits, background treatment]. [Style note]. [What to exclude/avoid]."

Return ONLY JSON (no markdown):
{
  "theme": "${colorStrategy.recommendedTheme}",
  "style": "${designAnalysis.recommendedStyle}",
  "accentHex": "${colorStrategy.accentHex}",
  "backgroundHex": "${colorStrategy.backgroundHex}",
  "fontStyleDirective": "${typographySpec.fontStyleDirective}",
  "casingDirective": "${typographySpec.casingDirective}",
  "compositionNotes": "final composition guidance combining all three agents",
  "enrichedImagePrompt": "detailed 60-100 word Gemini image prompt here",
  "conflictsResolved": ["list any conflicts you resolved and how, or empty array"],
  "rationale": "2-3 sentences on why this combination of choices is optimal for this specific book and audience"
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const raw = parseModelJson(text) as Record<string, unknown>;

  // Validate style is a known name, fallback gracefully
  const style = typeof raw.style === "string" && STYLE_NAMES[raw.style]
    ? raw.style
    : designAnalysis.recommendedStyle;

  return CoverDesignSpecSchema.parse({ ...raw, style });
}

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { BuyerProfile } from "./buyer-psychology-profiler";
import type { CoverDesignAnalysis } from "./cover-design-analyst";
import type { CoverTypographySpec } from "./cover-typography-director";

export const CoverColorStrategySchema = z.object({
  recommendedTheme: z.enum(["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"]),
  accentHex: z.string(),
  backgroundHex: z.string(),
  textHex: z.string(),
  thumbnailLegibilityScore: z.number().int().min(1).max(10),
  emotionalResonance: z.string(),
  colorRationale: z.string(),
  thumbnailContrastNote: z.string(),
});

export type CoverColorStrategy = z.infer<typeof CoverColorStrategySchema>;

export async function roundTwoColorCompatibility(
  colorStrategy: CoverColorStrategy,
  designAnalysis: CoverDesignAnalysis,
  typography: CoverTypographySpec,
): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `You are a color strategist doing a quick cross-check for a KDP book cover council.

Color theme: ${colorStrategy.recommendedTheme} (legibility: ${colorStrategy.thumbnailLegibilityScore}/10, accent: ${colorStrategy.accentHex})
Design style: ${designAnalysis.recommendedStyle}
Typography: ${typography.fontStyleDirective} (readability: ${typography.thumbnailReadabilityScore}/10)

Do the color choices work with the design style and typography for a high-converting Amazon cover?
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
You are a professional color strategist and brand psychologist specialising in publishing and Amazon KDP.
Your expertise is grounded in color psychology research and KDP bestseller analysis.

THE 10 AVAILABLE THEMES (you must map to one of these):
- midnight: bg #0D1B3E, accent #F5C842, text #FFFFFF — Deep navy + gold. Trust, authority, premium, timeless.
- forest: bg #1A3C1A, accent #6DCC50, text #FFFFFF — Deep green + lime. Calm, nature, healing, vitality.
- crimson: bg #280808, accent #FF3838, text #FFFFFF — Deep red. Urgency, passion, holiday energy, drama.
- ocean: bg #C8E8F8, accent #1565A8, text #0A2040 — Sky blue + deep blue. Calm, clarity, peace, coastal.
- violet: bg #180635, accent #C060FF, text #FFFFFF — Deep purple + lavender. Creativity, luxury, mystery.
- slate: bg #252E3A, accent #FF8C38, text #FFFFFF — Charcoal + orange. Modern, bold, active, contemporary.
- sunrise: bg #FDF0E0, accent #D44000, text #3A1800 — Warm cream + burnt orange. Friendly, accessible, cheerful.
- teal: bg #062020, accent #18D0A0, text #FFFFFF — Dark teal + turquoise. Fresh, unique, modern, vibrant.
- parchment: bg #F5E4C0, accent #7B3A00, text #3A1800 — Aged paper + warm brown. Vintage, scholarly, nostalgic.
- sky: bg #E0EFFF, accent #2050B8, text #1A2A50 — Light blue + medium blue. Optimistic, light, simple, airy.

COLOR PSYCHOLOGY MAP (research-backed):
- SENIORS (60+): midnight (navy/gold) → trust, authority; parchment → warmth, nostalgia. AVOID bright/saturated.
- KIDS (under 12): sunrise (warm, friendly), sky (light, happy). Avoid dark themes.
- HOLIDAY/CHRISTMAS: crimson (festive energy, urgency). Non-negotiable for gift season.
- CATS/PETS/COZY: parchment (warmth, domesticity) or warmth variants. Avoid cold blues.
- NATURE/GARDEN/OUTDOORS: forest (calm, vitality). Strong emotional match.
- OCEAN/BEACH/TRAVEL: ocean (literal match, peaceful). High emotional resonance.
- MYSTERY/THRILLER/DETECTIVE: violet (intrigue, darkness). Strong genre signal.
- SPORTS/ACTIVE/FITNESS: slate (energy, boldness). Signals activity.
- PREMIUM/COLLECTOR: violet or midnight. Both signal luxury.
- MODERN ADULTS: teal, slate, geometric. Contemporary feel.
- BEGINNERS/ACCESSIBLE: sunrise or sky. Non-threatening, inviting.
- BIBLE/FAITH/SPIRITUAL: midnight (reverent) or parchment (scriptural).
- HALLOWEEN/GOTHIC: crimson or violet. Thematic match.
- COOKING/FOOD: sunrise (warmth, appetite stimulation) or parchment (recipe book feel).

KDP THUMBNAIL CONTRAST RULES:
- WCAG AA minimum: 4.5:1 contrast ratio between title text and background
- Dark backgrounds (midnight, forest, crimson, violet, teal) + white text: ~12:1 ratio (excellent)
- Light backgrounds (ocean, sunrise, parchment, sky) + dark text: ~8:1 ratio (good)
- NEVER use light text on light background or dark text on dark background
- At 160px thumbnail: the eye first sees color mass, then shape, then text
- Warm tones (crimson, sunrise) convert 15% higher in holiday categories
- Dark backgrounds with single accent color outperform multicolor schemes at thumbnail size
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runCoverColorStrategist(
  niche: string,
  nicheLabel: string,
  puzzleType: string,
  audienceProfile: string,
  largePrint: boolean,
  buyerProfile?: BuyerProfile,
): Promise<CoverColorStrategy> {
  const psychologyBlock = buyerProfile
    ? `\nBUYER PSYCHOLOGY (integrate into your color decision):
- Primary emotion to evoke: ${buyerProfile.primaryEmotion}
- Buyer moment: ${buyerProfile.buyerMoment}
- Visual metaphor: ${buyerProfile.visualMetaphor}
- Mood adjectives: ${buyerProfile.moodAdjectives.join(", ")}
Your palette MUST viscerally trigger "${buyerProfile.primaryEmotion}". Every hue, saturation, and contrast decision should reinforce the visual metaphor "${buyerProfile.visualMetaphor}" and feel ${buyerProfile.moodAdjectives.slice(0, 3).join(", ")}.\n`
    : "";

  const prompt = `${EXPERT_KNOWLEDGE}${psychologyBlock}
Select the optimal color strategy for this KDP puzzle book:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Audience: ${audienceProfile}
- Large print edition: ${largePrint}

Apply the color psychology map and thumbnail contrast rules. Large print editions typically signal seniors — weight toward midnight or parchment unless the niche overrides this.

CRITICAL: Generate a UNIQUE custom palette for THIS specific book — do NOT default to the preset theme's stock hex values. \`recommendedTheme\` is just the closest matching preset for categorization, but the three hex values you return MUST be bespoke colors chosen for this niche + buyer moment. A Mother's Day book and a Valentine's Day book may both map to "crimson" as closest-theme, but their palettes should differ visibly — every book in our library deserves its own colorway.

Rules for the bespoke palette:
- accentHex — the single most important decision; must pop at 160px thumbnail against the background
- backgroundHex — the base color of the cover; should feel niche-appropriate
- textHex — ensures WCAG contrast ≥ 4.5 against backgroundHex
- Avoid re-using common preset values like #F5C842 / #0D1B3E verbatim unless they're genuinely the best choice. Nudge hues 5-15 degrees, shift saturation, find a signature tone.

Return ONLY JSON (no markdown):
{
  "recommendedTheme": "closest preset label from the enum",
  "accentHex": "#B8860B",
  "backgroundHex": "#1C2940",
  "textHex": "#FFF8E8",
  "thumbnailLegibilityScore": 9,
  "emotionalResonance": "1 sentence on what emotion this palette triggers for the target buyer",
  "colorRationale": "2-3 sentences citing the specific color psychology principle and audience match — mention WHY these exact hexes, not the preset",
  "thumbnailContrastNote": "1 sentence on how this reads at 160px KDP thumbnail size"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return CoverColorStrategySchema.parse(parseModelJson(text));
}

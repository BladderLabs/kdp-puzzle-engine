import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { listNiches } from "../niches";

const NICHE_LIST = listNiches().map(n => `${n.key} (${n.label}, ${n.puzzleType})`).join(", ");
const NICHE_KEYS = new Set(listNiches().map(n => n.key));

const KDP_EXPERT_CONTEXT = `You are an expert Amazon KDP puzzle book market analyst with deep knowledge of what sells.
Built-in niches: ${NICHE_LIST}.
Puzzle types: Word Search, Sudoku, Maze, Number Search, Cryptogram, Crossword
Cover styles: classic, geometric, luxury, bold, minimal, retro, warmth
Themes: midnight, forest, crimson, ocean, violet, slate, sunrise, teal, parchment, sky
KDP pricing: $5.99–$9.99 (large print commands $1–2 premium)
Typical puzzle counts: 50–100 for most books`;

export const MarketScoutResultSchema = z.object({
  niche: z.string(),
  nicheLabel: z.string(),
  puzzleType: z.string(),
  difficulty: z.string(),
  puzzleCount: z.number().int().positive(),
  largePrint: z.boolean(),
  theme: z.string(),
  coverStyle: z.string(),
  pricePoint: z.number().positive(),
  keywords: z.array(z.string()).length(7),
  audienceProfile: z.string(),
  whySells: z.string(),
  recommendedTheme: z.string().optional(),
});

/**
 * Deterministic niche → theme mapping.
 * Maps audience profile keywords to the conversion-optimized color story.
 * Checked in priority order; falls back to "midnight" (proven bestseller default).
 */
const NICHE_THEME_MAP: [RegExp, string][] = [
  [/christmas|holiday|winter|festive|xmas/i, "crimson"],
  [/cat|pet|animal|cozy|dog|bird/i, "parchment"],
  [/ocean|beach|coastal|nautical|sea|marine/i, "ocean"],
  [/nature|garden|flower|plant|forest|outdoor/i, "forest"],
  [/kid|child|youth|beginner|fun|junior/i, "sunrise"],
  [/mystery|detective|crime|thriller|spy/i, "violet"],
  [/teal|aqua/i, "teal"],
  [/sky|cloud|aerial/i, "sky"],
  [/senior|elder|retire|grandpar|classic|gift|adult/i, "midnight"],
];

export type MarketScoutResult = z.infer<typeof MarketScoutResultSchema>;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export interface MarketEvidenceItem {
  title: string;
  bsr?: number | null;
  reviews?: number;
  price?: number | null;
  demand_score?: number;
  competition_level?: string;
}

export async function runMarketScout(
  brief?: string,
  evidence?: MarketEvidenceItem[],
  usedCombos?: string[],
): Promise<MarketScoutResult> {
  const briefClause = brief ? `\nUser's book idea: "${brief}"` : "\nChoose the single best market opportunity based on current KDP trends.";
  const evidenceClause = evidence && evidence.length > 0
    ? `\nLive Amazon market evidence (top ${evidence.length} competing titles):\n` +
      evidence.map((e, i) =>
        `${i + 1}. "${e.title.slice(0, 80)}"` +
        (e.bsr ? ` | BSR #${e.bsr.toLocaleString()}` : "") +
        (e.reviews != null ? ` | ${e.reviews} reviews` : "") +
        (e.price != null ? ` | $${e.price}` : "") +
        (e.demand_score != null ? ` | demand ${e.demand_score}/10` : "") +
        (e.competition_level ? ` | ${e.competition_level} competition` : "")
      ).join("\n") +
      "\nUse this data to calibrate your niche/type selection — target niches with demand ≥ 6 and avoid oversaturated categories."
    : "";
  const combosClause = usedCombos && usedCombos.length > 0
    ? `\nCOVER COMBOS ALREADY IN USE (theme+coverStyle+niche) — you MUST pick a DIFFERENT combination:\n${usedCombos.map(c => `  - ${c}`).join("\n")}\nSelect a theme+coverStyle+niche combination not in this list to ensure visual differentiation across the library.`
    : "";

  const prompt = `${KDP_EXPERT_CONTEXT}${briefClause}${evidenceClause}${combosClause}

Analyze the Amazon KDP puzzle book market and identify the single best book opportunity to publish right now.

Return ONLY a JSON object (no markdown, no explanation):
{
  "niche": "seniors",
  "nicheLabel": "Seniors & Large Print",
  "puzzleType": "Word Search",
  "difficulty": "Easy",
  "puzzleCount": 100,
  "largePrint": true,
  "theme": "midnight",
  "coverStyle": "classic",
  "pricePoint": 8.99,
  "keywords": ["senior word search","large print word search","easy word search adults","brain games seniors","word puzzle book","activity book seniors","large print puzzle"],
  "audienceProfile": "One sentence describing the ideal buyer",
  "whySells": "One sentence explaining the market opportunity and demand drivers"
}

niche must be one of the exact keys from the niche list.
puzzleType must be one of: Word Search, Sudoku, Maze, Number Search, Cryptogram, Crossword
theme must be one of: midnight, forest, crimson, ocean, violet, slate, sunrise, teal, parchment, sky
keywords array must have exactly 7 strings, ordered from highest to lowest search volume.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const raw = parseModelJson(text);
  const result = MarketScoutResultSchema.parse(raw);

  if (!NICHE_KEYS.has(result.niche)) {
    const fallback = listNiches()[0];
    result.niche = fallback.key;
    result.nicheLabel = fallback.label;
  }

  // Compute conversion-optimized theme from niche + audience — deterministic, overrides LLM choice
  const nicheAudienceText = `${result.niche} ${result.nicheLabel} ${result.audienceProfile}`;
  result.recommendedTheme = "midnight"; // proven bestseller default
  for (const [pattern, theme] of NICHE_THEME_MAP) {
    if (pattern.test(nicheAudienceText)) {
      result.recommendedTheme = theme;
      break;
    }
  }

  // ── Explicit post-parse uniqueness validator (3-field: theme+coverStyle+niche) ─
  if (usedCombos && usedCombos.length > 0) {
    const ALL_THEMES = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
    const ALL_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth"];
    const currentCombo = `${result.theme}+${result.coverStyle}+${result.niche}`;
    if (usedCombos.includes(currentCombo)) {
      // Validation failure detected — find first unused theme+style pair for this niche
      let resolved = false;
      for (const theme of ALL_THEMES) {
        for (const style of ALL_STYLES) {
          const candidate = `${theme}+${style}+${result.niche}`;
          if (!usedCombos.includes(candidate)) {
            console.warn(`[MarketScout] Combo uniqueness violation: "${currentCombo}" already used. Correcting to "${candidate}".`);
            result.theme = theme;
            result.coverStyle = style;
            if (result.recommendedTheme) result.recommendedTheme = theme;
            resolved = true;
            break;
          }
        }
        if (resolved) break;
      }
    }
  }

  return result;
}

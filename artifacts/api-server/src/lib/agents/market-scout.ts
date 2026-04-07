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
});

export type MarketScoutResult = z.infer<typeof MarketScoutResultSchema>;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runMarketScout(brief?: string): Promise<MarketScoutResult> {
  const briefClause = brief ? `\nUser's book idea: "${brief}"` : "\nChoose the single best market opportunity based on current KDP trends.";

  const prompt = `${KDP_EXPERT_CONTEXT}${briefClause}

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

  return result;
}

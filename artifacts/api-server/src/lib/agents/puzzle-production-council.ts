import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";

export const PuzzleSpecSchema = z.object({
  recommendedPuzzleCount: z.number().int().positive(),
  gridWidth: z.number().int().positive(),
  gridHeight: z.number().int().positive(),
  itemsPerPage: z.number().int().positive(),
  wordCountPerPuzzle: z.number().int().positive().optional(),
  difficultyDescriptor: z.string(),
  difficultyParams: z.record(z.string(), z.union([z.string(), z.number()])),
  qualityNotes: z.string(),
  rationale: z.string(),
});

export type PuzzleSpec = z.infer<typeof PuzzleSpecSchema>;

const DIFFICULTY_EXPERT_KNOWLEDGE = `
You are a professional puzzle editor with 20 years at Games World of Puzzles magazine and AARP puzzle book series.

WORD SEARCH STANDARDS (verified professional standards):
- Easy: 12-15 words per grid, 15×15 grid, L-R and T-B directions only, 25-35% fill density
- Medium: 18-22 words per grid, 15×15 grid, all 8 directions, 40-50% fill density
- Hard: 25-30 words per grid, 15×15 grid, all 8 directions including backward, 50-65% fill density
- Large Print Easy: 13×13 grid (fewer cells = more legible), 10-12 words
- Large Print Medium: 13×13 grid, 14-18 words
- Large Print Hard: 15×15 grid at large print size, 18-22 words

SUDOKU STANDARDS (verified):
- Easy: 36-46 given cells (of 81 total), single solving technique sufficient
- Medium: 27-35 given cells, 2-3 techniques required (naked pairs, hidden singles)
- Hard: 22-26 given cells, advanced techniques (X-wings, swordfish)
- Expert: 17-21 given cells (17 is theoretical minimum for unique solution)

MAZE STANDARDS (verified):
- Easy: 12×12 grid, few dead ends, no loops, solution path obvious
- Medium: 15×15 grid, multiple dead ends, some backtracking required
- Hard: 20×20 grid, complex branching, many dead ends, non-obvious solution

NUMBER SEARCH STANDARDS:
- Same grid principles as Word Search but with number sequences instead of words
- Easy: 3-4 digit sequences, 12-15 sequences per grid
- Medium: 4-5 digit sequences, 18-22 sequences per grid
- Hard: 5-6 digit sequences, 25+ sequences per grid

CRYPTOGRAM STANDARDS:
- Easy: short sentences (8-12 words), common vocabulary, few double letters
- Medium: 15-20 word sentences, moderate vocabulary
- Hard: complex sentence structure, archaic vocabulary, multiple possible substitutions

CROSSWORD STANDARDS (KDP format):
- Easy: 80-100 word puzzle, common vocabulary, generous grid
- Medium: 100-140 word puzzle, varied vocabulary
- Hard: 130-180 word puzzle, themed clues, wordplay
`;

const LAYOUT_EXPERT_KNOWLEDGE = `
You are a professional book interior designer specialising in KDP puzzle books.

PAGES PER PUZZLE (verified KDP interior research):
- Word Search, 6×9, standard print: 6 puzzles per page (1 puzzle per spread section)
  Actually: 1 puzzle per page + answer at end. So items per answer page = 6.
- Word Search, 8.5×11, large print: 4 puzzles per answer page (larger grids need more space)
- Sudoku, 6×9, standard: 8 puzzles per answer page (compact 9×9 grids)
- Sudoku, 8.5×11, large print: 6 puzzles per answer page
- Maze, 6×9, standard: 6 puzzles per answer page
- Maze, 8.5×11, large print: 4 puzzles per answer page
- Number Search: same as Word Search
- Cryptogram: 8 puzzles per answer page (text-based, compact)
- Crossword: 4-6 puzzles per answer page (grids are larger)

WHITESPACE RULES:
- Minimum 0.375" between puzzle grid edge and page margin
- Minimum 0.25" between puzzle elements (clue list and grid)
- Large print: minimum 0.5" all internal whitespace
- Answer key: 2-column layout for word search, 3-column for Sudoku, 2-column for maze/crossword

PUZZLE COUNT SWEET SPOTS:
- 50 puzzles: thin book, price point $5.99-$6.99, feels lightweight
- 100 puzzles: KDP bestseller sweet spot, price $7.99-$8.99, best value perception
- 150 puzzles: premium volume, $9.99-$10.99, ideal for serious puzzle enthusiasts
- 200+ puzzles: mega volume, $10.99-$14.99, gift edition
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

async function runDifficultyCalibrator(market: MarketScoutResult): Promise<{
  difficultyDescriptor: string;
  difficultyParams: Record<string, string | number>;
  rationale: string;
}> {
  const prompt = `${DIFFICULTY_EXPERT_KNOWLEDGE}

Calibrate difficulty parameters for:
- Puzzle type: ${market.puzzleType}
- Difficulty: ${market.difficulty}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}

Apply the professional standards above. For seniors, shift toward the easier end of each difficulty tier (e.g. Medium → 18-20 words instead of 22). For kids, similarly. For puzzle enthusiasts, apply the harder end.

Return ONLY JSON:
{
  "difficultyDescriptor": "precise descriptor, e.g. 'Medium — 18 words per grid, all 8 directions'",
  "difficultyParams": {
    "wordsPerPuzzle": 18,
    "gridDirections": "all 8 directions",
    "fillDensity": "40-45%"
  },
  "rationale": "2 sentences on why these parameters match the difficulty and audience"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return parseModelJson(text) as { difficultyDescriptor: string; difficultyParams: Record<string, string | number>; rationale: string };
}

async function runPuzzleLayoutEngineer(market: MarketScoutResult): Promise<{
  gridWidth: number;
  gridHeight: number;
  itemsPerPage: number;
  recommendedPuzzleCount: number;
  qualityNotes: string;
}> {
  const prompt = `${LAYOUT_EXPERT_KNOWLEDGE}

Specify layout parameters for:
- Puzzle type: ${market.puzzleType}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}
- Requested puzzle count: ${market.puzzleCount || 100}

Apply the professional layout rules. The requested puzzle count is a starting point — adjust only if it's outside the sweet spots (keep within ±20 of requested).

Return ONLY JSON:
{
  "gridWidth": 15,
  "gridHeight": 15,
  "itemsPerPage": 6,
  "recommendedPuzzleCount": 100,
  "qualityNotes": "2-3 sentences on layout decisions and how they optimise the reader experience"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return parseModelJson(text) as {
    gridWidth: number;
    gridHeight: number;
    itemsPerPage: number;
    recommendedPuzzleCount: number;
    qualityNotes: string;
  };
}

export async function runPuzzleProductionCouncil(market: MarketScoutResult): Promise<PuzzleSpec> {
  const [difficulty, layout] = await Promise.all([
    runDifficultyCalibrator(market),
    runPuzzleLayoutEngineer(market),
  ]);

  return PuzzleSpecSchema.parse({
    recommendedPuzzleCount: layout.recommendedPuzzleCount,
    gridWidth: layout.gridWidth,
    gridHeight: layout.gridHeight,
    itemsPerPage: layout.itemsPerPage,
    wordCountPerPuzzle: typeof difficulty.difficultyParams.wordsPerPuzzle === "number"
      ? difficulty.difficultyParams.wordsPerPuzzle
      : undefined,
    difficultyDescriptor: difficulty.difficultyDescriptor,
    difficultyParams: difficulty.difficultyParams,
    qualityNotes: layout.qualityNotes,
    rationale: `Difficulty: ${difficulty.rationale} Layout: ${layout.qualityNotes}`,
  });
}

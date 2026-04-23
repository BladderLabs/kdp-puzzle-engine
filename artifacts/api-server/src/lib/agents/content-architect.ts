import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";

export const ContentArchitectResultSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  hookSentence: z.string().optional(),
  backDescription: z.string(),
  wordCategory: z.string(),
  words: z.array(z.string()),
  volumeNumber: z.number().int().positive(),
});

export type ContentArchitectResult = z.infer<typeof ContentArchitectResultSchema>;

const WORD_CATEGORIES = [
  "General", "Animals", "Nature", "Holiday", "Food", "Sports",
  "Travel", "Science", "History", "Geography", "Music", "Art",
];

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export interface SeriesContext {
  seriesName: string;
  nextVolumeNumber: number;
  authorPenName?: string | null;
  previousVolumes: Array<{
    volumeNumber: number;
    title: string;
    subtitle?: string | null;
    backDescription?: string | null;
    words: string[];
  }>;
}

export async function runContentArchitect(
  market: MarketScoutResult,
  brief?: string,
  qaFeedback?: string[],
  seriesContext?: SeriesContext,
): Promise<ContentArchitectResult> {
  const briefSection = brief ? `\nUser's original idea: "${brief}"` : "";
  const revisionSection = qaFeedback && qaFeedback.length > 0
    ? `\n\nREVISION REQUIRED — You previously produced content that failed QA. Fix ALL of these issues:\n${qaFeedback.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}`
    : "";

  // ── Series continuity: when this is Vol 2+, tell the architect everything
  // about earlier volumes so it can dedupe words, escalate theme, and keep
  // the brand voice consistent across the series.
  const seriesSection = seriesContext && seriesContext.previousVolumes.length > 0
    ? (() => {
        const usedWords = [
          ...new Set(seriesContext.previousVolumes.flatMap(v => v.words.map(w => w.toUpperCase()))),
        ].slice(0, 150);
        const volumes = seriesContext.previousVolumes
          .map(v => `  - Vol ${v.volumeNumber}: "${v.title}"${v.subtitle ? ` — ${v.subtitle}` : ""}`)
          .join("\n");
        const authorLine = seriesContext.authorPenName
          ? `\n- Author pen name carried across the series: ${seriesContext.authorPenName} (use EXACTLY this name).`
          : "";
        return `

── SERIES CONTEXT — this is Vol ${seriesContext.nextVolumeNumber} of "${seriesContext.seriesName}" ──
Previously published volumes:
${volumes}${authorLine}

SERIES RULES for Vol ${seriesContext.nextVolumeNumber}:
- Title must reference the series ("Vol ${seriesContext.nextVolumeNumber}", "Book ${seriesContext.nextVolumeNumber}", or a clear continuation like "The Next Chapter").
- Back description MUST open with a nod to earlier volumes ("Back by popular demand…", "The continuing favourite…", "Volume ${seriesContext.nextVolumeNumber} of the series readers love…").
- Do NOT reuse words already featured in prior volumes. Pick fresh words from the same thematic universe. Already-used words (do NOT reuse any of these):
  ${usedWords.join(", ")}
- Difficulty stays within 1 step of Vol 1's level. Don't jump Easy→Hard.
- Your word list should have <25% overlap with the combined list above.`;
      })()
    : "";

  const prompt = `You are an expert Amazon KDP puzzle book content writer.${briefSection}

Market intelligence for this book:
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle type: ${market.puzzleType}
- Difficulty: ${market.difficulty}
- Large print: ${market.largePrint}
- Puzzle count: ${market.puzzleCount} — THIS IS THE EXACT NUMBER. Use it verbatim in the title and description. Do not invent a different number.
- Target price: $${market.pricePoint}
- Audience: ${market.audienceProfile}
- Keywords: ${market.keywords.join(", ")}
- Why it sells: ${market.whySells}${revisionSection}${seriesSection}

Create publication-ready content for this KDP puzzle book.

Rules:
- Title: must be 6+ words, keyword-rich, appealing to the niche. Include the puzzle count (${market.puzzleCount}) in the title.
- Subtitle: punchy benefit statement, 8–15 words
- Author: use a realistic pen name suitable for the niche
- Hook sentence: 10–15 words, audience-specific, benefit-led opening line for the back cover. Example: "The perfect brain-training gift for the cat lover in your life!" Do NOT end with a period. Must feel personal and warm to the exact audience.
- Back description: 100–150 words, compelling sales copy using emotional triggers and benefits. MUST mention the exact puzzle count (${market.puzzleCount} puzzles) at least once. Do NOT repeat the hook sentence here.
- Word category: must be one of: ${WORD_CATEGORIES.join(", ")}
- Words: 30–50 thematically relevant words for the puzzle type and niche (only for Word Search/Cryptogram)
- Volume: 1

Return ONLY a JSON object (no markdown, no explanation):
{
  "title": "Large Print Word Search for Seniors: ${market.puzzleCount} Stimulating Puzzles for Sharp Minds",
  "subtitle": "Big Letters, Easy to Read — Perfect for Brain Training and Daily Relaxation",
  "author": "Eleanor Bennett",
  "hookSentence": "The perfect brain-training gift for every puzzle-loving senior in your life",
  "backDescription": "A full 100-150 word compelling back cover description here...",
  "wordCategory": "General",
  "words": ["PUZZLE","BRAIN","SOLVE","SEARCH","LETTER","ANSWER","WORDS","FIND","GRID","CLUE","HIDDEN","LEVEL","GAME","MATCH","PLAY"],
  "volumeNumber": 1
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const raw = parseModelJson(text);
  return ContentArchitectResultSchema.parse(raw);
}

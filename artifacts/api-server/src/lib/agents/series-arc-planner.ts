import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { BookSpec } from "./master-book-director";
import type { MarketScoutResult } from "./market-scout";

export const VolumeProposalSchema = z.object({
  volumeNumber: z.number().int().min(2).max(5),
  title: z.string(),
  subtitle: z.string(),
  angle: z.string(),
  wordCategory: z.string(),
  difficulty: z.string(),
  largePrint: z.boolean(),
  theme: z.enum(["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"]),
  keyDifferentiator: z.string(),
  suggestedSeriesName: z.string(),
});

export const SeriesArcSchema = z.object({
  seriesName: z.string(),
  seriesTheme: z.string(),
  volumes: z.array(VolumeProposalSchema),
  seriesRationale: z.string(),
});

export type VolumeProposal = z.infer<typeof VolumeProposalSchema>;
export type SeriesArc = z.infer<typeof SeriesArcSchema>;

const SERIES_EXPERT_KNOWLEDGE = `
You are a KDP series publishing strategist with expertise in building profitable book series.

KDP SERIES STRATEGY (research-backed):
- A 3-volume series earns 3× the royalties of a single book if Volume 1 establishes the brand
- Volume 1 should be the most accessible (easiest difficulty or most universal theme) to attract readers
- Volume 2 introduces a progression (harder, different category, new angle) to reward returning readers  
- Volume 3 completes the arc with a premium feel (most distinctive theme, best content curation)
- Series naming: the series name appears on every cover — it must be short (2-4 words), memorable, and keyword-rich
- Successful KDP series patterns: "Brain Boost Series", "Puzzle Paradise Vol. X", "[Niche] Collection"

SERIES DIFFERENTIATION STRATEGIES:
1. Difficulty progression: Easy → Medium → Hard (gives readers a reason to buy all 3)
2. Theme variation: Nature themes Vol.1 → Holiday Vol.2 → Animals Vol.3 (covers look unique side-by-side)
3. Category rotation: General words → Animals → Food (content feels fresh each volume)
4. Audience expansion: Seniors → Mixed ages → Gift edition (captures adjacent buyers)
5. Format variation: Standard → Large Print → Mega edition (hits different price points)

NAMING CONVENTION RULES:
- Volume subtitle should differ from Volume 1 to signal new content ("More Brain-Boosting Puzzles" not "Brain-Boosting Puzzles Again")
- Author name must stay identical across all volumes (builds author brand)
- Back cover copy should reference the series (social proof: "Volume 1 loved by thousands of readers!")
- Do NOT use "Volume 2 of Volume 1's title" — give each volume its own standalone title

WORD CATEGORIES (available): General, Animals, Nature, Holiday, Food, Sports, Travel, Science, History, Geography, Music, Art
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runSeriesArcPlanner(
  market: MarketScoutResult,
  bookSpec: BookSpec | null,
  volume1Title: string,
  volume1Theme: string,
  volume1WordCategory: string,
): Promise<SeriesArc | null> {
  const prompt = `${SERIES_EXPERT_KNOWLEDGE}

A publisher just created Volume 1 of a puzzle book series. Plan the next 2 volumes to complete a 3-volume series arc.

VOLUME 1 DETAILS:
- Title: "${volume1Title}"
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle type: ${market.puzzleType}
- Difficulty: ${bookSpec?.difficultyDescriptor ?? market.difficulty}
- Large print: ${market.largePrint}
- Theme: ${volume1Theme}
- Word category: ${volume1WordCategory}
- Audience: ${market.audienceProfile}

Apply the series strategy rules. Each volume must:
1. Have a distinct subtitle angle (not a repeat of Vol.1)
2. Use a DIFFERENT theme colour to distinguish covers visually on Amazon
3. Use a DIFFERENT word category for fresh content
4. Progress naturally in difficulty or theme

Return ONLY JSON (no markdown):
{
  "seriesName": "2-4 word series name that is keyword-rich and memorable",
  "seriesTheme": "1 sentence on the series arc and how the 3 volumes complement each other",
  "volumes": [
    {
      "volumeNumber": 2,
      "title": "Large Print Word Search for Seniors Vol. 2: 100 Relaxing Puzzles with a Nature Theme",
      "subtitle": "Fresh Brain-Training Puzzles for a Sharp and Active Mind",
      "angle": "1-2 sentences on what is new/different about this volume",
      "wordCategory": "Nature",
      "difficulty": "Easy",
      "largePrint": true,
      "theme": "forest",
      "keyDifferentiator": "1 sentence on the unique selling point vs Volume 1",
      "suggestedSeriesName": "same as above seriesName field"
    },
    {
      "volumeNumber": 3,
      "title": "Large Print Word Search for Seniors Vol. 3: 100 Holiday Puzzles for the Season",
      "subtitle": "Festive Brain-Training Puzzles — The Perfect Gift for Puzzle Lovers",
      "angle": "1-2 sentences on what is new/different about this volume",
      "wordCategory": "Holiday",
      "difficulty": "Easy",
      "largePrint": true,
      "theme": "crimson",
      "keyDifferentiator": "1 sentence on the unique selling point vs Volume 1 and 2",
      "suggestedSeriesName": "same as above seriesName field"
    }
  ],
  "seriesRationale": "2-3 sentences on why this 3-volume arc will maximise series royalties and reader retention"
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    return SeriesArcSchema.parse(parseModelJson(text));
  } catch {
    return null;
  }
}

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";
import type { ContentSpec } from "./content-excellence-council";
import type { CoverDesignSpec } from "./cover-director";
import type { PuzzleSpec } from "./puzzle-production-council";
import type { LayoutSpec } from "./interior-design-council";
import type { ProductionSpec } from "./production-pricing-council";

export const BookSpecSchema = z.object({
  // Final content decisions
  title: z.string(),
  subtitle: z.string(),
  backDescription: z.string(),
  hookSentence: z.string(),
  keywords: z.array(z.string()),

  // Final cover decisions
  coverTheme: z.string(),
  coverStyle: z.string(),
  coverAccentHex: z.string(),
  coverImagePrompt: z.string(),
  coverRationale: z.string(),

  // Final puzzle decisions
  puzzleCount: z.number().int(),
  itemsPerPage: z.number().int(),
  difficultyDescriptor: z.string(),
  puzzleQualityNotes: z.string(),

  // Final production decisions
  paperType: z.string(),
  recommendedPrice: z.number(),
  royaltyEstimate: z.number(),
  pricingNotes: z.string(),

  // Intelligence report
  conflictsResolved: z.array(z.string()),
  councilSummary: z.string(),
  overallRationale: z.string(),
});

export type BookSpec = z.infer<typeof BookSpecSchema>;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runMasterBookDirector(
  market: MarketScoutResult,
  content: ContentSpec,
  cover: CoverDesignSpec,
  puzzle: PuzzleSpec,
  layout: LayoutSpec,
  production: ProductionSpec,
): Promise<BookSpec> {

  const prompt = `You are the Master Book Director for a professional Amazon KDP publishing house.
Five specialist councils have submitted their recommendations for this puzzle book. Your job is to:
1. Identify any cross-council conflicts and resolve them using the priority rules
2. Confirm or adjust final decisions where councils may be working at cross-purposes
3. Produce the definitive BookSpec document

PRIORITY RULES FOR CONFLICT RESOLUTION:
1. KDP compliance takes absolute precedence over all aesthetic and commercial decisions
2. Audience accessibility (legibility, readability) beats aesthetic or commercial preferences
3. Commercial viability (pricing, market positioning) is the third priority
4. Aesthetic/brand consistency resolves last

BOOK: "${content.title}"
NICHE: ${market.nicheLabel} | PUZZLE: ${market.puzzleType} | AUDIENCE: ${market.audienceProfile}

────────────────────────────────────────────────
CONTENT EXCELLENCE COUNCIL:
- Title: "${content.title}"
- Subtitle: "${content.subtitle}"
- Keywords: ${content.keywords.join(", ")}
- Changes applied: ${content.changesApplied.join("; ")}

COVER DESIGN COUNCIL:
- Theme: ${cover.theme} | Style: ${cover.style}
- Accent: ${cover.accentHex}
- Conflicts resolved: ${cover.conflictsResolved.join("; ") || "none"}
- Rationale: ${cover.rationale}

PUZZLE PRODUCTION COUNCIL:
- Puzzle count: ${puzzle.recommendedPuzzleCount}
- Difficulty: ${puzzle.difficultyDescriptor}
- Items/page: ${puzzle.itemsPerPage}
- Quality notes: ${puzzle.qualityNotes}

INTERIOR DESIGN COUNCIL:
- Body font: ${layout.bodyFontSizePt}pt, leading ×${layout.leadingMultiplier}
- Margins: inner ${layout.innerMarginIn}" outer ${layout.outerMarginIn}"
- Typography: ${layout.typographyNotes}
- Layout: ${layout.layoutNotes}

PRODUCTION & PRICING COUNCIL:
- Paper: ${production.paperType}
- Price: $${production.recommendedPrice} | Royalty: $${production.royaltyEstimate.toFixed(2)}
- Format: ${production.formatNotes}
- Pricing: ${production.pricingNotes}
────────────────────────────────────────────────

Identify any cross-council conflicts (e.g. if puzzle council wants large grids but layout council's margins are tight, or if pricing council's page count doesn't match puzzle council's puzzle count). Resolve each conflict explicitly.

Then produce the final BookSpec.

Return ONLY JSON (no markdown):
{
  "title": "final title from Content Council",
  "subtitle": "final subtitle",
  "backDescription": "final back description",
  "hookSentence": "final hook sentence",
  "keywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7"],
  "coverTheme": "final theme name",
  "coverStyle": "final style name",
  "coverAccentHex": "#RRGGBB",
  "coverImagePrompt": "full enriched Gemini image prompt from Cover Council",
  "coverRationale": "1-2 sentences",
  "puzzleCount": 100,
  "itemsPerPage": 6,
  "difficultyDescriptor": "precise difficulty description",
  "puzzleQualityNotes": "quality guidance for puzzle generation",
  "paperType": "white",
  "recommendedPrice": 8.99,
  "royaltyEstimate": 3.42,
  "pricingNotes": "pricing summary",
  "conflictsResolved": ["conflict 1 and resolution", "conflict 2 and resolution"],
  "councilSummary": "2-3 sentence summary of what all 5 councils collectively decided and why",
  "overallRationale": "2-3 sentences on why this book specification will perform well on Amazon KDP"
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return BookSpecSchema.parse(parseModelJson(text));
}

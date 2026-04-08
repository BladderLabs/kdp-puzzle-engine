import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";

export const LayoutSpecSchema = z.object({
  bodyFontSizePt: z.number(),
  headerFontSizePt: z.number(),
  pageNumberFontSizePt: z.number(),
  fontFamilyApproach: z.string(),
  leadingMultiplier: z.number(),
  innerMarginIn: z.number(),
  outerMarginIn: z.number(),
  topMarginIn: z.number(),
  bottomMarginIn: z.number(),
  gutterIn: z.number(),
  internalPuzzleSpacingPt: z.number(),
  answerKeyColumns: z.number().int(),
  typographyNotes: z.string(),
  layoutNotes: z.string(),
  rationale: z.string(),
});

export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;

const TYPOGRAPHY_EXPERT_KNOWLEDGE = `
You are a professional book typographer trained under the Chicago Manual of Style and the Society of Book Designers.

INTERIOR TYPOGRAPHY STANDARDS (verified professional publishing):
- Body text, standard print: 10-11pt, leading 1.3× (so 11pt body → 14.3pt leading)
- Body text, large print: 14-16pt minimum (RNIB/vision impairment accessibility standard), leading 1.4×
- Clue lists (puzzle books): same as body text
- Chapter/section headings: 18-24pt, same weight family, bold
- Page numbers: 9-10pt, regular weight, centered in footer
- Running headers: 8-9pt, all-caps or small-caps, centered

FONT FAMILY RULES BY PUZZLE NICHE:
- Word Search, Crossword, Cryptogram: serif body text conveys intelligence and legibility (Palatino, Georgia equivalent)
- Sudoku, Number Search: geometric sans-serif for grids (must be monospaced or tabular figures), serif for clues
- Maze: font choice matters less — focus on grid legibility
- All large print: prefer humanist sans-serif (maximum legibility at large sizes, e.g. Gill Sans, Helvetica equivalent)
- All puzzle grids: MUST use a monospaced or condensed font — proportional fonts cause uneven grid alignment

OPTICAL SIZING RULES:
- At 10pt: use Regular weight (optically lighter), avoid Thin/Light
- At 14pt+: Regular weight is sufficient; Bold only for headers
- At 8pt (page numbers): Regular, never Bold — Bold at small sizes is visually muddy
- Tracking (letter spacing): slightly positive (+5-10 units) for body text improves readability
- Do not kern individual characters — let the typesetting engine handle it
`;

const LAYOUT_EXPERT_KNOWLEDGE = `
You are a certified KDP interior book designer with the Independent Book Publishers Association.

KDP MARGIN REQUIREMENTS (official KDP table):
- 24-150 pages: minimum 0.375" all sides, BUT 0.5" inner gutter minimum for binding
- 151-300 pages: minimum 0.375" all, 0.75" inner gutter
- 301-500 pages: minimum 0.375" all, 0.875" inner gutter
- 500+ pages: minimum 0.375" all, 1.0" inner gutter

SAFE ZONE RULE: Add 0.125" to all minimums for professional safety margin. Presses can shift slightly.

PUZZLE BOOK SPECIFIC LAYOUT:
- Grid-to-margin clearance: minimum 0.375" from grid edge to nearest margin
- Internal spacing between grid and word list: minimum 12pt
- Answer key layout: 2-column for word search/crossword, 3-column for Sudoku (compact grids)
- Section divider pages: centered text only, generous top margin (2")

TRIM SIZE DEFAULTS (from existing system):
- Standard: 6×9 inches (content area ~4.5×7.5 at minimal margins)
- Large print: 8.5×11 inches (content area ~7×9.5 at minimal margins)
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

async function runTypographyExpert(market: MarketScoutResult): Promise<{
  bodyFontSizePt: number;
  headerFontSizePt: number;
  pageNumberFontSizePt: number;
  fontFamilyApproach: string;
  leadingMultiplier: number;
  typographyNotes: string;
}> {
  const prompt = `${TYPOGRAPHY_EXPERT_KNOWLEDGE}

Specify typography for:
- Puzzle type: ${market.puzzleType}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}

Apply professional standards. Large print editions must meet RNIB accessibility (14pt minimum body).

Return ONLY JSON:
{
  "bodyFontSizePt": 11,
  "headerFontSizePt": 20,
  "pageNumberFontSizePt": 9,
  "fontFamilyApproach": "serif body text (Palatino equivalent), monospaced grid cells",
  "leadingMultiplier": 1.35,
  "typographyNotes": "2-3 sentences on font choices and their accessibility/legibility rationale"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return parseModelJson(text) as {
    bodyFontSizePt: number;
    headerFontSizePt: number;
    pageNumberFontSizePt: number;
    fontFamilyApproach: string;
    leadingMultiplier: number;
    typographyNotes: string;
  };
}

async function runPageLayoutArchitect(market: MarketScoutResult, estimatedPageCount: number): Promise<{
  innerMarginIn: number;
  outerMarginIn: number;
  topMarginIn: number;
  bottomMarginIn: number;
  gutterIn: number;
  internalPuzzleSpacingPt: number;
  answerKeyColumns: number;
  layoutNotes: string;
}> {
  const prompt = `${LAYOUT_EXPERT_KNOWLEDGE}

Specify interior layout measurements for:
- Puzzle type: ${market.puzzleType}
- Large print: ${market.largePrint}
- Estimated page count: ${estimatedPageCount}

Apply the KDP margin table with professional safety margins (+0.125"). Calculate gutter from the page count.

Return ONLY JSON:
{
  "innerMarginIn": 0.625,
  "outerMarginIn": 0.5,
  "topMarginIn": 0.5,
  "bottomMarginIn": 0.5,
  "gutterIn": 0.625,
  "internalPuzzleSpacingPt": 18,
  "answerKeyColumns": 2,
  "layoutNotes": "2-3 sentences on margin decisions and why they comply with KDP spec"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return parseModelJson(text) as {
    innerMarginIn: number;
    outerMarginIn: number;
    topMarginIn: number;
    bottomMarginIn: number;
    gutterIn: number;
    internalPuzzleSpacingPt: number;
    answerKeyColumns: number;
    layoutNotes: string;
  };
}

export async function runInteriorDesignCouncil(
  market: MarketScoutResult,
  estimatedPageCount: number = 120,
): Promise<LayoutSpec> {
  const [typo, layout] = await Promise.all([
    runTypographyExpert(market),
    runPageLayoutArchitect(market, estimatedPageCount),
  ]);

  return LayoutSpecSchema.parse({
    bodyFontSizePt: typo.bodyFontSizePt,
    headerFontSizePt: typo.headerFontSizePt,
    pageNumberFontSizePt: typo.pageNumberFontSizePt,
    fontFamilyApproach: typo.fontFamilyApproach,
    leadingMultiplier: typo.leadingMultiplier,
    innerMarginIn: layout.innerMarginIn,
    outerMarginIn: layout.outerMarginIn,
    topMarginIn: layout.topMarginIn,
    bottomMarginIn: layout.bottomMarginIn,
    gutterIn: layout.gutterIn,
    internalPuzzleSpacingPt: layout.internalPuzzleSpacingPt,
    answerKeyColumns: layout.answerKeyColumns,
    typographyNotes: typo.typographyNotes,
    layoutNotes: layout.layoutNotes,
    rationale: `Typography: ${typo.typographyNotes} Layout: ${layout.layoutNotes}`,
  });
}

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";

export const ProductionSpecSchema = z.object({
  paperType: z.enum(["white", "cream"]),
  trimWidth: z.number(),
  trimHeight: z.number(),
  recommendedPrice: z.number(),
  priceRationale: z.string(),
  royaltyEstimate: z.number(),
  pageCountTarget: z.number().int(),
  formatNotes: z.string(),
  pricingNotes: z.string(),
  rationale: z.string(),
});

export type ProductionSpec = z.infer<typeof ProductionSpecSchema>;

const FORMAT_EXPERT_KNOWLEDGE = `
You are a KDP production specialist certified by the Independent Book Publishers Association.

TRIM SIZE SELECTION (KDP standards):
- 6×9 inches: Standard trade paperback. Most common KDP size. Good for word search, Sudoku, cryptogram, crossword.
- 8.5×11 inches: Large format. Required for large print editions (LP). More space for larger grids and text.
- 7×10 inches: Compromise. Used when LP is borderline or when puzzles need more space than 6×9 provides.
- 5×8 inches: Small format. Only for small-audience niches or ebooks-first products.

PAPER TYPE SELECTION (KDP options):
- White paper: Standard for puzzle books. Better contrast for grid lines and small text. Modern appearance.
  Best for: Sudoku, Number Search, Crossword (high contrast grids), modern/active audiences, kids.
- Cream paper: Softer, warmer tone. Reduces eye strain for extended reading. Slight vintage feel.
  Best for: seniors (less harsh than white), literary/word puzzle niches, cozy/pet themes, parchment-themed covers.
  Note: Cream paper adds ~$0.003 per page to printing cost (negligible).

KDP SAFE ZONE: Content must stay 0.375" from all edges. This is enforced on upload.

PAGE COUNT TARGETS (for pricing plausibility):
- Standard 100 puzzles, 6×9: ~108-130 pages (depends on front matter and answer key size)
- Standard 100 puzzles, 8.5×11: ~90-110 pages (larger page = fewer pages needed)
- Large print 100 puzzles, 8.5×11: ~105-125 pages (larger grids, more whitespace)
`;

const PRICING_EXPERT_KNOWLEDGE = `
You are a KDP pricing strategist who has analysed BSR (Best Seller Rank) data across 10,000+ puzzle books.

KDP PRICING SWEET SPOTS (verified BSR analysis):
- 50 puzzles, 6×9, standard: $5.99-$6.99 (value-budget segment)
- 100 puzzles, 6×9, standard: $7.99-$8.99 (mainstream bestseller range)
- 100 puzzles, 8.5×11, large print: $8.99-$9.99 (LP premium justified by accessibility)
- 150 puzzles: $9.99-$10.99 (premium volume)
- 200+ puzzles: $11.99-$14.99 (mega volume/gift edition)
- Holiday/gift editions: +$1.00 premium over base (occasion justifies price)
- Series Volume 1: -$1.00 introductory pricing (drives series adoption)
- Series Volume 2+: full price

KDP ROYALTY FORMULA (60% royalty plan):
- Printing cost = $0.85 + ($0.012 × page count) for B&W interior, white paper
- Royalty = 0.60 × (list price - printing cost)
- Minimum price = printing cost / 0.40 (KDP minimum viable price)
- Example: 120 pages → printing = $0.85 + $1.44 = $2.29 → royalty at $7.99 = 0.60 × (7.99 - 2.29) = $3.42

COMPETITIVE POSITIONING:
- If niche has many competitors with 4.5+ stars at $7.99: price at $7.49 (undercut by $0.50) for market entry
- If niche is low-competition (few books, poor reviews): price at full $8.99-$9.99 (capture premium)
- Always round to .99 (psychological pricing — $7.99 not $8.00)
`;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

async function runFormatStrategist(market: MarketScoutResult): Promise<{
  paperType: "white" | "cream";
  trimWidth: number;
  trimHeight: number;
  pageCountTarget: number;
  formatNotes: string;
}> {
  const prompt = `${FORMAT_EXPERT_KNOWLEDGE}

Select production format for:
- Puzzle type: ${market.puzzleType}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle count: ${market.puzzleCount || 100}

Apply the format rules. Large print must use 8.5×11. Consider paper type based on audience and theme.

Return ONLY JSON:
{
  "paperType": "white",
  "trimWidth": 8.5,
  "trimHeight": 11,
  "pageCountTarget": 115,
  "formatNotes": "2-3 sentences on format decisions and their rationale"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const result = parseModelJson(text) as {
    paperType: string;
    trimWidth: number;
    trimHeight: number;
    pageCountTarget: number;
    formatNotes: string;
  };
  return {
    ...result,
    paperType: result.paperType === "cream" ? "cream" : "white",
  };
}

async function runPricingExpert(market: MarketScoutResult, pageCountTarget: number): Promise<{
  recommendedPrice: number;
  royaltyEstimate: number;
  pricingNotes: string;
}> {
  const printingCost = 0.85 + (0.012 * pageCountTarget);

  const prompt = `${PRICING_EXPERT_KNOWLEDGE}

Calculate optimal pricing for:
- Puzzle type: ${market.puzzleType}
- Niche: ${market.nicheLabel} (${market.niche})
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}
- Puzzle count: ${market.puzzleCount || 100}
- Estimated page count: ${pageCountTarget}
- Estimated printing cost: $${printingCost.toFixed(2)}
- Current market price point reference: $${market.pricePoint}
- Market position: ${market.whySells}

Apply the BSR sweet spots and competitive positioning rules. Round to .99. Calculate actual royalty at your recommended price.

Return ONLY JSON:
{
  "recommendedPrice": 8.99,
  "royaltyEstimate": 3.42,
  "pricingNotes": "2-3 sentences on pricing strategy: which sweet spot, why, and competitive rationale"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return parseModelJson(text) as { recommendedPrice: number; royaltyEstimate: number; pricingNotes: string };
}

export async function runProductionPricingCouncil(market: MarketScoutResult): Promise<ProductionSpec> {
  const formatResult = await runFormatStrategist(market);
  const pricingResult = await runPricingExpert(market, formatResult.pageCountTarget);

  return ProductionSpecSchema.parse({
    paperType: formatResult.paperType,
    trimWidth: formatResult.trimWidth,
    trimHeight: formatResult.trimHeight,
    recommendedPrice: pricingResult.recommendedPrice,
    priceRationale: pricingResult.pricingNotes,
    royaltyEstimate: pricingResult.royaltyEstimate,
    pageCountTarget: formatResult.pageCountTarget,
    formatNotes: formatResult.formatNotes,
    pricingNotes: pricingResult.pricingNotes,
    rationale: `Format: ${formatResult.formatNotes} Pricing: ${pricingResult.pricingNotes}`,
  });
}

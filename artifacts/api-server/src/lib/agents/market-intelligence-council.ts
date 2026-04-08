import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { listNiches } from "../niches";
import { MarketScoutResultSchema, type MarketScoutResult } from "./market-scout";
import type { ApifyProduct } from "../../routes/apify/market-research";

const ALL_NICHES = listNiches();
const NICHE_LIST = ALL_NICHES.map(n => `${n.key} (${n.label}, default puzzle: ${n.puzzleType})`).join("\n");
const NICHE_KEYS = new Set(ALL_NICHES.map(n => n.key));

// ─── Expert Knowledge ─────────────────────────────────────────────────────────

const MARKET_EXPERT_KNOWLEDGE = `
You are a professional Amazon KDP market research analyst with access to category-level BSR data.

KDP PUZZLE BOOK MARKET STRUCTURE (verified research):
- Top 3 evergreen niches by sustained sales volume: (1) Seniors/Large Print, (2) Kids Activity Books, (3) Holiday/Seasonal
- Fastest growing niches (2023-2024): Christian/Faith, Nature/Garden, Mindfulness/Wellness
- Seasonal surges: Christmas (Oct-Dec) +340% lift; Valentine's Day (Jan-Feb) +80%; Mother's Day (Apr-May) +120%
- Puzzle type demand ranking: Word Search > Sudoku > Crossword > Maze > Cryptogram > Number Search
- Large Print premium: 28% higher conversion rate vs standard, $1-2 higher tolerated price point
- Niche-to-competition sweet spot: niches with 50-200 books earn 3-5× more per book than niches with 1000+ books

OPPORTUNITY SCORING CRITERIA:
- Buyer intent: niches where buyers search with "book", "puzzle", "gift" modifiers score higher
- Seasonal timing: correct-season niches score +2 points
- Competition density: fewer than 200 competing books scores higher
- Puzzle type fit: puzzle type matches the niche's cognitive/demographic profile
- Price elasticity: niches where buyers accept $8.99+ score highest royalties

AUDIENCE PROFILES THAT CONVERT:
- Seniors (60+): gift buyers and self-buyers; respond to "brain health", "large print", "relaxing"
- Grandparents buying for grandchildren: seasonal; respond to "fun", "educational", "kids"
- Women 35-55: largest self-buyer segment; respond to "relaxing", "cozy", "animal themed"
- Holiday gift buyers: respond to "gift", "Christmas", "perfect for"
- Puzzle enthusiasts (all ages): respond to "challenging", "100 puzzles", "variety"

NICHE LIST (all available):
${NICHE_LIST}
`;

const COMPETITION_EXPERT_KNOWLEDGE = `
You are an Amazon KDP competitive intelligence expert.

COMPETITION ANALYSIS FRAMEWORK:
1. Entry barrier: How hard is it for a new book to rank in this niche?
   - Low (opportunity): fewer than 100 books, average rating below 4.2, inconsistent cover quality
   - Medium (viable): 100-500 books, ratings 4.2-4.5, moderate cover quality
   - High (saturated): 500+ books, ratings consistently above 4.5, polished covers dominate

2. Differentiation opportunity: What gaps exist?
   - Visual gap: most covers use similar styles → a research-backed unique cover stands out
   - Content gap: most books have generic word lists → thematic, curated lists win
   - Format gap: most books are standard → a large print or premium edition can own a sub-segment
   - Price gap: if top books all price at $8.99, a $6.99 entry with same puzzle count undercuts

3. Timing advantage:
   - Seasonal niches: entering 6-8 weeks before peak season captures early organic ranking
   - Evergreen niches: any time works but Q4 entry gets holiday lift

4. Keyword accessibility:
   - Primary keyword search volume vs. competition on first-page results
   - Long-tail keywords (<500 searches/month) are easier to rank for as new books
`;

// ─── Sub-agents ───────────────────────────────────────────────────────────────

const NicheCandidateSchema = z.object({
  niche: z.string(),
  nicheLabel: z.string(),
  puzzleType: z.string(),
  opportunityScore: z.number().int().min(1).max(10),
  opportunityReason: z.string(),
  targetAudience: z.string(),
  seasonalFit: z.string(),
});

type NicheCandidate = z.infer<typeof NicheCandidateSchema>;

const CompetitionAssessmentSchema = z.object({
  competitionLevel: z.enum(["low", "medium", "high"]),
  differentiationStrategy: z.string(),
  keywordOpportunity: z.string(),
  entryRecommendation: z.string(),
  competitionScore: z.number().int().min(1).max(10),
});

type CompetitionAssessment = z.infer<typeof CompetitionAssessmentSchema>;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

function parseModelJsonArray(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

async function runNicheOpportunityFinder(brief?: string): Promise<NicheCandidate[]> {
  const today = new Date();
  const month = today.toLocaleString("en-US", { month: "long" });
  const briefSection = brief ? `\nUser's book idea: "${brief}" — factor this into niche selection but always evaluate for market fit.` : "";

  const prompt = `${MARKET_EXPERT_KNOWLEDGE}

Current month: ${month}${briefSection}

Identify the TOP 3 niche opportunities right now. For each, apply the opportunity scoring criteria.
${brief ? "The user has a specific idea — validate whether it's a good opportunity or suggest related alternatives." : "Choose the 3 best market opportunities based on current timing, evergreen demand, and buyer intent."}

Return ONLY a JSON array (no markdown):
[
  {
    "niche": "exact niche key from the list above",
    "nicheLabel": "human readable label",
    "puzzleType": "Word Search",
    "opportunityScore": 8,
    "opportunityReason": "2-3 sentences: why this niche has strong opportunity RIGHT NOW",
    "targetAudience": "precise audience description (age, motivation, occasion)",
    "seasonalFit": "strong/moderate/weak — one sentence on seasonal timing"
  }
]`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1536,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const raw = parseModelJsonArray(text) as unknown[];
  return z.array(NicheCandidateSchema).parse(raw);
}

async function runCompetitionAnalyzer(candidates: NicheCandidate[]): Promise<CompetitionAssessment[]> {
  const candidateList = candidates.map((c, i) =>
    `${i + 1}. ${c.nicheLabel} (${c.niche}) — ${c.puzzleType} — Audience: ${c.targetAudience}`
  ).join("\n");

  const prompt = `${COMPETITION_EXPERT_KNOWLEDGE}

Assess competition for these 3 niche candidates:
${candidateList}

For each candidate, apply the competition analysis framework. Identify differentiation strategies that a well-produced, research-backed cover and curated content could exploit.

Return ONLY a JSON array with exactly 3 entries (one per candidate, same order):
[
  {
    "competitionLevel": "medium",
    "differentiationStrategy": "2-3 sentences on how to differentiate in this niche",
    "keywordOpportunity": "1-2 sentences on keyword gaps or long-tail opportunities",
    "entryRecommendation": "1 sentence on ideal entry strategy (price, format, timing)",
    "competitionScore": 7
  }
]`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1536,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const raw = parseModelJsonArray(text) as unknown[];
  return z.array(CompetitionAssessmentSchema).parse(raw);
}

function formatMarketEvidence(evidence: ApifyProduct[]): string {
  if (!evidence || evidence.length === 0) return "";
  const top = evidence.slice(0, 5);
  const lines = top.map((p, i) =>
    `  ${i + 1}. "${p.title.slice(0, 70)}" — BSR: ${p.bsr ?? "N/A"}, Reviews: ${p.reviews}, Price: ${p.price ? `$${p.price}` : "N/A"}, Competition: ${p.competition_level}`
  ).join("\n");

  const avgReviews = Math.round(top.reduce((s, p) => s + p.reviews, 0) / top.length);
  const lowCompCount = top.filter(p => p.competition_level === "Low").length;

  return `
LIVE AMAZON MARKET DATA (top ${top.length} results from Apify):
${lines}

Market signals:
- Average reviews of top results: ${avgReviews} (lower = less competition = easier to rank)
- Low-competition slots available: ${lowCompCount}/${top.length}
- Use review-gap strategy: target keywords where top results have <100 reviews
- BSR signal: books ranking <10000 indicate active sales volume
Apply this data to select a keyword angle with a visible review gap (under-served demand).`;
}

async function runMarketDirector(
  candidates: NicheCandidate[],
  competition: CompetitionAssessment[],
  brief?: string,
  marketEvidence?: ApifyProduct[],
  usedCombos?: string[],
): Promise<MarketScoutResult> {
  const ranked = candidates.map((c, i) => {
    const comp = competition[i];
    const combinedScore = c.opportunityScore + (comp?.competitionScore ?? 5);
    return { ...c, ...comp, combinedScore };
  }).sort((a, b) => b.combinedScore - a.combinedScore);

  const winner = ranked[0];
  const runnerUp = ranked[1];

  const evidenceSection = marketEvidence && marketEvidence.length > 0
    ? formatMarketEvidence(marketEvidence)
    : "";

  const combosClause = usedCombos && usedCombos.length > 0
    ? `\nCOVER COMBOS ALREADY IN USE — pick a DIFFERENT theme+coverStyle+niche combination:\n${usedCombos.map(c => `  - ${c}`).join("\n")}\n`
    : "";

  const prompt = `You are the Market Intelligence Director for a KDP puzzle book publishing house.
Two specialist agents have evaluated niche opportunities. You must select the final niche and produce the complete market configuration.

WINNING CANDIDATE:
- Niche: ${winner?.niche} (${winner?.nicheLabel})
- Puzzle Type: ${winner?.puzzleType}
- Opportunity Score: ${winner?.opportunityScore}/10
- Opportunity Reason: ${winner?.opportunityReason}
- Target Audience: ${winner?.targetAudience}
- Seasonal Fit: ${winner?.seasonalFit}
- Competition Level: ${winner?.competitionLevel}
- Differentiation Strategy: ${winner?.differentiationStrategy}
- Entry Recommendation: ${winner?.entryRecommendation}

RUNNER-UP: ${runnerUp?.nicheLabel} (score: ${runnerUp?.combinedScore})

${brief ? `USER'S IDEA: "${brief}" — respect this if compatible with market data` : ""}
${evidenceSection}${combosClause}
Based on this research, produce the final market configuration. The winning candidate should be your primary choice unless the user's idea is clearly better or the runner-up is significantly superior.

Rules:
- niche must be one of these exact keys: ${Array.from(NICHE_KEYS).join(", ")}
- puzzleType must be one of: Word Search, Sudoku, Maze, Number Search, Cryptogram, Crossword
- theme must be one of: midnight, forest, crimson, ocean, violet, slate, sunrise, teal, parchment, sky
- coverStyle must be one of: classic, geometric, luxury, bold, minimal, retro, warmth
- keywords must have exactly 7 strings, ordered highest-to-lowest search volume
- difficulty: Easy, Medium, or Hard
- puzzleCount: 50–150 (100 is the proven sweet spot)
- pricePoint: $5.99–$12.99 (match the niche's BSR-validated sweet spot)

Return ONLY JSON (no markdown):
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
  "audienceProfile": "Precise one sentence audience description based on research",
  "whySells": "One sentence citing the specific market opportunity from the analysis"
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const raw = parseModelJson(text);
  const result = MarketScoutResultSchema.parse(raw);

  if (!NICHE_KEYS.has(result.niche)) {
    const match = ALL_NICHES.find(n => winner?.niche && n.key === winner.niche);
    if (match) {
      result.niche = match.key;
      result.nicheLabel = match.label;
    } else {
      const fallback = ALL_NICHES[0];
      result.niche = fallback.key;
      result.nicheLabel = fallback.label;
    }
  }

  // ── Post-parse uniqueness enforcement (2-field key: theme+niche) ──────────────
  if (usedCombos && usedCombos.length > 0) {
    const ALL_THEMES = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
    const currentCombo = `${result.theme}+${result.niche}`;
    if (usedCombos.includes(currentCombo)) {
      const altTheme = ALL_THEMES.find(t => !usedCombos.includes(`${t}+${result.niche}`));
      if (altTheme) result.theme = altTheme;
    }
  }

  return result;
}

// ─── Public orchestrator ──────────────────────────────────────────────────────

export interface MarketIntelligenceResult extends MarketScoutResult {
  candidates: NicheCandidate[];
  winnerRationale: string;
}

export async function runMarketIntelligenceCouncil(
  brief?: string,
  onProgress?: (msg: string) => void,
  marketEvidence?: ApifyProduct[],
  usedCombos?: string[],
): Promise<MarketIntelligenceResult> {
  onProgress?.("Opportunity Finder scanning KDP market data…");

  const candidates = await runNicheOpportunityFinder(brief);
  onProgress?.(`Opportunity Finder found ${candidates.length} candidates · Competition Analyzer assessing…`);

  const [competition] = await Promise.all([
    runCompetitionAnalyzer(candidates),
  ]);
  onProgress?.("Competition assessed · Market Director selecting optimal niche…");

  const market = await runMarketDirector(candidates, competition, brief, marketEvidence, usedCombos);

  const winner = candidates.find(c => c.niche === market.niche) ?? candidates[0];
  const winnerRationale = winner
    ? `${winner.opportunityReason} ${winner.seasonalFit}.`
    : "Best market opportunity based on current data.";

  return {
    ...market,
    candidates,
    winnerRationale,
  };
}

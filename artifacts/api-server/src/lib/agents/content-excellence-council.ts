import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MarketScoutResult } from "./market-scout";
import type { ContentArchitectResult } from "./content-architect";
import type { BuyerProfile } from "./buyer-psychology-profiler";

export const ContentSpecSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  backDescription: z.string(),
  hookSentence: z.string(),
  keywords: z.array(z.string()),
  titleRationale: z.string(),
  copyRationale: z.string(),
  changesApplied: z.array(z.string()),
});

export type ContentSpec = z.infer<typeof ContentSpecSchema>;

// ─── Title & Keyword Specialist ────────────────────────────────────────────────

const TITLE_EXPERT_KNOWLEDGE = `
You are an Amazon KDP title and keyword specialist with deep expertise in Amazon search ranking.

AMAZON SEO TITLE RULES (verified KDP bestseller analysis):
1. Primary keyword must appear in the FIRST 3 words of the title
2. Include a specific number: "100 Puzzles" beats "Many Puzzles" (specificity increases CTR by 22%)
3. Explicit audience callout: "for Seniors", "for Adults", "for Kids 8-12" — directly reduces bounce rate
4. Optimal title length: 50-70 characters (Amazon displays ~80 chars before truncation)
5. Avoid punctuation, special characters, series colons in primary title (algorithm penalty)
6. "Large Print" in title is a proven conversion driver for 55+ audience (+35% CTR in senior category)
7. Power words that convert: "Brain-Boosting", "Relaxing", "Stimulating", "Gift", "Holiday", "Easy", "Fun"
8. Avoid: vague adjectives ("Amazing", "Best"), superlatives (Amazon TOS violation), competitor names

WINNING TITLE FORMULA: [Puzzle Type] [Qualifier] for [Audience]: [Number] [Benefit-Led Description]
Example: "Large Print Word Search for Seniors: 100 Stimulating Puzzles for Sharp Minds"

KEYWORD STRATEGY (7 backend keywords):
- Keyword 1: exact primary search term ("large print word search")
- Keyword 2: puzzle type variation ("word search puzzles for adults")
- Keyword 3: audience term ("senior word search book")
- Keyword 4: benefit term ("brain games for seniors")
- Keyword 5: gift/occasion term ("word search gift for grandma")
- Keyword 6: niche-specific term
- Keyword 7: seasonal/trend term if applicable
`;

async function runTitleKeywordSpecialist(
  market: MarketScoutResult,
  draft: ContentArchitectResult,
  buyerProfile?: BuyerProfile,
): Promise<{ optimizedTitle: string; optimizedSubtitle: string; keywords: string[]; titleRationale: string }> {
  const buyerCtx = buyerProfile
    ? `\nBUYER PSYCHOLOGY (use to sharpen title emotional appeal):
- Primary emotion: ${buyerProfile.primaryEmotion}
- Buyer moment: ${buyerProfile.buyerMoment}
- Copy angle: ${buyerProfile.copyAngle}
- Mood adjectives: ${buyerProfile.moodAdjectives.join(", ")}
Use one mood adjective in the title if it naturally fits and improves CTR.`
    : "";

  const prompt = `${TITLE_EXPERT_KNOWLEDGE}

Evaluate and improve this KDP puzzle book title and keywords:

CURRENT DRAFT:
- Title: "${draft.title}"
- Subtitle: "${draft.subtitle}"

BOOK DETAILS:
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle type: ${market.puzzleType}
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}
- Current keywords: ${market.keywords.join(", ")}${buyerCtx}

Apply the Amazon SEO rules above. If the draft title already follows the formula well, keep it. Only change what demonstrably improves SEO or CTR. Generate the 7 backend keywords.

Return ONLY JSON:
{
  "optimizedTitle": "improved or kept title",
  "optimizedSubtitle": "improved or kept subtitle",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"],
  "titleRationale": "2 sentences on changes made and why (or why kept as-is)"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── Sales Copy Expert ─────────────────────────────────────────────────────────

const COPY_EXPERT_KNOWLEDGE = `
You are a direct-response copywriter specialising in Amazon KDP product descriptions.
Your expertise is grounded in Ogilvy, Cialdini, and proven Amazon conversion principles.

KDP BACK COVER COPY FRAMEWORK (direct-response standards):
1. HOOK (first line, 12-18 words): Opens with the #1 reader desire or problem, NOT the product. "Finally, a puzzle book that..." or "Give your mind the daily workout it craves..."
2. BENEFIT STACK (3-5 bullets or sentences): Each bullet = one specific benefit + proof element. "100 carefully crafted puzzles" not "many puzzles". Lead with the most emotional benefit.
3. SOCIAL PROOF LANGUAGE: "Perfect for..." (audience identification), "Thousands of puzzle lovers..." (implicit crowd proof), "Designed by experts..." (authority)
4. URGENCY/OCCASION CTA: "The perfect gift for..." or "Order today and keep your mind sharp for years to come."
5. Length: 100-150 words optimal. Under 100 = weak. Over 200 = loses buyer before CTA.

CIALDINI PRINCIPLES FOR PUZZLE BOOKS:
- Liking: Address reader by describing their situation ("If you love puzzles but hate tiny print...")
- Social proof: Reference the community ("puzzle lovers everywhere", "seniors across America")
- Authority: "professionally designed", "expert-crafted", "featuring KDP quality printing"
- Scarcity: Not applicable — use occasion instead: "perfect birthday gift", "holiday must-have"
- Commitment: "Start your daily puzzle habit today" — asks for small commitment

HOOK SENTENCE (back cover opener — separate from description):
- Must feel warm and personal, not generic
- Addresses the EXACT audience and their EXACT desire
- 10-18 words — punchy enough to read in 2 seconds
- Do NOT end with a period — conversational, not formal
- Example: "The perfect brain-training gift for every puzzle-loving senior in your life"
`;

async function runSalesCopyExpert(
  market: MarketScoutResult,
  draft: ContentArchitectResult,
  buyerProfile?: BuyerProfile,
): Promise<{ optimizedDescription: string; optimizedHookSentence: string; copyRationale: string }> {
  const buyerPsychBlock = buyerProfile
    ? `
BUYER PSYCHOLOGY PROFILE (use this to guide every copy decision):
- Primary emotion the buyer must feel: "${buyerProfile.primaryEmotion}"
- Exact buyer moment: "${buyerProfile.buyerMoment}"
- Copy angle (lead sentence must deliver this): "${buyerProfile.copyAngle}"
- Mood adjectives: ${buyerProfile.moodAdjectives.join(", ")}
- Visual metaphor (inform tone, not literal): "${buyerProfile.visualMetaphor}"

Your copy MUST open with the copy angle above and sustain the primary emotion throughout.`
    : "";

  const prompt = `${COPY_EXPERT_KNOWLEDGE}
${buyerPsychBlock}

Evaluate and improve this KDP puzzle book back cover copy:

CURRENT DRAFT:
- Hook sentence: "${draft.hookSentence || "(none)"}"
- Back description: "${draft.backDescription}"

BOOK DETAILS:
- Niche: ${market.nicheLabel} (${market.niche})
- Puzzle type: ${market.puzzleType}
- Puzzle count: ${market.puzzleCount} — LOCKED. You MUST use this exact number when mentioning puzzles. Do not substitute any other number.
- Audience: ${market.audienceProfile}
- Large print: ${market.largePrint}

Apply the direct-response framework. Preserve the author's voice and core message. Improve structure, benefit language, and CTA. Keep the hook sentence warm and personal (no period at end). The description MUST reference the exact puzzle count (${market.puzzleCount}) at least once.

IMPORTANT — KDP HTML FORMATTING:
The optimizedDescription must use Amazon KDP-supported HTML tags for better readability on the product page:
- Wrap the opening hook/lead paragraph in <p>...</p>
- Use <b>...</b> for key benefit phrases (1-2 per bullet maximum)
- Use <ul><li>...</li></ul> for the benefit stack (3-5 items)
- End with a closing <p> containing the CTA
- Do NOT use heading tags (h1/h2/h3), tables, images, or any other HTML
- Plain text fallback should still read naturally if HTML is stripped
- Total word count (HTML tags excluded): 100-150 words

Return ONLY JSON:
{
  "optimizedDescription": "<p>Opening lead aligned with buyer emotion and copy angle.</p><ul><li><b>Benefit one</b> — specific proof element.</li><li><b>Benefit two</b> — ...</li><li><b>Benefit three</b> — ...</li></ul><p>Closing CTA sentence.</p>",
  "optimizedHookSentence": "warm, personal 10-18 word hook (no period)",
  "copyRationale": "2 sentences on which framework principles and buyer psychology signals you applied"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1536,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── Content Director (synthesis) ──────────────────────────────────────────────

async function runContentDirector(
  market: MarketScoutResult,
  draft: ContentArchitectResult,
  titleResult: Awaited<ReturnType<typeof runTitleKeywordSpecialist>>,
  copyResult: Awaited<ReturnType<typeof runSalesCopyExpert>>,
): Promise<ContentSpec> {
  // Director synthesises — in most cases accepts both specialist outputs directly
  const prompt = `You are the Content Director for a KDP puzzle book publishing house.
Two specialists have improved the book content. Accept their improvements and produce the final ContentSpec.
Only override a specialist if their change is clearly worse than the original (e.g. made description too long, or title lost the primary keyword).

ORIGINAL DRAFT:
- Title: "${draft.title}"
- Subtitle: "${draft.subtitle}"
- Hook: "${draft.hookSentence || ""}"
- Description: "${draft.backDescription}"

TITLE SPECIALIST OUTPUT:
- Title: "${titleResult.optimizedTitle}"
- Subtitle: "${titleResult.optimizedSubtitle}"
- Keywords: ${titleResult.keywords.join(", ")}
- Rationale: "${titleResult.titleRationale}"

COPY EXPERT OUTPUT:
- Hook: "${copyResult.optimizedHookSentence}"
- Description: "${copyResult.optimizedDescription}"
- Rationale: "${copyResult.copyRationale}"

Produce the final ContentSpec. List each change applied vs the original draft.

Return ONLY JSON:
{
  "title": "final title",
  "subtitle": "final subtitle",
  "backDescription": "final back cover description",
  "hookSentence": "final hook sentence (no period)",
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7"],
  "titleRationale": "1-2 sentences on title decisions",
  "copyRationale": "1-2 sentences on copy decisions",
  "changesApplied": ["change 1 vs original", "change 2 vs original"]
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  return ContentSpecSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

// ─── Public orchestrator ────────────────────────────────────────────────────────

export async function runContentExcellenceCouncil(
  market: MarketScoutResult,
  draft: ContentArchitectResult,
  buyerProfile?: BuyerProfile,
): Promise<ContentSpec> {
  const [titleResult, copyResult] = await Promise.all([
    runTitleKeywordSpecialist(market, draft, buyerProfile),
    runSalesCopyExpert(market, draft, buyerProfile),
  ]);
  return runContentDirector(market, draft, titleResult, copyResult);
}

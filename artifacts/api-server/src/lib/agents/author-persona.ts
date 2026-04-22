import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export const PortfolioBriefSchema = z.object({
  primaryNiches: z.array(z.string()).min(1),
  audienceAge: z.string().default("adults 45-75"),
  targetVolumeCount: z.number().int().min(1).max(100).default(12),
  preferredGender: z.enum(["female", "male", "ambiguous", "ai-pick"]).default("ai-pick"),
  preferredTone: z.enum(["warm", "scholarly", "witty", "serene", "investigative", "ai-pick"]).default("ai-pick"),
});
export type PortfolioBrief = z.infer<typeof PortfolioBriefSchema>;

export const AuthorPersonaSchema = z.object({
  penName: z.string().min(3).max(60),
  honorific: z.string().optional(),
  bio: z.string().min(40).max(2000),
  voice: z.object({
    tone: z.string(),
    vocabulary: z.string(),
    avoid: z.array(z.string()),
  }),
  monogram: z.object({
    initials: z.string().min(1).max(3),
    svg: z.string(),
  }),
  signatureColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  portfolioFit: z.string(),
  candidatesConsidered: z.number(),
  collisionRisk: z.enum(["low", "medium", "high", "unchecked"]),
});
export type AuthorPersona = z.infer<typeof AuthorPersonaSchema>;

const CandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        penName: z.string(),
        honorific: z.string().optional().nullable(),
        rationale: z.string(),
        signatureColor: z.string(),
        voiceTone: z.string(),
        voiceVocabulary: z.string(),
      }),
    )
    .min(3)
    .max(12),
});

const EnrichmentSchema = z.object({
  bio: z.string(),
  voiceAvoid: z.array(z.string()),
  portfolioFit: z.string(),
});

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

function normalizeHex(hex: string): string {
  const h = (hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  const short = h.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return "#6b4f3a"; // warm earth fallback
}

function extractInitials(penName: string): string {
  return penName
    .split(/\s+/)
    .map(w => w.replace(/[^A-Za-z]/g, "")[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

function generateMonogramSvg(initials: string, color: string): string {
  const upper = initials.trim().slice(0, 3).toUpperCase();
  const fontSize = upper.length === 1 ? 44 : upper.length === 2 ? 34 : 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${upper} monogram">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="1"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="none" stroke="url(#mg)" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="0.6" stroke-opacity="0.5"/>
  <g stroke="${color}" stroke-opacity="0.45" stroke-width="0.6">
    <line x1="50" y1="6"  x2="50" y2="12"/>
    <line x1="50" y1="88" x2="50" y2="94"/>
    <line x1="6"  y1="50" x2="12" y2="50"/>
    <line x1="88" y1="50" x2="94" y2="50"/>
  </g>
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
        font-family="'Playfair Display', Georgia, 'Times New Roman', serif"
        font-weight="700" font-size="${fontSize}" fill="${color}"
        letter-spacing="1.5">${upper}</text>
</svg>`;
  return svg.replace(/\n\s*/g, " ").trim();
}

async function checkAmazonCollision(penName: string): Promise<"low" | "medium" | "high" | "unchecked"> {
  try {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(penName)}&i=stripbooks`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }).finally(() => clearTimeout(to));
    if (!res.ok) return "unchecked";
    const html = await res.text();
    const cardHits = (html.match(/data-component-type="s-search-result"/g) || []).length;
    const puzzleHits = (html.match(/puzzle|word search|sudoku|crossword|cryptogram/gi) || []).length;
    if (cardHits === 0) return "low";
    if (cardHits > 20 && puzzleHits > 60) return "high";
    if (cardHits > 10) return "medium";
    return "low";
  } catch {
    return "unchecked";
  }
}

function buildCandidatePrompt(brief: PortfolioBrief): string {
  const genderLine =
    brief.preferredGender === "ai-pick"
      ? "You choose the gender signal that best fits the portfolio and ranks best on Amazon."
      : `Preferred gender signal for the pen name: ${brief.preferredGender}.`;
  const toneLine =
    brief.preferredTone === "ai-pick"
      ? "You choose the tone that best fits the portfolio."
      : `Preferred tone: ${brief.preferredTone}.`;
  return `You are a senior brand strategist helping an Amazon KDP publisher choose ONE coherent pen name for a puzzle-book portfolio that will span many volumes.

Portfolio brief:
- Primary niches: ${brief.primaryNiches.join(", ")}
- Target audience age: ${brief.audienceAge}
- Planned volume count: ${brief.targetVolumeCount} books in the next 12 months
- ${genderLine}
- ${toneLine}

Hard requirements:
- Every candidate must feel like a real author's name — believable, warm, memorable.
- English-language reading; avoid names that strongly signal one specific culture unless the portfolio niches require it.
- AVOID very common names ("John Smith", "Jane Brown") — the author page must be findable on Amazon.
- AVOID names of real famous people (living or historical) and AVOID any name already associated with a prolific Amazon puzzle-book author (Eleanor Bennett, Margaret Jenkins, Rose Wilson and similar already-saturated names).
- Keep pen names to first + last (optional middle initial).
- Each candidate should feel plausible as the lifetime voice of a puzzle/wellness publisher.
- The signature colour should match the audience and niches:
  - Gift / seniors / grandmother-brands → warm earth tones (terracotta, old gold, sage)
  - Scholarly / dark academia / true crime → deep jewel tones (oxblood, ink blue, forest)
  - Mindfulness / wellness → dusty pastels (dusty rose, sage, clay)
  - Holiday / festive → warm accent (cranberry, pine, copper)

Produce 8 candidates, ranked BEST to WORST fit. Return ONLY strict JSON (no markdown, no commentary):
{
  "candidates": [
    {
      "penName": "e.g. Eleanor Graves",
      "honorific": null,
      "rationale": "One sentence — why this name fits the portfolio",
      "signatureColor": "#RRGGBB — brand accent colour for this author",
      "voiceTone": "e.g. warm, grandmotherly",
      "voiceVocabulary": "e.g. approachable and nostalgic"
    }
  ]
}`;
}

function buildEnrichmentPrompt(
  candidate: z.infer<typeof CandidatesSchema>["candidates"][number],
  brief: PortfolioBrief,
): string {
  return `You are the chosen author's brand writer. You will write the single coherent author persona that appears on every book in the portfolio.

Chosen author: ${candidate.penName}${candidate.honorific ? ` (${candidate.honorific})` : ""}
Voice tone: ${candidate.voiceTone}
Voice vocabulary: ${candidate.voiceVocabulary}
Portfolio niches: ${brief.primaryNiches.join(", ")}
Target audience: ${brief.audienceAge}
Planned volumes: ${brief.targetVolumeCount}

Requirements:
1. "bio" — an 80-word author bio for the back cover of every book. Third person, present tense. Warm and believable. Must mention puzzle craft or mental-wellness framing without inventing fake awards, fake universities, or fake decades of experience. No year references. No city names unless vague (e.g. "the Pacific Northwest" is fine, "Seattle" is not). Close with one evocative personal detail (e.g. "lives with two bookshelves that are always one book too full").
2. "voiceAvoid" — a list of 8–15 words or phrases this author would NEVER use, so the voice stays consistent across books. Mix of clichés, tonal mismatches, and overused puzzle-book filler.
3. "portfolioFit" — one sentence explaining why this author fits the planned portfolio.

Return ONLY strict JSON (no markdown):
{
  "bio": "80-word author bio (third person)",
  "voiceAvoid": ["word or phrase", "..."],
  "portfolioFit": "one sentence"
}`;
}

export async function runAuthorPersonaAgent(briefInput: PortfolioBrief): Promise<AuthorPersona> {
  const brief = PortfolioBriefSchema.parse(briefInput);

  // Stage 1 — generate 8 candidates
  const candMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: buildCandidatePrompt(brief) }],
  });
  const cText = candMsg.content[0].type === "text" ? candMsg.content[0].text : "{}";
  const candidates = CandidatesSchema.parse(parseModelJson(cText)).candidates;

  // Stage 2 — best-effort Amazon collision check on the top 5
  const topN = candidates.slice(0, 5);
  const collisions = await Promise.all(topN.map(c => checkAmazonCollision(c.penName)));

  // Score: lower is better. Rank penalty + collision penalty.
  const scored = topN.map((c, i) => {
    const collision = collisions[i] ?? "unchecked";
    const collisionPenalty =
      collision === "low" ? 0 : collision === "unchecked" ? 1 : collision === "medium" ? 3 : 7;
    return { candidate: c, rank: i, collision, score: i + collisionPenalty };
  });
  scored.sort((a, b) => a.score - b.score);
  const winner = scored[0];

  // Stage 3 — enrich the winner: bio, voice-avoid list, portfolio fit
  const enrichMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 900,
    messages: [{ role: "user", content: buildEnrichmentPrompt(winner.candidate, brief) }],
  });
  const eText = enrichMsg.content[0].type === "text" ? enrichMsg.content[0].text : "{}";
  const enrich = EnrichmentSchema.parse(parseModelJson(eText));

  // Stage 4 — procedural monogram SVG (we don't trust AI with text rendering)
  const initials = extractInitials(winner.candidate.penName) || winner.candidate.penName.slice(0, 2).toUpperCase();
  const color = normalizeHex(winner.candidate.signatureColor);
  const svg = generateMonogramSvg(initials, color);

  const persona: AuthorPersona = {
    penName: winner.candidate.penName,
    honorific: winner.candidate.honorific ?? undefined,
    bio: enrich.bio,
    voice: {
      tone: winner.candidate.voiceTone,
      vocabulary: winner.candidate.voiceVocabulary,
      avoid: enrich.voiceAvoid,
    },
    monogram: { initials, svg },
    signatureColor: color,
    portfolioFit: enrich.portfolioFit,
    candidatesConsidered: candidates.length,
    collisionRisk: winner.collision,
  };

  return AuthorPersonaSchema.parse(persona);
}

/**
 * Niche Content Curator.
 *
 * Runs once per book (cached per niche+experienceMode). Produces every piece
 * of interior-body content that SHOULD be niche-themed but historically
 * wasn't — cryptogram quotes, trivia paragraphs, decorative motif hints.
 *
 * Before this agent: a Mother's Day book had Nietzsche quotes inside the
 * cryptograms. Now: every cryptogram in a Mother's Day book is a quote
 * about mothers — Maya Angelou, Rumi, Proverbs, Barbara Bush.
 */

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { cachedRun, stableKey } from "../council-cache";

// ── Types ───────────────────────────────────────────────────────────────────

export const ThemedQuoteSchema = z.object({
  quote: z.string().min(10).max(280),
  author: z.string().min(1).max(100),
});
export type ThemedQuote = z.infer<typeof ThemedQuoteSchema>;

export const ContentPackSchema = z.object({
  themedQuotes: z.array(ThemedQuoteSchema).min(20).max(200),
  trivia: z.array(z.object({
    heading: z.string().min(3).max(80),
    body: z.string().min(30).max(500),
  })).min(3).max(15),
  motifKey: z.string().min(3).max(40),
  toneDescriptor: z.string().min(5).max(160),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;

export interface CuratorInput {
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  puzzleCount: number;
  experienceMode: string;
  authorVoice?: string;
  audience?: string;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(input: CuratorInput): string {
  return `You are the content editor for a puzzle book in the "${input.nicheLabel}" niche (key: ${input.niche}).
Your job: produce everything that will appear INSIDE the puzzles and between sections so the book feels cohesive end-to-end.

Book context:
- Niche: ${input.nicheLabel}
- Puzzle type: ${input.puzzleType}
- Puzzle count: ${input.puzzleCount}
- Experience mode: ${input.experienceMode}
- Audience: ${input.audience ?? "adults who buy puzzle books for this niche"}
${input.authorVoice ? `- Author voice: ${input.authorVoice}` : ""}

Produce THREE content blocks:

1. **themedQuotes** — a pool of at least ${Math.min(input.puzzleCount, 120)} quotes that fit this niche.
   Rules:
   - Each quote must be ACTUALLY attributed — use real people, real sources. No "Anonymous" except for genuine proverbs.
   - Mix ancient (Proverbs, Rumi, Marcus Aurelius) with modern (Maya Angelou, poets, authors, chefs — whatever fits).
   - For ${input.nicheLabel}, every quote must connect to the niche theme. If it's a Mother's Day book: quotes about mothers. If it's True Crime: detective / forensic / justice quotes. If it's Bible: actual verses. If it's Foodie: chef quotes, culinary wisdom. If it's Cozy: hearth, home, tea, quiet-life quotes.
   - Length per quote: 20-180 characters. They will be encoded as cryptograms.
   - NEVER repeat quotes within the list.
   - Prefer quotes that are inspiring, thoughtful, or evocative — not generic.

2. **trivia** — 5 short niche-relevant trivia entries that will be printed on interstitial pages between puzzle sections.
   Rules:
   - Each entry: a heading (3-8 words) + a 2-4 sentence body paragraph.
   - Content must be factual and enriching — "Did you know?" style.
   - Mother's Day example heading: "The Origin of the Carnation". True Crime: "The First Fingerprint Case". Bible: "The Parable of the Sower Explained". Cozy: "A Brief History of Afternoon Tea".
   - Use the author's voice if supplied; otherwise warm, knowledgeable, non-preachy.

3. **motifKey** — single machine-readable key describing which decorative motif set the book should use (rose, compass, scroll, teacup, flame, etc.). Choose ONE that best fits the niche+experienceMode combo. Examples: "rose-garden" for Mother's Day cozy, "case-file" for True Crime detective, "treasure-compass" for Adventure, "ex-libris" for Dark Academia.

4. **toneDescriptor** — one short sentence describing the interior tone this book should project. Used by downstream renderers.

Return ONLY strict JSON:
{
  "themedQuotes": [
    { "quote": "...", "author": "..." },
    ...
  ],
  "trivia": [
    { "heading": "...", "body": "..." },
    ...
  ],
  "motifKey": "...",
  "toneDescriptor": "..."
}`;
}

// ── Parse helpers ───────────────────────────────────────────────────────────

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Could not parse Content Curator JSON");
}

// ── Fallback pack (zero-LLM safety net) ────────────────────────────────────

function fallbackPack(input: CuratorInput): ContentPack {
  // Minimum viable pack so the pipeline never breaks if Claude fails.
  return {
    themedQuotes: [
      { quote: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
      { quote: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
      { quote: "The only way out is through.", author: "Robert Frost" },
      { quote: "Courage is grace under pressure.", author: "Ernest Hemingway" },
      { quote: "The unexamined life is not worth living.", author: "Socrates" },
      { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
      { quote: "The best way out is always through.", author: "Robert Frost" },
      { quote: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
      { quote: "Hope is the thing with feathers that perches in the soul.", author: "Emily Dickinson" },
      { quote: "We accept the love we think we deserve.", author: "Stephen Chbosky" },
      { quote: "Do not go gentle into that good night.", author: "Dylan Thomas" },
      { quote: "To live is the rarest thing in the world.", author: "Oscar Wilde" },
      { quote: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" },
      { quote: "I have not failed. I've just found ten thousand ways that won't work.", author: "Thomas Edison" },
      { quote: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
      { quote: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
      { quote: "In three words I can sum up everything I've learned about life: it goes on.", author: "Robert Frost" },
      { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
      { quote: "You must be the change you wish to see in the world.", author: "Mahatma Gandhi" },
      { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
    ],
    trivia: [
      { heading: "A Note from the Publisher", body: `This collection was curated for ${input.nicheLabel} enthusiasts — every puzzle has been designed to reward careful solving. Take your time and enjoy the journey.` },
      { heading: "How to Get the Most from This Book", body: "Solve one or two puzzles a day rather than racing through. Regular brief sessions build skill faster than marathon attempts and make the rewards of each solve last longer." },
      { heading: "A Word on Difficulty", body: "If a puzzle stumps you, set it aside and come back tomorrow. The brain solves problems in the background while you sleep — more than one puzzle writer has had their clearest insights first thing in the morning." },
    ],
    motifKey: `${input.experienceMode}-default`,
    toneDescriptor: `A ${input.experienceMode} ${input.nicheLabel} experience.`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * Curates a niche-themed ContentPack for a single book. Fails open — if
 * Claude is unavailable, returns a minimal generic pack so generation never
 * blocks. Cached by (niche, experienceMode) in the council cache.
 */
export async function runNicheContentCurator(input: CuratorInput): Promise<ContentPack> {
  const key = stableKey({
    niche: input.niche,
    experienceMode: input.experienceMode,
    puzzleType: input.puzzleType,
  });

  return cachedRun(
    "niche-content-curator",
    key,
    async (): Promise<ContentPack> => {
      try {
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          messages: [{ role: "user", content: buildPrompt(input) }],
        });
        const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
        const raw = parseModelJson(text);
        const parsed = ContentPackSchema.safeParse(raw);
        if (parsed.success) return parsed.data;

        // Partial validation: salvage whatever we got, fill gaps from fallback
        const rawObj = raw as Record<string, unknown>;
        const fb = fallbackPack(input);
        const themedQuotes = Array.isArray(rawObj.themedQuotes)
          ? (rawObj.themedQuotes as unknown[])
              .map(q => ThemedQuoteSchema.safeParse(q))
              .filter((r): r is { success: true; data: ThemedQuote } => r.success)
              .map(r => r.data)
          : [];
        if (themedQuotes.length < 20) {
          themedQuotes.push(...fb.themedQuotes.slice(0, 20 - themedQuotes.length));
        }
        return {
          themedQuotes,
          trivia: Array.isArray(rawObj.trivia) && rawObj.trivia.length > 0
            ? (rawObj.trivia as Array<{ heading?: unknown; body?: unknown }>)
                .map(t => ({ heading: String(t.heading || ""), body: String(t.body || "") }))
                .filter(t => t.heading && t.body)
            : fb.trivia,
          motifKey: typeof rawObj.motifKey === "string" ? rawObj.motifKey : fb.motifKey,
          toneDescriptor: typeof rawObj.toneDescriptor === "string" ? rawObj.toneDescriptor : fb.toneDescriptor,
        };
      } catch {
        return fallbackPack(input);
      }
    },
    24 * 7,  // 7-day TTL — niche content doesn't change day-to-day
  );
}

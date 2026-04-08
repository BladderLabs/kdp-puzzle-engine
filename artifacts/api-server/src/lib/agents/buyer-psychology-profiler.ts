import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export const BuyerProfileSchema = z.object({
  primaryEmotion: z.string(),
  buyerMoment: z.string(),
  visualMetaphor: z.string(),
  moodAdjectives: z.array(z.string()),
  copyAngle: z.string(),
});

export type BuyerProfile = z.infer<typeof BuyerProfileSchema>;

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function runBuyerPsychologyProfiler(
  niche: string,
  nicheLabel: string,
  puzzleType: string,
  audienceProfile: string,
  largePrint?: boolean,
  title?: string,
  backDescription?: string,
): Promise<BuyerProfile> {
  const titleLine = title ? `- Draft title: "${title}"` : "";
  const descLine = backDescription ? `- Draft back description excerpt: "${backDescription.slice(0, 120)}…"` : "";
  const printLine = largePrint !== undefined ? `- Large print: ${largePrint}` : "";

  // Niche-grounded psychology framework: different buyer psychology by niche archetype
  const nicheN = niche.toLowerCase();
  const nicheFramework = (() => {
    if (nicheN.includes("gift") || nicheN.includes("mothers-day") || nicheN.includes("fathers-day") || nicheN.includes("christmas") || nicheN.includes("birthday")) {
      return `GIFT BUYER FRAMEWORK: The primary buyer is NOT the end-user — they are someone buying a gift.
- Primary emotion: pride in giving a thoughtful, high-quality gift; desire to delight the recipient
- Buyer moment: browsing Amazon for gift ideas, often under time pressure
- Visual metaphor: should signal "premium gift" — gift wrapping, ribbon, warm celebratory imagery
- Copy angle: lead with "the perfect gift for [audience]" — reassure the buyer that the recipient will love it`;
    }
    if (nicheN.includes("senior") || nicheN.includes("60+") || nicheN.includes("elder") || nicheN.includes("retire") || nicheN.includes("large-print") || largePrint) {
      return `SENIOR BUYER FRAMEWORK: The buyer is typically 60+ or a family member buying for a senior.
- Primary emotion: calm confidence; relief that the puzzles are accessible and enjoyable
- Buyer moment: browsing for a mentally stimulating leisure activity or buying for a parent/grandparent
- Visual metaphor: warm, cozy, familiar domestic scenes — a sunlit armchair, a cup of tea, afternoon light
- Copy angle: lead with accessibility and mental wellbeing benefits — "designed for comfortable reading"`;
    }
    if (nicheN.includes("kid") || nicheN.includes("child") || nicheN.includes("junior") || nicheN.includes("young") || nicheN.includes("beginner") || nicheN.includes("easy")) {
      return `BEGINNER/KIDS BUYER FRAMEWORK: The buyer wants fun, accessible, non-intimidating content.
- Primary emotion: playful delight; confidence that the puzzles are fun (not frustrating)
- Buyer moment: parent browsing for screen-free activity, or beginner searching for a starter puzzle book
- Visual metaphor: bright, colorful imagery — bold illustration, cheerful colors, friendly subjects
- Copy angle: lead with fun and accessibility — "perfect for beginners" or "hours of screen-free fun"`;
    }
    if (nicheN.includes("holiday") || nicheN.includes("christmas") || nicheN.includes("halloween") || nicheN.includes("thanksgiving") || nicheN.includes("easter") || nicheN.includes("valentine")) {
      return `HOLIDAY BUYER FRAMEWORK: Seasonal urgency drives this purchase.
- Primary emotion: festive excitement; seasonal joy; the pleasure of a themed activity
- Buyer moment: browsing for seasonal activities or last-minute gifts in the lead-up to the holiday
- Visual metaphor: iconic holiday imagery — the holiday's signature colors, symbols, and warmth
- Copy angle: lead with seasonal delight and time-limited appeal — "celebrate [holiday] with puzzles"`;
    }
    return `GENERAL PUZZLE BUYER FRAMEWORK: Core puzzle enthusiast or wellness-minded adult.
- Primary emotion: intellectual satisfaction; the reward of a good challenge; calm focus
- Buyer moment: self-buying for leisure, relaxation, or brain training — often browsing casually on Amazon
- Visual metaphor: scenes of calm, focused activity — a book on a quiet table, a pencil, a serene workspace
- Copy angle: lead with the mental and emotional benefit — the pleasure of solving, the calm of focus`;
  })();

  const prompt = `You are a buyer psychology expert specialising in Amazon KDP puzzle books.
Identify the exact psychological profile that drives purchase for this book.

NICHE PSYCHOLOGY FRAMEWORK TO APPLY:
${nicheFramework}

Book details:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Target audience: ${audienceProfile}
${printLine}
${titleLine}
${descLine}

Using the framework above as grounding, produce a precise buyer profile specific to THIS book.
Return ONLY JSON (no markdown):
{
  "primaryEmotion": "The single dominant emotion this buyer must feel when they see the cover (e.g. 'nostalgic warmth', 'calm focus', 'joyful pride')",
  "buyerMoment": "The specific life moment when this person buys — describe the exact scene (e.g. 'grandmother browsing Amazon for her Sunday afternoon activity', 'adult child buying a birthday gift')",
  "visualMetaphor": "One concrete visual object or scene that captures the emotional world of this buyer (e.g. 'a sunlit porch with a steaming mug', 'colourful autumn leaves on a garden path')",
  "moodAdjectives": ["3 to 5 mood adjectives that should guide every design choice, e.g. cosy, nostalgic, serene"],
  "copyAngle": "The single most powerful copy angle for this buyer — what promise or feeling must the back-cover text deliver in the first sentence"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return BuyerProfileSchema.parse(parseModelJson(text));
}

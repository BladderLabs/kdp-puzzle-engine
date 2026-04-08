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

  const prompt = `You are a buyer psychology expert specialising in Amazon KDP puzzle books.
Identify the exact psychological profile that drives purchase for this book.

Book details:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Target audience: ${audienceProfile}
${printLine}
${titleLine}
${descLine}

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

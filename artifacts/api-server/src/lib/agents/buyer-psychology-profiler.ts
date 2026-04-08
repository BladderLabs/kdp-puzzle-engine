import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export const BuyerProfileSchema = z.object({
  buyerPersona: z.string(),
  primaryMotivation: z.string(),
  emotionalHook: z.string(),
  purchaseTriggers: z.array(z.string()),
  visualPreferences: z.string(),
  hookSentenceTemplate: z.string(),
  psychologyNote: z.string(),
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
): Promise<BuyerProfile> {
  const prompt = `You are a buyer psychology expert specialising in Amazon KDP puzzle book buyers.
Analyse the exact buyer who will purchase this puzzle book and extract the core psychological profile that should drive every creative decision — cover design, color palette, typography, and image prompt.

Book details:
- Niche: ${nicheLabel} (${niche})
- Puzzle type: ${puzzleType}
- Target audience: ${audienceProfile}

Your job: Identify the SPECIFIC emotional and psychological drivers that make this buyer click "Buy Now" on Amazon.

Return ONLY JSON (no markdown):
{
  "buyerPersona": "One concise sentence describing the exact buyer archetype (age, life stage, why they're buying)",
  "primaryMotivation": "The single strongest reason this person buys puzzle books (mental stimulation, gift, relaxation, etc.)",
  "emotionalHook": "The core feeling the buyer wants to experience — what the cover must trigger instantly",
  "purchaseTriggers": ["up to 4 specific visual or textual cues that convert this buyer (e.g. 'LARGE PRINT badge', 'gift bow icon', 'warm cozy imagery')"],
  "visualPreferences": "1 sentence on what visual style resonates most with this buyer — warm/clean/bold/elegant etc.",
  "hookSentenceTemplate": "A 10-15 word back-cover hook sentence template specifically for this buyer's emotional trigger",
  "psychologyNote": "1 sentence on the single most important psychological principle driving this buyer's purchase decision"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  return BuyerProfileSchema.parse(parseModelJson(text));
}

import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { listNiches } from "../../lib/niches";

const router: IRouter = Router();

const NICHE_LIST = listNiches().map(n => `${n.key} (${n.label}, ${n.puzzleType})`).join(", ");

const KDP_EXPERT_CONTEXT = `You are an expert Amazon KDP puzzle book market analyst. The platform has these built-in niches: ${NICHE_LIST}.

Puzzle types supported: Word Search, Sudoku, Maze, Number Search, Cryptogram
Cover styles: classic, geometric, luxury, bold, minimal, retro
Themes: midnight, forest, crimson, ocean, violet, slate, rose, ember
Typical KDP pricing: $5.99–$9.99 for puzzle books (large print commands $1–2 premium)
Typical puzzle counts: 50–100 for most books`;

router.post("/ai/book-ideas", async (req, res) => {
  try {
    const { puzzleType } = req.body as { puzzleType?: string };

    const filterHint = puzzleType ? ` Focus especially on "${puzzleType}" puzzle type ideas.` : "";

    const prompt = `${KDP_EXPERT_CONTEXT}

Generate exactly 4 diverse Amazon KDP puzzle book opportunity cards.${filterHint}

For each card, pick a unique combination of puzzle type + niche that has strong sales potential on Amazon KDP.

Respond with ONLY a JSON array, no markdown, no explanation:
[
  {
    "puzzleType": "Word Search",
    "niche": "seniors",
    "nicheLabel": "Seniors & Large Print",
    "salesPotential": "Hot",
    "coverStyle": "classic",
    "difficulty": "Easy",
    "puzzleCount": 100,
    "pricePoint": 7.99,
    "largePrint": true,
    "theme": "midnight",
    "whySells": "One sentence explaining why this sells well on KDP",
    "title": "Example book title",
    "subtitle": "Example subtitle for back cover"
  }
]

salesPotential must be one of: Hot, Rising, Stable
niche must be one of the exact keys from the provided niche list
puzzleType must be one of: Word Search, Sudoku, Maze, Number Search, Cryptogram`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const cards = JSON.parse(cleaned);

    res.json({ cards });
  } catch (err) {
    req.log.error({ err }, "Failed to get book ideas");
    res.status(500).json({ error: "Failed to get book ideas" });
  }
});

router.post("/ai/score-title", async (req, res) => {
  try {
    const { title, puzzleType, niche } = req.body as { title: string; puzzleType?: string; niche?: string };

    const context = [puzzleType && `Puzzle type: ${puzzleType}`, niche && `Niche: ${niche}`]
      .filter(Boolean).join(", ");

    const prompt = `${KDP_EXPERT_CONTEXT}

Score this Amazon KDP puzzle book title on a scale of 1–10 for sales effectiveness:
Title: "${title}"${context ? `\nContext: ${context}` : ""}

Scoring criteria: keyword relevance, clarity, target audience appeal, searchability, competitive differentiation.

Respond with ONLY JSON, no markdown:
{
  "score": 7,
  "feedback": "One or two sentences of specific, actionable feedback.",
  "suggestions": [
    "Rewritten title suggestion 1",
    "Rewritten title suggestion 2",
    "Rewritten title suggestion 3"
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to score title");
    res.status(500).json({ error: "Failed to score title" });
  }
});

router.post("/ai/niche-ideas", async (req, res) => {
  try {
    const { puzzleType } = req.body as { puzzleType: string };

    const prompt = `${KDP_EXPERT_CONTEXT}

For the puzzle type "${puzzleType}", give me the top 3 best-selling niches from the provided niche list, with a short "why it sells" explanation for each.

Respond with ONLY JSON, no markdown:
{
  "ideas": [
    {
      "niche": "seniors",
      "nicheLabel": "Seniors & Large Print",
      "whySells": "One sentence explaining why this niche/puzzle combo sells well"
    }
  ]
}

niche must be exact keys from the provided list.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get niche ideas");
    res.status(500).json({ error: "Failed to get niche ideas" });
  }
});

export default router;

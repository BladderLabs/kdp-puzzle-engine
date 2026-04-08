import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface QASpec {
  title: string;
  subtitle: string;
  backDescription: string;
  puzzleCount: number;
  keywords: string[];
  hasImage: boolean;
  words: string[];
  author: string;
  // Cover uniqueness inputs (optional — added by Task #29)
  coverCombo?: string;       // "theme+coverStyle+niche" of this book
  usedCombos?: string[];     // all combos already in the library
}

export interface QAIssue {
  field: string;
  problem: string;
  fix: string;
}

export interface QAResult {
  passed: boolean;
  issues: QAIssue[];
  needs_revision: boolean;
}

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

const QAResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({
    field: z.string(),
    problem: z.string(),
    fix: z.string(),
  })),
  needs_revision: z.boolean(),
});

export async function runQAReviewer(spec: QASpec): Promise<QAResult> {
  const descWordCount = spec.backDescription.trim().split(/\s+/).filter(Boolean).length;
  const titleWordCount = spec.title.trim().split(/\s+/).filter(Boolean).length;

  const PLACEHOLDER_PATTERNS = ["lorem ipsum", "placeholder", "tbd", "your title here", "insert", "example text"];
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some(p =>
    spec.title.toLowerCase().includes(p) ||
    spec.backDescription.toLowerCase().includes(p) ||
    spec.subtitle.toLowerCase().includes(p),
  );

  // ── Deterministic cover diversity check (check 7) ──────────────────────────
  const coverDiversityIssue: QAIssue | null = (() => {
    if (!spec.coverCombo || !spec.usedCombos || spec.usedCombos.length === 0) return null;
    // Strip the current book's own combo so a re-check after a save doesn't self-fail
    const otherCombos = spec.usedCombos.filter(c => c !== spec.coverCombo);
    if (!otherCombos.includes(spec.coverCombo)) return null;
    return {
      field: "cover_combination",
      problem: `Cover combination "${spec.coverCombo}" is already used by another book in your library`,
      fix: `Select a different theme+coverStyle+niche combination — currently used: ${otherCombos.join(", ")}`,
    };
  })();

  const prompt = `You are a KDP quality assurance expert reviewing a puzzle book for publication readiness.

Book specification:
- Title (${titleWordCount} words): "${spec.title}"
- Subtitle: "${spec.subtitle}"
- Author: "${spec.author}"
- Back description (${descWordCount} words): "${spec.backDescription}"
- Puzzle count: ${spec.puzzleCount}
- Keywords (${spec.keywords.length}): ${spec.keywords.join(", ")}
- Has cover image: ${spec.hasImage}
- Has placeholder text detected: ${hasPlaceholder}

Run these 6 quality checks:
1. Title has 6+ words AND is keyword-rich and appealing to the target audience
2. Subtitle is present AND is a compelling benefit statement (8+ words)
3. Back description has 80+ words AND is compelling sales copy (no placeholder text)
4. Puzzle count is 50 or more
5. Exactly 7 keywords provided
6. No placeholder or generic text detected in title, subtitle, or description

Return ONLY JSON (no markdown):
{
  "passed": true,
  "issues": [],
  "needs_revision": false
}

Or if there are issues:
{
  "passed": false,
  "issues": [
    {"field": "title", "problem": "Title only has 4 words", "fix": "Expand title to at least 6 descriptive words with target keywords"},
    {"field": "backDescription", "problem": "Description is only 45 words", "fix": "Expand to 100+ words with emotional benefits and reader value"}
  ],
  "needs_revision": true
}

Be strict but fair. Only flag genuine issues that would hurt sales or violate KDP guidelines.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text) throw new Error("QA Reviewer returned empty response");
  const raw = parseModelJson(text);
  const llmResult = QAResultSchema.parse(raw);

  // Merge deterministic cover diversity issue with LLM results
  if (coverDiversityIssue) {
    llmResult.issues = [coverDiversityIssue, ...llmResult.issues];
    llmResult.passed = false;
    llmResult.needs_revision = true;
  }

  return llmResult;
}

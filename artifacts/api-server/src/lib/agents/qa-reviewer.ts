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
  hookSentence?: string;
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

  // ── Deterministic pre-checks (run before LLM) ─────────────────────────────

  const deterministicIssues: QAIssue[] = [];

  // Check 7: Cover combination uniqueness (3-field: theme+coverStyle+niche)
  if (spec.coverCombo && spec.usedCombos && spec.usedCombos.length > 0) {
    if (spec.usedCombos.includes(spec.coverCombo)) {
      deterministicIssues.push({
        field: "cover_combination",
        problem: `Cover combination "${spec.coverCombo}" (theme+coverStyle+niche) is already used by another book in your library`,
        fix: `Select a different theme+style — currently used combos: ${spec.usedCombos.join(", ")}`,
      });
    }
  }

  // Check 8: Cover image present — AI-generated cover strongly recommended for conversion
  if (!spec.hasImage) {
    deterministicIssues.push({
      field: "cover_image",
      problem: "No AI-generated cover image — books without a custom cover image have significantly lower click-through rates on Amazon",
      fix: "Ensure the AI cover art generation step succeeds; retry if it failed",
    });
  }

  // Check 9: Hook sentence quality — must be present, 8+ words, and end with punctuation
  if (!spec.hookSentence || spec.hookSentence.trim().length === 0) {
    deterministicIssues.push({
      field: "hook_sentence",
      problem: "Back-cover hook sentence is missing — a compelling opening line is essential for conversion",
      fix: "Add a 10-15 word hook sentence that speaks directly to the buyer's primary emotion and desire",
    });
  } else {
    const hookWords = spec.hookSentence.trim().split(/\s+/).filter(Boolean).length;
    const endsWithPunctuation = /[.!?]$/.test(spec.hookSentence.trim());
    if (hookWords < 8 || !endsWithPunctuation) {
      deterministicIssues.push({
        field: "hook_sentence",
        problem: hookWords < 8
          ? `Hook sentence is only ${hookWords} words — must be 8+ words to be compelling`
          : "Hook sentence does not end with proper punctuation (. ! ?) — required for professional back cover",
        fix: "Rewrite the hook sentence to be 10-15 words, emotionally engaging, and properly punctuated",
      });
    }
  }

  // Check 10: Title keyword position — puzzle-type keyword must appear in the first 4 words
  if (spec.keywords.length > 0) {
    const titleWords = spec.title.trim().split(/\s+/);
    const first4 = titleWords.slice(0, 4).join(" ").toLowerCase();
    const puzzleTypeWords = (spec.keywords[0] || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const keywordInFirst4 = puzzleTypeWords.some(kw => first4.includes(kw));
    if (!keywordInFirst4) {
      deterministicIssues.push({
        field: "title_keyword",
        problem: `Primary keyword "${spec.keywords[0]}" does not appear in the first 4 words of the title — Amazon weights early keyword position heavily for search ranking`,
        fix: `Move the primary keyword to the beginning of the title (first 3-4 words) for maximum SEO impact`,
      });
    }
  }

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

Run these 6 quality checks (checks 7-10 are pre-evaluated deterministically; LLM reviews checks 1-6 only):
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

  // Merge deterministic issues with LLM results
  // Deterministic issues always take precedence (prepended)
  if (deterministicIssues.length > 0) {
    llmResult.issues = [...deterministicIssues, ...llmResult.issues];
    // cover_combination and hook_sentence require revision; cover_image and title_keyword are advisory
    const blockingFields = new Set(["cover_combination", "hook_sentence"]);
    const hasBlocker = deterministicIssues.some(i => blockingFields.has(i.field));
    if (hasBlocker) {
      llmResult.passed = false;
      llmResult.needs_revision = true;
    }
  }

  return llmResult;
}

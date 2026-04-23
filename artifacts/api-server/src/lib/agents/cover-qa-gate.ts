/**
 * Cover QA Gate.
 *
 * Runs a heuristic pre-flight over a cover's inputs (no rendering required)
 * and flags every issue that would hurt Amazon ranking, thumbnail legibility,
 * or KDP acceptance.  When a rendered image is provided, optionally runs a
 * multimodal Claude vision critic for final review.
 *
 * Design: heuristic gate is pure TS, cheap, synchronous. Visual critic is
 * an opt-in second pass that costs money — callers decide when to use it.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type QASeverity = "fail" | "warn" | "info";

export interface QAIssue {
  code: string;
  severity: QASeverity;
  message: string;
  recommendation?: string;
}

export interface QAResult {
  passed: boolean; // true iff no "fail"-severity issues
  score: number;   // 0-100
  issues: QAIssue[];
  summary: string;
}

export interface QAInput {
  title?: string;
  subtitle?: string;
  author?: string;
  backDescription?: string;
  puzzleType?: string;
  puzzleCount?: number;
  difficulty?: string;
  theme?: string;
  coverStyle?: string;
  experienceMode?: string;
  keywords?: string[];
  volumeNumber?: number;
  largePrint?: boolean;
  coverImageUrl?: string;
  accentHexOverride?: string;
  totalPages?: number;
  paperType?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// WCAG contrast — per W3C formulas
// ────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(c: { r: number; g: number; b: number }): number {
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return 0;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Theme palette mirror — kept in sync with html-builders.THEMES
const THEME_COLORS: Record<string, { bg: string; ac: string }> = {
  midnight:  { bg: "#0D1B3E", ac: "#F5C842" },
  forest:    { bg: "#1A3C1A", ac: "#6DCC50" },
  crimson:   { bg: "#280808", ac: "#FF3838" },
  ocean:     { bg: "#C8E8F8", ac: "#1565A8" },
  violet:    { bg: "#180635", ac: "#C060FF" },
  slate:     { bg: "#252E3A", ac: "#FF8C38" },
  sunrise:   { bg: "#FDF0E0", ac: "#D44000" },
  teal:      { bg: "#062020", ac: "#18D0A0" },
  parchment: { bg: "#F5E4C0", ac: "#7B3A00" },
  sky:       { bg: "#E0EFFF", ac: "#2050B8" },
};

const VALID_EXPERIENCE_MODES = new Set([
  "standard",
  "sketch",
  "detective",
  "adventure",
  "darkacademia",
  "cozycottage",
  "mindful",
]);

// ────────────────────────────────────────────────────────────────────────────
// Heuristic QA gate
// ────────────────────────────────────────────────────────────────────────────

export function runCoverQAGate(input: QAInput): QAResult {
  const issues: QAIssue[] = [];
  const title = (input.title || "").trim();
  const subtitle = (input.subtitle || "").trim();
  const author = (input.author || "").trim();
  const backDesc = (input.backDescription || "").trim();

  // ── Title legibility ──────────────────────────────────────────────────
  const titleWords = title ? title.split(/\s+/).length : 0;
  if (titleWords === 0) {
    issues.push({
      code: "title.missing",
      severity: "fail",
      message: "Title is empty.",
      recommendation: "Every book requires a title.",
    });
  } else if (titleWords > 12) {
    issues.push({
      code: "title.too-long",
      severity: "fail",
      message: `Title has ${titleWords} words — thumbnails become illegible beyond 12.`,
      recommendation: "Shorten the title or move detail into the subtitle.",
    });
  } else if (titleWords > 8) {
    issues.push({
      code: "title.long",
      severity: "warn",
      message: `Title has ${titleWords} words — legibility at thumbnail scale is borderline.`,
    });
  }
  if (title.length > 80) {
    issues.push({
      code: "title.chars-long",
      severity: "warn",
      message: `Title is ${title.length} characters. Amazon truncates titles past ~60 chars in some lists.`,
    });
  }

  // ── Subtitle ──────────────────────────────────────────────────────────
  const subtitleWords = subtitle ? subtitle.split(/\s+/).length : 0;
  if (subtitleWords > 20) {
    issues.push({
      code: "subtitle.too-long",
      severity: "warn",
      message: `Subtitle is ${subtitleWords} words — aim for 12 or fewer for impact.`,
    });
  }

  // ── Author ────────────────────────────────────────────────────────────
  if (!author) {
    issues.push({
      code: "author.missing",
      severity: "fail",
      message: "Author name is empty.",
      recommendation: "Set an author pen name — Amazon's algorithm rewards coherent author pages.",
    });
  } else if (author.length < 5) {
    issues.push({
      code: "author.short",
      severity: "warn",
      message: `Author name "${author}" is unusually short for a puzzle-book brand.`,
    });
  }

  // ── Back description ─────────────────────────────────────────────────
  if (backDesc.length < 120) {
    issues.push({
      code: "backdesc.too-short",
      severity: "fail",
      message: `Back description is only ${backDesc.length} characters. Amazon listings under ~120 chars look abandoned.`,
      recommendation: "Use the auto-template or AI blurb generator.",
    });
  } else if (backDesc.length < 300) {
    issues.push({
      code: "backdesc.short",
      severity: "info",
      message: `Back description is ${backDesc.length} characters. Top-10 puzzle books average 400-800.`,
    });
  }

  // ── Contrast (WCAG) ──────────────────────────────────────────────────
  const theme = (input.theme || "midnight").toLowerCase();
  const themeColors = THEME_COLORS[theme] || THEME_COLORS.midnight;
  const bg = themeColors.bg;
  const ac = input.accentHexOverride || themeColors.ac;
  const cRatio = contrastRatio(ac, bg);
  if (cRatio < 3) {
    issues.push({
      code: "contrast.fail",
      severity: "fail",
      message: `Accent/background contrast ratio is ${cRatio.toFixed(2)} — text will be unreadable.`,
      recommendation: "Override the accent hex with a higher-contrast colour.",
    });
  } else if (cRatio < 4.5) {
    issues.push({
      code: "contrast.marginal",
      severity: "warn",
      message: `Accent/background contrast is ${cRatio.toFixed(2)}. WCAG AA requires 4.5 for body text.`,
    });
  }

  // ── Puzzle count ─────────────────────────────────────────────────────
  const pc = input.puzzleCount ?? 100;
  if (pc < 20) {
    issues.push({
      code: "puzzle-count.low",
      severity: "fail",
      message: `${pc} puzzles — books under 20 look low-value and rarely rank.`,
      recommendation: "Aim for 100+ puzzles. Mixed-format compilers can reach 200 without feeling padded.",
    });
  } else if (pc < 50) {
    issues.push({
      code: "puzzle-count.thin",
      severity: "warn",
      message: `${pc} puzzles is thin for a puzzle book. Competitors average 100-300.`,
    });
  }

  // ── Keywords — 7 KDP slots ──────────────────────────────────────────
  const keywords = input.keywords || [];
  if (keywords.length === 0) {
    issues.push({
      code: "keywords.missing",
      severity: "fail",
      message: "No KDP backend keywords set. This is 7 free ranking slots left empty.",
      recommendation: "Run the Listing Intelligence agent or fill manually.",
    });
  } else if (keywords.length < 7) {
    issues.push({
      code: "keywords.under-7",
      severity: "warn",
      message: `Only ${keywords.length} of 7 KDP keyword slots used.`,
    });
  }

  // ── Volume range ─────────────────────────────────────────────────────
  const vn = input.volumeNumber ?? 0;
  if (vn < 0 || vn > 10) {
    issues.push({
      code: "volume.out-of-range",
      severity: "warn",
      message: `Volume number ${vn} is outside the typical 0-10 series range.`,
    });
  }

  // ── Experience mode validation ──────────────────────────────────────
  const em = (input.experienceMode || "standard").toLowerCase();
  if (!VALID_EXPERIENCE_MODES.has(em)) {
    issues.push({
      code: "experience-mode.unknown",
      severity: "warn",
      message: `Experience mode "${em}" is not recognized; cover will render as standard.`,
    });
  }

  // ── Spine readability ───────────────────────────────────────────────
  const tp = input.totalPages ?? 0;
  if (tp > 0 && tp < 130) {
    issues.push({
      code: "spine.too-thin",
      severity: "info",
      message: `With ${tp} pages the spine is too thin for rotated text (KDP minimum ~130 pages).`,
    });
  }

  // ── Image source safety ─────────────────────────────────────────────
  const url = input.coverImageUrl || "";
  if (url && !url.startsWith("data:") && !/^https?:\/\//i.test(url)) {
    issues.push({
      code: "image.unsafe",
      severity: "fail",
      message: "Cover image URL is not a valid http(s) or data: URL.",
      recommendation: "Regenerate via Gemini or paste a full https://... URL.",
    });
  }

  // ── Score ────────────────────────────────────────────────────────────
  let score = 100;
  for (const i of issues) {
    score -= i.severity === "fail" ? 20 : i.severity === "warn" ? 5 : 1;
  }
  score = Math.max(0, Math.min(100, score));

  const failCount = issues.filter(i => i.severity === "fail").length;
  const warnCount = issues.filter(i => i.severity === "warn").length;
  const passed = failCount === 0;

  const summary = passed
    ? `Cover QA passed with score ${score}/100 (${warnCount} warnings).`
    : `Cover QA FAILED with ${failCount} blocker${failCount === 1 ? "" : "s"} and ${warnCount} warning${warnCount === 1 ? "" : "s"} — score ${score}/100.`;

  return { passed, score, issues, summary };
}

// ────────────────────────────────────────────────────────────────────────────
// Optional multimodal critic — Claude Sonnet 4.5 with vision
// ────────────────────────────────────────────────────────────────────────────

export interface VisualCriticResult {
  thumbnailLegible: boolean;
  contrastOk: boolean;
  textInSafeZones: boolean;
  genreFingerprintClear: boolean;
  narrative: string;
  suggestedFix?: string;
}

/**
 * Runs a vision model over a rendered cover image (PNG/JPEG/WebP base64) and
 * returns a 4-point verdict + narrative. Use this after a Gemini regeneration
 * or after compositing the final cover PDF to a preview image.
 */
export async function runVisualCoverCritic(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  context?: { title?: string; experienceMode?: string; puzzleType?: string },
): Promise<VisualCriticResult> {
  const ctx = context || {};
  const prompt = `You are the art director for a KDP puzzle-book publisher. Examine this rendered cover and answer four yes/no questions plus a short narrative.

Book context:
- Title: ${ctx.title || "(not supplied)"}
- Puzzle type: ${ctx.puzzleType || "(not supplied)"}
- Experience mode: ${ctx.experienceMode || "standard"}

Return strict JSON only (no markdown, no commentary):
{
  "thumbnailLegible": <boolean — can you read the title if this cover is shown at 150px wide in an Amazon result?>,
  "contrastOk": <boolean — is the contrast between title text and its immediate background sufficient?>,
  "textInSafeZones": <boolean — is every important text element at least 0.25in from every trim edge?>,
  "genreFingerprintClear": <boolean — does this cover clearly signal "puzzle book" at a glance?>,
  "narrative": "2-3 sentences on what's strong and what's weak",
  "suggestedFix": "one-sentence concrete fix, or empty string if the cover is fine"
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const parsed: Record<string, unknown> =
    start !== -1 && end !== -1 ? JSON.parse(cleaned.slice(start, end + 1)) : {};

  return {
    thumbnailLegible: Boolean(parsed.thumbnailLegible),
    contrastOk: Boolean(parsed.contrastOk),
    textInSafeZones: Boolean(parsed.textInSafeZones),
    genreFingerprintClear: Boolean(parsed.genreFingerprintClear),
    narrative: String(parsed.narrative || ""),
    suggestedFix: parsed.suggestedFix ? String(parsed.suggestedFix) : undefined,
  };
}

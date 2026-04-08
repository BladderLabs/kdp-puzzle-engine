import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, booksTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { listNiches } from "../../lib/niches";

const router: IRouter = Router();

export interface SeriesGap {
  seriesName: string;
  existingVolumes: number[];
  nextVolume: number;
  latestBook: {
    title: string;
    niche: string | null;
    puzzleType: string;
    theme: string;
    coverStyle: string;
  };
}

export interface LibrarySuggestion {
  type: "series_gap" | "niche_gap" | "cover_diversity";
  brief: string;
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  theme: string;
  coverStyle: string;
  rationale: string;
  seriesName?: string;
  volumeNumber?: number;
}

export interface LibraryAnalysis {
  totalBooks: number;
  usedCombos: string[];
  seriesGaps: SeriesGap[];
  nicheGaps: string[];
  suggestions: LibrarySuggestion[];
}

// ── Zod schema for LLM suggestion validation ─────────────────────────────────
const LibrarySuggestionSchema = z.object({
  type: z.enum(["series_gap", "niche_gap", "cover_diversity"]),
  brief: z.string().min(10),
  niche: z.string().min(1),
  nicheLabel: z.string().min(1),
  puzzleType: z.string().min(1),
  theme: z.string().min(1),
  coverStyle: z.string().min(1),
  rationale: z.string().min(10),
  seriesName: z.string().optional(),
  volumeNumber: z.number().int().positive().optional(),
});

function comboKey(theme: string, coverStyle: string, niche: string | null): string {
  return `${theme}+${coverStyle}+${niche ?? "general"}`;
}

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  const os = cleaned.indexOf("{");
  const oe = cleaned.lastIndexOf("}");
  if (os !== -1 && oe !== -1) return JSON.parse(cleaned.slice(os, oe + 1));
  return JSON.parse(cleaned);
}

router.get("/library/analysis", async (req, res) => {
  try {
    const books = await db.select().from(booksTable);

    // ── 1. Compute used combos (theme+coverStyle+niche) ───────────────────────
    const usedCombos = [...new Set(books.map(b => comboKey(b.theme, b.coverStyle, b.niche)))];

    // ── 2. Series analysis ────────────────────────────────────────────────────
    const seriesMap = new Map<string, typeof books>();
    for (const book of books) {
      if (book.seriesName) {
        const arr = seriesMap.get(book.seriesName) ?? [];
        arr.push(book);
        seriesMap.set(book.seriesName, arr);
      }
    }

    const seriesGaps: SeriesGap[] = [];
    for (const [name, vols] of seriesMap) {
      const volNums = vols.map(v => v.volumeNumber).sort((a, b) => a - b);
      const maxVol = Math.max(...volNums);
      // Series with < 3 volumes still have clear growth runway
      if (maxVol < 3) {
        const latest = vols.find(v => v.volumeNumber === maxVol) ?? vols[0];
        seriesGaps.push({
          seriesName: name,
          existingVolumes: volNums,
          nextVolume: maxVol + 1,
          latestBook: {
            title: latest.title,
            niche: latest.niche,
            puzzleType: latest.puzzleType,
            theme: latest.theme,
            coverStyle: latest.coverStyle,
          },
        });
      }
    }
    // Prioritise series with fewest volumes
    seriesGaps.sort((a, b) => a.existingVolumes.length - b.existingVolumes.length);

    // ── 3. Niche gaps ─────────────────────────────────────────────────────────
    const nicheKeys = new Set(listNiches().map(n => n.key));
    const usedNiches = new Set(books.map(b => b.niche).filter(Boolean));
    const nicheGaps = [...nicheKeys].filter(k => !usedNiches.has(k));

    // ── 4. Generate suggestions via LLM ───────────────────────────────────────
    const ALL_THEMES = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
    const ALL_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth", "photo"];
    const nicheList = listNiches().map(n => `${n.key} (${n.label}, ${n.puzzleType})`).join(", ");

    const libraryContext = books.length === 0
      ? "The library is empty — no books published yet."
      : `Library has ${books.length} book(s):\n` +
        books.slice(0, 10).map(b =>
          `- "${b.title}" | niche: ${b.niche ?? "none"} | ${b.puzzleType} | ${b.theme}/${b.coverStyle}` +
          (b.seriesName ? ` | series: "${b.seriesName}" vol ${b.volumeNumber}` : "")
        ).join("\n") +
        (books.length > 10 ? `\n... and ${books.length - 10} more` : "");

    const usedComboContext = usedCombos.length > 0
      ? `\nCover combos already in use (theme+coverStyle+niche — you MUST pick a different combination): ${usedCombos.join(", ")}`
      : "\nNo cover combos in use yet.";

    const seriesContext = seriesGaps.length > 0
      ? `\nSeries that can grow: ${seriesGaps.map(s => `"${s.seriesName}" (vol ${s.existingVolumes.join(",")}, next: ${s.nextVolume})`).join("; ")}`
      : "";

    const nicheGapContext = nicheGaps.length > 0
      ? `\nNiches with no books yet: ${nicheGaps.slice(0, 10).join(", ")}`
      : "";

    const prompt = `You are an expert Amazon KDP puzzle book portfolio strategist.

Current library state:
${libraryContext}${usedComboContext}${seriesContext}${nicheGapContext}

Available niches: ${nicheList}
Available themes: ${ALL_THEMES.join(", ")}
Available cover styles: ${ALL_STYLES.join(", ")}

Generate exactly 4 specific "next book" opportunity cards ranked by revenue potential. Mix types:
- 1-2 series continuation opportunities (if series exist)
- 1-2 niche gap opportunities (untapped niches)
- 1 cover diversity opportunity (different visual theme)

For each card return:
{
  "type": "series_gap" | "niche_gap" | "cover_diversity",
  "brief": "A specific 1-sentence book idea that can be used as a pipeline brief",
  "niche": "exact niche key from the list",
  "nicheLabel": "human label",
  "puzzleType": "Word Search | Sudoku | Maze | Number Search | Cryptogram | Crossword",
  "theme": "exact theme key",
  "coverStyle": "exact style key",
  "rationale": "1-2 sentences: why this opportunity, what differentiation",
  "seriesName": "series name if type=series_gap else omit",
  "volumeNumber": 2
}

CRITICAL: the theme+coverStyle+niche combination must NOT already be in the used combos list above.
Return ONLY a JSON array of 4 objects. No markdown, no explanation.`;

    let suggestions: LibrarySuggestion[] = [];
    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "[]";
      const raw = parseModelJson(text);
      // Validate each suggestion via Zod schema — drop malformed items to guarantee card shape
      if (Array.isArray(raw)) {
        suggestions = raw
          .map((item: unknown) => LibrarySuggestionSchema.safeParse(item))
          .filter(r => r.success)
          .map(r => (r as z.SafeParseSuccess<LibrarySuggestion>).data)
          .slice(0, 5);
      }
    } catch (err) {
      req.log.warn({ err }, "Library analysis LLM failed — returning structural data only");
    }

    // Fallback suggestions if LLM fails or library empty — de-duplicated against usedCombos
    if (suggestions.length === 0) {
      const FALLBACK_THEMES = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "sunrise", "teal", "parchment", "sky"];
      const FALLBACK_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth"];
      const allNiches = listNiches();
      const topMissing = allNiches.filter(n => !usedNiches.has(n.key)).slice(0, 3);
      suggestions = topMissing.map(n => {
        // Pick first theme+style combo not already in usedCombos for this niche
        let theme = "midnight";
        let coverStyle = "classic";
        outer: for (const t of FALLBACK_THEMES) {
          for (const s of FALLBACK_STYLES) {
            if (!usedCombos.includes(`${t}+${s}+${n.key}`)) {
              theme = t;
              coverStyle = s;
              break outer;
            }
          }
        }
        return {
          type: "niche_gap" as const,
          brief: `${n.label} ${n.puzzleType} book — large print, 100 puzzles`,
          niche: n.key,
          nicheLabel: n.label,
          puzzleType: n.puzzleType,
          theme,
          coverStyle,
          rationale: `The ${n.label} niche has no books in your library yet — a clear gap with proven demand.`,
        };
      });
    }

    const analysis: LibraryAnalysis = {
      totalBooks: books.length,
      usedCombos,
      seriesGaps: seriesGaps.slice(0, 5),
      nicheGaps: nicheGaps.slice(0, 10),
      suggestions,
    };

    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Library analysis failed");
    res.status(500).json({ error: "Library analysis failed" });
  }
});

export default router;

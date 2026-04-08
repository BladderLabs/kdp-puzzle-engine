import { Router, type IRouter } from "express";
import { zipSync } from "fflate";
import { GenerateBookBody, PreviewPuzzlesBody, CoverPreviewBody } from "@workspace/api-zod";
import { buildInteriorHTML, buildCoverHTML, computeTotalPages, type BuildOpts, type CoverBuildOpts } from "../lib/html-builders";
import { makeWordSearch, makeSudoku, makeMaze, makeNumberSearch, makeCryptogram, makeCrossword, shuf, DEFWORDS } from "../lib/puzzles";
import { htmlToPdf } from "../lib/pdf";

const router: IRouter = Router();

function toOpts(data: ReturnType<typeof GenerateBookBody.parse>): CoverBuildOpts {
  return {
    title: data.title,
    subtitle: data.subtitle ?? undefined,
    author: data.author ?? undefined,
    puzzleType: data.puzzleType ?? "Word Search",
    puzzleCount: data.puzzleCount ?? 100,
    difficulty: data.difficulty ?? "Medium",
    largePrint: data.largePrint === true,
    paperType: data.paperType ?? "white",
    theme: data.theme ?? "midnight",
    coverStyle: data.coverStyle ?? "classic",
    backDescription: data.backDescription ?? undefined,
    words: Array.isArray(data.words) ? (data.words as string[]) : [],
    wordCategory: data.wordCategory ?? undefined,
    volumeNumber: data.volumeNumber ?? 0,
    coverImageUrl: data.coverImageUrl,
    dedication: data.dedication ?? undefined,
    difficultyMode: data.difficultyMode ?? "uniform",
    challengeDays: data.challengeDays ?? undefined,
    keywords: data.keywords ?? [],
    accentHexOverride: data.accentHexOverride ?? undefined,
    casingOverride: data.casingOverride ?? undefined,
    fontStyleDirective: data.fontStyleDirective ?? undefined,
  };
}

/**
 * POST /generate
 * Step 1 of the spec flow — generates all puzzles, builds HTML for both interior
 * and cover. Returns the HTML strings and dimensions. No PDF rendering happens here.
 * The client then calls /pdf/interior and /pdf/cover with the returned HTML.
 */
router.post("/generate", async (req, res) => {
  try {
    const opts = toOpts(GenerateBookBody.parse(req.body));
    const interior = buildInteriorHTML(opts);
    const cover = buildCoverHTML(opts, interior.totalPages);
    res.json({
      interiorHtml: interior.html,
      totalPages: interior.totalPages,
      interiorDims: { trimW: interior.trimW, trimH: interior.trimH },
      coverHtml: cover.html,
      coverDims: {
        fullW: cover.fullW,
        fullH: cover.fullH,
        spineW: cover.spineW,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate book");
    res.status(400).json({ error: "Failed to generate book" });
  }
});

/**
 * POST /pdf/interior
 * Step 2 of the spec flow — accepts { html, width, height } and renders to PDF.
 * Also accepts full book opts (legacy / direct-render path) for backwards compat.
 */
router.post("/pdf/interior", async (req, res) => {
  try {
    let html: string;
    let w: number;
    let h: number;

    if (typeof req.body.html === "string") {
      // Spec flow: client already has the HTML from /generate
      html = req.body.html;
      w = typeof req.body.width === "number" && req.body.width > 0 ? req.body.width : 8.5;
      h = typeof req.body.height === "number" && req.body.height > 0 ? req.body.height : 11;
      req.log.info(`Rendering interior PDF from HTML blob: ${w}"x${h}"`);
    } else {
      // Legacy / direct path: regenerate from opts
      const opts = toOpts(GenerateBookBody.parse(req.body));
      const interior = buildInteriorHTML(opts);
      html = interior.html;
      w = interior.trimW;
      h = interior.trimH;
      req.log.info(`Rendering interior PDF (direct): ${interior.totalPages} pages, ${w}"x${h}"`);
    }

    const pdf = await htmlToPdf(html, w, h);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="interior.pdf"',
      "Content-Length": pdf.length.toString(),
    });
    res.send(pdf);
  } catch (err) {
    req.log.error({ err }, "Failed to render interior PDF");
    res.status(500).json({ error: "Failed to render interior PDF" });
  }
});

/**
 * POST /pdf/cover
 * Step 3 of the spec flow — accepts { html, fullW, fullH } and renders to PDF.
 * Also accepts full book opts (legacy / direct-render path) for backwards compat.
 */
router.post("/pdf/cover", async (req, res) => {
  try {
    let html: string;
    let fullW: number;
    let fullH: number;

    if (typeof req.body.html === "string") {
      // Spec flow: client already has the HTML from /generate
      html = req.body.html;
      fullW = typeof req.body.fullW === "number" && req.body.fullW > 0 ? req.body.fullW : 17.562;
      fullH = typeof req.body.fullH === "number" && req.body.fullH > 0 ? req.body.fullH : 11.25;
      req.log.info(`Rendering cover PDF from HTML blob: ${fullW.toFixed(3)}"x${fullH.toFixed(3)}"`);
    } else {
      // Legacy / direct path: regenerate from opts
      const opts = toOpts(GenerateBookBody.parse(req.body));
      const totalPages = computeTotalPages(opts);
      const cover = buildCoverHTML(opts, totalPages);
      html = cover.html;
      fullW = cover.fullW;
      fullH = cover.fullH;
      req.log.info(`Rendering cover PDF (direct): ${fullW.toFixed(3)}"x${fullH.toFixed(3)}"`);
    }

    const pdf = await htmlToPdf(html, fullW, fullH, 300);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="cover.pdf"',
      "Content-Length": pdf.length.toString(),
    });
    res.send(pdf);
  } catch (err) {
    req.log.error({ err }, "Failed to render cover PDF");
    res.status(500).json({ error: "Failed to render cover PDF" });
  }
});

/**
 * POST /cover-preview
 * Lightweight cover HTML generation for live browser preview.
 * No puzzle generation needed — accepts cosmetic fields only.
 */
router.post("/cover-preview", (req, res) => {
  try {
    const b = CoverPreviewBody.parse(req.body);
    const opts: CoverBuildOpts = {
      title: b.title,
      subtitle: b.subtitle ?? undefined,
      author: b.author ?? undefined,
      puzzleType: b.puzzleType ?? "Word Search",
      puzzleCount: b.puzzleCount ?? 100,
      difficulty: b.difficulty ?? "Medium",
      largePrint: b.largePrint === true,
      paperType: b.paperType ?? "white",
      theme: b.theme ?? "midnight",
      coverStyle: b.coverStyle ?? "classic",
      backDescription: b.backDescription ?? undefined,
      series: b.series ?? undefined,
      volumeNumber: b.volumeNumber ?? 0,
      coverImageUrl: b.coverImageUrl ?? undefined,
    };
    const totalPages = computeTotalPages(opts);
    const cover = buildCoverHTML(opts, totalPages);
    res.json({ html: cover.html, coverDims: { fullW: cover.fullW, fullH: cover.fullH, spineW: cover.spineW } });
  } catch (err) {
    req.log.error({ err }, "Failed to generate cover preview");
    res.status(400).json({ error: "Failed to generate cover preview" });
  }
});

router.post("/puzzles/preview", (req, res) => {
  try {
    const data = PreviewPuzzlesBody.parse(req.body);
    const pt = (data.puzzleType as string) || "Word Search";
    const diff = (data.difficulty as string) || "Medium";
    const lp = data.largePrint === true;
    const rawWords = Array.isArray(data.words) ? (data.words as string[]) : [];
    const words = rawWords.filter(w => w.trim().length >= 3);
    const count = Math.min((data.count as number) || 2, 3);
    const gsz = lp ? 13 : 15;

    const puzzles = [];
    for (let i = 0; i < count; i++) {
      if (pt === "Word Search") {
        const bank = words.length >= 5 ? shuf(words).slice(0, Math.min(words.length, lp ? 16 : 20)) : DEFWORDS.slice(0, 16);
        puzzles.push({ type: "Word Search", wordSearch: makeWordSearch(bank, gsz) });
      } else if (pt === "Sudoku") {
        puzzles.push({ type: "Sudoku", sudoku: makeSudoku(diff) });
      } else if (pt === "Maze") {
        puzzles.push({ type: "Maze", maze: makeMaze(lp ? 12 : 15, lp ? 12 : 15) });
      } else if (pt === "Number Search") {
        puzzles.push({ type: "Number Search", numberSearch: makeNumberSearch(gsz) });
      } else if (pt === "Cryptogram") {
        puzzles.push({ type: "Cryptogram", cryptogram: makeCryptogram() });
      } else if (pt === "Crossword") {
        const bank = words.length >= 5 ? shuf(words).slice(0, 20) : DEFWORDS.slice(0, 20);
        puzzles.push({ type: "Crossword", crossword: makeCrossword(bank, lp ? 11 : 13) });
      }
    }
    res.json({ puzzles, puzzleType: pt });
  } catch (err) {
    req.log.error({ err }, "Failed to generate preview");
    res.status(400).json({ error: "Failed to generate preview" });
  }
});

/**
 * POST /bundle
 * Generates interior + cover PDFs and returns them as a ZIP archive.
 * Input: same body as /generate. Output: application/zip with interior.pdf and cover.pdf.
 */
router.post("/bundle", async (req, res) => {
  try {
    const opts = toOpts(GenerateBookBody.parse(req.body));
    const interior = buildInteriorHTML(opts);
    const cover = buildCoverHTML(opts, interior.totalPages);

    req.log.info(`Generating ZIP bundle: ${interior.totalPages} pages, ${interior.trimW}"×${interior.trimH}"`);

    const [interiorPdf, coverPdf] = await Promise.all([
      htmlToPdf(interior.html, interior.trimW, interior.trimH),
      htmlToPdf(cover.html, cover.fullW, cover.fullH),
    ]);

    const slug = opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

    const enc = new TextEncoder();
    const descTxt = enc.encode(
      [
        `TITLE: ${opts.title}`,
        opts.subtitle ? `SUBTITLE: ${opts.subtitle}` : "",
        opts.author ? `AUTHOR: ${opts.author}` : "",
        "",
        "=== BACK COVER DESCRIPTION (copy-paste into KDP) ===",
        "",
        opts.backDescription || "",
        "",
        "=== KDP UPLOAD NOTES ===",
        `Interior: B&W, ${opts.paperType} paper, ${opts.largePrint ? "8.5x11in" : "6x9in"}, No bleed`,
        `Puzzle type: ${opts.puzzleType}  |  Count: ${opts.puzzleCount}  |  Difficulty: ${opts.difficulty}`,
        "Low-content book: Yes",
        "AI disclosure: Yes (cover art may be AI-generated)",
        `Recommended price: $9.99 USD / £7.99 GBP`,
      ].filter(l => l !== undefined).join("\n")
    );

    const kwTxt = enc.encode(
      ((opts as Record<string, unknown>).keywords as string[] | undefined ?? [])
        .slice(0, 7)
        .join("\n") || `${opts.puzzleType.toLowerCase()} puzzle book\nlarge print puzzles\nbrain games for adults\npuzzle book gift\nword puzzle book\nactivity book for adults\npuzzle book for seniors`
    );

    const zipData = zipSync({
      [`${slug}-interior.pdf`]: [new Uint8Array(interiorPdf), { level: 0 }],
      [`${slug}-cover.pdf`]: [new Uint8Array(coverPdf), { level: 0 }],
      "listing-description.txt": [descTxt, { level: 6 }],
      "keywords.txt": [kwTxt, { level: 6 }],
    });

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-kdp-bundle.zip"`,
      "Content-Length": zipData.length.toString(),
    });
    res.send(Buffer.from(zipData));
  } catch (err) {
    req.log.error({ err }, "Failed to generate ZIP bundle");
    res.status(500).json({ error: "Failed to generate ZIP bundle" });
  }
});

export default router;

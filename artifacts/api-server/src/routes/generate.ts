import { Router, type IRouter } from "express";
import { GenerateBookBody, PreviewPuzzlesBody } from "@workspace/api-zod";
import { buildInteriorHTML, buildCoverHTML, computeTotalPages, type BuildOpts } from "../lib/html-builders";
import { makeWordSearch, makeSudoku, makeMaze, makeNumberSearch, makeCryptogram, shuf, DEFWORDS } from "../lib/puzzles";
import { htmlToPdf } from "../lib/pdf";

const router: IRouter = Router();

function toOpts(data: ReturnType<typeof GenerateBookBody.parse>): BuildOpts {
  return {
    title: data.title,
    subtitle: data.subtitle ?? undefined,
    author: data.author ?? undefined,
    puzzleType: data.puzzleType ?? "Word Search",
    puzzleCount: data.puzzleCount ?? 100,
    difficulty: data.difficulty ?? "Medium",
    largePrint: data.largePrint !== false,
    paperType: data.paperType ?? "white",
    theme: data.theme ?? "midnight",
    coverStyle: data.coverStyle ?? "classic",
    backDescription: data.backDescription ?? undefined,
    words: Array.isArray(data.words) ? (data.words as string[]) : [],
    volumeNumber: data.volumeNumber ?? 0,
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

    const pdf = await htmlToPdf(html, fullW, fullH);
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

router.post("/puzzles/preview", (req, res) => {
  try {
    const data = PreviewPuzzlesBody.parse(req.body);
    const pt = (data.puzzleType as string) || "Word Search";
    const diff = (data.difficulty as string) || "Medium";
    const lp = data.largePrint !== false;
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
      }
    }
    res.json({ puzzles, puzzleType: pt });
  } catch (err) {
    req.log.error({ err }, "Failed to generate preview");
    res.status(400).json({ error: "Failed to generate preview" });
  }
});

export default router;

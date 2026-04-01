import { Router, type IRouter } from "express";
import { GenerateBookBody, PreviewPuzzlesBody } from "@workspace/api-zod";
import { buildInteriorHTML, buildCoverHTML } from "../lib/html-builders";
import { makeWordSearch, makeSudoku, makeMaze, makeNumberSearch, makeCryptogram, shuf, DEFWORDS } from "../lib/puzzles";
import { htmlToPdf } from "../lib/pdf";

const router: IRouter = Router();

router.post("/generate", async (req, res) => {
  try {
    const data = GenerateBookBody.parse(req.body);
    const opts = {
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
      words: (data.words as string[] | undefined) ?? [],
      volumeNumber: data.volumeNumber ?? 1,
    };
    const interior = buildInteriorHTML(opts);
    const cover = buildCoverHTML(opts, interior.totalPages);
    res.json({
      interiorHtml: interior.html,
      totalPages: interior.totalPages,
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

router.post("/pdf/interior", async (req, res) => {
  try {
    const { html, pages } = req.body as { html: string; pages: number };
    if (!html) { res.status(400).json({ error: "html required" }); return; }
    req.log.info(`Rendering interior PDF: ${pages} pages`);
    const pdf = await htmlToPdf(html, 8.5, 11);
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

router.post("/pdf/cover", async (req, res) => {
  try {
    const { html, fullW, fullH } = req.body as { html: string; fullW: number; fullH: number };
    if (!html) { res.status(400).json({ error: "html required" }); return; }
    req.log.info(`Rendering cover PDF: ${fullW}x${fullH}`);
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
    const words = ((data.words as string[]) || DEFWORDS).filter(w => w.trim().length >= 3);
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

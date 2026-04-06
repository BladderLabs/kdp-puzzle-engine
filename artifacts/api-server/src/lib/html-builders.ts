import {
  shuf, makeWordSearch, makeSudoku, makeMaze, makeNumberSearch,
  makeCryptogramFromQuote, makeCrossword, WORD_BANKS, QUOTE_BANK,
} from "./puzzles";
import type { CrosswordResult, CrosswordClue } from "./puzzles";

/** Compute total page count from config without generating any puzzles. */
export function computeTotalPages(opts: BuildOpts): number {
  const PT = opts.puzzleType || "Word Search";
  const PC = opts.puzzleCount || 100;
  const LP = opts.largePrint !== false;
  const progressive = opts.difficultyMode === "progressive";
  const aPer = PT === "Word Search" ? (LP ? 4 : 6)
    : PT === "Sudoku" ? (LP ? 6 : 8)
    : PT === "Maze" ? (LP ? 4 : 6)
    : PT === "Number Search" ? (LP ? 9 : 12)
    : PT === "Crossword" ? (LP ? 4 : 6)
    : (LP ? 6 : 8);
  // Front matter: title(1) + htp(2) + toc(3)
  // Optional: dedication (+1), tracker (+1)
  // Section dividers: 3 pages in progressive mode when PC >= 30
  // Back matter: 4 notes pages (always) + answer key pages
  const frontMatter = 3 + (opts.dedication ? 1 : 0) + (opts.challengeDays ? 1 : 0);
  const dividers = progressive && PC >= 30 ? 3 : 0;
  return frontMatter + 4 + PC + Math.ceil(PC / aPer) + dividers;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function gutterIn(p: number): number {
  return p <= 150 ? 0.375 : p <= 300 ? 0.5 : p <= 500 ? 0.625 : 0.75;
}

export interface BuildOpts {
  title: string;
  subtitle?: string;
  author?: string;
  puzzleType?: string;
  puzzleCount?: number;
  difficulty?: string;
  largePrint?: boolean;
  paperType?: string;
  theme?: string;
  coverStyle?: string;
  backDescription?: string;
  words?: string[];
  wordCategory?: string;
  series?: string;
  volumeNumber?: number;
  dedication?: string;
  difficultyMode?: string;
  challengeDays?: number;
}

export interface BuildResult {
  html: string;
  totalPages: number;
  trimW: number;
  trimH: number;
}

export function buildInteriorHTML(opts: BuildOpts): BuildResult {
  const T = escapeHtml(opts.title);
  const ST = escapeHtml(opts.subtitle || "");
  const AU = escapeHtml(opts.author || "Eleanor Bennett");
  const PT = opts.puzzleType || "Word Search";
  const PC = opts.puzzleCount || 100;
  const DF = opts.difficulty || "Medium";
  const LP = opts.largePrint !== false;
  const yr = new Date().getFullYear();
  const vn = opts.volumeNumber ?? 0;
  const vol = vn === 1 ? "Volume 1 of 3" : vn === 2 ? "Volume 2 of 3" : vn === 3 ? "Volume 3 of 3" : "";

  const wpp = LP ? 20 : 25, gsz = LP ? 13 : 15;
  const wC = LP ? 52 : 33, wF = LP ? 22 : 17;
  // Sudoku cell size: 9×54=486px < 490px content (6in - 0.5in gut - 0.4in right = 5.1in = 490px)
  // 58px would produce 9×58=522px > 490px, overflowing KDP margins — 54px is the correct max.
  // LP: 9×64=576px < 730px content (8.5in - 0.5in - 0.4in = 7.6in = 730px) ✓
  const sC = LP ? 64 : 54, sF = LP ? 26 : 20;

  // Word bank priority: custom words (≥10) > wordCategory bank > General bank
  const customWords = opts.words && opts.words.length >= 10 ? opts.words : null;
  const categoryBank = opts.wordCategory && WORD_BANKS[opts.wordCategory] ? WORD_BANKS[opts.wordCategory] : null;
  const wordBank = customWords || categoryBank || WORD_BANKS.General;

  // Cryptogram: build a shuffled pool of quote indices for no-repeat sampling across the book
  let cryptoQuotePool = PT === "Cryptogram"
    ? shuf(Array.from({ length: QUOTE_BANK.length }, (_, i) => i))
    : [];
  let cryptoQIdx = 0;

  const puzzles: unknown[] = [];

  // In progressive mode: thirds are Easy / Medium / Hard
  // In uniform mode: all puzzles use the single selected DF
  const progressiveDiffs: string[] = [];
  if (opts.difficultyMode === "progressive") {
    const t1 = Math.round(PC / 3);
    const t2 = Math.round(2 * PC / 3);
    for (let i = 0; i < PC; i++) {
      progressiveDiffs.push(i < t1 ? "Easy" : i < t2 ? "Medium" : "Hard");
    }
  }

  const getPuzzleDiff = (i: number) => opts.difficultyMode === "progressive" ? progressiveDiffs[i] : DF;

  for (let i = 0; i < PC; i++) {
    const pDiff = getPuzzleDiff(i);
    switch (PT) {
      case "Word Search":
        puzzles.push(makeWordSearch(shuf(wordBank).slice(0, Math.min(wordBank.length, wpp)), gsz));
        break;
      case "Sudoku":
        puzzles.push(makeSudoku(pDiff));
        break;
      case "Maze":
        puzzles.push(makeMaze(LP ? 12 : 15, LP ? 12 : 15));
        break;
      case "Number Search":
        puzzles.push(makeNumberSearch(gsz, wordBank));
        break;
      case "Cryptogram": {
        if (cryptoQIdx >= cryptoQuotePool.length) {
          cryptoQuotePool = shuf(Array.from({ length: QUOTE_BANK.length }, (_, k) => k));
          cryptoQIdx = 0;
        }
        puzzles.push(makeCryptogramFromQuote(QUOTE_BANK[cryptoQuotePool[cryptoQIdx++]]));
        break;
      }
      case "Crossword":
        puzzles.push(makeCrossword(shuf(wordBank).slice(0, Math.min(wordBank.length, 20)), LP ? 11 : 13));
        break;
      default:
        puzzles.push(makeWordSearch(shuf(wordBank).slice(0, Math.min(wordBank.length, wpp)), gsz));
    }
  }

  const aPer = PT === "Word Search" ? (LP ? 4 : 6)
    : PT === "Sudoku" ? (LP ? 6 : 8)
    : PT === "Maze" ? (LP ? 4 : 6)
    : PT === "Number Search" ? (LP ? 9 : 12)
    : PT === "Crossword" ? (LP ? 4 : 6)
    : (LP ? 6 : 8); // Cryptogram

  // Physical trim size: Large Print = 8.5"x11", Standard = 6"x9"
  const trimW = LP ? 8.5 : 6;
  const trimH = LP ? 11 : 9;

  const progressive = opts.difficultyMode === "progressive";
  // Enrichment pack: section dividers appear in progressive mode for 30+ puzzle books
  const hasSections = progressive && PC >= 30;
  const sec1 = Math.round(PC / 3);
  const sec2 = Math.round(2 * PC / 3);

  const hasDedication = !!opts.dedication;
  const hasTracker = !!opts.challengeDays;
  const challengeDays = opts.challengeDays || 30;

  const aP = Math.ceil(PC / aPer);
  // Pages: title(1) + optional dedication + htp + toc + optional tracker + section dividers + PC + notes(4) + aP
  const frontMatter = 1 + (hasDedication ? 1 : 0) + 1 + 1 + (hasTracker ? 1 : 0);
  const totP = frontMatter + (hasSections ? 3 : 0) + PC + 4 + aP;
  const gut = Math.max(0.5, gutterIn(totP));
  // pS = first puzzle page (1-based); frontMatter pages + section divider 1 if hasSections
  const pS = frontMatter + (hasSections ? 1 : 0) + 1;
  // aS = answer key start page: right after puzzles + mid-book section dividers
  const aS = pS + PC + (hasSections ? 2 : 0);
  // puzzle page helper: accounts for section-divider pages inserted mid-book
  const puzzlePageOf = (i: number) => pS + i + (hasSections ? (i >= sec2 ? 2 : i >= sec1 ? 1 : 0) : 0);

  // Decorative rule between label and grid (shared across all puzzle types)
  const ornamentRule = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><div style="flex:1;height:1px;background:#ccc;"></div><div style="font-family:'Source Code Pro',monospace;font-size:10px;color:#aaa;">◆</div><div style="flex:1;height:1px;background:#ccc;"></div></div>`;

  // Per-puzzle progress indicator: difficulty dots + time estimate + checkbox
  const timeMap: Record<string, Record<string, string>> = {
    "Word Search":   { Easy: "~5 min",  Medium: "~10 min", Hard: "~20 min" },
    "Sudoku":        { Easy: "~10 min", Medium: "~20 min", Hard: "~40 min" },
    "Maze":          { Easy: "~3 min",  Medium: "~8 min",  Hard: "~15 min" },
    "Number Search": { Easy: "~5 min",  Medium: "~10 min", Hard: "~20 min" },
    "Cryptogram":    { Easy: "~3 min",  Medium: "~8 min",  Hard: "~15 min" },
    "Crossword":     { Easy: "~8 min",  Medium: "~15 min", Hard: "~30 min" },
  };
  const makeProgressBadge = (d: string) => {
    const dots = d === "Easy" ? "\u25CF\u25CF\u25CB\u25CB\u25CB"
      : d === "Hard" ? "\u25CF\u25CF\u25CF\u25CF\u25CF"
      : "\u25CF\u25CF\u25CF\u25CB\u25CB";
    const est = (timeMap[PT] || timeMap["Word Search"])[d] || "~10 min";
    return `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fafafa;"><span style="letter-spacing:3px;font-size:11px;color:#555;">${dots}</span><span style="font-size:9px;color:#777;font-family:'Source Code Pro',monospace;">${est}</span><span style="display:inline-block;width:12px;height:12px;border:1.5px solid #aaa;border-radius:2px;margin-left:2px;"></span></span>`;
  };

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${T}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">` +
    `<style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
    `@page{size:${trimW}in ${trimH}in;margin:0;}` +
    `@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}` +
    `.pg{width:${trimW}in;min-height:${trimH}in;page-break-after:always;position:relative;overflow:hidden;}` +
    `.pg:last-child{page-break-after:auto;}` +
    `.in{padding:0.55in 0.4in 0.6in ${gut}in;background:#fff;}` +
    `.hd{display:flex;justify-content:space-between;align-items:center;font-family:'Source Code Pro',monospace;font-size:8px;color:#666;padding-bottom:5px;margin-bottom:8px;border-bottom:1.5px solid #222;}` +
    `.hd-title{font-weight:600;color:#333;letter-spacing:0.5px;text-transform:uppercase;font-size:7px;}` +
    `.ft{position:absolute;bottom:0.25in;left:${gut}in;right:0.4in;display:flex;justify-content:space-between;align-items:center;font-family:'Source Code Pro',monospace;font-size:8px;color:#777;border-top:1px solid #ccc;padding-top:4px;}` +
    `.ft-pg{font-size:9px;font-weight:600;color:#444;letter-spacing:1px;}` +
    `</style></head><body>`;

  // ── Title page (redesigned) ──────────────────────────────────────────────
  html += `<div class="pg in"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${trimH}in;text-align:center;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:4px;color:#666;text-transform:uppercase;margin-bottom:16px;">${PT} Collection</div>` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:28px;color:#888;margin-bottom:14px;letter-spacing:6px;">✦</div>` +
    `<div style="font-family:Lora,serif;font-size:34px;font-weight:700;color:#222;margin-bottom:10px;">${T}</div>` +
    `<div style="font-family:Lora,serif;font-size:15px;font-style:italic;color:#555;margin-bottom:24px;">${ST}</div>` +
    `<div style="width:56px;height:1px;background:#ccc;margin-bottom:24px;"></div>` +
    (AU ? `<div style="font-family:Lora,serif;font-size:13px;color:#444;margin-bottom:4px;">${AU}</div>` : "") +
    `<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#999;margin-bottom:28px;">${AU ? AU + " Publishing" : "KDP Publishing"}</div>` +
    `<div style="width:36px;height:1px;background:#ddd;margin-bottom:28px;"></div>` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:7.5px;color:#999;line-height:2.1;max-width:4.5in;">` +
    `&copy; ${yr} ${AU}. All rights reserved.${vol ? " " + vol + "." : ""}<br/>` +
    `No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher.<br/>` +
    `ISBN: [Pending]<br/>` +
    `Published via Amazon KDP` +
    `</div>` +
    `</div></div>`;

  // ── Dedication page (optional) ────────────────────────────────────────────
  let currentPage = 2;
  if (hasDedication) {
    const escapedDedication = escapeHtml(opts.dedication!);
    html += `<div class="pg in"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${trimH}in;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:4px;color:#bbb;text-transform:uppercase;margin-bottom:28px;">Dedication</div>` +
      `<div style="width:40px;height:1px;background:#ddd;margin-bottom:28px;"></div>` +
      `<div style="font-family:Lora,serif;font-style:italic;font-size:15px;color:#555;line-height:1.9;max-width:3.5in;">` +
      escapedDedication +
      `</div>` +
      `<div style="width:40px;height:1px;background:#ddd;margin-top:28px;"></div>` +
      `</div><div class="ft"><span></span><span class="ft-pg">&mdash; ${currentPage} &mdash;</span></div></div>`;
    currentPage++;
  }

  // ── How-to-Play page ─────────────────────────────────────────────────────
  const htxtMap: Record<string, string> = {
    "Word Search": "Each puzzle contains a grid of letters with hidden words. Words can run horizontally, vertically, or diagonally — both forward and backward. Find every word in the bank below each grid.",
    "Sudoku": "Fill empty cells so every row, column, and 3&times;3 box contains digits 1-9 exactly once.",
    "Maze": "Find your way from the START (top-left) to the FINISH (bottom-right) by following open passages. No diagonal moves — up, down, left, right only.",
    "Number Search": "Find all the number sequences hidden in the grid. Numbers can run horizontally, vertically, or diagonally — both forward and backward.",
    "Cryptogram": "Each puzzle contains a famous quote encoded with a substitution cipher. Every letter has been replaced by a different letter. Decode the cipher to reveal the hidden message.",
    "Crossword": "Fill in the white squares using the numbered clues. Each number in a white square begins a word — solve the Across clues left-to-right and the Down clues top-to-bottom. Black squares separate words.",
  };
  const tipMap: Record<string, string> = {
    "Word Search": "Scan for uncommon letters like Q, Z, X first.",
    "Sudoku": "Write small pencil marks for candidates.",
    "Maze": "Try working backward from the finish for harder mazes.",
    "Number Search": "Look for repeated digits as anchors.",
    "Cryptogram": "Short words (A, I, THE, AND) reveal common patterns.",
    "Crossword": "Start with the shortest clues — 3-letter answers give you crossing letters that unlock longer words.",
  };
  const htxt = htxtMap[PT] || htxtMap["Word Search"];
  const tip = tipMap[PT] || tipMap["Word Search"];

  // Mini inline example per puzzle type (no external assets)
  let miniEx = "";
  const miniCellBase = `width:22px;height:22px;text-align:center;font-family:'Source Code Pro',monospace;font-size:10px;border:1px solid #ccc;color:#222;`;
  if (PT === "Word Search") {
    const wsRows = [["F","I","N","D","X"],["A","B","C","E","Y"],["Z","T","S","H","I"],["Q","U","V","W","K"],["L","M","O","P","R"]];
    const wsHi = new Set(["0,0","0,1","0,2","0,3"]);
    let wsTable = `<table style="border-collapse:collapse;margin:6px auto;">`;
    for (let r = 0; r < 5; r++) {
      wsTable += "<tr>";
      for (let c = 0; c < 5; c++) {
        const h = wsHi.has(`${r},${c}`);
        wsTable += `<td style="${miniCellBase}${h ? "background:#e8e8e0;font-weight:700;" : ""}">${wsRows[r][c]}</td>`;
      }
      wsTable += "</tr>";
    }
    wsTable += "</table>";
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Example — word "FIND" highlighted in row 1:</div>` +
      wsTable +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#777;margin-top:4px;">Highlighted letters spell F-I-N-D (left to right)</div>` +
      `</div>`;
  } else if (PT === "Sudoku") {
    // 2×2 mini demo (4-cell) showing the uniqueness constraint
    const sdRows = [[5,0],[0,9]];
    let sdTable = `<table style="border-collapse:collapse;margin:6px auto;">`;
    for (let r = 0; r < 2; r++) {
      sdTable += "<tr>";
      for (let c = 0; c < 2; c++) {
        const v = sdRows[r][c];
        sdTable += `<td style="width:32px;height:32px;text-align:center;font-family:'Source Code Pro',monospace;font-size:15px;border:2px solid #555;${v ? "font-weight:700;color:#111;background:#f5f5f0;" : "color:#bbb;"}">${v || "?"}</td>`;
      }
      sdTable += "</tr>";
    }
    sdTable += "</table>";
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Example — fill "?" so no digit repeats:</div>` +
      sdTable +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#777;margin-top:4px;">Each row, column, and 3×3 box must contain 1–9 once</div>` +
      `</div>`;
  } else if (PT === "Maze") {
    // Hardcoded 4×4 mini maze (bit-flags N=1 E=2 S=4 W=8) with shaded solution path
    const N2 = 1, E2 = 2, S2 = 4, W2 = 8;
    const mzMini = [[E2|S2,W2|S2,E2,W2|S2],[N2|E2,N2|W2|S2,E2|S2,N2|W2],[E2,W2|N2|E2,W2|N2|S2,S2],[E2,W2|E2,W2|N2|E2,N2|W2]];
    const mzPath2 = new Set(["0,0","1,0","2,0","2,1","2,2","3,2","3,3"]);
    let mzTable = `<table style="border-collapse:collapse;margin:6px auto;">`;
    for (let r = 0; r < 4; r++) {
      mzTable += "<tr>";
      for (let c = 0; c < 4; c++) {
        const cell = mzMini[r][c];
        const bT = !(cell & N2) ? "2px solid #555" : "1px solid #eee";
        const bR = !(cell & E2) ? "2px solid #555" : "1px solid #eee";
        const bB = !(cell & S2) ? "2px solid #555" : "1px solid #eee";
        const bL = !(cell & W2) ? "2px solid #555" : "1px solid #eee";
        const onPath = mzPath2.has(`${r},${c}`);
        let inner = "";
        if (r === 0 && c === 0) inner = `<span style="font-size:7px;color:#555;font-family:monospace;">S</span>`;
        if (r === 3 && c === 3) inner = `<span style="font-size:7px;color:#555;font-family:monospace;">F</span>`;
        mzTable += `<td style="width:22px;height:22px;text-align:center;vertical-align:middle;border-top:${bT};border-right:${bR};border-bottom:${bB};border-left:${bL};${onPath ? "background:#e8e8e0;" : ""}">${inner}</td>`;
      }
      mzTable += "</tr>";
    }
    mzTable += "</table>";
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Example — shaded path from S to F:</div>` +
      mzTable +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#777;margin-top:4px;">Follow open passages — no diagonal moves</div>` +
      `</div>`;
  } else if (PT === "Number Search") {
    // 4×4 grid with sequence 1234 highlighted in row 0
    const nsRows = [["1","2","3","4"],["8","5","9","2"],["3","7","1","6"],["4","2","8","5"]];
    const nsHi = new Set(["0,0","0,1","0,2","0,3"]);
    let nsTable = `<table style="border-collapse:collapse;margin:6px auto;">`;
    for (let r = 0; r < 4; r++) {
      nsTable += "<tr>";
      for (let c = 0; c < 4; c++) {
        const h = nsHi.has(`${r},${c}`);
        nsTable += `<td style="${miniCellBase}${h ? "background:#e8e8e0;font-weight:700;" : ""}">${nsRows[r][c]}</td>`;
      }
      nsTable += "</tr>";
    }
    nsTable += "</table>";
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Example — sequence "1234" highlighted in row 1:</div>` +
      nsTable +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#777;margin-top:4px;">Highlighted digits spell 1-2-3-4 (left to right)</div>` +
      `</div>`;
  } else if (PT === "Cryptogram") {
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:10px;">Example substitution mapping:</div>` +
      `<div style="display:inline-flex;gap:20px;justify-content:center;margin-bottom:10px;">` +
      `<div style="text-align:center;font-family:'Source Code Pro',monospace;"><div style="font-size:12px;font-weight:700;color:#222;">T</div><div style="font-size:9px;color:#aaa;">↓</div><div style="font-size:12px;color:#666;">Q</div></div>` +
      `<div style="text-align:center;font-family:'Source Code Pro',monospace;"><div style="font-size:12px;font-weight:700;color:#222;">H</div><div style="font-size:9px;color:#aaa;">↓</div><div style="font-size:12px;color:#666;">E</div></div>` +
      `<div style="text-align:center;font-family:'Source Code Pro',monospace;"><div style="font-size:12px;font-weight:700;color:#222;">E</div><div style="font-size:9px;color:#aaa;">↓</div><div style="font-size:12px;color:#666;">V</div></div>` +
      `</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#555;">"THE" encoded &rarr; <strong>QEV</strong> &nbsp;|&nbsp; decode by reversing the mapping</div>` +
      `</div>`;
  } else if (PT === "Crossword") {
    // 5×5 mini example: CRANE across row 2, GRADE down col 2 (A intersects at row 2 col 2)
    const cxGrid = [
      ["#","#","G","#","#"],
      ["#","#","R","#","#"],
      ["C","R","A","N","E"],
      ["#","#","D","#","#"],
      ["#","#","E","#","#"],
    ];
    const cxNums: Record<string,number> = {"0,2":1,"2,0":2};
    const cxCellSz = 22;
    let cxTable = `<table style="border-collapse:collapse;margin:6px auto;">`;
    for (let r = 0; r < 5; r++) {
      cxTable += "<tr>";
      for (let c = 0; c < 5; c++) {
        const cell = cxGrid[r][c];
        const num = cxNums[`${r},${c}`];
        if (cell === "#") {
          cxTable += `<td style="width:${cxCellSz}px;height:${cxCellSz}px;background:#333;border:1px solid #555;"></td>`;
        } else {
          cxTable += `<td style="width:${cxCellSz}px;height:${cxCellSz}px;border:1px solid #999;background:#fff;position:relative;vertical-align:top;">` +
            (num ? `<span style="position:absolute;top:1px;left:2px;font-family:'Source Code Pro',monospace;font-size:6px;color:#555;line-height:1;">${num}</span>` : "") +
            `</td>`;
        }
      }
      cxTable += "</tr>";
    }
    cxTable += "</table>";
    miniEx = `<div style="margin-bottom:20px;text-align:center;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:8px;">Example — fill white cells using the numbered clues:</div>` +
      cxTable +
      `<div style="display:inline-flex;gap:28px;justify-content:center;margin-top:8px;text-align:left;">` +
      `<div><div style="font-family:'Source Code Pro',monospace;font-size:8px;font-weight:700;color:#333;letter-spacing:2px;margin-bottom:3px;">ACROSS</div><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;">2. Large wading bird (5)</div></div>` +
      `<div><div style="font-family:'Source Code Pro',monospace;font-size:8px;font-weight:700;color:#333;letter-spacing:2px;margin-bottom:3px;">DOWN</div><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;">1. A score or mark (5)</div></div>` +
      `</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#777;margin-top:6px;">Numbers show where entries start &mdash; fill across or down from each</div>` +
      `</div>`;
  }

  html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span><span>${DF} &middot; ${PT}</span></div>` +
    `<div style="padding-top:0.3in;"><div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:12px;">How to Play</div>` +
    `<div style="width:56px;height:2px;background:#333;margin-bottom:20px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:13px;line-height:1.8;color:#333;margin-bottom:22px;">${htxt}</div>` +
    miniEx +
    `<div style="border-left:3px solid #333;background:#f9f9f6;padding:14px 18px;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:#333;font-weight:600;margin-bottom:6px;">TIP</div>` +
    `<div style="font-family:Lora,serif;font-size:12px;color:#444;">${tip}</div></div>` +
    (LP ? `<div style="margin-top:20px;font-family:Source Code Pro,monospace;font-size:10px;letter-spacing:2px;color:#666;text-align:center;">LARGE PRINT EDITION</div>` : "") +
    `</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${currentPage} &mdash;</span></div></div>`;
  currentPage++;

  // ── Table of Contents ────────────────────────────────────────────────────
  let tocR = "";
  const mx = Math.min(PC, 42);
  for (let i = 0; i < mx; i++)
    tocR += `<div style="display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:11px;color:#555;padding:2px 0;border-bottom:1px dotted #ddd;"><span>Puzzle #${String(i + 1).padStart(2, "0")}</span><span>${puzzlePageOf(i)}</span></div>`;
  if (PC > 42)
    tocR += `<div style="font-family:Lora,serif;font-size:11px;color:#777;padding:6px 0;font-style:italic;">&hellip; and ${PC - 42} more</div>`;
  html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span><span>${DF} &middot; ${PT}</span></div>` +
    `<div style="padding-top:0.3in;"><div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:16px;">Table of Contents</div>` +
    `<div style="columns:2;column-gap:32px;">${tocR}</div>` +
    `<div style="margin-top:20px;font-family:'Source Code Pro',monospace;font-size:10px;color:#333;letter-spacing:2px;font-weight:600;">ANSWER KEY &mdash; PAGE ${aS}</div></div>` +
    `<div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${currentPage} &mdash;</span></div></div>`;
  currentPage++;

  // ── Solve-a-Day Tracker (optional) ───────────────────────────────────────
  if (hasTracker) {
    const days = Array.from({ length: challengeDays }, (_, d) => d + 1);
    const chkBox = `<div style="display:inline-block;width:13px;height:13px;border:1.5px solid #aaa;border-radius:2px;"></div>`;
    const dayRows = days.map(d => {
      const label = String(d).padStart(2, "0");
      return `<div style="display:flex;align-items:center;gap:8px;padding:3px 6px;border-bottom:1px solid #f0f0f0;">` +
        `<span style="font-family:'Source Code Pro',monospace;font-size:10px;font-weight:600;color:#666;min-width:26px;">Day ${label}</span>` +
        chkBox +
        `<div style="flex:1;height:1px;border-bottom:1px dotted #ddd;margin:0 8px;"></div>` +
        `<span style="font-family:'Source Code Pro',monospace;font-size:8px;color:#bbb;letter-spacing:1px;">TIME ____</span>` +
        `</div>`;
    }).join("");
    html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span><span>Tracker</span></div>` +
      `<div style="padding-top:0.2in;">` +
      `<div style="font-family:Lora,serif;font-size:22px;font-weight:700;color:#222;margin-bottom:6px;">${challengeDays}-Day Solve-a-Day Tracker</div>` +
      `<div style="font-family:Lora,serif;font-size:12px;font-style:italic;color:#666;margin-bottom:14px;">Check off each day as you complete a puzzle — track your streak!</div>` +
      `<div style="width:40px;height:2px;background:#333;margin-bottom:14px;"></div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:20px;">${dayRows}</div>` +
      `</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${currentPage} &mdash;</span></div></div>`;
    currentPage++;
  }

  // ── Puzzle pages ─────────────────────────────────────────────────────────
  // Section-divider page builder (full page, B&W, bold centered)
  // label = "EASY PUZZLES" etc., rangeStr = "Puzzles 1–33" etc.
  const sectionDivider = (label: string, rangeStr: string, pageNum: number) =>
    `<div class="pg in"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${trimH}in;text-align:center;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:5px;color:#bbb;text-transform:uppercase;margin-bottom:20px;">Progressive Difficulty</div>` +
    `<div style="width:48px;height:2px;background:#333;margin-bottom:20px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:34px;font-weight:700;color:#222;margin-bottom:8px;">${label}</div>` +
    `<div style="font-family:Lora,serif;font-size:14px;font-style:italic;color:#666;margin-bottom:20px;">${rangeStr}</div>` +
    `<div style="width:48px;height:2px;background:#333;"></div>` +
    `</div><div class="ft"><span></span><span class="ft-pg">&mdash; ${pageNum} &mdash;</span></div></div>`;

  // Emit Level 1 section divider before first puzzle (only when hasSections)
  if (hasSections) {
    html += sectionDivider("EASY PUZZLES", `Puzzles 1\u2013${sec1}`, currentPage);
    currentPage++;
  }

  for (let i = 0; i < PC; i++) {
    // Emit Level 2 & 3 section dividers between puzzle groups
    if (hasSections && i === sec1) {
      html += sectionDivider("MEDIUM PUZZLES", `Puzzles ${sec1 + 1}\u2013${sec2}`, pS + sec1);
    }
    if (hasSections && i === sec2) {
      html += sectionDivider("HARD PUZZLES", `Puzzles ${sec2 + 1}\u2013${PC}`, pS + sec2 + 1);
    }
    const pN = puzzlePageOf(i);
    const lb = "#" + String(i + 1).padStart(2, "0");
    const pz = puzzles[i] as Record<string, unknown>;
    const progressBadge = makeProgressBadge(getPuzzleDiff(i));
    // LP ornamental separator embedded at bottom of every 10th puzzle page
    // (inside the .pg div — no effect on page count or computeTotalPages)
    const lpSep = (LP && (i + 1) % 10 === 0 && i < PC - 1)
      ? `<div style="margin-top:10px;text-align:center;font-family:'Source Code Pro',monospace;font-size:11px;letter-spacing:8px;color:#ccc;border-top:1px solid #eee;padding-top:6px;">— ✦ —</div>`
      : "";

    if (PT === "Word Search") {
      const ws = pz as { grid: string[][]; placed: string[] };
      let g = `<table style="border-collapse:collapse;margin:10px auto;">`;
      for (let r = 0; r < ws.grid.length; r++) {
        g += "<tr>";
        for (let c = 0; c < ws.grid[r].length; c++)
          g += `<td style="width:${wC}px;height:${wC}px;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${wF}px;font-weight:700;color:#222;border:1px solid #aaa;">${ws.grid[r][c]}</td>`;
        g += "</tr>";
      }
      g += "</table>";
      // Sorted alphabetical word bank in bordered 3-column callout box
      const sortedWS = [...ws.placed].sort();
      const ch = `<div style="border:1px solid #ccc;background:#f8f6f0;border-radius:3px;padding:8px 12px;margin-top:8px;">` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#666;margin-bottom:6px;text-align:center;border-bottom:1px solid #ddd;padding-bottom:4px;font-variant:small-caps;">Find These Words</div>` +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 8px;">` +
        sortedWS.map(w => `<div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 15 : 13}px;font-weight:600;color:#222;padding:1px 0;">${escapeHtml(w)}</div>`).join("") +
        `</div></div>`;
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">WORD SEARCH</span></div>${ornamentRule}${g}${ch}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;

    } else if (PT === "Sudoku") {
      const sd = pz as { puzzle: number[][] };
      let g = `<table style="border-collapse:collapse;margin:16px auto;">`;
      for (let r = 0; r < 9; r++) {
        g += "<tr>";
        for (let c = 0; c < 9; c++) {
          const v = sd.puzzle[r][c];
          let bR = (c === 2 || c === 5) ? "2.5px solid #333" : "1px solid #bbb";
          let bB = (r === 2 || r === 5) ? "2.5px solid #333" : "1px solid #bbb";
          const bT = r === 0 ? "2.5px solid #333" : "none";
          const bL = c === 0 ? "2.5px solid #333" : "none";
          if (c === 8) bR = "2.5px solid #333";
          if (r === 8) bB = "2.5px solid #333";
          const cs = v ? "color:#111;font-weight:700;background:#f5f5f0;" : "color:#fff;";
          g += `<td style="width:${sC}px;height:${sC}px;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${sF}px;${cs}border-right:${bR};border-bottom:${bB};border-top:${bT};border-left:${bL};">${v || ""}</td>`;
        }
        g += "</tr>";
      }
      g += "</table>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">SUDOKU</span></div>${ornamentRule}${g}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;

    } else if (PT === "Maze") {
      const mz = pz as { grid: number[][]; rows: number; cols: number };
      const cellSize = LP ? 28 : 22;
      const N = 1, E = 2, S = 4, W = 8;
      let g = `<table style="border-collapse:collapse;margin:16px auto;">`;
      for (let r = 0; r < mz.rows; r++) {
        g += "<tr>";
        for (let c = 0; c < mz.cols; c++) {
          const cell = mz.grid[r][c];
          const bT = !(cell & N) ? "2px solid #333" : "1px solid #e8e8e8";
          const bR = !(cell & E) ? "2px solid #333" : "1px solid #e8e8e8";
          const bB = !(cell & S) ? "2px solid #333" : "1px solid #e8e8e8";
          const bL = !(cell & W) ? "2px solid #333" : "1px solid #e8e8e8";
          let inner = "";
          if (r === 0 && c === 0) inner = `<div style="font-size:7px;color:#555;font-family:monospace;">S</div>`;
          if (r === mz.rows - 1 && c === mz.cols - 1) inner = `<div style="font-size:7px;color:#555;font-family:monospace;">F</div>`;
          g += `<td style="width:${cellSize}px;height:${cellSize}px;text-align:center;vertical-align:middle;border-top:${bT};border-right:${bR};border-bottom:${bB};border-left:${bL};">${inner}</td>`;
        }
        g += "</tr>";
      }
      g += "</table>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">MAZE</span></div>${ornamentRule}${g}<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#777;margin-top:6px;text-align:center;">S = Start &nbsp;&nbsp; F = Finish</div>${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;

    } else if (PT === "Number Search") {
      const ns = pz as { grid: string[][]; placed: string[] };
      // Number Search retains original sizing — not changed by this upgrade (Word Search only)
      const nsC = LP ? 34 : 28, nsF = LP ? 17 : 14;
      let g = `<table style="border-collapse:collapse;margin:10px auto;">`;
      for (let r = 0; r < ns.grid.length; r++) {
        g += "<tr>";
        for (let c = 0; c < ns.grid[r].length; c++)
          g += `<td style="width:${nsC}px;height:${nsC}px;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${nsF}px;font-weight:500;color:#222;border:1px solid #ccc;">${ns.grid[r][c]}</td>`;
        g += "</tr>";
      }
      g += "</table>";
      // Sorted number bank in bordered 3-column callout box
      const sortedNS = [...ns.placed].sort();
      const ch = `<div style="border:1px solid #ccc;background:#f8f6f0;border-radius:3px;padding:8px 12px;margin-top:8px;">` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#666;margin-bottom:6px;text-align:center;border-bottom:1px solid #ddd;padding-bottom:4px;font-variant:small-caps;">Find These Numbers</div>` +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 8px;">` +
        sortedNS.map(s => `<div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 14 : 12}px;color:#222;padding:1px 0;">${escapeHtml(String(s))}</div>`).join("") +
        `</div></div>`;
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">NUMBER SEARCH</span></div>${ornamentRule}${g}${ch}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;

    } else if (PT === "Crossword") {
      const cw = pz as unknown as CrosswordResult;
      const cxCellSz = LP ? 52 : 36;
      const cxNumF = LP ? 9 : 7;
      let cxG = `<table style="border-collapse:collapse;margin:4px auto;">`;
      for (let r = 0; r < cw.size; r++) {
        cxG += "<tr>";
        for (let c = 0; c < cw.size; c++) {
          const cell = cw.grid[r][c];
          const num = cw.nums[`${r},${c}`];
          if (cell === "#") {
            cxG += `<td style="width:${cxCellSz}px;height:${cxCellSz}px;background:#222;border:1px solid #444;"></td>`;
          } else {
            cxG += `<td style="width:${cxCellSz}px;height:${cxCellSz}px;border:1px solid #888;background:#fff;position:relative;vertical-align:top;">` +
              (num ? `<span style="position:absolute;top:2px;left:2px;font-family:'Source Code Pro',monospace;font-size:${cxNumF}px;color:#555;line-height:1;">${num}</span>` : "") +
              `</td>`;
          }
        }
        cxG += "</tr>";
      }
      cxG += "</table>";
      const cxClueF = LP ? 10 : 8;
      let acClues = `<div style="font-family:'Source Code Pro',monospace;font-size:${cxClueF + 1}px;font-weight:700;color:#222;letter-spacing:2px;margin-bottom:4px;">ACROSS</div>`;
      for (const cl of cw.across)
        acClues += `<div style="font-family:'Source Code Pro',monospace;font-size:${cxClueF}px;color:#333;line-height:1.55;">${cl.num}. ${escapeHtml(cl.clue)} (${cl.len})</div>`;
      let dnClues = `<div style="font-family:'Source Code Pro',monospace;font-size:${cxClueF + 1}px;font-weight:700;color:#222;letter-spacing:2px;margin-bottom:4px;">DOWN</div>`;
      for (const cl of cw.down)
        dnClues += `<div style="font-family:'Source Code Pro',monospace;font-size:${cxClueF}px;color:#333;line-height:1.55;">${cl.num}. ${escapeHtml(cl.clue)} (${cl.len})</div>`;
      const cxClueBox = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;padding:8px 10px;border:1px solid #ddd;background:#fafaf8;border-radius:3px;">${acClues ? `<div>${acClues}</div>` : ""}<div>${dnClues}</div></div>`;
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.1in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">CROSSWORD</span></div>${ornamentRule}${cxG}${cxClueBox}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;

    } else if (PT === "Cryptogram") {
      const cg = pz as { cipher: string; plain: string };
      const cipherDisplay = cg.cipher.split("").map(ch =>
        ch >= "A" && ch <= "Z" ? `<span style="display:inline-block;text-align:center;width:${LP ? 22 : 18}px;">${ch}<br/><span style="display:block;border-bottom:1px solid #333;margin:0 2px;">&nbsp;</span></span>` : (ch === " " ? `<span style="display:inline-block;width:${LP ? 10 : 8}px;">&nbsp;</span>` : ch)
      ).join("");
      // 2-row × 13-column cipher key table (A–M, N–Z)
      const cgCellStyle = `text-align:center;padding:3px 0;font-family:'Source Code Pro',monospace;font-size:${LP ? 10 : 8}px;`;
      const cgKeyTable = `<table style="border-collapse:collapse;margin:0 auto;width:100%;table-layout:fixed;">` +
        `<tr>` + "ABCDEFGHIJKLM".split("").map(l =>
          `<td style="${cgCellStyle}"><div style="color:#666;">${l}</div><div style="border-bottom:1px solid #555;width:${LP ? 18 : 14}px;margin:2px auto;height:11px;"></div></td>`
        ).join("") + `</tr>` +
        `<tr>` + "NOPQRSTUVWXYZ".split("").map(l =>
          `<td style="${cgCellStyle}"><div style="color:#666;">${l}</div><div style="border-bottom:1px solid #555;width:${LP ? 18 : 14}px;margin:2px auto;height:11px;"></div></td>`
        ).join("") + `</tr>` +
        `</table>`;
      html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span>${progressBadge}</div><div style="padding-top:0.2in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">CRYPTOGRAM</span></div>${ornamentRule}<div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 16 : 13}px;color:#222;line-height:2.8;word-spacing:4px;">${cipherDisplay}</div><div style="margin-top:20px;">${cgKeyTable}</div>${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${pN} &mdash;</span></div></div>`;
    }
  }

  // ── Answer key pages ─────────────────────────────────────────────────────
  let akP = aS;

  if (PT === "Word Search") {
    // LP: 2×2 grid (4-up, aPer=4), cSz=26px — each mini-grid fits in 365px half-width slot
    // Std: 2×3 grid (6-up, aPer=6), cSz=16px — each mini-grid fits in 258px half-width slot
    const akCols = 2;
    const cSz = LP ? 26 : 16, fSz = LP ? 14 : 9;
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ grid: string[][]; placed: string[]; pSet: Record<string, boolean> }>;
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">WORD SEARCH</div>` +
        `</div>` : "";
      let gs = `<div style="display:grid;grid-template-columns:repeat(${akCols},1fr);gap:${LP ? 24 : 14}px;">`;
      batch.forEach((ws, idx) => {
        let m = `<div style="text-align:center;"><div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 10 : 8}px;color:#555;font-weight:700;margin-bottom:4px;">PUZZLE #${String(p + idx + 1).padStart(2, "0")}</div><table style="border-collapse:collapse;margin:0 auto;">`;
        for (let r = 0; r < ws.grid.length; r++) {
          m += "<tr>";
          for (let c = 0; c < ws.grid[r].length; c++) {
            const ia = ws.pSet[`${r},${c}`];
            m += `<td style="width:${cSz}px;height:${cSz}px;font-size:${fSz}px;text-align:center;font-family:'Source Code Pro',monospace;color:${ia ? "#000" : "#ccc"};font-weight:${ia ? "700" : "400"};${ia ? "background:#e8e6de;" : ""}border:1px solid #ddd;">${ws.grid[r][c]}</td>`;
          }
          m += "</tr>";
        }
        m += "</table></div>";
        gs += m;
      });
      gs += "</div>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Word Search</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }

  } else if (PT === "Number Search") {
    // Number Search: preserve original compact flex-wrap layout (aPer=9/12, cSz=9/8) — unchanged per spec
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ grid: string[][]; placed: string[]; pSet: Record<string, boolean> }>;
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">NUMBER SEARCH</div>` +
        `</div>` : "";
      let gs = `<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;">`;
      batch.forEach((ws, idx) => {
        const cSz = LP ? 9 : 8, fSz = LP ? 6 : 5;
        let m = `<div style="text-align:center;"><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;font-weight:600;">#${String(p + idx + 1).padStart(2, "0")}</div><table style="border-collapse:collapse;">`;
        for (let r = 0; r < ws.grid.length; r++) {
          m += "<tr>";
          for (let c = 0; c < ws.grid[r].length; c++) {
            const ia = ws.pSet[`${r},${c}`];
            m += `<td style="width:${cSz}px;height:${cSz}px;font-size:${fSz}px;text-align:center;font-family:monospace;color:${ia ? "#000" : "#999"};font-weight:${ia ? "700" : "400"};${ia ? "background:#e0e0d8;" : ""}border:1px solid #eee;">${ws.grid[r][c]}</td>`;
          }
          m += "</tr>";
        }
        m += "</table></div>";
        gs += m;
      });
      gs += "</div>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Number Search</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }

  } else if (PT === "Sudoku") {
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ puzzle: number[][]; solution: number[][] }>;
      const cSz = LP ? 16 : 14;
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">SUDOKU</div>` +
        `</div>` : "";
      let gs = `<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">`;
      batch.forEach((sd, idx) => {
        let m = `<div style="text-align:center;"><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;font-weight:600;">#${String(p + idx + 1).padStart(2, "0")}</div><table style="border-collapse:collapse;">`;
        for (let r = 0; r < 9; r++) {
          m += "<tr>";
          for (let c = 0; c < 9; c++) {
            let bR = (c === 2 || c === 5) ? "2px solid #555" : "1px solid #ddd";
            let bB = (r === 2 || r === 5) ? "2px solid #555" : "1px solid #ddd";
            const bT = r === 0 ? "2px solid #555" : "none";
            const bL = c === 0 ? "2px solid #555" : "none";
            if (c === 8) bR = "2px solid #555";
            if (r === 8) bB = "2px solid #555";
            m += `<td style="width:${cSz}px;height:${cSz}px;font-size:${cSz - 6}px;text-align:center;font-family:monospace;color:#222;border-right:${bR};border-bottom:${bB};border-top:${bT};border-left:${bL};">${sd.solution[r][c]}</td>`;
          }
          m += "</tr>";
        }
        m += "</table></div>";
        gs += m;
      });
      gs += "</div>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Sudoku</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }

  } else if (PT === "Maze") {
    // Maze answers — show solved path via BFS
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ grid: number[][]; rows: number; cols: number }>;
      const N = 1, E = 2, S = 4, W = 8;
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">MAZE</div>` +
        `</div>` : "";
      let gs = `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">`;
      batch.forEach((mz, idx) => {
        // BFS to find solution path
        const parent = new Map<string, string>();
        const queue = ["0,0"];
        parent.set("0,0", "");
        const target = `${mz.rows - 1},${mz.cols - 1}`;
        while (queue.length > 0) {
          const cur = queue.shift()!;
          if (cur === target) break;
          const [r, c] = cur.split(",").map(Number);
          const cell = mz.grid[r][c];
          const moves: [number, number, number][] = [[N, -1, 0], [E, 0, 1], [S, 1, 0], [W, 0, -1]];
          for (const [dir, dr, dc] of moves) {
            const nr = r + dr, nc = c + dc;
            const k = `${nr},${nc}`;
            if ((cell & dir) && !parent.has(k)) { parent.set(k, cur); queue.push(k); }
          }
        }
        const path = new Set<string>();
        let cur: string | undefined = target;
        while (cur !== undefined && cur !== "") { path.add(cur); cur = parent.get(cur); }
        const cellSize = 8;
        let m = `<div style="text-align:center;"><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;font-weight:600;">#${String(p + idx + 1).padStart(2, "0")}</div><table style="border-collapse:collapse;">`;
        for (let r = 0; r < mz.rows; r++) {
          m += "<tr>";
          for (let c = 0; c < mz.cols; c++) {
            const cell = mz.grid[r][c];
            const bT = !(cell & N) ? "1.5px solid #333" : "none";
            const bR = !(cell & E) ? "1.5px solid #333" : "none";
            const bB = !(cell & S) ? "1.5px solid #333" : "none";
            const bL = !(cell & W) ? "1.5px solid #333" : "none";
            const onPath = path.has(`${r},${c}`);
            m += `<td style="width:${cellSize}px;height:${cellSize}px;background:${onPath ? "#C8951A44" : "#fff"};border-top:${bT};border-right:${bR};border-bottom:${bB};border-left:${bL};"></td>`;
          }
          m += "</tr>";
        }
        m += "</table></div>";
        gs += m;
      });
      gs += "</div>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Maze</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }

  } else if (PT === "Cryptogram") {
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ cipher: string; plain: string; author: string }>;
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">CRYPTOGRAM</div>` +
        `</div>` : "";
      let gs = "";
      batch.forEach((cg, idx) => {
        gs += `<div style="margin-bottom:18px;padding:10px 12px;border:1px solid #eee;border-left:3px solid #bbb;">` +
          `<div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;font-weight:600;margin-bottom:6px;">#${String(p + idx + 1).padStart(2, "0")}</div>` +
          `<div style="font-family:Lora,serif;font-size:11px;color:#222;line-height:1.6;">${cg.plain}</div>` +
          `<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#888;margin-top:5px;font-style:italic;">&mdash; ${cg.author || ""}</div>` +
          `</div>`;
      });
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Cryptogram</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }

  } else if (PT === "Crossword") {
    const akCols = LP ? 2 : 3;
    const akCS = LP ? 16 : 10;
    const akFS = LP ? 9 : 6;
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as CrosswordResult[];
      const akBanner = p === 0 ? `<div style="text-align:center;border-bottom:2px solid #555;padding-bottom:8px;margin-bottom:14px;">` +
        `<div style="font-family:Lora,serif;font-size:20px;font-weight:700;color:#222;letter-spacing:2px;text-transform:uppercase;">Answer Key</div>` +
        `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:#777;margin-top:4px;">CROSSWORD</div>` +
        `</div>` : "";
      let gs = `<div style="display:grid;grid-template-columns:repeat(${akCols},1fr);gap:${LP ? 24 : 14}px;justify-items:center;">`;
      batch.forEach((cw, idx) => {
        let m = `<div style="text-align:center;"><div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 10 : 8}px;color:#555;font-weight:700;margin-bottom:4px;">PUZZLE #${String(p + idx + 1).padStart(2, "0")}</div><table style="border-collapse:collapse;margin:0 auto;">`;
        for (let r = 0; r < cw.size; r++) {
          m += "<tr>";
          for (let c = 0; c < cw.size; c++) {
            const cell = cw.grid[r][c];
            if (cell === "#") {
              m += `<td style="width:${akCS}px;height:${akCS}px;background:#333;border:1px solid #555;"></td>`;
            } else {
              m += `<td style="width:${akCS}px;height:${akCS}px;border:1px solid #ccc;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${akFS}px;font-weight:700;color:#222;background:#f5f5f0;">${cell}</td>`;
            }
          }
          m += "</tr>";
        }
        m += "</table></div>";
        gs += m;
      });
      gs += "</div>";
      html += `<div class="pg in"><div class="hd"><span class="hd-title">Answer Key</span><span>Crossword</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${akP} &mdash;</span></div></div>`;
      akP++;
    }
  }

  // ── Notes pages (4 ruled pages) — appear after answer key ────────────────
  for (let n = 0; n < 4; n++) {
    const notesPg = aS + aP + n;
    const lineCount = LP ? 18 : 24;
    const lineH = LP ? 0.36 : 0.28;
    let noteLines = "";
    for (let l = 0; l < lineCount; l++)
      noteLines += `<div style="width:100%;height:${lineH}in;border-bottom:1px solid #ccc;margin-bottom:0;"></div>`;
    const notesTitle = n === 0 ? "Notes" : "&nbsp;";
    html += `<div class="pg in"><div class="hd"><span class="hd-title">${T}</span><span>Notes</span></div>` +
      `<div style="padding-top:0.2in;">` +
      `<div style="font-family:Lora,serif;font-size:${n === 0 ? "22px" : "0px"};font-weight:700;color:#222;margin-bottom:${n === 0 ? "14px" : "0px"};">${notesTitle}</div>` +
      `${n === 0 ? `<div style="width:36px;height:2px;background:#333;margin-bottom:14px;"></div>` : ""}` +
      noteLines +
      `</div><div class="ft"><span>${T} — ${AU}</span><span class="ft-pg">&mdash; ${notesPg} &mdash;</span></div></div>`;
  }

  html += "</body></html>";
  return { html, totalPages: totP, trimW, trimH };
}

interface CoverTheme {
  bg: string;
  ac: string;
  tx: string;
  isDark: boolean;
  gradTop: string;
}

const THEMES: Record<string, CoverTheme> = {
  midnight:  { bg: "#0D1B3E", ac: "#F5C842", tx: "#F0EDD8", isDark: true,  gradTop: "#1A2F5A" },
  forest:    { bg: "#1A3C1A", ac: "#6DCC50", tx: "#E8F5E0", isDark: true,  gradTop: "#28581E" },
  crimson:   { bg: "#280808", ac: "#FF3838", tx: "#FFE8E8", isDark: true,  gradTop: "#450A0A" },
  ocean:     { bg: "#C8E8F8", ac: "#1565A8", tx: "#0A1E38", isDark: false, gradTop: "#DDEFFA" },
  violet:    { bg: "#180635", ac: "#C060FF", tx: "#F0E8FF", isDark: true,  gradTop: "#28095A" },
  slate:     { bg: "#252E3A", ac: "#FF8C38", tx: "#F0F4F8", isDark: true,  gradTop: "#303C4E" },
  sunrise:   { bg: "#FDF0E0", ac: "#D44000", tx: "#2E0E00", isDark: false, gradTop: "#FFF8F0" },
  teal:      { bg: "#062020", ac: "#18D0A0", tx: "#D8FFF5", isDark: true,  gradTop: "#0E3030" },
  parchment: { bg: "#F5E4C0", ac: "#7B3A00", tx: "#2A1200", isDark: false, gradTop: "#FAF0D8" },
  sky:       { bg: "#E0EFFF", ac: "#2050B8", tx: "#081830", isDark: false, gradTop: "#ECF5FF" },
};

export interface CoverBuildOpts extends BuildOpts {
  customBg?: string;
  customAccent?: string;
  customText?: string;
  coverImageUrl?: string;
}

export interface CoverResult {
  html: string;
  fullW: number;
  fullH: number;
  spineW: number;
}

function buildThemeCoverArt(theme: string, ac: string, bg: string): string {
  const cs = `width:4.5in;height:4in;margin:0 auto 16px;border-radius:8px;overflow:hidden;border:2px solid ${ac};position:relative;background:${bg};`;
  switch (theme) {

    case "midnight":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><circle cx="38" cy="42" r="1.8" fill="${ac}" fill-opacity="0.85"/><circle cx="88" cy="18" r="1.2" fill="${ac}" fill-opacity="0.7"/><circle cx="148" cy="52" r="2.2" fill="${ac}" fill-opacity="0.9"/><circle cx="196" cy="24" r="1.5" fill="${ac}" fill-opacity="0.65"/><circle cx="270" cy="38" r="1.8" fill="${ac}" fill-opacity="0.75"/><circle cx="338" cy="16" r="1.2" fill="${ac}" fill-opacity="0.6"/><circle cx="398" cy="46" r="1.8" fill="${ac}" fill-opacity="0.8"/><circle cx="62" cy="92" r="1.2" fill="${ac}" fill-opacity="0.5"/><circle cx="315" cy="78" r="1.5" fill="${ac}" fill-opacity="0.6"/><circle cx="418" cy="68" r="1" fill="${ac}" fill-opacity="0.5"/><circle cx="175" cy="72" r="1" fill="${ac}" fill-opacity="0.55"/><circle cx="195" cy="188" r="108" fill="${ac}" fill-opacity="0.92"/><circle cx="248" cy="158" r="92" fill="${bg}"/><circle cx="195" cy="188" r="126" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.18"/><circle cx="195" cy="188" r="148" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.1"/><ellipse cx="216" cy="355" rx="200" ry="22" fill="${ac}" fill-opacity="0.06"/></svg></div>`;

    case "forest":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><rect width="432" height="384" fill="${ac}" fill-opacity="0.04"/><polygon points="72,12 0,272 144,272" fill="${ac}" fill-opacity="0.58"/><polygon points="72,62 8,238 136,238" fill="${bg}" fill-opacity="0.22"/><rect x="62" y="272" width="18" height="112" fill="${ac}" fill-opacity="0.65"/><polygon points="216,0 90,295 342,295" fill="${ac}" fill-opacity="0.72"/><polygon points="216,55 118,270 314,270" fill="${bg}" fill-opacity="0.20"/><rect x="206" y="295" width="20" height="89" fill="${ac}" fill-opacity="0.70"/><polygon points="360,18 288,272 432,272" fill="${ac}" fill-opacity="0.58"/><polygon points="360,68 300,244 420,244" fill="${bg}" fill-opacity="0.20"/><rect x="350" y="272" width="18" height="112" fill="${ac}" fill-opacity="0.65"/><rect x="0" y="340" width="432" height="44" fill="${ac}" fill-opacity="0.10"/></svg></div>`;

    case "crimson":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><ellipse cx="216" cy="365" rx="140" ry="28" fill="${ac}" fill-opacity="0.22"/><path d="M216,375 C148,345 85,300 108,240 C122,205 154,218 144,178 C136,148 118,132 130,95 C142,60 178,42 216,58 C254,42 290,60 302,95 C314,132 296,148 288,178 C278,218 310,205 324,240 C347,300 284,345 216,375 Z" fill="${ac}" fill-opacity="0.80"/><path d="M216,355 C172,330 132,295 150,248 C160,222 182,232 175,198 C170,174 158,162 166,132 C174,105 196,94 216,106 C236,94 258,105 266,132 C274,162 262,174 257,198 C250,232 272,222 282,248 C300,295 260,330 216,355 Z" fill="${ac}" fill-opacity="0.45"/><ellipse cx="216" cy="310" rx="38" ry="52" fill="white" fill-opacity="0.10"/></svg></div>`;

    case "ocean":
      return `<div style="${cs};background:#C8E8F8;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="#C8E8F8"/><circle cx="345" cy="62" r="55" fill="${ac}" fill-opacity="0.90"/><circle cx="345" cy="62" r="68" fill="none" stroke="${ac}" stroke-width="2" stroke-opacity="0.25"/><circle cx="345" cy="62" r="80" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.14"/><path d="M0,195 Q54,160 108,195 Q162,230 216,195 Q270,160 324,195 Q378,230 432,195 L432,384 L0,384 Z" fill="${ac}" fill-opacity="0.30"/><path d="M0,235 Q54,200 108,235 Q162,270 216,235 Q270,200 324,235 Q378,270 432,235 L432,384 L0,384 Z" fill="${ac}" fill-opacity="0.45"/><path d="M0,275 Q54,240 108,275 Q162,310 216,275 Q270,240 324,275 Q378,310 432,275 L432,384 L0,384 Z" fill="${ac}" fill-opacity="0.65"/><path d="M 60,155 L 70,145 L 80,155" fill="none" stroke="${ac}" stroke-width="1.8" stroke-opacity="0.50"/><path d="M 95,138 L 108,126 L 121,138" fill="none" stroke="${ac}" stroke-width="1.8" stroke-opacity="0.42"/></svg></div>`;

    case "violet":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><polygon points="216,55 360,195 216,368 72,195" fill="${ac}" fill-opacity="0.70"/><polygon points="216,55 360,195 216,195" fill="white" fill-opacity="0.12"/><polygon points="216,55 72,195 216,195" fill="${bg}" fill-opacity="0.18"/><polygon points="216,368 360,195 216,195" fill="${bg}" fill-opacity="0.15"/><polygon points="216,368 72,195 216,195" fill="white" fill-opacity="0.08"/><line x1="216" y1="55" x2="216" y2="368" stroke="white" stroke-width="1.2" stroke-opacity="0.30"/><line x1="72" y1="195" x2="360" y2="195" stroke="white" stroke-width="1.2" stroke-opacity="0.30"/><circle cx="216" cy="195" r="145" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.20"/><circle cx="216" cy="195" r="170" fill="none" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.12"/></svg></div>`;

    case "slate":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><circle cx="216" cy="192" r="155" fill="${ac}" fill-opacity="0.18"/><circle cx="216" cy="192" r="118" fill="${ac}" fill-opacity="0.22"/><circle cx="216" cy="192" r="82" fill="${ac}" fill-opacity="0.30"/><circle cx="216" cy="192" r="48" fill="${ac}" fill-opacity="0.55"/><circle cx="216" cy="192" r="20" fill="${ac}" fill-opacity="0.88"/><line x1="216" y1="5" x2="216" y2="379" stroke="${ac}" stroke-width="2" stroke-opacity="0.28"/><line x1="5" y1="192" x2="427" y2="192" stroke="${ac}" stroke-width="2" stroke-opacity="0.28"/><circle cx="216" cy="192" r="175" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.12"/></svg></div>`;

    case "sunrise":
      return `<div style="${cs};background:#FDF0E0;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="#FDF0E0"/><line x1="216" y1="384" x2="28" y2="175" stroke="${ac}" stroke-width="2" stroke-opacity="0.20"/><line x1="216" y1="384" x2="75" y2="165" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.16"/><line x1="216" y1="384" x2="132" y2="160" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.16"/><line x1="216" y1="384" x2="174" y2="158" stroke="${ac}" stroke-width="2" stroke-opacity="0.22"/><line x1="216" y1="384" x2="216" y2="155" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.28"/><line x1="216" y1="384" x2="258" y2="158" stroke="${ac}" stroke-width="2" stroke-opacity="0.22"/><line x1="216" y1="384" x2="300" y2="160" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.16"/><line x1="216" y1="384" x2="357" y2="165" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.16"/><line x1="216" y1="384" x2="404" y2="175" stroke="${ac}" stroke-width="2" stroke-opacity="0.20"/><path d="M 86,384 A 130,130 0 0,1 346,384 Z" fill="${ac}" fill-opacity="0.80"/><path d="M 112,384 A 104,104 0 0,1 320,384 Z" fill="${ac}" fill-opacity="0.50"/><line x1="0" y1="336" x2="432" y2="336" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.30"/><ellipse cx="90" cy="120" rx="60" ry="26" fill="white" fill-opacity="0.70"/><ellipse cx="58" cy="126" rx="38" ry="22" fill="white" fill-opacity="0.70"/><ellipse cx="125" cy="128" rx="34" ry="20" fill="white" fill-opacity="0.70"/><ellipse cx="348" cy="150" rx="52" ry="22" fill="white" fill-opacity="0.62"/><ellipse cx="318" cy="156" rx="32" ry="18" fill="white" fill-opacity="0.62"/></svg></div>`;

    case "teal":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><polygon points="216,60 304,110 304,210 216,260 128,210 128,110" fill="none" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.45"/><polygon points="216,20 336,88 336,224 216,292 96,224 96,88" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.28"/><polygon points="216,0 380,94 380,286 216,380 52,286 52,94" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.16"/><polygon points="216,88 280,124 280,196 216,232 152,196 152,124" fill="${ac}" fill-opacity="0.55"/><polygon points="216,112 260,136 260,184 216,208 172,184 172,136" fill="${bg}" fill-opacity="0.60"/><circle cx="216" cy="160" r="24" fill="${ac}" fill-opacity="0.80"/><path d="M0,340 Q108,310 216,340 Q324,370 432,340 L432,384 L0,384 Z" fill="${ac}" fill-opacity="0.18"/></svg></div>`;

    case "parchment":
      return `<div style="${cs};background:#F5E4C0;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="#F5E4C0"/><line x1="60" y1="100" x2="372" y2="100" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><line x1="60" y1="136" x2="372" y2="136" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><line x1="60" y1="172" x2="372" y2="172" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><line x1="60" y1="208" x2="372" y2="208" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><line x1="60" y1="244" x2="372" y2="244" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><line x1="60" y1="280" x2="372" y2="280" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.22"/><path d="M 310,20 C 330,8 380,15 400,38 C 380,35 358,42 340,62 L 290,130 C 270,158 255,175 235,185 C 245,165 248,140 240,120 Z" fill="${ac}" fill-opacity="0.55"/><path d="M 310,20 C 280,28 260,50 240,80 L 200,145 C 185,170 175,185 160,195 C 170,172 175,145 166,122 C 200,140 215,118 235,85 C 250,60 275,35 310,20 Z" fill="${ac}" fill-opacity="0.38"/><path d="M 160,195 L 100,310 C 95,320 88,330 80,340" stroke="${ac}" stroke-width="3" stroke-linecap="round" fill="none" stroke-opacity="0.65"/><circle cx="83" cy="345" r="6" fill="${ac}" fill-opacity="0.55"/><circle cx="74" cy="352" r="3.5" fill="${ac}" fill-opacity="0.35"/><circle cx="90" cy="354" r="2.5" fill="${ac}" fill-opacity="0.30"/><line x1="88" y1="0" x2="88" y2="384" stroke="${ac}" stroke-width="1.2" stroke-opacity="0.30"/></svg></div>`;

    case "sky":
      return `<div style="${cs};background:#E0EFFF;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="#E0EFFF"/><circle cx="355" cy="52" r="42" fill="${ac}" fill-opacity="0.88"/><line x1="355" y1="0" x2="355" y2="12" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="355" y1="92" x2="355" y2="104" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="303" y1="52" x2="291" y2="52" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="407" y1="52" x2="419" y2="52" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="318" y1="16" x2="310" y2="8" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="392" y1="88" x2="400" y2="96" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="318" y1="88" x2="310" y2="96" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><line x1="392" y1="16" x2="400" y2="8" stroke="${ac}" stroke-width="2.5" stroke-opacity="0.55"/><ellipse cx="130" cy="142" rx="72" ry="34" fill="white" fill-opacity="0.88"/><ellipse cx="92" cy="150" rx="48" ry="30" fill="white" fill-opacity="0.88"/><ellipse cx="170" cy="152" rx="46" ry="28" fill="white" fill-opacity="0.88"/><ellipse cx="268" cy="218" rx="80" ry="36" fill="white" fill-opacity="0.78"/><ellipse cx="226" cy="226" rx="52" ry="30" fill="white" fill-opacity="0.78"/><ellipse cx="312" cy="227" rx="48" ry="28" fill="white" fill-opacity="0.78"/><ellipse cx="100" cy="290" rx="64" ry="28" fill="white" fill-opacity="0.68"/><ellipse cx="64" cy="297" rx="40" ry="24" fill="white" fill-opacity="0.68"/><ellipse cx="138" cy="298" rx="38" ry="22" fill="white" fill-opacity="0.68"/><path d="M 200,170 L 215,160 L 230,170" fill="none" stroke="${ac}" stroke-width="2" stroke-opacity="0.45"/><path d="M 245,152 L 262,140 L 279,152" fill="none" stroke="${ac}" stroke-width="2" stroke-opacity="0.40"/></svg></div>`;

    default:
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><circle cx="216" cy="192" r="85" fill="${ac}" fill-opacity="0.55"/><circle cx="216" cy="192" r="115" fill="none" stroke="${ac}" stroke-width="2" stroke-opacity="0.25"/><circle cx="216" cy="192" r="148" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.15"/></svg></div>`;
  }
}

export function buildCoverHTML(opts: CoverBuildOpts, totalPages: number): CoverResult {
  const th = THEMES[opts.theme || "midnight"] || THEMES.midnight;
  const bg = opts.customBg || th.bg;
  const ac = opts.customAccent || th.ac;
  const tx = opts.customText || th.tx;
  const isDark = th.isDark;
  const gradTop = th.gradTop;

  // Gradient for dark themes: subtle top-to-bottom lightening; light themes stay flat
  const bgGrad = isDark ? `linear-gradient(to bottom, ${gradTop}, ${bg})` : bg;
  // Title on bg panel — white for dark themes, dark tx for light themes
  const titleOnBg = isDark ? "#ffffff" : tx;
  // Sidebar meta must contrast with the accent-colored sidebar (bright for dark, dark for light)
  const sidebarMeta = isDark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";

  // Physical trim size matches interior: Large Print = 8.5"x11", Standard = 6"x9"
  const bleed = 0.125;
  const trimW = opts.largePrint !== false ? 8.5 : 6;
  const trimH = opts.largePrint !== false ? 11 : 9;
  const thick = opts.paperType === "cream" ? 0.0025 : 0.002252;
  const spineW = totalPages * thick + 0.06;
  const fullW = bleed + trimW + spineW + trimW + bleed;
  const fullH = bleed + trimH + bleed;
  const spineX = bleed + trimW, frontX = spineX + spineW;

  const title = escapeHtml(opts.title || "Book Title");
  const sub = escapeHtml(opts.subtitle || "");
  const author = escapeHtml(opts.author || "Eleanor Bennett");
  const ptLabel = opts.puzzleType || "Word Search";
  const diffLabel = opts.difficulty || "Medium";
  const lpLabel2 = opts.largePrint !== false ? ` Large print formatting for comfortable solving.` : "";
  const PC = opts.puzzleCount ?? 100;
  const backDesc = escapeHtml(opts.backDescription ||
    `${PC} carefully crafted ${diffLabel} ${ptLabel} puzzles designed for stress-free brain training. Each puzzle is presented on its own page with generous space for working through solutions.${lpLabel2} A full answer key is included at the back.`);
  const lpMeta = opts.largePrint !== false ? " | Large Print" : "";
  const meta = `${PC} ${opts.puzzleType || "Word Search"} Puzzles | ${opts.difficulty || "Medium"}${lpMeta}`;

  const vn = opts.volumeNumber ?? 0;
  const titleWordCount = (opts.title || "Book Title").trim().split(/\s+/).length;
  const seriesBadge = (vn >= 1 && vn <= 3)
    ? `<div style="position:absolute;top:0.6in;right:0.6in;z-index:10;padding:4px 10px;border:1.5px solid ${ac}88;border-radius:3px;font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:${ac};">Volume ${vn}</div>`
    : "";

  // Audience/format callout derived from the book's own fields.
  // Matches the layout default: largePrint !== false means large-print is on.
  const isLargePrint = opts.largePrint !== false;

  // Sell points — include word count (wpp: LP=20, std=25) and LARGE PRINT tag when applicable
  const wppu = isLargePrint ? 20 : 25;
  const totalWords = PC * wppu;
  const lpSellTag = isLargePrint ? " | LARGE PRINT" : "";
  const sellPts = `${PC} PUZZLES | ${totalWords.toLocaleString()} WORDS | ${(opts.difficulty || "MEDIUM").toUpperCase()}${lpSellTag} | SOLUTIONS INCLUDED`;
  const sellDiv = `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;text-transform:uppercase;margin-bottom:12px;">${sellPts}</div>`;
  const ptBadge = (opts.puzzleType || "Puzzle Book").toUpperCase();
  const dfBadge = (opts.difficulty || "MEDIUM").toUpperCase();
  const audienceParts: string[] = ["FOR ALL AGES"];
  if (isLargePrint) audienceParts.push("LARGE PRINT");
  audienceParts.push(`${dfBadge}`);
  audienceParts.push(ptBadge);
  const audienceLabel = audienceParts.join(" · ");
  const audienceCallout = `<div style="font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:4px;text-transform:uppercase;color:${ac};opacity:0.95;margin-bottom:16px;">${audienceLabel}</div>`;

  // Puzzle-type-specific texture watermark at 5% opacity — no external assets
  const txMap: Record<string, string> = {
    "Word Search":   "ABCDEFGHIJKLMNOPQRSTUVWXYZ FINDWORDSEARCHPUZZLE ABCDEFGHIJKLMNOPQRSTUVWXYZ BRAINSOLVETHINKGAME ",
    "Sudoku":        "123456789 147258369 293847165 618374529 456192738 789516234 SUDOKU SOLVE LOGIC ",
    "Number Search": "1234567890 9876543210 1357924680 2468013579 5647382910 NUMBERSEARCH FIND ",
    "Maze":          "│─┐┘└┌├┤┬┴┼│─┐┘└┌┤│─┐┘└┌ MAZE PATH SOLVE FIND NAVIGATE ",
    "Cryptogram":    "A=Z B=Y C=X D=W E=V F=U G=T H=S I=R J=Q K=P L=O M=N N=M CIPHER CODE DECODE ",
  };
  const txLetters = txMap[opts.puzzleType || "Word Search"] || txMap["Word Search"];
  const puzzleTexture = `<div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;z-index:0;pointer-events:none;font-family:'Source Code Pro',monospace;font-size:13px;letter-spacing:5px;line-height:2;padding:0.3in;opacity:0.05;color:${ac};word-break:break-all;">${txLetters.repeat(20)}</div>`;


  // Sanitize coverImageUrl: allow http(s) URLs (SSRF-validated) or data: URLs from Gemini image generation
  const rawUrl = opts.coverImageUrl || "";
  function isSafeImageUrl(url: string): boolean {
    // Allow base64 data URLs (generated by Gemini image generation on server-side)
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      // Block loopback, link-local, private ranges, and metadata endpoints
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
      if (/^10\.\d+\.\d+\.\d+$/.test(host)) return false;
      if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return false;
      if (/^192\.168\.\d+\.\d+$/.test(host)) return false;
      if (/^169\.254\.\d+\.\d+$/.test(host)) return false;
      if (host === "0.0.0.0" || host === "metadata.google.internal") return false;
      return true;
    } catch { return false; }
  }
  // Data URLs don't need HTML-escaping of the URL itself since they're used inside src="..."
  const safeImgUrl = isSafeImageUrl(rawUrl)
    ? (rawUrl.startsWith("data:") ? rawUrl : rawUrl.replace(/"/g, "%22").replace(/'/g, "%27").replace(/</g, "%3C").replace(/>/g, "%3E"))
    : "";

  // Image block: safe URL → fixed 4.5in × 4in centered img with accent border & shadow;
  // no URL → themed CSS/SVG art for all 10 themes (buildThemeCoverArt)
  let imageBlock = "";
  if (safeImgUrl) {
    imageBlock = `<div style="width:4.5in;height:4in;margin:0 auto 16px;border-radius:8px;overflow:hidden;border:2px solid ${ac};box-shadow:0 4px 24px rgba(0,0,0,0.35);flex-shrink:0;"><img src="${safeImgUrl}" alt="Cover Image" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`;
  } else {
    imageBlock = buildThemeCoverArt(opts.theme || "midnight", ac, bg);
  }

  // Back cover: exactly 5-line centered checkmark list (spec-required wording/order, always 5 lines)
  const formatLabel = isLargePrint ? "Large Print Format (8.5\u22c5 × 11\")" : "Standard Format (6\" × 9\")";
  const cleanFeatures = [
    `&#10003; ${PC} Unique Puzzles`,
    `&#10003; ${opts.difficulty || "Medium"} Difficulty Level`,
    `&#10003; ${formatLabel}`,
    `&#10003; One Puzzle Per Page`,
    `&#10003; Complete Solutions Included`,
  ];
  const featureList = cleanFeatures.map(f => `<div style="font-family:'Source Code Pro',monospace;font-size:10px;color:${tx};line-height:2.2;opacity:0.70;text-align:center;">${f}</div>`).join("");

  const back = `<div style="position:absolute;left:${bleed}in;top:${bleed}in;width:${trimW}in;height:${trimH}in;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5in 1in;text-align:center;box-sizing:border-box;">` +
    `<div style="font-family:Lora,serif;font-size:16px;color:${tx}dd;line-height:1.8;margin-bottom:28px;">${backDesc}</div>` +
    `<div style="margin-bottom:28px;">${featureList}</div>` +
    `<div style="width:50px;height:1px;background:${ac};margin-bottom:30px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:13px;color:${tx};margin-bottom:12px;">${author}</div>` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${tx}cc;">${meta}</div>` +
    `<div style="position:absolute;bottom:0.5in;right:0.4in;width:2in;height:1.2in;border:1px dashed ${ac}44;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Source Code Pro',monospace;font-size:7px;color:${ac}88;">BARCODE AREA</div></div></div>`;

  // Spine: larger + bolder text
  const spine = totalPages >= 130
    ? `<div style="position:absolute;left:${spineX}in;top:${bleed}in;width:${spineW}in;height:${trimH}in;background:${bg};display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(-90deg);white-space:nowrap;font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx};text-transform:uppercase;font-weight:600;">${title}${author ? " — " + author : ""}</div></div>`
    : `<div style="position:absolute;left:${spineX}in;top:${bleed}in;width:${spineW}in;height:${trimH}in;background:${bg};"></div>`;

  const fb = `position:absolute;left:${frontX}in;top:${bleed}in;width:${trimW}in;height:${trimH}in;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;color:${tx};font-family:Lora,serif;box-sizing:border-box;overflow:hidden;`;
  const cs = opts.coverStyle || "classic";

  // Prominent LARGE PRINT banner — full-width accent-colored strip, clearly visible in thumbnail
  const bannerTx = isDark ? "#111" : "#fff";
  const lpBanner = isLargePrint
    ? `<div style="background:${ac};padding:7px 16px;margin-bottom:16px;text-align:center;letter-spacing:6px;font-family:'Source Code Pro',monospace;font-size:13px;font-weight:700;color:${bannerTx};text-transform:uppercase;width:100%;box-sizing:border-box;">✦ LARGE PRINT EDITION ✦</div>`
    : "";

  let front = "";

  if (cs === "luxury") {
    // Double-frame centered layout. Exact 9-section order: (volume badge abs) → puzzleType label → thin rule → title UPPERCASE → subtitle → imageBlock → selling points → author → metadata
    front = `<div style="${fb}padding:0;">${puzzleTexture}${seriesBadge}` +
      `<div style="position:absolute;top:0.22in;left:0.22in;right:0.22in;bottom:0.22in;border:1px solid ${ac}55;z-index:1;"></div>` +
      `<div style="position:absolute;top:0.4in;left:0.4in;right:0.4in;bottom:0.4in;border:3px solid ${ac};z-index:1;"></div>` +
      `<div style="text-align:center;z-index:2;position:relative;padding:0 0.8in;">` +
      `${opts.puzzleType ? `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:6px;text-transform:uppercase;color:${ac};margin-bottom:14px;opacity:0.85;">${opts.puzzleType}</div>` : ""}` +
      `<div style="width:40px;height:1px;background:${ac};margin:0 auto 16px;"></div>` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:62px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:${tx};margin-bottom:14px;line-height:1.2;">${title}</div>` +
      `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:16px;">${sub}</div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="width:40px;height:1px;background:${ac};margin:0 auto 14px;"></div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;margin-bottom:10px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else if (cs === "geometric") {
    // Two angled accent bands — title always on band. Section order: audienceCallout → title → subtitle → imageBlock → sellDiv → author
    front = `<div style="${fb}padding:1in;">${puzzleTexture}${seriesBadge}` +
      `<div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;overflow:hidden;">` +
      `<div style="position:absolute;top:18%;left:-10%;width:130%;height:38%;background:${ac};transform:rotate(-30deg);opacity:0.85;"></div>` +
      `<div style="position:absolute;top:52%;left:-10%;width:130%;height:7%;background:${ac};transform:rotate(-30deg);opacity:0.4;"></div>` +
      `</div>` +
      `<div style="position:relative;z-index:1;text-align:left;width:100%;">` +
      `${audienceCallout}` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:68px;font-weight:700;color:${titleOnBg};line-height:1.05;margin-bottom:16px;text-shadow:2px 2px 12px rgba(0,0,0,0.4);">${title}</div>` +
      `<div style="font-size:19px;color:${tx}ee;letter-spacing:0.5px;margin-bottom:14px;">${sub}</div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;">${author}</div>` +
      `</div>` +
      `<div style="position:absolute;bottom:1in;left:1in;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;z-index:1;">${meta}</div>` +
      `</div>`;

  } else if (cs === "bold") {
    // Wider accent sidebar (42%). Section order in content area: audienceCallout → title → subtitle → imageBlock → sellDiv → author
    front = `<div style="${fb}flex-direction:row;padding:0;">${seriesBadge}` +
      `<div style="width:42%;height:100%;background:${ac};display:flex;flex-direction:column;justify-content:flex-end;padding:0.8in 0.4in;box-sizing:border-box;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${sidebarMeta};">${meta}</div>` +
      `</div>` +
      `<div style="width:58%;display:flex;flex-direction:column;justify-content:center;padding:1in 0.7in;position:relative;overflow:hidden;">` +
      `${puzzleTexture}` +
      `<div style="position:relative;z-index:1;">` +
      `${audienceCallout}` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:64px;font-weight:700;color:${titleOnBg};line-height:1.05;margin-bottom:14px;">${title}</div>` +
      `<div style="font-size:19px;color:${ac};font-style:italic;letter-spacing:0.5px;margin-bottom:12px;">${sub}</div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;">${author}</div>` +
      `</div></div></div>`;

  } else if (cs === "minimal") {
    // Triple-stripe accent mark. Section order: stripes → audienceCallout → title → subtitle → imageBlock → sellDiv → author → meta
    front = `<div style="${fb}padding:1in;text-align:left;">${puzzleTexture}${seriesBadge}` +
      `<div style="position:relative;z-index:1;width:100%;">` +
      `<div style="margin-bottom:32px;">` +
      `<div style="width:56px;height:3px;background:${ac};margin-bottom:6px;"></div>` +
      `<div style="width:40px;height:1px;background:${ac};opacity:0.6;margin-bottom:6px;"></div>` +
      `<div style="width:24px;height:1px;background:${ac};opacity:0.3;"></div>` +
      `</div>` +
      `${audienceCallout}` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:64px;font-weight:700;color:${tx};line-height:1.05;margin-bottom:20px;letter-spacing:1px;">${title}</div>` +
      `${sub ? `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:16px;">${sub}</div>` : ""}` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;color:${tx}ee;margin-bottom:16px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else if (cs === "retro") {
    // Concentric double-border. Section order: star label → audienceCallout → title → subtitle → rule → imageBlock → sellDiv → author → meta → star footer
    front = `<div style="${fb}padding:0.6in;text-align:center;">${puzzleTexture}${seriesBadge}` +
      `<div style="width:100%;height:100%;border:8px double ${ac};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.5in;box-sizing:border-box;position:relative;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:6px;color:${ac};text-transform:uppercase;margin-bottom:12px;">★ &nbsp; ${opts.puzzleType || "Puzzles"} &nbsp; ★</div>` +
      `${audienceCallout}` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:60px;font-weight:700;color:${tx};line-height:1.05;margin-bottom:12px;text-transform:uppercase;letter-spacing:2px;">${title}</div>` +
      `${sub ? `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:12px;">${sub}</div>` : ""}` +
      `<div style="width:80px;height:2px;background:${ac};margin:8px auto 14px;"></div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;color:${tx}ee;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;margin-top:12px;">${meta}</div>` +
      `<div style="position:absolute;bottom:0.2in;left:0;right:0;text-align:center;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:4px;color:${ac};opacity:0.7;">★ &nbsp; ★ &nbsp; ★</div>` +
      `</div></div>`;

  } else if (cs === "warmth") {
    // Warm, welcoming layout. Section order: ornament → audienceCallout → title → ornament divider → subtitle → imageBlock → sellDiv → author → meta
    front = `<div style="${fb}text-align:center;padding:1in;">${puzzleTexture}` +
      `<div style="position:absolute;top:8%;left:8%;width:70px;height:70px;border:1px solid ${ac};border-radius:50%;opacity:0.20;"></div>` +
      `<div style="position:absolute;bottom:8%;right:8%;width:90px;height:90px;border:1px solid ${ac};border-radius:50%;opacity:0.18;"></div>` +
      `${seriesBadge}` +
      `<div style="position:relative;z-index:1;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:22px;color:${ac};opacity:0.9;margin-bottom:20px;letter-spacing:4px;">✦</div>` +
      `${audienceCallout}` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:${titleWordCount <= 3 ? "72" : "62"}px;font-weight:700;color:${isDark ? tx : ac};line-height:1.1;margin-bottom:22px;padding:0 0.2in;">${title}</div>` +
      `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">` +
      `<div style="flex:1;max-width:60px;height:1px;background:${ac};opacity:0.6;"></div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:14px;color:${ac};">✦</div>` +
      `<div style="flex:1;max-width:60px;height:1px;background:${ac};opacity:0.6;"></div>` +
      `</div>` +
      `<div style="font-size:19px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:20px;">${sub}</div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:12px;color:${tx}ee;margin-bottom:10px;letter-spacing:2px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else {
    // classic (default). Exact 9-section order: (volume badge abs) → puzzleType label → thin rule → title UPPERCASE → subtitle → imageBlock → selling points → author → metadata
    front = `<div style="${fb}text-align:center;padding:1in;">${puzzleTexture}${seriesBadge}` +
      `<div style="position:relative;z-index:1;">` +
      `${opts.puzzleType ? `<div style="font-family:'Source Code Pro',monospace;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:${ac};margin-bottom:12px;">${opts.puzzleType}</div>` : ""}` +
      `<div style="width:56px;height:2px;background:${ac};margin:0 auto 28px;"></div>` +
      `${lpBanner}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:${titleWordCount <= 3 ? "68" : "60"}px;font-weight:700;text-transform:uppercase;color:${ac};line-height:1.1;margin-bottom:18px;padding:0 0.3in;">${title}</div>` +
      `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:16px;">${sub}</div>` +
      `${imageBlock}` +
      `${sellDiv}` +
      `<div style="width:56px;height:2px;background:${ac};margin:0 auto 22px;"></div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:13px;letter-spacing:3px;color:${tx}ee;margin-bottom:16px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;
  }

  const coverHtml = `<!DOCTYPE html><html style="background-color:${bg};"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Oswald:wght@700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:${fullW.toFixed(4)}in ${fullH.toFixed(4)}in;margin:0;}body{width:${fullW.toFixed(4)}in;height:${fullH.toFixed(4)}in;overflow:hidden;position:relative;background:${bg};print-color-adjust:exact;-webkit-print-color-adjust:exact;}</style></head><body>${back}${spine}${front}</body></html>`;

  return { html: coverHtml, fullW, fullH, spineW };
}

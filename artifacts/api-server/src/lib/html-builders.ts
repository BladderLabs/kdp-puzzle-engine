import {
  shuf, makeWordSearch, makeSudoku, makeMaze, makeNumberSearch,
  makeCryptogramFromQuote, WORD_BANKS, QUOTE_BANK,
} from "./puzzles";

/** Compute total page count from config without generating any puzzles. */
export function computeTotalPages(opts: BuildOpts): number {
  const PT = opts.puzzleType || "Word Search";
  const PC = opts.puzzleCount || 100;
  const LP = opts.largePrint !== false;
  const aPer = PT === "Word Search" ? (LP ? 4 : 6)
    : PT === "Sudoku" ? (LP ? 6 : 8)
    : PT === "Maze" ? (LP ? 4 : 6)
    : PT === "Number Search" ? (LP ? 9 : 12)
    : (LP ? 6 : 8);
  return 3 + PC + Math.ceil(PC / aPer);
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

  for (let i = 0; i < PC; i++) {
    switch (PT) {
      case "Word Search":
        puzzles.push(makeWordSearch(shuf(wordBank).slice(0, Math.min(wordBank.length, wpp)), gsz));
        break;
      case "Sudoku":
        puzzles.push(makeSudoku(DF));
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
      default:
        puzzles.push(makeWordSearch(shuf(wordBank).slice(0, Math.min(wordBank.length, wpp)), gsz));
    }
  }

  const aPer = PT === "Word Search" ? (LP ? 4 : 6)
    : PT === "Sudoku" ? (LP ? 6 : 8)
    : PT === "Maze" ? (LP ? 4 : 6)
    : PT === "Number Search" ? (LP ? 9 : 12)
    : (LP ? 6 : 8); // Cryptogram

  // Physical trim size: Large Print = 8.5"x11", Standard = 6"x9"
  const trimW = LP ? 8.5 : 6;
  const trimH = LP ? 11 : 9;

  const aP = Math.ceil(PC / aPer);
  const totP = 3 + PC + aP;
  const gut = Math.max(0.5, gutterIn(totP));
  const pS = 5, aS = pS + PC;

  // Decorative rule between label and grid (shared across all puzzle types)
  const ornamentRule = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><div style="flex:1;height:1px;background:#ccc;"></div><div style="font-family:'Source Code Pro',monospace;font-size:10px;color:#aaa;">◆</div><div style="flex:1;height:1px;background:#ccc;"></div></div>`;

  // Per-puzzle progress indicator: difficulty dots + time estimate + checkbox
  const diffDots = DF === "Easy" ? "\u25CF\u25CF\u25CB\u25CB\u25CB"
    : DF === "Hard" ? "\u25CF\u25CF\u25CF\u25CF\u25CF"
    : "\u25CF\u25CF\u25CF\u25CB\u25CB";
  const timeMap: Record<string, Record<string, string>> = {
    "Word Search":   { Easy: "~5 min",  Medium: "~10 min", Hard: "~20 min" },
    "Sudoku":        { Easy: "~10 min", Medium: "~20 min", Hard: "~40 min" },
    "Maze":          { Easy: "~3 min",  Medium: "~8 min",  Hard: "~15 min" },
    "Number Search": { Easy: "~5 min",  Medium: "~10 min", Hard: "~20 min" },
    "Cryptogram":    { Easy: "~3 min",  Medium: "~8 min",  Hard: "~15 min" },
  };
  const timeEst = (timeMap[PT] || timeMap["Word Search"])[DF] || "~10 min";
  const progressBadge = `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fafafa;"><span style="letter-spacing:3px;font-size:11px;color:#555;">${diffDots}</span><span style="font-size:9px;color:#777;font-family:'Source Code Pro',monospace;">${timeEst}</span><span style="display:inline-block;width:12px;height:12px;border:1.5px solid #aaa;border-radius:2px;margin-left:2px;"></span></span>`;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${T}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">` +
    `<style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:${trimW}in ${trimH}in;margin:0;}` +
    `.pg{width:${trimW}in;min-height:${trimH}in;page-break-after:always;position:relative;overflow:hidden;}` +
    `.pg:last-child{page-break-after:auto;}` +
    `.in{padding:0.55in 0.4in 0.6in ${gut}in;background:#fff;}` +
    `.hd{display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:8px;color:#666;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;}` +
    `.ft{position:absolute;bottom:0.25in;left:${gut}in;right:0.4in;display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:9px;color:#777;border-top:1px solid #ddd;padding-top:4px;}` +
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

  // ── How-to-Play page ─────────────────────────────────────────────────────
  const htxtMap: Record<string, string> = {
    "Word Search": "Each puzzle contains a grid of letters with hidden words. Words can run horizontally, vertically, or diagonally — both forward and backward. Find every word in the bank below each grid.",
    "Sudoku": "Fill empty cells so every row, column, and 3&times;3 box contains digits 1-9 exactly once.",
    "Maze": "Find your way from the START (top-left) to the FINISH (bottom-right) by following open passages. No diagonal moves — up, down, left, right only.",
    "Number Search": "Find all the number sequences hidden in the grid. Numbers can run horizontally, vertically, or diagonally — both forward and backward.",
    "Cryptogram": "Each puzzle contains a famous quote encoded with a substitution cipher. Every letter has been replaced by a different letter. Decode the cipher to reveal the hidden message.",
  };
  const tipMap: Record<string, string> = {
    "Word Search": "Scan for uncommon letters like Q, Z, X first.",
    "Sudoku": "Write small pencil marks for candidates.",
    "Maze": "Try working backward from the finish for harder mazes.",
    "Number Search": "Look for repeated digits as anchors.",
    "Cryptogram": "Short words (A, I, THE, AND) reveal common patterns.",
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
  }

  html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; ${PT}</span></div>` +
    `<div style="padding-top:0.3in;"><div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:12px;">How to Play</div>` +
    `<div style="width:56px;height:2px;background:#333;margin-bottom:20px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:13px;line-height:1.8;color:#333;margin-bottom:22px;">${htxt}</div>` +
    miniEx +
    `<div style="border-left:3px solid #333;background:#f9f9f6;padding:14px 18px;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:#333;font-weight:600;margin-bottom:6px;">TIP</div>` +
    `<div style="font-family:Lora,serif;font-size:12px;color:#444;">${tip}</div></div>` +
    (LP ? `<div style="margin-top:20px;font-family:Source Code Pro,monospace;font-size:10px;letter-spacing:2px;color:#666;text-align:center;">LARGE PRINT EDITION</div>` : "") +
    `</div><div class="ft"><span>${T} — ${AU}</span><span>3</span></div></div>`;

  // ── Table of Contents ────────────────────────────────────────────────────
  let tocR = "";
  const mx = Math.min(PC, 42);
  for (let i = 0; i < mx; i++)
    tocR += `<div style="display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:11px;color:#555;padding:2px 0;border-bottom:1px dotted #ddd;"><span>Puzzle #${String(i + 1).padStart(2, "0")}</span><span>${pS + i}</span></div>`;
  if (PC > 42)
    tocR += `<div style="font-family:Lora,serif;font-size:11px;color:#777;padding:6px 0;font-style:italic;">&hellip; and ${PC - 42} more</div>`;
  html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; ${PT}</span></div>` +
    `<div style="padding-top:0.3in;"><div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:16px;">Table of Contents</div>` +
    `<div style="columns:2;column-gap:32px;">${tocR}</div>` +
    `<div style="margin-top:20px;font-family:'Source Code Pro',monospace;font-size:10px;color:#333;letter-spacing:2px;font-weight:600;">ANSWER KEY &mdash; PAGE ${aS}</div></div>` +
    `<div class="ft"><span>${T} — ${AU}</span><span>4</span></div></div>`;

  // ── Puzzle pages ─────────────────────────────────────────────────────────
  for (let i = 0; i < PC; i++) {
    const pN = pS + i;
    const lb = "#" + String(i + 1).padStart(2, "0");
    const pz = puzzles[i] as Record<string, unknown>;
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
      html += `<div class="pg in"><div class="hd"><span>${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">WORD SEARCH</span></div>${ornamentRule}${g}${ch}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">SUDOKU</span></div>${ornamentRule}${g}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">MAZE</span></div>${ornamentRule}${g}<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#777;margin-top:6px;text-align:center;">S = Start &nbsp;&nbsp; F = Finish</div>${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span>${progressBadge}</div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">NUMBER SEARCH</span></div>${ornamentRule}${g}${ch}${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span>${progressBadge}</div><div style="padding-top:0.2in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">CRYPTOGRAM</span></div>${ornamentRule}<div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 16 : 13}px;color:#222;line-height:2.8;word-spacing:4px;">${cipherDisplay}</div><div style="margin-top:20px;">${cgKeyTable}</div>${lpSep}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Word Search</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Number Search</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Sudoku</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Maze</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Cryptogram</span></div><div style="padding-top:0.2in;">${akBanner}${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
      akP++;
    }
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
  midnight:  { bg: "#0A0A14", ac: "#F0C040", tx: "#F5F0E0", isDark: true,  gradTop: "#1E1E3A" },
  forest:    { bg: "#0A1208", ac: "#50C050", tx: "#E8F5E8", isDark: true,  gradTop: "#182814" },
  crimson:   { bg: "#1A0505", ac: "#FF6B35", tx: "#FFF0E8", isDark: true,  gradTop: "#381010" },
  ocean:     { bg: "#050A18", ac: "#40B0FF", tx: "#E0F0FF", isDark: true,  gradTop: "#101830" },
  violet:    { bg: "#120818", ac: "#B06AFF", tx: "#F0E8FF", isDark: true,  gradTop: "#221428" },
  slate:     { bg: "#0E0E0E", ac: "#FF9E3D", tx: "#FFF5E8", isDark: true,  gradTop: "#252525" },
  sunrise:   { bg: "#1A0A08", ac: "#FF4060", tx: "#FFF0F0", isDark: true,  gradTop: "#321412" },
  teal:      { bg: "#081210", ac: "#30D0B0", tx: "#E0FFF8", isDark: true,  gradTop: "#152822" },
  parchment: { bg: "#F7EDD8", ac: "#7B3F00", tx: "#1E0F00", isDark: false, gradTop: "#F7EDD8" },
  sky:       { bg: "#EBF4FF", ac: "#1A3A6B", tx: "#0D1B2A", isDark: false, gradTop: "#EBF4FF" },
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
    case "ocean":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><defs><linearGradient id="og1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${ac}" stop-opacity="0.3"/></linearGradient></defs><rect width="432" height="384" fill="url(#og1)"/><path d="M0 200 Q54 160 108 200 Q162 240 216 200 Q270 160 324 200 Q378 240 432 200 L432 384 L0 384 Z" fill="${ac}" fill-opacity="0.2"/><path d="M0 235 Q54 195 108 235 Q162 275 216 235 Q270 195 324 235 Q378 275 432 235 L432 384 L0 384 Z" fill="${ac}" fill-opacity="0.28"/><path d="M0 268 Q54 228 108 268 Q162 308 216 268 Q270 228 324 268 Q378 308 432 268 L432 384 L0 384 Z" fill="${ac}" fill-opacity="0.38"/><circle cx="216" cy="96" r="44" fill="${ac}" fill-opacity="0.15"/><circle cx="216" cy="96" r="32" fill="${ac}" fill-opacity="0.12"/><circle cx="80" cy="55" r="2" fill="${ac}" fill-opacity="0.5"/><circle cx="155" cy="32" r="1.5" fill="${ac}" fill-opacity="0.4"/><circle cx="348" cy="44" r="2" fill="${ac}" fill-opacity="0.5"/><circle cx="395" cy="75" r="1.5" fill="${ac}" fill-opacity="0.35"/><circle cx="290" cy="28" r="1.5" fill="${ac}" fill-opacity="0.3"/><line x1="180" y1="140" x2="252" y2="140" stroke="${ac}" stroke-width="1" stroke-opacity="0.25"/></svg></div>`;
    case "midnight":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><circle cx="43" cy="52" r="2" fill="${ac}" fill-opacity="0.5"/><circle cx="97" cy="31" r="1.5" fill="${ac}" fill-opacity="0.4"/><circle cx="152" cy="67" r="2.5" fill="${ac}" fill-opacity="0.55"/><circle cx="210" cy="22" r="1.5" fill="${ac}" fill-opacity="0.35"/><circle cx="271" cy="58" r="2" fill="${ac}" fill-opacity="0.45"/><circle cx="318" cy="38" r="1.5" fill="${ac}" fill-opacity="0.4"/><circle cx="376" cy="72" r="2" fill="${ac}" fill-opacity="0.5"/><circle cx="62" cy="115" r="1.5" fill="${ac}" fill-opacity="0.3"/><circle cx="132" cy="98" r="1" fill="${ac}" fill-opacity="0.35"/><circle cx="248" cy="88" r="1.5" fill="${ac}" fill-opacity="0.4"/><circle cx="390" cy="110" r="1" fill="${ac}" fill-opacity="0.3"/><circle cx="44" cy="175" r="1" fill="${ac}" fill-opacity="0.25"/><circle cx="188" cy="145" r="1.5" fill="${ac}" fill-opacity="0.3"/><circle cx="342" cy="158" r="1" fill="${ac}" fill-opacity="0.25"/><circle cx="416" cy="135" r="1.5" fill="${ac}" fill-opacity="0.3"/><circle cx="216" cy="155" r="52" fill="${ac}" fill-opacity="0.18"/><circle cx="232" cy="140" r="44" fill="${bg}"/><circle cx="216" cy="155" r="68" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.18"/><circle cx="216" cy="155" r="90" fill="none" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.1"/><ellipse cx="216" cy="340" rx="180" ry="28" fill="${ac}" fill-opacity="0.05"/></svg></div>`;
    case "forest":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><rect width="432" height="210" fill="${ac}" fill-opacity="0.06"/><polygon points="109,145 50,280 168,280" fill="${ac}" fill-opacity="0.28"/><polygon points="109,88 28,210 190,210" fill="${ac}" fill-opacity="0.20"/><polygon points="207,112 142,265 272,265" fill="${ac}" fill-opacity="0.32"/><polygon points="207,52 122,195 292,195" fill="${ac}" fill-opacity="0.22"/><polygon points="308,148 258,285 358,285" fill="${ac}" fill-opacity="0.25"/><polygon points="308,90 245,205 371,205" fill="${ac}" fill-opacity="0.18"/><rect x="101" y="280" width="16" height="104" fill="${ac}" fill-opacity="0.5"/><rect x="199" y="265" width="16" height="119" fill="${ac}" fill-opacity="0.55"/><rect x="300" y="285" width="16" height="99" fill="${ac}" fill-opacity="0.45"/><line x1="216" y1="0" x2="146" y2="195" stroke="${ac}" stroke-width="1" stroke-opacity="0.1"/><line x1="216" y1="0" x2="216" y2="210" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.12"/><line x1="216" y1="0" x2="286" y2="195" stroke="${ac}" stroke-width="1" stroke-opacity="0.1"/></svg></div>`;
    case "crimson":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.18" transform="rotate(0 216 192)"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.16" transform="rotate(60 216 192)"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.18" transform="rotate(120 216 192)"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.16" transform="rotate(180 216 192)"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.18" transform="rotate(240 216 192)"/><ellipse cx="216" cy="192" rx="55" ry="30" fill="${ac}" fill-opacity="0.16" transform="rotate(300 216 192)"/><circle cx="216" cy="192" r="28" fill="${ac}" fill-opacity="0.3"/><circle cx="216" cy="192" r="16" fill="${ac}" fill-opacity="0.4"/><circle cx="216" cy="192" r="120" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><circle cx="216" cy="192" r="155" fill="none" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.1"/></svg></div>`;
    case "violet":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><polygon points="0,0 72,0 36,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="72,0 144,0 108,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="144,0 216,0 180,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="216,0 288,0 252,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="288,0 360,0 324,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="360,0 432,0 396,62" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.18"/><polygon points="36,62 108,62 72,124" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><polygon points="108,62 180,62 144,124" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><polygon points="180,62 252,62 216,124" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><polygon points="252,62 324,62 288,124" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><polygon points="324,62 396,62 360,124" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.15"/><polygon points="72,124 144,124 108,186" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.13"/><polygon points="144,124 216,124 180,186" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.13"/><polygon points="216,124 288,124 252,186" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.13"/><polygon points="288,124 360,124 324,186" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.13"/><polygon points="216,138 264,192 216,246 168,192" fill="${ac}" fill-opacity="0.22"/><polygon points="216,158 248,192 216,226 184,192" fill="${ac}" fill-opacity="0.2"/><line x1="216" y1="192" x2="216" y2="60" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.15"/><line x1="216" y1="192" x2="326" y2="256" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.15"/><line x1="216" y1="192" x2="106" y2="256" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.15"/></svg></div>`;
    case "slate":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><line x1="0" y1="42" x2="432" y2="42" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="84" x2="432" y2="84" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="126" x2="432" y2="126" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="168" x2="432" y2="168" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="210" x2="432" y2="210" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="252" x2="432" y2="252" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="294" x2="432" y2="294" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="0" y1="336" x2="432" y2="336" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="48" y1="0" x2="48" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="96" y1="0" x2="96" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="144" y1="0" x2="144" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="192" y1="0" x2="192" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="240" y1="0" x2="240" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="288" y1="0" x2="288" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="336" y1="0" x2="336" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><line x1="384" y1="0" x2="384" y2="384" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.12"/><circle cx="216" cy="192" r="82" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.28"/><circle cx="216" cy="192" r="56" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.2"/><line x1="134" y1="192" x2="298" y2="192" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.22"/><line x1="216" y1="110" x2="216" y2="274" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.22"/><polygon points="55,55 200,82 178,205 33,178" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.22"/><polygon points="258,102 404,52 422,202 276,232" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.18"/><path d="M0,0 L58,0 L58,10 L10,10 L10,58 L0,58 Z" fill="${ac}" fill-opacity="0.18"/><path d="M432,384 L374,384 L374,374 L422,374 L422,326 L432,326 Z" fill="${ac}" fill-opacity="0.18"/></svg></div>`;
    case "sunrise":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><defs><radialGradient id="sg1" cx="50%" cy="110%" r="90%"><stop offset="0%" stop-color="${ac}" stop-opacity="0.45"/><stop offset="100%" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs><rect width="432" height="384" fill="${bg}"/><rect width="432" height="384" fill="url(#sg1)"/><line x1="216" y1="384" x2="56" y2="184" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.22"/><line x1="216" y1="384" x2="96" y2="174" stroke="${ac}" stroke-width="1" stroke-opacity="0.15"/><line x1="216" y1="384" x2="136" y2="168" stroke="${ac}" stroke-width="1" stroke-opacity="0.15"/><line x1="216" y1="384" x2="176" y2="166" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.22"/><line x1="216" y1="384" x2="216" y2="164" stroke="${ac}" stroke-width="2" stroke-opacity="0.28"/><line x1="216" y1="384" x2="256" y2="166" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.22"/><line x1="216" y1="384" x2="296" y2="168" stroke="${ac}" stroke-width="1" stroke-opacity="0.15"/><line x1="216" y1="384" x2="336" y2="174" stroke="${ac}" stroke-width="1" stroke-opacity="0.15"/><line x1="216" y1="384" x2="376" y2="184" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.22"/><path d="M116,384 A100,100 0 0,1 316,384" fill="${ac}" fill-opacity="0.28"/><path d="M138,384 A78,78 0 0,1 294,384" fill="${ac}" fill-opacity="0.22"/><line x1="0" y1="344" x2="432" y2="344" stroke="${ac}" stroke-width="1" stroke-opacity="0.28"/><ellipse cx="100" cy="100" rx="58" ry="24" fill="${ac}" fill-opacity="0.08"/><ellipse cx="340" cy="140" rx="50" ry="20" fill="${ac}" fill-opacity="0.07"/></svg></div>`;
    case "teal":
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><polyline points="0,65 23,50 46,65 69,50 92,65 115,50 138,65 161,50 184,65 207,50 230,65 253,50 276,65 299,50 322,65 345,50 368,65 391,50 414,65 432,55" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.18"/><polyline points="0,115 23,100 46,115 69,100 92,115 115,100 138,115 161,100 184,115 207,100 230,115 253,100 276,115 299,100 322,115 345,100 368,115 391,100 414,115 432,105" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.20"/><polyline points="0,165 23,150 46,165 69,150 92,165 115,150 138,165 161,150 184,165 207,150 230,165 253,150 276,165 299,150 322,165 345,150 368,165 391,150 414,165 432,155" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.22"/><polyline points="0,215 23,200 46,215 69,200 92,215 115,200 138,215 161,200 184,215 207,200 230,215 253,200 276,215 299,200 322,215 345,200 368,215 391,200 414,215 432,205" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.24"/><polyline points="0,265 23,250 46,265 69,250 92,265 115,250 138,265 161,250 184,265 207,250 230,265 253,250 276,265 299,250 322,265 345,250 368,265 391,250 414,265 432,255" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.26"/><polyline points="0,315 23,300 46,315 69,300 92,315 115,300 138,315 161,300 184,315 207,300 230,315 253,300 276,315 299,300 322,315 345,300 368,315 391,300 414,315 432,305" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.28"/><polygon points="216,122 278,192 216,262 154,192" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.3"/><polygon points="216,148 254,192 216,236 178,192" fill="${ac}" fill-opacity="0.14"/><polygon points="0,0 78,0 0,78" fill="${ac}" fill-opacity="0.1"/><polygon points="432,384 354,384 432,306" fill="${ac}" fill-opacity="0.1"/></svg></div>`;
    case "parchment":
      return `<div style="${cs};background:#F5EBCF;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="#F5EBCF"/><line x1="40" y1="22" x2="392" y2="22" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="43" x2="392" y2="43" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="64" x2="392" y2="64" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="85" x2="392" y2="85" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="106" x2="392" y2="106" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="127" x2="392" y2="127" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="148" x2="392" y2="148" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="169" x2="392" y2="169" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="190" x2="392" y2="190" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="211" x2="392" y2="211" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="232" x2="392" y2="232" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="253" x2="392" y2="253" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="274" x2="392" y2="274" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="295" x2="392" y2="295" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="316" x2="392" y2="316" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="337" x2="392" y2="337" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="40" y1="358" x2="392" y2="358" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.22"/><line x1="78" y1="0" x2="78" y2="384" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.25"/><rect x="18" y="18" width="396" height="348" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.28"/><rect x="26" y="26" width="380" height="332" fill="none" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.18"/><path d="M156,192 Q216,152 276,192 Q216,232 156,192" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.32"/><path d="M186,192 Q216,172 246,192 Q216,212 186,192" fill="${ac}" fill-opacity="0.1"/><circle cx="38" cy="38" r="8" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.28"/><circle cx="394" cy="38" r="8" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.28"/><circle cx="38" cy="346" r="8" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.28"/><circle cx="394" cy="346" r="8" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.28"/></svg></div>`;
    case "sky":
      return `<div style="${cs};background:#DFF0FF;"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><defs><radialGradient id="skyg" cx="75%" cy="20%" r="50%"><stop offset="0%" stop-color="${ac}" stop-opacity="0.2"/><stop offset="100%" stop-color="${ac}" stop-opacity="0.02"/></radialGradient></defs><rect width="432" height="384" fill="#DFF0FF"/><rect width="432" height="384" fill="url(#skyg)"/><ellipse cx="120" cy="100" rx="68" ry="33" fill="white" fill-opacity="0.82"/><ellipse cx="88" cy="106" rx="44" ry="28" fill="white" fill-opacity="0.82"/><ellipse cx="157" cy="108" rx="40" ry="25" fill="white" fill-opacity="0.82"/><ellipse cx="324" cy="158" rx="72" ry="36" fill="white" fill-opacity="0.74"/><ellipse cx="292" cy="165" rx="46" ry="29" fill="white" fill-opacity="0.74"/><ellipse cx="360" cy="167" rx="42" ry="26" fill="white" fill-opacity="0.74"/><ellipse cx="178" cy="238" rx="62" ry="30" fill="white" fill-opacity="0.65"/><ellipse cx="150" cy="245" rx="40" ry="24" fill="white" fill-opacity="0.65"/><ellipse cx="212" cy="246" rx="36" ry="22" fill="white" fill-opacity="0.65"/><circle cx="362" cy="58" r="34" fill="${ac}" fill-opacity="0.22"/><circle cx="362" cy="58" r="24" fill="${ac}" fill-opacity="0.3"/><path d="M200,302 L212,295 L224,302" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.5"/><path d="M244,278 L258,270 L272,278" fill="none" stroke="${ac}" stroke-width="1.5" stroke-opacity="0.42"/><path d="M158,322 L169,316 L180,322" fill="none" stroke="${ac}" stroke-width="1.2" stroke-opacity="0.35"/><path d="M280,318 L289,313 L298,318" fill="none" stroke="${ac}" stroke-width="1.2" stroke-opacity="0.35"/></svg></div>`;
    default:
      return `<div style="${cs}"><svg viewBox="0 0 432 384" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><rect width="432" height="384" fill="${bg}"/><circle cx="216" cy="192" r="30" fill="${ac}" fill-opacity="0.22"/><circle cx="216" cy="192" r="52" fill="none" stroke="${ac}" stroke-width="1" stroke-opacity="0.2"/><circle cx="216" cy="192" r="74" fill="none" stroke="${ac}" stroke-width="0.8" stroke-opacity="0.16"/><circle cx="216" cy="192" r="96" fill="none" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.13"/><circle cx="216" cy="192" r="120" fill="none" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.10"/></svg></div>`;
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
  const backDesc = escapeHtml(opts.backDescription ||
    `${opts.puzzleCount || 100} carefully crafted ${diffLabel} ${ptLabel} puzzles designed for stress-free brain training. Each puzzle is presented on its own page with generous space for working through solutions.${lpLabel2} A full answer key is included at the back.`);
  const lpMeta = opts.largePrint !== false ? " | Large Print" : "";
  const meta = `${opts.puzzleCount || 100} ${opts.puzzleType || "Word Search"} Puzzles | ${opts.difficulty || "Medium"}${lpMeta}`;

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
  const totalWords = (opts.puzzleCount || 100) * wppu;
  const lpSellTag = isLargePrint ? " | LARGE PRINT" : "";
  const sellPts = `${opts.puzzleCount || 100} PUZZLES | ${totalWords.toLocaleString()} WORDS | ${(opts.difficulty || "MEDIUM").toUpperCase()}${lpSellTag} | SOLUTIONS INCLUDED`;
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


  // Sanitize coverImageUrl: only allow http(s) URLs with non-private hostnames (SSRF mitigation)
  const rawUrl = opts.coverImageUrl || "";
  function isSafeImageUrl(url: string): boolean {
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
  const safeImgUrl = isSafeImageUrl(rawUrl)
    ? rawUrl.replace(/"/g, "%22").replace(/'/g, "%27").replace(/</g, "%3C").replace(/>/g, "%3E")
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
  const cleanFeatures = [
    `&#10003; ${opts.puzzleCount || 100} Unique Puzzles`,
    `&#10003; ${opts.difficulty || "Medium"} Difficulty Level`,
    `&#10003; Large Print Format`,
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

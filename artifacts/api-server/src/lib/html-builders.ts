import {
  shuf, makeWordSearch, makeSudoku, makeMaze, makeNumberSearch, makeCryptogram,
  DEFWORDS,
} from "./puzzles";

/** Compute total page count from config without generating any puzzles. */
export function computeTotalPages(opts: BuildOpts): number {
  const PT = opts.puzzleType || "Word Search";
  const PC = opts.puzzleCount || 100;
  const LP = opts.largePrint !== false;
  const aPer = PT === "Word Search" ? (LP ? 9 : 12)
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

  const wpp = LP ? 16 : 20, gsz = LP ? 13 : 15;
  const wC = LP ? 32 : 27, wF = LP ? 16 : 13;
  const sC = LP ? 50 : 44, sF = LP ? 22 : 18;

  const wordBank = opts.words && opts.words.length >= 10 ? opts.words : DEFWORDS;
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
        puzzles.push(makeNumberSearch(gsz));
        break;
      case "Cryptogram":
        puzzles.push(makeCryptogram());
        break;
      default:
        puzzles.push(makeWordSearch(shuf(wordBank).slice(0, Math.min(wordBank.length, wpp)), gsz));
    }
  }

  const aPer = PT === "Word Search" ? (LP ? 9 : 12)
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

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${T}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">` +
    `<style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:${trimW}in ${trimH}in;margin:0;}` +
    `.pg{width:${trimW}in;min-height:${trimH}in;page-break-after:always;position:relative;overflow:hidden;}` +
    `.pg:last-child{page-break-after:auto;}` +
    `.in{padding:0.55in 0.4in 0.6in ${gut}in;background:#fff;}` +
    `.hd{display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:8px;color:#666;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;}` +
    `.ft{position:absolute;bottom:0.25in;left:${gut}in;right:0.4in;display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:9px;color:#777;border-top:1px solid #ddd;padding-top:4px;}` +
    `</style></head><body>`;

  html += `<div class="pg in"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:9in;text-align:center;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:4px;color:#666;text-transform:uppercase;margin-bottom:20px;">${PT} Collection</div>` +
    `<div style="font-family:Lora,serif;font-size:34px;font-weight:700;color:#222;margin-bottom:10px;">${T}</div>` +
    `<div style="font-family:Lora,serif;font-size:15px;font-style:italic;color:#555;margin-bottom:24px;">${ST}</div>` +
    `<div style="width:56px;height:1px;background:#ccc;margin-bottom:20px;"></div>` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#777;line-height:2;">` +
    `&copy; ${yr} All Rights Reserved &middot; Published via Amazon KDP<br/>Puzzle content generated with AI assistance${vol ? "<br/>" + vol : ""}</div>` +
    (AU ? `<div style="font-family:Lora,serif;font-size:12px;color:#666;margin-top:12px;">${AU}</div>` : "") +
    `</div></div>`;

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

  html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; ${PT}</span></div>` +
    `<div style="padding-top:0.3in;"><div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:12px;">How to Play</div>` +
    `<div style="width:56px;height:2px;background:#333;margin-bottom:20px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:13px;line-height:1.8;color:#333;margin-bottom:28px;">${htxt}</div>` +
    `<div style="border-left:3px solid #333;background:#f9f9f6;padding:14px 18px;">` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:#333;font-weight:600;margin-bottom:6px;">TIP</div>` +
    `<div style="font-family:Lora,serif;font-size:12px;color:#444;">${tip}</div></div>` +
    (LP ? `<div style="margin-top:20px;font-family:Source Code Pro,monospace;font-size:10px;letter-spacing:2px;color:#666;text-align:center;">LARGE PRINT EDITION</div>` : "") +
    `</div><div class="ft"><span>${T} — ${AU}</span><span>3</span></div></div>`;

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

  for (let i = 0; i < PC; i++) {
    const pN = pS + i;
    const lb = "#" + String(i + 1).padStart(2, "0");
    const pz = puzzles[i] as Record<string, unknown>;

    if (PT === "Word Search") {
      const ws = pz as { grid: string[][]; placed: string[] };
      let g = `<table style="border-collapse:collapse;margin:10px auto;">`;
      for (let r = 0; r < ws.grid.length; r++) {
        g += "<tr>";
        for (let c = 0; c < ws.grid[r].length; c++)
          g += `<td style="width:${wC}px;height:${wC}px;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${wF}px;font-weight:500;color:#222;border:1px solid #ccc;">${ws.grid[r][c]}</td>`;
        g += "</tr>";
      }
      g += "</table>";
      const ch = ws.placed.map(w => `<span style="display:inline-block;font-family:'Source Code Pro',monospace;font-size:${LP ? 13 : 12}px;background:#f5f3ee;border:1px solid #ccc;border-radius:3px;padding:3px 8px;margin:2px;">${escapeHtml(w)}</span>`).join("");
      html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; Word Search</span></div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">WORD SEARCH &middot; ${DF.toUpperCase()}</span></div>${g}<div style="text-align:center;margin-top:8px;">${ch}</div></div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; Sudoku</span></div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">SUDOKU &middot; ${DF.toUpperCase()}</span></div>${g}</div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

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
      html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; Maze</span></div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">MAZE &middot; ${DF.toUpperCase()}</span></div>${g}<div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#777;margin-top:6px;text-align:center;">S = Start &nbsp;&nbsp; F = Finish</div></div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

    } else if (PT === "Number Search") {
      const ns = pz as { grid: string[][]; placed: string[] };
      let g = `<table style="border-collapse:collapse;margin:10px auto;">`;
      for (let r = 0; r < ns.grid.length; r++) {
        g += "<tr>";
        for (let c = 0; c < ns.grid[r].length; c++)
          g += `<td style="width:${wC}px;height:${wC}px;text-align:center;vertical-align:middle;font-family:'Source Code Pro',monospace;font-size:${wF}px;font-weight:500;color:#222;border:1px solid #ccc;">${ns.grid[r][c]}</td>`;
        g += "</tr>";
      }
      g += "</table>";
      const ch = ns.placed.map(s => `<span style="display:inline-block;font-family:'Source Code Pro',monospace;font-size:${LP ? 13 : 12}px;background:#f5f3ee;border:1px solid #ccc;border-radius:3px;padding:3px 8px;margin:2px;">${escapeHtml(String(s))}</span>`).join("");
      html += `<div class="pg in"><div class="hd"><span>${T}</span><span>${DF} &middot; Number Search</span></div><div style="padding-top:0.15in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">NUMBER SEARCH &middot; ${DF.toUpperCase()}</span></div>${g}<div style="text-align:center;margin-top:8px;">${ch}</div></div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;

    } else if (PT === "Cryptogram") {
      const cg = pz as { cipher: string; plain: string };
      const cipherDisplay = cg.cipher.split("").map(ch =>
        ch >= "A" && ch <= "Z" ? `<span style="display:inline-block;text-align:center;width:${LP ? 22 : 18}px;">${ch}<br/><span style="display:block;border-bottom:1px solid #333;margin:0 2px;">&nbsp;</span></span>` : (ch === " " ? `<span style="display:inline-block;width:${LP ? 10 : 8}px;">&nbsp;</span>` : ch)
      ).join("");
      html += `<div class="pg in"><div class="hd"><span>${T}</span><span>Cryptogram</span></div><div style="padding-top:0.2in;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;"><span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#222;">${lb}</span><span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#666;">CRYPTOGRAM</span></div><div style="font-family:'Source Code Pro',monospace;font-size:${LP ? 16 : 13}px;color:#222;line-height:2.8;word-spacing:4px;">${cipherDisplay}</div><div style="margin-top:30px;font-family:'Source Code Pro',monospace;font-size:9px;color:#666;">A=__ B=__ C=__ D=__ E=__ F=__ G=__ H=__ I=__ J=__ K=__ L=__ M=__<br/>N=__ O=__ P=__ Q=__ R=__ S=__ T=__ U=__ V=__ W=__ X=__ Y=__ Z=__</div></div><div class="ft"><span>${T} — ${AU}</span><span>${pN}</span></div></div>`;
    }
  }

  let akP = aS;

  if (PT === "Word Search" || PT === "Number Search") {
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ grid: string[][]; placed: string[]; pSet: Record<string, boolean> }>;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>${PT}</span></div><div style="padding-top:0.2in;">${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
      akP++;
    }

  } else if (PT === "Sudoku") {
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ puzzle: number[][]; solution: number[][] }>;
      const cSz = LP ? 16 : 14;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Sudoku</span></div><div style="padding-top:0.2in;">${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
      akP++;
    }

  } else if (PT === "Maze") {
    // Maze answers — show solved path
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ grid: number[][]; rows: number; cols: number }>;
      const N = 1, E = 2, S = 4, W = 8;
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
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Maze</span></div><div style="padding-top:0.2in;">${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
      akP++;
    }

  } else if (PT === "Cryptogram") {
    for (let p = 0; p < PC; p += aPer) {
      const batch = (puzzles.slice(p, p + aPer)) as Array<{ cipher: string; plain: string }>;
      let gs = "";
      batch.forEach((cg, idx) => {
        gs += `<div style="margin-bottom:20px;padding:10px;border:1px solid #eee;"><div style="font-family:'Source Code Pro',monospace;font-size:8px;color:#555;font-weight:600;margin-bottom:6px;">#${String(p + idx + 1).padStart(2, "0")}</div><div style="font-family:Lora,serif;font-size:11px;color:#333;">${cg.plain}</div></div>`;
      });
      html += `<div class="pg in"><div class="hd"><span>Answer Key</span><span>Cryptogram</span></div><div style="padding-top:0.2in;">${gs}</div><div class="ft"><span>${T} — ${AU}</span><span>${akP}</span></div></div>`;
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
}

export interface CoverResult {
  html: string;
  fullW: number;
  fullH: number;
  spineW: number;
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
  const lpLabel = opts.largePrint !== false ? " Large print formatting for comfortable solving." : "";
  const backDesc = escapeHtml(opts.backDescription || `Enjoy ${opts.puzzleCount || 100} carefully crafted ${opts.puzzleType || "Word Search"} puzzles.${lpLabel} Complete answer key included at the back.`);
  const lpMeta = opts.largePrint !== false ? " | Large Print" : "";
  const meta = `${opts.puzzleCount || 100} ${opts.puzzleType || "Word Search"} Puzzles | ${opts.difficulty || "Medium"}${lpMeta}`;

  const vn = opts.volumeNumber ?? 0;
  const titleWordCount = (opts.title || "Book Title").trim().split(/\s+/).length;
  const seriesBadge = (vn >= 1 && vn <= 3)
    ? `<div style="position:absolute;top:0.6in;right:0.6in;z-index:10;padding:4px 10px;border:1.5px solid ${ac}88;border-radius:3px;font-family:'Source Code Pro',monospace;font-size:8px;letter-spacing:2px;color:${ac};">Volume ${vn}</div>`
    : "";

  // Sell points — opacity at dd (87%) for clear readability
  const sellPts = `${opts.puzzleCount || 100} PUZZLES | ${(opts.difficulty || "MEDIUM").toUpperCase()} | SOLUTIONS INCLUDED`;
  const sellDiv = `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;text-transform:uppercase;margin-bottom:12px;">${sellPts}</div>`;

  // Audience/format callout derived from the book's own fields.
  // Matches the layout default: largePrint !== false means large-print is on.
  const isLargePrint = opts.largePrint !== false;
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

  // 8 decorative shapes — opacities 0.20–0.35
  const deco =
    `<div style="position:absolute;bottom:8%;right:5%;width:140px;height:140px;border:2px solid ${ac};border-radius:50%;opacity:0.28;"></div>` +
    `<div style="position:absolute;top:8%;left:5%;width:90px;height:90px;border:2px solid ${ac};border-radius:50%;opacity:0.25;"></div>` +
    `<div style="position:absolute;top:30%;right:10%;width:40px;height:40px;border:1.5px solid ${ac};border-radius:50%;opacity:0.22;"></div>` +
    `<div style="position:absolute;top:12%;right:8%;width:60px;height:60px;border:1.5px solid ${ac};transform:rotate(45deg);opacity:0.25;"></div>` +
    `<div style="position:absolute;bottom:12%;left:7%;width:35px;height:35px;border:1px solid ${ac};transform:rotate(30deg);opacity:0.20;"></div>` +
    `<div style="position:absolute;top:53%;left:50%;transform:translateX(-50%);width:200px;height:1px;background:${ac};opacity:0.30;"></div>` +
    `<div style="position:absolute;bottom:14%;left:calc(50% - 120px);width:8px;height:8px;background:${ac};border-radius:50%;opacity:0.35;"></div>` +
    `<div style="position:absolute;bottom:14%;left:calc(50% + 112px);width:8px;height:8px;background:${ac};border-radius:50%;opacity:0.35;"></div>`;

  // Back cover: gradient background, boosted opacities throughout
  const back = `<div style="position:absolute;left:${bleed}in;top:${bleed}in;width:${trimW}in;height:${trimH}in;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5in 1in;text-align:center;box-sizing:border-box;">` +
    `<div style="font-family:Lora,serif;font-size:16px;color:${tx}dd;line-height:1.8;margin-bottom:40px;">${backDesc}</div>` +
    `<div style="width:50px;height:1px;background:${ac};margin-bottom:30px;"></div>` +
    `<div style="font-family:Lora,serif;font-size:13px;color:${tx};margin-bottom:12px;">${author}</div>` +
    `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${tx}cc;">${meta}</div>` +
    `<div style="position:absolute;bottom:0.5in;right:0.4in;width:2in;height:1.2in;border:1px dashed ${ac}44;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Source Code Pro',monospace;font-size:7px;color:${ac}88;">BARCODE AREA</div></div></div>`;

  // Spine: larger + bolder text
  const spine = spineW >= 0.2
    ? `<div style="position:absolute;left:${spineX}in;top:${bleed}in;width:${spineW}in;height:${trimH}in;background:${bg};display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(-90deg);white-space:nowrap;font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx};text-transform:uppercase;font-weight:600;">${title}${author ? " — " + author : ""}</div></div>`
    : `<div style="position:absolute;left:${spineX}in;top:${bleed}in;width:${spineW}in;height:${trimH}in;background:${bg};"></div>`;

  const fb = `position:absolute;left:${frontX}in;top:${bleed}in;width:${trimW}in;height:${trimH}in;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;color:${tx};font-family:Lora,serif;box-sizing:border-box;overflow:hidden;`;
  const cs = opts.coverStyle || "classic";

  let front = "";

  if (cs === "luxury") {
    // Double-frame centered layout with elevated typography
    front = `<div style="${fb}padding:0;">${puzzleTexture}${deco}${seriesBadge}` +
      `<div style="position:absolute;top:0.22in;left:0.22in;right:0.22in;bottom:0.22in;border:1px solid ${ac}55;z-index:1;"></div>` +
      `<div style="position:absolute;top:0.4in;left:0.4in;right:0.4in;bottom:0.4in;border:3px solid ${ac};z-index:1;"></div>` +
      `<div style="text-align:center;z-index:2;position:relative;padding:0 0.8in;">` +
      `<div style="width:40px;height:1px;background:${ac};margin:0 auto 20px;"></div>` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:62px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:${tx};margin-bottom:18px;line-height:1.2;">${title}</div>` +
      `<div style="width:40px;height:1px;background:${ac};margin:0 auto 16px;"></div>` +
      `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:14px;">${sub}</div>` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;margin-bottom:12px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else if (cs === "geometric") {
    // Two angled accent bands — title always on band, white text always works
    front = `<div style="${fb}padding:1in;">${puzzleTexture}${deco}${seriesBadge}` +
      `<div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;overflow:hidden;">` +
      `<div style="position:absolute;top:18%;left:-10%;width:130%;height:38%;background:${ac};transform:rotate(-30deg);opacity:0.85;"></div>` +
      `<div style="position:absolute;top:52%;left:-10%;width:130%;height:7%;background:${ac};transform:rotate(-30deg);opacity:0.4;"></div>` +
      `</div>` +
      `<div style="position:relative;z-index:1;text-align:left;width:100%;">` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:68px;font-weight:700;color:#fff;line-height:1.05;margin-bottom:16px;text-shadow:2px 2px 12px rgba(0,0,0,0.6);">${title}</div>` +
      `<div style="font-size:19px;color:${tx}ee;letter-spacing:0.5px;margin-bottom:14px;">${sub}</div>` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;">${author}</div>` +
      `</div>` +
      `<div style="position:absolute;bottom:1in;left:1in;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;z-index:1;">${meta}</div>` +
      `</div>`;

  } else if (cs === "bold") {
    // Wider accent sidebar (42%) + puzzle texture in content area; contrast fixes applied
    front = `<div style="${fb}flex-direction:row;padding:0;">${seriesBadge}` +
      `<div style="width:42%;height:100%;background:${ac};display:flex;flex-direction:column;justify-content:flex-end;padding:0.8in 0.4in;box-sizing:border-box;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${sidebarMeta};">${meta}</div>` +
      `</div>` +
      `<div style="width:58%;display:flex;flex-direction:column;justify-content:center;padding:1in 0.7in;position:relative;overflow:hidden;">` +
      `${puzzleTexture}` +
      `<div style="position:relative;z-index:1;">` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:64px;font-weight:700;color:${titleOnBg};line-height:1.05;margin-bottom:14px;">${title}</div>` +
      `<div style="font-size:19px;color:${ac};font-style:italic;letter-spacing:0.5px;margin-bottom:12px;">${sub}</div>` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:11px;color:${tx}ee;">${author}</div>` +
      `</div></div></div>`;

  } else if (cs === "minimal") {
    // Triple-stripe accent mark + larger dominant title
    front = `<div style="${fb}padding:1in;text-align:left;">${puzzleTexture}${deco}${seriesBadge}` +
      `<div style="position:relative;z-index:1;width:100%;">` +
      `<div style="margin-bottom:32px;">` +
      `<div style="width:56px;height:3px;background:${ac};margin-bottom:6px;"></div>` +
      `<div style="width:40px;height:1px;background:${ac};opacity:0.6;margin-bottom:6px;"></div>` +
      `<div style="width:24px;height:1px;background:${ac};opacity:0.3;"></div>` +
      `</div>` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:64px;font-weight:700;color:${tx};line-height:1.05;margin-bottom:20px;letter-spacing:1px;">${title}</div>` +
      `${sub ? `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:16px;">${sub}</div>` : ""}` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;color:${tx}ee;margin-bottom:16px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else if (cs === "retro") {
    // Concentric double-border with star decorators and larger title
    front = `<div style="${fb}padding:0.6in;text-align:center;">${puzzleTexture}${deco}${seriesBadge}` +
      `<div style="width:100%;height:100%;border:8px double ${ac};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.5in;box-sizing:border-box;position:relative;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:6px;color:${ac};text-transform:uppercase;margin-bottom:12px;">★ &nbsp; ${opts.puzzleType || "Puzzles"} &nbsp; ★</div>` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:60px;font-weight:700;color:${tx};line-height:1.05;margin-bottom:12px;text-transform:uppercase;letter-spacing:2px;">${title}</div>` +
      `${sub ? `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:12px;">${sub}</div>` : ""}` +
      `<div style="width:80px;height:2px;background:${ac};margin:8px auto 14px;"></div>` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;color:${tx}ee;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;margin-top:12px;">${meta}</div>` +
      `<div style="position:absolute;bottom:0.2in;left:0;right:0;text-align:center;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:4px;color:${ac};opacity:0.7;">★ &nbsp; ★ &nbsp; ★</div>` +
      `</div></div>`;

  } else if (cs === "warmth") {
    // Warm, welcoming layout for senior/gift market — centered, ornamental, generous whitespace
    front = `<div style="${fb}text-align:center;padding:1in;">${puzzleTexture}` +
      `<div style="position:absolute;top:8%;left:8%;width:70px;height:70px;border:1px solid ${ac};border-radius:50%;opacity:0.20;"></div>` +
      `<div style="position:absolute;bottom:8%;right:8%;width:90px;height:90px;border:1px solid ${ac};border-radius:50%;opacity:0.18;"></div>` +
      `${seriesBadge}` +
      `<div style="position:relative;z-index:1;">` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:22px;color:${ac};opacity:0.9;margin-bottom:20px;letter-spacing:4px;">✦</div>` +
      `${audienceCallout}` +
      `<div style="font-family:'Oswald',sans-serif;font-size:${titleWordCount <= 3 ? "72" : "62"}px;font-weight:700;color:${isDark ? tx : ac};line-height:1.1;margin-bottom:22px;padding:0 0.2in;">${title}</div>` +
      `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">` +
      `<div style="flex:1;max-width:60px;height:1px;background:${ac};opacity:0.6;"></div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:14px;color:${ac};">✦</div>` +
      `<div style="flex:1;max-width:60px;height:1px;background:${ac};opacity:0.6;"></div>` +
      `</div>` +
      `<div style="font-size:19px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:20px;">${sub}</div>` +
      `${sellDiv}` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:12px;color:${tx}ee;margin-bottom:10px;letter-spacing:2px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;

  } else {
    // classic (default): centered accent title, puzzle texture, audience callout
    front = `<div style="${fb}text-align:center;padding:1in;">${puzzleTexture}${deco}${seriesBadge}` +
      `<div style="position:relative;z-index:1;">` +
      `${audienceCallout}` +
      `${opts.puzzleType ? `<div style="font-family:'Source Code Pro',monospace;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:${ac};margin-bottom:20px;">${opts.puzzleType}</div>` : ""}` +
      `<div style="width:56px;height:2px;background:${ac};margin:0 auto 28px;"></div>` +
      `<div style="font-family:'Oswald',sans-serif;font-size:${titleWordCount <= 3 ? "68" : "60"}px;font-weight:700;color:${ac};line-height:1.1;margin-bottom:18px;padding:0 0.3in;">${title}</div>` +
      `<div style="font-size:18px;font-style:italic;color:${tx}ee;letter-spacing:0.5px;margin-bottom:16px;">${sub}</div>` +
      `${sellDiv}` +
      `<div style="width:56px;height:2px;background:${ac};margin:0 auto 22px;"></div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:13px;letter-spacing:3px;color:${tx}ee;margin-bottom:16px;">${author}</div>` +
      `<div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:${tx}dd;">${meta}</div>` +
      `</div></div>`;
  }

  const coverHtml = `<!DOCTYPE html><html style="background-color:${bg};"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Oswald:wght@700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:${fullW.toFixed(4)}in ${fullH.toFixed(4)}in;margin:0;}body{width:${fullW.toFixed(4)}in;height:${fullH.toFixed(4)}in;overflow:hidden;position:relative;background:${bg};print-color-adjust:exact;-webkit-print-color-adjust:exact;}</style></head><body>${back}${spine}${front}</body></html>`;

  return { html: coverHtml, fullW, fullH, spineW };
}

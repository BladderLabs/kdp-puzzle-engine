export function shuf<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export interface WordSearchResult {
  grid: string[][];
  placed: string[];
  pSet: Record<string, boolean>;
}

export function makeWordSearch(words: string[], size: number): WordSearchResult {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const DIRS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const placed: string[] = [];
  const pSet: Record<string, boolean> = {};
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    if (word.length > size) continue;
    let done = false;
    for (const [dr, dc] of shuf(DIRS)) {
      if (done) break;
      const positions = shuf(
        Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
      );
      for (const [sr, sc] of positions) {
        let ok = true;
        for (let k = 0; k < word.length; k++) {
          const nr = sr + dr * k, nc = sc + dc * k;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { ok = false; break; }
          if (grid[nr][nc] !== "" && grid[nr][nc] !== word[k]) { ok = false; break; }
        }
        if (ok) {
          for (let k = 0; k < word.length; k++) {
            const nr = sr + dr * k, nc = sc + dc * k;
            grid[nr][nc] = word[k];
            pSet[`${nr},${nc}`] = true;
          }
          placed.push(word);
          done = true;
          break;
        }
      }
    }
  }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === "") grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return { grid, placed, pSet };
}

export interface SudokuResult {
  puzzle: number[][];
  solution: number[][];
}

export function makeSudoku(diff: string): SudokuResult {
  const holes = diff === "Easy" ? 32 : diff === "Hard" ? 50 : 44;
  const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  function ok(b: number[][], r: number, c: number, n: number): boolean {
    for (let i = 0; i < 9; i++) if (b[r][i] === n || b[i][c] === n) return false;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = br; i < br + 3; i++)
      for (let j = bc; j < bc + 3; j++)
        if (b[i][j] === n) return false;
    return true;
  }

  function fill(b: number[][]): boolean {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          for (const n of shuf([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (ok(b, r, c, n)) {
              b[r][c] = n;
              if (fill(b)) return true;
              b[r][c] = 0;
            }
          }
          return false;
        }
      }
    return true;
  }

  fill(board);
  const solution = board.map(r => [...r]);
  const puzzle = board.map(r => [...r]);

  function cnt(b: number[][], lim: number): number {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          let ct = 0;
          for (let n = 1; n <= 9; n++) {
            if (ok(b, r, c, n)) {
              b[r][c] = n;
              ct += cnt(b, lim - ct);
              b[r][c] = 0;
              if (ct >= lim) return ct;
            }
          }
          return ct;
        }
      }
    return 1;
  }

  let rem = 0;
  for (const idx of shuf(Array.from({ length: 81 }, (_, i) => i))) {
    if (rem >= holes) break;
    const r = Math.floor(idx / 9), c = idx % 9;
    if (puzzle[r][c] === 0) continue;
    const bk = puzzle[r][c];
    puzzle[r][c] = 0;
    if (cnt(puzzle.map(r => [...r]), 2) === 1) rem++;
    else puzzle[r][c] = bk;
  }
  return { puzzle, solution };
}

export interface MazeResult {
  grid: number[][];
  rows: number;
  cols: number;
}

// Cell walls bitmask: N=1, E=2, S=4, W=8
export function makeMaze(rows: number, cols: number): MazeResult {
  // grid[r][c] = bitmask of OPEN passages
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  const DX: Record<number, number> = { 1: 0, 2: 1, 4: 0, 8: -1 };
  const DY: Record<number, number> = { 1: -1, 2: 0, 4: 1, 8: 0 };
  const OPP: Record<number, number> = { 1: 4, 2: 8, 4: 1, 8: 2 };

  function carve(r: number, c: number) {
    visited[r][c] = true;
    for (const d of shuf([1, 2, 4, 8])) {
      const nr = r + DY[d], nc = c + DX[d];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        grid[r][c] |= d;
        grid[nr][nc] |= OPP[d];
        carve(nr, nc);
      }
    }
  }

  carve(0, 0);
  return { grid, rows, cols };
}

export interface NumberSearchResult {
  grid: string[][];
  placed: string[];
  pSet: Record<string, boolean>;
}

const NUMBER_SEQUENCES = [
  "12345", "67890", "11223", "44556", "77889",
  "13579", "24680", "98765", "54321", "10293",
  "84756", "29384", "56473", "18273", "64738",
  "39182", "74839", "20394", "85749", "31928",
  "47382", "59173", "62847", "83920", "15748",
  "72634", "49821", "36057", "81234", "56789",
];

export function makeNumberSearch(size: number): NumberSearchResult {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const DIRS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const placed: string[] = [];
  const pSet: Record<string, boolean> = {};
  const sequences = shuf([...NUMBER_SEQUENCES]).slice(0, 20);

  for (const seq of sequences.sort((a, b) => b.length - a.length)) {
    if (seq.length > size) continue;
    let done = false;
    for (const [dr, dc] of shuf(DIRS)) {
      if (done) break;
      const positions = shuf(
        Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
      );
      for (const [sr, sc] of positions) {
        let ok = true;
        for (let k = 0; k < seq.length; k++) {
          const nr = sr + dr * k, nc = sc + dc * k;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { ok = false; break; }
          if (grid[nr][nc] !== "" && grid[nr][nc] !== seq[k]) { ok = false; break; }
        }
        if (ok) {
          for (let k = 0; k < seq.length; k++) {
            const nr = sr + dr * k, nc = sc + dc * k;
            grid[nr][nc] = seq[k];
            pSet[`${nr},${nc}`] = true;
          }
          placed.push(seq);
          done = true;
          break;
        }
      }
    }
  }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === "") grid[r][c] = String(Math.floor(Math.random() * 10));
  return { grid, placed, pSet };
}

export interface CryptogramResult {
  cipher: string;
  plain: string;
  key: Record<string, string>;
}

const PHRASES = [
  "A WISE MAN LEARNS FROM HIS MISTAKES",
  "THE EARLY BIRD CATCHES THE WORM",
  "KNOWLEDGE IS POWER AND POWER IS FREEDOM",
  "EVERY DAY IS A NEW BEGINNING",
  "PATIENCE IS THE KEY TO SUCCESS",
  "HARD WORK BEATS TALENT EVERY TIME",
  "NEVER GIVE UP ON YOUR DREAMS",
  "LIFE IS SHORT SO MAKE IT COUNT",
  "BELIEVE IN YOURSELF AND YOU CAN DO IT",
  "SUCCESS COMES TO THOSE WHO WORK FOR IT",
  "GREAT THINGS NEVER COME FROM COMFORT ZONES",
  "THE ONLY WAY OUT IS THROUGH",
  "SMALL STEPS EVERY DAY LEAD TO BIG CHANGES",
  "CHALLENGE YOURSELF AND GROW STRONGER",
  "DREAMS DON'T WORK UNLESS YOU DO",
  "YOUR ATTITUDE DETERMINES YOUR DIRECTION",
  "FOCUS ON THE GOOD IN EVERY SITUATION",
  "LEARN SOMETHING NEW EACH AND EVERY DAY",
  "A POSITIVE MIND FINDS OPPORTUNITY EVERYWHERE",
  "COURAGE IS NOT THE ABSENCE OF FEAR",
];

export function makeCryptogram(): CryptogramResult {
  const plain = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const shuffled = shuf([...letters]);
  const key: Record<string, string> = {};
  letters.forEach((l, i) => { key[l] = shuffled[i]; });
  // Ensure no letter maps to itself
  for (let i = 0; i < letters.length; i++) {
    if (key[letters[i]] === letters[i]) {
      const j = (i + 1) % letters.length;
      [key[letters[i]], key[letters[j]]] = [key[letters[j]], key[letters[i]]];
    }
  }
  const cipher = plain
    .split("")
    .map(ch => (ch >= "A" && ch <= "Z") ? key[ch] : ch)
    .join("");
  return { cipher, plain, key };
}

export const DEFWORDS = "PUZZLE,SEARCH,WORDS,BRAIN,THINK,SOLVE,GAME,PLAY,FIND,HIDDEN,LETTER,GRID,CLUE,ANSWER,MATCH,LEVEL,SCORE,BONUS,TIMER,CHALLENGE,FOCUS,RELAX,SHARP,MIND".split(",");

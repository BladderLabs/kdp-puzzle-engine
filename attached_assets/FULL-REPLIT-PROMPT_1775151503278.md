# KDP PUZZLE BOOK ENGINE — COMPLETE BUILD SPECIFICATION FOR REPLIT

## READ THIS FIRST

You are building a SINGLE Node.js web application. ONE server.js file. It generates complete Amazon KDP puzzle books — both the interior manuscript PDF and the full-wrap book cover PDF — from a web form. The user fills in details, clicks one button, waits 30-60 seconds, and downloads two print-ready PDFs that they upload directly to Amazon KDP to sell as a paperback book.

This is a REAL product that generates REAL puzzles. Not mockups. Not templates. Every word search grid has genuinely hidden words. Every sudoku puzzle has exactly one valid solution. The PDFs have correct KDP dimensions, margins, bleed, spine width, page breaks, and page numbers. They are ready to upload to Amazon and sell.

DO NOT stub anything. DO NOT use placeholder text. DO NOT skip the puzzle algorithms. DO NOT simplify the cover layout. Build everything exactly as specified. If something is unclear, follow the specification literally.

---

## PROJECT STRUCTURE

```
/
├── server.js       ← ALL code goes here. Server, routes, puzzle generators, HTML builders, web UI.
├── package.json    ← Dependencies: express and puppeteer only.
```

No other files. No src folder. No public folder. No separate HTML files. No React. No webpack. No build step. The web UI is an HTML string served by Express from the GET / route.

### package.json

```json
{
  "name": "kdp-puzzle-engine",
  "version": "5.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "express": "^4.21.0",
    "puppeteer": "^23.0.0"
  }
}
```

---

## SERVER SETUP

```javascript
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json({ limit: '50mb' }));
// 50mb limit is required because the interior HTML for 100 puzzles can be 5-10MB
```

### Puppeteer Browser Management

Reuse ONE browser instance for all requests. Do NOT launch a new browser per request — it is too slow and crashes on Replit.

```javascript
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browserInstance;
}

async function htmlToPdf(html, widthInches, heightInches) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
  // networkidle0 waits for Google Fonts to finish loading
  // timeout 60000 because 100 sudoku puzzles + font loading can take a while
  const pdf = await page.pdf({
    width: widthInches.toFixed(4) + 'in',
    height: heightInches.toFixed(4) + 'in',
    printBackground: true,        // CRITICAL: without this, dark cover backgrounds won't render
    preferCSSPageSize: true,       // Use the @page size from the HTML, not Puppeteer defaults
    margin: { top: 0, right: 0, bottom: 0, left: 0 }  // We handle margins in the HTML
  });
  await page.close();  // Close the page but keep the browser running
  return pdf;
}
```

---

## API ROUTES (3 routes)

### GET /
Serves the web form HTML. Returns a complete HTML page as a string. See WEB UI section below.

### POST /generate
Receives the form data as JSON. Generates all puzzles, builds interior HTML and cover HTML. Returns JSON:

```javascript
app.post('/generate', (req, res) => {
  try {
    const opts = req.body;
    const interior = buildInteriorHTML(opts);   // returns { html: string, totalPages: number }
    const cover = buildCoverHTML(opts, interior.totalPages);  // returns { html: string, fullW: number, fullH: number, spineW: number }
    res.json({
      interiorHtml: interior.html,
      totalPages: interior.totalPages,
      coverHtml: cover.html,
      coverDims: { fullW: cover.fullW, fullH: cover.fullH, spineW: cover.spineW }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

### POST /pdf/interior
Receives { html: string }. Renders to PDF at 8.5 x 11 inches. Returns binary PDF.

```javascript
app.post('/pdf/interior', async (req, res) => {
  try {
    const pdf = await htmlToPdf(req.body.html, 8.5, 11);
    res.set({ 'Content-Type': 'application/pdf' });
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### POST /pdf/cover
Receives { html: string, fullW: number, fullH: number }. Renders to PDF at custom full-wrap dimensions. Returns binary PDF.

```javascript
app.post('/pdf/cover', async (req, res) => {
  try {
    const pdf = await htmlToPdf(req.body.html, req.body.fullW, req.body.fullH);
    res.set({ 'Content-Type': 'application/pdf' });
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Server start

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('KDP Engine running on port ' + PORT));
```

---

## UTILITY FUNCTIONS

### Shuffle Array

```javascript
function shuf(arr) {
  const b = [...arr];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
```

### KDP Gutter Margin (based on page count)

Amazon KDP requires different inside (gutter) margins depending on total page count. This prevents text from disappearing into the binding.

```javascript
function gutterIn(totalPages) {
  if (totalPages <= 150) return 0.375;
  if (totalPages <= 300) return 0.5;
  if (totalPages <= 500) return 0.625;
  if (totalPages <= 700) return 0.75;
  return 0.875;
}
```

### Default Words

Used when the user does not provide a custom word list for word search puzzles:

```javascript
const DEFWORDS = 'PUZZLE,SEARCH,WORDS,BRAIN,THINK,SOLVE,GAME,PLAY,FIND,HIDDEN,LETTER,GRID,CLUE,ANSWER,MATCH,LEVEL,SCORE,BONUS,TIMER,CHALLENGE,FOCUS,RELAX,SHARP,MIND'.split(',');
```

---

## PUZZLE GENERATORS

These run on the SERVER in Node.js. NOT in the browser. This is important for performance — 100 sudoku puzzles with unique-solution validation can take 10-30 seconds.

### Word Search Generator

Function signature: `makeWordSearch(words, size)` where words is an array of uppercase strings and size is the grid dimension (13 for large print, 15 for standard).

Algorithm step by step:

1. Create a size × size 2D array filled with empty strings
2. Define 8 directions: [0,1] right, [0,-1] left, [1,0] down, [-1,0] up, [1,1] diagonal down-right, [1,-1] diagonal down-left, [-1,1] diagonal up-right, [-1,-1] diagonal up-left
3. Sort the input words longest-first (longer words are harder to place, so do them first)
4. Create an empty array `placed` and an empty object `pSet` (position set)
5. For each word in the sorted list:
   a. If the word is longer than the grid size, skip it
   b. Shuffle the 8 directions randomly
   c. For each direction [dr, dc]:
      - Generate all possible starting positions (every cell in the grid) and shuffle them randomly
      - For each starting position [sr, sc]:
        - Check if the word fits: for each letter k (0 to word.length-1):
          - Calculate target cell: nr = sr + dr*k, nc = sc + dc*k
          - If nr or nc is out of bounds (< 0 or >= size): word doesn't fit, break
          - If grid[nr][nc] is not empty AND grid[nr][nc] is not the same letter as word[k]: word doesn't fit, break
          - (If the cell already has the same letter, that's fine — words can cross/overlap)
        - If all letters fit:
          - Place the word: for each letter k, set grid[sr+dr*k][sc+dc*k] = word[k]
          - Record positions: for each letter k, set pSet[(sr+dr*k) + ',' + (sc+dc*k)] = true
          - Add the word to the `placed` array
          - Mark this word as done, stop trying other positions and directions
6. After all words are attempted, fill remaining empty cells: for each cell that is still '', set it to a random letter A-Z (using String.fromCharCode(65 + Math.floor(Math.random() * 26)))
7. Return: `{ grid: [[...], ...], placed: [...], pSet: {...} }`

The `pSet` object is CRITICAL. It tells the answer key renderer which cells contain actual answer letters versus random filler. Without it, the answer key cannot highlight the correct cells.

### Sudoku Generator

Function signature: `makeSudoku(difficulty)` where difficulty is 'Easy', 'Medium', or 'Hard'.

Algorithm step by step:

**Step 1 — Generate a complete valid grid:**

1. Create a 9×9 array filled with zeros
2. Define a validation function `ok(board, row, col, num)` that returns true if placing `num` at [row][col] is valid:
   - Check the entire row: if any cell in that row already has `num`, return false
   - Check the entire column: if any cell in that column already has `num`, return false
   - Check the 3×3 box: calculate box top-left as (Math.floor(row/3)*3, Math.floor(col/3)*3), check all 9 cells in that box, if any has `num`, return false
   - Otherwise return true
3. Define a recursive fill function `fill(board)`:
   - Scan left-to-right, top-to-bottom for the first cell with value 0
   - If no empty cell found, the board is complete, return true
   - Shuffle the digits [1,2,3,4,5,6,7,8,9] randomly (this ensures different puzzles each time)
   - Try each shuffled digit: if `ok(board, row, col, digit)` is true, place it, recursively call fill. If fill returns true, we're done. If not, set the cell back to 0 and try the next digit.
   - If no digit works, return false (triggers backtracking)
4. Call fill(board). The board is now a complete valid sudoku.
5. Make a deep copy for the solution: `const solution = board.map(r => [...r])`
6. Make another deep copy for the puzzle: `const puzzle = board.map(r => [...r])`

**Step 2 — Remove cells to create the puzzle:**

Hole counts: Easy = 32 removed cells, Medium = 44 removed cells, Hard = 50 removed cells.

1. Create an array of all 81 cell indices [0, 1, 2, ... 80] and shuffle it randomly
2. Set a counter `removed = 0`
3. For each shuffled index:
   - If we've already removed enough cells, stop
   - Calculate row = Math.floor(index / 9), col = index % 9
   - If puzzle[row][col] is already 0, skip (already removed)
   - Save the backup value: `const backup = puzzle[row][col]`
   - Set puzzle[row][col] = 0 (tentatively remove it)
   - Count solutions of the current puzzle state using a recursive counter that stops at 2:
     - The counter function works like the fill function but counts completions instead of stopping at the first one
     - If count reaches 2, return immediately (we know it's not unique)
   - If the solution count is exactly 1: keep the removal, increment `removed`
   - If the solution count is not 1: restore the backup value (removing this cell would create multiple solutions)

4. Return: `{ puzzle: [[...], ...], solution: [[...], ...] }`

BOTH arrays must be returned. The `puzzle` array is used for the puzzle pages (cells with 0 are blanks). The `solution` array is used for the answer key pages.

---

## INTERIOR HTML BUILDER

Function signature: `buildInteriorHTML(opts)` where opts contains all form fields. Returns `{ html: string, totalPages: number }`.

### Configuration from opts

```
title = opts.title (required)
subtitle = opts.subtitle (default '')
author = opts.author (default '')
puzzleType = opts.puzzleType ('Word Search' or 'Sudoku')
puzzleCount = parseInt(opts.puzzleCount) (50, 75, or 100)
difficulty = opts.difficulty ('Easy', 'Medium', 'Hard')
largePrint = opts.largePrint (boolean, default true)
words = opts.words (array of strings, use DEFWORDS if empty or fewer than 10)
series = opts.series ('Single' or '3-Volume', default 'Single')
```

### Grid Size and Cell Size

```
if largePrint:
  gridSize = 13 (word search grid is 13×13)
  wordsPerPuzzle = 16 (how many words to attempt placing per puzzle)
  wordSearchCellPx = 32 (pixel width/height of each grid cell)
  wordSearchFontPx = 16 (font size inside grid cells)
  sudokuCellPx = 50
  sudokuFontPx = 22
  answersPerPage = 9 (word search) or 6 (sudoku) mini grids on each answer key page
else:
  gridSize = 15
  wordsPerPuzzle = 20
  wordSearchCellPx = 27
  wordSearchFontPx = 13
  sudokuCellPx = 44
  sudokuFontPx = 18
  answersPerPage = 12 (word search) or 8 (sudoku)
```

### Puzzle Generation

Generate ALL puzzles before building any HTML. Store them in an array.

```javascript
const wordBank = (opts.words && opts.words.length >= 10) ? opts.words : DEFWORDS;
const puzzles = [];
for (let i = 0; i < puzzleCount; i++) {
  if (isWordSearch) {
    // Shuffle the word bank and take wordsPerPuzzle words for this puzzle
    const subset = shuf(wordBank).slice(0, Math.min(wordBank.length, wordsPerPuzzle));
    puzzles.push(makeWordSearch(subset, gridSize));
  } else {
    puzzles.push(makeSudoku(difficulty));
  }
}
```

CRITICAL: The puzzles array is used for BOTH the puzzle pages AND the answer key pages. Do NOT regenerate puzzles when building the answer key. Use the SAME puzzle objects.

### Page Count Calculation

```
frontMatterPages = 3 (title page + how to play + table of contents)
puzzlePages = puzzleCount (one puzzle per page)
answerKeyPages = Math.ceil(puzzleCount / answersPerPage)
totalPages = frontMatterPages + puzzlePages + answerKeyPages
puzzleStartPage = 5 (cover would be page 1 if included, title = 1, how to play = 3, TOC = 4, first puzzle = 5)
answerKeyStartPage = puzzleStartPage + puzzleCount
```

Note: The cover is NOT in the interior PDF. The interior starts with the title page. But we number pages as if the cover were page 1 and title page is page 2 (unnumbered). So the first numbered page (How to Play) is page 3.

### HTML Document Structure

Start with:

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>[BOOK TITLE]</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: 8.5in 11in; margin: 0; }
.pg { width: 8.5in; min-height: 11in; page-break-after: always; position: relative; overflow: hidden; }
.pg:last-child { page-break-after: auto; }
.in { padding: 0.55in 0.4in 0.6in [GUTTER]in; background: #fff; }
.hd { display: flex; justify-content: space-between; font-family: 'Source Code Pro', monospace; font-size: 8px; color: #aaa; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 8px; }
.ft { position: absolute; bottom: 0.25in; left: [GUTTER]in; right: 0.4in; display: flex; justify-content: space-between; font-family: 'Source Code Pro', monospace; font-size: 9px; color: #bbb; border-top: 1px solid #e0e0e0; padding-top: 4px; }
</style></head><body>
```

Replace [GUTTER] with the calculated gutter margin.

### Page 1: Title Page

```html
<div class="pg in">
  <!-- NO header, NO footer on this page -->
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:9in;text-align:center;">
    <div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:4px;color:#888;text-transform:uppercase;margin-bottom:20px;">[PUZZLE TYPE] Collection</div>
    <div style="font-family:Lora,serif;font-size:34px;font-weight:700;color:#222;margin-bottom:10px;">[TITLE]</div>
    <div style="font-family:Lora,serif;font-size:15px;font-style:italic;color:#666;margin-bottom:24px;">[SUBTITLE]</div>
    <div style="width:56px;height:1px;background:#ccc;margin-bottom:20px;"></div>
    <div style="font-family:'Source Code Pro',monospace;font-size:9px;color:#999;line-height:2;">
      © [YEAR] All Rights Reserved · Published via Amazon KDP<br/>
      Puzzle content generated with AI assistance
      [if series: <br/>Volume 1 of 3]
    </div>
    [if author: <div style="font-family:Lora,serif;font-size:12px;color:#888;margin-top:12px;">[AUTHOR]</div>]
  </div>
</div>
```

The AI disclosure line "Puzzle content generated with AI assistance" is REQUIRED. KDP requires AI content disclosure. Without this, the book can be taken down.

### Page 2: How to Play (page number: 3)

This page HAS a running header and page footer.

```html
<div class="pg in">
  <div class="hd"><span>[TITLE]</span><span>[DIFFICULTY] · [PUZZLE TYPE]</span></div>
  <div style="padding-top:0.3in;">
    <div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:12px;">How to Play</div>
    <div style="width:56px;height:2px;background:#333;margin-bottom:20px;"></div>
    <div style="font-family:Lora,serif;font-size:13px;line-height:1.8;color:#333;margin-bottom:28px;">[INSTRUCTIONS TEXT]</div>
    <div style="border-left:3px solid #333;background:#f9f9f6;padding:14px 18px;">
      <div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:3px;color:#333;font-weight:600;margin-bottom:6px;">TIP</div>
      <div style="font-family:Lora,serif;font-size:12px;color:#444;">[TIP TEXT]</div>
    </div>
    [if largePrint: <div style="margin-top:20px;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:2px;color:#888;text-align:center;">LARGE PRINT EDITION</div>]
  </div>
  <div class="ft"><span>[TITLE]</span><span>3</span></div>
</div>
```

Instructions text for Word Search:
"Each puzzle contains a grid of letters with hidden words. Words can run horizontally, vertically, or diagonally — both forward and backward. Look at the word bank below each grid and find every listed word. Circle or highlight each word as you find it. Letters may overlap between different words. Take your time and enjoy the hunt!"

Instructions text for Sudoku:
"Each puzzle is a 9×9 grid divided into nine 3×3 boxes. Some cells contain given numbers. Fill in the empty cells so that every row, every column, and every 3×3 box contains the digits 1 through 9 exactly once. No digit may repeat within any row, column, or box. Start with cells that have only one possible value."

Tip text for Word Search: "Start by scanning for uncommon letters like Q, Z, X, or J — they narrow down word positions quickly."

Tip text for Sudoku: "Use pencil marks! Write small candidate numbers in empty cells and eliminate them as you solve."

### Page 3: Table of Contents (page number: 4)

```html
<div class="pg in">
  <div class="hd"><span>[TITLE]</span><span>[DIFFICULTY] · [PUZZLE TYPE]</span></div>
  <div style="padding-top:0.3in;">
    <div style="font-family:Lora,serif;font-size:26px;font-weight:700;color:#222;margin-bottom:16px;">Table of Contents</div>
    <div style="columns:2;column-gap:32px;">
      [For each puzzle up to 42:]
      <div style="display:flex;justify-content:space-between;font-family:'Source Code Pro',monospace;font-size:11px;color:#555;padding:2px 0;border-bottom:1px dotted #ddd;">
        <span>Puzzle #01</span><span>5</span>
      </div>
      [If puzzleCount > 42:]
      <div style="font-family:Lora,serif;font-size:11px;color:#888;padding:6px 0;font-style:italic;">… and [N] more</div>
    </div>
    <div style="margin-top:20px;font-family:'Source Code Pro',monospace;font-size:10px;color:#333;letter-spacing:2px;font-weight:600;">ANSWER KEY — PAGE [answerKeyStartPage]</div>
  </div>
  <div class="ft"><span>[TITLE]</span><span>4</span></div>
</div>
```

### Puzzle Pages (one per puzzle)

**Word Search page:**

```html
<div class="pg in">
  <div class="hd"><span>[TITLE]</span><span>[DIFFICULTY] · Word Search</span></div>
  <div style="padding-top:0.15in;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:600;color:#333;">#01</span>
      <span style="font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;color:#aaa;">WORD SEARCH · MEDIUM</span>
    </div>
    [GRID TABLE - see below]
    <div style="text-align:center;margin-top:8px;">
      [WORD CHIPS - see below]
    </div>
  </div>
  <div class="ft"><span>[TITLE]</span><span>[PAGE NUMBER]</span></div>
</div>
```

Grid table: An HTML table with border-collapse:collapse, margin:10px auto. Each cell is a td with:
- width and height: wordSearchCellPx (32px or 27px)
- text-align:center, vertical-align:middle
- font-family:'Source Code Pro',monospace
- font-size: wordSearchFontPx (16px or 13px)
- font-weight:500
- color:#333
- border:1px solid #ddd
- Content: a single uppercase letter from the grid array

Word chips: Each placed word rendered as:
```html
<span style="display:inline-block;font-family:'Source Code Pro',monospace;font-size:[11 or 10]px;background:#f5f3ee;border:1px solid #ddd;border-radius:3px;padding:3px 8px;margin:2px;">[WORD]</span>
```

**Sudoku page:**

Same structure as word search page but with a 9×9 grid table. Each cell:
- width and height: sudokuCellPx
- font-family:'Source Code Pro',monospace
- font-size: sudokuFontPx
- If cell has a given number (value > 0): color:#111, font-weight:700, background:#f5f5f0
- If cell is blank (value === 0): color:#fff (invisible, but maintains table structure)
- Borders: thin (1px solid #bbb) by default, THICK (2.5px solid #333) on the boundaries of 3×3 boxes. Specifically:
  - Right border is thick on columns 2, 5, and 8
  - Bottom border is thick on rows 2, 5, and 8
  - Top border is thick on row 0
  - Left border is thick on column 0
  - This creates the classic sudoku box grid

No word chips section for sudoku (obviously).

### Answer Key Pages

**Word Search answer key:**

Multiple mini grids per page (9 for large print, 12 for standard). Each mini grid:
- Has the puzzle number label above it (#01, #02, etc.)
- Shows the COMPLETE grid at miniature size (8-9px per cell)
- Cells that are in the pSet (answer cells): color:#000, font-weight:700, background:#e0e0d8
- Cells that are NOT in the pSet (filler cells): color:#ccc, font-weight:400, no background
- This creates a clear visual distinction where the answer words pop out against faded filler

The grids are laid out in a flex-wrap container with gap:14px, justify-content:center.

Each answer key page has header "Answer Key" and continuing page numbers.

**Sudoku answer key:**

Multiple solution grids per page (6 for large print, 8 for standard). Each grid:
- Shows the COMPLETE solution (all 81 numbers from the solution array, NOT the puzzle array)
- Cell size: 14-16px
- Maintains the thick box borders on rows/cols 0, 3, 6, 8
- All numbers in #333 colour

### Close the HTML document

```html
</body></html>
```

### CRITICAL: Interior is BLACK AND WHITE ONLY

There must be ZERO colour anywhere in the interior HTML. All text and borders must use greyscale values only: #000, #111, #222, #333, #444, #555, #666, #777, #888, #999, #aaa, #bbb, #ccc, #ddd, #eee, #f5f5f0, #f9f9f6, #fff.

If there is ANY colour (any accent, any tint, any RGB that isn't pure grey), KDP will classify the interior as a COLOUR book and charge £0.07 per page instead of £0.01 per page. On a 112-page book, that's £7.84 versus £1.12 printing cost. This completely destroys the profit margin.

---

## COVER HTML BUILDER

Function signature: `buildCoverHTML(opts, totalPages)` where opts contains form fields and totalPages is from the interior builder. Returns `{ html: string, fullW: number, fullH: number, spineW: number }`.

### KDP Cover Dimensions (Official Formulas)

```javascript
const bleed = 0.125;  // inches, on ALL four sides
const trimW = 8.5;    // inches, front and back cover width
const trimH = 11;     // inches, cover height
const paperThickness = (opts.paperType === 'cream') ? 0.0025 : 0.002252;  // inches per page
const spineW = totalPages * paperThickness + 0.06;  // 0.06 is cover material allowance
const fullW = bleed + trimW + spineW + trimW + bleed;  // total cover width
const fullH = bleed + trimH + bleed;  // total cover height = 11.25 inches
```

Example for a 112-page book on white paper:
- Spine = 112 × 0.002252 + 0.06 = 0.312 inches
- Full width = 0.125 + 8.5 + 0.312 + 8.5 + 0.125 = 17.562 inches
- Full height = 11.25 inches

These MUST be calculated dynamically. A fixed-size cover will be rejected by KDP because the spine won't match the actual book thickness.

### Colour Themes

```javascript
const THEMES = {
  midnight: { bg: '#0A0A14', ac: '#C8951A', tx: '#EDE8DC' },  // dark navy + gold
  forest:   { bg: '#0A1208', ac: '#4A8A4A', tx: '#E0EDE0' },  // dark green + green
  crimson:  { bg: '#140808', ac: '#C84A1A', tx: '#EDE0DC' },  // dark red + orange
  ocean:    { bg: '#080A14', ac: '#1A7AC8', tx: '#DCE4ED' },  // dark blue + blue
  violet:   { bg: '#100814', ac: '#8A4AC8', tx: '#E4DCED' },  // dark purple + purple
  slate:    { bg: '#0C0C0C', ac: '#C87A2A', tx: '#EDEBE6' },  // dark grey + rust
};
```

User selects a theme. The background (bg) covers the ENTIRE cover including spine and bleed area. The accent (ac) is used for the title text, decorative rules, and geometric decorations. The text colour (tx) is used for subtitles and metadata, often with hex opacity appended (e.g. tx + 'aa' for 67% opacity).

### Cover HTML Structure

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: [fullW]in [fullH]in; margin: 0; }
body {
  width: [fullW]in;
  height: [fullH]in;
  overflow: hidden;
  position: relative;
  background: [THEME BG COLOUR];
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
</style></head><body>
[BACK COVER]
[SPINE]
[FRONT COVER]
</body></html>
```

The print-color-adjust: exact and -webkit-print-color-adjust: exact on the body are CRITICAL. Without them, Puppeteer/Chrome will not render the dark background colour, and the cover will print as a white page with invisible white text.

### Back Cover

Positioned absolute. Left: bleed (0.125in). Top: bleed (0.125in). Width: 8.5in. Height: 11in. Background: theme bg colour.

Content is centred vertically and horizontally with padding 1.5in top/bottom and 1in left/right:
- Book description text: Lora serif, 16px, theme text colour at cc opacity (80%), line-height 1.8
- If no custom description provided, auto-generate: "Enjoy [count] carefully crafted [puzzle type] puzzles. [If largePrint: Large print formatting for comfortable solving.] Complete answer key included at the back."
- Thin horizontal rule: width 50px, 1px solid, accent colour
- Author name (if provided): Lora serif, 12px, text colour at 99 opacity
- Metadata line: Source Code Pro monospace, 9px, letter-spacing 3px, uppercase, text colour at 88 opacity. Format: "[count] [type] Puzzles | [difficulty] | Large Print"

BARCODE AREA: position absolute, bottom 0.5in, right 0.4in, width 2in, height 1.2in. Style: 1px dashed border in accent colour at 33 opacity. Centre the text "BARCODE AREA" inside in monospace 7px. KDP automatically places the ISBN barcode in this area. Do NOT put any content here.

### Spine

Positioned absolute. Left: bleed + trimW (so it starts right after the back cover). Top: bleed. Width: calculated spineW. Height: 11in (trimH). Background: theme bg colour.

If spineW >= 0.2 inches: show the title text (and author if provided) rotated -90 degrees (transform: rotate(-90deg)) so it reads from bottom to top. Source Code Pro monospace, 8px, letter-spacing 2px, text colour at bb opacity, uppercase, white-space nowrap. The text should be perfectly centred in the spine using display:flex, align-items:center, justify-content:center.

If spineW < 0.2 inches: leave the spine completely blank. KDP rejects books with spine text on thin spines.

### Front Cover

Positioned absolute. Left: bleed + trimW + spineW. Top: bleed. Width: 8.5in (trimW). Height: 11in (trimH). Background: theme bg colour. Overflow: hidden.

Geometric CSS decorations (on ALL styles):
- Circle: position absolute, top 12%, right 8%, width 120px, height 120px, border 2px solid accent at 22 opacity, border-radius 50%
- Circle: position absolute, bottom 15%, left 6%, width 80px, height 80px, border 2px solid accent at 18 opacity, border-radius 50%
- Diamond: position absolute, top 35%, right 12%, width 50px, height 50px, border 1.5px solid accent at 15 opacity, transform rotate(45deg)

These are subtle background decorations that add depth. They must NOT use SVG, emoji, or images — only CSS border properties.

**Classic style:**
- Content centred vertically and horizontally, text-align center, padding 1in on all sides
- Optional puzzle type badge: Source Code Pro monospace, 11px, letter-spacing 6px, uppercase, accent colour
- Horizontal rule: width 56px, height 2px, background accent, margin 0 auto 32px
- Title: Lora serif, 46px, font-weight 700, accent colour, line-height 1.15, padding 0 0.3in
- Subtitle: Lora serif, 16px, italic, text colour at aa opacity
- Second horizontal rule
- Author name (if provided): Source Code Pro, 12px, letter-spacing 2px, text at 99 opacity
- Metadata: Source Code Pro, 10px, letter-spacing 3px, text at 77 opacity

**Geometric style:**
- Full-width diagonal accent band: position absolute, top 18%, left -10%, width 130%, height 38%, background accent colour, transform rotate(-30deg), opacity 0.8
- Title: position relative z-index 1, text-align left, 52px, bold, white colour (#fff), text-shadow
- Subtitle below, author below, metadata at absolute bottom-left

**Luxury style:**
- Rectangular frame: position absolute, 0.35in inset from all edges, 3px solid accent colour border
- Title centred: 38px, bold, uppercase, letter-spacing 5px, text colour, padding 0 0.8in
- Thin rules above and below title: width 40px, 1px, accent
- Subtitle, author, metadata below

**Bold style:**
- Split layout: left 38% is accent colour background, right 62% is dark background
- Metadata in monospace on the accent side at the bottom
- Title on the dark side: 44px, bold, white
- Subtitle and author on the dark side

All content text on the front cover must have position:relative and z-index:1 to appear above the decorative elements.

---

## WEB UI (served as HTML string from GET /)

### Visual Design

Background: #0D0B07 (very dark brown-black)
Cards: #141108 background, 1px solid #2A2518 border, border-radius 6px, padding 20px 24px
Inputs: #1A1610 background, 1px solid #2A2518 border, border-radius 4px, padding 8px 12px, font-family Georgia serif, font-size 14px, colour #EDE8DC
Labels: font-family 'Courier New' monospace, font-size 10px, letter-spacing 3px, text-transform uppercase, colour #9A9080, margin-bottom 6px, margin-top 14px
Buttons: background #C8951A, colour #000, font-family 'Courier New' monospace, font-size 13px, font-weight bold, letter-spacing 1px, border-radius 4px, padding 14px 32px, width 100%, cursor pointer
Ghost buttons (secondary): background transparent, colour #C8951A, border 1px solid #C8951A
Disabled buttons: opacity 0.4, cursor not-allowed
Gold accent for section headers and highlights: #C8951A

### Form Layout

Wrapped in a max-width:660px centred container.

Header: "KDP PUZZLE ENGINE" in monospace 10px gold uppercase with 4px letter-spacing. Below: "Complete Book Generator" in Georgia 22px. Below: subtitle text "Generates print-ready Interior PDF + Cover PDF — upload directly to Amazon KDP" in monospace 11px grey.

Three card sections:

**Card 1 — Book Details:**
Title input, Subtitle input, Author input. Two-column row: Puzzle Type dropdown + Puzzle Count dropdown. Three-column row: Difficulty + Large Print + Paper Type.

**Card 2 — Cover Settings (gold border):**
Label "Cover Settings" in gold. Two-column row: Colour Theme dropdown + Cover Style dropdown. Back Cover Description textarea.

**Card 3 — Word List:**
Label "Word List (for Word Search — one word per line, or leave blank for defaults)". Textarea with placeholder showing example words.

Below the cards: live dimensions display showing "Interior: ~112 pages | Cover: 17.562 x 11.250 in | Spine: 0.312 in". This updates in real-time via JavaScript as the user changes puzzle count, type, and paper type.

Generate button: "Generate Interior PDF + Cover PDF"

### Loading State

When the user clicks Generate:
- Button becomes disabled
- A loading section appears with progress text and a shimmer animation
- Progress text updates: "Generating [count] puzzles..." → "Rendering interior PDF..." → "Rendering cover PDF..."
- Shimmer: a div with height 6px, dark background, containing an absolutely-positioned div with width 40%, gold gradient background (linear-gradient 90deg transparent, gold at 44 opacity, transparent), animated translateX from -200% to 500% over 1.5 seconds infinite

### Result Section

Appears after generation completes. Loading section hides.

- Centred decorative diamond symbol
- "Book Generated!" heading in gold
- "Both PDFs are ready. Download them and upload to KDP." subtitle
- "Download Interior PDF" button (gold, full width)
- "Download Cover PDF" button (ghost style, full width)
- KDP Upload Instructions card with gold border containing 9 numbered steps:
  1. Go to kdp.amazon.com → Create → Paperback
  2. Enter title, subtitle, author, keywords, description
  3. Check "Low-content book" under Categories
  4. AI disclosure → Yes
  5. Interior: B&W, White paper, 8.5×11in, No bleed
  6. Upload Interior PDF as manuscript
  7. Upload Cover PDF → select "Upload a print-ready PDF"
  8. Price: £7.99 (UK) or $9.99 (US) for 60% royalty
  9. Publish → review takes 24-72 hours
- "Generate Another Book" ghost button that resets the result section

### Client-Side JavaScript

The form does NOT use a <form> tag or form submission. Everything is handled with fetch API calls from onclick handlers.

```javascript
async function generate() {
  // Disable button, show loading
  // Collect all form values into a data object
  // POST /generate with JSON body → get { interiorHtml, totalPages, coverHtml, coverDims }
  // POST /pdf/interior with { html: interiorHtml } → get blob → store as interiorBlob
  // POST /pdf/cover with { html: coverHtml, fullW: coverDims.fullW, fullH: coverDims.fullH } → get blob → store as coverBlob
  // Hide loading, show result section
}

function downloadInterior() {
  // Create object URL from interiorBlob, create <a> element, set download filename, click it
  // Filename: [title-slug]-interior.pdf
}

function downloadCover() {
  // Same pattern with coverBlob
  // Filename: [title-slug]-cover.pdf
}
```

Store the blobs in variables at the page scope. The download functions create temporary <a> elements to trigger the browser download dialog.

---

## CRITICAL REQUIREMENTS (things that will cause KDP rejection if wrong)

1. ALL PUZZLES GENERATED ON THE SERVER. Not in the browser. Node.js has the performance for 100 sudoku puzzles.

2. COVER DIMENSIONS CALCULATED FROM PAGE COUNT. Never hardcoded. The spine width changes with every different page count.

3. INTERIOR IS PURE B&W. Zero colour. All greyscale hex values only. Colour triggers £0.07/page printing.

4. ANSWER KEY USES SAME PUZZLE DATA. The puzzles array is generated once and used for both puzzle pages and answer key pages. Never regenerate.

5. BARCODE AREA ON BACK COVER IS CLEAR. Bottom-right 2×1.2 inches. KDP places ISBN barcode here automatically.

6. GOOGLE FONTS LOADED VIA LINK TAG. And Puppeteer waits for networkidle0 before rendering to PDF. Otherwise fonts fall back to browser defaults and the book looks unprofessional.

7. AI DISCLOSURE ON TITLE PAGE. "Puzzle content generated with AI assistance". KDP requires this disclosure.

8. PAGE-BREAK-AFTER ALWAYS on every page div. Without this, multiple puzzles can appear on the same printed page.

9. PRINT-COLOR-ADJUST EXACT on cover body. Without this, dark backgrounds don't render in the PDF.

10. EXPRESS JSON LIMIT SET TO 50MB. The interior HTML for 100 puzzles can be 5-10MB.

11. PUPPETEER BROWSER REUSED. Launch once, create pages for each PDF, close pages not browser. Launching per request is too slow and crashes Replit.

12. SPINE TEXT ONLY IF SPINE >= 0.2 INCHES. Books with fewer pages have thin spines where text would be cut off. KDP rejects these.

---

## THAT IS EVERYTHING

This specification covers the complete application. There are no additional files, no additional routes, no additional features needed. Build exactly this and it will produce valid, sellable Amazon KDP puzzle books from a single web form.

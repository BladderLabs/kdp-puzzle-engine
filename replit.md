# KDP Puzzle Engine v6 — Production KDP Puzzle Book Platform

## Project Overview

A production-ready Amazon KDP puzzle book platform for self-publishers. Generates complete interior PDFs and full-wrap cover PDFs ready for KDP upload.

## Architecture

### Monorepo Layout
- `artifacts/kdp-engine/` — React + Vite frontend (dark gold KDP theme)
- `artifacts/api-server/` — Express API server (TypeScript, port 8080)
- `lib/db/` — PostgreSQL + Drizzle ORM (books table)
- `lib/api-spec/` — OpenAPI 3.1 spec
- `lib/api-client-react/` — Generated React Query hooks (via Orval)
- `lib/api-zod/` — Generated Zod validation schemas (via Orval)

### Frontend Pages (wouter routing)
- `/` — Dashboard: list/open/clone/delete book projects
- `/create` — New book wizard with live preview + niche assistant
- `/books/:id` — Edit existing book project
- `/generate/:id` — Generate interior + cover PDFs with progress UI

### API Endpoints (all under `/api`)
- `GET /books` — List all book projects
- `POST /books` — Save new project
- `GET /books/:id` — Get project
- `PUT /books/:id` — Update project
- `DELETE /books/:id` — Delete project
- `POST /books/:id/clone` — Clone as new volume
- `POST /generate` — Build interior + cover HTML
- `POST /pdf/interior` — Render interior PDF (Puppeteer)
- `POST /pdf/cover` — Render full-wrap cover PDF (Puppeteer)
- `POST /puzzles/preview` — Live puzzle data for browser preview
- `GET /niches` — List all 28 niches
- `POST /niche-assistant` — Get themed words/titles/keywords

## Puzzle Generators (lib: `artifacts/api-server/src/lib/puzzles.ts`)

All original v5 generators preserved faithfully:
- **Word Search** — `makeWordSearch()` — letter grid, 8 directions, word bank
- **Sudoku** — `makeSudoku()` — unique-solution backtracker, 3 difficulty levels

New generators added alongside originals:
- **Maze** — `makeMaze()` — recursive backtracker, bitmask walls (N/E/S/W)
- **Number Search** — `makeNumberSearch()` — digit sequences in grid
- **Cryptogram** — `makeCryptogram()` — substitution cipher with famous quotes

## HTML Builders (lib: `artifacts/api-server/src/lib/html-builders.ts`)

Original `buildInteriorHTML()` and `buildCoverHTML()` preserved and extended:
- Interior: title page, how-to-play, table of contents, puzzle pages, answer key
- Cover: full-wrap KDP cover at exact bleed dimensions

### Cover Styles (6 total)
Original 4: `classic`, `geometric`, `luxury`, `bold`
New 2: `minimal`, `retro`

### Color Themes (8 total)
Original 6: `midnight`, `forest`, `crimson`, `ocean`, `violet`, `slate`
New 2: `rose`, `ember`

## Niche Intelligence (lib: `artifacts/api-server/src/lib/niches.ts`)

28 curated niches with themed word lists, KDP title ideas (5 per niche), 8 SEO keywords per niche, back cover blurbs, and recommended difficulty/count.

Niches include: seniors, kids, christmas, nurses, teachers, dogs, cats, sudoku-easy, sudoku-hard, halloween, mothers-day, truckers, gardening, bible, cooking, travel, maze-kids, cryptogram-adults, number-search, fathers-day, graduation, valentines, sports, space, retirement, minecraft, birthdays, anxiety-mindfulness.

## PDF Generation (lib: `artifacts/api-server/src/lib/pdf.ts`)

Puppeteer-based `htmlToPdf()` — ported from original v5. Shared browser instance, `networkidle0` wait.

## Database

PostgreSQL with Drizzle ORM. Schema: `books` table with all book config fields.

## Key Dependencies

- **puppeteer** — Headless Chromium PDF rendering
- **drizzle-orm** + **drizzle-kit** — PostgreSQL ORM + migrations
- **@tanstack/react-query** — Server state management
- **wouter** — Client-side routing
- **react-hook-form** + **zod** — Form validation
- **orval** — OpenAPI codegen (hooks + Zod schemas)

## Page Calculation (original formula preserved)

```
totP = 3 + puzzleCount + ceil(puzzleCount / aPer)
spineW = totP * thick + 0.06
thick = paperType === 'cream' ? 0.0025 : 0.002252
gutter = gutterIn(totP)   // 0.375" to 0.75" based on page count
```

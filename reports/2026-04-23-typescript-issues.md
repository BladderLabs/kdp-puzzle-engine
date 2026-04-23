# TypeScript Issue Report — 2026-04-23

Fetched 16 commits (2a60d9f → 433d496). Both servers start and run.
Migration 002 applied successfully. Report below is **findings only** — no code was changed.

---

## API Server (`artifacts/api-server`)

### ISSUE-01 · `src/lib/pdf.ts` lines 77–94 — `document` not found (8 errors)

**Severity:** Low (runtime works; esbuild bundles without strict TS checking)

**Errors:**
```
src/lib/pdf.ts(77,18): error TS2584: Cannot find name 'document'.
src/lib/pdf.ts(77,46): error TS2584: Cannot find name 'document'.
src/lib/pdf.ts(77,64): error TS2584: Cannot find name 'document'.
src/lib/pdf.ts(78,15): error TS2584: Cannot find name 'document'.
src/lib/pdf.ts(86,33): error TS2584: Cannot find name 'document'.
src/lib/pdf.ts(89,11): error TS18046: 'img' is of type 'unknown'.
src/lib/pdf.ts(89,27): error TS18046: 'img' is of type 'unknown'.
src/lib/pdf.ts(93,17): error TS18046: 'img' is of type 'unknown'.
src/lib/pdf.ts(94,17): error TS18046: 'img' is of type 'unknown'.
```

**Root cause:** The new PDF quality code (300 DPI, `document.fonts.ready`, image wait) runs
inside a `page.evaluate()` string/closure that Puppeteer executes in the browser context.
TypeScript sees it as plain server-side Node.js code and cannot find `document` because the
API server's tsconfig does not include `"dom"` in its `lib` array.

The `img` errors follow from `document.querySelectorAll('img')` returning `NodeListOf<unknown>`
without the DOM lib.

**Suggested fix:** Wrap the entire `page.evaluate(async () => { ... })` callback in a
`// @ts-ignore` or change its signature to `page.evaluate(/* @type {() => Promise<void>} */
async () => { ... })`. Alternatively — and more correctly — declare the inline function body
as a string literal passed to `page.evaluate` so TS never tries to type-check it as local code.

---

### ISSUE-02 · `src/routes/agents/create-book.ts:984` — `narrativeArcJson` unknown to Drizzle (1 error)

**Severity:** Medium (insert call will fail at runtime for detective/adventure books)

**Error:**
```
src/routes/agents/create-book.ts(984,29): error TS2769: No overload matches this call.
  Object literal may only specify known properties, and
  'narrativeArcJson' does not exist in type '{ title: ... }'.
```

**Root cause:** Migration 002 added `narrative_arc_json` and `amazon_asin` columns to the
`books` table, and `lib/db/src/schema/books.ts` was updated with those fields. However the
**compiled dist** of `@workspace/db` has not been rebuilt — `artifacts/api-server` imports
from the compiled package output, not the source. The new columns are invisible to TypeScript
and Drizzle's type inference still uses the old schema snapshot.

**Suggested fix:** Run `pnpm --filter @workspace/db run build` (or `tsc --build` in `lib/db`)
to regenerate the dist, then restart the API server. The insert on line 984 should then
type-check and execute correctly.

---

## Frontend (`artifacts/kdp-engine`)

### ISSUE-03 · `src/pages/BookPublish.tsx:241` — `"high-quality"` not a valid CSS ImageRendering value (1 error)

**Severity:** Low (renders fine in browser; only a TS compile error)

**Error:**
```
src/pages/BookPublish.tsx(241,20): error TS2322:
  Type '"high-quality"' is not assignable to type 'ImageRendering | undefined'.
```

**Root cause:** The new BookPublish page sets `style={{ imageRendering: "high-quality" }}`
on the cover `<img>`. `"high-quality"` is not in React's `CSSProperties` union for
`ImageRendering`. The CSS spec uses `"optimizeQuality"` (legacy) or the browser handles it
via `image-rendering: -webkit-optimize-contrast`. React's TS types do not accept the
`"high-quality"` string.

**Suggested fix:** Change to `"optimizeQuality" as React.CSSProperties["imageRendering"]`
or simply remove the property (the cover image already has `image-rendering: high-quality`
set via `Cover img` commit on the element's className).

---

### ISSUE-04 · `src/components/book/BookForm.tsx:663` — loose `number` passed to `60 | 30 | 90` union (1 error)

**Severity:** Low (no runtime impact)

**Error:**
```
src/components/book/BookForm.tsx(663,71): error TS2345:
  Argument of type 'number | undefined' is not assignable to
  parameter of type '60 | 30 | 90 | undefined'.
```

**Root cause:** A computed or stored value with type `number` is passed to a prop/parameter
that expects the literal union `60 | 30 | 90 | undefined`. TypeScript cannot narrow a
plain `number` to the literal union without a cast or guard.

**Suggested fix:** Cast at call site: `value as 60 | 30 | 90 | undefined` — or validate
the value against the allowed set before passing.

---

### ISSUE-05 · `src/components/book/PreviewPane.tsx` — `crossword` missing from `PuzzleData`, implicit `any` in iterators (5 errors)

**Severity:** Medium (crossword preview will not render; TypeScript loses type safety on grid iteration)

**Errors:**
```
PreviewPane.tsx(198,38): error TS2339: Property 'crossword' does not exist on type 'PuzzleData'.
PreviewPane.tsx(199,23): error TS2339: Property 'crossword' does not exist on type 'PuzzleData'.
PreviewPane.tsx(208,29): error TS7006: Parameter 'row' implicitly has an 'any' type.
PreviewPane.tsx(208,34): error TS7006: Parameter 'r' implicitly has an 'any' type.
PreviewPane.tsx(210,29): error TS7006: Parameter 'cell' implicitly has an 'any' type.
PreviewPane.tsx(210,35): error TS7006: Parameter 'c' implicitly has an 'any' type.
```

**Root cause:** `PreviewPane.tsx` now renders crossword grids using `puzzleData.crossword`,
but the `PuzzleData` type definition (likely in `lib/api-client-react` or a local types file)
does not include a `crossword` property. The grid-iteration callbacks (`row`, `r`, `cell`, `c`)
inherit `any` because the array they iterate over is untyped.

**Suggested fix:** Add `crossword?: CrosswordData` to the `PuzzleData` type in the generated
API client or local type declaration, then type the iterator parameters explicitly.

---

### ISSUE-06 · Pre-existing errors in `AgentCreateBook`, `CreateBook`, `EditBook` (6 errors)

**Severity:** Low (pre-existing; tracked as task #41)

**Errors:**
```
AgentCreateBook.tsx(207,9): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
AgentCreateBook.tsx(208,9): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
CreateBook.tsx(20,9):  difficultyMode: string not assignable to CreateBookBodyDifficultyMode.
EditBook.tsx(20,9):    difficultyMode: string not assignable to CreateBookBodyDifficultyMode.
EditBook.tsx(39,30):   Book → Record<string,unknown> cast overlap error.
EditBook.tsx(40,11):   Book → Record<string,unknown> cast overlap error.
```

**Root cause:** These were present before today's pull and are unchanged. They stem from loose
`string` types where generated API schema unions are expected, and from `Book` no longer
overlapping with `Record<string,unknown>` after schema narrowing.

---

## Summary Table

| # | File | Error count | Severity | New? |
|---|------|------------|----------|------|
| 01 | `api-server/src/lib/pdf.ts` | 8 | Low | ✅ New |
| 02 | `api-server/src/routes/agents/create-book.ts:984` | 1 | **Medium** | ✅ New |
| 03 | `kdp-engine/src/pages/BookPublish.tsx:241` | 1 | Low | ✅ New |
| 04 | `kdp-engine/src/components/book/BookForm.tsx:663` | 1 | Low | Pre-existing |
| 05 | `kdp-engine/src/components/book/PreviewPane.tsx` | 5 | **Medium** | ✅ New |
| 06 | `AgentCreateBook` / `CreateBook` / `EditBook` | 6 | Low | Pre-existing (#41) |

**Total: 22 TS errors across 7 files. 15 are new from this pull. 7 are pre-existing.**

The only errors likely to cause a visible runtime failure are:
- **ISSUE-02** (`narrativeArcJson` insert) — will throw a Drizzle error when creating a detective/adventure book
- **ISSUE-05** (`crossword` on PuzzleData) — crossword preview panel will crash or show nothing

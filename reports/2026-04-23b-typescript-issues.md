# TypeScript Issue Report — 2026-04-23 (pull #2)

Fetched 6 commits (1dd7e63 → 89d4688). Fast-forward, no conflicts.
Migration 004 (bsr_snapshots) will apply on next server start. Report below is **findings only** — no code changed.

---

## API Server (`artifacts/api-server`)

### ISSUE-01 · `src/routes/agents/create-book.ts:4` — `cachedRun` and `stableKey` not exported from `@workspace/db` (2 errors + 15 cascading)

**Severity:** High — `cachedRun` is called on every agent pipeline run. The council-cache feature will silently fail at runtime (esbuild bundles without strict type checks, but the missing export means the functions are `undefined` at call time).

**Errors:**
```
create-book.ts:4 - error TS2305: Module '"@workspace/db"' has no exported member 'cachedRun'.
create-book.ts:4 - error TS2305: Module '"@workspace/db"' has no exported member 'stableKey'.
```
Plus 15 further errors (lines 274–510) that all stem from the unresolved import: `buyerProfile` possibly undefined, and `.then(r => {` / `.catch(err => {` callbacks typed as implicit `any`.

**Root cause:** `lib/db/src/council-cache.ts` was added and `lib/db/src/index.ts` was updated to export `cachedRun` and `stableKey`, but the **compiled dist of `@workspace/db`** has not been rebuilt. The API server imports from the dist output, so the new exports are invisible to both TypeScript and the runtime.

**Suggested fix:** Run `pnpm --filter @workspace/db run build` (or `tsc --build` in `lib/db`) to regenerate the dist. This also resolves all 15 cascading errors on lines 274–510.

---

### ISSUE-02 · `src/routes/bsr.ts:152,154` — `booksTable.amazonAsin` not in Drizzle type (2 errors)

**Severity:** High — the new BSR routes (`PUT /books/:id/asin`, `POST /bsr/sync`, `GET /bsr/snapshots/:id`) will crash at the `.select` and `.where` calls.

**Errors:**
```
bsr.ts:152 - error TS2339: Property 'amazonAsin' does not exist on type 'PgTableWithColumns<...booksTable...>'.
bsr.ts:154 - error TS2339: Property 'amazonAsin' does not exist on type 'PgTableWithColumns<...booksTable...>'.
```

**Root cause:** Same stale `@workspace/db` dist as ISSUE-01. `amazon_asin` was added to `lib/db/src/schema/books.ts` in migration 002, but the dist was never rebuilt — so `booksTable.amazonAsin` does not exist in the compiled type.

**Suggested fix:** Same fix as ISSUE-01 — rebuild `@workspace/db` dist. Both issues are resolved with a single rebuild.

---

## Frontend (`artifacts/kdp-engine`)

### ISSUE-03 · `src/components/book/PreviewPane.tsx:260,268` — `cw.across` and `cw.down` possibly undefined (2 errors)

**Severity:** Medium — if a crossword puzzle is previewed and either `across` or `down` is missing from the payload, the component will throw at runtime and the preview pane will crash.

**Errors:**
```
PreviewPane.tsx:260 - error TS18048: 'cw.across' is possibly 'undefined'.
PreviewPane.tsx:268 - error TS18048: 'cw.down'   is possibly 'undefined'.
```

**Root cause:** The local `CrosswordPayload` type defines `across` and `down` as optional (`?:`). The render code accesses them with `.slice(0, 8).map(...)` directly — no optional-chaining or guard before the access.

**Suggested fix:** Add a null guard before each block:
```tsx
{cw.across && cw.across.slice(0, 8).map((cl) => ( ... ))}
{cw.down   && cw.down.slice(0, 8).map((cl) => ( ... ))}
```
Or change the type to make `across` and `down` required and always supply them from the backend.

---

## Summary Table

| # | File | Error count | Severity | New? |
|---|------|------------|----------|------|
| 01 | `api-server/routes/agents/create-book.ts` | 17 | **High** | ✅ New |
| 02 | `api-server/routes/bsr.ts` | 2 | **High** | ✅ New |
| 03 | `kdp-engine/components/book/PreviewPane.tsx` | 2 | Medium | ✅ New |

**Total: 21 TS errors across 3 files. All are new from this pull.**

The two high-severity issues share a single root cause: `@workspace/db` dist is stale.
Rebuilding it fixes 19 of the 21 errors in one step.

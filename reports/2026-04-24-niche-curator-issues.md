# Issue Report — 2026-04-24: Niche Content Curator & New Routes

Pull: 8 files changed — `niche-content-curator.ts`, `html-builders.ts`, `puzzles.ts`,
`admin.ts`, `books.ts`, `generate.ts`, `index.ts`, `BookPublish.tsx`

---

## CRITICAL — Runtime Cryptogram Breakage (TypeScript error + silent data corruption)

**File:** `artifacts/api-server/src/lib/html-builders.ts` line 197  
**Also:** `artifacts/api-server/src/lib/agents/niche-content-curator.ts` lines 19-23  
**Also:** `artifacts/api-server/src/routes/generate.ts` line 95

### What the type error is

```
error TS2345: Argument of type '{ quote: string; author: string; }[] | undefined'
is not assignable to parameter of type 'QuoteEntry[] | undefined'.
```

### Root cause — field name mismatch across three layers

The `QuoteEntry` interface in `puzzles.ts` uses the field `text`:

```ts
// puzzles.ts line 248
export interface QuoteEntry {
  text: string;    // ← "text"
  author: string;
}
```

The Niche Content Curator's Zod schema uses the field `quote`:

```ts
// niche-content-curator.ts line 19
export const ThemedQuoteSchema = z.object({
  quote: z.string().min(10).max(280),  // ← "quote"
  author: z.string(),
});
```

`BuildOpts.themedQuotes` in `html-builders.ts` also uses `quote`:

```ts
// html-builders.ts line 71
themedQuotes?: Array<{ quote: string; author: string }>;  // ← "quote"
```

And `generate.ts` maps through preserving `quote`:

```ts
// generate.ts line 95
(opts as BuildOpts).themedQuotes = pack.themedQuotes.map(q => ({ quote: q.quote, author: q.author }));
```

When `makeCryptogram` receives this pool and accesses `pool[i].text`, **the value is
`undefined`** at runtime because the objects have `quote`, not `text`. Every niche
cryptogram book will silently produce blank cipher text — the puzzle renders with no
characters to encrypt.

### Effect

- TypeScript compile error blocks clean builds
- Runtime: all Cryptogram puzzles in niche books (any niche with `puzzleType:
  "Cryptogram"`) produce empty cipher text — the puzzle is broken but the PDF still
  exports without error
- Non-niche books are unaffected (they use `QUOTE_BANK` which correctly uses `text`)

### Fix

Two equivalent approaches:

**Option A** — rename `QuoteEntry.text` → `QuoteEntry.quote` (matches curator + builder):

```ts
// puzzles.ts
export interface QuoteEntry {
  quote: string;   // was: text
  author: string;
}
// Also update QUOTE_BANK entries: { text: "..." } → { quote: "..." }
// Also update makeCryptogramFromQuote to use quote.quote instead of quote.text
```

**Option B** — rename `ThemedQuoteSchema.quote` → `ThemedQuoteSchema.text` (matches
QuoteEntry + QUOTE_BANK):

```ts
// niche-content-curator.ts
export const ThemedQuoteSchema = z.object({
  text: z.string().min(10).max(280),   // was: quote
  author: z.string(),
});
// Update prompt to ask for "text" not "quote"
// Update BuildOpts.themedQuotes in html-builders.ts
// Update generate.ts map: q => ({ text: q.text, author: q.author })
```

Option B is smaller: it changes only the curator, builder opts, and the generate
mapping — no changes to `QUOTE_BANK` (370 existing entries all have `text`).

---

## HIGH — `POST /admin/reset-library` has no authentication

**File:** `artifacts/api-server/src/routes/admin.ts`

The reset endpoint is protected only by a confirmation string in the body:

```ts
const ResetBody = z.object({ confirm: z.literal("WIPE_ALL_BOOKS") });
```

The confirmation string is visible in any open-source/shared deployment of the
project, and the endpoint is publicly accessible with no IP allow-list, session
check, or API key requirement.

A single `curl` call wipes the entire book library and all BSR snapshots. Author
personas and council_cache survive, but all generated books are lost permanently
(no soft-delete, no backup).

### Effect

- Any actor who discovers the route URL can destroy the library
- `bsr_snapshots` are also wiped — historical BSR data is gone
- No audit log: `req.log.info` records the event but there's no pre-wipe record of
  how many books were deleted

### Recommended mitigations (in priority order)

1. Add a static `ADMIN_SECRET` environment variable and require it as a bearer token
   or header (`Authorization: Bearer <secret>`) in addition to the confirmation body
2. Add middleware that restricts the `/api/admin/*` prefix to `localhost` or an
   internal subnet
3. Soft-delete: add a `deleted_at` timestamp column to `books` and filter it on
   normal queries so a wipe can be reversed

---

## MEDIUM — `admin.ts` runs `BEGIN/COMMIT` inside `db.execute()` — may silently no-op on connection-pooled setups

**File:** `artifacts/api-server/src/routes/admin.ts` lines 38-44

```ts
await db.execute(sql`
  BEGIN;
  DELETE FROM bsr_snapshots;
  DELETE FROM books;
  ALTER SEQUENCE books_id_seq RESTART WITH 1;
  COMMIT;
`);
```

Drizzle's `db.execute()` passes the SQL string to `pg` via a `Pool`. With connection
pooling (including PgBouncer in transaction mode) issuing `BEGIN` and `COMMIT` as
part of a multi-statement string is unreliable — the pool may split the statements
across connections. If `DELETE FROM bsr_snapshots` succeeds but `DELETE FROM books`
runs on a different connection (outside the transaction), partial wipes can occur with
no error thrown.

### Fix

Use Drizzle's `db.transaction()` API:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`DELETE FROM bsr_snapshots`);
  await tx.execute(sql`DELETE FROM books`);
  await tx.execute(sql`ALTER SEQUENCE books_id_seq RESTART WITH 1`);
});
```

---

## LOW — `generate.ts` uses `as BuildOpts` cast to bypass type error

**File:** `artifacts/api-server/src/routes/generate.ts` line 95

```ts
(opts as BuildOpts).themedQuotes = pack.themedQuotes.map(q => ({ quote: q.quote, author: q.author }));
```

The `as BuildOpts` cast was used to paper over the type incompatibility between
`themedQuotes` (curator output) and `BuildOpts.themedQuotes`. Even after the
CRITICAL field mismatch above is fixed, the cast should be removed and the correct
type should be used inline, or `opts` should be declared as `BuildOpts` from the
start.

---

## LOW — Niche Content Curator prompt asks for `"quote"` but fallback entries use `text`

**File:** `artifacts/api-server/src/lib/agents/niche-content-curator.ts` lines 82-91

The fallback `fallbackPack()` function constructs `themedQuotes` using a hard-coded
array. If the field name fix described above adopts `text` as the canonical name, the
fallback will also need updating. Conversely if `quote` is kept, the fallback is
already correct. This is a maintenance note, not a standalone bug.

---

## Summary

| Severity | Issue | File |
|---|---|---|
| CRITICAL | `quote` vs `text` field mismatch breaks all niche cryptograms at runtime | `puzzles.ts`, `niche-content-curator.ts`, `html-builders.ts`, `generate.ts` |
| HIGH | `/admin/reset-library` unauthenticated — wipes entire library | `admin.ts` |
| MEDIUM | Manual `BEGIN/COMMIT` in `db.execute()` unsafe with connection pools | `admin.ts` |
| LOW | `as BuildOpts` cast hides type error | `generate.ts` |
| LOW | Fallback quotes must match whichever field name is chosen | `niche-content-curator.ts` |

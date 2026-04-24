# Database Design Analysis — 2026-04-24

Scope: `lib/db/src/schema/`, `lib/db/src/migrate.ts`, `lib/db/src/council-cache.ts`,
`lib/db/src/index.ts`, `lib/db/drizzle.config.ts`, and all routes that issue DB queries.

---

## CRITICAL — `council_cache` and `bsr_snapshots` are unmanaged "shadow tables"

**Files:** `lib/db/src/migrate.ts` (migrations 003, 004), `lib/db/src/schema/index.ts`

Both tables are created by the custom migration runner and are actively queried in
production, but neither has a corresponding Drizzle table definition in
`lib/db/src/schema/`. The Drizzle schema knows only about four tables:

```
books  author_personas  conversations  messages
```

`council_cache` and `bsr_snapshots` exist in the database but are invisible to the
Drizzle ORM. This creates three concrete risks:

### Risk 1 — `drizzle-kit push` will drop them

Running `pnpm --filter @workspace/db run push` (or `push-force`) tells Drizzle to sync
the live database to match the schema files. Because neither shadow table is in the
schema, Drizzle will issue `DROP TABLE council_cache` and `DROP TABLE bsr_snapshots`.
The `push-force` flag bypasses the "are you sure?" prompt. All cached council outputs
and all historical BSR snapshots would be permanently destroyed with a single command.

### Risk 2 — All queries are untyped raw SQL

Every read and write to `council_cache` goes through `db.execute(sql\`...\`)` with no
Drizzle type inference. The `rowCount` accessor requires a cast
`(r as unknown as { rowCount?: number })`. A column rename or typo in a raw SQL string
causes a runtime crash, not a compile error.

Same for `bsr_snapshots` in `artifacts/api-server/src/routes/bsr.ts`.

### Risk 3 — Fresh DB builds are missing two tables

If the database is ever rebuilt (environment reset, production deploy, new contributor),
the only mechanism that creates `council_cache` and `bsr_snapshots` is the custom
migration runner in `migrate.ts`. As long as the server starts up and calls
`runMigrations()`, they are created. But if someone initialises the DB with
`drizzle-kit push` instead (the documented approach in `package.json`), neither table
is created and the server crashes on the first cache write.

### Fix

Add Drizzle table definitions for both tables in `lib/db/src/schema/`:

```ts
// lib/db/src/schema/council-cache.ts
export const councilCacheTable = pgTable("council_cache", {
  id:         serial("id").primaryKey(),
  agent:      text("agent").notNull(),
  cacheKey:   text("cache_key").notNull(),
  outputJson: jsonb("output_json").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  expiresAt:  timestamp("expires_at").notNull(),
}, (t) => ({ lookup: uniqueIndex("council_cache_lookup").on(t.agent, t.cacheKey) }));

// lib/db/src/schema/bsr-snapshots.ts
export const bsrSnapshotsTable = pgTable("bsr_snapshots", {
  id:          serial("id").primaryKey(),
  bookId:      integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  asin:        text("asin").notNull(),
  marketplace: text("marketplace").notNull().default("US"),
  bsr:         integer("bsr"),
  priceUsd:    numeric("price_usd", { precision: 6, scale: 2 }),
  reviewCount: integer("review_count"),
  starRating:  numeric("star_rating", { precision: 2, scale: 1 }),
  capturedAt:  timestamp("captured_at").notNull().defaultNow(),
  source:      text("source").notNull().default("apify"),
});
```

---

## HIGH — `conversations` and `messages` tables have no migration

**Files:** `lib/db/src/schema/conversations.ts`, `lib/db/src/schema/messages.ts`,
`lib/db/src/migrate.ts`

The opposite problem: these two tables ARE in the Drizzle schema and are actively used
by `artifacts/api-server/src/routes/anthropic/conversations.ts`, but they have no
entry in `BUILTIN_MIGRATIONS`. They were almost certainly created by an early
`drizzle-kit push` during initial development.

As long as nobody resets the database, they exist. But on any fresh environment
(production deploy, new developer machine, database wipe and rebuild), `runMigrations()`
runs all four built-in migrations and then the server starts. The conversations routes
immediately fail with:

```
relation "conversations" does not exist
```

### Fix

Add a migration `000_initial_schema` (or `005_conversations`) to `BUILTIN_MIGRATIONS`:

```ts
{
  name: "000_initial_schema",
  sql: `
    CREATE TABLE IF NOT EXISTS conversations (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `,
}
```

This migration should be inserted at the beginning of the array (before `001`) so it
runs first on a clean database.

---

## HIGH — `priceRecommended` and `royaltyEstimate` stored as `TEXT`

**File:** `lib/db/src/schema/books.ts` lines 28–29

```ts
priceRecommended: text("price_recommended"),
royaltyEstimate:  text("royalty_estimate"),
```

Both fields hold monetary values (e.g. `"9.99"`, `"3.42"`). The pipeline stores them
as strings formatted by `.toFixed(2)` in `create-book.ts`:

```ts
priceRecommended: listingPriceUsd != null ? listingPriceUsd.toFixed(2) : null,
royaltyEstimate:  listingRoyaltyUsd != null ? listingRoyaltyUsd.toFixed(2) : null,
```

Consequences:
- No numeric range queries (`WHERE price_recommended > 10.00` requires a cast)
- No aggregations (`AVG`, `MAX`) without `::numeric` casts
- Values like `"9.99"` and `"$9.99"` are both valid strings — format is caller-enforced
- The library analysis route (`/library/analysis`) cannot bucket books by price tier
  without casting every row

### Fix

Change both columns to `numeric`:

```ts
priceRecommended: numeric("price_recommended", { precision: 6, scale: 2 }),
royaltyEstimate:  numeric("royalty_estimate", { precision: 6, scale: 2 }),
```

Migration needed:

```sql
ALTER TABLE books
  ALTER COLUMN price_recommended TYPE NUMERIC(6,2) USING price_recommended::numeric,
  ALTER COLUMN royalty_estimate  TYPE NUMERIC(6,2) USING royalty_estimate::numeric;
```

---

## MEDIUM — `updatedAt` is not updated in the AI pipeline's book INSERT path

**Files:** `lib/db/src/schema/books.ts`, `artifacts/api-server/src/routes/agents/create-book.ts`

The `books` table has `updatedAt timestamp NOT NULL DEFAULT NOW()`. Manual PATCH routes
in `books.ts` correctly pass `updatedAt: new Date()`. However, when the pipeline
creates a book at the assemble stage (line ~1042 of `create-book.ts`), it does an
INSERT via Drizzle — `updatedAt` gets set from the column default (= `createdAt`).

If the book is later re-generated (same book, new pipeline run), the existing code path
does not UPDATE the book — it inserts a new one. So `updatedAt` always equals
`createdAt` for pipeline-created books, making the field useless for detecting which
books have been refreshed.

Additionally, PostgreSQL has no `ON UPDATE CURRENT_TIMESTAMP` equivalent. There is no
trigger maintaining this column. If any future code path updates a book column without
also setting `updatedAt: new Date()`, the staleness is silent.

### Fix

Add a Postgres trigger to auto-maintain the column:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER author_personas_updated_at
  BEFORE UPDATE ON author_personas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## MEDIUM — `lib/db/package.json` has no `build` script

**File:** `lib/db/package.json`

```json
"scripts": {
  "push":       "drizzle-kit push --config ./drizzle.config.ts",
  "push-force": "drizzle-kit push --force --config ./drizzle.config.ts"
}
```

There is no `build` script. The `tsconfig.json` is configured with
`"emitDeclarationOnly": true` and `"outDir": "dist"`, so a build command is expected.
Other packages in the monorepo reference `@workspace/db` and rely on the `dist/`
folder for type declarations.

When schema changes are made (e.g. a new column is added), developers must remember to
manually run `tsc -p lib/db/tsconfig.json` to regenerate the dist. Forgetting this is
the root cause of every stale-type TypeScript error that has appeared across the
previous three issue reports in this project.

### Fix

Add a build script and wire it into the monorepo build:

```json
"scripts": {
  "build":      "tsc -p tsconfig.json",
  "push":       "drizzle-kit push --config ./drizzle.config.ts",
  "push-force": "drizzle-kit push --force --config ./drizzle.config.ts"
}
```

Then add `@workspace/db` to the `build` dependencies in `pnpm-workspace.yaml` or root
`package.json` so `pnpm run build` rebuilds it before dependent packages.

---

## MEDIUM — `council_cache.created_at` is reset on every cache refresh

**File:** `lib/db/src/council-cache.ts` lines 69-75

```ts
await db.execute(sql`
  INSERT INTO council_cache (agent, cache_key, output_json, expires_at)
  VALUES (${agent}, ${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt})
  ON CONFLICT (agent, cache_key) DO UPDATE
  SET output_json = EXCLUDED.output_json,
      expires_at  = EXCLUDED.expires_at,
      created_at  = NOW()   -- ← resets created_at on refresh
`);
```

The `ON CONFLICT` branch resets `created_at` to the current time. This means
`created_at` no longer records when a cache entry was first populated — it reflects
the most recent refresh. Cache diagnostics (e.g. "how long has this niche been
continuously cached?") are unreliable.

The migration creates `created_at` as a non-nullable column with `DEFAULT NOW()`.
The `ON CONFLICT` clause should omit `created_at` from the update:

```ts
ON CONFLICT (agent, cache_key) DO UPDATE
SET output_json = EXCLUDED.output_json,
    expires_at  = EXCLUDED.expires_at
-- created_at left unchanged — preserves original population time
```

---

## LOW — `drizzle-zod` generates Zod v3 schemas but files import `zod/v4`

**Files:** `lib/db/src/schema/books.ts`, `lib/db/src/schema/author-personas.ts`,
`lib/db/src/schema/conversations.ts`, `lib/db/src/schema/messages.ts`

All schema files contain:

```ts
import { z } from "zod/v4";
// ...
export type InsertBook = z.infer<typeof insertBookSchema>;
```

`drizzle-zod` v0.8.3 generates schemas compatible with Zod v3. Calling
`z.infer<typeof insertBookSchema>` where `insertBookSchema` is a v3 `ZodObject` but `z`
is the v4 runtime causes subtle type inference differences. The types happen to overlap
enough that there are no visible compile errors today, but this is a latent
compatibility risk if `drizzle-zod` relies on v3-specific internals.

### Fix

Either use `import { z } from "zod"` (v3) consistently in schema files, or wait until
`drizzle-zod` officially supports v4 and upgrade in a coordinated step.

---

## LOW — `author_personas_one_active` partial index permits zero active personas

**File:** `lib/db/src/migrate.ts` migration `001_advanced_pipeline`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS author_personas_one_active
  ON author_personas ((is_active)) WHERE is_active = true;
```

This correctly prevents two simultaneously active personas. It does not require exactly
one to be active. If a user deactivates their only persona (or none has ever been set),
the pipeline falls back silently. There is no DB-level constraint ensuring an active
persona exists before a book can be created. This is likely intentional (optional
feature) but should be documented explicitly in the schema as a design decision rather
than looking like an accidental gap.

---

## LOW — `_schema_migrations` tracking table is not in any Drizzle schema

**File:** `lib/db/src/migrate.ts`

The migration runner creates `_schema_migrations` itself:

```sql
CREATE TABLE IF NOT EXISTS _schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
)
```

Like `council_cache` and `bsr_snapshots`, this table exists in the live database but
is invisible to Drizzle and `drizzle-kit`. Running `drizzle-kit push` will attempt to
drop it, which would cause the migration runner to re-apply all migrations on next
startup (since no applied names are recorded). All four migrations use idempotent SQL
so this wouldn't corrupt data, but it would trigger unnecessary ALTER TABLE operations.

---

## Summary

| Severity | Issue | Affected Files |
|---|---|---|
| CRITICAL | `council_cache` + `bsr_snapshots` not in Drizzle schema — `push` will drop them | `schema/index.ts`, `migrate.ts` |
| HIGH | `conversations` + `messages` have no migration — fresh DB builds fail | `migrate.ts` |
| HIGH | `priceRecommended` / `royaltyEstimate` stored as TEXT, not NUMERIC | `schema/books.ts` |
| MEDIUM | `updatedAt` not auto-maintained — no trigger, pipeline INSERT never refreshes it | `schema/books.ts`, `create-book.ts` |
| MEDIUM | No `build` script in `lib/db/package.json` — root cause of recurring stale-dist errors | `lib/db/package.json` |
| MEDIUM | `council_cache.created_at` reset on every refresh — misleads diagnostics | `council-cache.ts` |
| LOW | Schema files import `zod/v4` but `drizzle-zod` generates Zod v3 schemas | all schema files |
| LOW | Partial index allows zero active personas — not documented as intentional | `migrate.ts` |
| LOW | `_schema_migrations` table invisible to Drizzle — `push` would drop it | `migrate.ts` |

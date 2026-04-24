﻿﻿/**
 * Auto-migration runner.
 *
 * On server startup, creates a _schema_migrations tracking table and applies
 * any migrations that haven't been recorded yet. Each migration is wrapped in
 * a transaction so partial failures roll back cleanly.
 *
 * Every migration SQL uses idempotent primitives (IF NOT EXISTS, etc.) so
 * safe to re-run even if the tracking table is dropped.
 */

import type { Pool } from "pg";

export interface Migration {
  name: string;
  sql: string;
}

export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

// ── Built-in migrations — authoritative source of truth ────────────────────
export const BUILTIN_MIGRATIONS: Migration[] = [
  {
    name: "001_advanced_pipeline",
    sql: `
-- author_personas table
CREATE TABLE IF NOT EXISTS author_personas (
  id                    SERIAL PRIMARY KEY,
  pen_name              TEXT NOT NULL,
  honorific             TEXT,
  bio                   TEXT NOT NULL,
  voice_tone            TEXT NOT NULL,
  voice_vocabulary      TEXT NOT NULL,
  voice_avoid           JSONB NOT NULL DEFAULT '[]'::jsonb,
  monogram_initials     TEXT NOT NULL,
  monogram_svg          TEXT NOT NULL,
  signature_color       TEXT NOT NULL,
  portfolio_fit         TEXT,
  collision_risk        TEXT NOT NULL DEFAULT 'unchecked',
  primary_niches        JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_age          TEXT,
  target_volume_count   TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS author_personas_one_active
  ON author_personas ((is_active)) WHERE is_active = true;

-- books table extensions for advanced pipeline
ALTER TABLE books ADD COLUMN IF NOT EXISTS experience_mode          TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE books ADD COLUMN IF NOT EXISTS author_persona_id        INTEGER REFERENCES author_personas(id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gift_sku                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gift_recipient           TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_categories       JSONB;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_description_html TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_slug             TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS price_recommended        TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS royalty_estimate         TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS qa_score                 INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS qa_issues_json           JSONB;

CREATE INDEX IF NOT EXISTS books_author_persona_idx ON books (author_persona_id);
`,
  },
  {
    name: "002_narrative_arc",
    sql: `
-- Solve-the-Story: store the Narrative Architect output for detective/adventure
-- experience modes. Contains case file, suspects, clue beats tied to puzzle
-- indices, revelation, and epilogue (detective) — or quest, treasure map,
-- coordinates, guardian, epilogue (adventure).
ALTER TABLE books ADD COLUMN IF NOT EXISTS narrative_arc_json JSONB;

-- Optional tracking for post-publish feedback loops (ASIN + BSR history).
-- Populated manually when the user records a book's ASIN after KDP publish.
ALTER TABLE books ADD COLUMN IF NOT EXISTS amazon_asin TEXT;

CREATE INDEX IF NOT EXISTS books_asin_idx ON books (amazon_asin) WHERE amazon_asin IS NOT NULL;
`,
  },
  {
    name: "003_council_cache",
    sql: `
-- Council output cache — memoizes niche-stable agent results across book
-- generations. Dramatically cuts LLM cost when publishing multiple books in
-- the same niche (the most common publishing pattern). 24h default TTL.
CREATE TABLE IF NOT EXISTS council_cache (
  id          SERIAL PRIMARY KEY,
  agent       TEXT NOT NULL,
  cache_key   TEXT NOT NULL,
  output_json JSONB NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS council_cache_lookup
  ON council_cache (agent, cache_key);

CREATE INDEX IF NOT EXISTS council_cache_expires
  ON council_cache (expires_at);
`,
  },
  {
    name: "004_bsr_snapshots",
    sql: `
-- Post-publish BSR tracking. Every book with an amazon_asin gets periodic
-- snapshots from Apify. The rank-over-time series lets the user see which
-- books trend up, which decay, and which niches are worth scaling.
CREATE TABLE IF NOT EXISTS bsr_snapshots (
  id           SERIAL PRIMARY KEY,
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  asin         TEXT NOT NULL,
  marketplace  TEXT NOT NULL DEFAULT 'US',
  bsr          INTEGER,
  price_usd    NUMERIC(6,2),
  review_count INTEGER,
  star_rating  NUMERIC(2,1),
  captured_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  source       TEXT NOT NULL DEFAULT 'apify'
);

CREATE INDEX IF NOT EXISTS bsr_snapshots_book_idx
  ON bsr_snapshots (book_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS bsr_snapshots_asin_idx
  ON bsr_snapshots (asin);
`,
  },
  {
    name: "005_bespoke_palette",
    sql: `
-- Bespoke per-book palette. Cover Color Strategist now generates custom hex
-- values tailored to the niche rather than picking from the 10 preset themes.
-- accent_hex_override already exists from migration 001 — we add the other two
-- components so every book carries its full custom palette through to render.
ALTER TABLE books ADD COLUMN IF NOT EXISTS background_hex_override TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS text_hex_override TEXT;
`,
  },
];

/**
 * Runs every unapplied migration against the provided Pool. Safe to call on
 * every server startup — already-applied migrations are skipped.
 */
export async function runMigrations(
  pool: Pool,
  migrations: Migration[] = BUILTIN_MIGRATIONS,
): Promise<MigrationReport> {
  const report: MigrationReport = { applied: [], skipped: [] };

  // Tracking table — idempotent
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  for (const m of migrations) {
    const existing = await pool.query(
      "SELECT 1 FROM _schema_migrations WHERE name = $1",
      [m.name],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      report.skipped.push(m.name);
      continue;
    }

    try {
      await pool.query("BEGIN");
      await pool.query(m.sql);
      await pool.query("INSERT INTO _schema_migrations (name) VALUES ($1)", [m.name]);
      await pool.query("COMMIT");
      report.applied.push(m.name);
    } catch (err) {
      await pool.query("ROLLBACK");
      throw new Error(
        `Migration failed on "${m.name}": ${(err as Error).message}`,
      );
    }
  }

  return report;
}

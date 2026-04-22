/**
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

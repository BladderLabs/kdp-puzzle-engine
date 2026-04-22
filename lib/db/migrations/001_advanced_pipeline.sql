-- Migration: Advanced Pipeline (Session Upgrade)
-- Adds author_personas table + new columns on books for Experience Mode,
-- Gift-SKU, Year-Branding, Listing Intelligence, and Cover QA results.
--
-- Apply via:
--   psql "$DATABASE_URL" -f lib/db/migrations/001_advanced_pipeline.sql
--
-- Safe to re-run: every ALTER / CREATE uses IF NOT EXISTS.

-- ── author_personas table ───────────────────────────────────────────────────
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

-- Only ONE persona may be active at a time — partial unique index on is_active=true
CREATE UNIQUE INDEX IF NOT EXISTS author_personas_one_active
  ON author_personas ((is_active)) WHERE is_active = true;

-- ── books table: new columns for the advanced pipeline ─────────────────────
ALTER TABLE books ADD COLUMN IF NOT EXISTS experience_mode         TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE books ADD COLUMN IF NOT EXISTS author_persona_id       INTEGER REFERENCES author_personas(id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gift_sku                BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gift_recipient          TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_categories      JSONB;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_description_html TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS listing_slug            TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS price_recommended       TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS royalty_estimate        TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS qa_score                INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS qa_issues_json          JSONB;

-- Index for fast active-persona lookup
CREATE INDEX IF NOT EXISTS books_author_persona_idx ON books (author_persona_id);

-- Done.

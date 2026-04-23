/**
 * BSR tracking routes.
 *
 * PUT /api/books/:id/asin      — Capture the Amazon ASIN for a published book
 * POST /api/bsr/sync           — Iterate every book with an ASIN, fetch BSR via Apify, write a snapshot
 * GET /api/bsr/snapshots/:id   — Rank-over-time series for a single book
 * GET /api/bsr/leaderboard     — All books sorted by latest BSR (best performers first)
 *
 * The sync endpoint is designed to be triggered by:
 *   (a) a Replit cron (daily is plenty)
 *   (b) a manual click on a dashboard button
 *   (c) automatically after a user sets an ASIN for the first time
 */

import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
// Note: ASIN + BSR columns are accessed via raw SQL so this file survives
// a stale compiled @workspace/db dist (amazonAsin may not yet be in the
// Drizzle-inferred schema type even though migration 002/004 ran).

const router: IRouter = Router();

// ── ASIN capture ─────────────────────────────────────────────────────────────

const ASIN_REGEX = /^B0[A-Z0-9]{8}$/;

router.put("/books/:id/asin", async (req, res) => {
  try {
    const id = z.coerce.number().int().parse(req.params.id);
    const { asin } = z.object({ asin: z.string().trim() }).parse(req.body);

    // Sanity-check the ASIN. Amazon paperback ASINs start with B0 and are 10 chars.
    const cleanAsin = asin.toUpperCase().trim();
    if (!ASIN_REGEX.test(cleanAsin)) {
      res.status(400).json({
        error: `"${cleanAsin}" is not a valid Amazon ASIN (expected B0XXXXXXXX, 10 chars starting B0).`,
      });
      return;
    }

    // Raw SQL — dodges stale Drizzle type that doesn't yet know about amazon_asin
    const updateResult = await db.execute(sql`
      UPDATE books
      SET amazon_asin = ${cleanAsin}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `);
    const updatedRows = ((updateResult as unknown as { rows?: Array<{ id: number }> }).rows) ?? [];
    if (updatedRows.length === 0) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    req.log.info({ bookId: id, asin: cleanAsin }, "ASIN captured — triggering first BSR snapshot");

    // Fire-and-forget: take an immediate snapshot so the chart isn't empty
    void captureSnapshot(id, cleanAsin).catch(err => {
      req.log.warn({ err, bookId: id }, "Initial BSR snapshot failed — will retry on next /api/bsr/sync");
    });

    res.json({ id, asin: cleanAsin });
  } catch (err) {
    req.log.error({ err }, "Failed to set ASIN");
    res.status(500).json({ error: (err as Error).message || "Failed to set ASIN" });
  }
});

// ── Snapshot capture (single book) ───────────────────────────────────────────

interface SnapshotInput {
  bookId: number;
  asin: string;
  marketplace?: string;
}

interface SnapshotOut {
  bookId: number;
  asin: string;
  bsr: number | null;
  price: number | null;
  reviewCount: number | null;
  starRating: number | null;
  capturedAt: string;
}

async function captureSnapshot(bookId: number, asin: string, marketplace = "US"): Promise<SnapshotOut | null> {
  // Use the existing /api/apify/market-research plumbing via direct Apify call.
  // Apify's product scraper takes an ASIN and returns bsr, price, reviews, stars.
  // For production use we recommend a cron, not per-request.
  let result: SnapshotOut = {
    bookId,
    asin,
    bsr: null,
    price: null,
    reviewCount: null,
    starRating: null,
    capturedAt: new Date().toISOString(),
  };

  try {
    // Call the existing apify market-research endpoint by keyword (ASIN).
    // If ANY of our scrapers can resolve the ASIN → BSR, we capture it.
    const baseUrl = process.env.INTERNAL_API_BASE ?? `http://localhost:${process.env.PORT ?? "8080"}`;
    const res = await fetch(`${baseUrl}/api/apify/market-research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: asin }),
    });
    if (res.ok) {
      const body = await res.json() as { results?: Array<{ asin?: string; bsr?: number | null; price?: number | null; reviews?: number; stars?: number | null }> };
      const match = body.results?.find(r => r.asin === asin) ?? body.results?.[0];
      if (match) {
        result = {
          ...result,
          bsr: match.bsr ?? null,
          price: match.price ?? null,
          reviewCount: match.reviews ?? null,
          starRating: match.stars ?? null,
        };
      }
    }
  } catch {
    // Scrape failures are non-fatal — we still write a snapshot row with nulls.
  }

  // Persist snapshot
  try {
    await db.execute(sql`
      INSERT INTO bsr_snapshots (book_id, asin, marketplace, bsr, price_usd, review_count, star_rating, captured_at, source)
      VALUES (
        ${bookId},
        ${asin},
        ${marketplace},
        ${result.bsr},
        ${result.price},
        ${result.reviewCount},
        ${result.starRating},
        NOW(),
        'apify'
      )
    `);
  } catch (err) {
    // Table missing or DB error — nothing we can do here
    return null;
  }

  return result;
}

// ── Sync (iterate every book with an ASIN) ──────────────────────────────────

router.post("/bsr/sync", async (req, res) => {
  try {
    // Raw SQL — again, avoiding stale Drizzle type on amazon_asin
    const booksResult = await db.execute(sql`
      SELECT id, amazon_asin AS asin FROM books WHERE amazon_asin IS NOT NULL
    `);
    const books = ((booksResult as unknown as { rows?: Array<{ id: number; asin: string }> }).rows) ?? [];

    const results: Array<{ bookId: number; asin: string; ok: boolean; bsr?: number | null }> = [];
    // Serialize to avoid hammering Apify; typical library has <100 books
    for (const b of books) {
      if (!b.asin) continue;
      const snap = await captureSnapshot(b.id, b.asin);
      results.push({ bookId: b.id, asin: b.asin, ok: !!snap, bsr: snap?.bsr ?? null });
    }

    req.log.info({ count: results.length }, "BSR sync complete");
    res.json({
      scanned: results.length,
      succeeded: results.filter(r => r.ok).length,
      results,
    });
  } catch (err) {
    req.log.error({ err }, "BSR sync failed");
    res.status(500).json({ error: (err as Error).message || "BSR sync failed" });
  }
});

// ── Rank-over-time for a single book ────────────────────────────────────────

router.get("/bsr/snapshots/:id", async (req, res) => {
  try {
    const id = z.coerce.number().int().parse(req.params.id);
    const rows = await db.execute(sql`
      SELECT id, bsr, price_usd AS price, review_count AS reviews, star_rating AS stars, captured_at
      FROM bsr_snapshots
      WHERE book_id = ${id}
      ORDER BY captured_at ASC
      LIMIT 200
    `);
    const snapshots = ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows) ?? [];
    res.json({ bookId: id, snapshots });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BSR snapshots");
    res.status(500).json({ error: (err as Error).message || "Failed to fetch BSR snapshots" });
  }
});

// ── Leaderboard — books ranked by latest BSR ────────────────────────────────

router.get("/bsr/leaderboard", async (req, res) => {
  try {
    // Latest snapshot per book (DISTINCT ON trick) joined with book metadata
    const rows = await db.execute(sql`
      SELECT
        b.id        AS book_id,
        b.title     AS title,
        b.niche     AS niche,
        b.puzzle_type AS puzzle_type,
        b.amazon_asin AS asin,
        s.bsr       AS latest_bsr,
        s.price_usd AS latest_price,
        s.review_count AS reviews,
        s.star_rating AS stars,
        s.captured_at AS captured_at
      FROM books b
      LEFT JOIN LATERAL (
        SELECT bsr, price_usd, review_count, star_rating, captured_at
        FROM bsr_snapshots
        WHERE book_id = b.id
        ORDER BY captured_at DESC
        LIMIT 1
      ) s ON true
      WHERE b.amazon_asin IS NOT NULL
      ORDER BY s.bsr ASC NULLS LAST
      LIMIT 200
    `);
    const books = ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows) ?? [];
    res.json({ books });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BSR leaderboard");
    res.status(500).json({ error: (err as Error).message || "Failed to fetch BSR leaderboard" });
  }
});

export default router;

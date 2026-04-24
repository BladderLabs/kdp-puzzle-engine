/**
 * Admin routes.
 *
 * Library wipe endpoint for resetting test state. Two-factor protected:
 *   1. Bearer token from the ADMIN_SECRET env var (required; endpoint is
 *      503-disabled if the env var isn't set)
 *   2. Confirmation string in the body
 *
 * Real transaction via db.transaction() — node-postgres pools split manual
 * BEGIN/COMMIT across connections, so we let Drizzle manage the client.
 */

import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

const ResetBody = z.object({
  confirm: z.literal("WIPE_ALL_BOOKS"),
});

// ── Auth helper ───────────────────────────────────────────────────────────
// If ADMIN_SECRET isn't set in env, this entire router is inert — every
// request 503s. This is intentional: admin endpoints must not be reachable
// by default. Operator has to explicitly opt in by setting the secret.
function requireAdmin(req: Parameters<Parameters<IRouter["post"]>[1]>[0], res: Parameters<Parameters<IRouter["post"]>[1]>[1]): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 16) {
    res.status(503).json({
      error: "Admin endpoints are disabled. Set ADMIN_SECRET (≥16 chars) in Replit Secrets to enable.",
    });
    return false;
  }
  const header = req.headers.authorization;
  const expected = `Bearer ${secret}`;
  // Constant-time-ish comparison — not cryptographic but avoids trivial timing leak
  if (!header || header.length !== expected.length || header !== expected) {
    res.status(401).json({ error: "Unauthorized. Include Authorization: Bearer <ADMIN_SECRET>." });
    return false;
  }
  return true;
}

// ── POST /api/admin/reset-library ─────────────────────────────────────────
router.post("/admin/reset-library", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    ResetBody.parse(req.body);
  } catch {
    res.status(400).json({
      error: "Missing or invalid confirmation. Send body: {\"confirm\":\"WIPE_ALL_BOOKS\"}",
    });
    return;
  }

  try {
    // Real transaction — Drizzle borrows a single connection from the pool
    // for the duration of the callback, then commits/rolls back atomically.
    // This is the fix for manual BEGIN/COMMIT split across pooled connections.
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM bsr_snapshots`);
      await tx.execute(sql`DELETE FROM books`);
      await tx.execute(sql`ALTER SEQUENCE books_id_seq RESTART WITH 1`);
    });

    req.log.info("Library reset — all books and BSR snapshots wiped");
    res.json({
      ok: true,
      wiped: ["books", "bsr_snapshots"],
      preserved: ["author_personas", "council_cache"],
      message: "Library cleared. Your author persona and niche cache are intact.",
    });
  } catch (err) {
    req.log.error({ err }, "Library reset failed");
    res.status(500).json({ error: (err as Error).message || "Library reset failed" });
  }
});

export default router;

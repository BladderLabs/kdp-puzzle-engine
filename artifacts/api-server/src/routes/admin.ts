/**
 * Admin routes.
 *
 * Only includes one operation right now — a safe library wipe for resetting
 * test state. Requires the literal confirmation string in the body so a stray
 * POST can't delete your work.
 */

import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

// ── POST /api/admin/reset-library ─────────────────────────────────────────
//
// Wipes every book + BSR snapshot. Preserves author_personas (you keep the
// pen name you've already set up) and council_cache (no need to re-pay for
// the same niche research). Resets the books.id sequence back to 1.
//
// Requires { "confirm": "WIPE_ALL_BOOKS" } in the body. Anything else → 400.

const ResetBody = z.object({
  confirm: z.literal("WIPE_ALL_BOOKS"),
});

router.post("/admin/reset-library", async (req, res) => {
  try {
    ResetBody.parse(req.body);
  } catch {
    res.status(400).json({
      error: "Missing or invalid confirmation. Send body: {\"confirm\":\"WIPE_ALL_BOOKS\"}",
    });
    return;
  }

  try {
    // Single transaction so either everything drops or nothing does.
    await db.execute(sql`
      BEGIN;
      DELETE FROM bsr_snapshots;
      DELETE FROM books;
      ALTER SEQUENCE books_id_seq RESTART WITH 1;
      COMMIT;
    `);

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

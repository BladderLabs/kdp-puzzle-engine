import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db, authorPersonasTable } from "@workspace/db";
import {
  runAuthorPersonaAgent,
  PortfolioBriefSchema,
} from "../lib/agents/author-persona";

const router: IRouter = Router();

/**
 * POST /api/author-persona
 * Body: PortfolioBrief — runs the agent, persists the winning persona as
 * active (deactivating any prior active persona), returns the saved row.
 */
router.post("/author-persona", async (req, res) => {
  try {
    const brief = PortfolioBriefSchema.parse(req.body);
    const persona = await runAuthorPersonaAgent(brief);

    // Deactivate any currently-active persona
    await db
      .update(authorPersonasTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(authorPersonasTable.isActive, true));

    const [row] = await db
      .insert(authorPersonasTable)
      .values({
        penName: persona.penName,
        honorific: persona.honorific ?? null,
        bio: persona.bio,
        voiceTone: persona.voice.tone,
        voiceVocabulary: persona.voice.vocabulary,
        voiceAvoid: persona.voice.avoid,
        monogramInitials: persona.monogram.initials,
        monogramSvg: persona.monogram.svg,
        signatureColor: persona.signatureColor,
        portfolioFit: persona.portfolioFit,
        collisionRisk: persona.collisionRisk,
        primaryNiches: brief.primaryNiches,
        audienceAge: brief.audienceAge,
        targetVolumeCount: String(brief.targetVolumeCount),
        isActive: true,
      })
      .returning();

    req.log.info({ personaId: row.id, penName: row.penName }, "Author Persona created and activated");
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create author persona");
    res.status(400).json({ error: (err as Error).message || "Failed to create author persona" });
  }
});

/**
 * GET /api/author-persona/active
 * Returns the currently active persona (or 404 if none).
 */
router.get("/author-persona/active", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(authorPersonasTable)
      .where(eq(authorPersonasTable.isActive, true))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "No active author persona" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get active author persona");
    res.status(500).json({ error: "Failed to get active author persona" });
  }
});

/**
 * GET /api/author-persona
 * Lists every persona (most recent first).
 */
router.get("/author-persona", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(authorPersonasTable)
      .orderBy(desc(authorPersonasTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list author personas");
    res.status(500).json({ error: "Failed to list author personas" });
  }
});

/**
 * PUT /api/author-persona/:id/activate
 * Makes the given persona the sole active one.
 */
router.put("/author-persona/:id/activate", async (req, res) => {
  try {
    const id = z.coerce.number().int().parse(req.params.id);
    await db
      .update(authorPersonasTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(authorPersonasTable.isActive, true));
    const [row] = await db
      .update(authorPersonasTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(authorPersonasTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Persona not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to activate author persona");
    res.status(500).json({ error: "Failed to activate author persona" });
  }
});

/**
 * DELETE /api/author-persona/:id
 */
router.delete("/author-persona/:id", async (req, res) => {
  try {
    const id = z.coerce.number().int().parse(req.params.id);
    await db.delete(authorPersonasTable).where(eq(authorPersonasTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete author persona");
    res.status(500).json({ error: "Failed to delete author persona" });
  }
});

export default router;

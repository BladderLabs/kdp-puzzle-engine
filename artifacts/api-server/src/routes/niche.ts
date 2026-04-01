import { Router, type IRouter } from "express";
import { GetNicheDataBody } from "@workspace/api-zod";
import { listNiches, getNicheByKey } from "../lib/niches";

const router: IRouter = Router();

router.get("/niches", (_req, res) => {
  res.json(listNiches());
});

router.post("/niche-assistant", (req, res) => {
  try {
    const { niche } = GetNicheDataBody.parse(req.body);
    const data = getNicheByKey(niche);
    if (!data) {
      res.status(404).json({ error: `Niche "${niche}" not found` });
      return;
    }
    res.json({
      niche: data.key,
      label: data.label,
      words: data.words,
      titles: data.titles,
      keywords: data.keywords,
      backBlurb: data.backBlurb,
      recommendedDifficulty: data.recommendedDifficulty,
      recommendedCount: data.recommendedCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get niche data");
    res.status(400).json({ error: "Failed to get niche data" });
  }
});

export default router;

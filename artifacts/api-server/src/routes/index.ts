import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import generateRouter from "./generate";
import nicheRouter from "./niche";
import conversationsRouter from "./anthropic/conversations";
import ideasRouter from "./anthropic/ideas";
import geminiCoverImageRouter from "./gemini/cover-image";
import agentCreateBookRouter from "./agents/create-book";
import apifyMarketResearchRouter from "./apify/market-research";
import libraryAnalysisRouter from "./library/analysis";
import authorPersonaRouter from "./author-persona";
import opportunitiesRouter from "./opportunities";
import bsrRouter from "./bsr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(generateRouter);
router.use(nicheRouter);
router.use(conversationsRouter);
router.use(ideasRouter);
router.use(geminiCoverImageRouter);
router.use(agentCreateBookRouter);
router.use(apifyMarketResearchRouter);
router.use(libraryAnalysisRouter);
router.use(authorPersonaRouter);
router.use(opportunitiesRouter);
router.use(bsrRouter);

export default router;

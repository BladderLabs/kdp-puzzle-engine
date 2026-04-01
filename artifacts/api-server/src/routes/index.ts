import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import generateRouter from "./generate";
import nicheRouter from "./niche";
import conversationsRouter from "./anthropic/conversations";
import ideasRouter from "./anthropic/ideas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(generateRouter);
router.use(nicheRouter);
router.use(conversationsRouter);
router.use(ideasRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import generateRouter from "./generate";
import nicheRouter from "./niche";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(generateRouter);
router.use(nicheRouter);

export default router;

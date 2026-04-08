import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import {
  CreateBookBody,
  UpdateBookBody,
  GetBookParams,
  UpdateBookParams,
  DeleteBookParams,
  CloneBookParams,
} from "@workspace/api-zod";

const blankToNull = (v: string | null | undefined): string | null =>
  v && v.trim() ? v.trim() : null;

const router: IRouter = Router();

router.get("/books", async (req, res) => {
  try {
    const books = await db.select().from(booksTable).orderBy(desc(booksTable.updatedAt));
    res.json(books.map(b => ({ ...b, words: b.words ?? [], keywords: b.keywords ?? [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list books");
    res.status(500).json({ error: "Failed to list books" });
  }
});

router.post("/books", async (req, res) => {
  try {
    const data = CreateBookBody.parse(req.body);
    const [book] = await db.insert(booksTable).values({
      title: data.title,
      subtitle: data.subtitle ?? null,
      author: data.author ?? null,
      puzzleType: data.puzzleType ?? "Word Search",
      puzzleCount: data.puzzleCount ?? 100,
      difficulty: data.difficulty ?? "Medium",
      largePrint: data.largePrint ?? true,
      paperType: data.paperType ?? "white",
      theme: data.theme ?? "midnight",
      coverStyle: data.coverStyle ?? "classic",
      backDescription: data.backDescription ?? null,
      words: (data.words as string[]) ?? [],
      wordCategory: data.wordCategory ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      niche: data.niche ?? null,
      volumeNumber: data.volumeNumber ?? 1,
      dedication: data.dedication ?? null,
      difficultyMode: data.difficultyMode ?? "uniform",
      challengeDays: data.challengeDays ?? null,
      keywords: ((data.keywords as string[]) ?? []).slice(0, 7),
      seriesName: blankToNull(data.seriesName),
    }).returning();
    res.status(201).json({ ...book, words: book.words ?? [], keywords: book.keywords ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to create book");
    res.status(400).json({ error: "Failed to create book" });
  }
});

router.get("/books/:id", async (req, res) => {
  try {
    const { id } = GetBookParams.parse({ id: Number(req.params.id) });
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
    if (!book) { res.status(404).json({ error: "Book not found" }); return; }
    res.json({ ...book, words: book.words ?? [], keywords: book.keywords ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to get book");
    res.status(500).json({ error: "Failed to get book" });
  }
});

router.put("/books/:id", async (req, res) => {
  try {
    const { id } = UpdateBookParams.parse({ id: Number(req.params.id) });
    const data = UpdateBookBody.parse(req.body);
    const [book] = await db.update(booksTable).set({
      title: data.title,
      subtitle: data.subtitle ?? null,
      author: data.author ?? null,
      puzzleType: data.puzzleType ?? "Word Search",
      puzzleCount: data.puzzleCount ?? 100,
      difficulty: data.difficulty ?? "Medium",
      largePrint: data.largePrint ?? true,
      paperType: data.paperType ?? "white",
      theme: data.theme ?? "midnight",
      coverStyle: data.coverStyle ?? "classic",
      backDescription: data.backDescription ?? null,
      words: (data.words as string[]) ?? [],
      wordCategory: data.wordCategory ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      niche: data.niche ?? null,
      volumeNumber: data.volumeNumber ?? 1,
      dedication: data.dedication ?? null,
      difficultyMode: data.difficultyMode ?? "uniform",
      challengeDays: data.challengeDays ?? null,
      keywords: ((data.keywords as string[]) ?? []).slice(0, 7),
      seriesName: blankToNull(data.seriesName),
      updatedAt: new Date(),
    }).where(eq(booksTable.id, id)).returning();
    if (!book) { res.status(404).json({ error: "Book not found" }); return; }
    res.json({ ...book, words: book.words ?? [], keywords: book.keywords ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to update book");
    res.status(500).json({ error: "Failed to update book" });
  }
});

router.delete("/books/:id", async (req, res) => {
  try {
    const { id } = DeleteBookParams.parse({ id: Number(req.params.id) });
    await db.delete(booksTable).where(eq(booksTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete book");
    res.status(500).json({ error: "Failed to delete book" });
  }
});

router.post("/books/:id/clone", async (req, res) => {
  try {
    const { id } = CloneBookParams.parse({ id: Number(req.params.id) });
    const [source] = await db.select().from(booksTable).where(eq(booksTable.id, id));
    if (!source) { res.status(404).json({ error: "Book not found" }); return; }
    const nextVol = (source.volumeNumber ?? 1) + 1;

    // Auto-derive seriesName: use existing one, or derive from title and write back to source
    let seriesName = source.seriesName;
    if (!seriesName) {
      // Strip trailing "Vol N" / "Volume N" / "Book N" suffixes from title to get the series root
      seriesName = source.title.replace(/\s+(vol\.?\s*\d+|volume\s*\d+|book\s*\d+)$/i, "").trim() + " Series";
      // Write seriesName back to source so it shows up in the library grouped correctly
      await db.update(booksTable)
        .set({ seriesName, updatedAt: new Date() })
        .where(eq(booksTable.id, id));
    }

    const [clone] = await db.insert(booksTable).values({
      title: source.title,
      subtitle: source.subtitle,
      author: source.author,
      puzzleType: source.puzzleType,
      puzzleCount: source.puzzleCount,
      difficulty: source.difficulty,
      largePrint: source.largePrint,
      paperType: source.paperType,
      theme: source.theme,
      coverStyle: source.coverStyle,
      backDescription: source.backDescription,
      words: source.words ?? [],
      wordCategory: source.wordCategory,
      coverImageUrl: source.coverImageUrl,
      niche: source.niche,
      volumeNumber: nextVol,
      dedication: source.dedication,
      difficultyMode: source.difficultyMode ?? "uniform",
      challengeDays: source.challengeDays,
      keywords: source.keywords ?? [],
      seriesName,
    }).returning();
    res.status(201).json({ ...clone, words: clone.words ?? [], keywords: clone.keywords ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to clone book");
    res.status(500).json({ error: "Failed to clone book" });
  }
});

export default router;

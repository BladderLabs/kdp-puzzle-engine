import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  author: text("author"),
  puzzleType: text("puzzle_type").notNull().default("Word Search"),
  puzzleCount: integer("puzzle_count").notNull().default(100),
  difficulty: text("difficulty").notNull().default("Medium"),
  largePrint: boolean("large_print").notNull().default(true),
  paperType: text("paper_type").notNull().default("white"),
  theme: text("theme").notNull().default("midnight"),
  coverStyle: text("cover_style").notNull().default("classic"),
  backDescription: text("back_description"),
  words: jsonb("words").$type<string[]>().notNull().default([]),
  wordCategory: text("word_category"),
  coverImageUrl: text("cover_image_url"),
  niche: text("niche"),
  volumeNumber: integer("volume_number").notNull().default(1),
  dedication: text("dedication"),
  difficultyMode: text("difficulty_mode").notNull().default("uniform"),
  challengeDays: integer("challenge_days"),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;

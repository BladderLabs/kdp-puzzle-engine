import { pgTable, serial, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorPersonasTable = pgTable("author_personas", {
  id: serial("id").primaryKey(),
  penName: text("pen_name").notNull(),
  honorific: text("honorific"),
  bio: text("bio").notNull(),
  voiceTone: text("voice_tone").notNull(),
  voiceVocabulary: text("voice_vocabulary").notNull(),
  voiceAvoid: jsonb("voice_avoid").$type<string[]>().notNull().default([]),
  monogramInitials: text("monogram_initials").notNull(),
  monogramSvg: text("monogram_svg").notNull(),
  signatureColor: text("signature_color").notNull(),
  portfolioFit: text("portfolio_fit"),
  collisionRisk: text("collision_risk").notNull().default("unchecked"),
  primaryNiches: jsonb("primary_niches").$type<string[]>().notNull().default([]),
  audienceAge: text("audience_age"),
  targetVolumeCount: text("target_volume_count"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAuthorPersonaSchema = createInsertSchema(authorPersonasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorPersona = z.infer<typeof insertAuthorPersonaSchema>;
export type AuthorPersonaRow = typeof authorPersonasTable.$inferSelect;

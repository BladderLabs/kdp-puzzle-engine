/**
 * Narrative Architect.
 *
 * When experienceMode is "detective" or "adventure", generates a narrative
 * arc that the puzzle book's interior can render as case-file or quest-map
 * insert pages. Each puzzle's solution becomes a story beat — a clue, a
 * coordinate letter, a piece of evidence.
 *
 * This is the engine's genuine moat feature: competitors produce puzzle
 * books with pretty covers. Solve-the-Story produces puzzle books where
 * the solutions matter beyond the puzzle itself.
 */

import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const NarrativeBeatSchema = z.object({
  puzzleIndex: z.number().int().min(1),
  clueText: z.string().min(5).max(280),
  connection: z.string().min(5).max(280),
});
export type NarrativeBeat = z.infer<typeof NarrativeBeatSchema>;

export const DetectiveArcSchema = z.object({
  mode: z.literal("detective"),
  caseName: z.string().min(3).max(120),
  caseFileNumber: z.string().min(1).max(20),
  setting: z.string().min(5).max(400),
  victims: z.string().min(5).max(400),
  suspects: z.array(z.object({
    name: z.string(),
    motive: z.string(),
    alibi: z.string(),
  })).min(2).max(5),
  beats: z.array(NarrativeBeatSchema).min(3).max(200),
  revelation: z.object({
    culprit: z.string(),
    method: z.string(),
    motive: z.string(),
    clincher: z.string(),
  }),
  epilogue: z.string().min(20).max(800),
});

export const AdventureArcSchema = z.object({
  mode: z.literal("adventure"),
  questName: z.string().min(3).max(120),
  hero: z.string().min(5).max(400),
  setting: z.string().min(5).max(400),
  villainOrObstacle: z.string().min(5).max(400),
  beats: z.array(NarrativeBeatSchema).min(3).max(200),
  treasureMap: z.object({
    destination: z.string(),
    coordinates: z.string(),
    guardianPuzzle: z.string(),
  }),
  epilogue: z.string().min(20).max(800),
});

export const NarrativeArcSchema = z.discriminatedUnion("mode", [
  DetectiveArcSchema,
  AdventureArcSchema,
]);
export type NarrativeArc = z.infer<typeof NarrativeArcSchema>;

// ── Input ───────────────────────────────────────────────────────────────────

export interface NarrativeInput {
  mode: "detective" | "adventure";
  title: string;
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  puzzleCount: number;
  difficulty: string;
  audience: string;
  words: string[];
  authorPenName?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Could not parse narrative JSON");
}

// ── Prompts ─────────────────────────────────────────────────────────────────

function detectivePrompt(input: NarrativeInput): string {
  return `You are a mystery-novel plotter designing a solvable case for a themed puzzle book.
The book is "${input.title}" for the ${input.nicheLabel} niche (${input.puzzleCount} ${input.puzzleType} puzzles, ${input.difficulty} difficulty).

Your job: write a self-contained mystery where the reader solves ${Math.min(input.puzzleCount, 12)} key puzzle beats, each one revealing a clue, until the final solution points unambiguously to the culprit.

Rules:
- Setting must fit the niche: ${input.nicheLabel}
- 2-4 plausible suspects, each with motive and alibi
- Evenly distribute the 12 key beats across the ${input.puzzleCount} puzzles (e.g. puzzle 5, 10, 15, ...). For smaller books, cluster them.
- Each beat's clue must be something the reader can hold in their head (a name, an object, a time, a code word) — short and memorable.
- Beats must build cumulatively. Beat 12 alone is not enough; beats 1-12 together point to exactly one suspect.
- The epilogue explains how the clues all connect. Pay off every red herring.
- No graphic violence. Cozy-mystery tone unless the niche demands otherwise.
- Use words from the book's theme where natural: ${input.words.slice(0, 20).join(", ")}.

Return STRICT JSON only:
{
  "mode": "detective",
  "caseName": "Short case name (e.g. The Missing Sugar Cookie)",
  "caseFileNumber": "CF-2026-047",
  "setting": "2-3 sentence scene-setting",
  "victims": "1-2 sentences on who/what was wronged",
  "suspects": [
    { "name": "...", "motive": "...", "alibi": "..." }
  ],
  "beats": [
    { "puzzleIndex": 1, "clueText": "short clue that fits in a case note", "connection": "why this narrows the suspect list" }
  ],
  "revelation": {
    "culprit": "the name of one suspect from the list",
    "method": "how they did it",
    "motive": "why",
    "clincher": "the single fact that proves it"
  },
  "epilogue": "4-6 sentences tying everything together"
}`;
}

function adventurePrompt(input: NarrativeInput): string {
  return `You are an adventure-novel plotter designing a quest for a themed puzzle book.
The book is "${input.title}" for the ${input.nicheLabel} niche (${input.puzzleCount} ${input.puzzleType} puzzles).

Your job: write a self-contained quest where the reader's puzzle solutions reveal, in order, the letters or coordinates of a treasure. The final reveal is a map printed on the last page with the marked location.

Rules:
- Setting must fit the niche: ${input.nicheLabel}
- Hero is described briefly — not the reader, a named character
- One villain or obstacle — environmental or antagonist
- Evenly distribute ${Math.min(input.puzzleCount, 12)} beats across the puzzles
- Each beat: the solution to that puzzle reveals a letter, coordinate, or navigational instruction
- The final "treasureMap" describes the destination, the full coordinate string (formed from beats), and the guardian puzzle (optional last challenge)
- Tone should match the niche — whimsical for kids, somber for historical, cozy for senior-friendly
- Use words from the book's theme: ${input.words.slice(0, 20).join(", ")}.

Return STRICT JSON only:
{
  "mode": "adventure",
  "questName": "Short quest name",
  "hero": "2-3 sentences introducing the hero",
  "setting": "2-3 sentences on the world",
  "villainOrObstacle": "what stands in the way",
  "beats": [
    { "puzzleIndex": 1, "clueText": "what the solution reveals (letter, coordinate, instruction)", "connection": "how it advances the quest" }
  ],
  "treasureMap": {
    "destination": "where the treasure lies",
    "coordinates": "the full string the beats compose (e.g. N 42.3°, W 71.0°)",
    "guardianPuzzle": "last hint for the final page"
  },
  "epilogue": "4-6 sentences closing the quest"
}`;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function runNarrativeArchitect(input: NarrativeInput): Promise<NarrativeArc> {
  const prompt = input.mode === "detective" ? detectivePrompt(input) : adventurePrompt(input);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const raw = parseModelJson(text);
  return NarrativeArcSchema.parse(raw);
}

// ── HTML rendering helpers (used by html-builders for interior insert pages) ──

/**
 * Renders the narrative arc as a self-contained "case file" or "quest map"
 * preamble page. Called from html-builders for detective/adventure books.
 */
export function renderNarrativePreamble(arc: NarrativeArc, accent: string): string {
  if (arc.mode === "detective") {
    return renderDetectivePreamble(arc, accent);
  }
  return renderAdventurePreamble(arc, accent);
}

function renderDetectivePreamble(arc: z.infer<typeof DetectiveArcSchema>, ac: string): string {
  const suspectsList = arc.suspects
    .map(s => `<li><b>${escapeHtml(s.name)}</b> — motive: ${escapeHtml(s.motive)}. Alibi: ${escapeHtml(s.alibi)}</li>`)
    .join("");
  return `<div style="font-family:'Special Elite','Courier New',monospace;">
  <div style="text-align:center;border-bottom:2px solid ${ac};padding-bottom:14px;margin-bottom:22px;">
    <div style="font-size:10px;letter-spacing:5px;color:${ac};margin-bottom:6px;">CASE FILE ${escapeHtml(arc.caseFileNumber)}</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-weight:900;font-size:28px;color:#1a1a1a;">${escapeHtml(arc.caseName)}</div>
  </div>
  <div style="font-size:13px;line-height:1.65;color:#222;">
    <p style="margin-bottom:14px;"><b>SETTING:</b> ${escapeHtml(arc.setting)}</p>
    <p style="margin-bottom:14px;"><b>WRONGED PARTY:</b> ${escapeHtml(arc.victims)}</p>
    <p style="margin-bottom:8px;"><b>PERSONS OF INTEREST:</b></p>
    <ul style="margin-left:22px;margin-bottom:14px;">${suspectsList}</ul>
    <p style="margin-bottom:14px;font-style:italic;color:#666;">The solution to every puzzle is a clue. Note them as you go — only the full set points unambiguously to the culprit.</p>
  </div>
  <div style="margin-top:36px;text-align:center;font-size:9px;letter-spacing:4px;color:${ac};opacity:0.75;">— EVIDENCE · DO NOT REMOVE —</div>
</div>`;
}

function renderAdventurePreamble(arc: z.infer<typeof AdventureArcSchema>, ac: string): string {
  return `<div style="font-family:Georgia,serif;">
  <div style="text-align:center;margin-bottom:26px;">
    <div style="font-size:10px;letter-spacing:6px;color:${ac};margin-bottom:8px;">✦ THE QUEST ✦</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:900;font-size:30px;color:#2a1a00;">${escapeHtml(arc.questName)}</div>
  </div>
  <div style="font-size:14px;line-height:1.75;color:#2a1a00;">
    <p style="margin-bottom:14px;"><b>Our Hero.</b> ${escapeHtml(arc.hero)}</p>
    <p style="margin-bottom:14px;"><b>The World.</b> ${escapeHtml(arc.setting)}</p>
    <p style="margin-bottom:14px;"><b>What Stands in the Way.</b> ${escapeHtml(arc.villainOrObstacle)}</p>
    <p style="margin-bottom:14px;font-style:italic;color:#6b4f2a;">Each puzzle you solve yields a clue toward the treasure. Collect them all, and the map on the final page will be yours.</p>
  </div>
  <div style="margin-top:36px;text-align:center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="none" stroke="${ac}" stroke-width="1.5"/>
      <circle cx="22" cy="22" r="15" fill="none" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.5"/>
      <path d="M 22,4 L 26,22 L 22,40 L 18,22 Z" fill="${ac}" fill-opacity="0.8"/>
      <text x="22" y="10" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="${ac}">N</text>
    </svg>
  </div>
</div>`;
}

/**
 * Renders the narrative revelation / treasure-map end page.
 */
export function renderNarrativeRevelation(arc: NarrativeArc, accent: string): string {
  if (arc.mode === "detective") {
    return renderDetectiveRevelation(arc, accent);
  }
  return renderAdventureRevelation(arc, accent);
}

function renderDetectiveRevelation(arc: z.infer<typeof DetectiveArcSchema>, ac: string): string {
  return `<div style="font-family:'Special Elite','Courier New',monospace;">
  <div style="text-align:center;border-bottom:2px solid ${ac};padding-bottom:14px;margin-bottom:22px;">
    <div style="font-size:10px;letter-spacing:5px;color:${ac};margin-bottom:6px;">CASE CLOSED</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-weight:900;font-size:26px;color:#1a1a1a;">The Culprit Revealed</div>
  </div>
  <div style="font-size:14px;line-height:1.7;color:#222;">
    <p style="margin-bottom:14px;"><b>The culprit was ${escapeHtml(arc.revelation.culprit)}.</b></p>
    <p style="margin-bottom:14px;"><b>Method:</b> ${escapeHtml(arc.revelation.method)}</p>
    <p style="margin-bottom:14px;"><b>Motive:</b> ${escapeHtml(arc.revelation.motive)}</p>
    <p style="margin-bottom:14px;"><b>The clincher:</b> ${escapeHtml(arc.revelation.clincher)}</p>
    <div style="margin-top:24px;padding-top:18px;border-top:1px dashed #aaa;">
      <p style="font-style:italic;line-height:1.75;">${escapeHtml(arc.epilogue)}</p>
    </div>
  </div>
</div>`;
}

function renderAdventureRevelation(arc: z.infer<typeof AdventureArcSchema>, ac: string): string {
  return `<div style="font-family:Georgia,serif;">
  <div style="text-align:center;margin-bottom:26px;">
    <div style="font-size:10px;letter-spacing:6px;color:${ac};margin-bottom:8px;">✦ THE TREASURE ✦</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:900;font-size:26px;color:#2a1a00;">X Marks the Spot</div>
  </div>
  <div style="font-size:14px;line-height:1.75;color:#2a1a00;">
    <p style="margin-bottom:14px;"><b>Destination.</b> ${escapeHtml(arc.treasureMap.destination)}</p>
    <p style="margin-bottom:14px;"><b>Coordinates (assembled from your solutions).</b> <span style="font-family:'Special Elite',monospace;font-size:15px;color:${ac};">${escapeHtml(arc.treasureMap.coordinates)}</span></p>
    <p style="margin-bottom:14px;"><b>The Final Guardian.</b> ${escapeHtml(arc.treasureMap.guardianPuzzle)}</p>
    <div style="margin-top:24px;padding-top:18px;border-top:1px dashed #b8860b;">
      <p style="font-style:italic;line-height:1.75;">${escapeHtml(arc.epilogue)}</p>
    </div>
  </div>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

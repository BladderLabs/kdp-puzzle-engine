import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NicheAssistant } from "./NicheAssistant";
import { PreviewPane } from "./PreviewPane";
import { CoverPreview } from "./CoverPreview";
import type { NicheResult } from "@workspace/api-client-react";

const PUZZLE_TYPES = ["Word Search", "Sudoku", "Maze", "Number Search", "Cryptogram", "Crossword"] as const;
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const WORD_CATEGORIES = [
  { value: "General",   label: "General" },
  { value: "Animals",   label: "Animals" },
  { value: "Nature",    label: "Nature" },
  { value: "Holiday",   label: "Holiday" },
  { value: "Food",      label: "Food" },
  { value: "Sports",    label: "Sports" },
  { value: "Travel",    label: "Travel" },
  { value: "Science",   label: "Science" },
  { value: "History",   label: "History" },
  { value: "Geography", label: "Geography" },
  { value: "Music",     label: "Music" },
  { value: "Movies",    label: "Movies" },
  { value: "Space",     label: "Space" },
] as const;
const THEMES = [
  { value: "midnight",  label: "Midnight Gold",   bg: "#0D1B3E", ac: "#F5C842" },
  { value: "forest",    label: "Forest Green",    bg: "#1A3C1A", ac: "#6DCC50" },
  { value: "crimson",   label: "Crimson Flame",   bg: "#280808", ac: "#FF3838" },
  { value: "ocean",     label: "Ocean Breeze",    bg: "#C8E8F8", ac: "#1565A8" },
  { value: "violet",    label: "Violet Gem",      bg: "#180635", ac: "#C060FF" },
  { value: "slate",     label: "Slate Bullseye",  bg: "#252E3A", ac: "#FF8C38" },
  { value: "sunrise",   label: "Warm Sunrise",    bg: "#FDF0E0", ac: "#D44000" },
  { value: "teal",      label: "Deep Teal Hex",   bg: "#062020", ac: "#18D0A0" },
  { value: "parchment", label: "Parchment Quill", bg: "#F5E4C0", ac: "#7B3A00" },
  { value: "sky",       label: "Clear Sky",       bg: "#E0EFFF", ac: "#2050B8" },
];
const COVER_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth"] as const;

const NICHE_PICKS = [
  { value: "Seniors & Large Print", titlePrefix: "Large Print", audience: "seniors" },
  { value: "Kids Ages 8–12",        titlePrefix: "Kids'",       audience: "kids 8-12" },
  { value: "Relaxation & Stress Relief", titlePrefix: "Relaxing", audience: "adults" },
  { value: "Travel & On-the-Go",   titlePrefix: "Travel",      audience: "travelers" },
  { value: "Holiday Gifts",        titlePrefix: "Holiday",     audience: "gift buyers" },
  { value: "Other (custom)",       titlePrefix: "",            audience: "" },
];

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  puzzleType: z.string().min(1, "Puzzle type is required"),
  puzzleCount: z.coerce.number().min(1).max(500),
  difficulty: z.string().optional(),
  largePrint: z.boolean().default(false),
  paperType: z.string().default("white"),
  theme: z.string().default("midnight"),
  coverStyle: z.string().default("classic"),
  backDescription: z.string().optional(),
  words: z.string().optional(),
  wordCategory: z.string().optional(),
  coverImageUrl: z.string().optional(),
  niche: z.string().optional(),
  volumeNumber: z.coerce.number().optional(),
  dedication: z.string().optional(),
  difficultyMode: z.string().default("uniform"),
  challengeDays: z.coerce.number().optional(),
});

export type BookFormValues = z.infer<typeof formSchema>;

interface BookFormProps {
  initialValues?: Partial<BookFormValues>;
  onSubmit: (values: BookFormValues) => void;
  isSubmitting?: boolean;
  onApplyRef?: React.MutableRefObject<((values: Partial<BookFormValues>) => void) | null>;
}

export function BookForm({ initialValues, onSubmit, isSubmitting, onApplyRef }: BookFormProps) {
  const form = useForm<BookFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialValues?.title || "",
      subtitle: initialValues?.subtitle || "",
      author: initialValues?.author || "Eleanor Bennett",
      puzzleType: initialValues?.puzzleType || "Word Search",
      puzzleCount: initialValues?.puzzleCount || 50,
      difficulty: initialValues?.difficulty || "Medium",
      largePrint: initialValues?.largePrint || false,
      paperType: initialValues?.paperType || "white",
      theme: initialValues?.theme || "midnight",
      coverStyle: initialValues?.coverStyle || "classic",
      backDescription: initialValues?.backDescription || "",
      words: initialValues?.words || "",
      wordCategory: initialValues?.wordCategory || "General",
      coverImageUrl: initialValues?.coverImageUrl || "",
      niche: initialValues?.niche || "",
      volumeNumber: initialValues?.volumeNumber ?? 0,
      dedication: initialValues?.dedication || "",
      difficultyMode: initialValues?.difficultyMode || "uniform",
      challengeDays: initialValues?.challengeDays ?? undefined,
    }
  });

  const puzzleType = form.watch("puzzleType");
  const puzzleCount = form.watch("puzzleCount") || 50;
  const paperType = form.watch("paperType");
  const largePrint = form.watch("largePrint");
  const wordsStr = form.watch("words") || "";
  const difficulty = form.watch("difficulty") || "Medium";
  const backDescription = form.watch("backDescription") || "";

  const [nicheSelection, setNicheSelection] = useState<string>(
    NICHE_PICKS.some(n => n.value === (initialValues?.niche || "")) ? (initialValues?.niche || "") : ""
  );
  const [customNiche, setCustomNiche] = useState<string>(
    NICHE_PICKS.some(n => n.value === (initialValues?.niche || "")) ? "" : (initialValues?.niche || "")
  );
  const [isGeneratingAICover, setIsGeneratingAICover] = useState(false);
  const [aiCoverError, setAiCoverError] = useState<string | null>(null);

  // Dynamic title formula hint
  const lpTag = largePrint ? "Large Print " : "";
  const titleHint = `e.g. "${lpTag}${puzzleType} for Seniors: ${puzzleCount} Puzzles Vol. 1"`;
  const subtitleHint = `e.g. "Big Letters, Easy to Read — Perfect for Adults & Beginners"`;

  // Auto-fill back description template
  const generateDescTemplate = () => {
    const lpNote = largePrint ? "in large print for easy reading " : "";
    return `Discover ${puzzleCount} carefully crafted ${difficulty.toLowerCase()} ${puzzleType} puzzles ${lpNote}— perfect for brain training, relaxation, and daily fun! Each puzzle is laid out on its own page with generous space for working through solutions. A complete answer key is included at the back. Whether you're a beginner or an experienced solver, this collection offers hours of satisfying mental exercise. Makes a wonderful gift for puzzle enthusiasts of all ages!`;
  };

  // Track the last auto-generated description so we can update it when key fields change
  const lastGeneratedRef = useRef<string>("");
  useEffect(() => {
    const newTemplate = generateDescTemplate();
    const currentVal = form.getValues("backDescription") || "";
    // Auto-update only if the field currently contains the previously auto-generated template
    if (currentVal && currentVal === lastGeneratedRef.current && newTemplate !== currentVal) {
      lastGeneratedRef.current = newTemplate;
      form.setValue("backDescription", newTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleCount, puzzleType, difficulty, largePrint]);

  const applyNicheData = (data: NicheResult) => {
    if (data.words?.length) form.setValue("words", data.words.join("\n"));
    if (data.titles?.length) form.setValue("title", data.titles[0]);
    if (data.backBlurb) form.setValue("backDescription", data.backBlurb);
    if (data.recommendedDifficulty) form.setValue("difficulty", data.recommendedDifficulty);
    if (data.recommendedCount) form.setValue("puzzleCount", data.recommendedCount);
    if (data.niche) form.setValue("niche", data.niche);
  };

  const applyPartialValues = (values: Partial<BookFormValues>) => {
    (Object.keys(values) as (keyof BookFormValues)[]).forEach(key => {
      const val = values[key];
      if (val !== undefined) form.setValue(key, val as never);
    });
  };

  useEffect(() => {
    if (onApplyRef) {
      onApplyRef.current = applyPartialValues;
    }
  }, [onApplyRef]);

  const generateAICover = async () => {
    setIsGeneratingAICover(true);
    setAiCoverError(null);
    try {
      const theme = form.getValues("theme") || "midnight";
      const coverStyle = form.getValues("coverStyle") || "classic";
      const title = form.getValues("title") || "";
      const currentPuzzleType = form.getValues("puzzleType") || "Word Search";
      const res = await fetch("/api/gemini/cover-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, style: coverStyle, title, puzzleType: currentPuzzleType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const data = await res.json() as { dataUrl: string };
      form.setValue("coverImageUrl", data.dataUrl);
    } catch (e) {
      setAiCoverError((e as Error).message || "Failed to generate AI cover.");
    } finally {
      setIsGeneratingAICover(false);
    }
  };

  const aPer = puzzleType === "Word Search" ? (largePrint ? 9 : 12)
    : puzzleType === "Sudoku" ? (largePrint ? 6 : 8)
    : puzzleType === "Maze" ? (largePrint ? 4 : 6)
    : puzzleType === "Number Search" ? (largePrint ? 9 : 12)
    : puzzleType === "Crossword" ? (largePrint ? 4 : 6)
    : (largePrint ? 6 : 8);
  const totP = 9 + puzzleCount + Math.ceil(puzzleCount / aPer) + (puzzleCount >= 30 ? 3 : 0);
  const thick = paperType === "cream" ? 0.0025 : 0.002252;
  const spineW = totP * thick + 0.06;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
      {/* ── Main form ── */}
      <div className="xl:col-span-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardContent className="pt-5 space-y-5">

                {/* Row 1 — Title + Subtitle */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder={`${largePrint ? "Large Print " : ""}${puzzleType}: ${puzzleCount} Puzzles`} {...field} /></FormControl>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{titleHint}</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subtitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl><Input placeholder="Fun & Challenging for All Ages" {...field} /></FormControl>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{subtitleHint}</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Row 2 — Author */}
                <FormField control={form.control} name="author" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author</FormLabel>
                    <FormControl><Input placeholder="Eleanor Bennett" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="border-t" />

                {/* Row 3 — Puzzle Type + Count + Difficulty */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="puzzleType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puzzle Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PUZZLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="puzzleCount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puzzle Count</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="difficulty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {DIFFICULTIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Row 4 — Paper + Large Print */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="paperType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paper</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="white">White</SelectItem>
                          <SelectItem value="cream">Cream</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="largePrint" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3 mt-0.5">
                      <div>
                        <FormLabel className="text-sm font-medium">Large Print</FormLabel>
                        <CardDescription className="text-xs">8.5" × 11" (standard is 6" × 9")</CardDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Row 5 — Series */}
                <FormField control={form.control} name="volumeNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Series / Volume</FormLabel>
                    <div className="flex gap-2">
                      {[
                        { label: "Single Book", val: 0 },
                        { label: "Vol 1 of 3", val: 1 },
                        { label: "Vol 2 of 3", val: 2 },
                        { label: "Vol 3 of 3", val: 3 },
                      ].map(({ label, val }) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => field.onChange(val)}
                          className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                            field.value === val
                              ? "bg-amber-500 text-black border-amber-500 font-bold"
                              : "border-border text-muted-foreground hover:border-amber-500/40"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )} />

                {/* Live dimensions display */}
                {(() => {
                  const trimW = largePrint ? 8.5 : 6;
                  const trimH = largePrint ? 11 : 9;
                  const fullW = 0.125 + trimW + spineW + trimW + 0.125;
                  const fullH = (trimH + 0.25).toFixed(3);
                  return (
                    <div className="font-mono text-xs text-amber-500/70 bg-amber-500/5 border border-amber-500/10 rounded px-3 py-2 leading-relaxed">
                      Interior: ~{totP} pages &nbsp;·&nbsp;
                      Cover: {fullW.toFixed(3)} × {fullH} in &nbsp;·&nbsp;
                      Spine: {spineW.toFixed(3)} in
                    </div>
                  );
                })()}

                {/* Word Category (Word Search / Number Search only) */}
                {(puzzleType === "Word Search" || puzzleType === "Number Search") && (
                  <FormField control={form.control} name="wordCategory" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Word Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "General"}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {WORD_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {/* Word list (Word Search / Cryptogram only) */}
                {(puzzleType === "Word Search" || puzzleType === "Cryptogram") && (
                  <FormField control={form.control} name="words" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{puzzleType === "Cryptogram" ? "Sentences" : "Custom Word List"} — one per line (overrides category)</FormLabel>
                      <FormControl>
                        <Textarea className="h-28 font-mono text-sm" placeholder={"PUZZLE\nBRAIN\nSOLVE\n..."} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <div className="border-t" />

                {/* Row 6 — Cover: Theme + Style */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="theme" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Theme</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {THEMES.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ display: "inline-flex", width: 12, height: 12, borderRadius: "50%", background: t.ac, border: `1px solid ${t.ac}88`, flexShrink: 0 }} />
                                {t.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="coverStyle" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {COVER_STYLES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Cover Image URL */}
                <FormField control={form.control} name="coverImageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Image <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="https://i.ibb.co/…/my-cover.jpg" {...field} value={field.value?.startsWith("data:") ? "(AI-generated image)" : (field.value || "")} onChange={(e) => { if (!e.target.value || !e.target.value.startsWith("data:")) field.onChange(e); }} /></FormControl>
                      {field.value?.startsWith("data:") && (
                        <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => form.setValue("coverImageUrl", "")}>Clear</Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateAICover}
                        disabled={isGeneratingAICover}
                        className="text-xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-50"
                      >
                        {isGeneratingAICover ? (
                          <span className="flex items-center gap-1.5"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating...</span>
                        ) : "✨ Generate AI Cover Art"}
                      </Button>
                      <CardDescription className="text-xs">AI creates cover art from your theme &amp; style. Or paste an image URL.</CardDescription>
                    </div>
                    {aiCoverError && <p className="text-xs text-destructive mt-1">{aiCoverError}</p>}
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Niche quick-picks */}
                <div>
                  <label className="text-sm font-medium">Target Niche <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {NICHE_PICKS.map(n => (
                      <button
                        key={n.value}
                        type="button"
                        onClick={() => {
                          setNicheSelection(n.value);
                          if (n.value !== "Other (custom)") {
                            form.setValue("niche", n.value);
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          nicheSelection === n.value
                            ? "bg-amber-500 text-black border-amber-500 font-semibold"
                            : "border-border text-muted-foreground hover:border-amber-400/60"
                        }`}
                      >
                        {n.value}
                      </button>
                    ))}
                  </div>
                  {nicheSelection === "Other (custom)" && (
                    <input
                      type="text"
                      className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Describe your niche audience…"
                      value={customNiche}
                      onChange={e => { setCustomNiche(e.target.value); form.setValue("niche", e.target.value); }}
                    />
                  )}
                  {nicheSelection && nicheSelection !== "Other (custom)" && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">Title tip: start with "{NICHE_PICKS.find(n => n.value === nicheSelection)?.titlePrefix} {puzzleType}…"</p>
                  )}
                </div>

                {/* Back description */}
                <FormField control={form.control} name="backDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Back Cover Description</FormLabel>
                    <FormControl>
                      <Textarea
                        className="h-28 text-sm"
                        placeholder="Click to auto-fill a publish-ready template…"
                        onFocus={() => { if (!field.value) { const t = generateDescTemplate(); lastGeneratedRef.current = t; field.onChange(t); } }}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-0.5">Click the field to auto-fill a KDP-ready description template you can edit.</p>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Dedication page */}
                <FormField control={form.control} name="dedication" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dedication <span className="text-muted-foreground font-normal">(optional — adds a dedication page)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        className="h-20 text-sm"
                        placeholder="e.g. To my grandmother, whose love of puzzles inspired this book."
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-0.5">Leave blank to skip the dedication page.</p>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Difficulty mode */}
                <div>
                  <label className="text-sm font-medium block mb-1.5">Difficulty Mode</label>
                  <div className="flex gap-2">
                    {[
                      { value: "uniform", label: "Uniform", desc: "All puzzles at the same difficulty" },
                      { value: "progressive", label: "Progressive", desc: "Easy → Medium → Hard sections" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => form.setValue("difficultyMode", opt.value)}
                        className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors text-left ${
                          form.watch("difficultyMode") === opt.value
                            ? "bg-amber-500 text-black border-amber-500 font-semibold"
                            : "border-border text-muted-foreground hover:border-amber-400/60"
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Solve-a-Day Tracker */}
                <div>
                  <label className="text-sm font-medium block mb-1.5">Solve-a-Day Tracker <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 7, 14, 21, 30, 50, 100].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => form.setValue("challengeDays", days === 0 ? undefined : days)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          (form.watch("challengeDays") ?? 0) === days
                            ? "bg-amber-500 text-black border-amber-500 font-semibold"
                            : "border-border text-muted-foreground hover:border-amber-400/60"
                        }`}
                      >
                        {days === 0 ? "None" : `${days}-Day`}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Adds a daily completion tracker page at the front of your book.</p>
                </div>

                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full text-base">
                  {isSubmitting ? "Saving…" : "Save Project →"}
                </Button>

              </CardContent>
            </Card>
          </form>
        </Form>
      </div>

      {/* ── Right sidebar ── */}
      <div className="xl:col-span-1 space-y-4">
        <PreviewPane
          puzzleType={puzzleType}
          difficulty={form.watch("difficulty")}
          largePrint={form.watch("largePrint")}
          words={wordsStr.split("\n").filter(w => w.trim().length > 0)}
        />
        <CoverPreview
          title={form.watch("title")}
          subtitle={form.watch("subtitle")}
          author={form.watch("author")}
          theme={form.watch("theme")}
          coverStyle={form.watch("coverStyle")}
          volumeNumber={form.watch("volumeNumber")}
          puzzleCount={form.watch("puzzleCount")}
          puzzleType={puzzleType}
          difficulty={form.watch("difficulty")}
          largePrint={form.watch("largePrint")}
          paperType={form.watch("paperType")}
          backDescription={form.watch("backDescription")}
          coverImageUrl={form.watch("coverImageUrl")}
        />
        <NicheAssistant puzzleType={puzzleType} onApply={applyNicheData} />
      </div>
    </div>
  );
}

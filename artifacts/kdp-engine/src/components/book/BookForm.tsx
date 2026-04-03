import { useEffect } from "react";
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

const PUZZLE_TYPES = ["Word Search", "Sudoku", "Maze", "Number Search", "Cryptogram"] as const;
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
  { value: "midnight",  label: "Midnight Gold" },
  { value: "forest",    label: "Forest Ink" },
  { value: "crimson",   label: "Crimson Fire" },
  { value: "ocean",     label: "Ocean Sky" },
  { value: "violet",    label: "Violet Glow" },
  { value: "slate",     label: "Slate Orange" },
  { value: "sunrise",   label: "Sunrise Pink" },
  { value: "teal",      label: "Teal Wave" },
  { value: "parchment", label: "Parchment Warm" },
  { value: "sky",       label: "Sky Blue" },
] as const;
const COVER_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro", "warmth"] as const;

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
  niche: z.string().optional(),
  volumeNumber: z.coerce.number().optional(),
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
      niche: initialValues?.niche || "",
      volumeNumber: initialValues?.volumeNumber ?? 0,
    }
  });

  const puzzleType = form.watch("puzzleType");
  const puzzleCount = form.watch("puzzleCount") || 50;
  const paperType = form.watch("paperType");
  const largePrint = form.watch("largePrint");
  const wordsStr = form.watch("words") || "";

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

  const aPer = puzzleType === "Word Search" ? (largePrint ? 9 : 12)
    : puzzleType === "Sudoku" ? (largePrint ? 6 : 8)
    : puzzleType === "Maze" ? (largePrint ? 4 : 6)
    : puzzleType === "Number Search" ? (largePrint ? 9 : 12)
    : (largePrint ? 6 : 8);
  const totP = 3 + puzzleCount + Math.ceil(puzzleCount / aPer);
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
                      <FormControl><Input placeholder="100 Word Search Puzzles" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subtitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl><Input placeholder="Large Print Edition" {...field} /></FormControl>
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
                          {THEMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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

                {/* Back description */}
                <FormField control={form.control} name="backDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Back Cover Description</FormLabel>
                    <FormControl>
                      <Textarea className="h-20" placeholder="Short description printed on the back cover…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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
        />
        <NicheAssistant puzzleType={puzzleType} onApply={applyNicheData} />
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NicheAssistant } from "./NicheAssistant";
import { PreviewPane } from "./PreviewPane";
const PUZZLE_TYPES = ["Word Search", "Sudoku", "Maze", "Number Search", "Cryptogram"] as const;
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const THEMES = ["midnight", "forest", "crimson", "ocean", "violet", "slate", "rose", "ember"] as const;
const COVER_STYLES = ["classic", "geometric", "luxury", "bold", "minimal", "retro"] as const;

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
  words: z.string().optional(), // We'll split this by newline before saving
  niche: z.string().optional(),
  volumeNumber: z.coerce.number().optional(),
});

export type BookFormValues = z.infer<typeof formSchema>;

interface BookFormProps {
  initialValues?: Partial<BookFormValues>;
  onSubmit: (values: BookFormValues) => void;
  isSubmitting?: boolean;
}

export function BookForm({ initialValues, onSubmit, isSubmitting }: BookFormProps) {
  const form = useForm<BookFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialValues?.title || "",
      subtitle: initialValues?.subtitle || "",
      author: initialValues?.author || "",
      puzzleType: initialValues?.puzzleType || "Word Search",
      puzzleCount: initialValues?.puzzleCount || 50,
      difficulty: initialValues?.difficulty || "Medium",
      largePrint: initialValues?.largePrint || false,
      paperType: initialValues?.paperType || "white",
      theme: initialValues?.theme || "midnight",
      coverStyle: initialValues?.coverStyle || "classic",
      backDescription: initialValues?.backDescription || "",
      words: initialValues?.words || "",
      niche: initialValues?.niche || "",
      volumeNumber: initialValues?.volumeNumber || 1,
    }
  });

  const puzzleType = form.watch("puzzleType");
  const puzzleCount = form.watch("puzzleCount") || 50;
  const paperType = form.watch("paperType");
  const wordsStr = form.watch("words") || "";

  const applyNicheData = (data: any) => {
    if (data.words?.length) form.setValue("words", data.words.join("\n"));
    if (data.titles?.length) form.setValue("title", data.titles[0]);
    if (data.backBlurb) form.setValue("backDescription", data.backBlurb);
    if (data.recommendedDifficulty) form.setValue("difficulty", data.recommendedDifficulty);
    if (data.recommendedCount) form.setValue("puzzleCount", data.recommendedCount);
    form.setValue("niche", data.niche);
  };

  const aPer = 1; // Assuming 1 puzzle per page for simplicity, original uses logic
  const totP = 3 + puzzleCount + Math.ceil(puzzleCount / aPer);
  const thick = paperType === "cream" ? 0.0025 : 0.002252;
  const spineW = totP * thick + 0.06;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-8 space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Book Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtitle</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Author</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="volumeNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume Number</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interior Configuration</CardTitle>
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded mt-2">
                  Est. Pages: {totP} | Spine Width: {spineW.toFixed(3)}"
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="puzzleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puzzle Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PUZZLE_TYPES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="puzzleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puzzle Count</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {DIFFICULTIES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paperType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paper Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="cream">Cream</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="largePrint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Large Print (8.5" x 11")</FormLabel>
                        <CardDescription>Standard size is 6" x 9"</CardDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {(puzzleType === "Word Search" || puzzleType === "Cryptogram") && (
                  <FormField
                    control={form.control}
                    name="words"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{puzzleType === "Cryptogram" ? "Sentences" : "Word List"} (One per line)</FormLabel>
                        <FormControl>
                          <Textarea className="h-40 font-mono text-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cover Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color Theme</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {THEMES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coverStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cover Style</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {COVER_STYLES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="backDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Back Cover Description</FormLabel>
                      <FormControl>
                        <Textarea className="h-24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? "Saving..." : "Save Project"}
            </Button>
          </form>
        </Form>
      </div>

      <div className="xl:col-span-4 space-y-6">
        <NicheAssistant puzzleType={puzzleType} onApply={applyNicheData} />
        <PreviewPane 
          puzzleType={puzzleType} 
          difficulty={form.watch("difficulty")} 
          largePrint={form.watch("largePrint")} 
          words={wordsStr.split("\n").filter(w => w.trim().length > 0)} 
        />
      </div>
    </div>
  );
}

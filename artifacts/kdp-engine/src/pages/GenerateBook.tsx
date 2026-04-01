import { useState } from "react";
import { useParams } from "wouter";
import { useGetBook, useGenerateBook, getGetBookQueryKey } from "@workspace/api-client-react";
import type { BookConfigPuzzleType, BookConfigDifficulty, BookConfigPaperType, BookConfigTheme, BookConfigCoverStyle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export function GenerateBook() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const { data: book, isLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });
  const generateBook = useGenerateBook();
  const { toast } = useToast();

  const [status, setStatus] = useState<"idle" | "generating" | "pdf_interior" | "pdf_cover" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!book) return;
    setErrorMsg("");
    try {
      setStatus("generating");
      setProgress(20);

      const result = await generateBook.mutateAsync({
        data: {
          title: book.title,
          subtitle: book.subtitle ?? undefined,
          author: book.author ?? undefined,
          puzzleType: (book.puzzleType as BookConfigPuzzleType),
          puzzleCount: book.puzzleCount ?? undefined,
          difficulty: (book.difficulty as BookConfigDifficulty) ?? undefined,
          largePrint: book.largePrint ?? undefined,
          paperType: (book.paperType as BookConfigPaperType) ?? undefined,
          theme: (book.theme as BookConfigTheme) ?? undefined,
          coverStyle: (book.coverStyle as BookConfigCoverStyle) ?? undefined,
          backDescription: book.backDescription ?? undefined,
          words: book.words ?? undefined,
          volumeNumber: book.volumeNumber ?? undefined,
        },
      });

      setStatus("pdf_interior");
      setProgress(55);

      const interiorRes = await fetch("/api/pdf/interior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: result.interiorHtml, pages: result.totalPages }),
      });
      if (!interiorRes.ok) {
        const msg = await interiorRes.text();
        throw new Error(`Interior PDF failed: ${msg}`);
      }
      const interiorBlob = await interiorRes.blob();
      downloadBlob(interiorBlob, `${book.title}-interior.pdf`);

      setStatus("pdf_cover");
      setProgress(80);

      const coverRes = await fetch("/api/pdf/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: result.coverHtml,
          fullW: result.coverDims.fullW,
          fullH: result.coverDims.fullH,
        }),
      });
      if (!coverRes.ok) {
        const msg = await coverRes.text();
        throw new Error(`Cover PDF failed: ${msg}`);
      }
      const coverBlob = await coverRes.blob();
      downloadBlob(coverBlob, `${book.title}-cover.pdf`);

      setStatus("done");
      setProgress(100);
      toast({ title: "Book generated!", description: "Both PDFs downloaded successfully." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      setStatus("error");
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground" data-testid="generate-loading">
        Loading book details...
      </div>
    );
  }
  if (!book) {
    return (
      <div className="text-center text-destructive py-12" data-testid="generate-not-found">
        Book not found.
      </div>
    );
  }

  const thick = book.paperType === "cream" ? 0.0025 : 0.002252;
  const aPer = book.puzzleType === "Word Search" ? (book.largePrint ? 9 : 12)
    : book.puzzleType === "Sudoku" ? (book.largePrint ? 6 : 8)
    : book.puzzleType === "Maze" ? (book.largePrint ? 4 : 6)
    : book.puzzleType === "Number Search" ? (book.largePrint ? 9 : 12)
    : (book.largePrint ? 6 : 8);
  const pc = book.puzzleCount ?? 100;
  const totP = 3 + pc + Math.ceil(pc / aPer);
  const spineW = totP * thick + 0.06;

  const canGenerate = status === "idle" || status === "done" || status === "error";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold" data-testid="generate-title">Generate: {book.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Book Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Puzzle type:</span>{" "}
            <strong>{book.puzzleType}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Count:</span>{" "}
            <strong>{pc} puzzles</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Difficulty:</span>{" "}
            <strong>{book.difficulty}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Paper:</span>{" "}
            <strong>{book.paperType}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Size:</span>{" "}
            <strong>{book.largePrint ? '8.5"×11" Large Print' : '6"×9" Standard'}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Est. total pages:</span>{" "}
            <strong>{totP} ({spineW.toFixed(3)}" spine)</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Theme:</span>{" "}
            <strong className="capitalize">{book.theme}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Cover style:</span>{" "}
            <strong className="capitalize">{book.coverStyle}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8 space-y-6">
          {status !== "idle" && (
            <div className="space-y-2">
              <Progress value={progress} data-testid="generate-progress" />
              <p className="text-sm text-muted-foreground text-center">
                {status === "generating" && "Generating puzzles... this may take 1-2 minutes for large books."}
                {status === "pdf_interior" && "Rendering interior PDF via Puppeteer..."}
                {status === "pdf_cover" && "Rendering full-wrap cover PDF..."}
                {status === "done" && "All files downloaded successfully."}
                {status === "error" && `Error: ${errorMsg}`}
              </p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full text-lg h-16"
            onClick={handleGenerate}
            disabled={!canGenerate || generateBook.isPending}
            data-testid="generate-button"
          >
            {status === "done" ? "Generate Again" : "Generate Interior + Cover PDFs"}
          </Button>

          {status === "done" && (
            <div className="mt-6 p-5 bg-muted/40 rounded-lg border border-border space-y-3" data-testid="kdp-checklist">
              <h3 className="font-bold text-base">KDP Upload Checklist</h3>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                <li>Upload <strong className="text-foreground">{book.title}-interior.pdf</strong> as the Manuscript.</li>
                <li>Upload <strong className="text-foreground">{book.title}-cover.pdf</strong> as the Book Cover.</li>
                <li>Interior type: Black &amp; white interior with <strong className="text-foreground">{book.paperType}</strong> paper.</li>
                <li>Bleed settings: <strong className="text-foreground">Bleed (PDF only)</strong>.</li>
                <li>Trim size: <strong className="text-foreground">{book.largePrint ? "8.5 × 11 in" : "6 × 9 in"}</strong>.</li>
                <li>Spine width: <strong className="text-foreground">{spineW.toFixed(3)}"</strong> (KDP calculates automatically, for reference only).</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

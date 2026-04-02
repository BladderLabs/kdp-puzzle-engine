import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useGetBook, getGetBookQueryKey } from "@workspace/api-client-react";
import type { BookConfigPuzzleType, BookConfigDifficulty, BookConfigPaperType, BookConfigTheme, BookConfigCoverStyle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Status = "idle" | "generating" | "pdf_interior" | "pdf_cover" | "done" | "error";

const GOLD = "#C8951A";

export function GenerateBook() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const { data: book, isLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });
  const { toast } = useToast();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const interiorBlobRef = useRef<Blob | null>(null);
  const coverBlobRef = useRef<Blob | null>(null);

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

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleGenerate = async () => {
    if (!book) return;
    setErrorMsg("");
    interiorBlobRef.current = null;
    coverBlobRef.current = null;

    const bookConfig = {
      title: book.title,
      subtitle: book.subtitle ?? undefined,
      author: book.author ?? undefined,
      puzzleType: book.puzzleType as BookConfigPuzzleType,
      puzzleCount: book.puzzleCount ?? 100,
      difficulty: (book.difficulty as BookConfigDifficulty) ?? "Medium",
      largePrint: book.largePrint ?? false,
      paperType: (book.paperType as BookConfigPaperType) ?? "white",
      theme: (book.theme as BookConfigTheme) ?? "midnight",
      coverStyle: (book.coverStyle as BookConfigCoverStyle) ?? "classic",
      backDescription: book.backDescription ?? undefined,
      words: book.words ?? [],
      wordCategory: book.wordCategory ?? undefined,
      volumeNumber: book.volumeNumber ?? 0,
    };

    try {
      // ── Step 1: Generate HTML (puzzle generation happens here) ──
      setStatus("generating");
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookConfig),
      });
      if (!genRes.ok) throw new Error(`Generate failed: ${await genRes.text()}`);
      const { interiorHtml, interiorDims, coverHtml, coverDims } = await genRes.json();

      // ── Step 2: Render interior PDF ──
      setStatus("pdf_interior");
      const interiorRes = await fetch("/api/pdf/interior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: interiorHtml,
          width: interiorDims?.trimW ?? 8.5,
          height: interiorDims?.trimH ?? 11,
        }),
      });
      if (!interiorRes.ok) throw new Error(`Interior PDF failed: ${await interiorRes.text()}`);
      interiorBlobRef.current = await interiorRes.blob();

      // ── Step 3: Render cover PDF ──
      setStatus("pdf_cover");
      const coverRes = await fetch("/api/pdf/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: coverHtml,
          fullW: coverDims.fullW,
          fullH: coverDims.fullH,
        }),
      });
      if (!coverRes.ok) throw new Error(`Cover PDF failed: ${await coverRes.text()}`);
      coverBlobRef.current = await coverRes.blob();

      setStatus("done");
      toast({ title: "Book generated!", description: "Both PDFs are ready to download." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      setStatus("error");
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    }
  };

  const handleReset = () => {
    interiorBlobRef.current = null;
    coverBlobRef.current = null;
    setStatus("idle");
    setErrorMsg("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading book details...
      </div>
    );
  }
  if (!book) {
    return (
      <div className="text-center text-destructive py-12">
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

  const isGenerating = status === "generating" || status === "pdf_interior" || status === "pdf_cover";

  const progressLabel =
    status === "generating"   ? `Generating ${pc} puzzles…` :
    status === "pdf_interior" ? "Rendering interior PDF…" :
    status === "pdf_cover"    ? "Rendering cover PDF…" :
    "";

  const bookSlug = slug(book.title);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Generate: {book.title}</h1>

      {/* Book spec summary */}
      <Card>
        <CardHeader>
          <CardTitle>Book Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Puzzle type:</span> <strong>{book.puzzleType}</strong></div>
          <div><span className="text-muted-foreground">Count:</span> <strong>{pc} puzzles</strong></div>
          <div><span className="text-muted-foreground">Difficulty:</span> <strong>{book.difficulty}</strong></div>
          <div><span className="text-muted-foreground">Paper:</span> <strong>{book.paperType}</strong></div>
          <div><span className="text-muted-foreground">Size:</span> <strong>{book.largePrint ? '8.5"×11" Large Print' : '6"×9" Standard'}</strong></div>
          <div><span className="text-muted-foreground">Est. pages / spine:</span> <strong>{totP} pages · {spineW.toFixed(3)}"</strong></div>
          <div><span className="text-muted-foreground">Theme:</span> <strong className="capitalize">{book.theme}</strong></div>
          <div><span className="text-muted-foreground">Cover style:</span> <strong className="capitalize">{book.coverStyle}</strong></div>
        </CardContent>
      </Card>

      {/* Generate card */}
      <Card>
        <CardContent className="p-8 space-y-6">

          {/* Shimmer loading bar — visible during generation */}
          {isGenerating && (
            <div className="space-y-3">
              <div
                style={{
                  position: "relative",
                  height: "6px",
                  background: "#1a1610",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "40%",
                    height: "100%",
                    background: `linear-gradient(90deg, transparent, ${GOLD}44, transparent)`,
                    animation: "shimmer-slide 1.5s ease-in-out infinite",
                  }}
                />
              </div>
              <p
                className="text-sm text-center font-mono"
                style={{ color: GOLD + "bb", letterSpacing: "0.05em" }}
              >
                {progressLabel}
              </p>
            </div>
          )}

          {/* Error message */}
          {status === "error" && (
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
          )}

          {/* Generate button — hidden when done */}
          {status !== "done" && (
            <Button
              size="lg"
              className="w-full text-lg h-16"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? progressLabel : "Generate Interior + Cover PDFs"}
            </Button>
          )}

          {/* ── Result section — appears after generation ── */}
          {status === "done" && (
            <div className="space-y-6 text-center">
              {/* Diamond decoration */}
              <div style={{ fontSize: "28px", color: GOLD }}>◆</div>

              {/* Gold heading */}
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: 700, color: GOLD, marginBottom: "8px" }}>
                  Book Generated!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Both PDFs are ready. Download them and upload to KDP.
                </p>
              </div>

              {/* Download Interior PDF — gold, full width */}
              <Button
                size="lg"
                className="w-full text-base"
                style={{ background: GOLD, color: "#000", fontWeight: 700 }}
                onClick={() => interiorBlobRef.current && downloadBlob(interiorBlobRef.current, `${bookSlug}-interior.pdf`)}
              >
                Download Interior PDF
              </Button>

              {/* Download Cover PDF — ghost style */}
              <Button
                size="lg"
                variant="outline"
                className="w-full text-base"
                style={{ borderColor: GOLD, color: GOLD }}
                onClick={() => coverBlobRef.current && downloadBlob(coverBlobRef.current, `${bookSlug}-cover.pdf`)}
              >
                Download Cover PDF
              </Button>

              {/* KDP Upload Instructions — all 9 steps */}
              <div
                className="text-left rounded-lg p-5 space-y-3"
                style={{ border: `1px solid ${GOLD}44`, background: GOLD + "08" }}
              >
                <h3
                  className="font-bold text-base mb-3"
                  style={{ color: GOLD }}
                >
                  KDP Upload Instructions
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Go to <strong className="text-foreground">kdp.amazon.com</strong> → Create → Paperback</li>
                  <li>Enter title, subtitle, author, keywords, description</li>
                  <li>Check <strong className="text-foreground">"Low-content book"</strong> under Categories</li>
                  <li>AI disclosure → <strong className="text-foreground">Yes</strong></li>
                  <li>Interior: <strong className="text-foreground">B&amp;W, {book.paperType} paper, {book.largePrint ? "8.5×11in" : "6×9in"}, No bleed</strong></li>
                  <li>Upload <strong className="text-foreground">{bookSlug}-interior.pdf</strong> as manuscript</li>
                  <li>Upload <strong className="text-foreground">{bookSlug}-cover.pdf</strong> → select <strong className="text-foreground">"Upload a print-ready PDF"</strong></li>
                  <li>Price: <strong className="text-foreground">£7.99 (UK) or $9.99 (US)</strong> for 60% royalty</li>
                  <li>Publish → review takes <strong className="text-foreground">24–72 hours</strong></li>
                </ol>
              </div>

              {/* Generate Another Book — ghost reset button */}
              <Button
                variant="outline"
                className="w-full"
                style={{ borderColor: GOLD + "66", color: GOLD + "99" }}
                onClick={handleReset}
              >
                Generate Another Book
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

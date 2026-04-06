import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useGetBook, getGetBookQueryKey } from "@workspace/api-client-react";
import type { BookConfigPuzzleType, BookConfigDifficulty, BookConfigPaperType, BookConfigTheme, BookConfigCoverStyle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Status = "idle" | "generating" | "pdf_interior" | "pdf_cover" | "done" | "error";

const GOLD = "#C8951A";

function HtmlPreviewIframe({ html, scaleW, naturalW, naturalH, label }: {
  html: string;
  scaleW: number;
  naturalW: number;
  naturalH: number;
  label: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  const scale = scaleW / naturalW;
  const containerH = Math.round(naturalH * scale);

  return (
    <div>
      <p className="text-xs font-mono mb-2" style={{ color: GOLD + "aa", letterSpacing: "0.08em" }}>{label}</p>
      <div
        style={{
          width: scaleW,
          height: containerH,
          overflow: "hidden",
          borderRadius: 6,
          border: `1px solid ${GOLD}33`,
          position: "relative",
          background: "#111",
        }}
      >
        {blobUrl && (
          <iframe
            ref={iframeRef}
            src={blobUrl}
            style={{
              width: naturalW,
              height: naturalH,
              border: "none",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
            title={label}
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}

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
  const [coverHtml, setCoverHtml] = useState<string | null>(null);
  const [samplePageHtml, setSamplePageHtml] = useState<string | null>(null);
  const [coverDimsState, setCoverDimsState] = useState<{ fullW: number; fullH: number } | null>(null);

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

  const extractFirstPuzzlePage = (interiorHtml: string): string => {
    const pages = interiorHtml.match(/<div class="pg in">[\s\S]*?(?=<div class="pg in">|<\/body>)/g);
    if (!pages || pages.length < 3) return interiorHtml;
    const puzzlePage = pages.find((p, i) => i >= 2 && p.includes("inline-flex")) || pages[2] || pages[0];
    const head = interiorHtml.match(/^[\s\S]*?<\/head>/)?.[0] || "";
    return `<!DOCTYPE html><html>${head}<body style="margin:0;padding:0;background:#fff;">${puzzlePage}</div></body></html>`;
  };

  const handleGenerate = async () => {
    if (!book) return;
    setErrorMsg("");
    interiorBlobRef.current = null;
    coverBlobRef.current = null;
    setCoverHtml(null);
    setSamplePageHtml(null);

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
      coverImageUrl: book.coverImageUrl ?? undefined,
      volumeNumber: book.volumeNumber ?? 0,
      dedication: book.dedication ?? undefined,
      difficultyMode: book.difficultyMode ?? "uniform",
      challengeDays: book.challengeDays ?? undefined,
    };

    try {
      setStatus("generating");
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookConfig),
      });
      if (!genRes.ok) throw new Error(`Generate failed: ${await genRes.text()}`);
      const { interiorHtml, interiorDims, coverHtml: cHtml, coverDims } = await genRes.json();

      setCoverHtml(cHtml);
      setCoverDimsState(coverDims);
      setSamplePageHtml(extractFirstPuzzlePage(interiorHtml));

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

      setStatus("pdf_cover");
      const coverRes = await fetch("/api/pdf/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: cHtml,
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
    setCoverHtml(null);
    setSamplePageHtml(null);
    setCoverDimsState(null);
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
  const progressive = book.difficultyMode === "progressive";
  const frontMatter = 3 + (book.dedication ? 1 : 0) + (book.challengeDays ? 1 : 0);
  const dividers = progressive && pc >= 30 ? 3 : 0;
  const totP = frontMatter + 4 + pc + Math.ceil(pc / aPer) + dividers;
  const spineW = totP * thick + 0.06;

  const isGenerating = status === "generating" || status === "pdf_interior" || status === "pdf_cover";

  const progressLabel =
    status === "generating"   ? `Generating ${pc} puzzles…` :
    status === "pdf_interior" ? "Rendering interior PDF…" :
    status === "pdf_cover"    ? "Rendering cover PDF…" :
    "";

  const bookSlug = slug(book.title);

  const coverNaturalW = coverDimsState ? Math.round(coverDimsState.fullW * 96) : 1666;
  const coverNaturalH = coverDimsState ? Math.round(coverDimsState.fullH * 96) : 1080;
  const interiorNaturalW = book.largePrint ? 816 : 576;
  const interiorNaturalH = book.largePrint ? 1056 : 864;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Generate: {book.title}</h1>

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

      <Card>
        <CardContent className="p-8 space-y-6">

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

          {status === "error" && (
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
          )}

          {status !== "done" && !isGenerating && (() => {
            const checks = [
              {
                label: "Title is 6+ words",
                pass: (book.title || "").trim().split(/\s+/).filter(Boolean).length >= 6,
                fix: "Add a descriptive subtitle or expand your title",
              },
              {
                label: "Subtitle is present",
                pass: !!book.subtitle && book.subtitle.trim().length > 0,
                fix: 'e.g. "Big Letters, Easy to Read — Perfect for Adults"',
              },
              {
                label: "Author name set",
                pass: !!book.author && book.author.trim().length > 0,
                fix: "Enter a pen name or your real name in the Book Setup form",
              },
              {
                label: `Puzzle count ≥ 50 (${book.puzzleCount ?? 0} puzzles)`,
                pass: (book.puzzleCount ?? 0) >= 50,
                fix: "Increase puzzle count to at least 50 for better value perception",
              },
              {
                label: "Back cover description ≥ 80 words",
                pass: (book.backDescription || "").trim().split(/\s+/).filter(Boolean).length >= 80,
                fix: "Click the description field in Book Setup to auto-fill a template",
              },
            ];
            const allPass = checks.every(c => c.pass);
            return (
              <div
                className="rounded-lg p-4 space-y-2"
                style={{ border: `1px solid ${allPass ? "#22c55e44" : "#f59e0b44"}`, background: allPass ? "#22c55e08" : "#f59e0b08" }}
              >
                <h3 className="text-sm font-bold" style={{ color: allPass ? "#22c55e" : GOLD }}>
                  {allPass ? "✓ Ready to Publish" : "Publish Readiness Checklist"}
                </h3>
                <div className="space-y-1">
                  {checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span style={{ color: c.pass ? "#22c55e" : "#f59e0b", flexShrink: 0, marginTop: 1 }}>
                        {c.pass ? "✓" : "⚠"}
                      </span>
                      <span className={c.pass ? "text-muted-foreground line-through" : "text-foreground"}>
                        {c.label}
                      </span>
                      {!c.pass && <span className="text-muted-foreground italic">— {c.fix}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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

          {status === "done" && (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <div style={{ fontSize: "28px", color: GOLD }}>◆</div>
                <h2 style={{ fontSize: "24px", fontWeight: 700, color: GOLD }}>
                  Book Generated!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Preview below — download the PDFs and upload to KDP.
                </p>
              </div>

              {/* ── Live Cover Preview ── */}
              {coverHtml && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold" style={{ color: GOLD }}>
                    Cover Preview (front + spine + back)
                  </h3>
                  <div className="overflow-x-auto">
                    <HtmlPreviewIframe
                      html={coverHtml}
                      scaleW={740}
                      naturalW={coverNaturalW}
                      naturalH={coverNaturalH}
                      label="FULL COVER WRAP — PRINT READY"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Left panel = back cover · Center = spine · Right panel = front cover
                  </p>
                </div>
              )}

              {/* ── Interior Sample Page ── */}
              {samplePageHtml && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold" style={{ color: GOLD }}>
                    Interior Sample — First Puzzle Page
                  </h3>
                  <div className="flex justify-center">
                    <HtmlPreviewIframe
                      html={samplePageHtml}
                      scaleW={380}
                      naturalW={interiorNaturalW}
                      naturalH={interiorNaturalH}
                      label="INTERIOR PAGE — B&W"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Top-right: difficulty dots + estimated time + completion checkbox
                  </p>
                </div>
              )}

              {/* ── Download buttons ── */}
              <div className="space-y-3 pt-2">
                <Button
                  size="lg"
                  className="w-full text-base"
                  style={{ background: GOLD, color: "#000", fontWeight: 700 }}
                  onClick={() => interiorBlobRef.current && downloadBlob(interiorBlobRef.current, `${bookSlug}-interior.pdf`)}
                >
                  Download Interior PDF
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base"
                  style={{ borderColor: GOLD, color: GOLD }}
                  onClick={() => coverBlobRef.current && downloadBlob(coverBlobRef.current, `${bookSlug}-cover.pdf`)}
                >
                  Download Cover PDF (Full Wrap)
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base"
                  style={{ borderColor: GOLD + "99", color: GOLD + "cc" }}
                  disabled={!interiorBlobRef.current || !coverBlobRef.current}
                  onClick={async () => {
                    if (!interiorBlobRef.current || !coverBlobRef.current) return;
                    const JSZip = (await import("jszip")).default;
                    const zip = new JSZip();
                    zip.file(`${bookSlug}-interior.pdf`, interiorBlobRef.current);
                    zip.file(`${bookSlug}-cover.pdf`, coverBlobRef.current);
                    const zipBlob = await zip.generateAsync({ type: "blob" });
                    downloadBlob(zipBlob, `${bookSlug}-kdp-bundle.zip`);
                  }}
                >
                  Download Both (ZIP Bundle)
                </Button>
              </div>

              {/* ── KDP Instructions ── */}
              <div
                className="text-left rounded-lg p-5 space-y-3"
                style={{ border: `1px solid ${GOLD}44`, background: GOLD + "08" }}
              >
                <h3 className="font-bold text-base mb-3" style={{ color: GOLD }}>
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

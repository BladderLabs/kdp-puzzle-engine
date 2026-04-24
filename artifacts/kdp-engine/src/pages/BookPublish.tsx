﻿﻿import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Types — loose; API schema hasn't been Orval-regenerated for new fields
// ─────────────────────────────────────────────────────────────────────────────

interface BookRow {
  id: number;
  title: string;
  subtitle: string | null;
  author: string | null;
  puzzleType: string;
  puzzleCount: number;
  difficulty: string;
  largePrint: boolean;
  theme: string;
  coverStyle: string;
  backDescription: string | null;
  coverImageUrl: string | null;
  niche: string | null;
  volumeNumber: number | null;
  keywords: string[] | null;
  experienceMode?: string | null;
  giftSku?: boolean | null;
  giftRecipient?: string | null;
  listingCategories?: Array<{ breadcrumb: string; rationale: string }> | null;
  listingDescriptionHtml?: string | null;
  listingSlug?: string | null;
  priceRecommended?: string | null;
  royaltyEstimate?: string | null;
  qaScore?: number | null;
  qaIssuesJson?: Array<{ code: string; severity: string; message: string }> | null;
  narrativeArcJson?: unknown | null;
  amazonAsin?: string | null;
}

async function fetchBook(id: number): Promise<BookRow> {
  const res = await fetch(`/api/books/${id}`);
  if (!res.ok) throw new Error(`Failed to load book (${res.status})`);
  return res.json();
}

// ── Publication Preflight ───────────────────────────────────────────────────

interface PreflightIssue {
  code: string;
  severity: "fail" | "warn" | "info";
  message: string;
  recommendation?: string;
}

interface PreflightResult {
  passed: boolean;
  score: number;
  issues: PreflightIssue[];
  summary: string;
}

async function fetchPreflight(id: number): Promise<PreflightResult> {
  const res = await fetch(`/api/books/${id}/preflight`);
  if (!res.ok) throw new Error(`Preflight failed (${res.status})`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme colors mirror
// ─────────────────────────────────────────────────────────────────────────────

const THEME_COLORS: Record<string, { bg: string; ac: string }> = {
  midnight:  { bg: "#0D1B3E", ac: "#F5C842" },
  forest:    { bg: "#1A3C1A", ac: "#6DCC50" },
  crimson:   { bg: "#280808", ac: "#FF3838" },
  ocean:     { bg: "#C8E8F8", ac: "#1565A8" },
  violet:    { bg: "#180635", ac: "#C060FF" },
  slate:     { bg: "#252E3A", ac: "#FF8C38" },
  sunrise:   { bg: "#FDF0E0", ac: "#D44000" },
  teal:      { bg: "#062020", ac: "#18D0A0" },
  parchment: { bg: "#F5E4C0", ac: "#7B3A00" },
  sky:       { bg: "#E0EFFF", ac: "#2050B8" },
};

const EXPERIENCE_META: Record<string, { icon: string; label: string }> = {
  standard: { icon: "📚", label: "Standard" },
  sketch:       { icon: "✏️", label: "Sketch Journey" },
  detective:    { icon: "🔍", label: "Detective Casebook" },
  adventure:    { icon: "⚔️", label: "Adventure Quest" },
  darkacademia: { icon: "📜", label: "Dark Academia" },
  cozycottage:  { icon: "🫖", label: "Cozy Cottage" },
  mindful:      { icon: "🌿", label: "Mindful Wellness" },
};

// ─────────────────────────────────────────────────────────────────────────────
// KDP listing formatter
// ─────────────────────────────────────────────────────────────────────────────

function buildKdpListingText(book: BookRow): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  KDP PAPERBACK LISTING");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push("TITLE:");
  lines.push(book.title);
  lines.push("");
  lines.push("SUBTITLE:");
  lines.push(book.subtitle ?? "");
  lines.push("");
  lines.push("AUTHOR:");
  lines.push(book.author ?? "");
  lines.push("");
  lines.push("DESCRIPTION (paste as HTML into KDP description field):");
  lines.push(book.listingDescriptionHtml ?? book.backDescription ?? "");
  lines.push("");
  lines.push("KEYWORDS (7 slots — one per line, paste one per field):");
  const keywords = (book.keywords ?? []).slice(0, 7);
  for (let i = 0; i < 7; i++) {
    lines.push(`  ${i + 1}. ${keywords[i] ?? ""}`);
  }
  lines.push("");
  lines.push("CATEGORIES (paste breadcrumbs into KDP browse categories):");
  const categories = book.listingCategories ?? [];
  for (let i = 0; i < 2; i++) {
    lines.push(`  ${i + 1}. ${categories[i]?.breadcrumb ?? ""}`);
  }
  lines.push("");
  lines.push("PRICE:");
  lines.push(`  $${book.priceRecommended ?? "9.99"} (estimated royalty: $${book.royaltyEstimate ?? "~3.50"})`);
  lines.push("");
  lines.push("FORMAT:");
  lines.push(`  ${book.largePrint ? "Large Print 8.5\" × 11\"" : "Standard 6\" × 9\""} · ${book.puzzleType} · ${book.puzzleCount} puzzles · ${book.difficulty}`);
  if (book.giftSku) {
    lines.push(`  Gift SKU${book.giftRecipient ? ` — positioned for ${book.giftRecipient}` : ""}`);
  }
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  KDP Upload: https://kdp.amazon.com/en_US/title-setup/paperback/new");
  lines.push("═══════════════════════════════════════════════════════");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helpers — direct fetch from existing /api/pdf/* endpoints
// ─────────────────────────────────────────────────────────────────────────────

async function downloadPdf(kind: "interior" | "cover", book: BookRow): Promise<void> {
  // Two-step flow matches existing GenerateBook.tsx pattern:
  //   1. POST /api/generate with the book config → returns { interiorHtml, coverHtml, interiorDims, coverDims }
  //   2. POST /api/pdf/interior or /pdf/cover with the rendered HTML → returns the PDF
  const rec = book as unknown as Record<string, unknown>;
  const genBody = {
    title: book.title,
    subtitle: book.subtitle ?? "",
    author: book.author ?? "",
    puzzleType: book.puzzleType,
    puzzleCount: book.puzzleCount,
    difficulty: book.difficulty,
    largePrint: book.largePrint,
    paperType: (rec.paperType as string) ?? "white",
    theme: book.theme,
    coverStyle: book.coverStyle,
    backDescription: book.backDescription ?? "",
    words: ((rec.words as string[]) ?? []),
    wordCategory: (rec.wordCategory as string | null) ?? null,
    coverImageUrl: book.coverImageUrl ?? null,
    niche: book.niche ?? null,
    volumeNumber: book.volumeNumber ?? 0,
    keywords: book.keywords ?? [],
    dedication: (rec.dedication as string | null) ?? null,
    difficultyMode: (rec.difficultyMode as string) ?? "uniform",
    challengeDays: (rec.challengeDays as number | null) ?? null,
    accentHexOverride: (rec.accentHexOverride as string | null) ?? null,
    casingOverride: (rec.casingOverride as string | null) ?? null,
    fontStyleDirective: (rec.fontStyleDirective as string | null) ?? null,
    experienceMode: book.experienceMode ?? "standard",
    // Thread the Solve-the-Story narrative arc so detective/adventure books
    // get their case-file preamble and revelation pages in the interior PDF.
    narrativeArc: (rec.narrativeArcJson as unknown) ?? null,
  };

  const genRes = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(genBody),
  });
  if (!genRes.ok) {
    const txt = await genRes.text().catch(() => "");
    throw new Error(`Generate step failed (${genRes.status}): ${txt.slice(0, 200)}`);
  }
  const generated = await genRes.json() as {
    interiorHtml: string;
    interiorDims: { trimW: number; trimH: number };
    coverHtml: string;
    coverDims: { fullW: number; fullH: number };
  };

  const pdfEndpoint = kind === "interior" ? "/api/pdf/interior" : "/api/pdf/cover";
  const pdfBody = kind === "interior"
    ? { html: generated.interiorHtml, width: generated.interiorDims?.trimW ?? 8.5, height: generated.interiorDims?.trimH ?? 11 }
    : { html: generated.coverHtml, fullW: generated.coverDims?.fullW, fullH: generated.coverDims?.fullH };

  const pdfRes = await fetch(pdfEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pdfBody),
  });
  if (!pdfRes.ok) {
    const txt = await pdfRes.text().catch(() => "");
    throw new Error(`${kind} PDF render failed (${pdfRes.status}): ${txt.slice(0, 200)}`);
  }
  const blob = await pdfRes.blob();
  const filename = `${(book.listingSlug || slugify(book.title))}-${kind}.pdf`;
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerTextDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  triggerBlobDownload(blob, filename);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero cover preview — uses the Gemini image if present, else a themed SVG
// ─────────────────────────────────────────────────────────────────────────────

function HeroCover({ book }: { book: BookRow }) {
  const t = THEME_COLORS[book.theme] ?? THEME_COLORS.midnight;
  const isDark = ["midnight", "forest", "crimson", "violet", "slate", "teal"].includes(book.theme);
  const tx = isDark ? "#fff" : "#111";
  const hasImage = Boolean(book.coverImageUrl && book.coverImageUrl.startsWith("data:"));

  return (
    <div
      className="relative rounded-sm overflow-hidden shadow-2xl"
      style={{
        width: "280px",
        height: "420px",
        background: `linear-gradient(160deg, ${t.bg} 0%, ${t.bg}ee 100%)`,
        borderLeft: `6px solid ${t.ac}`,
      }}
    >
      {hasImage && (
        <img
          src={book.coverImageUrl!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ imageRendering: "crisp-edges" }}
        />
      )}
      {hasImage && (
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)" }} />
      )}
      {book.giftSku && (
        <svg viewBox="0 0 110 130" className="absolute top-0 left-0 w-16 h-20" style={{ filter: "drop-shadow(2px 3px 5px rgba(0,0,0,0.4))" }}>
          <path d="M 0,0 L 70,0 L 100,30 L 100,70 L 70,100 L 0,100 Z" fill={t.ac} />
          <text x="48" y="58" textAnchor="middle" fontFamily="Playfair Display,Georgia,serif" fontSize="16" fontWeight="800" fill="#fff" letterSpacing="2">GIFT</text>
          <path d="M 8,100 L 0,125 L 20,110 Z" fill={t.ac} opacity="0.85" />
          <path d="M 20,110 L 38,125 L 38,100 Z" fill={t.ac} opacity="0.7" />
        </svg>
      )}
      <div className="absolute inset-0 flex flex-col justify-end p-5 z-10">
        <div className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: t.ac, opacity: 0.9 }}>
          {book.puzzleType}
        </div>
        <div
          className="font-display font-bold leading-tight line-clamp-4"
          style={{
            color: hasImage ? "#fff" : tx,
            fontSize: book.title.length > 40 ? "22px" : "28px",
            textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.6)" : "none",
          }}
        >
          {book.title}
        </div>
        {book.subtitle && (
          <div
            className="text-[12px] italic mt-2 line-clamp-2"
            style={{
              color: hasImage ? "rgba(255,255,255,0.85)" : `${tx}99`,
              textShadow: hasImage ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
            }}
          >
            {book.subtitle}
          </div>
        )}
        <div className="text-[10px] font-mono opacity-60 mt-3" style={{ color: hasImage ? "#fff" : tx }}>
          {book.author}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QA + Experience badges
// ─────────────────────────────────────────────────────────────────────────────

function qaPillClass(score: number): string {
  if (score >= 85) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  if (score >= 70) return "bg-amber-500/15 text-amber-400 border-amber-500/40";
  if (score >= 50) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  return "bg-red-500/15 text-red-400 border-red-500/40";
}

function BadgeRow({ book }: { book: BookRow }) {
  const em = book.experienceMode && book.experienceMode !== "standard" ? EXPERIENCE_META[book.experienceMode] : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {typeof book.qaScore === "number" && (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest ${qaPillClass(book.qaScore)}`}>
          QA {book.qaScore}/100
        </span>
      )}
      {em && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-[10px] text-white/75 font-semibold">
          <span>{em.icon}</span>
          <span className="uppercase tracking-widest">{em.label}</span>
        </span>
      )}
      {book.giftSku && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-pink-500/30 bg-pink-500/10 text-[10px] text-pink-400 font-bold">
          🎁 Gift {book.giftRecipient ? `for ${book.giftRecipient}` : ""}
        </span>
      )}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/60 font-semibold">
        {book.puzzleCount} · {book.difficulty}{book.largePrint ? " · Large Print" : ""}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function BookPublish() {
  const params = useParams<{ id: string }>();
  const bookId = Number(params.id);
  const [, setLocation] = useLocation();
  const { data: book, isLoading, error } = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => fetchBook(bookId),
    enabled: Number.isFinite(bookId) && bookId > 0,
  });
  const { data: preflight } = useQuery({
    queryKey: ["preflight", bookId],
    queryFn: () => fetchPreflight(bookId),
    enabled: Number.isFinite(bookId) && bookId > 0,
  });
  const preflightBlocking = Boolean(
    preflight && preflight.issues.some(i => i.severity === "fail"),
  );

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [downloadingInterior, setDownloadingInterior] = useState(false);
  const [downloadingCover, setDownloadingCover] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [preflightExpanded, setPreflightExpanded] = useState(false);

  const listingText = useMemo(() => book ? buildKdpListingText(book) : "", [book]);

  async function handleCopy() {
    if (!listingText) return;
    try {
      await navigator.clipboard.writeText(listingText);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }

  async function handleDownloadInterior() {
    if (!book) return;
    setDownloadingInterior(true);
    setDownloadError(null);
    try {
      await downloadPdf("interior", book);
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloadingInterior(false);
    }
  }

  async function handleDownloadCover() {
    if (!book) return;
    setDownloadingCover(true);
    setDownloadError(null);
    try {
      await downloadPdf("cover", book);
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloadingCover(false);
    }
  }

  function handleDownloadListing() {
    if (!book) return;
    triggerTextDownload(listingText, `${(book.listingSlug || slugify(book.title))}-kdp-listing.txt`);
  }

  useEffect(() => {
    // Confetti-ish delight: pulse the body once on mount
    document.body.classList.add("card-pulse");
    const t = setTimeout(() => document.body.classList.remove("card-pulse"), 2000);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        <div className="inline-flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your book…
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="font-display text-xl font-bold mb-2">Couldn't load this book</div>
        <div className="text-muted-foreground text-sm mb-6">{(error as Error | undefined)?.message ?? "Unknown error"}</div>
        <Button onClick={() => setLocation("/")}>Back to Studio</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold mb-2">
          ✓ BOOK READY TO PUBLISH
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">{book.title}</h1>
        {book.subtitle && <p className="text-lg text-muted-foreground mt-1">{book.subtitle}</p>}
        <div className="font-sketch text-muted-foreground mt-2">
          by {book.author ?? "you"}
        </div>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        <div className="flex justify-center md:justify-start">
          <HeroCover book={book} />
        </div>

        <div className="space-y-6">
          <BadgeRow book={book} />

          {/* ── Publication Preflight ────────────────────────────────────── */}
          {preflight && (
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                preflightBlocking
                  ? "border-destructive/40 bg-destructive/5"
                  : preflight.passed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold">
                    {preflightBlocking
                      ? "✗ Publication Preflight — BLOCKERS"
                      : preflight.passed
                        ? "✓ Publication Preflight — PASSED"
                        : "⚠ Publication Preflight — warnings"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{preflight.summary}</div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-display font-bold ${
                    preflight.score >= 85 ? "text-emerald-500"
                    : preflight.score >= 70 ? "text-amber-500"
                    : "text-destructive"
                  }`}>{preflight.score}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
                </div>
              </div>
              {preflight.issues.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreflightExpanded(!preflightExpanded)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  {preflightExpanded ? "Hide" : "Show"} {preflight.issues.length} issue{preflight.issues.length === 1 ? "" : "s"}
                </button>
              )}
              {preflightExpanded && (
                <ul className="space-y-2 pt-2 border-t">
                  {preflight.issues.map((issue, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0 ${
                        issue.severity === "fail" ? "bg-destructive/20 text-destructive"
                        : issue.severity === "warn" ? "bg-amber-500/20 text-amber-500"
                        : "bg-sky-500/20 text-sky-400"
                      }`}>{issue.severity}</span>
                      <div className="flex-1">
                        <div>{issue.message}</div>
                        {issue.recommendation && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">→ {issue.recommendation}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {preflightBlocking && (
                <p className="text-xs text-destructive font-semibold pt-2 border-t">
                  Fix the blockers above before downloading. KDP will reject books that violate these rules.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-card/60 p-5 space-y-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Step 1 · Download</div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={handleDownloadInterior}
                disabled={downloadingInterior || preflightBlocking}
                size="lg"
                className="justify-start h-12 text-base"
              >
                <span className="mr-3">📖</span>
                {downloadingInterior ? "Rendering interior PDF…" : "Download Interior PDF"}
                <span className="ml-auto text-xs opacity-60">{book.puzzleCount} puzzles · 300 DPI</span>
              </Button>
              <Button
                onClick={handleDownloadCover}
                disabled={downloadingCover || preflightBlocking}
                size="lg"
                className="justify-start h-12 text-base"
                variant="secondary"
              >
                <span className="mr-3">🎨</span>
                {downloadingCover ? "Rendering cover PDF…" : "Download Cover PDF"}
                <span className="ml-auto text-xs opacity-60">full wrap · 300 DPI</span>
              </Button>
              <Button
                onClick={handleDownloadListing}
                disabled={preflightBlocking}
                size="lg"
                className="justify-start h-12 text-base"
                variant="outline"
              >
                <span className="mr-3">📝</span>
                Download Listing (.txt)
                <span className="ml-auto text-xs opacity-60">title + keywords + categories</span>
              </Button>
            </div>
            {downloadError && (
              <div className="text-xs text-destructive">{downloadError}</div>
            )}
          </div>

          <div className="rounded-xl border bg-card/60 p-5 space-y-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Step 2 · Copy listing</div>
            <p className="text-sm text-muted-foreground">
              Copies everything to clipboard in the exact format KDP wants — paste it into the product setup page section by section.
            </p>
            <Button
              onClick={handleCopy}
              size="lg"
              className="w-full h-12 text-base"
              variant={copyStatus === "copied" ? "secondary" : "default"}
            >
              {copyStatus === "copied" ? "✓ Copied to clipboard" : copyStatus === "error" ? "Clipboard blocked — use Download button" : "📋 Copy Full KDP Listing"}
            </Button>
          </div>

          <div className="rounded-xl border bg-card/60 p-5 space-y-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Step 3 · Open KDP</div>
            <p className="text-sm text-muted-foreground">
              Opens Amazon KDP's title setup in a new tab. Upload the two PDFs and paste the listing fields.
            </p>
            <a
              href="https://kdp.amazon.com/en_US/title-setup/paperback/new"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button size="lg" variant="outline" className="w-full h-12 text-base">
                🚀 Open KDP Title Setup
              </Button>
            </a>
          </div>

          <AsinCapture bookId={book.id} initial={book.amazonAsin ?? null} />

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setLocation(`/books/${book.id}`)}>
              Edit details
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => setLocation(`/generate/${book.id}`)}>
              Re-generate PDFs
            </Button>
            <Button className="flex-1" onClick={() => setLocation("/")}>
              ✨ Generate another
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASIN Capture — Step 4: after the user publishes to KDP, they paste the
// ASIN Amazon assigned the book. We store it and fire the first BSR snapshot.
// ─────────────────────────────────────────────────────────────────────────────

function AsinCapture({ bookId, initial }: { bookId: number; initial: string | null }) {
  const [asin, setAsin] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const clean = asin.toUpperCase().trim();
    if (!/^B0[A-Z0-9]{8}$/.test(clean)) {
      setError("ASIN looks off — expected B0XXXXXXXX (10 chars, starts with B0).");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/asin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: clean }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      setStatus("saved");
      setAsin(clean);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  const saved = Boolean(initial);

  return (
    <div className="rounded-xl border bg-card/60 p-5 space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        Step 4 · Track after publish {saved && <span className="text-emerald-500 ml-1">✓ captured</span>}
      </div>
      <p className="text-sm text-muted-foreground">
        Once the book is live on Amazon, paste its ASIN here (10 characters, starts with <code className="text-xs px-1 rounded bg-white/5">B0</code>). Daily BSR snapshots begin immediately.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={asin}
          onChange={e => setAsin(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="B0XXXXXXXX"
          maxLength={10}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono tracking-widest uppercase"
        />
        <Button onClick={handleSave} disabled={status === "saving" || asin.length !== 10}>
          {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : saved ? "Update" : "Save ASIN"}
        </Button>
      </div>
      {status === "error" && error && <p className="text-xs text-destructive">{error}</p>}
      {status === "saved" && !error && (
        <p className="text-xs text-emerald-500">
          ASIN saved · initial BSR snapshot queued
        </p>
      )}
    </div>
  );
}

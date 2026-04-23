import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AuthorWizard, useActivePersona } from "@/components/author/AuthorWizard";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Opportunity {
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  titlePreview: string;
  subtitle: string;
  audience: string;
  experienceMode: string;
  theme: string;
  coverStyle: string;
  difficulty: string;
  puzzleCount: number;
  largePrint: boolean;
  whySells: string;
  heatLevel: "hot" | "rising" | "stable";
  seasonalWindow: string | null;
  estimatedPrice: number;
  estimatedRoyalty: number;
  prefilledBrief: string;
  giftSku: boolean;
  giftRecipient: string | null;
}

interface OpportunitiesPayload {
  opportunities: Opportunity[];
  researchNote: string | null;
  generatedAt: string;
  personaId: number | null;
  personaName: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOpportunities(): Promise<OpportunitiesPayload> {
  const res = await fetch("/api/opportunities");
  if (!res.ok) throw new Error("Failed to research opportunities");
  return res.json();
}

async function refreshOpportunities(): Promise<void> {
  await fetch("/api/opportunities/refresh", { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme colors mirror — for mini cover preview
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

const EXPERIENCE_ICON: Record<string, string> = {
  standard: "📚", sketch: "✏️", detective: "🔍", adventure: "⚔️",
  darkacademia: "📜", cozycottage: "🫖", mindful: "🌿",
};

const HEAT_STYLE: Record<Opportunity["heatLevel"], { label: string; cls: string; icon: string }> = {
  hot:     { label: "HOT",     cls: "bg-orange-500/15 text-orange-400 border-orange-500/40", icon: "🔥" },
  rising:  { label: "RISING",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40", icon: "📈" },
  stable:  { label: "STABLE",  cls: "bg-sky-500/15 text-sky-400 border-sky-500/40", icon: "✅" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini cover preview — procedural, no API call
// ─────────────────────────────────────────────────────────────────────────────

function MiniCover({ opp }: { opp: Opportunity }) {
  const t = THEME_COLORS[opp.theme] ?? THEME_COLORS.midnight;
  const isDark = ["midnight", "forest", "crimson", "violet", "slate", "teal"].includes(opp.theme);
  const tx = isDark ? "#fff" : "#111";
  return (
    <div
      className="relative overflow-hidden rounded-sm flex-shrink-0"
      style={{
        width: "88px",
        height: "130px",
        background: `linear-gradient(160deg, ${t.bg} 0%, ${t.bg}ee 100%)`,
        borderLeft: `3px solid ${t.ac}`,
      }}
    >
      {opp.giftSku && (
        <svg viewBox="0 0 110 130" className="absolute top-0 left-0 w-8 h-9" style={{ filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.3))" }}>
          <path d="M 0,0 L 70,0 L 100,30 L 100,70 L 70,100 L 0,100 Z" fill={t.ac} />
          <text x="48" y="58" textAnchor="middle" fontFamily="Playfair Display,Georgia,serif" fontSize="18" fontWeight="800" fill="#fff">✦</text>
        </svg>
      )}
      <div className="absolute inset-0 p-1.5 flex flex-col justify-between">
        <div>
          <div className="h-0.5 w-4 rounded-full mb-0.5" style={{ background: t.ac, opacity: 0.7 }} />
          <div className="h-0.5 w-2 rounded-full" style={{ background: t.ac, opacity: 0.4 }} />
        </div>
        <div>
          <div className="text-[6px] uppercase tracking-widest mb-0.5" style={{ color: t.ac, opacity: 0.85 }}>
            {opp.puzzleType}
          </div>
          <div className="font-display font-bold leading-tight line-clamp-3" style={{ color: tx, fontSize: "7px" }}>
            {opp.titlePreview}
          </div>
        </div>
        <div className="text-[5px] font-mono opacity-40" style={{ color: tx }}>
          {opp.puzzleCount}p · {opp.difficulty}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Opportunity Card
// ─────────────────────────────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  onGenerate,
  isQueued,
  onToggleQueue,
}: {
  opp: Opportunity;
  onGenerate: (o: Opportunity) => void;
  isQueued: boolean;
  onToggleQueue: (o: Opportunity) => void;
}) {
  const heat = HEAT_STYLE[opp.heatLevel];
  const theme = THEME_COLORS[opp.theme] ?? THEME_COLORS.midnight;

  return (
    <div
      className={`group relative rounded-xl border bg-card/60 p-4 transition-all duration-200 hover:border-amber-500/40 hover:bg-card/90 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 ${
        isQueued ? "ring-2 ring-amber-500/70 bg-amber-500/5" : ""
      }`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleQueue(opp); }}
        title={isQueued ? "Remove from batch queue" : "Add to batch queue (generate multiple at once)"}
        className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all opacity-0 group-hover:opacity-100 ${
          isQueued
            ? "bg-amber-500 text-black opacity-100"
            : "bg-white/10 text-white/70 hover:bg-white/20"
        }`}
      >
        {isQueued ? "✓" : "+"}
      </button>
      <div className="flex items-start gap-3">
        <MiniCover opp={opp} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${heat.cls}`}>
              <span>{heat.icon}</span>
              <span className="tracking-widest">{heat.label}</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-sketch flex items-center gap-1">
              <span>{EXPERIENCE_ICON[opp.experienceMode] ?? "📚"}</span>
              {opp.experienceMode === "standard" ? "Classic" : opp.experienceMode}
            </span>
            {opp.giftSku && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-pink-500/10 text-pink-400 border-pink-500/30">
                🎁 Gift {opp.giftRecipient ? `for ${opp.giftRecipient}` : ""}
              </span>
            )}
          </div>

          <h3 className="font-display font-bold text-base leading-tight line-clamp-2 mb-1">
            {opp.titlePreview}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{opp.subtitle}</p>

          {opp.seasonalWindow && (
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: theme.ac }}>
              ⏱ {opp.seasonalWindow}
            </div>
          )}

          <div className="text-[11px] leading-relaxed text-muted-foreground italic font-sketch border-l-2 pl-2 mb-3" style={{ borderColor: theme.ac }}>
            {opp.whySells}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
              <span>${opp.estimatedPrice.toFixed(2)}</span>
              <span className="opacity-40">·</span>
              <span>~${opp.estimatedRoyalty.toFixed(2)} royalty</span>
              <span className="opacity-40">·</span>
              <span className="capitalize">{opp.nicheLabel}</span>
            </div>
            <Button
              size="sm"
              onClick={() => onGenerate(opp)}
              className="text-xs h-7 px-3 opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ background: theme.ac, color: theme.bg === "#C8E8F8" || theme.bg === "#FDF0E0" || theme.bg === "#F5E4C0" || theme.bg === "#E0EFFF" ? "#000" : "#fff" }}
            >
              Generate →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Modal — SSE progress
// ─────────────────────────────────────────────────────────────────────────────

interface StageEvent { stage: string; status: string; message?: string; [k: string]: unknown }

function GenerationModal({
  opp,
  onClose,
  onDone,
}: {
  opp: Opportunity | null;
  onClose: () => void;
  onDone: (bookId: number) => void;
}) {
  const [stream, setStream] = useState<StageEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!opp) return;
    setStream([]);
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        // Pre-fetch real Amazon competitor data for this niche so the pipeline's
        // Market Intelligence + Listing Intelligence can ground their output in
        // actual BSR / price / review counts, not LLM guesses. Cached server-side
        // for 15 min, so repeat clicks on the same niche are free.
        let marketEvidence: unknown[] | undefined;
        try {
          setStream(s => [...s, {
            stage: "apify_research",
            status: "running",
            message: `Pulling live Amazon data for ${opp.nicheLabel}…`,
          }]);
          const apifyRes = await fetch("/api/apify/market-research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              keyword: `${opp.nicheLabel} ${opp.puzzleType}`.toLowerCase(),
              puzzleType: opp.puzzleType,
            }),
          });
          if (apifyRes.ok) {
            const apifyData = await apifyRes.json() as { results?: unknown[]; source?: string };
            marketEvidence = Array.isArray(apifyData.results) ? apifyData.results.slice(0, 5) : undefined;
            setStream(s => [...s, {
              stage: "apify_research",
              status: "done",
              message: `${marketEvidence?.length ?? 0} live competitors found${apifyData.source === "fallback" ? " (Apify unavailable — using fallback)" : ""}`,
            }]);
          } else {
            setStream(s => [...s, {
              stage: "apify_research",
              status: "done",
              message: "Amazon scraper unavailable — pipeline will use LLM-only research",
            }]);
          }
        } catch {
          // Apify optional — don't block generation on scraper failure
          setStream(s => [...s, {
            stage: "apify_research",
            status: "done",
            message: "Skipped — pipeline will run without live competitor data",
          }]);
        }

        const res = await fetch("/api/agents/create-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            brief: opp.prefilledBrief,
            experienceMode: opp.experienceMode,
            giftSku: opp.giftSku,
            giftRecipient: opp.giftSku && opp.giftRecipient ? opp.giftRecipient : undefined,
            yearBranding: true,
            marketEvidence,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finalBookId: number | null = null;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.startsWith("data: ") ? chunk.slice(6) : chunk;
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line) as StageEvent & { bookId?: number };
              setStream(s => [...s, evt]);
              if (evt.stage === "done" && typeof evt.bookId === "number") finalBookId = evt.bookId;
            } catch {
              // tolerate malformed chunks
            }
          }
        }
        setIsRunning(false);
        if (finalBookId != null) {
          setTimeout(() => onDone(finalBookId!), 1200);
        }
      } catch (err) {
        setStream(s => [...s, { stage: "error", status: "failed", message: (err as Error).message }]);
        setIsRunning(false);
      }
    })();

    return () => controller.abort();
  }, [opp, onDone]);

  if (!opp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={isRunning ? undefined : onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border bg-background shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 pb-4 border-b">
          <MiniCover opp={opp} />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Generating</div>
            <div className="font-display font-bold text-lg leading-tight line-clamp-2">{opp.titlePreview}</div>
            <div className="text-xs text-muted-foreground mt-1">{opp.subtitle}</div>
          </div>
        </div>

        <div className="mt-4 max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
          {stream.length === 0 && isRunning && (
            <div className="text-center text-muted-foreground py-6 font-sketch">
              waking up the council…
            </div>
          )}
          {stream.map((e, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className={`flex-shrink-0 w-14 text-[9px] uppercase tracking-widest ${
                e.status === "done" ? "text-emerald-500" : e.status === "failed" ? "text-destructive" : "text-amber-500"
              }`}>
                {e.status}
              </span>
              <span className="text-muted-foreground flex-shrink-0 w-28 truncate text-[10px]">{e.stage}</span>
              <span className="flex-1 text-foreground text-[11px]">{(e.message as string) ?? ""}</span>
            </div>
          ))}
        </div>

        {!isRunning && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — when no persona
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateNoAuthor({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="text-6xl mb-4">✒️</div>
      <h2 className="font-display text-3xl font-bold mb-2">Pick your author</h2>
      <p className="font-sketch text-lg text-muted-foreground mb-6">
        One AI-selected pen name carries every book you publish — builds Amazon author-page authority the way real publishers do.
      </p>
      <Button onClick={onOpen} size="lg">Choose an AI author</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Research Loading
// ─────────────────────────────────────────────────────────────────────────────

function ResearchingState({ personaName }: { personaName: string | null | undefined }) {
  return (
    <div className="text-center py-24">
      <div className="inline-flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🔎</div>
        </div>
        <div>
          <div className="font-display text-xl font-bold">Researching the market</div>
          <div className="font-sketch text-muted-foreground mt-1">
            scanning niches · seasonal windows · avoiding your used combos
          </div>
          {personaName && (
            <div className="text-xs text-muted-foreground mt-2 font-mono uppercase tracking-widest">
              for {personaName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Batch Generation Modal — N parallel SSE streams
// ─────────────────────────────────────────────────────────────────────────────

interface BatchItem {
  opp: Opportunity;
  stream: StageEvent[];
  status: "queued" | "running" | "done" | "failed";
  bookId?: number;
  error?: string;
}

function BatchModal({
  queue,
  onClose,
}: {
  queue: Opportunity[];
  onClose: () => void;
}) {
  const [items, setItems] = useState<BatchItem[]>(queue.map(opp => ({ opp, stream: [], status: "queued" })));
  const [, setLocation] = useLocation();

  useEffect(() => {
    const controllers = queue.map(() => new AbortController());

    queue.forEach((opp, idx) => {
      const ctrl = controllers[idx];
      (async () => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: "running" } : it));
        try {
          // Apify pre-fetch (best-effort, silent)
          let marketEvidence: unknown[] | undefined;
          try {
            const apifyRes = await fetch("/api/apify/market-research", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: ctrl.signal,
              body: JSON.stringify({
                keyword: `${opp.nicheLabel} ${opp.puzzleType}`.toLowerCase(),
                puzzleType: opp.puzzleType,
              }),
            });
            if (apifyRes.ok) {
              const d = await apifyRes.json() as { results?: unknown[] };
              marketEvidence = Array.isArray(d.results) ? d.results.slice(0, 5) : undefined;
            }
          } catch {/* non-fatal */}

          const res = await fetch("/api/agents/create-book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              brief: opp.prefilledBrief,
              experienceMode: opp.experienceMode,
              giftSku: opp.giftSku,
              giftRecipient: opp.giftSku && opp.giftRecipient ? opp.giftRecipient : undefined,
              yearBranding: true,
              marketEvidence,
            }),
          });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let finalBookId: number | null = null;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split("\n\n");
            buf = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const line = chunk.startsWith("data: ") ? chunk.slice(6) : chunk;
              if (!line.trim()) continue;
              try {
                const evt = JSON.parse(line) as StageEvent & { bookId?: number };
                setItems(prev => prev.map((it, i) => i === idx ? { ...it, stream: [...it.stream, evt] } : it));
                if (evt.stage === "done" && typeof evt.bookId === "number") finalBookId = evt.bookId;
              } catch {/* tolerate */}
            }
          }
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: "done", bookId: finalBookId ?? undefined } : it));
        } catch (err) {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: "failed", error: (err as Error).message } : it));
        }
      })();
    });

    return () => controllers.forEach(c => c.abort());
  }, [queue]);

  const allDone = items.every(i => i.status === "done" || i.status === "failed");
  const doneCount = items.filter(i => i.status === "done").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border bg-background shadow-2xl p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Batch Generation</h2>
            <p className="text-sm text-muted-foreground font-sketch mt-0.5">
              {allDone
                ? `${doneCount} of ${items.length} books complete`
                : `${doneCount} of ${items.length} done · ${items.filter(i => i.status === "running").length} running in parallel`}
            </p>
          </div>
          {allDone && <Button onClick={onClose}>Close</Button>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((it, i) => {
            const lastEvent = it.stream[it.stream.length - 1];
            return (
              <div
                key={i}
                className={`rounded-lg border p-4 transition-colors ${
                  it.status === "done" ? "border-emerald-500/40 bg-emerald-500/5"
                  : it.status === "failed" ? "border-destructive/40 bg-destructive/5"
                  : it.status === "running" ? "border-amber-500/40 bg-amber-500/5"
                  : "border-white/10 bg-card/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <MiniCover opp={it.opp} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm leading-tight line-clamp-2">{it.opp.titlePreview}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">{it.opp.nicheLabel}</div>
                    <div className="mt-2 text-[10px] font-mono">
                      {it.status === "queued" && <span className="text-muted-foreground">queued</span>}
                      {it.status === "running" && (
                        <span className="text-amber-500 flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {lastEvent?.stage ?? "starting…"}
                        </span>
                      )}
                      {it.status === "done" && (
                        <span className="text-emerald-500">✓ done · saved</span>
                      )}
                      {it.status === "failed" && (
                        <span className="text-destructive">✗ {it.error?.slice(0, 80) ?? "failed"}</span>
                      )}
                    </div>
                    {it.status === "done" && it.bookId && (
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="sm"
                          className="text-[10px] h-6 px-2 flex-1"
                          onClick={() => setLocation(`/publish/${it.bookId}`)}
                        >
                          Open →
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function AuthorHub() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data: persona, isLoading: personaLoading } = useActivePersona();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [generating, setGenerating] = useState<Opportunity | null>(null);
  const [batchQueue, setBatchQueue] = useState<Opportunity[]>([]);
  const [batchRunning, setBatchRunning] = useState<Opportunity[] | null>(null);

  const query = useQuery({
    queryKey: ["opportunities", persona?.id ?? 0],
    queryFn: fetchOpportunities,
    enabled: Boolean(persona),
    staleTime: 6 * 60 * 60 * 1000,
  });

  async function handleRefresh() {
    await refreshOpportunities();
    await qc.invalidateQueries({ queryKey: ["opportunities"] });
  }

  function handleGenerationDone(bookId: number) {
    setGenerating(null);
    // Navigate to the publish screen — the closer that turns "book saved"
    // into "book on KDP" with download + copy-listing + open-KDP buttons.
    setLocation(`/publish/${bookId}`);
  }

  // No persona yet → Centered CTA
  if (!personaLoading && !persona) {
    return (
      <>
        <EmptyStateNoAuthor onOpen={() => setWizardOpen(true)} />
        <AuthorWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="font-display text-4xl font-bold tracking-tight">Studio</h1>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-xs text-muted-foreground hover:text-amber-500 transition-colors"
          title="Force fresh research"
        >
          ↻ refresh research
        </button>
      </div>
      <p className="font-sketch text-xl text-muted-foreground mb-6">
        What should {persona?.penName} write today?
      </p>

      {query.data?.researchNote && (
        <div className="mb-6 rounded-lg border-l-4 p-3 pl-4 bg-amber-500/5" style={{ borderColor: persona?.signatureColor ?? "#f5c842" }}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Research note</div>
          <div className="text-sm font-sketch">{query.data.researchNote}</div>
        </div>
      )}

      {(personaLoading || query.isLoading) && <ResearchingState personaName={persona?.penName} />}

      {query.isError && (
        <div className="rounded-lg border-destructive/30 border bg-destructive/5 p-4 text-sm">
          <div className="font-semibold text-destructive mb-1">Research failed</div>
          <div className="text-muted-foreground">{(query.error as Error).message}</div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="mt-2">Retry</Button>
        </div>
      )}

      {query.data && query.data.opportunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {query.data.opportunities.map((opp, i) => {
            const isQueued = batchQueue.some(q => q.niche === opp.niche && q.titlePreview === opp.titlePreview);
            return (
              <OpportunityCard
                key={`${opp.niche}-${i}`}
                opp={opp}
                onGenerate={setGenerating}
                isQueued={isQueued}
                onToggleQueue={(o) => setBatchQueue(prev =>
                  prev.some(q => q.niche === o.niche && q.titlePreview === o.titlePreview)
                    ? prev.filter(q => !(q.niche === o.niche && q.titlePreview === o.titlePreview))
                    : [...prev, o],
                )}
              />
            );
          })}
        </div>
      )}

      {/* Floating batch action bar */}
      {batchQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full border bg-background/95 backdrop-blur-md px-5 py-3 shadow-2xl">
          <span className="text-sm font-semibold">
            {batchQueue.length} queued
          </span>
          <button
            type="button"
            onClick={() => setBatchQueue([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            clear
          </button>
          <Button
            size="sm"
            onClick={() => { setBatchRunning(batchQueue); setBatchQueue([]); }}
            className="text-sm font-semibold"
          >
            ✨ Generate all {batchQueue.length} in parallel
          </Button>
        </div>
      )}

      <GenerationModal
        opp={generating}
        onClose={() => setGenerating(null)}
        onDone={handleGenerationDone}
      />
      {batchRunning && (
        <BatchModal
          queue={batchRunning}
          onClose={() => { setBatchRunning(null); qc.invalidateQueries({ queryKey: ["books"] }); }}
        />
      )}
      <AuthorWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

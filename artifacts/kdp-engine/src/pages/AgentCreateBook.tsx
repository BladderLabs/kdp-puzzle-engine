import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const GOLD = "#C8951A";

type StageStatus = "pending" | "running" | "done" | "failed" | "needs_revision";

interface StageConfig {
  id: string;
  label: string;
}

const STAGES: StageConfig[] = [
  { id: "market_scout", label: "Market Scout" },
  { id: "content_architect", label: "Content Architect" },
  { id: "qa_review", label: "QA Reviewer" },
  { id: "cover_art", label: "Cover Art Director" },
  { id: "assemble", label: "Assembling" },
];

interface StageState {
  status: StageStatus;
  message: string;
  data: Record<string, unknown>;
}

interface CompletionInfo {
  bookId: number;
  title: string;
  subtitle?: string;
  puzzleType?: string;
  puzzleCount?: number;
  theme?: string;
  hasCoverImage: boolean;
  qaFailed: boolean;
  descWordCount?: number;
}

const initStages = (): Record<string, StageState> =>
  Object.fromEntries(STAGES.map(s => [s.id, { status: "pending" as StageStatus, message: "", data: {} }]));

function StageRow({ stage, state }: { stage: StageConfig; state: StageState }) {
  const icon =
    state.status === "done" ? (
      <span style={{ color: "#22c55e", fontSize: 18 }}>✓</span>
    ) : state.status === "failed" ? (
      <span style={{ color: "#ef4444", fontSize: 18 }}>✕</span>
    ) : state.status === "running" || state.status === "needs_revision" ? (
      <span style={{ color: GOLD, fontSize: 16, animation: "spin 1s linear infinite" }}>↻</span>
    ) : (
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>○</span>
    );

  const labelColor =
    state.status === "running" || state.status === "needs_revision"
      ? GOLD
      : state.status === "done"
      ? "#22c55e"
      : state.status === "failed"
      ? "#ef4444"
      : "rgba(255,255,255,0.35)";

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: labelColor }}>
            {stage.label}
          </span>
          {state.status === "needs_revision" && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
              Revising
            </span>
          )}
        </div>
        {state.message && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {state.message}
          </p>
        )}
        {state.status === "done" && state.data.title && (
          <p className="text-xs mt-1 italic" style={{ color: "rgba(255,255,255,0.55)" }}>
            "{String(state.data.title)}"
          </p>
        )}
      </div>
    </div>
  );
}

export function AgentCreateBook() {
  const [, setLocation] = useLocation();
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<string, StageState>>(initStages);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const briefRef = useRef<string>("");

  const updateStage = useCallback((stageId: string, patch: Partial<Omit<StageState, "data">> & { data?: Record<string, unknown> }) => {
    setStages(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        ...patch,
        data: { ...prev[stageId]?.data, ...(patch.data ?? {}) },
      },
    }));
  }, []);

  const runPipeline = useCallback(async (currentBrief: string) => {
    setRunning(true);
    setError(null);
    setCompletion(null);
    setStages(initStages());

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/agents/create-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: currentBrief.trim() || undefined }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done_flag = false;

      while (!done_flag) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.stage === "done" && typeof event.bookId === "number") {
              setCompletion({
                bookId: event.bookId,
                title: typeof event.title === "string" ? event.title : "",
                subtitle: typeof event.subtitle === "string" ? event.subtitle : undefined,
                puzzleType: typeof event.puzzleType === "string" ? event.puzzleType : undefined,
                puzzleCount: typeof event.puzzleCount === "number" ? event.puzzleCount : undefined,
                theme: typeof event.theme === "string" ? event.theme : undefined,
                hasCoverImage: event.hasCoverImage === true,
                qaFailed: event.qaFailed === true,
                descWordCount: typeof event.descWordCount === "number" ? event.descWordCount : undefined,
              });
              done_flag = true;
              break;
            }

            if (event.stage === "error") {
              setError(typeof event.message === "string" ? event.message : "Pipeline error. Please retry.");
              done_flag = true;
              break;
            }

            if (typeof event.stage === "string" && typeof event.status === "string") {
              const { stage, status, message, ...rest } = event;
              updateStage(stage as string, {
                status: status as StageStatus,
                message: typeof message === "string" ? message : "",
                data: rest as Record<string, unknown>,
              });
            }
          } catch {
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError((err as Error).message ?? "Connection error. Please retry.");
      }
    } finally {
      setRunning(false);
    }
  }, [updateStage]);

  const handleStart = () => {
    briefRef.current = brief;
    runPipeline(brief);
  };

  const handleRegenerate = () => {
    runPipeline(briefRef.current);
  };

  const handleFullReset = () => {
    abortRef.current?.abort();
    setRunning(false);
    setStages(initStages());
    setError(null);
    setCompletion(null);
    setBrief("");
    briefRef.current = "";
  };

  const isComplete = completion !== null && !running;
  const hasError = !!error && !running;

  return (
    <div className="min-h-screen">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div style={{ fontSize: 42, lineHeight: 1.2 }}>🧠</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Book Creator</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Four AI agents research the market, craft your content, generate cover art, and save your book — in under 90 seconds.
          </p>
        </div>

        {/* Input card — only show when idle and not yet complete */}
        {!running && !isComplete && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>
                Book idea{" "}
                <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  (optional — leave blank for AI-driven market choice)
                </span>
              </label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="e.g. 'A large-print word search book for cat lovers' or 'Something popular for Christmas gifts'"
                className="w-full rounded-xl p-3 text-sm resize-none"
                rows={3}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.80)",
                  outline: "none",
                }}
                maxLength={300}
              />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                {brief.length}/300 characters
              </p>
            </div>

            {hasError && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl text-black font-bold text-base transition-all duration-150"
              style={{ background: GOLD, boxShadow: `0 4px 20px ${GOLD}30` }}
            >
              🧠 Start AI Pipeline
            </button>

            <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Uses Replit AI credits · Market Scout → Content Architect → QA → Cover Art → Assemble
            </p>
          </div>
        )}

        {/* Pipeline progress — show while running or after any non-fresh state */}
        {(running || isComplete || hasError) && (
          <div
            className="rounded-2xl p-6"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2 className="text-xs font-bold mb-4 uppercase tracking-widest" style={{ color: GOLD + "99" }}>
              Pipeline Progress
            </h2>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {STAGES.map(stage => (
                <StageRow key={stage.id} stage={stage} state={stages[stage.id]} />
              ))}
            </div>

            {hasError && (
              <div className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Completion card */}
        {isComplete && completion && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${GOLD}44`, background: GOLD + "08" }}
          >
            <div className="px-6 py-4" style={{ background: GOLD + "15", borderBottom: `1px solid ${GOLD}30` }}>
              <div className="flex items-center gap-2">
                <span style={{ color: GOLD, fontSize: 20 }}>◆</span>
                <h2 className="font-bold" style={{ color: GOLD }}>Book Created!</h2>
                {completion.qaFailed && (
                  <span className="text-xs px-2 py-0.5 rounded ml-auto" style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                    QA partial
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 font-semibold text-white/90 leading-snug">"{completion.title}"</p>
              {completion.subtitle && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>{completion.subtitle}</p>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Spec details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {completion.puzzleType && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Type</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.puzzleType}</p>
                  </div>
                )}
                {completion.puzzleCount !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Puzzles</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.puzzleCount}</p>
                  </div>
                )}
                {completion.theme && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Theme</span>
                    <p className="font-semibold text-white/80 mt-0.5 capitalize">{completion.theme}</p>
                  </div>
                )}
                {completion.descWordCount !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Description</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.descWordCount} words</p>
                  </div>
                )}
              </div>

              {/* Cover art indicator */}
              <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ color: completion.hasCoverImage ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                  {completion.hasCoverImage ? "✓" : "○"}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  {completion.hasCoverImage ? "AI-generated cover art saved" : "SVG theme art (no AI cover)"}
                </span>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-1">
                <button
                  onClick={() => setLocation(`/books/${completion.bookId}`)}
                  className="w-full py-3 rounded-xl text-black font-bold text-sm transition-all"
                  style={{ background: GOLD, boxShadow: `0 4px 16px ${GOLD}30` }}
                >
                  Open &amp; Edit Book →
                </button>
                <button
                  onClick={() => setLocation(`/generate/${completion.bookId}`)}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: "transparent", border: `1px solid ${GOLD}66`, color: GOLD }}
                >
                  Generate PDFs →
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={running}
                  className="w-full py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}
                >
                  ↺ Regenerate (new variation)
                </button>
                <button
                  onClick={handleFullReset}
                  className="w-full py-2 text-xs transition-all"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  Start over with new brief
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel button while running */}
        {running && (
          <div className="text-center">
            <button
              onClick={() => { abortRef.current?.abort(); setRunning(false); }}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error retry */}
        {hasError && (
          <div className="text-center space-y-2">
            <button
              onClick={() => runPipeline(briefRef.current)}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: GOLD + "22", border: `1px solid ${GOLD}55`, color: GOLD }}
            >
              Retry Pipeline
            </button>
          </div>
        )}

        {/* Back link */}
        {!running && (
          <div className="text-center">
            <button
              onClick={() => setLocation("/")}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

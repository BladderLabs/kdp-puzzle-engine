import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const GOLD = "#C8951A";

type StageStatus = "pending" | "running" | "done" | "failed" | "needs_revision";

interface Stage {
  id: string;
  label: string;
  runningMsg: string;
  doneMsg: string;
}

const STAGES: Stage[] = [
  { id: "market_scout", label: "Market Scout", runningMsg: "Scanning KDP niches…", doneMsg: "Opportunity identified" },
  { id: "content_architect", label: "Content Architect", runningMsg: "Crafting title & description…", doneMsg: "Content ready" },
  { id: "cover_art", label: "Cover Art Director", runningMsg: "Generating AI illustration…", doneMsg: "Cover art created" },
  { id: "qa_review", label: "QA Reviewer", runningMsg: "Running quality checks…", doneMsg: "Quality approved" },
  { id: "assemble", label: "Assembling", runningMsg: "Saving to your library…", doneMsg: "Book saved!" },
];

interface StageState {
  status: StageStatus;
  message: string;
  data: Record<string, unknown>;
}

const initStages = (): Record<string, StageState> =>
  Object.fromEntries(STAGES.map(s => [s.id, { status: "pending", message: "", data: {} }]));

function StageRow({ stage, state }: { stage: Stage; state: StageState }) {
  const icon =
    state.status === "done" ? (
      <span style={{ color: "#22c55e", fontSize: 18 }}>✓</span>
    ) : state.status === "failed" ? (
      <span style={{ color: "#ef4444", fontSize: 18 }}>✕</span>
    ) : state.status === "running" || state.status === "needs_revision" ? (
      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke={GOLD} strokeWidth="4" />
        <path className="opacity-75" fill={GOLD} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
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
    <div className="flex items-start gap-3 py-2">
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
          <p className="text-xs mt-1 font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
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
  const [completedBookId, setCompletedBookId] = useState<number | null>(null);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateStage = useCallback((stageId: string, patch: Partial<StageState> & { data?: Record<string, unknown> }) => {
    setStages(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        ...patch,
        data: { ...prev[stageId]?.data, ...(patch.data ?? {}) },
      },
    }));
  }, []);

  const handleStart = async () => {
    setRunning(true);
    setError(null);
    setCompletedBookId(null);
    setCompletedTitle(null);
    setCoverDataUrl(null);
    setStages(initStages());

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/agents/create-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() || undefined }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              stage?: string;
              status?: string;
              message?: string;
              bookId?: number;
              title?: string;
              imagePreview?: string;
              [key: string]: unknown;
            };

            if (event.stage === "done" && event.bookId) {
              setCompletedBookId(event.bookId as number);
              setCompletedTitle(event.title as string ?? null);
              break;
            }

            if (event.stage === "error") {
              setError(event.message as string ?? "Pipeline error. Please retry.");
              break;
            }

            if (event.stage && event.status) {
              const { stage, status, message, imagePreview, ...rest } = event;
              updateStage(stage as string, {
                status: status as StageStatus,
                message: (message as string) ?? "",
                data: rest as Record<string, unknown>,
              });

              if (stage === "cover_art" && status === "done" && event.hasImage && typeof event.imagePreview === "string") {
                const fullDataUrl = event.imagePreview as string;
                if (fullDataUrl.startsWith("data:")) {
                  setCoverDataUrl(fullDataUrl);
                }
              }
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
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setRunning(false);
    setStages(initStages());
    setError(null);
    setCompletedBookId(null);
    setCompletedTitle(null);
    setCoverDataUrl(null);
    setBrief("");
  };

  const isComplete = completedBookId !== null && !running;
  const hasError = !!error && !running;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div style={{ fontSize: 42, lineHeight: 1.2 }}>🧠</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Book Creator</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Four AI agents research the market, craft your content, generate cover art, and save your book — in under 90 seconds.
          </p>
        </div>

        {/* Input card */}
        {!running && !isComplete && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>
                Book idea <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — leave blank for AI-driven market choice)</span>
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
                disabled={running}
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
              disabled={running}
              className="w-full py-3.5 rounded-xl text-black font-bold text-base transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: running ? GOLD + "88" : GOLD, boxShadow: `0 4px 20px ${GOLD}30` }}
            >
              🧠 Start AI Pipeline
            </button>

            <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Uses Replit AI credits · Market Scout → Content Architect → Cover Art Director → QA Reviewer
            </p>
          </div>
        )}

        {/* Pipeline progress */}
        {(running || isComplete || hasError) && (
          <div
            className="rounded-2xl p-6"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2 className="text-sm font-bold mb-4" style={{ color: GOLD + "cc", letterSpacing: "0.05em" }}>
              PIPELINE PROGRESS
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
        {isComplete && completedBookId && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${GOLD}44`, background: GOLD + "08" }}
          >
            <div className="px-6 py-4" style={{ background: GOLD + "15", borderBottom: `1px solid ${GOLD}30` }}>
              <div className="flex items-center gap-2">
                <span style={{ color: GOLD, fontSize: 20 }}>◆</span>
                <h2 className="font-bold" style={{ color: GOLD }}>Book Created!</h2>
              </div>
              {completedTitle && (
                <p className="text-sm mt-1 font-medium text-white/80 line-clamp-2">"{completedTitle}"</p>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Cover preview */}
              {coverDataUrl && (
                <div className="flex justify-center">
                  <img
                    src={coverDataUrl}
                    alt="AI-generated cover art"
                    className="rounded-xl shadow-lg"
                    style={{ maxWidth: 200, maxHeight: 280, objectFit: "cover", border: `1px solid ${GOLD}44` }}
                  />
                </div>
              )}

              {/* Stage summary */}
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(stage => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{ background: "#22c55e10", border: "1px solid #22c55e22" }}
                  >
                    <span style={{ color: "#22c55e" }}>✓</span>
                    <span style={{ color: "rgba(255,255,255,0.60)" }}>{stage.label}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-1">
                <button
                  onClick={() => setLocation(`/books/${completedBookId}`)}
                  className="w-full py-3 rounded-xl text-black font-bold text-sm transition-all"
                  style={{ background: GOLD, boxShadow: `0 4px 16px ${GOLD}30` }}
                >
                  Open & Edit Book →
                </button>
                <button
                  onClick={() => setLocation(`/generate/${completedBookId}`)}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: "transparent", border: `1px solid ${GOLD}66`, color: GOLD }}
                >
                  Generate PDFs →
                </button>
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}
                >
                  Regenerate (new variation)
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
              className="text-sm underline-offset-2 hover:underline transition-colors"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              Cancel
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

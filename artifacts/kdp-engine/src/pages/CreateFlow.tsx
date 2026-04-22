import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AuthorWizard, useActivePersona } from "@/components/author/AuthorWizard";

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

const PUZZLE_TYPES = ["Word Search", "Sudoku", "Maze", "Number Search", "Cryptogram", "Crossword"] as const;
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

const EXPERIENCE_MODES = [
  { value: "standard",     label: "Standard",           desc: "Classic puzzle book",      icon: "📚", accent: "#b8860b" },
  { value: "sketch",       label: "Sketch Journey",     desc: "Hand-drawn aesthetic",     icon: "✏️", accent: "#8b6b3a" },
  { value: "detective",    label: "Detective Casebook", desc: "Mystery theme",            icon: "🔍", accent: "#3b0a0a" },
  { value: "adventure",    label: "Adventure Quest",    desc: "Epic adventure theme",     icon: "⚔️", accent: "#7b3a00" },
  { value: "darkacademia", label: "Dark Academia",      desc: "Gothic scholar aesthetic", icon: "📜", accent: "#2a1a4a" },
  { value: "cozycottage",  label: "Cozy Cottage",       desc: "Warm hearth + tea vibes",  icon: "🫖", accent: "#a65c3a" },
  { value: "mindful",      label: "Mindful Wellness",   desc: "Stress-relief aesthetic",  icon: "🌿", accent: "#6b8e6b" },
];

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

const COVER_STYLES = [
  { value: "classic",   label: "Classic",   icon: "🎨" },
  { value: "geometric", label: "Geometric", icon: "◆"  },
  { value: "luxury",    label: "Luxury",    icon: "✦"  },
  { value: "bold",      label: "Bold",      icon: "⬛" },
  { value: "minimal",   label: "Minimal",   icon: "○"  },
  { value: "retro",     label: "Retro",     icon: "⌛" },
  { value: "warmth",    label: "Warmth",    icon: "☀"  },
  { value: "photo",     label: "Photo",     icon: "📷" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Flow state
// ─────────────────────────────────────────────────────────────────────────────

interface FlowState {
  // Step 1 — Intent
  brief: string;
  puzzleType: string;
  nicheHint: string;
  puzzleCount: number;
  difficulty: string;
  largePrint: boolean;
  // Step 2 — Aesthetic
  experienceMode: string;
  theme: string;
  coverStyle: string;
  // Step 3 — Packaging
  yearBranding: boolean;
  giftSku: boolean;
  giftRecipient: string;
  seriesName: string;
}

const INITIAL_STATE: FlowState = {
  brief: "",
  puzzleType: "Word Search",
  nicheHint: "",
  puzzleCount: 100,
  difficulty: "Medium",
  largePrint: true,
  experienceMode: "standard",
  theme: "midnight",
  coverStyle: "classic",
  yearBranding: true,
  giftSku: false,
  giftRecipient: "",
  seriesName: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "intent",    label: "Intent",    desc: "What are we making?" },
  { key: "aesthetic", label: "Aesthetic", desc: "How should it feel?" },
  { key: "packaging", label: "Packaging", desc: "Who's it for?" },
  { key: "review",    label: "Review",    desc: "Generate" },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                  active
                    ? "bg-amber-500 text-black border-amber-500 scale-110"
                    : done
                      ? "bg-amber-500/20 text-amber-500 border-amber-500/60"
                      : "bg-transparent text-muted-foreground border-border"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </div>
                <div className="text-[10px] text-muted-foreground font-sketch">{step.desc}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-[1px] flex-shrink-0 w-6 mx-2 ${done ? "bg-amber-500/60" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Intent
// ─────────────────────────────────────────────────────────────────────────────

function StepIntent({ state, set }: { state: FlowState; set: (s: Partial<FlowState>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="brief">Short brief <span className="text-muted-foreground font-normal">(optional — a sentence or two lets the AI pick the niche)</span></Label>
        <Textarea
          id="brief"
          className="h-20 mt-1 text-sm"
          placeholder="e.g. Mother's Day gift book for Grandma, large print, cozy theme"
          value={state.brief}
          onChange={e => set({ brief: e.target.value })}
        />
      </div>

      <div>
        <Label>Puzzle type</Label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {PUZZLE_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set({ puzzleType: t })}
              className={`py-2.5 text-sm rounded-lg border transition-all ${
                state.puzzleType === t
                  ? "bg-amber-500 text-black border-amber-500 font-semibold shadow-sm"
                  : "border-border text-muted-foreground hover:border-amber-500/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="count">Puzzle count</Label>
          <Input
            id="count"
            type="number"
            className="mt-1"
            value={state.puzzleCount}
            onChange={e => set({ puzzleCount: Number(e.target.value) || 100 })}
          />
        </div>
        <div>
          <Label>Difficulty</Label>
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => set({ difficulty: d })}
                className={`py-2 text-xs rounded-md border transition-colors ${
                  state.difficulty === d
                    ? "bg-amber-500 text-black border-amber-500 font-semibold"
                    : "border-border text-muted-foreground hover:border-amber-500/40"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <div className="text-sm font-medium">Large Print Edition</div>
          <div className="text-xs text-muted-foreground">8.5" × 11" — preferred for seniors + gift market</div>
        </div>
        <Switch checked={state.largePrint} onCheckedChange={v => set({ largePrint: v })} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Aesthetic
// ─────────────────────────────────────────────────────────────────────────────

function StepAesthetic({ state, set }: { state: FlowState; set: (s: Partial<FlowState>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Experience Mode <span className="text-muted-foreground font-normal">— the book's soul</span></Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {EXPERIENCE_MODES.map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => set({ experienceMode: mode.value })}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                state.experienceMode === mode.value
                  ? "border-amber-500 bg-amber-500/10 shadow-sm"
                  : "border-border hover:border-amber-500/40"
              }`}
            >
              <span className="text-2xl leading-none mt-0.5">{mode.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{mode.label}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{mode.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Cover Theme</Label>
        <div className="grid grid-cols-5 gap-1.5 mt-1.5">
          {THEMES.map(t => (
            <button
              key={t.value}
              type="button"
              title={t.label}
              onClick={() => set({ theme: t.value })}
              className={`flex flex-col items-center gap-1 rounded-md p-1.5 border transition-all ${
                state.theme === t.value
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-border hover:border-amber-500/40"
              }`}
            >
              <span
                className="w-7 h-7 rounded-full ring-1 ring-white/10"
                style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.ac} 50%)` }}
              />
              <span className="text-[9px] text-muted-foreground leading-tight text-center line-clamp-1">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Cover Style</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {COVER_STYLES.map(cs => (
            <button
              key={cs.value}
              type="button"
              onClick={() => set({ coverStyle: cs.value })}
              className={`py-2.5 text-xs rounded-md border transition-colors flex flex-col items-center gap-0.5 ${
                state.coverStyle === cs.value
                  ? "bg-amber-500 text-black border-amber-500 font-semibold"
                  : "border-border text-muted-foreground hover:border-amber-500/40"
              }`}
            >
              <span className="text-base leading-none">{cs.icon}</span>
              <span>{cs.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Packaging
// ─────────────────────────────────────────────────────────────────────────────

function StepPackaging({ state, set }: { state: FlowState; set: (s: Partial<FlowState>) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <div className="text-sm font-medium">Year-brand the title</div>
          <div className="text-xs text-muted-foreground">Auto-adds "2026" (or "2027" after October). Every bestseller has it.</div>
        </div>
        <Switch checked={state.yearBranding} onCheckedChange={v => set({ yearBranding: v })} />
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Gift SKU mode</div>
            <div className="text-xs text-muted-foreground">Ribbon on cover, gift-tag insert, gift keywords, recipient framing.</div>
          </div>
          <Switch checked={state.giftSku} onCheckedChange={v => set({ giftSku: v })} />
        </div>
        {state.giftSku && (
          <div className="pt-2 border-t">
            <Label htmlFor="recipient">Recipient (for "A thoughtful gift for…")</Label>
            <Input
              id="recipient"
              className="mt-1"
              placeholder="Mom / Grandma / Dad / Teacher"
              value={state.giftRecipient}
              onChange={e => set({ giftRecipient: e.target.value })}
            />
            <div className="text-[11px] text-muted-foreground mt-1.5 font-sketch">
              Used in back-cover hook, gift tag page, and keyword boosting.
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="series">Series Name <span className="text-muted-foreground font-normal">(optional — leave blank for a standalone)</span></Label>
        <Input
          id="series"
          className="mt-1"
          placeholder="e.g. Brain Boost Series"
          value={state.seriesName}
          onChange={e => set({ seriesName: e.target.value })}
        />
        <div className="text-[11px] text-muted-foreground mt-1.5 font-sketch">
          If set, this book becomes Vol N of the series (auto-incremented from the highest existing volume).
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Review + Generate (with SSE progress)
// ─────────────────────────────────────────────────────────────────────────────

interface StageEvent {
  stage: string;
  status: string;
  message?: string;
  [k: string]: unknown;
}

function StepReview({
  state,
  stream,
  isGenerating,
  onGenerate,
}: {
  state: FlowState;
  stream: StageEvent[];
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const { data: persona } = useActivePersona();
  const mode = EXPERIENCE_MODES.find(m => m.value === state.experienceMode);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Type" value={state.puzzleType} detail={`${state.puzzleCount} · ${state.difficulty}${state.largePrint ? " · Large Print" : ""}`} />
        <SummaryCard label="Experience" value={mode?.label || state.experienceMode} detail={mode?.desc} icon={mode?.icon} />
        <SummaryCard label="Aesthetic" value={state.theme} detail={`${state.coverStyle} style`} />
        <SummaryCard
          label="Packaging"
          value={state.giftSku ? `Gift${state.giftRecipient ? ` for ${state.giftRecipient}` : ""}` : "Standard"}
          detail={`${state.yearBranding ? "Year-branded" : "No year"}${state.seriesName ? ` · ${state.seriesName}` : ""}`}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Publishing under</div>
        {persona ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0" dangerouslySetInnerHTML={{ __html: persona.monogramSvg }} />
            <div>
              <div className="font-display text-lg font-bold" style={{ color: persona.signatureColor }}>
                {persona.penName}
              </div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Voice: {persona.voiceTone}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No active author persona. Pipeline will use the Content Architect's fallback.
            <span className="font-sketch block mt-1">Set one in the header button for better Amazon author-page authority.</span>
          </div>
        )}
      </div>

      {stream.length > 0 && (
        <div className="rounded-lg border bg-white/[0.02] p-4 max-h-80 overflow-y-auto space-y-1.5 font-mono text-xs">
          {stream.map((e, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className={`flex-shrink-0 w-16 uppercase tracking-widest text-[10px] ${
                e.status === "done" ? "text-emerald-500" : e.status === "failed" ? "text-destructive" : "text-amber-500"
              }`}>
                {e.status}
              </span>
              <span className="text-muted-foreground flex-shrink-0 w-32 truncate">{e.stage}</span>
              <span className="flex-1 text-foreground">{(e.message as string) ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        size="lg"
        className="w-full text-base"
      >
        {isGenerating ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating — 14 stages in progress…
          </span>
        ) : (
          "✨ Generate Advanced Book"
        )}
      </Button>
    </div>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-0.5">
        {icon && <span className="text-lg">{icon}</span>}
        <div className="font-semibold capitalize">{value}</div>
      </div>
      {detail && <div className="text-[11px] text-muted-foreground mt-0.5 font-sketch">{detail}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function CreateFlow() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<FlowState>(INITIAL_STATE);
  const [stream, setStream] = useState<StageEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const set = (patch: Partial<FlowState>) => setState(s => ({ ...s, ...patch }));

  function next() { setStep(s => Math.min(STEPS.length - 1, s + 1)); }
  function back() { setStep(s => Math.max(0, s - 1)); }

  const canAdvance = useMemo(() => {
    if (step === 0) return state.puzzleType && state.puzzleCount > 0 && state.difficulty;
    if (step === 1) return state.experienceMode && state.theme && state.coverStyle;
    if (step === 2) {
      if (state.giftSku && !state.giftRecipient.trim()) return false;
      return true;
    }
    return true;
  }, [step, state]);

  async function generate() {
    setStream([]);
    setIsGenerating(true);
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/agents/create-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          brief: buildBrief(state),
          experienceMode: state.experienceMode,
          giftSku: state.giftSku,
          giftRecipient: state.giftSku ? state.giftRecipient : undefined,
          yearBranding: state.yearBranding,
          seriesName: state.seriesName || undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
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
            if (evt.stage === "done" && typeof evt.bookId === "number") {
              finalBookId = evt.bookId;
            }
          } catch {
            // tolerate malformed chunk
          }
        }
      }
      if (finalBookId != null) {
        setTimeout(() => setLocation(`/books/${finalBookId}`), 1400);
      }
    } catch (err) {
      setStream(s => [...s, { stage: "error", status: "failed", message: (err as Error).message }]);
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl font-bold tracking-tight">New Book</h1>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="text-xs text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline"
          >
            Change author
          </button>
        </div>
        <p className="font-sketch text-lg text-muted-foreground mt-1">
          Four steps, one advanced book, fully wired for KDP.
        </p>
      </div>

      <Stepper current={step} />

      <div className="rounded-xl border bg-card/40 p-6 min-h-[400px]">
        {step === 0 && <StepIntent state={state} set={set} />}
        {step === 1 && <StepAesthetic state={state} set={set} />}
        {step === 2 && <StepPackaging state={state} set={set} />}
        {step === 3 && <StepReview state={state} stream={stream} isGenerating={isGenerating} onGenerate={generate} />}
      </div>

      {step < STEPS.length - 1 && (
        <div className="flex justify-between mt-5">
          <Button variant="ghost" onClick={back} disabled={step === 0}>← Back</Button>
          <Button onClick={next} disabled={!canAdvance}>Next →</Button>
        </div>
      )}

      {step === STEPS.length - 1 && !isGenerating && (
        <div className="flex justify-start mt-5">
          <Button variant="ghost" onClick={back}>← Back</Button>
        </div>
      )}

      <AuthorWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function buildBrief(state: FlowState): string {
  const parts: string[] = [];
  if (state.brief.trim()) parts.push(state.brief.trim());
  parts.push(`${state.puzzleCount} ${state.difficulty} ${state.puzzleType} puzzles`);
  if (state.largePrint) parts.push("large print edition");
  if (state.giftSku && state.giftRecipient) parts.push(`gift for ${state.giftRecipient}`);
  if (state.seriesName) parts.push(`continuation of "${state.seriesName}" series`);
  return parts.join(" — ");
}

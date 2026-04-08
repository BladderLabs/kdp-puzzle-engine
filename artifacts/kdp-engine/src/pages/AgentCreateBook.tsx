import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const GOLD = "#C8951A";

type StageStatus = "pending" | "running" | "done" | "failed" | "needs_revision";

interface StageConfig {
  id: string;
  label: string;
  subLabel?: string;
  isGroup?: boolean;
}

const STAGES: StageConfig[] = [
  { id: "market_scout", label: "Market Intelligence Council", subLabel: "Opportunity · Competition · Director" },
  { id: "content_architect", label: "Content Architect" },
  { id: "content_council", label: "Content Excellence Council", subLabel: "Title · Copy · Keywords" },
  { id: "cover_research", label: "Cover Design Council", subLabel: "Design · Color · Typography" },
  { id: "puzzle_council", label: "Puzzle Production Council", subLabel: "Difficulty · Layout" },
  { id: "interior_council", label: "Interior Design Council", subLabel: "Typography · Margins" },
  { id: "production_council", label: "Production & Pricing Council", subLabel: "Format · Price" },
  { id: "master_director", label: "Master Book Director", subLabel: "Synthesising all councils" },
  { id: "cover_art", label: "Cover Art Director" },
  { id: "qa_review", label: "QA Reviewer" },
  { id: "assemble", label: "Assembling" },
];

const COUNCIL_IDS = new Set([
  "market_scout", "content_council", "cover_research", "puzzle_council", "interior_council", "production_council"
]);

interface StageState {
  status: StageStatus;
  message: string;
  data: Record<string, unknown>;
}

interface QAIssue {
  field: string;
  problem: string;
  fix: string;
}

interface VolumeProposal {
  volumeNumber: number;
  title: string;
  subtitle: string;
  angle: string;
  wordCategory: string;
  difficulty: string;
  largePrint: boolean;
  theme: string;
  keyDifferentiator: string;
  suggestedSeriesName: string;
}

interface SeriesArc {
  seriesName: string;
  seriesTheme: string;
  volumes: VolumeProposal[];
  seriesRationale: string;
}

interface BookIntelligence {
  councilSummary: string;
  overallRationale: string;
  conflictsResolved: string[];
  recommendedPrice: number;
  royaltyEstimate: number;
  pricingNotes: string;
  coverRationale: string;
  puzzleQualityNotes: string;
  difficultyDescriptor: string;
}

interface CompletionInfo {
  bookId: number;
  title: string;
  subtitle?: string;
  puzzleType?: string;
  puzzleCount?: number;
  theme?: string;
  hasCoverImage: boolean;
  coverDataUrl?: string;
  qaFailed: boolean;
  qaPassed: boolean;
  qaIssues: QAIssue[];
  descWordCount?: number;
  bookIntelligence?: BookIntelligence | null;
  seriesArc?: SeriesArc | null;
}

const initStages = (): Record<string, StageState> =>
  Object.fromEntries(STAGES.map(s => [s.id, { status: "pending" as StageStatus, message: "", data: {} }]));

function StageRow({ stage, state }: { stage: StageConfig; state: StageState }) {
  const isCouncil = COUNCIL_IDS.has(stage.id) || stage.id === "master_director";

  const icon =
    state.status === "done" ? (
      <span style={{ color: "#22c55e", fontSize: 18 }}>✓</span>
    ) : state.status === "failed" ? (
      <span style={{ color: "#ef4444", fontSize: 18 }}>✕</span>
    ) : state.status === "running" || state.status === "needs_revision" ? (
      <span
        style={{
          color: GOLD,
          fontSize: 16,
          display: "inline-block",
          animation: "kdp-spin 1s linear infinite",
        }}
      >
        ↻
      </span>
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

  const bgStyle = isCouncil && state.status !== "pending"
    ? { background: "rgba(200,149,26,0.03)", borderLeft: `2px solid ${GOLD}22`, paddingLeft: 8, borderRadius: 4 }
    : {};

  return (
    <div className="flex items-start gap-3 py-2" style={bgStyle}>
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: labelColor }}>
            {stage.label}
          </span>
          {stage.subLabel && state.status !== "pending" && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              {stage.subLabel}
            </span>
          )}
          {state.status === "needs_revision" && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}
            >
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
        {/* Market Intelligence Council done details */}
        {state.status === "done" && stage.id === "market_scout" && state.data.winnerRationale && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.40)", fontStyle: "italic" }}>
            {String(state.data.winnerRationale)}
          </p>
        )}
        {/* Council-specific done details */}
        {state.status === "done" && stage.id === "cover_research" && state.data.theme && (
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
              {String(state.data.theme)} theme
            </span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
              {String(state.data.style)} style
            </span>
            {state.data.accentHex && (
              <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: String(state.data.accentHex), display: "inline-block" }} />
                {String(state.data.accentHex)}
              </span>
            )}
          </div>
        )}
        {state.status === "done" && stage.id === "production_council" && state.data.recommendedPrice && (
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            ${String(state.data.recommendedPrice)} · {String(state.data.paperType)} paper · ~${Number(state.data.royaltyEstimate).toFixed(2)} royalty
          </p>
        )}
        {state.status === "done" && stage.id === "master_director" && state.data.conflictsResolved && (
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            {(state.data.conflictsResolved as string[]).length > 0
              ? `Resolved: ${(state.data.conflictsResolved as string[]).join(" · ")}`
              : "No cross-council conflicts"}
          </p>
        )}
      </div>
    </div>
  );
}

const QA_CHECKS: Array<{ label: string; field: string }> = [
  { label: "Title has 6+ words and is keyword-rich", field: "title" },
  { label: "Subtitle is a compelling benefit statement (8+ words)", field: "subtitle" },
  { label: "Back description has 80+ words of sales copy", field: "backDescription" },
  { label: "Puzzle count is 50 or more", field: "puzzleCount" },
  { label: "Exactly 7 keywords provided", field: "keywords" },
  { label: "No placeholder or generic text detected", field: "placeholder" },
  { label: "Cover combination is unique in your library", field: "cover_combination" },
];

function QAChecklist({ issues, passed }: { issues: QAIssue[]; passed: boolean }) {
  const failedFields = new Set(issues.map(i => i.field));
  const checkResults = QA_CHECKS.map(({ label, field }) => {
    const isFailed = failedFields.has(field);
    const issue = issues.find(i => i.field === field);
    return { label, isFailed, issue };
  });

  return (
    <div className="space-y-1.5">
      {checkResults.map(({ label, isFailed, issue }, idx) => (
        <div key={idx} className="text-xs">
          <div className="flex items-start gap-2">
            <span style={{ color: isFailed ? "#ef4444" : "#22c55e", flexShrink: 0, marginTop: 1 }}>
              {isFailed ? "✕" : "✓"}
            </span>
            <span style={{ color: isFailed ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.45)" }}>
              {label}
            </span>
          </div>
          {issue && (
            <p className="ml-5 mt-0.5" style={{ color: "#f59e0b", fontStyle: "italic" }}>
              {issue.problem}
            </p>
          )}
        </div>
      ))}
      {passed && (
        <p className="text-xs mt-1 ml-5" style={{ color: "#22c55e" }}>
          All quality checks passed ✓
        </p>
      )}
    </div>
  );
}

function BookIntelligenceReport({ intel }: { intel: BookIntelligence }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${GOLD}30`, background: `${GOLD}08` }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
        style={{ background: `${GOLD}10` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: GOLD, fontSize: 14 }}>◆</span>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            Book Intelligence Report
          </span>
        </div>
        <span className="text-xs" style={{ color: `${GOLD}80` }}>{expanded ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-4">
          {/* Summary */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Council Summary</p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.60)" }}>{intel.councilSummary}</p>
          </div>

          {/* Why this book will sell */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Market Rationale</p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.60)" }}>{intel.overallRationale}</p>
          </div>

          {/* Pricing */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Pricing Strategy</p>
            <div className="flex gap-3 mb-1">
              <div className="rounded-lg px-3 py-2 flex-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Recommended Price</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "#22c55e" }}>${intel.recommendedPrice}</p>
              </div>
              <div className="rounded-lg px-3 py-2 flex-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Est. Royalty</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "#22c55e" }}>${intel.royaltyEstimate.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>{intel.pricingNotes}</p>
          </div>

          {/* Cover rationale */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Cover Design Rationale</p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.60)" }}>{intel.coverRationale}</p>
          </div>

          {/* Puzzle quality */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Puzzle Quality Spec</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>
              <span style={{ color: "rgba(255,255,255,0.30)" }}>Difficulty: </span>
              {intel.difficultyDescriptor}
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>{intel.puzzleQualityNotes}</p>
          </div>

          {/* Conflicts resolved */}
          {intel.conflictsResolved.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>Conflicts Resolved by Director</p>
              <ul className="space-y-1">
                {intel.conflictsResolved.map((c, i) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: "rgba(255,255,255,0.50)" }}>
                    <span style={{ color: GOLD, flexShrink: 0 }}>→</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ApifyProduct {
  title: string;
  asin?: string;
  bsr: number | null;
  reviews: number;
  price: number | null;
  stars: number | null;
  demand_score: number;
  competition_level: "Low" | "Medium" | "High";
  url?: string;
}

interface MarketResearchResult {
  keyword: string;
  results: ApifyProduct[];
  source: "apify" | "fallback";
  note?: string;
  error?: string;
}

const PUZZLE_TYPE_CHIPS = [
  "Word Search", "Sudoku", "Crossword", "Maze", "Cryptogram", "Number Search",
];

const COMPETITION_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
  Medium: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
  High: { bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
};

interface SavedTopic {
  keyword: string;
  puzzleType?: string;
  results: ApifyProduct[];
}

function MarketIntelligencePanel({
  onEvidenceSelected,
}: {
  onEvidenceSelected: (evidence: ApifyProduct[], topicLabel: string, briefText?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketResearchResult | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  // Up to 3 saved topics for comparison
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([]);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchMarketData = async (puzzleType: string, kw?: string) => {
    const searchKeyword = kw?.trim() || puzzleType;
    setLoading(true);
    setResult(null);
    setSelectedCard(null);
    try {
      const res = await fetch(`${BASE}/api/apify/market-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: searchKeyword, puzzleType }),
      });
      const data = await res.json() as MarketResearchResult;
      setResult(data);
    } catch {
      setResult({ keyword: searchKeyword, results: [], source: "fallback", error: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (type: string) => {
    setSelectedChip(type);
    fetchMarketData(type, keyword);
  };

  const handleSearch = () => {
    if (selectedChip) fetchMarketData(selectedChip, keyword);
    else if (keyword.trim()) fetchMarketData("", keyword);
  };

  const currentTopic = keyword.trim() || selectedChip || "";

  const handleUseCard = (product: ApifyProduct) => {
    // pre-fill the brief with the search keyword; pass evidence for pipeline grounding
    const briefText = currentTopic;
    onEvidenceSelected([product], product.title, briefText || undefined);
  };

  const handleAIPicks = () => {
    if (result && result.results.length > 0) {
      // Top 3 by demand_score (already sorted descending from API)
      const top3 = [...result.results].sort((a, b) => b.demand_score - a.demand_score).slice(0, 3);
      onEvidenceSelected(top3, `${selectedChip ?? "puzzle"} top 3 by demand`, currentTopic || undefined);
    }
  };

  const handleSaveTopic = () => {
    if (!result || result.results.length === 0) return;
    const label = currentTopic;
    if (!label) return;
    setSavedTopics(prev => {
      // Avoid duplicates by keyword
      const filtered = prev.filter(t => t.keyword !== label);
      const next: SavedTopic[] = [
        ...filtered,
        { keyword: label, puzzleType: selectedChip ?? undefined, results: result.results },
      ];
      return next.slice(-3); // keep last 3 (max 3)
    });
  };

  const handleUseSavedTopic = (topic: SavedTopic) => {
    const top3 = [...topic.results].sort((a, b) => b.demand_score - a.demand_score).slice(0, 3);
    onEvidenceSelected(top3, `${topic.keyword} top 3 by demand`, topic.keyword);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between transition-colors"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 18 }}>📊</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white/80">Market Intelligence</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Live Amazon data — see BSR, reviews &amp; competition before running the pipeline
            </p>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
          {open ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

          {/* ── Saved topics comparison (up to 3) ─────────────────────────── */}
          {savedTopics.length > 0 && (
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>
                  Saved topics — pick one to use
                </p>
                <button
                  onClick={() => setSavedTopics([])}
                  className="text-xs transition-opacity hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  clear all
                </button>
              </div>
              {savedTopics.map((topic, ti) => {
                const top = topic.results[0];
                const comp = top ? COMPETITION_COLORS[top.competition_level] : null;
                const avgDemand = topic.results.length > 0
                  ? Math.round(topic.results.slice(0, 3).reduce((s, r) => s + r.demand_score, 0) / Math.min(3, topic.results.length))
                  : 0;
                return (
                  <div
                    key={ti}
                    className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/70 truncate">{topic.keyword}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {topic.results.length} results
                          </span>
                          <span className="text-xs" style={{ color: GOLD }}>
                            avg demand {avgDemand}/10
                          </span>
                          {comp && top && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: comp.bg, color: comp.text }}>
                              {top.competition_level} competition
                            </span>
                          )}
                          {top?.bsr && (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                              best BSR #{top.bsr.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setSavedTopics(prev => prev.filter((_, i) => i !== ti))}
                          className="text-xs transition-opacity hover:opacity-80"
                          style={{ color: "rgba(255,255,255,0.25)" }}
                        >
                          ✕
                        </button>
                        <button
                          onClick={() => handleUseSavedTopic(topic)}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold transition-opacity hover:opacity-80"
                          style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}45`, color: GOLD }}
                        >
                          Use this topic →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />
            </div>
          )}

          {/* Keyword input */}
          <div className="pt-4 flex gap-2">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. large print seniors, christmas cats…"
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.80)",
                outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || (!keyword.trim() && !selectedChip)}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-opacity disabled:opacity-40"
              style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}40`, color: GOLD }}
            >
              Search
            </button>
          </div>

          {/* Puzzle type chips */}
          <div className="flex flex-wrap gap-2">
            {PUZZLE_TYPE_CHIPS.map(type => (
              <button
                key={type}
                onClick={() => handleChip(type)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all disabled:opacity-40"
                style={selectedChip === type
                  ? { background: GOLD, color: "#000", border: `1px solid ${GOLD}` }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)" }
                }
              >
                {type}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-4">
              <div
                className="rounded-full"
                style={{ width: 14, height: 14, border: `2px solid ${GOLD}`, borderTopColor: "transparent", animation: "kdp-spin 0.8s linear infinite" }}
              />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Fetching live Amazon data…</p>
            </div>
          )}

          {/* No API key notice */}
          {result && result.source === "fallback" && !loading && (
            <div
              className="rounded-lg px-4 py-3 text-xs"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.20)", color: "rgba(251,191,36,0.80)" }}
            >
              {result.note ?? result.error ?? "Live data unavailable — add your APIFY_API_KEY to enable real Amazon data."}
              {" "}The pipeline runs fine without it.
            </div>
          )}

          {/* Results cards */}
          {result && result.results.length > 0 && !loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>
                  Top results · click to use this topic
                </p>
                <div className="flex gap-2">
                  {savedTopics.length < 3 && currentTopic && (
                    <button
                      onClick={handleSaveTopic}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-bold transition-opacity hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}
                    >
                      + Compare
                    </button>
                  )}
                  <button
                    onClick={handleAIPicks}
                    className="text-xs px-3 py-1.5 rounded-lg font-bold transition-opacity hover:opacity-80"
                    style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}35`, color: GOLD }}
                  >
                    AI picks best →
                  </button>
                </div>
              </div>
              {result.results.slice(0, 8).map((product, i) => {
                const compColor = COMPETITION_COLORS[product.competition_level];
                const isSelected = selectedCard === i;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedCard(i);
                      handleUseCard(product);
                    }}
                    className="rounded-lg p-3 cursor-pointer transition-all"
                    style={{
                      background: isSelected ? `${GOLD}10` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isSelected ? GOLD + "50" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <p
                      className="text-xs font-medium leading-snug mb-1.5"
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      {product.title.length > 90 ? product.title.slice(0, 90) + "…" : product.title}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {product.bsr !== null && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          BSR #{product.bsr.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {product.reviews} reviews
                      </span>
                      {product.price !== null && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          ${product.price}
                        </span>
                      )}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: compColor.bg, color: compColor.text }}
                      >
                        {product.competition_level} competition
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
                      >
                        Demand {product.demand_score}/10
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const THEME_COLORS: Record<string, string> = {
  midnight: "#0D1B3E", forest: "#1A3C1A", crimson: "#280808", ocean: "#1565A8",
  violet: "#180635", slate: "#252E3A", sunrise: "#D44000", teal: "#062020",
  parchment: "#7B3A00", sky: "#2050B8",
};

function SeriesArcSection({ arc, onCreateVolume }: { arc: SeriesArc; onCreateVolume: (brief: string) => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)" }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
      >
        <span style={{ color: GOLD, fontSize: 14 }}>◈</span>
        <div>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
            Suggested Series Arc
          </span>
          <span
            className="ml-2 text-xs font-semibold"
            style={{ color: GOLD }}
          >
            {arc.seriesName}
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.40)" }}>
          {arc.seriesRationale}
        </p>
        <div className="space-y-3">
          {arc.volumes.map((vol) => {
            const themeColor = THEME_COLORS[vol.theme] ?? "#111";
            const brief = `Volume ${vol.volumeNumber} of "${arc.seriesName}" series: ${vol.title}. ${vol.angle} ${vol.keyDifferentiator}`;
            return (
              <div
                key={vol.volumeNumber}
                className="rounded-lg p-3 flex gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {/* Theme swatch */}
                <div
                  className="flex-shrink-0 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    width: 36,
                    height: 44,
                    background: themeColor,
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 10,
                  }}
                >
                  V{vol.volumeNumber}
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-snug text-white/80 truncate">{vol.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{vol.subtitle}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
                      {vol.theme}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
                      {vol.wordCategory}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
                      {vol.difficulty}
                    </span>
                  </div>
                  <p className="text-xs mt-1.5 italic" style={{ color: "rgba(255,255,255,0.30)" }}>
                    {vol.keyDifferentiator}
                  </p>
                </div>
                {/* Create button */}
                <div className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => onCreateVolume(brief)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all hover:opacity-80"
                    style={{
                      background: `${GOLD}20`,
                      border: `1px solid ${GOLD}50`,
                      color: GOLD,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Create →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.20)" }}>
          {arc.seriesTheme}
        </p>
      </div>
    </div>
  );
}

// ── Volume Builder types ───────────────────────────────────────────────────────

interface LibrarySuggestion {
  type: "series_gap" | "niche_gap" | "cover_diversity";
  brief: string;
  niche: string;
  nicheLabel: string;
  puzzleType: string;
  theme: string;
  coverStyle: string;
  rationale: string;
  seriesName?: string;
  volumeNumber?: number;
}

interface LibraryAnalysis {
  totalBooks: number;
  usedCombos: string[];
  suggestions: LibrarySuggestion[];
}

const TYPE_LABEL: Record<string, string> = {
  series_gap: "Series Continuation",
  niche_gap: "Untapped Niche",
  cover_diversity: "Visual Diversification",
};

const TYPE_BADGE: Record<string, string> = {
  series_gap: "#3b82f6",
  niche_gap: "#22c55e",
  cover_diversity: "#a855f7",
};

function VolumeBuilderPanel({
  onCreateThis,
}: {
  onCreateThis: (brief: string, usedCombos: string[], seriesName?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<LibraryAnalysis | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!force && analysis) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/library/analysis");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = (await res.json()) as LibraryAnalysis;
      setAnalysis(data);
    } catch (e) {
      setFetchError("Could not load library data — try again");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header / toggle */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 18 }}>📚</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
              Volume Builder
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              AI-analysed gaps in your library — click a suggestion to pre-fill the brief
            </p>
          </div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 18, lineHeight: 1 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {loading && (
            <div className="pt-4 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.40)" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.15)",
                  borderTopColor: GOLD,
                  borderRadius: "50%",
                  animation: "kdp-spin 0.7s linear infinite",
                }}
              />
              <span className="text-xs">Analysing your library…</span>
            </div>
          )}

          {fetchError && (
            <p className="pt-3 text-xs" style={{ color: "#ef4444" }}>{fetchError}</p>
          )}

          {analysis && !loading && (
            <>
              <p className="pt-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Library: <strong style={{ color: "rgba(255,255,255,0.60)" }}>{analysis.totalBooks} book{analysis.totalBooks !== 1 ? "s" : ""}</strong>
                {analysis.usedCombos.length > 0 && ` · ${analysis.usedCombos.length} cover combo${analysis.usedCombos.length !== 1 ? "s" : ""} in use`}
              </p>

              <div className="space-y-3">
                {analysis.suggestions.length === 0 && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
                    No suggestions generated — your library may be empty.
                  </p>
                )}
                {analysis.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${TYPE_BADGE[s.type] ?? "#888"}18`,
                              color: TYPE_BADGE[s.type] ?? "#888",
                              border: `1px solid ${TYPE_BADGE[s.type] ?? "#888"}30`,
                            }}
                          >
                            {TYPE_LABEL[s.type] ?? s.type}
                          </span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                            {s.nicheLabel} · {s.puzzleType}
                          </span>
                        </div>
                        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>
                          {s.brief}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {s.rationale}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                          Cover: {s.theme} / {s.coverStyle}
                          {s.seriesName ? ` · Series: "${s.seriesName}" Vol ${s.volumeNumber}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => onCreateThis(s.brief, analysis.usedCombos, s.seriesName)}
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 hover:opacity-80"
                        style={{
                          background: `${GOLD}15`,
                          border: `1px solid ${GOLD}35`,
                          color: GOLD,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Create this →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setAnalysis(null); load(true); }}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: "rgba(255,255,255,0.60)" }}
              >
                ↻ Refresh suggestions
              </button>
            </>
          )}
        </div>
      )}
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
  const [marketEvidence, setMarketEvidence] = useState<ApifyProduct[]>([]);
  const [evidenceLabel, setEvidenceLabel] = useState<string>("");
  const [pipelineUsedCombos, setPipelineUsedCombos] = useState<string[]>([]);
  const [pipelineSeriesName, setPipelineSeriesName] = useState<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const briefRef = useRef<string>("");
  const evidenceRef = useRef<ApifyProduct[]>([]);
  const usedCombosRef = useRef<string[]>([]);
  const seriesNameRef = useRef<string | undefined>(undefined);

  const updateStage = useCallback(
    (stageId: string, patch: Partial<Omit<StageState, "data">> & { data?: Record<string, unknown> }) => {
      setStages(prev => ({
        ...prev,
        [stageId]: {
          ...prev[stageId],
          ...patch,
          data: { ...prev[stageId]?.data, ...(patch.data ?? {}) },
        },
      }));
    },
    [],
  );

  const runPipeline = useCallback(
    async (currentBrief: string) => {
      setRunning(true);
      setError(null);
      setCompletion(null);
      setStages(initStages());

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const evidence = evidenceRef.current;
        const combos = usedCombosRef.current;
        const sName = seriesNameRef.current;
        const res = await fetch("/api/agents/create-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: currentBrief.trim() || undefined,
            marketEvidence: evidence.length > 0 ? evidence : undefined,
            usedCombos: combos.length > 0 ? combos : undefined,
            seriesName: sName || undefined,
          }),
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
                  coverDataUrl: typeof event.coverDataUrl === "string" ? event.coverDataUrl : undefined,
                  qaFailed: event.qaFailed === true,
                  qaPassed: event.qaPassed === true,
                  qaIssues: Array.isArray(event.qaIssues) ? (event.qaIssues as QAIssue[]) : [],
                  descWordCount: typeof event.descWordCount === "number" ? event.descWordCount : undefined,
                  bookIntelligence: event.bookIntelligence as BookIntelligence | null | undefined,
                  seriesArc: event.seriesArc as SeriesArc | null | undefined,
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
    },
    [updateStage],
  );

  const handleEvidenceSelected = useCallback((evidence: ApifyProduct[], label: string, briefText?: string) => {
    setMarketEvidence(evidence);
    setEvidenceLabel(label);
    evidenceRef.current = evidence;
    if (briefText) {
      setBrief(briefText);
      briefRef.current = briefText;
    }
  }, []);

  const handleStart = () => {
    briefRef.current = brief;
    evidenceRef.current = marketEvidence;
    usedCombosRef.current = pipelineUsedCombos;
    seriesNameRef.current = pipelineSeriesName;
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
    setMarketEvidence([]);
    setEvidenceLabel("");
    evidenceRef.current = [];
    setPipelineUsedCombos([]);
    setPipelineSeriesName(undefined);
    usedCombosRef.current = [];
    seriesNameRef.current = undefined;
  };

  const handleCreateVolume = (volumeBrief: string) => {
    abortRef.current?.abort();
    setRunning(false);
    setStages(initStages());
    setError(null);
    setCompletion(null);
    setBrief(volumeBrief);
    briefRef.current = volumeBrief;
    setMarketEvidence([]);
    setEvidenceLabel("");
    evidenceRef.current = [];
    setPipelineUsedCombos([]);
    setPipelineSeriesName(undefined);
    usedCombosRef.current = [];
    seriesNameRef.current = undefined;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleVolumeBuilderCreate = (suggBrief: string, combos: string[], sName?: string) => {
    abortRef.current?.abort();
    setRunning(false);
    setStages(initStages());
    setError(null);
    setCompletion(null);
    setBrief(suggBrief);
    briefRef.current = suggBrief;
    setMarketEvidence([]);
    setEvidenceLabel("");
    evidenceRef.current = [];
    setPipelineUsedCombos(combos);
    setPipelineSeriesName(sName);
    usedCombosRef.current = combos;
    seriesNameRef.current = sName;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isComplete = completion !== null && !running;
  const hasError = !!error && !running;

  return (
    <div className="min-h-screen">
      <style>{`@keyframes kdp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div style={{ fontSize: 42, lineHeight: 1.2 }}>🧠</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Book Creator</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Ten specialist agents — each grounded in professional publishing knowledge — research, debate, and build your book.
          </p>
        </div>

        {/* Volume Builder Panel */}
        {!running && !isComplete && (
          <VolumeBuilderPanel onCreateThis={handleVolumeBuilderCreate} />
        )}

        {/* Market Intelligence Panel */}
        {!running && !isComplete && (
          <MarketIntelligencePanel onEvidenceSelected={handleEvidenceSelected} />
        )}

        {/* Input card */}
        {!running && !isComplete && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Volume Builder suggestion indicator */}
            {(pipelineSeriesName || pipelineUsedCombos.length > 0) && (
              <div
                className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                style={{ background: "#3b82f615", border: "1px solid #3b82f630" }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: "#3b82f6", fontSize: 12 }}>◉</span>
                  <p className="text-xs font-semibold" style={{ color: "#3b82f6" }}>
                    Volume Builder suggestion loaded
                  </p>
                  {pipelineSeriesName && (
                    <p className="text-xs truncate max-w-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                      — Series: "{pipelineSeriesName}"
                    </p>
                  )}
                  {!pipelineSeriesName && pipelineUsedCombos.length > 0 && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                      — {pipelineUsedCombos.length} cover combo{pipelineUsedCombos.length !== 1 ? "s" : ""} excluded
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setPipelineUsedCombos([]); setPipelineSeriesName(undefined); usedCombosRef.current = []; seriesNameRef.current = undefined; }}
                  className="text-xs ml-2 opacity-40 hover:opacity-70 transition-opacity"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  ✕
                </button>
              </div>
            )}
            {/* Evidence selected indicator */}
            {marketEvidence.length > 0 && (
              <div
                className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: GOLD, fontSize: 12 }}>◉</span>
                  <p className="text-xs font-semibold" style={{ color: GOLD }}>
                    Market data loaded
                  </p>
                  <p className="text-xs truncate max-w-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                    — {evidenceLabel || `${marketEvidence.length} Amazon result${marketEvidence.length !== 1 ? "s" : ""} will ground the Market Scout`}
                  </p>
                </div>
                <button
                  onClick={() => { setMarketEvidence([]); setEvidenceLabel(""); evidenceRef.current = []; }}
                  className="text-xs ml-2 opacity-40 hover:opacity-70 transition-opacity"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  ✕
                </button>
              </div>
            )}

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
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
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl text-black font-bold text-base transition-all duration-150"
              style={{ background: GOLD, boxShadow: `0 4px 20px ${GOLD}30` }}
            >
              🧠 Start Expert Pipeline
            </button>

            <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Uses Replit AI credits · 10 specialist agents across 9 pipeline stages
            </p>
          </div>
        )}

        {/* Pipeline progress */}
        {(running || isComplete || hasError) && (
          <div
            className="rounded-2xl p-6"
            style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2
              className="text-xs font-bold mb-4 uppercase tracking-widest"
              style={{ color: GOLD + "99" }}
            >
              Expert Pipeline — {STAGES.length} Stages
            </h2>
            <div className="space-y-0.5">
              {STAGES.map(stage => (
                <StageRow key={stage.id} stage={stage} state={stages[stage.id]} />
              ))}
            </div>

            {hasError && (
              <div
                className="mt-4 rounded-lg px-4 py-3 text-sm"
                style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}
              >
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
            {/* Header */}
            <div
              className="px-6 py-4"
              style={{ background: GOLD + "15", borderBottom: `1px solid ${GOLD}30` }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: GOLD, fontSize: 20 }}>◆</span>
                <h2 className="font-bold" style={{ color: GOLD }}>Book Created!</h2>
                {completion.qaFailed && (
                  <span
                    className="text-xs px-2 py-0.5 rounded ml-auto"
                    style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}
                  >
                    QA partial
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 font-semibold text-white/90 leading-snug">
                "{completion.title}"
              </p>
              {completion.subtitle && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>
                  {completion.subtitle}
                </p>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Cover image preview */}
              {completion.coverDataUrl && (
                <div className="flex justify-center">
                  <img
                    src={completion.coverDataUrl}
                    alt={`AI-generated cover art for "${completion.title}"`}
                    className="rounded-xl shadow-lg"
                    style={{
                      maxWidth: 220,
                      maxHeight: 300,
                      objectFit: "cover",
                      border: `1px solid ${GOLD}44`,
                    }}
                  />
                </div>
              )}
              {!completion.coverDataUrl && (
                <div
                  className="flex items-center justify-center rounded-xl py-6 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px dashed rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  SVG theme art · {completion.theme ?? "default"} theme
                </div>
              )}

              {/* Spec details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {completion.puzzleType && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Puzzle Type</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.puzzleType}</p>
                  </div>
                )}
                {completion.puzzleCount !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Puzzle Count</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.puzzleCount}</p>
                  </div>
                )}
                {completion.theme && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Theme</span>
                    <p className="font-semibold text-white/80 mt-0.5 capitalize">{completion.theme}</p>
                  </div>
                )}
                {completion.bookIntelligence?.recommendedPrice && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Recommended Price</span>
                    <p className="font-semibold mt-0.5" style={{ color: "#22c55e" }}>${completion.bookIntelligence.recommendedPrice}</p>
                  </div>
                )}
                {completion.descWordCount !== undefined && !completion.bookIntelligence?.recommendedPrice && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>Description</span>
                    <p className="font-semibold text-white/80 mt-0.5">{completion.descWordCount} words</p>
                  </div>
                )}
              </div>

              {/* Book Intelligence Report */}
              {completion.bookIntelligence && (
                <BookIntelligenceReport intel={completion.bookIntelligence} />
              )}

              {/* Series Arc */}
              {completion.seriesArc && (
                <SeriesArcSection arc={completion.seriesArc} onCreateVolume={handleCreateVolume} />
              )}

              {/* QA Checklist */}
              <div>
                <h3
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: completion.qaPassed ? "#22c55e99" : "#f59e0b99" }}
                >
                  Quality Checklist
                </h3>
                <QAChecklist issues={completion.qaIssues} passed={completion.qaPassed} />
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
              onClick={() => {
                abortRef.current?.abort();
                setRunning(false);
              }}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error retry */}
        {hasError && (
          <div className="text-center">
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

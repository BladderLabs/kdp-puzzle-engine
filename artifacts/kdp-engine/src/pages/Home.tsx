import { useState, useCallback } from "react";
import { useListBooks, useDeleteBook, useCloneBook, useCreateBook } from "@workspace/api-client-react";
import type { Book } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type PuzzleTypeFilter = "All" | "Word Search" | "Sudoku" | "Maze" | "Number Search" | "Cryptogram";

interface OpportunityCard {
  puzzleType: string;
  niche: string;
  nicheLabel: string;
  salesPotential: "Hot" | "Rising" | "Stable";
  score: number;
  coverStyle: string;
  difficulty: string;
  puzzleCount: number;
  pricePoint: number;
  largePrint: boolean;
  theme: string;
  whySells: string;
  title: string;
  subtitle: string;
}

const PUZZLE_TYPES: PuzzleTypeFilter[] = ["All", "Word Search", "Sudoku", "Maze", "Number Search", "Cryptogram"];

const PUZZLE_ICONS: Record<string, string> = {
  "Word Search": "🔤",
  "Sudoku": "🔢",
  "Maze": "🌀",
  "Number Search": "🔍",
  "Cryptogram": "🔐",
};

const PUZZLE_TYPE_COLORS: Record<string, string> = {
  "Word Search": "border-blue-500/40 text-blue-300",
  "Sudoku": "border-violet-500/40 text-violet-300",
  "Maze": "border-emerald-500/40 text-emerald-300",
  "Number Search": "border-orange-500/40 text-orange-300",
  "Cryptogram": "border-rose-500/40 text-rose-300",
};

const POTENTIAL_COLORS: Record<string, string> = {
  Hot: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  Rising: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  Stable: "text-sky-400 bg-sky-400/10 border-sky-400/30",
};

interface SeriesGroupData {
  name: string;
  volumes: Book[];
  latestUpdate: string;
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const filled = (score / 10) * circ;
  const color =
    score >= 8 ? "#f97316" : score >= 6 ? "#10b981" : "#60a5fa";

  return (
    <div className="relative inline-flex items-center justify-center w-14 h-14">
      <svg width="56" height="56" viewBox="0 0 56 56" className="rotate-[-90deg]">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#ffffff10" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function VolumeCard({
  book,
  onDelete,
}: {
  book: Book;
  onDelete: (id: number) => void;
}) {
  const vol = book.volumeNumber ?? 1;
  return (
    <div className="flex-shrink-0 w-48 bg-[#111] border border-white/8 hover:border-amber-500/30 rounded-xl flex flex-col transition-all duration-200">
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-md px-1.5 py-0.5">
            Vol {vol}
          </span>
          <span className="text-xs text-white/25">{book.puzzleCount ?? 100}p</span>
        </div>
        <h4 className="font-semibold text-white text-xs leading-snug line-clamp-2 mb-1">
          {book.title || "Untitled"}
        </h4>
        <p className="text-xs text-white/30">{book.difficulty || "Mixed"}</p>
      </div>
      <div className="px-3 pb-3 flex gap-1.5 border-t border-white/5 pt-2">
        <Link href={`/generate/${book.id}`} className="flex-1">
          <button className="w-full py-1 rounded-md bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-xs font-bold transition-all duration-150">
            Generate
          </button>
        </Link>
        <Link href={`/books/${book.id}`}>
          <button className="px-2 py-1 rounded-md border border-white/10 text-white/40 hover:text-white hover:border-white/30 text-xs transition-colors">
            Edit
          </button>
        </Link>
        <button
          onClick={() => onDelete(book.id)}
          className="px-2 py-1 rounded-md border border-red-500/10 text-red-400/30 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors"
        >
          Del
        </button>
      </div>
    </div>
  );
}

function SeriesGroup({
  group,
  onAddVolume,
  onDelete,
  addingVolume,
}: {
  group: SeriesGroupData;
  onAddVolume: (seriesName: string, highestVolId: number) => void;
  onDelete: (id: number) => void;
  addingVolume: boolean;
}) {
  const volumes = [...group.volumes].sort((a, b) => (a.volumeNumber ?? 1) - (b.volumeNumber ?? 1));
  const totalPuzzles = volumes.reduce((acc, v) => acc + (v.puzzleCount ?? 100), 0);
  const puzzleType = volumes[0]?.puzzleType ?? "";
  const typeColor = PUZZLE_TYPE_COLORS[puzzleType] || "border-white/10 text-white/50";
  const highestVol = volumes.reduce((best, v) => (v.volumeNumber ?? 1) > (best.volumeNumber ?? 1) ? v : best, volumes[0]);

  return (
    <div className="bg-[#0b0b0b] border border-white/8 rounded-2xl overflow-hidden">
      {/* Series header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base flex-shrink-0">📚</span>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{group.name}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${typeColor}`}>
                {PUZZLE_ICONS[puzzleType] || "📖"} {puzzleType}
              </span>
              <span className="text-xs text-white/30">
                {volumes.length} vol{volumes.length !== 1 ? "s" : ""} · {totalPuzzles.toLocaleString()} puzzles total
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onAddVolume(group.name, highestVol.id)}
          disabled={addingVolume}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-xs font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ml-3"
        >
          {addingVolume ? "Adding…" : "+ Add Volume"}
        </button>
      </div>

      {/* Volume strip */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {volumes.map(vol => (
            <VolumeCard key={vol.id} book={vol} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickCreateModal({
  card,
  onClose,
  onCreated,
}: {
  card: OpportunityCard;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const createBook = useCreateBook();
  const [puzzleCount, setPuzzleCount] = useState(card.puzzleCount);
  const [difficulty, setDifficulty] = useState(card.difficulty);
  const [largePrint, setLargePrint] = useState(card.largePrint);
  const [paperType, setPaperType] = useState<"white" | "cream">("white");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const book = await createBook.mutateAsync({
        data: {
          title: card.title,
          subtitle: card.subtitle,
          puzzleType: card.puzzleType,
          niche: card.niche,
          difficulty,
          puzzleCount,
          largePrint,
          paperType,
          theme: card.theme,
          coverStyle: card.coverStyle,
          backDescription: card.subtitle,
          words: [],
          volumeNumber: 1,
        },
      });
      onCreated(book.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/20 px-6 py-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-amber-300 line-clamp-1">{card.title}</h3>
              <p className="text-xs text-white/50 mt-0.5">{card.puzzleType} · {card.nicheLabel}</p>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl leading-none mt-0.5">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Puzzle Count</label>
            <div className="flex gap-2 flex-wrap">
              {[50, 75, 100, 150, 200].map(n => (
                <button
                  key={n}
                  onClick={() => setPuzzleCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    puzzleCount === n
                      ? "bg-amber-500 text-black border-amber-500"
                      : "border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Difficulty</label>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    difficulty === d
                      ? "bg-amber-500 text-black border-amber-500"
                      : "border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Paper</label>
              <div className="flex gap-2">
                {(["white", "cream"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPaperType(p)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      paperType === p
                        ? "bg-amber-500 text-black border-amber-500"
                        : "border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Large Print</label>
              <button
                onClick={() => setLargePrint(!largePrint)}
                className={`w-full py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  largePrint
                    ? "bg-amber-500 text-black border-amber-500"
                    : "border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"
                }`}
              >
                {largePrint ? "Yes (8.5×11)": "No (6×9)"}
              </button>
            </div>
          </div>

          <div className="pt-1 text-xs text-white/40 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
            <span>💵</span>
            <span>Suggested price: <strong className="text-amber-400">${card.pricePoint.toFixed(2)}</strong></span>
            <span className="mx-2 text-white/20">·</span>
            <span>Theme: <strong className="text-white/60 capitalize">{card.theme}</strong></span>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Creating..." : "Create Book & Go to Generate →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ card, onQuickCreate }: { card: OpportunityCard; onQuickCreate: (c: OpportunityCard) => void }) {
  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5 flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <ScoreRing score={card.score} />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm leading-snug line-clamp-2">{card.title}</h4>
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{card.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${POTENTIAL_COLORS[card.salesPotential]}`}>
            {card.salesPotential === "Hot" ? "🔥" : card.salesPotential === "Rising" ? "📈" : "✅"} {card.salesPotential}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">
            {PUZZLE_ICONS[card.puzzleType] || "📖"} {card.puzzleType}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">
            {card.nicheLabel}
          </span>
        </div>

        <p className="text-xs text-white/50 leading-relaxed">{card.whySells}</p>
      </div>

      <div className="px-5 pb-5">
        <button
          onClick={() => onQuickCreate(card)}
          className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-sm font-semibold transition-all duration-150"
        >
          Quick Create →
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const { data: books, isLoading, refetch } = useListBooks();
  const deleteBook = useDeleteBook();
  const cloneBook = useCloneBook();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [activeType, setActiveType] = useState<PuzzleTypeFilter>("All");
  const [suggestions, setSuggestions] = useState<OpportunityCard[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [quickCreateCard, setQuickCreateCard] = useState<OpportunityCard | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [addingVolumeSeries, setAddingVolumeSeries] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (type: PuzzleTypeFilter) => {
    setLoadingSuggestions(true);
    setSuggestionsOpen(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/book-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleType: type === "All" ? undefined : type }),
      });
      const data = await res.json();
      setSuggestions(data.cards || []);
    } catch {
      toast({ title: "Could not load suggestions", variant: "destructive" });
    } finally {
      setLoadingSuggestions(false);
    }
  }, [toast]);

  const handleTypeClick = (type: PuzzleTypeFilter) => {
    setActiveType(type);
    fetchSuggestions(type);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this project?")) return;
    try {
      await deleteBook.mutateAsync({ id });
      toast({ title: "Project deleted" });
      refetch();
    } catch {
      toast({ title: "Error deleting project", variant: "destructive" });
    }
  };

  const handleClone = async (id: number) => {
    try {
      const cloned = await cloneBook.mutateAsync({ id });
      toast({ title: "Project cloned" });
      setLocation(`/books/${cloned.id}`);
    } catch {
      toast({ title: "Error cloning project", variant: "destructive" });
    }
  };

  const handleAddVolume = async (seriesName: string, highestVolId: number) => {
    setAddingVolumeSeries(seriesName);
    try {
      const cloned = await cloneBook.mutateAsync({ id: highestVolId });
      toast({ title: `Volume added to "${seriesName}"` });
      await refetch();
      setLocation(`/books/${cloned.id}`);
    } catch {
      toast({ title: "Failed to add volume", variant: "destructive" });
    } finally {
      setAddingVolumeSeries(null);
    }
  };

  // Build series groups and standalones from the books list
  const allSeriesGroups: SeriesGroupData[] = [];
  const allStandaloneBooks: Book[] = [];

  if (books) {
    const groupMap = new Map<string, Book[]>();
    for (const book of books) {
      const sn = book.seriesName;
      if (sn) {
        if (!groupMap.has(sn)) groupMap.set(sn, []);
        groupMap.get(sn)!.push(book);
      } else {
        allStandaloneBooks.push(book);
      }
    }
    for (const [name, volumes] of groupMap) {
      const latestUpdate = volumes.reduce(
        (best, v) => (v.updatedAt > best ? v.updatedAt : best),
        volumes[0]?.updatedAt ?? ""
      );
      allSeriesGroups.push({ name, volumes, latestUpdate });
    }
    // Sort series groups by most recently updated
    allSeriesGroups.sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));
  }

  const hasSeries = allSeriesGroups.length > 0;
  const totalBooks = books?.length ?? 0;
  const seriesCount = allSeriesGroups.length;

  // Stat line for header
  const statLine = totalBooks === 0
    ? "No books yet"
    : hasSeries
      ? `${totalBooks} book${totalBooks !== 1 ? "s" : ""} across ${seriesCount} series`
      : `${totalBooks} book${totalBooks !== 1 ? "s" : ""}`;

  // Client-side search/filter
  const q = librarySearch.trim().toLowerCase();

  const filteredSeriesGroups = q
    ? allSeriesGroups.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.volumes.some(v =>
          v.title.toLowerCase().includes(q) ||
          v.puzzleType.toLowerCase().includes(q)
        )
      )
    : allSeriesGroups;

  const filteredStandalones = q
    ? allStandaloneBooks.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.puzzleType.toLowerCase().includes(q)
      )
    : allStandaloneBooks;

  const hasFilteredContent = filteredSeriesGroups.length > 0 || filteredStandalones.length > 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              KDP Puzzle Dashboard
            </h1>
            <p className="text-white/35 text-sm mt-1">{statLine}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agent-create">
              <button className="px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/70">
                🧠 AI Create
              </button>
            </Link>
            <Link href="/create">
              <button className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors shadow-lg shadow-amber-500/20">
                + New Book
              </button>
            </Link>
          </div>
        </div>

        {/* ─── DISCOVER SECTION ─── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white/80 mb-1">Discover Opportunities</h2>
            <p className="text-sm text-white/40">Pick a puzzle type — AI will find the best books to publish right now</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PUZZLE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => handleTypeClick(type)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${
                  activeType === type && suggestionsOpen
                    ? "bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20"
                    : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                }`}
              >
                {type !== "All" && <span>{PUZZLE_ICONS[type]}</span>}
                {type}
              </button>
            ))}
          </div>

          {/* AI Suggestions Panel */}
          {suggestionsOpen && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/60">
                    {loadingSuggestions
                      ? "Analysing KDP market..."
                      : `${suggestions.length} opportunity${suggestions.length !== 1 ? "s" : ""} found`}
                  </span>
                  {!loadingSuggestions && suggestions.length > 0 && (
                    <button
                      onClick={() => fetchSuggestions(activeType)}
                      className="text-xs text-amber-400/60 hover:text-amber-400 underline-offset-2 hover:underline transition-colors"
                    >
                      Refresh
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSuggestionsOpen(false)}
                  className="text-white/20 hover:text-white/60 text-sm transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {loadingSuggestions ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-[#111] border border-white/8 rounded-2xl p-5 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-white/8 rounded w-3/4" />
                          <div className="h-2 bg-white/5 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="h-5 w-14 bg-white/5 rounded-full" />
                        <div className="h-5 w-20 bg-white/5 rounded-full" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-white/5 rounded" />
                        <div className="h-2 bg-white/5 rounded w-5/6" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {suggestions.map((card, i) => (
                    <SuggestionCard
                      key={i}
                      card={card}
                      onQuickCreate={setQuickCreateCard}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm border border-white/8 rounded-2xl">
                  No suggestions returned. Try again.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── YOUR LIBRARY ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white/80 flex-shrink-0">Your Library</h2>
            {/* Search/filter bar */}
            {!!books?.length && (
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">🔍</span>
                <input
                  type="text"
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                  placeholder="Filter by title, series, or puzzle type…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
                {librarySearch && (
                  <button
                    onClick={() => setLibrarySearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-[#111] border border-white/8 rounded-2xl p-5 h-32 animate-pulse" />
              ))}
            </div>
          ) : !books?.length ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-white/50 font-medium">No projects yet</p>
              <p className="text-white/30 text-sm mt-1 mb-5">Use the Discover section above or create one from scratch</p>
              <Link href="/create">
                <button className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">
                  Create First Book
                </button>
              </Link>
            </div>
          ) : q && !hasFilteredContent ? (
            <div className="text-center py-10 border border-dashed border-white/8 rounded-2xl text-white/30 text-sm">
              No books or series match "<span className="text-white/50">{librarySearch}</span>"
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Series groups ── */}
              {filteredSeriesGroups.length > 0 && (
                <div className="space-y-3">
                  {filteredSeriesGroups.map(group => (
                    <SeriesGroup
                      key={group.name}
                      group={group}
                      onAddVolume={handleAddVolume}
                      onDelete={handleDelete}
                      addingVolume={addingVolumeSeries === group.name}
                    />
                  ))}
                </div>
              )}

              {/* ── Standalone books ── */}
              {filteredStandalones.length > 0 && (
                <div className="space-y-3">
                  {filteredSeriesGroups.length > 0 && (
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Standalone Books</h3>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStandalones.map(book => {
                      const typeColor = PUZZLE_TYPE_COLORS[book.puzzleType] || "border-white/10 text-white/50";
                      return (
                        <div
                          key={book.id}
                          className="group bg-[#111] border border-white/8 hover:border-white/15 rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
                        >
                          <div className="p-5 flex-1">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-bold text-white text-sm leading-snug line-clamp-2 flex-1">
                                {book.title || "Untitled Book"}
                              </h3>
                              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
                                {PUZZLE_ICONS[book.puzzleType] || "📖"} {book.puzzleType}
                              </span>
                            </div>

                            {book.subtitle && (
                              <p className="text-xs text-white/35 line-clamp-1 mb-2">{book.subtitle}</p>
                            )}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                              <span>{book.puzzleCount ?? 100} puzzles</span>
                              <span>{book.difficulty || "Mixed"}</span>
                              <span>{book.largePrint ? "Large Print" : "Standard"}</span>
                              {book.theme && <span className="capitalize">{book.theme}</span>}
                            </div>
                          </div>

                          <div className="px-5 pb-4 flex gap-2 border-t border-white/5 pt-3">
                            <Link href={`/generate/${book.id}`} className="flex-1">
                              <button className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-xs font-bold transition-all duration-150">
                                Generate PDF
                              </button>
                            </Link>
                            <Link href={`/books/${book.id}`}>
                              <button className="px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/30 text-xs font-medium transition-colors">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={() => handleClone(book.id)}
                              className="px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/30 text-xs font-medium transition-colors"
                            >
                              Clone
                            </button>
                            <button
                              onClick={() => handleDelete(book.id)}
                              className="px-3 py-2 rounded-lg border border-red-500/10 text-red-400/40 hover:text-red-400 hover:border-red-500/30 text-xs font-medium transition-colors"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── QUICK CREATE MODAL ─── */}
      {quickCreateCard && (
        <QuickCreateModal
          card={quickCreateCard}
          onClose={() => setQuickCreateCard(null)}
          onCreated={(id) => {
            setQuickCreateCard(null);
            refetch();
            setLocation(`/generate/${id}`);
          }}
        />
      )}
    </div>
  );
}

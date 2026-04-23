﻿﻿import { useState, useCallback } from "react";
import { useListBooks, useDeleteBook, useCloneBook, useCreateBook } from "@workspace/api-client-react";
import type { Book } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type PuzzleTypeFilter = "All" | "Word Search" | "Sudoku" | "Maze" | "Number Search" | "Cryptogram";

interface OpportunityCard {
  puzzleType: string; niche: string; nicheLabel: string;
  salesPotential: "Hot" | "Rising" | "Stable"; score: number;
  coverStyle: string; difficulty: string; puzzleCount: number;
  pricePoint: number; largePrint: boolean; theme: string;
  whySells: string; title: string; subtitle: string;
}

const PUZZLE_TYPES: PuzzleTypeFilter[] = ["All","Word Search","Sudoku","Maze","Number Search","Cryptogram"];
const PUZZLE_ICONS: Record<string,string> = {"Word Search":"🔤","Sudoku":"🔢","Maze":"🌀","Number Search":"🔍","Cryptogram":"🔐"};
const PUZZLE_TYPE_COLORS: Record<string,string> = {"Word Search":"border-blue-500/40 text-blue-300","Sudoku":"border-violet-500/40 text-violet-300","Maze":"border-emerald-500/40 text-emerald-300","Number Search":"border-orange-500/40 text-orange-300","Cryptogram":"border-rose-500/40 text-rose-300"};
const COVER_ACCENT: Record<string,string> = {midnight:"#F5C842",forest:"#6DCC50",crimson:"#FF3838",ocean:"#1565A8",violet:"#C060FF",slate:"#FF8C38",sunrise:"#D44000",teal:"#18D0A0",parchment:"#7B3A00",sky:"#2050B8"};
const POTENTIAL_BADGE: Record<string,{cls:string;icon:string}> = {Hot:{cls:"text-orange-400 bg-orange-400/10 border-orange-400/30",icon:"🔥"},Rising:{cls:"text-emerald-400 bg-emerald-400/10 border-emerald-400/30",icon:"📈"},Stable:{cls:"text-sky-400 bg-sky-400/10 border-sky-400/30",icon:"✅"}};

interface SeriesGroupData { name: string; volumes: Book[]; latestUpdate: string; }

function ScoreRing({ score }: { score: number }) {
  const r = 18, circ = 2 * Math.PI * r, filled = (score / 10) * circ;
  const color = score >= 8 ? "#f97316" : score >= 6 ? "#10b981" : "#60a5fa";
  return (
    <div className="relative inline-flex items-center justify-center w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="rotate-[-90deg]">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#ffffff08" strokeWidth="4"/>
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${filled} ${circ-filled}`}/>
      </svg>
      <span className="absolute text-xs font-bold" style={{color}}>{score}</span>
    </div>
  );
}

const EXPERIENCE_META: Record<string, { icon: string; label: string }> = {
  sketch:       { icon: "✏️", label: "Sketch" },
  detective:    { icon: "🔍", label: "Detective" },
  adventure:    { icon: "⚔️", label: "Adventure" },
  darkacademia: { icon: "📜", label: "Dark Acad." },
  cozycottage:  { icon: "🫖", label: "Cozy" },
  mindful:      { icon: "🌿", label: "Mindful" },
};

function qaPillClass(score: number): string {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function BookCoverCard({ book, onDelete, onClone }: { book: Book; onDelete:(id:number)=>void; onClone:(id:number)=>void }) {
  const accent = COVER_ACCENT[book.theme ?? "midnight"] ?? "#C8951A";
  const typeColor = PUZZLE_TYPE_COLORS[book.puzzleType] || "border-white/10 text-white/50";
  // Cast for new pipeline fields — OpenAPI schema hasn't been regenerated yet; runtime has them.
  const ext = book as unknown as {
    qaScore?: number | null;
    giftSku?: boolean;
    experienceMode?: string;
  };
  const qaScore = typeof ext.qaScore === "number" ? ext.qaScore : null;
  const giftSku = Boolean(ext.giftSku);
  const experienceMode = ext.experienceMode && ext.experienceMode !== "standard" ? ext.experienceMode : null;
  const expMeta = experienceMode ? EXPERIENCE_META[experienceMode] : null;
  return (
    <div className="group relative flex flex-col book-lift cursor-pointer w-full">
      <div className="relative rounded-sm overflow-hidden sketch-border" style={{paddingBottom:"148%",background:"linear-gradient(160deg,#181210 0%,#0e0c09 100%)",borderLeft:`3px solid ${accent}`,boxShadow:"inset -1px 0 0 rgba(255,255,255,0.04)"}}>
        {giftSku && (
          <svg className="gift-ribbon-overlay" viewBox="0 0 110 130">
            <path d="M 0,0 L 70,0 L 100,30 L 100,70 L 70,100 L 0,100 Z" fill={accent}/>
            <path d="M 8,8 L 64,8 L 90,32 L 90,66 L 64,92 L 8,92 Z" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity="0.6"/>
            <text x="48" y="56" textAnchor="middle" fontFamily="Playfair Display,Georgia,serif" fontSize="14" fontWeight="800" fill="#fff" letterSpacing="2">GIFT</text>
            <path d="M 8,100 L 0,125 L 20,110 Z" fill={accent} opacity="0.85"/>
            <path d="M 20,110 L 38,125 L 38,100 Z" fill={accent} opacity="0.7"/>
          </svg>
        )}
        {qaScore != null && (
          <span className={`qa-score-pill ${qaPillClass(qaScore)}`} title={`Cover QA score: ${qaScore}/100`}>
            QA {qaScore}
          </span>
        )}
        <div className="absolute inset-0 p-2.5 flex flex-col justify-between">
          <div>
            <div className="w-7 h-0.5 rounded-full mb-1" style={{background:accent,opacity:0.7}}/>
            <div className="w-4 h-0.5 rounded-full" style={{background:accent,opacity:0.35}}/>
          </div>
          <div>
            <div className="text-[9px] font-sketch mb-1" style={{color:accent,opacity:0.8}}>{PUZZLE_ICONS[book.puzzleType]||"📖"} {book.puzzleType}</div>
            <div className="text-[11px] font-display font-bold text-white leading-snug line-clamp-3 mb-1.5">{book.title||"Untitled"}</div>
            {book.subtitle && <div className="text-[9px] text-white/30 leading-snug line-clamp-2">{book.subtitle}</div>}
          </div>
          <div className="text-[9px] text-white/20 font-mono">{book.puzzleCount??100}p · {book.difficulty||"Mixed"}</div>
        </div>
        <div className="absolute inset-0 bg-black/82 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1.5 p-2">
          <Link href={`/generate/${book.id}`} className="w-full"><button className="w-full py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold transition-colors">Generate</button></Link>
          <Link href={`/books/${book.id}`} className="w-full"><button className="w-full py-1 rounded-md border border-white/20 text-white/70 hover:text-white text-[10px] font-medium transition-colors">Edit</button></Link>
          <div className="flex gap-1.5 w-full">
            <button onClick={(e)=>{e.stopPropagation();onClone(book.id);}} className="flex-1 py-1 rounded-md border border-white/10 text-white/40 hover:text-white text-[10px] transition-colors">Clone</button>
            <button onClick={(e)=>{e.stopPropagation();onDelete(book.id);}} className="flex-1 py-1 rounded-md border border-red-500/10 text-red-400/40 hover:text-red-400 text-[10px] transition-colors">Del</button>
          </div>
        </div>
      </div>
      <div className="h-1.5 rounded-b-sm" style={{background:`linear-gradient(to bottom,${accent}22,transparent)`}}/>
      <div className="mt-1 px-0.5 flex items-center gap-1 flex-wrap">
        <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${typeColor}`}>Vol {book.volumeNumber??1}</span>
        {expMeta && (
          <span className={`experience-chip ${experienceMode}`} title={expMeta.label}>
            <span>{expMeta.icon}</span>
            <span className="hidden md:inline">{expMeta.label}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function VolumeCard({ book, onDelete }: { book: Book; onDelete:(id:number)=>void }) {
  const accent = COVER_ACCENT[book.theme ?? "midnight"] ?? "#C8951A";
  return (
    <div className="shrink-0 w-32 group book-lift">
      <div className="relative rounded-sm overflow-hidden sketch-border" style={{paddingBottom:"148%",background:"linear-gradient(160deg,#181210 0%,#0e0c09 100%)",borderLeft:`2px solid ${accent}`}}>
        <div className="absolute inset-0 p-2 flex flex-col justify-between">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded self-start" style={{background:`${accent}22`,color:accent}}>Vol {book.volumeNumber??1}</span>
          <div>
            <div className="text-[10px] font-display font-bold text-white leading-snug line-clamp-2 mb-1">{book.title||"Untitled"}</div>
            <div className="text-[9px] text-white/25">{book.puzzleCount??100} puzzles</div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/82 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
          <Link href={`/generate/${book.id}`} className="w-full"><button className="w-full py-1.5 rounded bg-amber-500 text-black text-[10px] font-bold">Generate</button></Link>
          <Link href={`/books/${book.id}`} className="w-full"><button className="w-full py-1 rounded border border-white/20 text-white/60 text-[10px]">Edit</button></Link>
          <button onClick={()=>onDelete(book.id)} className="text-[9px] text-red-400/50 hover:text-red-400 mt-0.5">Delete</button>
        </div>
      </div>
    </div>
  );
}

function SeriesGroup({ group,onAddVolume,onDelete,addingVolume }: { group:SeriesGroupData; onAddVolume:(s:string,id:number)=>void; onDelete:(id:number)=>void; addingVolume:boolean }) {
  const volumes = [...group.volumes].sort((a,b)=>(a.volumeNumber??1)-(b.volumeNumber??1));
  const totalPuzzles = volumes.reduce((acc,v)=>acc+(v.puzzleCount??100),0);
  const puzzleType = volumes[0]?.puzzleType ?? "";
  const typeColor = PUZZLE_TYPE_COLORS[puzzleType] || "border-white/10 text-white/50";
  const highestVol = volumes.reduce((best,v)=>(v.volumeNumber??1)>(best.volumeNumber??1)?v:best,volumes[0]);
  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base shrink-0">📚</span>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{group.name}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${typeColor}`}>{PUZZLE_ICONS[puzzleType]||"📖"} {puzzleType}</span>
              <span className="text-xs text-white/30">{volumes.length} vol{volumes.length!==1?"s":""} · {totalPuzzles.toLocaleString()} puzzles</span>
            </div>
          </div>
        </div>
        <button onClick={()=>onAddVolume(group.name,highestVol.id)} disabled={addingVolume} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-xs font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ml-3">
          {addingVolume ? "Adding…" : "+ Add Volume"}
        </button>
      </div>
      <div className="px-5 py-4 overflow-x-auto"><div className="flex gap-3" style={{minWidth:"max-content"}}>{volumes.map(vol=><VolumeCard key={vol.id} book={vol} onDelete={onDelete}/>)}</div></div>
    </div>
  );
}

function QuickCreateModal({ card,onClose,onCreated }: { card:OpportunityCard; onClose:()=>void; onCreated:(id:number)=>void }) {
  const createBook = useCreateBook();
  const [puzzleCount,setPuzzleCount] = useState(card.puzzleCount);
  const [difficulty,setDifficulty] = useState(card.difficulty);
  const [largePrint,setLargePrint] = useState(card.largePrint);
  const [paperType,setPaperType] = useState<"white"|"cream">("white");
  const [saving,setSaving] = useState(false);
  const handleCreate = async () => {
    setSaving(true);
    try {
      const book = await createBook.mutateAsync({data:{title:card.title,subtitle:card.subtitle,puzzleType:card.puzzleType,niche:card.niche,difficulty,puzzleCount,largePrint,paperType,theme:card.theme,coverStyle:card.coverStyle,backDescription:card.subtitle,words:[],volumeNumber:1}});
      onCreated(book.id);
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e)=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/20 px-6 py-4 border-b border-white/8">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-base font-bold text-amber-300 line-clamp-1">{card.title}</h3><p className="text-xs text-white/50 mt-0.5">{card.puzzleType} · {card.nicheLabel}</p></div>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl leading-none mt-0.5">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Puzzle Count</label><div className="flex gap-2 flex-wrap">{[50,75,100,150,200].map(n=><button key={n} onClick={()=>setPuzzleCount(n)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${puzzleCount===n?"bg-amber-500 text-black border-amber-500":"border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"}`}>{n}</button>)}</div></div>
          <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Difficulty</label><div className="flex gap-2">{["Easy","Medium","Hard"].map(d=><button key={d} onClick={()=>setDifficulty(d)} className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${difficulty===d?"bg-amber-500 text-black border-amber-500":"border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"}`}>{d}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Paper</label><div className="flex gap-2">{(["white","cream"] as const).map(p=><button key={p} onClick={()=>setPaperType(p)} className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${paperType===p?"bg-amber-500 text-black border-amber-500":"border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"}`}>{p}</button>)}</div></div>
            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Large Print</label><button onClick={()=>setLargePrint(!largePrint)} className={`w-full py-1.5 rounded-lg text-sm font-medium border transition-colors ${largePrint?"bg-amber-500 text-black border-amber-500":"border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white"}`}>{largePrint?"Yes (8.5×11)":"No (6×9)"}</button></div>
          </div>
          <div className="text-xs text-white/40 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"><span>💵</span><span>Suggested: <strong className="text-amber-400">${card.pricePoint.toFixed(2)}</strong></span><span className="mx-1 text-white/15">·</span><span>Theme: <strong className="text-white/60 capitalize">{card.theme}</strong></span></div>
          <button onClick={handleCreate} disabled={saving} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving?"Creating...":"Create Book & Generate →"}</button>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ card,onQuickCreate }: { card:OpportunityCard; onQuickCreate:(c:OpportunityCard)=>void }) {
  const pot = POTENTIAL_BADGE[card.salesPotential] ?? POTENTIAL_BADGE.Stable;
  return (
    <div className="bg-white/[0.025] border border-white/8 rounded-2xl overflow-hidden hover:border-amber-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5 flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3 mb-3"><ScoreRing score={card.score}/><div className="flex-1 min-w-0"><h4 className="font-bold text-white text-sm leading-snug line-clamp-2">{card.title}</h4><p className="text-xs text-white/40 mt-0.5 line-clamp-1">{card.subtitle}</p></div></div>
        <div className="flex flex-wrap gap-1.5 mb-3"><span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pot.cls}`}>{pot.icon} {card.salesPotential}</span><span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">{PUZZLE_ICONS[card.puzzleType]||"📖"} {card.puzzleType}</span><span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">{card.nicheLabel}</span></div>
        <p className="text-xs text-white/45 leading-relaxed">{card.whySells}</p>
      </div>
      <div className="px-5 pb-5"><button onClick={()=>onQuickCreate(card)} className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 hover:border-amber-500 text-sm font-semibold transition-all duration-150">Quick Create →</button></div>
    </div>
  );
}

export function Home() {
  const { data:books,isLoading,refetch } = useListBooks();
  const deleteBook = useDeleteBook();
  const cloneBook = useCloneBook();
  const { toast } = useToast();
  const [,setLocation] = useLocation();
  const [activeType,setActiveType] = useState<PuzzleTypeFilter>("All");
  const [suggestions,setSuggestions] = useState<OpportunityCard[]>([]);
  const [loadingSuggestions,setLoadingSuggestions] = useState(false);
  const [suggestionsOpen,setSuggestionsOpen] = useState(false);
  const [quickCreateCard,setQuickCreateCard] = useState<OpportunityCard|null>(null);
  const [librarySearch,setLibrarySearch] = useState("");
  const [addingVolumeSeries,setAddingVolumeSeries] = useState<string|null>(null);

  const fetchSuggestions = useCallback(async (type:PuzzleTypeFilter) => {
    setLoadingSuggestions(true); setSuggestionsOpen(true); setSuggestions([]);
    try {
      const res = await fetch("/api/ai/book-ideas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({puzzleType:type==="All"?undefined:type})});
      const data = await res.json(); setSuggestions(data.cards||[]);
    } catch { toast({title:"Could not load suggestions",variant:"destructive"}); }
    finally { setLoadingSuggestions(false); }
  },[toast]);

  const handleDelete = async (id:number) => {
    if(!confirm("Delete this project?")) return;
    try { await deleteBook.mutateAsync({id}); toast({title:"Project deleted"}); refetch(); }
    catch { toast({title:"Error deleting project",variant:"destructive"}); }
  };
  const handleClone = async (id:number) => {
    try { const cloned = await cloneBook.mutateAsync({id}); toast({title:"Project cloned"}); setLocation(`/books/${cloned.id}`); }
    catch { toast({title:"Error cloning project",variant:"destructive"}); }
  };
  const handleAddVolume = async (seriesName:string,highestVolId:number) => {
    setAddingVolumeSeries(seriesName);
    try { const cloned = await cloneBook.mutateAsync({id:highestVolId}); toast({title:`Volume added to "${seriesName}"`}); await refetch(); setLocation(`/books/${cloned.id}`); }
    catch { toast({title:"Failed to add volume",variant:"destructive"}); }
    finally { setAddingVolumeSeries(null); }
  };

  const allSeriesGroups: SeriesGroupData[] = [];
  const allStandaloneBooks: Book[] = [];
  if (books) {
    const groupMap = new Map<string,Book[]>();
    for (const book of books) {
      const sn = book.seriesName;
      if (sn) { if(!groupMap.has(sn)) groupMap.set(sn,[]); groupMap.get(sn)!.push(book); }
      else { allStandaloneBooks.push(book); }
    }
    for (const [name,volumes] of groupMap) {
      if (volumes.length>=2) { const latestUpdate = volumes.reduce((best,v)=>(v.updatedAt>best?v.updatedAt:best),volumes[0]?.updatedAt??""); allSeriesGroups.push({name,volumes,latestUpdate}); }
      else { allStandaloneBooks.push(...volumes); }
    }
    allSeriesGroups.sort((a,b)=>b.latestUpdate.localeCompare(a.latestUpdate));
  }

  const totalBooks = books?.length??0;
  const seriesCount = allSeriesGroups.length;
  const statLine = totalBooks===0 ? "No books yet" : seriesCount>0 ? `${totalBooks} book${totalBooks!==1?"s":""} across ${seriesCount} series` : `${totalBooks} book${totalBooks!==1?"s":""}`;
  const q = librarySearch.trim().toLowerCase();
  const filteredSeriesGroups = q ? allSeriesGroups.filter(g=>g.name.toLowerCase().includes(q)||g.volumes.some(v=>v.title.toLowerCase().includes(q)||v.puzzleType.toLowerCase().includes(q))) : allSeriesGroups;
  const filteredStandalones = q ? allStandaloneBooks.filter(b=>b.title.toLowerCase().includes(q)||b.puzzleType.toLowerCase().includes(q)||(b.seriesName??"").toLowerCase().includes(q)) : allStandaloneBooks;
  const hasFilteredContent = filteredSeriesGroups.length>0||filteredStandalones.length>0;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-white">The Workshop</h1>
            <p className="text-white/35 text-base mt-0.5 font-sketch">{statLine}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/"><button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-lg shadow-amber-500/20">✦ New Book from Studio</button></Link>
          </div>
        </div>

        <div className="space-y-4">
          <div><h2 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-0.5">Discover Opportunities</h2><p className="text-sm text-white/35">Pick a puzzle type — AI finds what sells right now</p></div>
          <div className="flex flex-wrap gap-2">
            {PUZZLE_TYPES.map(type=>(
              <button key={type} onClick={()=>{setActiveType(type);fetchSuggestions(type);}} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${activeType===type&&suggestionsOpen?"bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20":"border-white/10 text-white/55 hover:border-white/25 hover:text-white"}`}>
                {type!=="All"&&<span>{PUZZLE_ICONS[type]}</span>}{type}
              </button>
            ))}
          </div>
          {suggestionsOpen&&(
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/55">{loadingSuggestions?"Analysing KDP market…":`${suggestions.length} opportunit${suggestions.length!==1?"ies":"y"} found`}{!loadingSuggestions&&suggestions.length>0&&<button onClick={()=>fetchSuggestions(activeType)} className="ml-3 text-xs text-amber-400/60 hover:text-amber-400 hover:underline underline-offset-2">Refresh</button>}</span>
                <button onClick={()=>setSuggestionsOpen(false)} className="text-white/20 hover:text-white/60 text-xs transition-colors">✕ Close</button>
              </div>
              {loadingSuggestions?(
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><div key={i} className="bg-white/[0.025] border border-white/8 rounded-2xl p-5 space-y-3 animate-pulse"><div className="flex gap-3"><div className="w-12 h-12 rounded-full bg-white/5"/><div className="flex-1 space-y-2"><div className="h-3 bg-white/8 rounded w-3/4"/><div className="h-2 bg-white/5 rounded w-1/2"/></div></div><div className="space-y-1.5"><div className="h-2 bg-white/5 rounded"/><div className="h-2 bg-white/5 rounded w-5/6"/></div></div>)}</div>
              ):suggestions.length>0?(
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{suggestions.map((card,i)=><SuggestionCard key={i} card={card} onQuickCreate={setQuickCreateCard}/>)}</div>
              ):<div className="text-center py-8 text-white/30 text-sm border border-white/8 rounded-2xl">No suggestions returned. Try again.</div>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest shrink-0">Your Library</h2>
            {!!books?.length&&(
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">🔍</span>
                <input type="text" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Filter books…" className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"/>
                {librarySearch&&<button onClick={()=>setLibrarySearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs">✕</button>}
              </div>
            )}
          </div>
          {isLoading?(<div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-4">{[...Array(9)].map((_,i)=><div key={i} className="bg-white/[0.025] border border-white/8 rounded-sm animate-pulse" style={{paddingBottom:"148%"}}/>)}</div>
          ):!books?.length?(
            <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl"><div className="text-5xl mb-4">✏️</div><p className="font-display text-lg text-white/60 font-bold">Your workshop is empty</p><p className="text-white/30 text-sm mt-1 mb-6">Open the Studio — pick one of today's AI-researched opportunities and it generates automatically.</p><Link href="/"><button className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">Open Studio</button></Link></div>
          ):q&&!hasFilteredContent?(
            <div className="text-center py-10 border border-dashed border-white/8 rounded-2xl text-white/30 text-sm">No books match "<span className="text-white/50">{librarySearch}</span>"</div>
          ):(
            <div className="space-y-8">
              {filteredSeriesGroups.length>0&&<div className="space-y-3">{filteredSeriesGroups.map(group=><SeriesGroup key={group.name} group={group} onAddVolume={handleAddVolume} onDelete={handleDelete} addingVolume={addingVolumeSeries===group.name}/>)}</div>}
              {filteredStandalones.length>0&&(
                <div className="space-y-3">
                  {filteredSeriesGroups.length>0&&<h3 className="text-xs font-semibold text-white/35 uppercase tracking-widest">Standalone Books</h3>}
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-4">{filteredStandalones.map(book=><BookCoverCard key={book.id} book={book} onDelete={handleDelete} onClone={handleClone}/>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {quickCreateCard&&<QuickCreateModal card={quickCreateCard} onClose={()=>setQuickCreateCard(null)} onCreated={(id)=>{setQuickCreateCard(null);refetch();setLocation(`/generate/${id}`);}}/>}
    </div>
  );
}
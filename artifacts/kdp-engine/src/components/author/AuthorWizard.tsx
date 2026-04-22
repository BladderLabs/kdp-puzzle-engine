import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface AuthorPersona {
  id: number;
  penName: string;
  honorific?: string | null;
  bio: string;
  voiceTone: string;
  voiceVocabulary: string;
  voiceAvoid: string[];
  monogramInitials: string;
  monogramSvg: string;
  signatureColor: string;
  portfolioFit?: string | null;
  collisionRisk: string;
  isActive: boolean;
  createdAt: string;
}

async function fetchActivePersona(): Promise<AuthorPersona | null> {
  const res = await fetch("/api/author-persona/active");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load active author persona");
  return res.json();
}

async function createPersona(payload: PortfolioBrief): Promise<AuthorPersona> {
  const res = await fetch("/api/author-persona", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useActivePersona() {
  return useQuery({
    queryKey: ["author-persona", "active"],
    queryFn: fetchActivePersona,
  });
}

interface PortfolioBrief {
  primaryNiches: string[];
  audienceAge: string;
  targetVolumeCount: number;
  preferredGender: "female" | "male" | "ambiguous" | "ai-pick";
  preferredTone: "warm" | "scholarly" | "witty" | "serene" | "investigative" | "ai-pick";
}

interface AuthorWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthorWizard({ open, onOpenChange }: AuthorWizardProps) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"form" | "generating" | "review">("form");
  const [result, setResult] = useState<AuthorPersona | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nichesText, setNichesText] = useState("true crime, cozy mystery, gift books for seniors");
  const [audienceAge, setAudienceAge] = useState("45-75");
  const [targetVolumeCount, setTargetVolumeCount] = useState(20);
  const [gender, setGender] = useState<PortfolioBrief["preferredGender"]>("ai-pick");
  const [tone, setTone] = useState<PortfolioBrief["preferredTone"]>("ai-pick");

  const mutation = useMutation({
    mutationFn: createPersona,
    onMutate: () => {
      setError(null);
      setPhase("generating");
    },
    onSuccess: (persona) => {
      setResult(persona);
      setPhase("review");
      qc.invalidateQueries({ queryKey: ["author-persona"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setPhase("form");
    },
  });

  function handleSubmit() {
    const niches = nichesText.split(",").map(s => s.trim()).filter(Boolean);
    if (niches.length === 0) {
      setError("Enter at least one niche.");
      return;
    }
    mutation.mutate({
      primaryNiches: niches,
      audienceAge: audienceAge.trim() || "45-75",
      targetVolumeCount,
      preferredGender: gender,
      preferredTone: tone,
    });
  }

  function handleAccept() {
    onOpenChange(false);
    // Reset for next time but preserve result in cache
    setPhase("form");
  }

  function handleRegenerate() {
    setResult(null);
    setPhase("form");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Choose Your Author</DialogTitle>
          <DialogDescription>
            One AI-selected pen name, used for every book you publish. Builds author-page authority on Amazon.
          </DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="niches">Primary niches (comma-separated)</Label>
              <Textarea
                id="niches"
                className="h-20 mt-1 text-sm"
                value={nichesText}
                onChange={e => setNichesText(e.target.value)}
                placeholder="true crime, cozy mystery, gift books for seniors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="age">Audience age</Label>
                <Input id="age" className="mt-1" value={audienceAge} onChange={e => setAudienceAge(e.target.value)} placeholder="45-75" />
              </div>
              <div>
                <Label htmlFor="count">Planned volumes</Label>
                <Input id="count" type="number" className="mt-1" value={targetVolumeCount} onChange={e => setTargetVolumeCount(Number(e.target.value) || 1)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gender signal</Label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {(["ai-pick", "female", "male", "ambiguous"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`text-xs py-1.5 rounded-md border capitalize transition-colors ${
                        gender === g
                          ? "bg-amber-500 text-black border-amber-500 font-semibold"
                          : "border-border text-muted-foreground hover:border-amber-500/40"
                      }`}
                    >
                      {g === "ai-pick" ? "AI picks" : g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Voice tone</Label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {(["ai-pick", "warm", "scholarly", "witty", "serene", "investigative"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`text-xs py-1.5 rounded-md border capitalize transition-colors ${
                        tone === t
                          ? "bg-amber-500 text-black border-amber-500 font-semibold"
                          : "border-border text-muted-foreground hover:border-amber-500/40"
                      }`}
                    >
                      {t === "ai-pick" ? "AI picks" : t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Generate Author</Button>
            </div>
          </div>
        )}

        {phase === "generating" && (
          <div className="py-10 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating candidate pen names, checking Amazon collisions, writing bio…
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-sketch">takes 15–30 seconds</p>
          </div>
        )}

        {phase === "review" && result && (
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-4">
              <div
                className="w-24 h-24 flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: result.monogramSvg }}
              />
              <div className="flex-1">
                <div className="font-display text-2xl font-bold" style={{ color: result.signatureColor }}>
                  {result.penName}
                </div>
                {result.honorific && <div className="text-xs text-muted-foreground">{result.honorific}</div>}
                <div className="mt-2 text-[11px] text-muted-foreground uppercase tracking-widest">
                  Voice: {result.voiceTone} · Collision risk: {result.collisionRisk}
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Author Bio</p>
              <p className="text-sm leading-relaxed">{result.bio}</p>
            </div>
            {result.portfolioFit && (
              <div className="border-t pt-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Portfolio Fit</p>
                <p className="text-sm italic">{result.portfolioFit}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleRegenerate}>Try another</Button>
              <Button onClick={handleAccept} style={{ background: result.signatureColor }}>Use this author</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

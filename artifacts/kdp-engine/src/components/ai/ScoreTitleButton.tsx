import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScoreTitleButtonProps {
  title: string;
  puzzleType?: string;
  niche?: string;
}

interface TitleScore {
  score: number;
  feedback: string;
  suggestions: string[];
}

function scoreColor(score: number) {
  if (score >= 8) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 5) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export function ScoreTitleButton({ title, puzzleType, niche }: ScoreTitleButtonProps) {
  const [result, setResult] = useState<TitleScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScore = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/score-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, puzzleType, niche }),
      });
      if (!res.ok) throw new Error("Failed to score title");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Couldn't score title. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleScore}
        disabled={loading || !title.trim()}
        className="text-xs h-7 border-violet-300 text-violet-700 hover:bg-violet-50"
      >
        {loading ? "Scoring..." : "Score my title"}
      </Button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {result && (
        <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-sm font-bold ${scoreColor(result.score)}`}>
              {result.score}/10
            </Badge>
            <span className="text-muted-foreground text-xs">{result.feedback}</span>
          </div>
          {result.suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Suggested rewrites:</p>
              {result.suggestions.map((s, i) => (
                <p key={i} className="text-xs bg-background border rounded px-2 py-1">{s}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

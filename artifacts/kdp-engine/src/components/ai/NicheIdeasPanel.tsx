import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NicheIdea {
  niche: string;
  nicheLabel: string;
  whySells: string;
}

interface NicheIdeasPanelProps {
  puzzleType: string;
  onSelectNiche?: (nicheKey: string) => void;
}

export function NicheIdeasPanel({ puzzleType, onSelectNiche }: NicheIdeasPanelProps) {
  const [ideas, setIdeas] = useState<NicheIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastType, setLastType] = useState<string | null>(null);

  useEffect(() => {
    if (!puzzleType || puzzleType === lastType) return;
    setLastType(puzzleType);
    setLoading(true);
    fetch("/api/ai/niche-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleType }),
    })
      .then(r => r.json())
      .then(data => setIdeas(data.ideas || []))
      .catch(() => setIdeas([]))
      .finally(() => setLoading(false));
  }, [puzzleType, lastType]);

  if (!puzzleType) return null;

  return (
    <Card className="border-violet-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <span className="text-violet-600 text-xs">AI</span>
          Top Niches for {puzzleType}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : (
          ideas.map((idea, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-1">
              <div className="space-y-0.5 flex-1">
                <p className="text-xs font-medium">{idea.nicheLabel}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{idea.whySells}</p>
              </div>
              {onSelectNiche && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50 shrink-0"
                  onClick={() => onSelectNiche(idea.niche)}
                >
                  Pick
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

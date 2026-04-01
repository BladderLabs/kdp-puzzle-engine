import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookFormValues } from "@/components/book/BookForm";

interface OpportunityCard {
  puzzleType: string;
  niche: string;
  nicheLabel: string;
  salesPotential: "Hot" | "Rising" | "Stable";
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

interface AiOpportunityCardsProps {
  onApply: (values: Partial<BookFormValues>) => void;
  puzzleType?: string;
}

const BADGE_COLORS = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  Rising: "bg-amber-100 text-amber-700 border-amber-200",
  Stable: "bg-green-100 text-green-700 border-green-200",
};

export function AiOpportunityCards({ onApply, puzzleType }: AiOpportunityCardsProps) {
  const [cards, setCards] = useState<OpportunityCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/book-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleType }),
      });
      if (!res.ok) throw new Error("Failed to fetch ideas");
      const data = await res.json();
      setCards(data.cards || []);
      setFetched(true);
    } catch {
      setError("Claude couldn't generate ideas right now. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!fetched && !loading) {
    return (
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-violet-600">AI</span> Market Opportunity
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Get AI-powered recommendations for the most profitable KDP niches right now.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchIdeas} className="w-full bg-violet-600 hover:bg-violet-700">
            Generate Ideas
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-violet-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-violet-600">AI</span> Market Opportunity
          </CardTitle>
          <p className="text-sm text-muted-foreground">Claude is analyzing the market...</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2 p-3 border rounded-lg">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-violet-600">AI</span> Market Opportunity
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchIdeas} disabled={loading}>
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="p-3 border rounded-lg hover:border-violet-300 hover:bg-violet-50 transition-colors space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm leading-tight">{card.puzzleType} — {card.nicheLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.whySells}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${BADGE_COLORS[card.salesPotential] || ""}`}
              >
                {card.salesPotential}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              <span className="bg-muted px-1.5 py-0.5 rounded">{card.difficulty}</span>
              <span className="bg-muted px-1.5 py-0.5 rounded">{card.puzzleCount} puzzles</span>
              <span className="bg-muted px-1.5 py-0.5 rounded">${card.pricePoint}</span>
              {card.largePrint && <span className="bg-muted px-1.5 py-0.5 rounded">Large Print</span>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7 border-violet-300 text-violet-700 hover:bg-violet-50"
              onClick={() =>
                onApply({
                  puzzleType: card.puzzleType,
                  niche: card.niche,
                  difficulty: card.difficulty,
                  puzzleCount: card.puzzleCount,
                  largePrint: card.largePrint,
                  coverStyle: card.coverStyle,
                  theme: card.theme,
                  title: card.title,
                  subtitle: card.subtitle,
                })
              }
            >
              Use this idea
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

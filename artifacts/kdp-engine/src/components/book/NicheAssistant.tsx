import { useState } from "react";
import { useListNiches, useGetNicheData } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

import type { NicheResult, NicheInfo } from "@workspace/api-client-react";

interface NicheAssistantProps {
  puzzleType: string;
  onApply: (data: NicheResult) => void;
}

export function NicheAssistant({ puzzleType, onApply }: NicheAssistantProps) {
  const { data: niches } = useListNiches();
  const getNicheData = useGetNicheData();
  const [selectedNiche, setSelectedNiche] = useState<string>("");

  const filteredNiches: NicheInfo[] = niches?.filter((n: NicheInfo) => n.puzzleType === puzzleType) ?? [];

  const handleLoad = async () => {
    if (!selectedNiche) return;
    const data = await getNicheData.mutateAsync({ data: { niche: selectedNiche } });
    if (data) {
      onApply(data);
    }
  };

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <span>✨</span> Niche Assistant
        </CardTitle>
        <CardDescription>Auto-populate content with proven KDP niches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={selectedNiche} onValueChange={setSelectedNiche}>
            <SelectTrigger>
              <SelectValue placeholder="Select a niche..." />
            </SelectTrigger>
            <SelectContent>
              {filteredNiches.map(n => (
                <SelectItem key={n.key} value={n.key}>{n.label}</SelectItem>
              ))}
              {filteredNiches.length === 0 && <SelectItem value="none" disabled>No niches for this type</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <Button 
          className="w-full" 
          variant="secondary"
          onClick={handleLoad}
          disabled={!selectedNiche || getNicheData.isPending}
        >
          {getNicheData.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Load Niche Data
        </Button>

        {getNicheData.data && (
          <div className="space-y-3 pt-4 border-t border-primary/10">
            <div className="text-sm font-medium">Included:</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{getNicheData.data.words.length} Words</Badge>
              <Badge variant="outline">Titles</Badge>
              <Badge variant="outline">Back Blurb</Badge>
              <Badge variant="outline">Keywords</Badge>
            </div>
            
            <div className="text-xs text-muted-foreground mt-2">
              <strong>Keywords to use in KDP:</strong>
              <div className="mt-1 flex flex-wrap gap-1">
                {getNicheData.data.keywords.map((k: string, i: number) => (
                  <span key={i} className="bg-background px-1.5 py-0.5 rounded border">{k}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

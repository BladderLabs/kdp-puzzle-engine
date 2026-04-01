import { useEffect, useState } from "react";
import { usePreviewPuzzles } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PreviewPaneProps {
  puzzleType: string;
  difficulty?: string;
  largePrint?: boolean;
  words?: string[];
}

export function PreviewPane({ puzzleType, difficulty, largePrint, words }: PreviewPaneProps) {
  const previewPuzzles = usePreviewPuzzles();
  const [debouncedWords, setDebouncedWords] = useState(words);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWords(words);
    }, 1000);
    return () => clearTimeout(timer);
  }, [words]);

  useEffect(() => {
    previewPuzzles.mutate({
      data: {
        puzzleType,
        difficulty,
        largePrint,
        words: debouncedWords,
        count: 2
      }
    });
  }, [puzzleType, difficulty, largePrint, debouncedWords]);

  const { data, isPending, isError } = previewPuzzles;

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">Live Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <div className="text-sm text-destructive p-4 border border-destructive/20 rounded">
            Could not load preview. Check your configuration.
          </div>
        ) : !data?.puzzles?.length ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No preview available
          </div>
        ) : (
          <div className="space-y-6">
            {data.puzzles.map((p, i) => (
              <div key={i} className="border p-4 bg-white text-black dark:bg-zinc-100 rounded">
                <PuzzleRenderer puzzle={p} type={puzzleType} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PuzzleRenderer({ puzzle, type }: { puzzle: any, type: string }) {
  if (type === "Word Search" && puzzle.wordSearch) {
    const ws = puzzle.wordSearch;
    return (
      <div className="flex flex-col gap-4 text-center font-mono text-xs font-bold leading-none tracking-widest">
        <div>
          {ws.grid.map((row: string[], r: number) => (
            <div key={r}>{row.join(' ')}</div>
          ))}
        </div>
        <div className="grid grid-cols-2 text-left gap-1 border-t pt-2 mt-2">
          {ws.placed.slice(0, 10).map((w: string, i: number) => (
            <div key={i}>{w}</div>
          ))}
          {ws.placed.length > 10 && <div>...</div>}
        </div>
      </div>
    );
  }
  if (type === "Sudoku" && puzzle.sudoku) {
    const su = puzzle.sudoku.puzzle;
    return (
      <div className="aspect-square w-full grid grid-cols-9 grid-rows-9 border-2 border-black">
        {su.map((row: number[], r: number) => 
          row.map((cell: number, c: number) => (
            <div key={`${r}-${c}`} className={`flex items-center justify-center border-black/30 font-bold text-xs 
              ${r % 3 === 2 && r !== 8 ? 'border-b-2' : 'border-b'} 
              ${c % 3 === 2 && c !== 8 ? 'border-r-2' : 'border-r'}
            `}>
              {cell || ''}
            </div>
          ))
        )}
      </div>
    );
  }
  if (type === "Maze" && puzzle.maze) {
    return <div className="text-center font-bold text-sm text-muted-foreground p-8 border">Maze Preview (Visual placeholder)</div>;
  }
  if (type === "Number Search" && puzzle.numberSearch) {
    const ns = puzzle.numberSearch;
    return (
      <div className="flex flex-col gap-4 text-center font-mono text-xs font-bold leading-none tracking-widest">
        <div>
          {ns.grid.map((row: string[], r: number) => (
            <div key={r}>{row.join(' ')}</div>
          ))}
        </div>
      </div>
    );
  }
  if (type === "Cryptogram" && puzzle.cryptogram) {
    const cr = puzzle.cryptogram;
    return (
      <div className="text-left font-mono space-y-4">
        <div className="tracking-widest leading-loose text-sm">{cr.cipher}</div>
        <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">A B C D E F ...</div>
      </div>
    );
  }
  return <div>Unknown puzzle type</div>;
}

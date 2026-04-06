import { useEffect, useState } from "react";
import { usePreviewPuzzles } from "@workspace/api-client-react";
import type { PuzzleData } from "@workspace/api-client-react";
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
    }, 800);
    return () => clearTimeout(timer);
  }, [words]);

  useEffect(() => {
    previewPuzzles.mutate({
      data: {
        puzzleType,
        difficulty,
        largePrint,
        words: debouncedWords,
        count: 2,
      },
    });
  }, [puzzleType, difficulty, largePrint, debouncedWords]);

  const { data, isPending, isError } = previewPuzzles;

  return (
    <Card className="sticky top-6" data-testid="preview-pane">
      <CardHeader>
        <CardTitle className="text-lg">Live Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <div
            className="text-sm text-destructive p-4 border border-destructive/20 rounded"
            data-testid="preview-error"
          >
            Could not load preview.
          </div>
        ) : !data?.puzzles?.length ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No preview available
          </div>
        ) : (
          <div className="space-y-4" data-testid="preview-content">
            {data.puzzles.map((puzzle, i) => (
              <div
                key={i}
                className="border rounded p-3 bg-white text-black overflow-auto"
                data-testid={`preview-puzzle-${i}`}
              >
                <PuzzleRenderer puzzle={puzzle} type={puzzleType} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PuzzleRenderer({ puzzle, type }: { puzzle: PuzzleData; type: string }) {
  if (type === "Word Search" && puzzle.wordSearch) {
    const ws = puzzle.wordSearch;
    return (
      <div className="flex flex-col gap-3 text-center">
        <div className="font-mono text-[10px] font-bold leading-tight tracking-widest overflow-x-auto">
          {ws.grid.map((row, r) => (
            <div key={r}>{row.join(" ")}</div>
          ))}
        </div>
        <div className="border-t pt-2 text-left font-mono text-[9px] columns-2 gap-1">
          {ws.placed.slice(0, 16).map((w, i) => (
            <div key={i} className="leading-relaxed">{w}</div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "Sudoku" && puzzle.sudoku) {
    const su = puzzle.sudoku.puzzle;
    return (
      <div className="w-full aspect-square grid grid-cols-9 border-2 border-black max-w-[220px] mx-auto">
        {su.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className={[
                "flex items-center justify-center font-bold text-[10px] border-black/30",
                r % 3 === 2 && r !== 8 ? "border-b-2" : "border-b",
                c % 3 === 2 && c !== 8 ? "border-r-2" : "border-r",
                r === 0 ? "border-t-0" : "",
                c === 0 ? "border-l-0" : "",
                cell ? "text-black" : "text-gray-300",
              ].join(" ")}
            >
              {cell || ""}
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === "Maze" && puzzle.maze) {
    const mz = puzzle.maze;
    const N = 1, E = 2, S = 4, W = 8;
    const CELL = 10;
    return (
      <div className="overflow-auto" data-testid="maze-preview">
        <table
          style={{ borderCollapse: "collapse", margin: "0 auto" }}
          aria-label="Maze preview"
        >
          <tbody>
            {mz.grid.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const isStart = r === 0 && c === 0;
                  const isEnd = r === mz.rows - 1 && c === mz.cols - 1;
                  return (
                    <td
                      key={c}
                      style={{
                        width: CELL,
                        height: CELL,
                        fontSize: 6,
                        textAlign: "center",
                        verticalAlign: "middle",
                        background: isStart ? "#4ade80" : isEnd ? "#f87171" : undefined,
                        borderTop: !(cell & N) ? "1.5px solid #333" : "1px solid transparent",
                        borderRight: !(cell & E) ? "1.5px solid #333" : "1px solid transparent",
                        borderBottom: !(cell & S) ? "1.5px solid #333" : "1px solid transparent",
                        borderLeft: !(cell & W) ? "1.5px solid #333" : "1px solid transparent",
                      }}
                    >
                      {isStart ? "S" : isEnd ? "F" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] text-center text-gray-500 mt-1">S = Start &nbsp; F = Finish</p>
      </div>
    );
  }

  if (type === "Number Search" && puzzle.numberSearch) {
    const ns = puzzle.numberSearch;
    return (
      <div className="font-mono text-[10px] font-bold leading-tight tracking-widest text-center overflow-x-auto">
        {ns.grid.map((row, r) => (
          <div key={r}>{row.join(" ")}</div>
        ))}
        <div className="border-t pt-2 text-left columns-2 gap-1 mt-2">
          {ns.placed.slice(0, 10).map((s, i) => (
            <div key={i} className="leading-relaxed">{s}</div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "Cryptogram" && puzzle.cryptogram) {
    const cr = puzzle.cryptogram;
    return (
      <div className="text-left space-y-3">
        <div className="font-mono text-[10px] tracking-widest leading-loose break-words">
          {cr.cipher}
        </div>
        <div className="text-[9px] text-gray-400 border-t pt-2 font-mono">
          Decode the cipher to reveal the hidden quote
        </div>
      </div>
    );
  }

  if (type === "Crossword" && puzzle.crossword) {
    const cw = puzzle.crossword;
    const CELL = 18;
    const numMap: Record<string, number> = cw.nums || {};
    return (
      <div className="space-y-3 overflow-auto">
        {/* Grid */}
        <div className="flex justify-center">
          <table style={{ borderCollapse: "collapse" }} aria-label="Crossword grid preview">
            <tbody>
              {cw.grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    const isBlack = cell === "#";
                    const num = numMap[`${r},${c}`];
                    return (
                      <td
                        key={c}
                        style={{
                          width: CELL,
                          height: CELL,
                          background: isBlack ? "#111" : "#fff",
                          border: "1px solid #555",
                          position: "relative",
                          verticalAlign: "bottom",
                          textAlign: "center",
                          padding: 0,
                          fontSize: 7,
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          color: "#000",
                        }}
                      >
                        {!isBlack && num && (
                          <span style={{ position: "absolute", top: 0, left: 1, fontSize: 5, color: "#555", lineHeight: 1 }}>
                            {num}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Clues */}
        <div className="grid grid-cols-2 gap-x-3 text-[9px]">
          <div>
            <div className="font-bold text-[10px] mb-1 text-gray-700">ACROSS</div>
            {cw.across.slice(0, 8).map((cl) => (
              <div key={cl.num} className="leading-snug text-gray-600">
                <span className="font-bold text-gray-800">{cl.num}.</span> {cl.clue}
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold text-[10px] mb-1 text-gray-700">DOWN</div>
            {cw.down.slice(0, 8).map((cl) => (
              <div key={cl.num} className="leading-snug text-gray-600">
                <span className="font-bold text-gray-800">{cl.num}.</span> {cl.clue}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <div className="text-sm text-gray-400 text-center py-4">Puzzle type not recognized</div>;
}

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CoverPreviewProps {
  title: string;
  subtitle?: string;
  author?: string;
  theme?: string;
  coverStyle?: string;
  volumeNumber?: number;
  puzzleCount?: number;
  difficulty?: string;
  largePrint?: boolean;
  paperType?: string;
  backDescription?: string;
}

const PREVIEW_WIDTH = 240;
const IFRAME_NATURAL_WIDTH = 1200;
const IFRAME_NATURAL_HEIGHT = 892;
const SCALE = PREVIEW_WIDTH / IFRAME_NATURAL_WIDTH;
const CONTAINER_HEIGHT = Math.round(IFRAME_NATURAL_HEIGHT * SCALE);

export function CoverPreview(props: CoverPreviewProps) {
  const {
    title, subtitle, author, theme, coverStyle,
    volumeNumber, puzzleCount, difficulty, largePrint, paperType, backDescription,
  } = props;

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch("/api/cover-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "My Book",
            subtitle: subtitle || undefined,
            author: author || undefined,
            theme: theme || "midnight",
            coverStyle: coverStyle || "classic",
            volumeNumber: volumeNumber ?? 0,
            puzzleCount: puzzleCount || 50,
            difficulty: difficulty || "Medium",
            largePrint: largePrint ?? false,
            paperType: paperType || "white",
            backDescription: backDescription || undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Preview failed");
        const data = (await res.json()) as { html: string };
        setHtml(data.html);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [title, subtitle, author, theme, coverStyle, volumeNumber, puzzleCount, difficulty, largePrint, paperType, backDescription]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cover Preview</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div
          style={{
            width: PREVIEW_WIDTH,
            height: CONTAINER_HEIGHT,
            overflow: "hidden",
            borderRadius: 4,
            position: "relative",
            background: "#111",
          }}
        >
          {loading || !html ? (
            <Skeleton style={{ width: "100%", height: "100%" }} />
          ) : (
            <iframe
              srcDoc={html}
              title="Cover Preview"
              style={{
                width: IFRAME_NATURAL_WIDTH,
                height: IFRAME_NATURAL_HEIGHT,
                border: "none",
                transform: `scale(${SCALE})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
              sandbox="allow-same-origin"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Live cover preview · updates as you type
        </p>
      </CardContent>
    </Card>
  );
}

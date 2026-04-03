import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { coverPreview } from "@workspace/api-client-react";
import type { CoverDims, CoverPreviewRequest } from "@workspace/api-client-react";

interface CoverPreviewProps {
  title: string;
  subtitle?: string;
  author?: string;
  theme?: string;
  coverStyle?: string;
  volumeNumber?: number;
  puzzleCount?: number;
  puzzleType?: string;
  difficulty?: string;
  largePrint?: boolean;
  paperType?: string;
  backDescription?: string;
  coverImageUrl?: string;
}

const DISPLAY_WIDTH = 240;

function computeScale(dims: CoverDims | null) {
  if (!dims) return { scale: DISPLAY_WIDTH / 1200, iframeW: 1200, iframeH: 892, containerH: Math.round(892 * DISPLAY_WIDTH / 1200) };
  const iframeW = Math.round(dims.fullW * 96);
  const iframeH = Math.round(dims.fullH * 96);
  const scale = DISPLAY_WIDTH / iframeW;
  const containerH = Math.round(iframeH * scale);
  return { scale, iframeW, iframeH, containerH };
}

export function CoverPreview(props: CoverPreviewProps) {
  const {
    title, subtitle, author, theme, coverStyle,
    volumeNumber, puzzleCount, puzzleType, difficulty, largePrint, paperType, backDescription,
    coverImageUrl,
  } = props;

  const [html, setHtml] = useState<string | null>(null);
  const [dims, setDims] = useState<CoverDims | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const req: CoverPreviewRequest = {
          title: title || "My Book",
          subtitle: subtitle || undefined,
          author: author || undefined,
          theme: theme || "midnight",
          coverStyle: coverStyle || "classic",
          volumeNumber: volumeNumber ?? 0,
          puzzleCount: puzzleCount || 50,
          puzzleType: puzzleType || "Word Search",
          difficulty: difficulty || "Medium",
          largePrint: largePrint ?? false,
          paperType: paperType || "white",
          backDescription: backDescription || undefined,
          coverImageUrl: coverImageUrl || undefined,
        };
        const result = await coverPreview(req, { signal: controller.signal });
        setHtml(result.html);
        setDims(result.coverDims);
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
  }, [title, subtitle, author, theme, coverStyle, volumeNumber, puzzleCount, puzzleType, difficulty, largePrint, paperType, backDescription, coverImageUrl]);

  const { scale, iframeW, iframeH, containerH } = computeScale(dims);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cover Preview</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div
          style={{
            width: DISPLAY_WIDTH,
            height: containerH,
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
                width: iframeW,
                height: iframeH,
                border: "none",
                transform: `scale(${scale})`,
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

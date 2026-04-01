import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBook, useGenerateBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export function GenerateBook() {
  const { id } = useParams();
  const bookId = Number(id);
  const { data: book, isLoading } = useGetBook(bookId, { query: { enabled: !!bookId, queryKey: ['book', bookId] } });
  const generateBook = useGenerateBook();
  const { toast } = useToast();

  const [status, setStatus] = useState<"idle" | "generating" | "pdf_interior" | "pdf_cover" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);

  const handleGenerate = async () => {
    if (!book) return;
    try {
      setStatus("generating");
      setProgress(20);
      
      const config = {
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        puzzleType: book.puzzleType as any,
        puzzleCount: book.puzzleCount,
        difficulty: book.difficulty as any,
        largePrint: book.largePrint,
        paperType: book.paperType as any,
        theme: book.theme as any,
        coverStyle: book.coverStyle as any,
        backDescription: book.backDescription,
        words: book.words,
        volumeNumber: book.volumeNumber
      };

      const result = await generateBook.mutateAsync({ data: config });
      
      setStatus("pdf_interior");
      setProgress(60);
      
      const interiorRes = await fetch('/api/pdf/interior', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ html: result.interiorHtml, pages: result.totalPages }) 
      });
      if (!interiorRes.ok) throw new Error("Failed to render interior PDF");
      const interiorBlob = await interiorRes.blob();
      downloadBlob(interiorBlob, `${book.title}-interior.pdf`);

      setStatus("pdf_cover");
      setProgress(80);
      
      const coverRes = await fetch('/api/pdf/cover', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ html: result.coverHtml, fullW: result.coverDims.fullW, fullH: result.coverDims.fullH }) 
      });
      if (!coverRes.ok) throw new Error("Failed to render cover PDF");
      const coverBlob = await coverRes.blob();
      downloadBlob(coverBlob, `${book.title}-cover.pdf`);

      setStatus("done");
      setProgress(100);
      toast({ title: "Book generated successfully!" });

    } catch (e: any) {
      console.error(e);
      setStatus("error");
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div>Loading...</div>;
  if (!book) return <div>Book not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Generate Assets: {book.title}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Book Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div><strong className="text-foreground">Type:</strong> {book.puzzleType}</div>
          <div><strong className="text-foreground">Count:</strong> {book.puzzleCount} puzzles</div>
          <div><strong className="text-foreground">Size:</strong> {book.largePrint ? '8.5"x11"' : '6"x9"'}</div>
          <div><strong className="text-foreground">Paper:</strong> {book.paperType}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-6 text-center">
          {status !== "idle" && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">
                {status === "generating" && "Generating puzzles (this may take a minute)..."}
                {status === "pdf_interior" && "Rendering interior PDF..."}
                {status === "pdf_cover" && "Rendering cover PDF..."}
                {status === "done" && "Generation complete!"}
                {status === "error" && "An error occurred."}
              </p>
            </div>
          )}
          
          <Button 
            size="lg" 
            className="w-full text-lg h-16" 
            onClick={handleGenerate}
            disabled={status !== "idle" && status !== "done" && status !== "error"}
          >
            {status === "done" ? "Generate Again" : "Generate Interior + Cover PDFs"}
          </Button>

          {status === "done" && (
            <div className="text-left mt-8 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-bold mb-2">KDP Upload Checklist</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Upload the Interior PDF exactly as generated.</li>
                <li>Upload the Cover PDF exactly as generated.</li>
                <li>Set interior type to: Black & white interior with {book.paperType} paper</li>
                <li>Set bleed settings to: Bleed (PDF only)</li>
                <li>Set trim size to: {book.largePrint ? '8.5 x 11 in' : '6 x 9 in'}</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

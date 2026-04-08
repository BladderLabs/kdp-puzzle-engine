import { useState, useRef } from "react";
import { useCreateBook } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BookForm, BookFormValues } from "@/components/book/BookForm";
import { AiOpportunityCards } from "@/components/ai/AiOpportunityCards";
import { AskAiSidebar } from "@/components/ai/AskAiSidebar";
import { Button } from "@/components/ui/button";

export function CreateBook() {
  const createBook = useCreateBook();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const applyRef = useRef<((values: Partial<BookFormValues>) => void) | null>(null);
  const [showAiCards, setShowAiCards] = useState(false);

  const onSubmit = async (values: BookFormValues) => {
    try {
      const book = await createBook.mutateAsync({
        data: {
          ...values,
          words: values.words?.split("\n").map(w => w.trim()).filter(Boolean),
          keywords: values.keywords?.split("\n").map(k => k.trim()).filter(Boolean).slice(0, 7),
        }
      });
      toast({ title: "Project created!" });
      setLocation(`/books/${book.id}`);
    } catch {
      toast({ title: "Failed to create project", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Book</h1>
        <div className="flex items-center gap-2">
          <Link href="/agent-create">
            <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/70">
              🧠 AI Create Book
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiCards(v => !v)}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            ✨ {showAiCards ? "Hide AI Ideas" : "AI Market Ideas"}
          </Button>
        </div>
      </div>

      {showAiCards && (
        <AiOpportunityCards
          onApply={(values) => applyRef.current?.(values)}
        />
      )}

      <BookForm
        onSubmit={onSubmit}
        isSubmitting={createBook.isPending}
        onApplyRef={applyRef}
      />

      <AskAiSidebar context="New Book Creation" />
    </div>
  );
}

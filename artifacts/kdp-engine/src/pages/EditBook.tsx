import { useGetBook, useUpdateBook } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BookForm, BookFormValues } from "@/components/book/BookForm";
import { Skeleton } from "@/components/ui/skeleton";
import { AskAiSidebar } from "@/components/ai/AskAiSidebar";

export function EditBook() {
  const { id } = useParams();
  const bookId = Number(id);
  const { data: book, isLoading } = useGetBook(bookId, { query: { enabled: !!bookId, queryKey: ['book', bookId] } });
  const updateBook = useUpdateBook();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const onSubmit = async (values: BookFormValues) => {
    try {
      await updateBook.mutateAsync({
        id: bookId,
        data: {
          ...values,
          words: values.words?.split("\n").map(w => w.trim()).filter(Boolean)
        }
      });
      toast({ title: "Project saved!" });
      setLocation("/");
    } catch (e) {
      toast({ title: "Failed to save project", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="space-y-6 max-w-7xl mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[600px] w-full" /></div>;
  if (!book) return <div>Book not found</div>;

  const initialValues = {
    ...book,
    words: book.words?.join("\n") || ""
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Edit Project: {book.title}</h1>
      <BookForm initialValues={initialValues} onSubmit={onSubmit} isSubmitting={updateBook.isPending} />
      <AskAiSidebar context={`Editing: ${book.title} (${book.puzzleType})`} />
    </div>
  );
}

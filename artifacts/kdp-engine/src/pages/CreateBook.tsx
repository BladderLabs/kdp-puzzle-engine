import { useCreateBook } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BookForm, BookFormValues } from "@/components/book/BookForm";

export function CreateBook() {
  const createBook = useCreateBook();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const onSubmit = async (values: BookFormValues) => {
    try {
      const book = await createBook.mutateAsync({
        data: {
          ...values,
          words: values.words?.split("\n").map(w => w.trim()).filter(Boolean)
        }
      });
      toast({ title: "Project created!" });
      setLocation(`/books/${book.id}`);
    } catch (e) {
      toast({ title: "Failed to create project", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Project</h1>
      <BookForm onSubmit={onSubmit} isSubmitting={createBook.isPending} />
    </div>
  );
}

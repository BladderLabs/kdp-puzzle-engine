import { useListBooks, useDeleteBook, useCloneBook } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function Home() {
  const { data: books, isLoading, refetch } = useListBooks();
  const deleteBook = useDeleteBook();
  const cloneBook = useCloneBook();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteBook.mutateAsync({ id });
      toast({ title: "Project deleted" });
      refetch();
    } catch (e) {
      toast({ title: "Error deleting project", variant: "destructive" });
    }
  };

  const handleClone = async (id: number) => {
    try {
      const cloned = await cloneBook.mutateAsync({ id });
      toast({ title: "Project cloned" });
      setLocation(`/books/${cloned.id}`);
    } catch (e) {
      toast({ title: "Error cloning project", variant: "destructive" });
    }
  };

  if (isLoading) return <div>Loading projects...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your Projects</h1>
        <Button asChild>
          <Link href="/create">New Book</Link>
        </Button>
      </div>

      {!books?.length ? (
        <Card className="text-center p-12 border-dashed">
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>Create your first KDP puzzle book project to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="mt-4">
              <Link href="/create">Create First Book</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map(book => (
            <Card key={book.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-1">{book.title}</CardTitle>
                <CardDescription>{book.puzzleType} • {book.puzzleCount} puzzles</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Difficulty: {book.difficulty || "Mixed"}</p>
                  <p>Size: {book.largePrint ? '8.5"x11" (Large)' : '6"x9" (Standard)'}</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/books/${book.id}`}>Edit</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleClone(book.id)}>
                  Clone
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/generate/${book.id}`}>Generate</Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(book.id)}>
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

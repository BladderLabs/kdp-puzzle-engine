import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskAiSidebarProps {
  context?: string;
}

export function AskAiSidebar({ context }: AskAiSidebarProps) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  const ensureConversation = async (): Promise<number> => {
    if (conversationId) return conversationId;
    const res = await fetch("/api/anthropic/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: context ? `KDP: ${context}` : "KDP Assistant" }),
    });
    const data = await res.json();
    setConversationId(data.id);
    return data.id;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamBuffer("");

    try {
      const convId = await ensureConversation();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullText += event.content;
              setStreamBuffer(fullText);
            }
            if (event.done) {
              setMessages(prev => [...prev, { role: "assistant", content: fullText }]);
              setStreamBuffer("");
            }
          } catch {
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
      }
    } finally {
      setStreaming(false);
      setStreamBuffer("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 shadow-lg border-violet-300 text-violet-700 hover:bg-violet-50 bg-white"
      >
        Ask AI
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl border-violet-200 flex flex-col" style={{ maxHeight: "60vh" }}>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <span className="text-violet-600">AI</span> KDP Assistant
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          ✕
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 p-3 pt-0 flex-1 min-h-0">
        <ScrollArea className="flex-1 pr-1" ref={scrollRef as React.Ref<HTMLDivElement>}>
          <div className="space-y-2 pb-1">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Ask anything about KDP publishing, pricing, or niches.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs ${
                  m.role === "user"
                    ? "bg-violet-600 text-white ml-4"
                    : "bg-muted text-foreground mr-4"
                }`}
              >
                {m.content}
              </div>
            ))}
            {streamBuffer && (
              <div className="bg-muted text-foreground mr-4 rounded-lg px-3 py-2 text-xs">
                {streamBuffer}
                <span className="animate-pulse">▍</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about pricing, niches, keywords..."
            className="text-xs resize-none h-16 min-h-0"
            disabled={streaming}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="self-end bg-violet-600 hover:bg-violet-700 shrink-0"
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

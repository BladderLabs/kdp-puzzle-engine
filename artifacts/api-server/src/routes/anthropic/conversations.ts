import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { CreateAnthropicConversationBody, SendAnthropicMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

const KDP_SYSTEM_PROMPT = `You are an expert Amazon KDP (Kindle Direct Publishing) puzzle book consultant with deep knowledge of the self-publishing market. You help creators build profitable puzzle books in these categories:

Niches available: seniors, kids, christmas, nurses, teachers, dogs, cats, sudoku-easy, sudoku-hard, halloween, mothers-day, truckers, gardening, bible, cooking, travel, maze-kids, cryptogram-adults, number-search, fathers-day, graduation, valentines, sports, space, retirement, minecraft, birthdays, anxiety-mindfulness, thanksgiving, easter-spring, maze-adults

Puzzle types: Word Search, Sudoku, Maze, Number Search, Cryptogram

You give concise, actionable advice on:
- Profitable niche and puzzle type combinations
- Amazon keyword strategy and title optimization
- Pricing ($5.99–$9.99 range for most puzzle books)
- Cover design for maximum conversion
- Page count and difficulty recommendations
- Seasonal vs evergreen sales patterns

Keep responses focused and actionable. Use bullet points where helpful.`;

router.get("/anthropic/conversations", async (req, res) => {
  try {
    const convs = await db.select().from(conversationsTable).orderBy(asc(conversationsTable.createdAt));
    res.json(convs);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/anthropic/conversations", async (req, res) => {
  try {
    const { title } = CreateAnthropicConversationBody.parse(req.body);
    const [conv] = await db.insert(conversationsTable).values({ title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(400).json({ error: "Failed to create conversation" });
  }
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    const messages = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt));
    res.json({ ...conv, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const messages = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt));
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const { content } = SendAnthropicMessageBody.parse(req.body);

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.insert(messagesTable).values({ conversationId: convId, role: "user", content });

    const history = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(asc(messagesTable.createdAt));

    const chatMessages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: KDP_SYSTEM_PROMPT,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: convId, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;

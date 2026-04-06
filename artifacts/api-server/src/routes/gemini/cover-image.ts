import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * POST /gemini/cover-image
 * Generates an AI cover image for a KDP book using Gemini image generation.
 * Body: { theme, puzzleType, title, style? }
 * Returns: { b64_json, mimeType, dataUrl }
 */
router.post("/gemini/cover-image", async (req, res) => {
  try {
    const { generateImage } = await import("@workspace/integrations-gemini-ai/image");
    const { theme = "midnight", puzzleType = "Word Search", title = "", style = "classic" } = req.body as Record<string, string>;

    // Build a detailed cover art prompt based on book metadata
    const themeDescriptions: Record<string, string> = {
      midnight: "deep navy blue and gold, celestial night sky, stars and moon, elegant dark atmosphere",
      forest: "rich forest green, towering pine trees, woodland scene, natural earthy tones",
      crimson: "deep red and black, dramatic bold colors, rose or geometric pattern",
      ocean: "calming blues, ocean waves, seashells, coastal peaceful atmosphere",
      violet: "deep purple and lavender, mystical atmosphere, soft gradients",
      slate: "cool gray tones, modern geometric, sophisticated minimalist",
      sunrise: "warm oranges and golds, sunrise gradient, cheerful morning energy",
      teal: "deep teal and turquoise, modern fresh, clean lines",
      parchment: "warm cream and brown, vintage parchment texture, classic literary feel",
      sky: "light blue and white, open sky, clouds, airy peaceful",
    };
    const themeDesc = themeDescriptions[theme] || themeDescriptions.midnight;

    const styleAdj: Record<string, string> = {
      classic: "classic and elegant",
      geometric: "geometric patterns and shapes",
      luxury: "luxurious premium, gold accents, sophisticated",
      bold: "bold high-contrast, strong typography feel",
      minimal: "minimalist clean, lots of white space",
      retro: "retro vintage style, classic typography",
      warmth: "warm cozy inviting, soft textures",
    };
    const styleDesc = styleAdj[style] || styleAdj.classic;

    const prompt = [
      `Create a stunning ${styleDesc} book cover illustration for an activity/puzzle book titled "${title || puzzleType + " Puzzles"}".`,
      `Theme and color palette: ${themeDesc}.`,
      `The illustration should be completely abstract or nature-based — no text, no letters, no numbers, no symbols.`,
      `Style: painterly, high quality, rich details, suitable for a print book cover.`,
      `Aspect ratio: portrait, roughly 6 inches wide by 9 inches tall.`,
      `Make it visually striking and professional, worthy of a best-selling puzzle book.`,
    ].join(" ");

    req.log.info({ theme, puzzleType, style }, "Generating AI cover image with Gemini");
    const { b64_json, mimeType } = await generateImage(prompt);
    const dataUrl = `data:${mimeType};base64,${b64_json}`;

    res.json({ b64_json, mimeType, dataUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to generate AI cover image");
    res.status(500).json({ error: "Failed to generate AI cover image. Please try again." });
  }
});

export default router;

export interface CoverArtResult {
  b64_json: string;
  mimeType: string;
}

const THEME_DESCRIPTIONS: Record<string, string> = {
  midnight: "dramatic oil-painting style crescent moon rising over an ancient candlelit library, deep midnight blue atmosphere, golden ambient light from glowing candles, bookshelves in shadow, celestial starfield visible through tall arched windows",
  forest: "atmospheric watercolor-style misty pine forest at dawn, towering evergreen trees, early morning light filtering through branches, soft green and gold tones, forest floor covered with fern and dew, serene natural beauty",
  crimson: "rich oil-painting style crimson rose in full bloom, deep red and burgundy petals, dark dramatic background, water droplets on petals, warm romantic lighting, fine art botanical illustration style",
  ocean: "painterly ocean scene at golden hour, rolling azure waves crashing on rocky shore, dramatic spray and sea foam, distant lighthouse, warm sunset colors reflecting on water, impressionist style",
  violet: "luxurious amethyst crystal cluster in dramatic lighting, deep violet and purple hues, crystalline facets refracting light, mystical atmosphere, dark velvet background, macro fine art photography style",
  slate: "minimalist architectural abstract in cool slate grays and silvers, geometric precision, sophisticated clean lines, dramatic chiaroscuro lighting, modernist composition",
  sunrise: "breathtaking mountain sunrise panorama, warm oranges and golds illuminating snow-capped peaks, colorful clouds in gradient sky, rays of light breaking over the horizon, inspiring landscape photography style",
  teal: "vibrant tropical underwater seascape, rich teal and turquoise coral reef, colorful tropical fish, shafts of sunlight penetrating clear water, vivid naturalistic illustration style",
  parchment: "vintage antique map on aged parchment, sepia and warm brown tones, decorative compass rose, quill pen and ink details, classical cartography style, scholarly and elegant",
  sky: "idyllic blue sky with dramatic cumulus clouds, bright sunshine, birds soaring in formation, cheerful and uplifting atmosphere, soft impressionist painting style",
};

const STYLE_MODIFIERS: Record<string, string> = {
  classic: "classic elegant fine art style",
  geometric: "with geometric pattern overlays and precise mathematical symmetry",
  luxury: "luxuriously opulent with gold leaf accents and premium feel",
  bold: "bold high-contrast graphic art style with strong visual impact",
  minimal: "minimalist composition with generous negative space",
  retro: "retro vintage aesthetic with muted tones and nostalgic feel",
  warmth: "warm cozy intimate atmosphere with soft inviting textures",
};

export async function runCoverArtDirector(
  theme: string,
  puzzleType: string,
  coverStyle: string,
  title: string,
): Promise<CoverArtResult | null> {
  try {
    const { generateImage } = await import("@workspace/integrations-gemini-ai/image");

    const themeDesc = THEME_DESCRIPTIONS[theme] || THEME_DESCRIPTIONS.midnight;
    const styleDesc = STYLE_MODIFIERS[coverStyle] || STYLE_MODIFIERS.classic;

    const prompt = [
      `Create a stunning ${styleDesc} book cover illustration for a "${puzzleType}" puzzle book titled "${title}".`,
      `Scene: ${themeDesc}.`,
      `Requirements: NO text, NO letters, NO numbers, NO words, NO symbols anywhere in the image.`,
      `Style: painterly, high quality, rich fine details, professional book cover art worthy of a bestseller.`,
      `Composition: portrait orientation approximately 6×9 inches, visually striking and balanced.`,
      `Quality: museum-quality illustration suitable for commercial print publication.`,
    ].join(" ");

    return await generateImage(prompt);
  } catch {
    return null;
  }
}

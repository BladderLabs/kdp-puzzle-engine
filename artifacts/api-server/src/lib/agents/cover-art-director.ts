import type { BuyerProfile } from "./buyer-psychology-profiler";

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
  minimal: "minimalist composition with generous negative space in the lower third",
  retro: "retro vintage aesthetic with muted tones and nostalgic feel",
  warmth: "warm cozy intimate atmosphere with soft inviting textures",
  photo: "photographic fine art style, full-panel composition with visual weight concentrated in the upper two thirds",
};

function buildNicheHint(niche: string): string {
  const n = niche.toLowerCase();

  // Cats / felines
  if (n.includes("cat") || n.includes("kitten") || n.includes("feline")) {
    return "with adorable illustrated cats or kittens as the central subject, whimsical and charming";
  }
  // Dogs / canines
  if (n.includes("dog") || n.includes("puppy") || n.includes("canine")) {
    return "with charming illustrated dogs or puppies as the central subject, warm and loveable";
  }
  // Christmas / holiday / winter
  if (n.includes("christmas") || n.includes("holiday") || n.includes("festive") || n.includes("winter")) {
    return "with festive Christmas decorations, snow, and warm golden holiday lighting as the central elements";
  }
  // Mother's Day / mom / mother
  if (n.includes("mothers-day") || n.includes("mother's day") || n.includes("mothers day") || n.includes("mom") || n.includes("mother") || n.includes("mum") || n.includes("mama")) {
    return "with a warm, tender scene of blooming flowers — pastel roses, peonies, and soft spring blossoms — evoking love, nurturing, and celebration";
  }
  // Father's Day / dad / grandpa
  if (n.includes("fathers-day") || n.includes("father's day") || n.includes("fathers day") || n.includes("dad") || n.includes("grandpa") || n.includes("grandad") || n.includes("patriarch")) {
    return "with a warm, distinguished scene — a leather armchair, books, a pocket watch, or a classic study — evoking wisdom, strength, and comfort";
  }
  // Valentine's Day / romantic
  if (n.includes("valentine") || n.includes("romantic") || n.includes("romance") || n.includes("love-gift")) {
    return "with elegant romantic imagery — deep red roses, golden candlelight, soft bokeh hearts — evoking passion, tenderness, and intimacy";
  }
  // Thanksgiving / autumn harvest
  if (n.includes("thanksgiving") || n.includes("harvest")) {
    return "with a warm autumn harvest scene — golden maple leaves, pumpkins, and rustic abundance — evoking gratitude and cozy seasonal warmth";
  }
  // Spring / Easter
  if (n.includes("spring") || n.includes("easter")) {
    return "with vibrant spring blossoms — cherry blossoms, daffodils, and fresh green leaves — evoking renewal, joy, and lightness";
  }
  // Autumn / fall (without thanksgiving)
  if (n.includes("autumn") || n.includes("fall-puzzle")) {
    return "with stunning autumn foliage — crimson, amber, and gold leaves against a misty forest backdrop — evoking the cozy beauty of the season";
  }
  // Bible / faith / spiritual / christian
  if (n.includes("bible") || n.includes("faith") || n.includes("spiritual") || n.includes("christian") || n.includes("gospel") || n.includes("prayer")) {
    return "with serene inspirational imagery — soft golden light filtering through stained glass or a peaceful chapel window — evoking reverence, peace, and spiritual warmth";
  }
  // Beach / summer / coastal
  if (n.includes("beach") || n.includes("summer") || n.includes("coastal") || n.includes("seaside") || n.includes("shore")) {
    return "with a radiant sun-drenched beach scene — turquoise waves, warm sand, and golden sunlight — evoking relaxation, freedom, and joyful summer energy";
  }
  // Ocean / sea / marine (non-beach)
  if (n.includes("ocean") || n.includes("sea") || n.includes("marine")) {
    return "with serene ocean waves, coastal scenery, and sea life as the central subject";
  }
  // Nurse / medical / caregiver
  if (n.includes("nurse") || n.includes("medical") || n.includes("caregiver") || n.includes("healthcare") || n.includes("doctor")) {
    return "with a warm, professional scene evoking care and compassion — soft clinical whites, a stethoscope or gentle hands — dignified and uplifting";
  }
  // Senior / elder / retired
  if (n.includes("senior") || n.includes("elder") || n.includes("60+") || n.includes("retire")) {
    return "with a peaceful, cozy atmosphere — a warm armchair, afternoon light, a cup of tea — evoking calm and comfort";
  }
  // Garden / flower / botanical
  if (n.includes("garden") || n.includes("flower") || n.includes("botanical") || n.includes("nature")) {
    return "with lush illustrated flowers, botanical elements, and verdant garden scenes as the central subject";
  }
  // Bird / wildlife / animal
  if (n.includes("bird") || n.includes("wildlife") || n.includes("animal")) {
    return "with beautifully illustrated birds or wildlife as the central subject, nature-inspired and vivid";
  }
  // Coffee / tea / café / cozy
  if (n.includes("coffee") || n.includes("tea") || n.includes("café") || n.includes("cozy")) {
    return "with a cozy café atmosphere, warm beverages, and inviting domestic comfort as the central theme";
  }
  // Travel / adventure / explore
  if (n.includes("travel") || n.includes("adventure") || n.includes("explore")) {
    return "with inspiring travel landscapes, distant horizons, and a sense of adventure as the central subject";
  }
  // Halloween / spooky / gothic
  if (n.includes("halloween") || n.includes("spook") || n.includes("gothic")) {
    return "with dramatic Halloween imagery — pumpkins, candles, moonlit scenes — as the central subject";
  }
  // Kids / children / junior / young
  if (n.includes("kid") || n.includes("child") || n.includes("junior") || n.includes("young")) {
    return "with bright, playful, and child-friendly illustrated characters and cheerful colors as the central subject";
  }
  // Music / musician / concert
  if (n.includes("music") || n.includes("musician") || n.includes("concert")) {
    return "with elegant musical instruments and sheet music as the central artistic subject";
  }
  return "";
}

export async function runCoverArtDirector(
  theme: string,
  puzzleType: string,
  coverStyle: string,
  title: string,
  niche?: string,
  enrichedImagePrompt?: string,
  buyerProfile?: BuyerProfile,
): Promise<CoverArtResult | null> {
  try {
    const { generateImage } = await import("@workspace/integrations-gemini-ai/image");

    let prompt: string;

    if (enrichedImagePrompt && enrichedImagePrompt.trim().length > 20) {
      // Use research-backed enriched prompt from Cover Design Council
      // Optionally append buyer psychology emotional hook for extra resonance
      const psychHook = buyerProfile?.emotionalHook
        ? ` The scene must evoke: ${buyerProfile.emotionalHook}.`
        : "";
      prompt = [
        `Create a stunning professional book cover background illustration for a "${puzzleType}" puzzle book titled "${title}".`,
        enrichedImagePrompt.trim() + psychHook,
        `CRITICAL COMPOSITION RULE: Use a strong VERTICAL portrait composition (2:3 aspect ratio, taller than wide).`,
        `Place the primary subject and visual interest in the UPPER TWO-THIRDS of the image.`,
        `The LOWER THIRD must be kept relatively clear — it will be overlaid with title text.`,
        `ABSOLUTELY NO text, letters, numbers, words, symbols, watermarks, or UI elements anywhere in the image.`,
        `Quality: museum-quality illustration suitable for 300 DPI commercial print publication on Amazon KDP.`,
      ].join(" ");
    } else {
      // Fallback: legacy basic prompt with expanded niche hints
      const themeDesc = THEME_DESCRIPTIONS[theme] || THEME_DESCRIPTIONS.midnight;
      const styleDesc = STYLE_MODIFIERS[coverStyle] || STYLE_MODIFIERS.classic;
      const nicheHint = niche ? buildNicheHint(niche) : "";
      const psychHook = buyerProfile?.emotionalHook
        ? ` The image must evoke: ${buyerProfile.emotionalHook}.`
        : "";
      const subjectLine = nicheHint
        ? `Subject matter: ${nicheHint}.${psychHook}`
        : niche
          ? `Target audience: ${niche}. Scene: ${themeDesc}.${psychHook}`
          : `Scene: ${themeDesc}.${psychHook}`;

      prompt = [
        `Create a stunning ${styleDesc} book cover background illustration for a "${puzzleType}" puzzle book titled "${title}".`,
        subjectLine,
        `Atmosphere and color palette: ${themeDesc}.`,
        `CRITICAL COMPOSITION RULE: Use a strong VERTICAL portrait composition (2:3 aspect ratio, taller than wide).`,
        `Place the primary subject and visual interest in the UPPER TWO-THIRDS of the image.`,
        `The LOWER THIRD must be kept relatively clear and dark — it will be overlaid with title text.`,
        `ABSOLUTELY NO text, letters, numbers, words, symbols, watermarks, or UI elements anywhere in the image.`,
        `Style: painterly fine art, rich fine details, high contrast, professional commercial print quality.`,
        `Quality: museum-quality illustration suitable for 300 DPI commercial print publication on Amazon KDP.`,
        `The image must look stunning and professional as a full-panel background for a bestselling puzzle book.`,
      ].join(" ");
    }

    return await generateImage(prompt);
  } catch {
    return null;
  }
}

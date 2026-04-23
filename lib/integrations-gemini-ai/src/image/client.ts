import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
  );
}

export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface GenerateImageResult {
  b64_json: string;
  mimeType: string;
}

export interface GenerateImageOptions {
  /**
   * Aspect ratio hint. Imagen accepts "1:1", "3:4", "4:3", "9:16", "16:9".
   * 3:4 (portrait) is the best fit for book covers.
   * Default: "3:4"
   */
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  /** Preferred image model; falls through alternatives on error. */
  preferModel?: "imagen" | "gemini-flash";
}

/**
 * Primary path: Imagen 3 via generateImages() — outputs 1024x1536 on 3:4
 * aspect, ~290 DPI effective on a 6x9 cover.
 *
 * Fallback path: gemini-2.5-flash-image via generateContent() — outputs
 * ~1024x1024, ~170 DPI. Used only when Imagen is unavailable.
 *
 * Both code paths go through the same API key and base URL. No new
 * integration required.
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  const aspectRatio = options.aspectRatio ?? "3:4";
  const preferModel = options.preferModel ?? "imagen";

  if (preferModel === "imagen") {
    try {
      return await generateWithImagen(prompt, aspectRatio);
    } catch (err) {
      // Fall through to Gemini Flash Image — logged but non-fatal
      // eslint-disable-next-line no-console
      console.warn("[generateImage] Imagen 3 unavailable, falling back to gemini-2.5-flash-image:", (err as Error).message);
    }
  }

  return await generateWithGeminiFlash(prompt);
}

async function generateWithImagen(prompt: string, aspectRatio: string): Promise<GenerateImageResult> {
  // Try imagen-3.0-generate-002 first (stable, 1024x1536 on 3:4), then older fallbacks.
  const models = [
    "imagen-3.0-generate-002",
    "imagen-3.0-generate-001",
    "imagen-3.0-fast-generate-001",
  ];

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      // @ts-expect-error — generateImages is in @google/genai; method signature may vary by SDK version
      const response = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio,
          personGeneration: "allow_adult",
        },
      });
      const generated = (response as { generatedImages?: Array<{ image?: { imageBytes?: string; mimeType?: string } }> }).generatedImages;
      const img = generated?.[0]?.image;
      if (img?.imageBytes) {
        return {
          b64_json: img.imageBytes,
          mimeType: img.mimeType || "image/png",
        };
      }
      throw new Error(`Model ${model} returned no imageBytes`);
    } catch (err) {
      lastError = err as Error;
      // Try next model
    }
  }
  throw lastError ?? new Error("All Imagen models failed");
}

async function generateWithGeminiFlash(prompt: string): Promise<GenerateImageResult> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData,
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { apiVersion: "v1beta" },
});

export const GEMINI_CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
] as const;

export const GEMINI_FAST_MODELS = [
  "gemini-3.8-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
] as const;

export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

export function isRetryableGeminiError(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string } | null;
  const status = anyErr?.status;
  const msg = String(anyErr?.message || err || "");

  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    msg.includes("404") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

export async function generateContentWithFallback(params: {
  contents: any;
  config?: Record<string, any>;
  models?: readonly string[];
  retryDelayMs?: number;
  label?: string;
}): Promise<GenerateContentResponse> {
  const {
    contents,
    config,
    models = GEMINI_CANDIDATE_MODELS,
    retryDelayMs = 600,
    label = "Gemini AI",
  } = params;

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
    } catch (err: unknown) {
      lastError = err;
      const msg = String((err as { message?: string })?.message || err);
      console.warn(`[${label}] Model ${modelName} gagal:`, msg);

      if (isRetryableGeminiError(err)) {
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Semua model Gemini sedang tidak tersedia.");
}

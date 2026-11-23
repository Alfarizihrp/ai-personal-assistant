import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

/**
 * Memecah teks panjang menjadi beberapa potongan (chunks) dengan overlap ringan
 * agar konteks antar paragraf tidak terputus.
 */
export function chunkText(text: string, maxChunkSize = 900, overlap = 150): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (cleaned.length <= maxChunkSize) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + maxChunkSize;

    if (end < cleaned.length) {
      const lastNewline = cleaned.lastIndexOf("\n", end);
      const lastPeriod = cleaned.lastIndexOf(". ", end);
      if (lastNewline > start + maxChunkSize * 0.5) {
        end = lastNewline;
      } else if (lastPeriod > start + maxChunkSize * 0.5) {
        end = lastPeriod + 1;
      }
    }

    const slice = cleaned.slice(start, end).trim();
    if (slice) chunks.push(slice);

    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= cleaned.length) break;
  }

  return chunks;
}

/**
 * Mengubah teks menjadi vektor 768 dimensi menggunakan Gemini text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gagal menghasilkan vektor embedding dari Gemini.");
  }

  return values;
}
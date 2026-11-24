import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { apiVersion: "v1beta" },
});

/**
 * Memecah teks dokumen panjang menjadi potongan-potongan (chunks)
 * dengan overlap agar konteks antar paragraf tetap terjaga saat pencarian vektor.
 */
export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150
): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Usahakan memotong di akhir kalimat atau spasi agar kata tidak terpotong di tengah
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf(".", end);
      const lastSpace = cleaned.lastIndexOf(" ", end);
      if (lastPeriod > start + chunkSize * 0.5) {
        end = lastPeriod + 1;
      } else if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }

    const slice = cleaned.slice(start, end).trim();
    if (slice) chunks.push(slice);

    if (end >= cleaned.length) break;
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Menghasilkan vector embedding 768 dimensi menggunakan gemini-embedding-001 (v1beta)
 * agar kompatibel dengan kolom vector(768) pgvector di Supabase.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gagal membuat vector embedding dari Gemini.");
  }
  return values;
}
import { ai, GEMINI_EMBEDDING_MODEL } from "@/lib/gemini";

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
 * Menggabungkan kembali potongan chunks yang saling overlap menjadi teks utuh
 * untuk kebutuhan pratinjau penuh maupun ekspor PDF dokumen memori.
 */
export function mergeKnowledgeChunks(chunks: string[]): string {
  if (chunks.length === 0) return "";
  let combined = chunks[0].trim();

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i].trim();
    if (!next) continue;

    const maxOverlap = Math.min(200, combined.length, next.length);
    let overlapLen = 0;
    for (let len = maxOverlap; len >= 15; len--) {
      if (combined.endsWith(next.slice(0, len))) {
        overlapLen = len;
        break;
      }
    }

    if (overlapLen > 0) {
      combined += next.slice(overlapLen);
    } else {
      combined += `\n\n${next}`;
    }
  }

  return combined;
}

/**
 * Menghasilkan vector embedding 768 dimensi menggunakan gemini-embedding-001 (v1beta)
 * agar kompatibel dengan kolom vector(768) pgvector di Supabase.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
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
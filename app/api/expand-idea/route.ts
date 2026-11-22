import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { title, content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Isi ide tidak boleh kosong." },
        { status: 400 }
      );
    }

    const prompt = `
Kamu adalah asisten pribadi dan konsultan produk/teknologi berbahasa Indonesia untuk Akhi.
Akhi memiliki catatan ide berikut:
- Judul: "${title}"
- Detail Ide: "${content}"

Tugasmu: Kembangkan ide mentah di atas menjadi rancangan konsep yang terstruktur, praktis, dan siap dieksekusi.
Gunakan format poin-poin singkat yang rapi dengan struktur persis seperti ini:

🎯 KONSEP UTAMA:
(Jelaskan inti solusi dan target penggunanya dalam 1-2 kalimat)

⚙️ FITUR INTI (MVP):
• (Fitur 1)
• (Fitur 2)
• (Fitur 3)

🛠️ REKOMENDASI TECH STACK / TOOLS:
(Sebutkan teknologi atau alat yang paling pas dan efisien untuk membangunnya)

🚀 LANGKAH EKSEKUSI PERTAMA:
1. (Langkah konkret 1)
2. (Langkah konkret 2)
3. (Langkah konkret 3)

Gunakan bahasa Indonesia yang lugas, teknis namun mudah dipahami, dan langsung ke inti tanpa basa-basi pembuka/penutup.
`;

    const candidateModels = [
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-3.1-pro-preview",
    ];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [prompt],
        });

        return NextResponse.json({
          expansion: response.text || "Gagal menghasilkan penjabaran ide.",
        });
      } catch (err: any) {
        lastError = err;
        if (
          err.status === 404 ||
          err.status === 503 ||
          err.message?.includes("503") ||
          err.message?.includes("UNAVAILABLE")
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Server AI sedang sibuk. Coba beberapa saat lagi.");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengembangkan ide." },
      { status: 500 }
    );
  }
}
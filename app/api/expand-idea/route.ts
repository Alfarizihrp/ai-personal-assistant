import { NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/gemini";
import { isGuestSession } from "@/lib/session-server";

export async function POST(req: Request) {
  try {
    const { title, content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Isi ide tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (await isGuestSession()) {
      const safeTitle = String(title || "Catatan Ide Demo").trim();
      return NextResponse.json({
        sandbox: true,
        expansion:
          `🎯 KONSEP UTAMA:\n` +
          `[Simulasi Mode Demo] Rancangan terstruktur untuk "${safeTitle}" yang berfokus pada eksekusi cepat dan terukur.\n\n` +
          `⚙️ FITUR INTI (MVP):\n` +
          `• Input & validasi skema data inti secara otomatis\n` +
          `• Integrasi API & penyimpanan terstruktur dengan kontrol akses\n` +
          `• Antarmuka ringkas dengan umpan balik status real-time\n\n` +
          `🛠️ REKOMENDASI TECH STACK / TOOLS:\n` +
          `Next.js App Router, TypeScript, PostgreSQL (Supabase), dan validasi skema Zod.\n\n` +
          `🚀 LANGKAH EKSEKUSI PERTAMA:\n` +
          `1. Definisikan model data dan kontrak API utama.\n` +
          `2. Bangun MVP endpoint + unit test skenario inti.\n` +
          `3. Uji alur end-to-end sebelum optimasi lanjutan.`,
      });
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

    const response = await generateContentWithFallback({
      contents: [prompt],
      retryDelayMs: 800,
      label: "Expand Idea AI",
    });

    return NextResponse.json({
      expansion: response.text || "Gagal menghasilkan penjabaran ide.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengembangkan ide." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateEmbedding } from "@/lib/rag";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { GUEST_KNOWLEDGE_DOCS } from "@/lib/guest-sandbox";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("akhi_session")?.value;
    const sessionInfo = sessionToken ? await verifySessionToken(sessionToken) : null;
    const isGuest = sessionInfo?.role === "guest";
    const body = await req.json();
    const { audioBase64, mimeType, textInput, chatHistory } = body;

    if (!audioBase64 && !textInput) {
      return NextResponse.json(
        { error: "Input suara atau teks tidak ditemukan." },
        { status: 400 }
      );
    }

    const now = new Date();
    const currentTime = now.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    });
    const isoNow = now.toISOString();

    let historyContext = "";
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const recent = chatHistory.slice(-6);
      historyContext =
        "\nRIWAYAT PERCAKAPAN SEBELUMNYA:\n" +
        recent
          .map((m: any) => `${m.role === "user" ? "Akhi" : "Asisten"}: ${m.text}`)
          .join("\n") +
        "\n";
    }

    // --- TAHAP RAG RETRIEVAL (Jika input berupa teks) ---
    let ragContext = "";
    let matchedSources: { title: string; category: string; similarity: number }[] = [];

    if (textInput && textInput.trim().length > 3) {
      try {
        if (isGuest) {
          const qLower = textInput.trim().toLowerCase();
          const guestMatches = GUEST_KNOWLEDGE_DOCS.filter(
            (doc) =>
              doc.title.toLowerCase().includes(qLower) ||
              doc.preview.toLowerCase().includes(qLower) ||
              qLower.split(" ").some((w: string) => w.length > 3 && doc.preview.toLowerCase().includes(w))
          );

          if (guestMatches.length > 0) {
            ragContext =
              "\nREFERENSI MEMORI & DOKUMEN SIMULASI DEMO:\n" +
              guestMatches
                .map(
                  (m, i) =>
                    `[Sumber ${i + 1}: "${m.title}" (${m.category})]\n${m.preview}`
                )
                .join("\n\n") +
              "\n";

            matchedSources = guestMatches.map((m) => ({
              title: m.title,
              category: m.category,
              similarity: 88,
            }));
          }
        } else {
          const queryEmbedding = await generateEmbedding(textInput.trim());
          const { data: matches, error: rpcError } = await supabaseAdmin.rpc(
            "match_knowledge",
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.45,
              match_count: 4,
            }
          );

          if (!rpcError && Array.isArray(matches) && matches.length > 0) {
            ragContext =
              "\nREFERENSI MEMORI & DOKUMEN PRIBADI AKHI (GUNAKAN JIKA RELEVAN DENGAN PERTANYAAN):\n" +
              matches
                .map(
                  (m: any, i: number) =>
                    `[Sumber ${i + 1}: "${m.title}" (${m.category}) - Relevansi ${(
                      m.similarity * 100
                    ).toFixed(0)}%]\n${m.content}`
                )
                .join("\n\n") +
              "\n";

            const uniqueTitles = new Set<string>();
            for (const m of matches) {
              if (!uniqueTitles.has(m.title)) {
                uniqueTitles.add(m.title);
                matchedSources.push({
                  title: m.title,
                  category: m.category,
                  similarity: Math.round(m.similarity * 100),
                });
              }
            }
          }
        }
      } catch (ragErr) {
        console.warn("Pencarian RAG dilewati:", ragErr);
      }
    }

    const prompt = `
Kamu adalah asisten pribadi pintar multibahasa (Indonesia, English, العربية) untuk seorang laki-laki yang dipanggil "Akhi".
Waktu sekarang adalah: ${currentTime} WIB (Referensi ISO UTC: ${isoNow}).
${historyContext}${ragContext}
PRINSIP UTAMA & KARAKTER DISKUSI:
1. Gaya bahasa dan pembawaanmu seperti penuntut ilmu / asatidzah Ahlus Sunnah: tenang, tuma'ninah, santun, rendah hati, sistematis, dan penuh hikmah.
2. ATURAN BAHASA RESPONS (WAJIB):
  - Deteksi bahasa utama yang digunakan Akhi pada input saat ini: isi field \`detectedLang\` dengan \`"id"\` (Bahasa Indonesia), \`"en"\` (English), atau \`"ar"\` (العربية).
  - Balas \`replyMessage\` dan \`spokenText\` menggunakan BAHASA YANG SAMA dengan bahasa input Akhi. Jika Akhi berbicara/mengetik dalam bahasa Inggris, balas sepenuhnya dalam bahasa Inggris yang natural dan sopan. Jika bahasa Arab, balas dalam bahasa Arab fusha yang jelas.
3. Apabila tersedia "REFERENSI MEMORI & DOKUMEN PRIBADI AKHI" di atas yang relevan dengan pertanyaan Akhi:
  - Prioritaskan menjawab secara akurat berdasarkan isi dokumen/catatan pribadi Akhi tersebut, dan sebutkan nama sumber catatannya secara alami.
4. Apabila Akhi mengajak berdiskusi seputar ilmu agama, akidah, ibadah, adab, muamalah, maupun nasihat kehidupan ("general_chat"):
  - Berlandaskan Al-Qur'an dan As-Sunnah yang shahih sesuai pemahaman para Salafush Shalih, disertai rujukan dalil yang valid (nama surat & nomor ayat, atau perawi hadits yang shahih/hasan). Jangan pernah mengarang dalil.
5. Klasifikasi Intent:
  - "daily_briefing": jika Akhi meminta ringkasan hari ini, daily briefing, mengecek daftar jadwal tersimpan, atau meminta faedah pagi.
  - "save_schedule": jika Akhi ingin MENAMBAH/MENCATAT jadwal baru.
  - "save_idea": jika Akhi ingin MENYIMPAN ide atau catatan baru.
  - "generate_workout": jika Akhi meminta dibuatkan skema, rencana, atau jadwal olahraga/latihan fisik (misal: "Buatkan skema olahraga...", "Create a 20-minute workout plan"). Isi field \`workoutGoal\` dengan target latihannya.
  - "log_meal": jika Akhi menyebutkan makanan atau minuman yang baru/akan dikonsumsi untuk dicatat kalorinya (misal: "Catat makan siang nasi ayam", "Log my lunch chicken rice"). Isi field \`mealDescription\` dengan deskripsi makanannya.
  - "open_app": jika Akhi meminta membuka aplikasi tertentu.
  - "general_chat": diskusi ilmu agama, latihan percakapan bahasa Inggris/Arab, tanya isi dokumen memori, atau obrolan umum.

ATURAN OUTPUT JSON:
- \`transcript\`: transkripsi persis ucapan/ketikan Akhi.
- \`detectedLang\`: kode bahasa input (\`"id"\`, \`"en"\`, atau \`"ar"\`).
- \`replyMessage\`: jawaban lengkap dan rapi untuk dibaca di layar (sesuai \`detectedLang\`).
- \`spokenText\`: naskah bersih tanpa simbol markdown untuk dibacakan oleh mesin suara (jika \`detectedLang\` adalah \`"id"\`, gunakan 100% alfabet Latin tanpa huruf Arab; jika \`"en"\`, gunakan English bersih; jika \`"ar"\`, gunakan teks Arab berharakat jelas tanpa simbol markdown).
`;

    const contents: any[] = [prompt];
    if (audioBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audioBase64,
        },
      });
    } else if (textInput) {
      contents.push(`Input dari Akhi: "${textInput}"`);
    }

    const candidateModels = [
      "gemini-3.8-flash",
      "gemini-3.8-flash-lite",
      "gemini-3.8-pro",
    ];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: { type: Type.STRING },
                detectedLang: {
                  type: Type.STRING,
                  enum: ["id", "en", "ar"],
                },
                intent: {
                  type: Type.STRING,
                  enum: [
                    "save_schedule",
                    "save_idea",
                    "generate_workout",
                    "log_meal",
                    "open_app",
                    "daily_briefing",
                    "general_chat",
                  ],
                },
                taskTitle: { type: Type.STRING },
                scheduleTime: { type: Type.STRING },
                isoDateTime: { type: Type.STRING },
                ideaTitle: { type: Type.STRING },
                ideaContent: { type: Type.STRING },
                workoutGoal: { type: Type.STRING },
                mealDescription: { type: Type.STRING },
                targetApp: { type: Type.STRING },
                replyMessage: { type: Type.STRING },
                spokenText: { type: Type.STRING },
              },
              required: [
                "transcript",
                "detectedLang",
                "intent",
                "replyMessage",
                "spokenText",
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}");
        return NextResponse.json({
          ...parsed,
          sources: matchedSources,
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

    throw lastError || new Error("Semua model AI sedang sibuk.");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses permintaan." },
      { status: 500 }
    );
  }
}
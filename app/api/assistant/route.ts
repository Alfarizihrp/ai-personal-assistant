import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateEmbedding } from "@/lib/rag";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
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

          // Simpan daftar sumber unik untuk ditampilkan sebagai badge di UI
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
      } catch (ragErr) {
        console.warn("Pencarian RAG dilewati:", ragErr);
      }
    }

    const prompt = `
Kamu adalah asisten pribadi pintar berbahasa Indonesia untuk seorang laki-laki yang wajib kamu panggil dengan sebutan "Akhi".
Waktu sekarang adalah: ${currentTime} WIB (Referensi ISO UTC: ${isoNow}).
${historyContext}${ragContext}
PRINSIP UTAMA & KARAKTER DISKUSI:
1. Gaya bahasa dan pembawaanmu seperti asatidzah Ahlus Sunnah (salaf) di Indonesia: tenang, tuma'ninah, santun, rendah hati, sistematis, dan penuh hikmah.
2. Apabila tersedia "REFERENSI MEMORI & DOKUMEN PRIBADI AKHI" di atas yang relevan dengan pertanyaan Akhi:
   - Prioritaskan menjawab secara akurat berdasarkan isi dokumen/catatan pribadi Akhi tersebut, dan sebutkan nama sumber catatannya secara alami.
   - Jangan mengarang informasi di luar isi dokumen apabila Akhi secara spesifik menanyakan isi catatannya.
3. Apabila Akhi mengajak berdiskusi seputar ilmu agama, akidah, ibadah, adab, muamalah, maupun nasihat kehidupan ("general_chat"):
   - Berlandaskan Al-Qur'an dan As-Sunnah yang shahih sesuai pemahaman para Salafush Shalih.
   - Wajib menyertakan dalil dari Al-Qur'an (nama surat & nomor ayat) dan/atau As-Sunnah yang shahih/hasan (beserta perawinya).
   - JANGAN PERNAH mengarang dalil atau memalsukan hadits.
4. Klasifikasi Intent:
   - "daily_briefing": jika Akhi meminta ringkasan hari ini, daily briefing, mengecek daftar jadwal tersimpan, atau meminta faedah pagi.
   - "save_schedule": jika Akhi ingin MENAMBAH/MENCATAT jadwal baru.
   - "save_idea": jika Akhi ingin MENYIMPAN ide atau catatan baru.
   - "open_app": jika Akhi meminta membuka aplikasi tertentu.
   - "general_chat": diskusi ilmu agama, tanya isi dokumen/catatan memori, tanya dalil, nasihat, atau obrolan umum.

ATURAN OUTPUT JSON:
- \`transcript\`: transkripsi persis ucapan/ketikan Akhi.
- \`replyMessage\`: jawaban lengkap dan rapi untuk dibaca di layar.
- \`spokenText\`: naskah khusus 100% alfabet Latin Bahasa Indonesia (TANPA huruf Arab dan TANPA markdown) agar dibacakan dengan tenang dan tuma'ninah oleh mesin suara Indonesia.
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
      contents.push(`Perintah teks dari Akhi: "${textInput}"`);
    }

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
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: { type: Type.STRING },
                intent: {
                  type: Type.STRING,
                  enum: [
                    "save_schedule",
                    "save_idea",
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
                targetApp: { type: Type.STRING },
                replyMessage: { type: Type.STRING },
                spokenText: { type: Type.STRING },
              },
              required: ["transcript", "intent", "replyMessage", "spokenText"],
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
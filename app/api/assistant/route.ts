import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateEmbedding } from "@/lib/rag";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { GUEST_KNOWLEDGE_DOCS } from "@/lib/guest-sandbox";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { apiVersion: "v1beta" },
});

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
];

// Deteksi bahasa sederhana jika server AI sedang 503 High Demand
function detectLocalLang(text: string): "id" | "en" | "ar" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  const enWords = /\b(the|and|is|are|please|create|workout|schedule|remind|log|meal|hello|hi|how|what|can|you|my|for|today|tomorrow)\b/i;
  if (enWords.test(text)) return "en";
  return "id";
}

// Graceful fallback jika seluruh server Gemini mengalami lonjakan trafik 503
function buildOfflineFallbackResponse(textInput?: string) {
  const raw = (textInput || "").trim();
  const lang = detectLocalLang(raw);
  const lower = raw.toLowerCase();

  if (!raw) {
    return {
      transcript: "(Audio tidak dapat diproses sementara)",
      detectedLang: "id" as const,
      intent: "general_chat" as const,
      replyMessage:
        "Afwan Akhi, server suara AI sedang mengalami lonjakan trafik tinggi (503). Silakan coba ulangi beberapa detik lagi atau ketik pesanmu.",
      spokenText:
        "Afwan Akhi, server suara AI sedang sibuk. Silakan coba ulangi beberapa detik lagi.",
    };
  }

  // Deteksi niat olahraga secara lokal
  if (/(olahraga|latihan|workout|cardio|kardio|gym|push up|squat|تمرين|رياضة)/i.test(lower)) {
    const reply =
      lang === "en"
        ? `AI server is currently busy, Akhi, so I routed your workout request ("${raw}") directly to the Wellness tab.`
        : lang === "ar"
        ? `خادم الذكاء الاصطناعي مزدحم حالياً يا أخي، تم توجيه طلب التمرين ("${raw}") مباشرة إلى قسم الصحة.`
        : `Afwan Akhi, server utama AI sedang padat trafik, namun permintaan skema olahraga ("${raw}") langsung saya arahkan ke tab Sehat.`;

    return {
      transcript: raw,
      detectedLang: lang,
      intent: "generate_workout" as const,
      workoutGoal: raw,
      replyMessage: reply,
      spokenText: reply,
    };
  }

  // Deteksi niat catat makanan/kalori secara lokal
  if (/(kalori|makan|sarapan|minum|calorie|meal|lunch|dinner|breakfast|أكل|سعرات)/i.test(lower)) {
    const reply =
      lang === "en"
        ? `AI server is experiencing high demand, Akhi, so I logged your meal ("${raw}") directly to the Wellness tab.`
        : lang === "ar"
        ? `خادم الذكاء الاصطناعي مزدحم حالياً يا أخي، تم تسجيل وجبتك ("${raw}") مباشرة في قسم الصحة.`
        : `Afwan Akhi, server utama AI sedang padat trafik, namun catatan makanan ("${raw}") langsung saya masukkan ke tab Sehat.`;

    return {
      transcript: raw,
      detectedLang: lang,
      intent: "log_meal" as const,
      mealDescription: raw,
      replyMessage: reply,
      spokenText: reply,
    };
  }

  // Deteksi niat jadwal secara lokal
  if (/(jadwal|ingatkan|besok|jam |pukul |schedule|remind|tomorrow|appointment|موعد|غدا)/i.test(lower)) {
    const reply =
      lang === "en"
        ? `AI server is temporarily busy, Akhi, so I saved "${raw}" directly into your Schedule tab.`
        : lang === "ar"
        ? `خادم الذكاء الاصطناعي مزدحم مؤقتاً يا أخي، تم حفظ "${raw}" مباشرة في جدول المواعيد.`
        : `Afwan Akhi, server utama AI sedang sibuk sementara, namun agenda "${raw}" langsung saya simpan ke tab Jadwal.`;

    return {
      transcript: raw,
      detectedLang: lang,
      intent: "save_schedule" as const,
      taskTitle: raw,
      scheduleTime: lang === "en" ? "Scheduled (Check time)" : lang === "ar" ? "مجدول" : "Terjadwal",
      replyMessage: reply,
      spokenText: reply,
    };
  }

  // Fallback diskusi umum
  const busyReply =
    lang === "en"
      ? "Apologies Akhi, the Gemini AI server is currently experiencing a temporary spike in high demand (503). Please try sending your message again in a few moments."
      : lang === "ar"
      ? "عفواً يا أخي، خادم الذكاء الاصطناعي يواجه ضغطاً مرتفعاً مؤقتاً (503). يرجى المحاولة مرة أخرى بعد قليل."
      : "Afwan Akhi, server Gemini AI saat ini sedang mengalami lonjakan trafik sementara (503 High Demand). Silakan kirim ulang pertanyaanmu beberapa saat lagi.";

  return {
    transcript: raw,
    detectedLang: lang,
    intent: "general_chat" as const,
    replyMessage: busyReply,
    spokenText: busyReply,
  };
}

export async function POST(req: Request) {
  let bodyData: any = {};

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("akhi_session")?.value;
    const sessionInfo = sessionToken ? await verifySessionToken(sessionToken) : null;
    const isGuest = sessionInfo?.role === "guest";
    bodyData = await req.json();
    const { audioBase64, mimeType, textInput, chatHistory } = bodyData;

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
              qLower
                .split(" ")
                .some((w: string) => w.length > 3 && doc.preview.toLowerCase().includes(w))
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

    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
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

        const rawText = (response.text || "{}").replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(rawText);

        return NextResponse.json({
          transcript: parsed.transcript || textInput || "(Audio)",
          detectedLang: parsed.detectedLang || "id",
          intent: parsed.intent || "general_chat",
          taskTitle: parsed.taskTitle || "",
          scheduleTime: parsed.scheduleTime || "",
          isoDateTime: parsed.isoDateTime || "",
          ideaTitle: parsed.ideaTitle || "",
          ideaContent: parsed.ideaContent || "",
          workoutGoal: parsed.workoutGoal || "",
          mealDescription: parsed.mealDescription || "",
          targetApp: parsed.targetApp || "",
          replyMessage:
            parsed.replyMessage ||
            "Afwan Akhi, permintaan telah diproses namun balasan teks kosong.",
          spokenText:
            parsed.spokenText ||
            parsed.replyMessage ||
            "Permintaan telah diproses.",
          sources: matchedSources,
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        console.warn(`[Assistant AI] Model ${modelName} gagal:`, msg);
        const shouldContinue =
          err.status === 404 ||
          err.status === 503 ||
          err.status === 429 ||
          msg.includes("404") ||
          msg.includes("503") ||
          msg.includes("429") ||
          msg.includes("UNAVAILABLE");

        if (shouldContinue) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        throw err;
      }
    }

    // Jika semua model AI sedang mengalami 503 High Demand, gunakan fallback lokal agar UI tidak error
    console.warn("[Assistant AI] Semua model sibuk, menggunakan graceful fallback:", lastError?.message);
    return NextResponse.json({
      ...buildOfflineFallbackResponse(bodyData?.textInput),
      sources: matchedSources,
    });
  } catch (error: any) {
    console.error("[POST /api/assistant Error]:", error);
    return NextResponse.json({
      ...buildOfflineFallbackResponse(bodyData?.textInput),
      sources: [],
    });
  }
}
import { NextResponse } from "next/server";
import { Type, type Content, type Part } from "@google/genai";
import {
  GEMINI_FAST_MODELS,
  generateContentWithFallback,
} from "@/lib/gemini";
import { isGuestSession } from "@/lib/session-server";
import {
  retrieveRagContext,
  type RagSourceMatch,
} from "@/lib/rag-retrieval";
import {
  ASSISTANT_TOOL_DECLARATIONS,
  executeAssistantToolCall,
  type RefreshTarget,
} from "@/lib/assistant-tools";

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

async function transcribeAudioForRag(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  try {
    const res = await generateContentWithFallback({
      models: GEMINI_FAST_MODELS,
      retryDelayMs: 300,
      label: "Voice RAG Pre-Transcript",
      contents: [
        "Transkripsikan ucapan pada audio ini secara akurat dalam bahasa aslinya (Indonesia, English, atau العربية) sebagai teks polos tanpa komentar tambahan. Jika tidak terdengar ucapan, kembalikan string kosong.",
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
      ],
      config: { temperature: 0 },
    });
    return (res.text || "").trim();
  } catch (err) {
    console.warn("Pra-transkripsi suara untuk RAG dilewati:", err);
    return "";
  }
}

const ASSISTANT_RESPONSE_SCHEMA = {
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
};

function parseJsonObjectSafe(raw?: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let bodyData: any = {};
  let effectiveQuery = "";
  let matchedSources: RagSourceMatch[] = [];

  try {
    const isGuest = await isGuestSession();
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
      const recent = chatHistory.slice(-8);
      historyContext =
        "\nRIWAYAT PERCAKAPAN SEBELUMNYA:\n" +
        recent
          .map((m: any) => `${m.role === "user" ? "Akhi" : "Asisten"}: ${m.text}`)
          .join("\n") +
        "\n";
    }

    // --- TAHAP RAG RETRIEVAL (Mendukung Teks maupun Suara via Pra-Transkripsi) ---
    effectiveQuery = typeof textInput === "string" ? textInput.trim() : "";
    if (!effectiveQuery && audioBase64) {
      effectiveQuery = await transcribeAudioForRag(
        audioBase64,
        mimeType || "audio/webm"
      );
    }

    let ragContext = "";
    if (effectiveQuery.length > 3) {
      try {
        const ragResult = await retrieveRagContext(effectiveQuery, isGuest);
        ragContext = ragResult.ragContext;
        matchedSources = ragResult.matchedSources;
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
  - Balas \`replyMessage\` dan \`spokenText\` menggunakan BAHASA YANG SAMA dengan bahasa input Akhi.
3. Apabila tersedia "REFERENSI MEMORI & DOKUMEN PRIBADI AKHI" yang relevan:
  - Prioritaskan menjawab secara akurat berdasarkan isi dokumen tersebut dan sebutkan nama sumber catatannya.
4. Apabila Akhi mengajak berdiskusi seputar ilmu agama, akidah, ibadah, adab, muamalah, maupun nasihat kehidupan ("general_chat"):
  - Berlandaskan Al-Qur'an dan As-Sunnah yang shahih sesuai pemahaman para Salafush Shalih, disertai rujukan dalil yang valid (jangan pernah mengarang dalil).
5. PENGGUNAAN FUNCTION CALLING (MULTI-AKSI):
  - Kamu memiliki tools untuk membaca/menambah/menyelesaikan/menghapus jadwal, mencatat ide/faedah, membaca nutrisi hari ini, mencatat makanan, membuat skema olahraga, dan mencari memori RAG.
  - Jika permintaan Akhi melibatkan satu atau beberapa aksi/data nyata (misal: menandai jadwal selesai lalu mencatat makan siang, atau mengecek sisa kalori hari ini, atau membaca daftar jadwal), PANGGIL tool yang sesuai terlebih dahulu (boleh memanggil lebih dari 1 tool sekaligus).
  - Khusus jika Akhi meminta "daily_briefing" (ringkasan hari ini/faedah pagi) atau "open_app" (buka WhatsApp/YouTube/Instagram/Maps/Gmail/GitHub), tidak perlu memanggil tool mutasi; langsung keluarkan JSON dengan intent tersebut.
6. Klasifikasi Intent:
  - "daily_briefing", "save_schedule", "save_idea", "generate_workout", "log_meal", "open_app", "general_chat".

ATURAN OUTPUT AKHIR (WAJIB JSON VALID TANPA MARKDOWN):
Setelah seluruh tool selesai dipanggil (atau jika tidak butuh tool), keluarkan HANYA JSON valid dengan struktur:
{
  "transcript": "transkripsi persis ucapan/ketikan Akhi",
  "detectedLang": "id" | "en" | "ar",
  "intent": "save_schedule" | "save_idea" | "generate_workout" | "log_meal" | "open_app" | "daily_briefing" | "general_chat",
  "targetApp": "(opsional jika open_app)",
  "replyMessage": "jawaban lengkap dan rapi untuk dibaca di layar",
  "spokenText": "naskah bersih tanpa simbol markdown untuk TTS (jika detectedLang 'id' gunakan 100% alfabet Latin tanpa huruf Arab)"
}
`;

    const userParts: Part[] = [{ text: prompt }];
    if (audioBase64) {
      if (effectiveQuery) {
        userParts.push({ text: `Transkrip awal ucapan Akhi: "${effectiveQuery}"` });
      }
      userParts.push({
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audioBase64,
        },
      });
    } else if (textInput) {
      userParts.push({ text: `Input dari Akhi: "${textInput}"` });
    }

    const conversationContents: Content[] = [{ role: "user", parts: userParts }];
    const toolCtx = {
      isGuest,
      actions: [] as string[],
      refreshTargets: new Set<RefreshTarget>(),
      sources: [...matchedSources],
    };

    try {
      let finalRawText = "";
      let executedToolCalls = 0;

      for (let round = 0; round < 4; round++) {
        const response = await generateContentWithFallback({
          contents: conversationContents,
          label: "Assistant AI",
          config: {
            tools: [{ functionDeclarations: ASSISTANT_TOOL_DECLARATIONS }],
          },
        });

        const calls = response.functionCalls;
        if (calls && calls.length > 0) {
          const modelContent = response.candidates?.[0]?.content || {
            role: "model",
            parts: calls.map((fc) => ({ functionCall: fc })),
          };
          conversationContents.push(modelContent);

          const responseParts: Part[] = [];
          for (const fc of calls) {
            const toolName = fc.name || "";
            const toolResult = await executeAssistantToolCall(
              toolName,
              (fc.args as Record<string, any>) || {},
              toolCtx
            );
            executedToolCalls++;
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: toolResult,
              },
            });
          }

          conversationContents.push({ role: "user", parts: responseParts });
          continue;
        }

        finalRawText = response.text || "";
        break;
      }

      let parsed = parseJsonObjectSafe(finalRawText);
      if (!parsed || !parsed.replyMessage) {
        const formatRes = await generateContentWithFallback({
          models: GEMINI_FAST_MODELS,
          label: "Assistant JSON Formatter",
          contents: [
            ...conversationContents,
            ...(finalRawText
              ? [{ role: "model", parts: [{ text: finalRawText }] }]
              : []),
            {
              role: "user",
              parts: [
                {
                  text: "Formatkan hasil percakapan dan eksekusi tool di atas menjadi JSON valid sesuai schema respons.",
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: ASSISTANT_RESPONSE_SCHEMA,
          },
        });
        parsed = parseJsonObjectSafe(formatRes.text) || {};
      }

      return NextResponse.json({
        transcript: parsed.transcript || effectiveQuery || textInput || "(Audio)",
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
        sources: toolCtx.sources,
        handledByServerTools: executedToolCalls > 0,
        actions: toolCtx.actions,
        refreshTargets: Array.from(toolCtx.refreshTargets),
      });
    } catch (aiErr: any) {
      // Jika semua model AI sedang sibuk, gunakan fallback lokal agar UI tidak error
      console.warn("[Assistant AI] Semua model sibuk, menggunakan graceful fallback:", aiErr?.message);
      return NextResponse.json({
        ...buildOfflineFallbackResponse(effectiveQuery || bodyData?.textInput),
        sources: toolCtx.sources,
        handledByServerTools: false,
        actions: [],
        refreshTargets: [],
      });
    }
  } catch (error: any) {
    console.error("[POST /api/assistant Error]:", error);
    return NextResponse.json({
      ...buildOfflineFallbackResponse(effectiveQuery || bodyData?.textInput),
      sources: matchedSources,
      handledByServerTools: false,
      actions: [],
      refreshTargets: [],
    });
  }
}
import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { audioBase64, mimeType, textInput } = body;

    if (!audioBase64 && !textInput) {
      return NextResponse.json(
        { error: "Tidak ada suara maupun teks yang dikirim." },
        { status: 400 }
      );
    }

    const currentTime = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    });

    const prompt = `
Kamu adalah asisten pribadi pintar berbahasa Indonesia. Pengguna aplikasi ini adalah seorang laki-laki, dan kamu WAJIB menyapa atau memanggil pengguna dengan sebutan "Akhi" dalam jawabanmu (contoh: "Siap Akhi...", "Baik Akhi, jadwal sudah dicatat...", "Waalaikumsalam Akhi...").
Waktu sekarang adalah: ${currentTime} WIB.

Tugasmu:
1. Jika input berupa suara, tuliskan transkrip akurat dari apa yang diucapkan pengguna. Jika input berupa teks, salin kembali teks tersebut.
2. Tentukan maksud (intent) dari perintah pengguna:
   - "save_schedule": jika pengguna ingin mencatat jadwal, agenda, pengingat, atau tugas.
   - "open_app": jika pengguna meminta membuka aplikasi tertentu (whatsapp, youtube, instagram, maps, gmail, github).
   - "general_chat": jika pengguna sekadar bertanya informasi umum atau menyapa.
3. Ekstrak detailnya sesuai schema JSON yang diminta. Buat kalimat \`replyMessage\` yang natural, sopan, hangat, ringkas (maksimal 2-3 kalimat agar enak didengar saat dibacakan suara), dan menyertakan sapaan "Akhi".
`;

    const contents: any[] = [];
    if (audioBase64) {
      contents.push({
        inlineData: {
          data: audioBase64,
          mimeType: mimeType || "audio/ogg",
        },
      });
    }
    if (textInput) {
      contents.push(`Perintah pengguna: "${textInput}"`);
    }
    contents.push(prompt);

    // Urutkan dari model yang paling cepat & jarang terkena antrean 503
    const candidateModels = [
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`Mencoba model: ${modelName} (mimeType: ${mimeType || "text"})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: { type: Type.STRING },
                intent: { type: Type.STRING },
                taskTitle: { type: Type.STRING },
                scheduleTime: { type: Type.STRING },
                targetApp: { type: Type.STRING },
                replyMessage: { type: Type.STRING },
              },
              required: ["transcript", "intent", "replyMessage"],
            },
          },
        });

        console.log(`Berhasil menggunakan model: ${modelName}`);
        const parsedResult = JSON.parse(response.text || "{}");
        return NextResponse.json(parsedResult);
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} sibuk/gagal (${err.status || err.message})`);

        if (err.status === 404 || err.status === 503 || err.message?.includes("503") || err.message?.includes("UNAVAILABLE")) {
          // Beri jeda 1 detik sebelum mencoba model cadangan berikutnya
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error("Semua model sedang sibuk. Coba beberapa detik lagi.");
  } catch (error: any) {
    console.error("DETAIL ERROR GEMINI:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses perintah." },
      { status: 500 }
    );
  }
}
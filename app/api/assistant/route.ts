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

    const now = new Date();
    const currentTime = now.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    });
    const isoNow = now.toISOString();

    const prompt = `
Kamu adalah asisten pribadi pintar berbahasa Indonesia. Pengguna aplikasi ini adalah seorang laki-laki, dan kamu WAJIB menyapa atau memanggil pengguna dengan sebutan "Akhi" dalam jawabanmu.
Waktu sekarang adalah: ${currentTime} WIB (Referensi ISO UTC: ${isoNow}).

Tugasmu:
1. Jika input berupa suara, tuliskan transkrip akurat dari apa yang diucapkan pengguna. Jika input berupa teks, salin kembali teks tersebut.
2. Tentukan maksud (intent) dari perintah pengguna:
   - "save_schedule": jika pengguna ingin mencatat jadwal, agenda, pengingat, atau rapat.
   - "save_idea": jika pengguna ingin mencatat ide, konsep proyek, catatan cepat, atau inspirasi (contoh: "catat ide aplikasi...", "simpan ide konten...", "tulis catatan...").
   - "open_app": jika pengguna meminta membuka aplikasi tertentu (whatsapp, youtube, instagram, maps, gmail, github).
   - "general_chat": jika pengguna sekadar bertanya informasi umum atau menyapa.
3. Ekstrak detailnya sesuai schema JSON:
   - Jika "save_schedule": isi \`taskTitle\`, \`scheduleTime\` (format teks ramah dibaca), dan \`isoDateTime\` (format ISO 8601 lengkap dengan offset +07:00 WIB, contoh: "2026-11-23T08:00:00+07:00").
   - Jika "save_idea": isi \`ideaTitle\` (ringkasan judul ide 3-5 kata) dan \`ideaContent\` (penjabaran lengkap ide yang diucapkan pengguna).
   - Buat kalimat \`replyMessage\` yang sopan, ringkas (maksimal 2-3 kalimat), dan menyapa "Akhi".
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
                intent: { type: Type.STRING },
                taskTitle: { type: Type.STRING },
                scheduleTime: { type: Type.STRING },
                isoDateTime: { type: Type.STRING },
                ideaTitle: { type: Type.STRING },
                ideaContent: { type: Type.STRING },
                targetApp: { type: Type.STRING },
                replyMessage: { type: Type.STRING },
              },
              required: ["transcript", "intent", "replyMessage"],
            },
          },
        });

        const parsedResult = JSON.parse(response.text || "{}");
        return NextResponse.json(parsedResult);
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

    throw lastError || new Error("Semua model sedang sibuk. Coba beberapa detik lagi.");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses perintah." },
      { status: 500 }
    );
  }
}
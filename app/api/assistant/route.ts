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
Kamu adalah asisten pribadi pintar berbahasa Indonesia untuk seorang laki-laki yang wajib kamu panggil dengan sebutan "Akhi".
Waktu sekarang adalah: ${currentTime} WIB (Referensi ISO UTC: ${isoNow}).

PRINSIP UTAMA & LANDASAN BERDISKUSI (MANHAJ SALAF):
1. Setiap kali Akhi mengajak berdiskusi, bertanya tentang agama, adab, akidah, ibadah, muamalah, maupun nasihat kehidupan ("general_chat"):
   - Jawablah sesuai manhaj Salafush Shalih (pemahaman para Sahabat, Tabi'in, dan Tabi'ut Tabi'in).
   - Wajib menyertakan dalil dari Al-Qur'an (sebutkan nama surat dan nomor ayatnya) dan/atau As-Sunnah yang shahih/hasan (sebutkan perawi haditsnya seperti HR. Bukhari, HR. Muslim, dll.).
   - Jika merujuk pendapat ulama, rujuklah penjelasan ulama Ahlus Sunnah wal Jama'ah yang mu'tabar.
   - JANGAN PERNAH mengarang atau memalsukan hadits/ayat. Jika sebuah riwayat statusnya lemah (dha'if) atau masalahnya termasuk khilafiyah yang mu'tabar di kalangan ulama salaf, sampaikan dengan jujur dan beradab.
   - Gunakan bahasa yang santun, menyejukkan, berilmu, dan penuh hikmah.
2. Untuk perintah teknis ("save_schedule", "save_idea", "open_app"), jawab dengan ringkas (1-2 kalimat) dan tetap menyapa "Akhi".

TUGAS EKSTRAKSI JSON:
1. Jika input berupa suara, tuliskan transkrip akurat dari ucapan Akhi. Jika teks, salin kembali teks tersebut.
2. Tentukan intent:
   - "save_schedule": mencatat jadwal, agenda, pengingat, atau rapat.
   - "save_idea": mencatat ide, konsep proyek, atau inspirasi.
   - "open_app": membuka aplikasi (whatsapp, youtube, instagram, maps, gmail, github).
   - "general_chat": diskusi, tanya jawab ilmu agama, nasihat, atau obrolan umum.
3. Isi field JSON:
   - Jika "save_schedule": isi \`taskTitle\`, \`scheduleTime\`, dan \`isoDateTime\` (format ISO 8601 +07:00 WIB).
   - Jika "save_idea": isi \`ideaTitle\` dan \`ideaContent\`.
   - Untuk \`replyMessage\`: jika intent adalah "general_chat", berikan penjelasan diskusi yang lengkap beserta dalil Al-Qur'an dan Haditsnya; jika intent lainnya, buat konfirmasi singkat.
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
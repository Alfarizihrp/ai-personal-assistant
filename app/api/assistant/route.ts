import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { audioBase64, mimeType, textInput, chatHistory } = body;

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

    const historyContext =
      Array.isArray(chatHistory) && chatHistory.length > 0
        ? `\nRIWAYAT DISKUSI SEBELUMNYA (Gunakan sebagai konteks jika Akhi bertanya lanjutan):\n${chatHistory
            .slice(-6)
            .map((m: { role: string; text: string }) => `${m.role === "user" ? "Akhi" : "Asisten"}: ${m.text}`)
            .join("\n")}\n`
        : "";

    const prompt = `
Kamu adalah asisten pribadi pintar berbahasa Indonesia untuk seorang laki-laki yang wajib kamu panggil dengan sebutan "Akhi".
Waktu sekarang adalah: ${currentTime} WIB (Referensi ISO UTC: ${isoNow}).
${historyContext}
PRINSIP UTAMA & KARAKTER DISKUSI (MANHAJ SALAF):
1. Gaya bahasa dan pembawaanmu seperti seorang penuntut ilmu syar'i yang tenang, rendah hati, santun, penuh hikmah, dan beradab.
2. Setiap kali Akhi mengajak berdiskusi atau bertanya seputar agama, akidah, ibadah, adab, muamalah, maupun nasihat kehidupan ("general_chat"):
   - Berlandaskan Al-Qur'an dan As-Sunnah yang shahih sesuai pemahaman para Salafush Shalih (Sahabat, Tabi'in, dan Tabi'ut Tabi'in).
   - Wajib menyertakan dalil dari Al-Qur'an (nama surat & nomor ayat) dan/atau As-Sunnah yang shahih/hasan (beserta perawinya seperti HR. Bukhari, HR. Muslim, dll.).
   - Jika merujuk pendapat ulama, rujuklah penjelasan ulama Ahlus Sunnah wal Jama'ah yang mu'tabar.
   - JANGAN PERNAH mengarang dalil atau memalsukan hadits. Jika suatu riwayat lemah (dha'if) atau termasuk khilafiyah mu'tabar di kalangan ulama salaf, jelaskan dengan jujur dan proporsional.
3. Untuk perintah teknis ("save_schedule", "save_idea", "open_app"), jawab dengan ringkas (1-2 kalimat) dan tetap menyapa "Akhi".

ATURAN OUTPUT JSON (SANGAT PENTING UNTUK MAKHRAJ SUARA):
- \`replyMessage\`: Teks lengkap untuk dibaca di layar (menyertakan tulisan Arab ayat/hadits, terjemahan, perawi, dan poin penjelasan).
- \`spokenSegments\`: Daftar potongan kalimat berurutan yang akan dibacakan oleh dua mesin suara berbeda (Indonesia dan Arab) agar makhrajnya fasih:
  * Setiap bagian Bahasa Indonesia diberi \`lang: "id"\`.
  * Setiap bagian dalil Al-Qur'an, matan hadits, salam pembuka, atau doa berbahasa Arab DIPISAHKAN menjadi segmen tersendiri dengan \`lang: "ar"\` dan WAJIB ditulis dalam **huruf Arab berharakat lengkap (syakal/tashkeel penuh: fathah, kasrah, dhammah, sukun, tasydid)** agar mesin TTS Arab membacanya sesuai makhraj dan tajwid dasar (contoh: "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" atau "قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ").
  * Di dalam segmen \`lang: "id"\`, JANGAN campurkan huruf Arab; istilah serapan umum seperti "Akhi", "hadits", "Bukhari", "Muslim" boleh ditulis dengan ejaan Indonesia yang mudah dibaca.
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
      contents.push(`Perintah/Pertanyaan Akhi: "${textInput}"`);
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
                spokenSegments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      lang: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
                    required: ["lang", "text"],
                  },
                },
              },
              required: ["transcript", "intent", "replyMessage", "spokenSegments"],
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

    throw lastError || new Error("Semua model sedang sibuk. Coba beberapa saat lagi.");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses perintah." },
      { status: 500 }
    );
  }
}
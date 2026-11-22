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
1. Gaya bahasa dan pembawaanmu seperti asatidzah Ahlus Sunnah (salaf) di Indonesia: tenang, tuma'ninah, santun, rendah hati, sistematis, dan penuh hikmah.
2. Setiap kali Akhi mengajak berdiskusi atau bertanya seputar agama, akidah, ibadah, adab, muamalah, maupun nasihat kehidupan ("general_chat"):
   - Berlandaskan Al-Qur'an dan As-Sunnah yang shahih sesuai pemahaman para Salafush Shalih (Sahabat, Tabi'in, dan Tabi'ut Tabi'in).
   - Wajib menyertakan dalil dari Al-Qur'an (nama surat & nomor ayat) dan/atau As-Sunnah yang shahih/hasan (beserta perawinya seperti HR. Bukhari, HR. Muslim, dll.).
   - Jika merujuk pendapat ulama, rujuklah penjelasan ulama Ahlus Sunnah wal Jama'ah yang mu'tabar.
   - JANGAN PERNAH mengarang dalil atau memalsukan hadits. Jika suatu riwayat lemah (dha'if) atau termasuk khilafiyah mu'tabar di kalangan ulama salaf, jelaskan dengan jujur dan proporsional.
3. Klasifikasi Intent:
   - "daily_briefing": jika Akhi meminta ringkasan hari ini, daily briefing, mengecek daftar agenda/jadwal yang sudah tersimpan, atau meminta faedah pagi (contoh: "ringkasan hari ini", "apa jadwal saya hari ini?", "briefing pagi").
   - "save_schedule": jika Akhi ingin MENAMBAH/MENCATAT jadwal baru.
   - "save_idea": jika Akhi ingin MENYIMPAN ide atau catatan baru.
   - "open_app": jika Akhi meminta membuka aplikasi tertentu.
   - "general_chat": diskusi ilmu agama, tanya dalil, nasihat, atau obrolan umum.

ATURAN OUTPUT JSON (SANGAT PENTING):
- \`replyMessage\`: Teks lengkap untuk dibaca di layar (menyertakan tulisan Arab ayat/hadits, terjemahan, perawi, dan poin penjelasan yang rapi).
- \`spokenText\`: Naskah khusus berbahasa Indonesia untuk dibacakan oleh mesin suara (TTS) Indonesia agar terdengar seperti ustadz/asatidzah Indonesia yang sedang menyampaikan ilmu:
  * WAJIB 100% menggunakan alfabet Latin Bahasa Indonesia (JANGAN ada huruf Arab sama sekali agar mesin suara tidak gagap atau melewati kata).
  * Gunakan tanda koma dan titik yang pas untuk mengatur jeda napas agar pembawaannya tenang dan tuma'ninah.
  * Tulis istilah syar'i, salam, shalawat, dan nama perawi dengan ejaan Indonesia yang enak dilafalkan mesin suara Indonesia (contoh: "Assalaamu 'alaikum warahmatullaahi wabarakaatuh, Akhi.", "Rasulullah shallallaahu 'alaihi wa sallam bersabda,", "Dalam hadits shahih yang diriwayatkan oleh Imam Al-Bukhari dan Imam Muslim,").
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
                spokenText: { type: Type.STRING },
              },
              required: ["transcript", "intent", "replyMessage", "spokenText"],
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
import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { schedules } = await req.json();

    const now = new Date();
    const currentTime = now.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    });

    const activeSchedules = Array.isArray(schedules)
      ? schedules.filter((s: any) => !s.is_done)
      : [];

    const scheduleListText =
      activeSchedules.length > 0
        ? activeSchedules
            .map(
              (s: any, idx: number) =>
                `${idx + 1}. ${s.title} — Waktu: ${s.schedule_time}`
            )
            .join("\n")
        : "Tidak ada agenda tertunda di daftar jadwal saat ini.";

    const prompt = `
Kamu adalah asisten pribadi pintar berbahasa Indonesia untuk seorang laki-laki yang wajib kamu panggil dengan sebutan "Akhi".
Waktu sekarang adalah: ${currentTime} WIB.

Berikut adalah daftar agenda/jadwal Akhi yang belum selesai dari database:
${scheduleListText}

TUGASMU (DAILY BRIEFING & FAEDAH ILMU):
1. Buka dengan salam Islami dan sapaan hangat kepada "Akhi" sesuai waktu saat ini (pagi/siang/sore/malam).
2. Sampaikan ringkasan agenda/jadwal yang perlu diperhatikan Akhi hari ini atau dalam waktu dekat berdasarkan daftar di atas. Jika daftar jadwal kosong, sampaikan dengan positif bahwa waktu luang adalah nikmat besar yang hendaknya diisi dengan ketaatan dan hal bermanfaat.
3. Tutup dengan **1 Faedah Ilmu Singkat** (mutiara nasihat) seputar manajemen waktu, keikhlasan, adab menuntut ilmu, atau semangat beramal shalih yang berlandaskan Al-Qur'an atau Hadits Shahih/Hasan (sebutkan sumber ayat atau perawi haditsnya secara akurat, JANGAN mengarang dalil).

ATURAN OUTPUT JSON:
- \`replyMessage\`: Teks lengkap yang rapi dengan poin-poin dan emoji seperlunya untuk dibaca di layar (boleh menyertakan teks Arab dalil jika ada).
- \`spokenText\`: Naskah khusus berbahasa Indonesia 100% alfabet Latin (TANPA huruf Arab dan TANPA simbol markdown) dengan tanda koma dan titik yang pas agar dibacakan dengan suara tenang, tuma'ninah, dan berwibawa oleh mesin suara Indonesia.
`;

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
          contents: [prompt],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyMessage: { type: Type.STRING },
                spokenText: { type: Type.STRING },
              },
              required: ["replyMessage", "spokenText"],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}");
        return NextResponse.json(parsed);
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

    throw lastError || new Error("Server AI sedang sibuk. Coba beberapa saat lagi.");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal membuat Daily Briefing." },
      { status: 500 }
    );
  }
}
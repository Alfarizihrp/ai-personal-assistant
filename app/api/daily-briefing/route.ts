import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateContentWithFallback } from "@/lib/gemini";
import { isGuestSession } from "@/lib/session-server";

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

    if (await isGuestSession()) {
      const spokenItems =
        activeSchedules.length > 0
          ? activeSchedules
              .map((s: any, idx: number) => `Agenda ${idx + 1}: ${s.title}, waktu ${s.schedule_time}`)
              .join(". ")
          : "Saat ini tidak ada agenda tertunda";

      return NextResponse.json({
        sandbox: true,
        replyMessage:
          `Assalaamu 'alaikum wa rahmatullaahi wa barakaatuh, Akhi (Mode Demo).\n\n` +
          `Berikut ringkasan agenda aktif di sandbox:\n${scheduleListText}\n\n` +
          `Faedah Ilmu Hari Ini:\n` +
          `Dari Ibnu 'Abbas radhiyallaahu 'anhuma, Nabi shallallaahu 'alaihi wa sallam bersabda: ` +
          `"Dua kenikmatan yang banyak manusia tertipu di dalamnya: kesehatan dan waktu luang." (HR. Bukhari no. 6412).`,
        spokenText:
          `Assalaamu alaikum Akhi. Berikut ringkasan agenda di mode demo. ${spokenItems}. ` +
          `Faedah hari ini dari hadits riwayat Bukhari: dua kenikmatan yang banyak manusia tertipu di dalamnya adalah kesehatan dan waktu luang.`,
      });
    }

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

    const response = await generateContentWithFallback({
      contents: [prompt],
      retryDelayMs: 800,
      label: "Daily Briefing AI",
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal membuat Daily Briefing." },
      { status: 500 }
    );
  }
}
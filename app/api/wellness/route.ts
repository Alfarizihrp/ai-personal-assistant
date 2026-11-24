import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GUEST_NUTRITION_LOGS, GUEST_WORKOUT_LOGS } from "@/lib/guest-sandbox";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Urutan model dari yang tercepat hingga cadangan jika terjadi lonjakan trafik (503)
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

async function generateWithFallback(params: {
  contents: any;
  config?: Record<string, any>;
}) {
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      return await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      // Jika 503 (High Demand), 429 (Rate Limit), atau 404 (Model not found), lanjut ke model berikutnya
      if (
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("429") ||
        msg.includes("404")
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Semua model AI sedang sibuk. Coba beberapa saat lagi.");
}

async function isGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const session = await verifySessionToken(token);
  return session?.role === "guest";
}

function parseAiJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({
        nutrition: GUEST_NUTRITION_LOGS,
        workouts: GUEST_WORKOUT_LOGS,
        sandbox: true,
      });
    }

    const [nutriRes, workoutRes] = await Promise.all([
      supabaseAdmin
        .from("nutrition_logs")
        .select("*")
        .order("id", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("workout_logs")
        .select("*")
        .order("id", { ascending: false })
        .limit(10),
    ]);

    if (nutriRes.error) throw new Error(nutriRes.error.message);
    if (workoutRes.error) throw new Error(workoutRes.error.message);

    return NextResponse.json({
      nutrition: nutriRes.data || [],
      workouts: workoutRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const guest = await isGuestSession();

    // 1. Analisis Foto Makanan (Zero-Blob Vision Inference)
    if (body.action === "analyze_meal") {
      const { imageBase64, mimeType } = body;
      if (!imageBase64) {
        return NextResponse.json({ error: "Gambar makanan wajib diunggah." }, { status: 400 });
      }

      const prompt = `Analisis foto makanan ini sebagai ahli gizi. Estimasi porsi di foto dan keluarkan JSON dengan field:
- food_name (string nama makanan & porsi singkat)
- calories (number kkal)
- protein_g (number gram)
- carbs_g (number gram)
- fat_g (number gram)
- ai_notes (string saran gizi 1 kalimat singkat)`;

      const result = await generateWithFallback({
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const parsed = parseAiJson(result.text || "{}", {
        food_name: "Makanan Terdeteksi",
        calories: 350,
        protein_g: 20,
        carbs_g: 40,
        fat_g: 10,
        ai_notes: "Estimasi otomatis dari foto makanan.",
      });

      const logPayload = {
        food_name: parsed.food_name || "Makanan Terdeteksi",
        calories: Number(parsed.calories) || 0,
        protein_g: Number(parsed.protein_g) || 0,
        carbs_g: Number(parsed.carbs_g) || 0,
        fat_g: Number(parsed.fat_g) || 0,
        ai_notes: parsed.ai_notes || "",
      };

      if (guest) {
        return NextResponse.json({
          entry: { id: Date.now(), ...logPayload, created_at: new Date().toISOString() },
          sandbox: true,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("nutrition_logs")
        .insert([logPayload])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ entry: data });
    }

    // 2. Buat Skema Olahraga Terpantau AI
    if (body.action === "generate_workout") {
      const goal = body.goal?.trim() || "Latihan kebugaran 30 menit di rumah tanpa alat";

      const prompt = `Buatkan 1 sesi rencana latihan singkat & praktis untuk target: "${goal}".
Keluarkan JSON dengan field:
- routine_name (string judul sesi singkat)
- duration_minutes (number durasi menit)
- ai_plan (string poin pemanasan, 3-4 gerakan inti set x repetisi, dan pendinginan maksimal 3 kalimat)`;

      const result = await generateWithFallback({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const parsed = parseAiJson(result.text || "{}", {
        routine_name: goal,
        duration_minutes: 30,
        ai_plan: "Pemanasan 5 mnt, 3 set Push-up x 12, Squat x 15, Plank 45 dtk, Pendinginan 5 mnt.",
      });

      const workoutPayload = {
        routine_name: parsed.routine_name || goal,
        duration_minutes: Number(parsed.duration_minutes) || 30,
        ai_plan: parsed.ai_plan || "",
        ai_evaluation: null,
        is_completed: false,
      };

      if (guest) {
        return NextResponse.json({
          workout: { id: Date.now(), ...workoutPayload, created_at: new Date().toISOString() },
          sandbox: true,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .insert([workoutPayload])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ workout: data });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memproses data kesehatan." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, routine_name, duration_minutes } = await req.json();
    const guest = await isGuestSession();

    const evalPrompt = `Pengguna baru menyelesaikan olahraga "${routine_name}" (${duration_minutes} menit). Berikan 1-2 kalimat evaluasi pelatih yang memotivasi dan saran hidrasi singkat dalam bahasa Indonesia.`;
    const evalRes = await generateWithFallback({
      contents: evalPrompt,
      config: {
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const ai_evaluation = (
      evalRes.text || "Luar biasa! Pastikan cukup minum air putih untuk pemulihan otot."
    ).trim();

    if (guest) {
      return NextResponse.json({ success: true, ai_evaluation, sandbox: true });
    }

    const { error } = await supabaseAdmin
      .from("workout_logs")
      .update({ is_completed: true, ai_evaluation })
      .eq("id", id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, ai_evaluation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "workout" atau "nutrition"
    const id = searchParams.get("id");

    if ((type !== "workout" && type !== "nutrition") || !id) {
      return NextResponse.json({ error: "Parameter hapus tidak valid." }, { status: 400 });
    }

    if (await isGuestSession()) {
      return NextResponse.json({ success: true, sandbox: true });
    }

    const table = type === "workout" ? "workout_logs" : "nutrition_logs";
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
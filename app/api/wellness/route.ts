import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GUEST_NUTRITION_LOGS, GUEST_WORKOUT_LOGS } from "@/lib/guest-sandbox";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const FALLBACK_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
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
      console.warn(`[Wellness AI] Model ${model} gagal:`, msg);
      if (
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("429") ||
        msg.includes("404") ||
        msg.includes("400")
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Semua model AI sedang sibuk.");
}

// Skema cadangan cerdas jika seluruh server Gemini mengalami 503 High Demand
function buildFallbackWorkoutPlan(goal: string) {
  const g = goal.toLowerCase();
  const durationMatch = g.match(/(\d+)\s*(menit|mnt|min)/);
  const duration = durationMatch ? Number(durationMatch[1]) : 30;

  if (g.includes("cardio") || g.includes("kardio") || g.includes("lari") || g.includes("fat")) {
    return {
      routine_name: `Kardio & Pembakaran Lemak (${goal})`,
      duration_minutes: duration,
      ai_plan:
        "Pemanasan 5 mnt (jalan di tempat & peregangan dinamis). Inti 3 putaran: Jumping Jacks 45 dtk, High Knees 30 dtk, Mountain Climbers 30 dtk, istirahat 45 dtk antar putaran. Pendinginan 5 mnt.",
    };
  }

  if (g.includes("upper") || g.includes("dada") || g.includes("tangan") || g.includes("push")) {
    return {
      routine_name: `Upper Body Strength (${goal})`,
      duration_minutes: duration,
      ai_plan:
        "Pemanasan sendi bahu & pergelangan 5 mnt. Inti 3 set: Push-up 10-15 rep, Pike Push-up 8-12 rep, Tricep Dips (kursi) 12 rep, Plank Shoulder Taps 30 dtk (istirahat 60 dtk). Pendinginan 5 mnt.",
    };
  }

  if (g.includes("kaki") || g.includes("lower") || g.includes("squat")) {
    return {
      routine_name: `Lower Body & Leg Endurance (${goal})`,
      duration_minutes: duration,
      ai_plan:
        "Pemanasan pinggul & lutut 5 mnt. Inti 3 set: Bodyweight Squat 15 rep, Reverse Lunges 12 rep/kaki, Glute Bridge 15 rep, Calf Raises 20 rep (istirahat 60 dtk). Pendinginan 5 mnt.",
    };
  }

  return {
    routine_name: `Full Body Home Workout (${goal})`,
    duration_minutes: duration,
    ai_plan:
      "Pemanasan dinamis 5 mnt. Inti 3 set: Push-up 12 rep, Bodyweight Squat 15 rep, Plank 45 dtk, Jumping Jacks 40 dtk (istirahat 60 dtk antar set). Pendinginan & peregangan 5 mnt.",
  };
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

    // 1A. Analisis Foto Makanan (Zero-Blob Vision Inference)
    if (body.action === "analyze_meal") {
      const { imageBase64, mimeType } = body;
      if (!imageBase64) {
        return NextResponse.json({ error: "Gambar makanan wajib diunggah." }, { status: 400 });
      }

      const prompt = `Analisis foto makanan ini sebagai ahli gizi. Estimasi porsi di foto dan keluarkan HANYA JSON valid tanpa markdown dengan field:
{
  "food_name": "Nama makanan & porsi singkat",
  "calories": 400,
  "protein_g": 25,
  "carbs_g": 45,
  "fat_g": 12,
  "ai_notes": "Saran gizi 1 kalimat singkat"
}`;

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

      if (error) throw new Error(`Database error (nutrition_logs): ${error.message}`);
      return NextResponse.json({ entry: data });
    }

    // 1B. Catat Makanan dari Suara / Teks (Tanpa Foto, mendukung ID/EN/AR)
    if (body.action === "log_meal_text") {
      const description = body.description?.trim() || "Makanan Harian";

      const prompt = `Estimasi nilai gizi dari deskripsi makanan berikut: "${description}".
Gunakan bahasa yang sama dengan input pengguna (Indonesia, English, atau Arab) untuk nilai food_name dan ai_notes.
Keluarkan HANYA JSON valid tanpa markdown dengan field:
{
  "food_name": "Nama menu makanan & porsi singkat",
  "calories": 400,
  "protein_g": 20,
  "carbs_g": 45,
  "fat_g": 12,
  "ai_notes": "Saran gizi 1 kalimat singkat"
}`;

      let parsed = {
        food_name: description,
        calories: 350,
        protein_g: 15,
        carbs_g: 45,
        fat_g: 10,
        ai_notes: "Dicatat melalui perintah suara/teks.",
      };

      try {
        const result = await generateWithFallback({
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
        parsed = parseAiJson(result.text || "{}", parsed);
      } catch {
        // Gunakan estimasi default jika AI sedang sibuk
      }

      const logPayload = {
        food_name: parsed.food_name || description,
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

      if (error) throw new Error(`Database error (nutrition_logs): ${error.message}`);
      return NextResponse.json({ entry: data });
    }

    // 2. Buat Skema Olahraga (Dengan Graceful Degradation jika AI 503 & mendukung ID/EN/AR)
    if (body.action === "generate_workout") {
      const goal = body.goal?.trim() || "Latihan kebugaran 30 menit di rumah tanpa alat";
      const fallbackPlan = buildFallbackWorkoutPlan(goal);

      let parsed = fallbackPlan;
      try {
        const prompt = `Buatkan 1 sesi rencana latihan singkat & praktis untuk target: "${goal}".
Gunakan bahasa yang sama dengan input target pengguna (Indonesia, English, atau Arab) untuk nilai routine_name dan ai_plan.
Keluarkan HANYA JSON valid tanpa markdown dengan field:
{
  "routine_name": "Judul sesi singkat",
  "duration_minutes": 30,
  "ai_plan": "Poin pemanasan, 3-4 gerakan inti (set x repetisi), dan pendinginan ringkas"
}`;

        const result = await generateWithFallback({
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        });

        parsed = parseAiJson(result.text || "{}", fallbackPlan);
      } catch (aiErr: any) {
        console.warn("[Wellness AI] Menggunakan template cadangan karena server AI sibuk:", aiErr?.message);
        parsed = fallbackPlan;
      }

      const workoutPayload = {
        routine_name: parsed.routine_name || fallbackPlan.routine_name,
        duration_minutes: Number(parsed.duration_minutes) || fallbackPlan.duration_minutes,
        ai_plan: parsed.ai_plan || fallbackPlan.ai_plan,
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

      if (error) throw new Error(`Database error (workout_logs): ${error.message}`);
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

    let ai_evaluation =
      "Alhamdulillaah, sesi latihan selesai! Pastikan minum air putih yang cukup dan istirahat agar pemulihan otot optimal.";

    try {
      const evalPrompt = `Pengguna baru menyelesaikan olahraga "${routine_name}" (${duration_minutes} menit). Berikan 1-2 kalimat evaluasi pelatih yang memotivasi dan saran hidrasi singkat dalam bahasa yang sama dengan judul olahraga tersebut.`;
      const evalRes = await generateWithFallback({
        contents: evalPrompt,
        config: { temperature: 0.4 },
      });
      if (evalRes.text) {
        ai_evaluation = evalRes.text.trim();
      }
    } catch {
      // Gunakan pesan evaluasi bawaan jika server AI sedang 503
    }

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
    const type = searchParams.get("type");
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
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GUEST_NUTRITION_LOGS, GUEST_WORKOUT_LOGS } from "@/lib/guest-sandbox";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const GEMINI_MODEL = "gemini-3.8-flash";

async function isGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const session = await verifySessionToken(token);
  return session?.role === "guest";
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

      const prompt = `Analisis foto makanan ini secara objektif sebagai ahli gizi.
Berikan estimasi porsi yang terlihat di foto dan kembalikan HANYA JSON valid (tanpa markdown code block) dengan struktur persis seperti berikut:
{
  "food_name": "Nama menu makanan & estimasi porsi singkat",
  "calories": 450,
  "protein_g": 28,
  "carbs_g": 50,
  "fat_g": 14,
  "ai_notes": "Saran singkat 1 kalimat terkait keseimbangan gizi makanan ini"
}`;

      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
        ],
      });

      const rawText = (result.text || "{}").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(rawText);

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

      const prompt = `Buatkan 1 sesi rencana latihan olahraga terstruktur berdasarkan target berikut: "${goal}".
Kembalikan HANYA JSON valid (tanpa markdown code block) dengan format:
{
  "routine_name": "Judul singkat sesi latihan",
  "duration_minutes": 30,
  "ai_plan": "Rincian pemanasan, gerakan inti (set x repetisi), dan pendinginan secara ringkas"
}`;

      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const rawText = (result.text || "{}").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(rawText);

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

    const evalPrompt = `Pengguna baru saja menyelesaikan sesi olahraga "${routine_name}" selama ${duration_minutes} menit. Berikan 1-2 kalimat evaluasi pelatih kebugaran yang memotivasi dan saran pemulihan/hidrasi singkat dalam bahasa Indonesia.`;
    const evalRes = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: evalPrompt,
    });
    const ai_evaluation = (evalRes.text || "").trim();

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
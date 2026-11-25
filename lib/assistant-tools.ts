import { Type, type FunctionDeclaration } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-server";
import { scheduleExactPushReminder } from "@/lib/reminders";
import { retrieveRagContext, type RagSourceMatch } from "@/lib/rag-retrieval";
import { calculateDailyNutritionSummary } from "@/lib/nutrition";
import {
  GUEST_IDEAS,
  GUEST_NUTRITION_LOGS,
  GUEST_SCHEDULES,
  GUEST_WORKOUT_LOGS,
} from "@/lib/guest-sandbox";

export type RefreshTarget = "schedules" | "ideas" | "wellness" | "rag";

export interface ToolExecutionContext {
  isGuest: boolean;
  actions: string[];
  refreshTargets: Set<RefreshTarget>;
  sources: RagSourceMatch[];
}

export const ASSISTANT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "list_schedules",
    description: "Membaca daftar jadwal/agenda Akhi dari database.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeDone: {
          type: Type.BOOLEAN,
          description: "Set true jika ingin menyertakan jadwal yang sudah selesai.",
        },
      },
    },
  },
  {
    name: "create_schedule",
    description: "Menambahkan jadwal/agenda baru beserta waktu pengingat opsional.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Judul atau nama agenda." },
        scheduleTime: {
          type: Type.STRING,
          description: "Label waktu yang mudah dibaca (misal: 'Besok, 20:00 WIB').",
        },
        isoDateTime: {
          type: Type.STRING,
          description: "Timestamp ISO-8601 UTC atau +07:00 jika waktu spesifik diketahui.",
        },
      },
      required: ["title", "scheduleTime"],
    },
  },
  {
    name: "complete_schedule",
    description: "Menandai satu agenda/jadwal sebagai selesai (is_done = true).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduleId: { type: Type.NUMBER, description: "ID jadwal jika diketahui." },
        titleQuery: {
          type: Type.STRING,
          description: "Kata kunci judul jadwal yang ingin ditandai selesai.",
        },
      },
    },
  },
  {
    name: "delete_schedule",
    description: "Menghapus agenda/jadwal berdasarkan ID atau kata kunci judul.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduleId: { type: Type.NUMBER, description: "ID jadwal jika diketahui." },
        titleQuery: {
          type: Type.STRING,
          description: "Kata kunci judul jadwal yang ingin dihapus.",
        },
      },
    },
  },
  {
    name: "create_idea",
    description: "Menyimpan catatan ide, konsep proyek, atau faedah ilmu ke Workspace.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Judul singkat ide/catatan." },
        content: { type: Type.STRING, description: "Isi detail ide atau faedah." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "get_today_nutrition",
    description: "Mengambil ringkasan log makanan, total kalori, dan protein hari ini (WIB).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "log_meal_entry",
    description: "Mencatat konsumsi makanan/minuman beserta estimasi kalori dan makro gizinya.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        foodName: { type: Type.STRING, description: "Nama makanan & estimasi porsi." },
        calories: { type: Type.NUMBER, description: "Estimasi kalori (kkal)." },
        proteinG: { type: Type.NUMBER, description: "Estimasi protein (gram)." },
        carbsG: { type: Type.NUMBER, description: "Estimasi karbohidrat (gram)." },
        fatG: { type: Type.NUMBER, description: "Estimasi lemak (gram)." },
        aiNotes: { type: Type.STRING, description: "Catatan gizi singkat 1 kalimat." },
      },
      required: ["foodName", "calories", "proteinG", "carbsG", "fatG"],
    },
  },
  {
    name: "create_workout_plan",
    description: "Membuat dan menyimpan rencana/skema latihan olahraga ke tab Sehat.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        routineName: { type: Type.STRING, description: "Judul sesi latihan." },
        durationMinutes: { type: Type.NUMBER, description: "Target durasi latihan (menit)." },
        aiPlan: {
          type: Type.STRING,
          description: "Rincian pemanasan, gerakan inti (set x rep), dan pendinginan.",
        },
      },
      required: ["routineName", "durationMinutes", "aiPlan"],
    },
  },
  {
    name: "search_memory",
    description: "Mencari informasi di Semantic Memory (RAG Knowledge Base) pribadi Akhi.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Kata kunci atau pertanyaan pencarian." },
      },
      required: ["query"],
    },
  },
];

function findMatchingByIdOrTitle<T extends { id: number; title: string }>(
  items: T[],
  id?: number,
  titleQuery?: string
): T | undefined {
  if (typeof id === "number" && Number.isFinite(id)) {
    const byId = items.find((item) => item.id === id);
    if (byId) return byId;
  }
  const q = (titleQuery || "").trim().toLowerCase();
  if (!q) return undefined;
  return items.find((item) => item.title.toLowerCase().includes(q));
}

export async function executeAssistantToolCall(
  name: string,
  args: Record<string, any> = {},
  ctx: ToolExecutionContext
): Promise<Record<string, any>> {
  switch (name) {
    case "list_schedules": {
      const includeDone = Boolean(args.includeDone);
      if (ctx.isGuest) {
        const items = includeDone
          ? GUEST_SCHEDULES
          : GUEST_SCHEDULES.filter((s) => !s.is_done);
        return { sandbox: true, schedules: items };
      }

      let query = supabaseAdmin
        .from("schedules")
        .select("id, title, schedule_time, target_datetime, is_done")
        .order("id", { ascending: false })
        .limit(20);
      if (!includeDone) {
        query = query.eq("is_done", false);
      }
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { schedules: data || [] };
    }

    case "create_schedule": {
      const title = String(args.title || "").trim();
      const scheduleTime = String(args.scheduleTime || "Waktu belum ditentukan").trim();
      const rawIso = typeof args.isoDateTime === "string" ? args.isoDateTime.trim() : "";
      const parsedIso =
        rawIso && !Number.isNaN(new Date(rawIso).getTime())
          ? new Date(rawIso).toISOString()
          : null;

      if (!title) return { error: "Judul jadwal wajib diisi." };

      ctx.refreshTargets.add("schedules");
      if (ctx.isGuest) {
        ctx.actions.push(`Jadwal (Demo): ${title}`);
        return {
          sandbox: true,
          created: { id: Date.now(), title, schedule_time: scheduleTime, target_datetime: parsedIso },
        };
      }

      const { data, error } = await supabaseAdmin
        .from("schedules")
        .insert([
          {
            title,
            schedule_time: scheduleTime,
            target_datetime: parsedIso,
            reminded: false,
          },
        ])
        .select()
        .single();

      if (error) return { error: error.message };
      if (data?.id && data?.target_datetime) {
        await scheduleExactPushReminder(data.id, data.target_datetime);
      }
      ctx.actions.push(`Jadwal disimpan: ${title}`);
      return { created: data };
    }

    case "complete_schedule": {
      const scheduleId = typeof args.scheduleId === "number" ? args.scheduleId : undefined;
      const titleQuery = typeof args.titleQuery === "string" ? args.titleQuery : undefined;

      if (ctx.isGuest) {
        const match = findMatchingByIdOrTitle(GUEST_SCHEDULES, scheduleId, titleQuery);
        if (!match) return { error: "Jadwal tidak ditemukan di sandbox." };
        ctx.refreshTargets.add("schedules");
        ctx.actions.push(`Jadwal selesai (Demo): ${match.title}`);
        return { sandbox: true, completed: { id: match.id, title: match.title } };
      }

      const { data: candidates, error: fetchErr } = await supabaseAdmin
        .from("schedules")
        .select("id, title, is_done")
        .eq("is_done", false)
        .order("id", { ascending: false })
        .limit(30);

      if (fetchErr) return { error: fetchErr.message };
      const target = findMatchingByIdOrTitle(candidates || [], scheduleId, titleQuery);
      if (!target) {
        return { error: "Jadwal aktif yang cocok tidak ditemukan." };
      }

      const { error: updErr } = await supabaseAdmin
        .from("schedules")
        .update({ is_done: true })
        .eq("id", target.id);

      if (updErr) return { error: updErr.message };
      ctx.refreshTargets.add("schedules");
      ctx.actions.push(`Jadwal ditandai selesai: ${target.title}`);
      return { completed: { id: target.id, title: target.title } };
    }

    case "delete_schedule": {
      const scheduleId = typeof args.scheduleId === "number" ? args.scheduleId : undefined;
      const titleQuery = typeof args.titleQuery === "string" ? args.titleQuery : undefined;

      if (ctx.isGuest) {
        const match = findMatchingByIdOrTitle(GUEST_SCHEDULES, scheduleId, titleQuery);
        if (!match) return { error: "Jadwal tidak ditemukan di sandbox." };
        ctx.refreshTargets.add("schedules");
        ctx.actions.push(`Jadwal dihapus (Demo): ${match.title}`);
        return { sandbox: true, deleted: { id: match.id, title: match.title } };
      }

      const { data: candidates, error: fetchErr } = await supabaseAdmin
        .from("schedules")
        .select("id, title")
        .order("id", { ascending: false })
        .limit(30);

      if (fetchErr) return { error: fetchErr.message };
      const target = findMatchingByIdOrTitle(candidates || [], scheduleId, titleQuery);
      if (!target) {
        return { error: "Jadwal yang cocok tidak ditemukan." };
      }

      const { error: delErr } = await supabaseAdmin
        .from("schedules")
        .delete()
        .eq("id", target.id);

      if (delErr) return { error: delErr.message };
      ctx.refreshTargets.add("schedules");
      ctx.actions.push(`Jadwal dihapus: ${target.title}`);
      return { deleted: { id: target.id, title: target.title } };
    }

    case "create_idea": {
      const title = String(args.title || "Catatan Ide").trim();
      const content = String(args.content || "").trim();
      if (!content) return { error: "Isi catatan tidak boleh kosong." };

      ctx.refreshTargets.add("ideas");
      if (ctx.isGuest) {
        ctx.actions.push(`Ide dicatat (Demo): ${title}`);
        return {
          sandbox: true,
          created: { id: Date.now(), title, content, previewCount: GUEST_IDEAS.length },
        };
      }

      const { data, error } = await supabaseAdmin
        .from("ideas")
        .insert([{ title, content }])
        .select()
        .single();

      if (error) return { error: error.message };
      ctx.actions.push(`Ide disimpan: ${title}`);
      return { created: data };
    }

    case "get_today_nutrition": {
      if (ctx.isGuest) {
        const summary = calculateDailyNutritionSummary(GUEST_NUTRITION_LOGS);
        return {
          sandbox: true,
          dateWib: summary.todayKey,
          totalCalories: summary.totalCalories,
          totalProteinG: summary.totalProtein,
          entries: summary.todayEntries,
          recentWorkouts: GUEST_WORKOUT_LOGS,
        };
      }

      const { data, error } = await supabaseAdmin
        .from("nutrition_logs")
        .select("*")
        .order("id", { ascending: false })
        .limit(20);

      if (error) return { error: error.message };
      const summary = calculateDailyNutritionSummary(data || []);
      return {
        dateWib: summary.todayKey,
        totalCalories: summary.totalCalories,
        totalProteinG: summary.totalProtein,
        entries: summary.todayEntries,
      };
    }

    case "log_meal_entry": {
      const payload = {
        food_name: String(args.foodName || "Makanan Harian").trim(),
        calories: Number(args.calories) || 0,
        protein_g: Number(args.proteinG) || 0,
        carbs_g: Number(args.carbsG) || 0,
        fat_g: Number(args.fatG) || 0,
        ai_notes: String(args.aiNotes || "Dicatat otomatis oleh asisten.").trim(),
      };

      ctx.refreshTargets.add("wellness");
      if (ctx.isGuest) {
        ctx.actions.push(`Makan dicatat (Demo): ${payload.food_name} (${payload.calories} kkal)`);
        return { sandbox: true, entry: { id: Date.now(), ...payload } };
      }

      const { data, error } = await supabaseAdmin
        .from("nutrition_logs")
        .insert([payload])
        .select()
        .single();

      if (error) return { error: error.message };
      ctx.actions.push(`Nutrisi dicatat: ${payload.food_name} (${payload.calories} kkal)`);
      return { entry: data };
    }

    case "create_workout_plan": {
      const payload = {
        routine_name: String(args.routineName || "Latihan Kebugaran").trim(),
        duration_minutes: Number(args.durationMinutes) || 30,
        ai_plan: String(args.aiPlan || "").trim(),
        ai_evaluation: null,
        is_completed: false,
      };

      ctx.refreshTargets.add("wellness");
      if (ctx.isGuest) {
        ctx.actions.push(`Skema olahraga dibuat (Demo): ${payload.routine_name}`);
        return { sandbox: true, workout: { id: Date.now(), ...payload } };
      }

      const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .insert([payload])
        .select()
        .single();

      if (error) return { error: error.message };
      ctx.actions.push(`Skema olahraga dibuat: ${payload.routine_name}`);
      return { workout: data };
    }

    case "search_memory": {
      const query = String(args.query || "").trim();
      if (!query) return { results: [] };
      const rag = await retrieveRagContext(query, ctx.isGuest);
      for (const src of rag.matchedSources) {
        if (!ctx.sources.some((existing) => existing.title === src.title)) {
          ctx.sources.push(src);
        }
      }
      return {
        found: rag.matchedSources.length > 0,
        sources: rag.matchedSources,
        context: rag.ragContext || "Tidak ditemukan catatan yang relevan.",
      };
    }

    default:
      return { error: `Tool "${name}" tidak dikenali.` };
  }
}

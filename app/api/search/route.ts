import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        schedules: [],
        ideas: [],
        knowledge: [],
      });
    }

    const pattern = `%${query}%`;

    const [schedRes, ideasRes, kbRes] = await Promise.all([
      supabaseAdmin
        .from("schedules")
        .select("id, title, schedule_time, is_done")
        .or(`title.ilike.${pattern},schedule_time.ilike.${pattern}`)
        .limit(5),
      supabaseAdmin
        .from("ideas")
        .select("id, title, content, created_at")
        .or(`title.ilike.${pattern},content.ilike.${pattern},ai_expansion.ilike.${pattern}`)
        .limit(5),
      supabaseAdmin
        .from("knowledge_base")
        .select("id, title, category, content")
        .or(`title.ilike.${pattern},category.ilike.${pattern},content.ilike.${pattern}`)
        .limit(6),
    ]);

    if (schedRes.error) throw new Error(schedRes.error.message);
    if (ideasRes.error) throw new Error(ideasRes.error.message);
    if (kbRes.error) throw new Error(kbRes.error.message);

    // Deduplikasi dokumen memori berdasarkan judul agar tidak tampil berulang per chunk
    const uniqueKbMap = new Map<
      string,
      { id: number; title: string; category: string; snippet: string }
    >();

    for (const row of kbRes.data || []) {
      if (!uniqueKbMap.has(row.title)) {
        uniqueKbMap.set(row.title, {
          id: row.id,
          title: row.title,
          category: row.category || "Catatan Umum",
          snippet: row.content.slice(0, 140) + (row.content.length > 140 ? "..." : ""),
        });
      }
    }

    return NextResponse.json({
      schedules: schedRes.data || [],
      ideas: ideasRes.data || [],
      knowledge: Array.from(uniqueKbMap.values()),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
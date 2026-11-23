import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  GUEST_SCHEDULES,
  GUEST_IDEAS,
  GUEST_KNOWLEDGE_DOCS,
} from "@/lib/guest-sandbox";

async function isGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("akhi_session")?.value;
  if (!token) return false;
  const session = await verifySessionToken(token);
  return session?.role === "guest";
}

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

    // Jika mode tamu, saring langsung dari dataset simulasi
    if (await isGuestSession()) {
      const qLower = query.toLowerCase();

      const schedules = GUEST_SCHEDULES.filter(
        (s) =>
          s.title.toLowerCase().includes(qLower) ||
          s.schedule_time.toLowerCase().includes(qLower)
      ).map(({ id, title, schedule_time, is_done }) => ({
        id,
        title,
        schedule_time,
        is_done,
      }));

      const ideas = GUEST_IDEAS.filter(
        (i) =>
          i.title.toLowerCase().includes(qLower) ||
          i.content.toLowerCase().includes(qLower)
      ).map(({ id, title, content, created_at }) => ({
        id,
        title,
        content,
        created_at,
      }));

      const knowledge = GUEST_KNOWLEDGE_DOCS.filter(
        (k) =>
          k.title.toLowerCase().includes(qLower) ||
          k.category.toLowerCase().includes(qLower) ||
          k.preview.toLowerCase().includes(qLower)
      ).map((k, idx) => ({
        id: 700 + idx,
        title: k.title,
        category: k.category,
        snippet: k.preview.slice(0, 140) + "...",
      }));

      return NextResponse.json({ schedules, ideas, knowledge });
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
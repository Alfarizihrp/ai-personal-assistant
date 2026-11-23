import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET: Ambil seluruh jadwal dan ide
export async function GET() {
  try {
    const [schedRes, ideaRes] = await Promise.all([
      supabaseAdmin.from("schedules").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("ideas").select("*").order("created_at", { ascending: false }),
    ]);

    if (schedRes.error) throw new Error(schedRes.error.message);
    if (ideaRes.error) throw new Error(ideaRes.error.message);

    return NextResponse.json({
      schedules: schedRes.data || [],
      ideas: ideaRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Tambah jadwal baru atau ide baru
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resource, payload } = body;

    if (resource === "schedules") {
      const { error } = await supabaseAdmin.from("schedules").insert([payload]);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (resource === "ideas") {
      const { error } = await supabaseAdmin.from("ideas").insert([payload]);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Resource tidak valid." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Update jadwal atau ide (status selesai, edit teks, reminded, ai_expansion)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { resource, id, updates } = body;

    if (!id || (resource !== "schedules" && resource !== "ideas")) {
      return NextResponse.json({ error: "Parameter update tidak valid." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(resource)
      .update(updates)
      .eq("id", id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Hapus jadwal atau ide
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource");
    const id = searchParams.get("id");

    if (!id || (resource !== "schedules" && resource !== "ideas")) {
      return NextResponse.json({ error: "Parameter hapus tidak valid." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(resource)
      .delete()
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
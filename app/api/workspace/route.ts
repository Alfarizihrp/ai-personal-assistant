import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GUEST_SCHEDULES, GUEST_IDEAS } from "@/lib/guest-sandbox";

async function isGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("akhi_session")?.value;
  if (!token) return false;
  const session = await verifySessionToken(token);
  return session?.role === "guest";
}

export async function GET() {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({
        schedules: GUEST_SCHEDULES,
        ideas: GUEST_IDEAS,
        sandbox: true,
      });
    }

    const [schedRes, ideasRes] = await Promise.all([
      supabaseAdmin.from("schedules").select("*").order("id", { ascending: false }),
      supabaseAdmin.from("ideas").select("*").order("id", { ascending: false }),
    ]);

    if (schedRes.error) throw new Error(schedRes.error.message);
    if (ideasRes.error) throw new Error(ideasRes.error.message);

    return NextResponse.json({
      schedules: schedRes.data || [],
      ideas: ideasRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { resource, payload } = await req.json();

    if (await isGuestSession()) {
      return NextResponse.json({
        data: { id: Date.now(), ...payload, is_done: false, created_at: new Date().toISOString() },
        sandbox: true,
      });
    }

    if (resource !== "schedules" && resource !== "ideas") {
      return NextResponse.json({ error: "Resource tidak valid." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(resource)
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({ success: true, sandbox: true });
    }

    const { resource, id, updates } = await req.json();
    if (resource !== "schedules" && resource !== "ideas") {
      return NextResponse.json({ error: "Resource tidak valid." }, { status: 400 });
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

export async function DELETE(req: Request) {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({ success: true, sandbox: true });
    }

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource");
    const id = searchParams.get("id");

    if ((resource !== "schedules" && resource !== "ideas") || !id) {
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
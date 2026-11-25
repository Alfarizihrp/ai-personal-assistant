import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isGuestSession } from "@/lib/session-server";
import { scheduleExactPushReminder } from "@/lib/reminders";
import { GUEST_SCHEDULES, GUEST_IDEAS } from "@/lib/guest-sandbox";

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

    let reminderScheduled = false;
    if (resource === "schedules" && data?.id && data?.target_datetime) {
      const qstashResult = await scheduleExactPushReminder(
        data.id,
        data.target_datetime
      );
      reminderScheduled = qstashResult.scheduled;
    }

    return NextResponse.json({ data, reminderScheduled });
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

    if (resource === "schedules" && id && updates?.target_datetime) {
      await scheduleExactPushReminder(Number(id), updates.target_datetime);
    }

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
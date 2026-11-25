import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isGuestSession } from "@/lib/session-server";

function isMissingChatTableError(message?: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("chat_messages") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("relation"))
  );
}

export async function GET() {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({ messages: [], sandbox: true });
    }

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, text, spoken_text, intent, sources, actions, created_at")
      .order("id", { ascending: true })
      .limit(60);

    if (error) {
      if (isMissingChatTableError(error.message)) {
        return NextResponse.json({ messages: [], tableMissing: true });
      }
      throw new Error(error.message);
    }

    const messages = (data || []).map((row) => ({
      id: String(row.id),
      role: row.role === "user" ? "user" : "assistant",
      text: row.text,
      spokenText: row.spoken_text || undefined,
      intent: row.intent || undefined,
      sources: Array.isArray(row.sources) ? row.sources : undefined,
      actions: Array.isArray(row.actions) ? row.actions : undefined,
      timestamp: new Date(row.created_at).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({ success: true, sandbox: true });
    }

    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages)
      ? body.messages
      : body?.role && body?.text
      ? [body]
      : [];

    if (rawMessages.length === 0) {
      return NextResponse.json({ error: "Data pesan tidak valid." }, { status: 400 });
    }

    const rows = rawMessages
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .map((m: any) => ({
        role: m.role,
        text: m.text,
        spoken_text: m.spokenText || null,
        intent: m.intent || null,
        sources: Array.isArray(m.sources) ? m.sources : [],
        actions: Array.isArray(m.actions) ? m.actions : [],
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Format pesan kosong." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("chat_messages").insert(rows);
    if (error) {
      if (isMissingChatTableError(error.message)) {
        return NextResponse.json({ success: false, tableMissing: true });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, savedCount: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({ success: true, sandbox: true });
    }

    const { error } = await supabaseAdmin.from("chat_messages").delete().gt("id", 0);
    if (error) {
      if (isMissingChatTableError(error.message)) {
        return NextResponse.json({ success: true, tableMissing: true });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

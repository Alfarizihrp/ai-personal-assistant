import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { chunkText, generateEmbedding } from "@/lib/rag";
import { GUEST_KNOWLEDGE_DOCS } from "@/lib/guest-sandbox";
import { isGuestSession } from "@/lib/session-server";

export async function GET() {
  try {
    if (await isGuestSession()) {
      return NextResponse.json({
        documents: GUEST_KNOWLEDGE_DOCS,
        sandbox: true,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .select("id, title, category, content, created_at")
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);

    const grouped = new Map<
      string,
      {
        title: string;
        category: string;
        preview: string;
        chunkCount: number;
        created_at: string;
      }
    >();

    for (const row of data || []) {
      const existing = grouped.get(row.title);
      if (existing) {
        existing.chunkCount += 1;
      } else {
        grouped.set(row.title, {
          title: row.title,
          category: row.category || "Catatan Umum",
          preview: row.content.slice(0, 180) + (row.content.length > 180 ? "..." : ""),
          chunkCount: 1,
          created_at: row.created_at,
        });
      }
    }

    return NextResponse.json({
      documents: Array.from(grouped.values()),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, category, content } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Judul dan isi dokumen wajib diisi." },
        { status: 400 }
      );
    }

    // Jika sedang dalam Mode Demo Tamu, kembalikan simulasi sukses tanpa menyentuh database
    if (await isGuestSession()) {
      const simulatedChunks = chunkText(content.trim(), 500, 80);
      return NextResponse.json({
        success: true,
        chunksSaved: simulatedChunks.length,
        sandbox: true,
      });
    }

    const chunks = chunkText(content.trim(), 500, 80);
    const rowsToInsert = [];

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      rowsToInsert.push({
        title: title.trim(),
        category: category?.trim() || "Catatan Umum",
        content: chunk,
        embedding,
      });
    }

    const { error } = await supabaseAdmin.from("knowledge_base").insert(rowsToInsert);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      chunksSaved: rowsToInsert.length,
    });
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
    const title = searchParams.get("title");

    if (!title) {
      return NextResponse.json({ error: "Judul dokumen tidak valid." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("knowledge_base")
      .delete()
      .eq("title", title);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
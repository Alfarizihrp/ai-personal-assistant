import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { chunkText, generateEmbedding } from "@/lib/rag";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .select("id, title, category, content, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Kelompokkan potongan (chunks) berdasarkan judul agar rapi ditampilkan di UI
    const groupedMap = new Map<
      string,
      { title: string; category: string; preview: string; chunkCount: number; created_at: string }
    >();

    for (const row of data || []) {
      const existing = groupedMap.get(row.title);
      if (!existing) {
        groupedMap.set(row.title, {
          title: row.title,
          category: row.category || "Catatan Umum",
          preview: row.content.slice(0, 180) + (row.content.length > 180 ? "..." : ""),
          chunkCount: 1,
          created_at: row.created_at,
        });
      } else {
        existing.chunkCount += 1;
      }
    }

    return NextResponse.json({ documents: Array.from(groupedMap.values()) });
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

    const cleanTitle = title.trim();
    const cleanCategory = category?.trim() || "Catatan Umum";
    const chunks = chunkText(content.trim());

    const rowsToInsert = [];
    for (let i = 0; i < chunks.length; i++) {
      const textToEmbed = `Judul: ${cleanTitle} (${cleanCategory})\n${chunks[i]}`;
      const embedding = await generateEmbedding(textToEmbed);

      rowsToInsert.push({
        title: cleanTitle,
        category: cleanCategory,
        content: chunks[i],
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
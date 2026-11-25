import { generateEmbedding } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GUEST_KNOWLEDGE_DOCS } from "@/lib/guest-sandbox";

export interface RagSourceMatch {
  title: string;
  category: string;
  similarity: number;
}

export interface RagRetrievalResult {
  ragContext: string;
  matchedSources: RagSourceMatch[];
}

export async function retrieveRagContext(
  queryText: string,
  isGuest: boolean
): Promise<RagRetrievalResult> {
  const trimmed = queryText.trim();
  if (trimmed.length <= 3) {
    return { ragContext: "", matchedSources: [] };
  }

  if (isGuest) {
    const qLower = trimmed.toLowerCase();
    const guestMatches = GUEST_KNOWLEDGE_DOCS.filter(
      (doc) =>
        doc.title.toLowerCase().includes(qLower) ||
        doc.preview.toLowerCase().includes(qLower) ||
        qLower
          .split(/\s+/)
          .some((w) => w.length > 3 && doc.preview.toLowerCase().includes(w))
    );

    if (guestMatches.length === 0) {
      return { ragContext: "", matchedSources: [] };
    }

    const ragContext =
      "\nREFERENSI MEMORI & DOKUMEN SIMULASI DEMO:\n" +
      guestMatches
        .map(
          (m, i) =>
            `[Sumber ${i + 1}: "${m.title}" (${m.category})]\n${m.preview}`
        )
        .join("\n\n") +
      "\n";

    const matchedSources = guestMatches.map((m) => ({
      title: m.title,
      category: m.category,
      similarity: 88,
    }));

    return { ragContext, matchedSources };
  }

  const queryEmbedding = await generateEmbedding(trimmed);
  const { data: matches, error: rpcError } = await supabaseAdmin.rpc(
    "match_knowledge",
    {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: 4,
    }
  );

  if (rpcError || !Array.isArray(matches) || matches.length === 0) {
    return { ragContext: "", matchedSources: [] };
  }

  const ragContext =
    "\nREFERENSI MEMORI & DOKUMEN PRIBADI AKHI (GUNAKAN JIKA RELEVAN DENGAN PERTANYAAN):\n" +
    matches
      .map(
        (m: any, i: number) =>
          `[Sumber ${i + 1}: "${m.title}" (${m.category}) - Relevansi ${(
            m.similarity * 100
          ).toFixed(0)}%]\n${m.content}`
      )
      .join("\n\n") +
    "\n";

  const uniqueTitles = new Set<string>();
  const matchedSources: RagSourceMatch[] = [];

  for (const m of matches) {
    if (!uniqueTitles.has(m.title)) {
      uniqueTitles.add(m.title);
      matchedSources.push({
        title: m.title,
        category: m.category,
        similarity: Math.round(m.similarity * 100),
      });
    }
  }

  return { ragContext, matchedSources };
}

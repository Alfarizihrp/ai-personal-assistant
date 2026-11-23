export const GUEST_SCHEDULES = [
  {
    id: 901,
    title: "Technical Interview — Full-Stack / Backend Engineer",
    schedule_time: "Besok, 10:00 WIB",
    target_datetime: null,
    is_done: false,
    reminded: false,
  },
  {
    id: 902,
    title: "Code Review Arsitektur RAG & Vector Index (pgvector)",
    schedule_time: "Hari ini, 16:00 WIB",
    target_datetime: null,
    is_done: true,
    reminded: true,
  },
  {
    id: 903,
    title: "Optimasi Query & Caching API Next.js App Router",
    schedule_time: "Kamis, 19:30 WIB",
    target_datetime: null,
    is_done: true,
    reminded: true,
  },
  {
    id: 904,
    title: "Kajian Rutin & Muraja'ah Kitab",
    schedule_time: "Jum'at, 20:00 WIB",
    target_datetime: null,
    is_done: false,
    reminded: false,
  },
];

export const GUEST_IDEAS = [
  {
    id: 801,
    title: "Arsitektur Hybrid Search (BM25 + pgvector Cosine Similarity)",
    content:
      "Menggabungkan pencarian kata kunci eksak PostgreSQL Full-Text Search dengan semantic vector embedding untuk meningkatkan akurasi retrieval pada istilah teknis spesifik.",
    ai_expansion:
      "1. Tujuan: Mengatasi kelemahan pencarian vektor murni pada istilah kode atau akronim spesifik.\n2. Implementasi: Jalankan kueri paralel tsvector dan <=> cosine distance, lalu gabungkan skornya menggunakan Reciprocal Rank Fusion (RRF).\n3. Dampak: Meningkatkan presisi konteks RAG hingga 25% pada dokumen teknis.",
    created_at: new Date().toISOString(),
  },
  {
    id: 802,
    title: "Pipeline Ingestion Dokumen Otomatis untuk Knowledge Base",
    content:
      "Membuat antrean pemrosesan dokumen PDF dan Markdown dengan overlapping chunking dan deduplikasi hash SHA-256.",
    ai_expansion: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const GUEST_KNOWLEDGE_DOCS = [
  {
    title: "Arsitektur Keamanan & Autentikasi Akhi AI",
    category: "Dokumentasi Teknis & Proyek",
    preview:
      "Sistem menggunakan HTTP-Only Signed JWT Cookie (HS256) yang diverifikasi di level Next.js Edge Middleware. Seluruh tabel PostgreSQL dilindungi Row Level Security (RLS) dan hanya dapat diakses menggunakan Supabase Service Role Key di sisi server.",
    chunkCount: 3,
    created_at: new Date().toISOString(),
  },
  {
    title: "Implementasi Semantic Memory (pgvector RAG)",
    category: "Dokumentasi Teknis & Proyek",
    preview:
      "Dokumen dipecah menggunakan overlapping text chunking (500 karakter, overlap 80 karakter) dan dikonversi menjadi vektor 768-dimensi melalui model text-embedding-004 untuk pencarian kemiripan kosinus (Cosine Similarity).",
    chunkCount: 4,
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    title: "Profil & Keahlian Teknis Pengembang (Alfarizi)",
    category: "Catatan Pribadi",
    preview:
      "Software Engineer dengan fokus pada pengembangan Full-Stack & Backend Web menggunakan Next.js, TypeScript, Laravel, Python, PostgreSQL (Supabase), serta integrasi AI generatif dan arsitektur sistem berbasis UML.",
    chunkCount: 2,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];
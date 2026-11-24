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
  export const GUEST_NUTRITION_LOGS = [
  {
    id: 601,
    food_name: "Nasi Putih (150g), Dada Ayam Bakar & Tumis Buncis",
    calories: 520,
    protein_g: 42,
    carbs_g: 55,
    fat_g: 12,
    ai_notes: "Tinggi protein, porsi karbohidrat seimbang untuk energi kerja.",
    created_at: new Date().toISOString(),
  },
  {
    id: 602,
    food_name: "Telur Rebus (2 butir) & Pisang Cavendish",
    calories: 255,
    protein_g: 14,
    carbs_g: 30,
    fat_g: 10,
    ai_notes: "Camillan padat nutrisi pasca-latihan.",
    created_at: new Date().toISOString(),
  },
];

export const GUEST_WORKOUT_LOGS = [
  {
    id: 501,
    routine_name: "Upper Body & Core Strength (Push-up, Plank, Dumbbell Row)",
    duration_minutes: 35,
    ai_plan: "3 set x 12 repetisi setiap gerakan, istirahat 60 detik antar set.",
    ai_evaluation: "Konsistensi sangat baik. Pertahankan asupan protein harian minimal 90g.",
    is_completed: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 502,
    routine_name: "Zone 2 Cardio / Jalan Cepat Sore",
    duration_minutes: 30,
    ai_plan: "Jaga detak jantung stabil dan napas teratur selama 30 menit.",
    ai_evaluation: null,
    is_completed: false,
    created_at: new Date().toISOString(),
  },
];
# Akhi — Multimodal AI Personal Assistant & Semantic Memory (RAG)

Aplikasi asisten pribadi berbasis web (*Progressive Web App*) yang dirancang untuk memproses perintah suara maupun teks secara multimodal, mengelola jadwal dengan notifikasi latar belakang, menjabarkan ide kerja, serta menjawab pertanyaan berdasarkan basis pengetahuan pribadi menggunakan **Retrieval-Augmented Generation (RAG)**.

---

## Fitur Utama

1. **Multimodal Voice & Text Command (`Gemini API`)**
   - Menerima input rekaman suara langsung maupun teks, melakukan transkripsi, klasifikasi *intent* terstruktur (`JSON Schema`), dan menghasilkan balasan layar sekaligus naskah khusus *Text-to-Speech* berbahasa Indonesia.
2. **Semantic Memory & Document Search (`pgvector` RAG)**
   - Memecah dokumen/catatan panjang (*overlap chunking*), mengubahnya menjadi vektor 768-dimensi menggunakan `text-embedding-004`, dan melakukan pencocokan kemiripan makna (*Cosine Similarity*) di PostgreSQL Supabase lengkap dengan sitasi sumber dokumen.
3. **Arsitektur Keamanan Berlapis (*Defense-in-Depth*)**
   - Autentikasi PIN berbasis **HTTP-Only Signed JWT Cookie (`HS256`)**, proteksi rute API di level **Next.js Edge Middleware**, serta penguncian database menggunakan **Supabase Row Level Security (RLS)** dengan akses eksklusif `service_role` di sisi server.
4. **Installable PWA & Background Web Push Notification**
   - Dapat dipasang di layar utama perangkat seluler (*standalone mode*) dengan *Service Worker* kustom dan protokol **VAPID Web Push** yang memicu pengingat jadwal H-15 menit melalui *Serverless Cron Job*.
5. **Global Cross-Data Search & Productivity Analytics**
   - Pencarian paralel lintas tabel (`schedules`, `ideas`, dan `knowledge_base`) serta dasbor metrik real-time untuk memantau rasio penyelesaian agenda dan sebaran kategori memori.

---

## Arsitektur Sistem

```mermaid
flowchart TD
    Client["Client Browser / Mobile PWA<br/>(Next.js App Router + Service Worker)"]
    Middleware["Next.js Edge Middleware<br/>(Verifikasi HTTP-Only JWT Cookie)"]
    
    subgraph API ["Next.js Server Route Handlers"]
        AuthAPI["/api/verify-pin & /api/session"]
        AssistantAPI["/api/assistant & /api/daily-briefing"]
        KnowledgeAPI["/api/knowledge (Chunking & Embedding)"]
        WorkspaceAPI["/api/workspace & /api/search"]
        PushCronAPI["/api/push/subscribe & /api/cron/reminders"]
    end

    subgraph External ["AI & Cloud Infrastructure"]
        Gemini["Google Gemini API<br/>(Multimodal LLM + text-embedding-004)"]
        Supabase["Supabase PostgreSQL + pgvector<br/>(RLS Protected + HNSW Vector Index)"]
        WebPush["Web Push Service (VAPID)"]
    end

    Client -->|Request + Cookie| Middleware
    Middleware -->|Authorized| API
    AuthAPI -->|Issue Signed JWT| Client
    AssistantAPI <-->|Inference & Query Vector| Gemini
    AssistantAPI <-->|RPC match_knowledge| Supabase
    KnowledgeAPI -->|Generate 768-d Vector| Gemini
    KnowledgeAPI -->|Store Chunks & Embeddings| Supabase
    WorkspaceAPI <-->|CRUD & Parallel Search| Supabase
    PushCronAPI -->|Trigger H-15m Alert| WebPush
    WebPush -->|Background Notification| Client
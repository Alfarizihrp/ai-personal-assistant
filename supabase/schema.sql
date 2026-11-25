-- Skema Database Supabase untuk Akhi — AI Personal Assistant
-- Jalankan di Supabase SQL Editor untuk setup awal atau menambahkan tabel chat_messages.

create extension if not exists vector;

-- 1. Tabel Jadwal & Pengingat
create table if not exists public.schedules (
  id bigserial primary key,
  title text not null,
  schedule_time text not null default 'Waktu belum ditentukan',
  target_datetime timestamptz null,
  is_done boolean not null default false,
  reminded boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Tabel Ide & Catatan Faedah
create table if not exists public.ideas (
  id bigserial primary key,
  title text not null,
  content text not null,
  ai_expansion text null,
  created_at timestamptz not null default now()
);

-- 3. Tabel Semantic Memory (RAG Knowledge Base)
create table if not exists public.knowledge_base (
  id bigserial primary key,
  title text not null,
  category text not null default 'Catatan Umum',
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_base_embedding_hnsw_idx
  on public.knowledge_base
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_knowledge(
  query_embedding vector(768),
  match_threshold float default 0.45,
  match_count int default 4
)
returns table (
  id bigint,
  title text,
  category text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    kb.id,
    kb.title,
    kb.category,
    kb.content,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- 4. Tabel Log Nutrisi & Kalori
create table if not exists public.nutrition_logs (
  id bigserial primary key,
  food_name text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  ai_notes text null,
  created_at timestamptz not null default now()
);

-- 5. Tabel Log Olahraga
create table if not exists public.workout_logs (
  id bigserial primary key,
  routine_name text not null,
  duration_minutes int not null default 30,
  ai_plan text null,
  ai_evaluation text null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. Tabel Langganan Web Push (VAPID)
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 7. Tabel Riwayat Diskusi (Chat Sync Lintas Perangkat)
create table if not exists public.chat_messages (
  id bigserial primary key,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  spoken_text text null,
  intent text null,
  sources jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Kunci seluruh tabel dengan RLS (hanya diakses server via SUPABASE_SERVICE_ROLE_KEY)
alter table public.schedules enable row level security;
alter table public.ideas enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.chat_messages enable row level security;

-- Metadata for guest uploads. RLS on with NO policies: only the server (service role) can read/write.
create table if not exists public.wedding_uploads (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  original_name text,
  mime_type text not null,
  size_bytes bigint not null,
  guest_name text,
  created_at timestamptz not null default now()
);

alter table public.wedding_uploads enable row level security;

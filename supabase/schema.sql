create table if not exists public.email_otps (
  email text primary key check (email = lower(email)),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);

alter table public.email_otps enable row level security;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size bigint not null check (size > 0),
  created_at timestamptz not null default now()
);

create index if not exists files_user_created_at_idx
  on public.files (user_id, created_at desc);

alter table public.files enable row level security;

drop policy if exists "Users can read their own files" on public.files;
create policy "Users can read their own files"
  on public.files for select
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'nextcloud-files',
  'nextcloud-files',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

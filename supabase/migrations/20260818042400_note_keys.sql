-- DynaSaurus note keys: reusable class-note keys (one key per class).
-- These are SHARED keys — never consumed, always valid.

create table if not exists public.note_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists note_keys_key_idx on public.note_keys (key);

alter table public.note_keys enable row level security;

revoke all on public.note_keys from public, anon, authenticated;
grant all on public.note_keys to service_role;

drop policy if exists "Service role manages note keys" on public.note_keys;
create policy "Service role manages note keys"
  on public.note_keys
  for all
  to service_role
  using (true)
  with check (true);

-- Seed rows are managed privately and are intentionally not committed to this
-- public copy. Do not seed real (or pattern-valid) keys here: any note_keys row
-- is treated as a valid reusable license.

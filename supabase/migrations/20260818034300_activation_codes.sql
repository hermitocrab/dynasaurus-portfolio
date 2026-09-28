-- DynaSaurus one-time activation codes.
-- Run this migration before inserting codes from scripts/generate-activation-codes.sql.

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tier text not null default 'basic',
  is_student boolean not null default false,
  used boolean not null default false,
  used_by text,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists activation_codes_code_unused_idx
  on public.activation_codes (code, used);

alter table public.activation_codes enable row level security;

revoke all on public.activation_codes from public, anon, authenticated;
grant all on public.activation_codes to service_role;

drop policy if exists "Service role manages activation codes" on public.activation_codes;
create policy "Service role manages activation codes"
  on public.activation_codes
  for all
  to service_role
  using (true)
  with check (true);

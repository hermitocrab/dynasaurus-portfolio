-- Add license_key to query_log so per-key usage can be reported.
alter table public.query_log add column if not exists license_key text;

create index if not exists query_log_license_key_created_idx
  on public.query_log (license_key, created_at desc);

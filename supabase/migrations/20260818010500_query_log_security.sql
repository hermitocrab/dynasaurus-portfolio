-- DynaSaurus query history security hardening.
-- Apply after confirming public.query_log has user_id, word, response, module,
-- and created_at columns. Existing anonymous rows remain unreadable to clients.

alter table public.query_log enable row level security;

revoke all on public.query_log from anon;
revoke all on public.query_log from authenticated;
grant select, insert on public.query_log to authenticated;
grant all on public.query_log to service_role;

drop policy if exists "Users can read their own query history" on public.query_log;
create policy "Users can read their own query history"
  on public.query_log
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own query history" on public.query_log;
create policy "Users can insert their own query history"
  on public.query_log
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own query history" on public.query_log;

create index if not exists query_log_user_created_at_idx
  on public.query_log (user_id, created_at desc);

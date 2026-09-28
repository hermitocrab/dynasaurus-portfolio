-- DynaSaurus billing schema.
-- Review and adapt any legacy subscriptions data before applying this migration.

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_price_id text not null,
  tier text not null check (tier in ('free', 'basic', 'premium', 'ultimate')),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  last_event_created bigint not null default 0,
  last_event_priority smallint not null default 0,
  last_event_id text
);

create index if not exists subscriptions_user_id_updated_at_idx
  on public.subscriptions (user_id, updated_at desc);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz,
  processing_error text,
  processing_started_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on public.billing_customers from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;

grant select on public.billing_customers to authenticated;
grant select on public.subscriptions to authenticated;

grant all on public.billing_customers to service_role;
grant all on public.subscriptions to service_role;
grant all on public.stripe_webhook_events to service_role;

create policy "Users can read their own billing customer"
  on public.billing_customers
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Returns claimed, processed, or processing. Failed/stale claims can be retried.
create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.stripe_webhook_events%rowtype;
begin
  insert into public.stripe_webhook_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select * into existing
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if existing.processed_at is not null and existing.processing_error is null then
    return 'processed';
  end if;

  if existing.processing_error is not null
    or existing.processing_started_at < now() - interval '5 minutes'
  then
    update public.stripe_webhook_events
    set event_type = p_event_type,
        processed_at = null,
        processing_error = null,
        processing_started_at = now()
    where event_id = p_event_id;
    return 'claimed';
  end if;

  return 'processing';
end;
$$;

-- Applies only snapshots newer than the stored Stripe event ordering tuple.
create or replace function public.upsert_subscription_from_stripe(
  p_stripe_subscription_id text,
  p_user_id uuid,
  p_stripe_price_id text,
  p_tier text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created bigint,
  p_event_priority smallint,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  applied boolean;
begin
  insert into public.subscriptions (
    stripe_subscription_id,
    user_id,
    stripe_price_id,
    tier,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    updated_at,
    last_event_created,
    last_event_priority,
    last_event_id
  ) values (
    p_stripe_subscription_id,
    p_user_id,
    p_stripe_price_id,
    p_tier,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    now(),
    p_event_created,
    p_event_priority,
    p_event_id
  )
  on conflict (stripe_subscription_id) do update
  set user_id = excluded.user_id,
      stripe_price_id = excluded.stripe_price_id,
      tier = excluded.tier,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = now(),
      last_event_created = excluded.last_event_created,
      last_event_priority = excluded.last_event_priority,
      last_event_id = excluded.last_event_id
  where (public.subscriptions.last_event_created, public.subscriptions.last_event_priority)
    <= (excluded.last_event_created, excluded.last_event_priority)
  returning true into applied;

  return coalesce(applied, false);
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.upsert_subscription_from_stripe(
  text, uuid, text, text, text, timestamptz, timestamptz, boolean, bigint, smallint, text
) from public, anon, authenticated;

grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;
grant execute on function public.upsert_subscription_from_stripe(
  text, uuid, text, text, text, timestamptz, timestamptz, boolean, bigint, smallint, text
) to service_role;

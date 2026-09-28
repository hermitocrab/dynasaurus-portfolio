-- Aggregator payments (Alipay / WeChat for a personal entity).
--
-- Apply before switching PAY_PROVIDER=aggregator. Nothing in the running app
-- touches these objects while the flag is off, so applying this migration on its
-- own changes no behaviour.
--
-- Idempotency lives in grant_aggregator_subscription(): it locks the order row
-- and returns `duplicate` for a repeated callback, so a retrying gateway can
-- never extend a subscription twice.

create table if not exists public.payment_orders (
  out_trade_no text primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'aggregator',
  channel text not null check (channel in ('alipay', 'wechat')),
  tier text not null check (tier in ('basic', 'premium', 'ultimate')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'CNY',
  status text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'expired', 'review', 'refunded')),
  provider_trade_no text,
  pay_url text,
  raw_create jsonb,
  raw_notify jsonb,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_orders_user_created_at_idx
  on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_status_created_at_idx
  on public.payment_orders (status, created_at desc);

-- Aggregator-side subscriptions. Kept separate from public.subscriptions, whose
-- primary key is a Stripe subscription id, so both providers can coexist.
create table if not exists public.provider_subscriptions (
  provider_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'aggregator',
  channel text not null,
  tier text not null check (tier in ('free', 'basic', 'premium', 'ultimate')),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_out_trade_no text,
  updated_at timestamptz not null default now()
);

create index if not exists provider_subscriptions_user_updated_at_idx
  on public.provider_subscriptions (user_id, updated_at desc);

alter table public.payment_orders enable row level security;
alter table public.provider_subscriptions enable row level security;

revoke all on public.payment_orders from anon, authenticated;
revoke all on public.provider_subscriptions from anon, authenticated;

grant select on public.payment_orders to authenticated;
grant select on public.provider_subscriptions to authenticated;

grant all on public.payment_orders to service_role;
grant all on public.provider_subscriptions to service_role;

drop policy if exists "Users can read their own payment orders" on public.payment_orders;
create policy "Users can read their own payment orders"
  on public.payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own provider subscriptions" on public.provider_subscriptions;
create policy "Users can read their own provider subscriptions"
  on public.provider_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Idempotent grant. Returns one of:
--   granted | duplicate | not_found | amount_mismatch | closed | no_user
create or replace function public.grant_aggregator_subscription(
  p_out_trade_no text,
  p_provider_trade_no text,
  p_amount_cents integer,
  p_raw_notify jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.payment_orders%rowtype;
  subscription_id text;
begin
  select * into order_row
  from public.payment_orders
  where out_trade_no = p_out_trade_no
  for update;

  if not found then
    return 'not_found';
  end if;

  if order_row.status = 'paid' then
    return 'duplicate';
  end if;

  if order_row.status in ('expired', 'refunded') then
    return 'closed';
  end if;

  if order_row.user_id is null then
    update public.payment_orders
    set status = 'review',
        review_note = 'order has no user',
        raw_notify = p_raw_notify,
        updated_at = now()
    where out_trade_no = p_out_trade_no;
    return 'no_user';
  end if;

  if p_amount_cents is not null and p_amount_cents <> order_row.amount_cents then
    update public.payment_orders
    set status = 'review',
        review_note = 'amount mismatch',
        raw_notify = p_raw_notify,
        updated_at = now()
    where out_trade_no = p_out_trade_no;
    return 'amount_mismatch';
  end if;

  subscription_id := coalesce(nullif(p_provider_trade_no, ''), p_out_trade_no);

  insert into public.provider_subscriptions (
    provider_subscription_id,
    user_id,
    provider,
    channel,
    tier,
    status,
    current_period_start,
    current_period_end,
    last_out_trade_no,
    updated_at
  ) values (
    subscription_id,
    order_row.user_id,
    order_row.provider,
    order_row.channel,
    order_row.tier,
    'active',
    now(),
    now() + interval '1 month',
    p_out_trade_no,
    now()
  )
  on conflict (provider_subscription_id) do update
  set user_id = excluded.user_id,
      channel = excluded.channel,
      tier = excluded.tier,
      status = 'active',
      current_period_start = excluded.current_period_start,
      current_period_end = greatest(coalesce(provider_subscriptions.current_period_end, now()), now()) + interval '1 month',
      last_out_trade_no = excluded.last_out_trade_no,
      updated_at = now();

  update public.payment_orders
  set status = 'paid',
      provider_trade_no = coalesce(p_provider_trade_no, provider_trade_no),
      raw_notify = p_raw_notify,
      review_note = null,
      paid_at = now(),
      updated_at = now()
  where out_trade_no = p_out_trade_no;

  return 'granted';
end;
$$;

revoke all on function public.grant_aggregator_subscription(text, text, integer, jsonb) from anon, authenticated;
grant execute on function public.grant_aggregator_subscription(text, text, integer, jsonb) to service_role;

-- Merges paid entitlements from Stripe and the aggregator, best tier first.
create or replace function public.resolve_user_entitlement(p_user_id uuid)
returns table (
  tier text,
  status text,
  source text,
  current_period_end timestamptz,
  cancel_at_period_end boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select s.tier,
           s.status,
           'stripe'::text as source,
           s.current_period_end,
           s.cancel_at_period_end,
           s.updated_at
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'trialing', 'past_due')

    union all

    select p.tier,
           p.status,
           'aggregator'::text as source,
           p.current_period_end,
           p.cancel_at_period_end,
           p.updated_at
    from public.provider_subscriptions p
    where p.user_id = p_user_id
      and p.status in ('active', 'past_due')
      and (p.current_period_end is null or p.current_period_end > now())
  )
  select c.tier, c.status, c.source, c.current_period_end, c.cancel_at_period_end
  from candidates c
  order by case c.tier
             when 'ultimate' then 3
             when 'premium' then 2
             when 'basic' then 1
             else 0
           end desc,
           c.updated_at desc
  limit 1;
$$;

revoke all on function public.resolve_user_entitlement(uuid) from anon, authenticated;
grant execute on function public.resolve_user_entitlement(uuid) to service_role;

-- Harden SECURITY DEFINER function grants.
--
-- In PostgreSQL, CREATE FUNCTION grants EXECUTE to PUBLIC by default. Revoking
-- only from `anon`/`authenticated` leaves that PUBLIC default in place, so the
-- function stays callable by anyone. These functions run as the definer and
-- touch billing/entitlement tables, so they must be service-role only.
--
-- This migration revokes the PUBLIC default (idempotently) and re-grants
-- execution to service_role only.

revoke all on function public.grant_aggregator_subscription(text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.grant_aggregator_subscription(text, text, integer, jsonb)
  to service_role;

revoke all on function public.resolve_user_entitlement(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_user_entitlement(uuid)
  to service_role;

revoke all on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text)
  to service_role;

revoke all on function public.upsert_subscription_from_stripe(
  text, uuid, text, text, text, timestamptz, timestamptz, boolean, bigint, smallint, text
) from public, anon, authenticated;
grant execute on function public.upsert_subscription_from_stripe(
  text, uuid, text, text, text, timestamptz, timestamptz, boolean, bigint, smallint, text
) to service_role;

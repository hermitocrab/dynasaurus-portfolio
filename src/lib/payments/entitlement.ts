import 'server-only';

import { getServiceClient } from '@/lib/supabase-admin';
import { isSubscriptionTier, type SubscriptionTier } from '@/lib/subscriptions';

/**
 * Server-side subscription entitlement.
 *
 * Reads `public.resolve_user_entitlement` (see the aggregator payments
 * migration), which merges Stripe subscriptions with aggregator
 * (Alipay / WeChat) subscriptions and returns the best active row.
 *
 * A null result means "no paid entitlement". A thrown error means "could not
 * determine" — callers must fail closed (never treat an unknown state as free,
 * never show ads to a possibly-paying user).
 */
export interface SubscriptionEntitlement {
  tier: SubscriptionTier;
  status: string;
  source: 'stripe' | 'aggregator';
  currentPeriodEnd: string | null;
}

export async function resolveSubscriptionEntitlement(
  userId: string,
): Promise<SubscriptionEntitlement | null> {
  const client = getServiceClient();
  const { data, error } = await client.rpc('resolve_user_entitlement', {
    p_user_id: userId,
  });

  if (error) throw new Error(`Unable to resolve subscription entitlement: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as
    | { tier?: unknown; status?: unknown; source?: unknown; current_period_end?: unknown }
    | undefined;

  if (!row) return null;

  const tier = isSubscriptionTier(row.tier) ? row.tier : 'free';
  if (tier === 'free') return null;

  return {
    tier,
    status: typeof row.status === 'string' ? row.status : 'active',
    source: row.source === 'aggregator' ? 'aggregator' : 'stripe',
    currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
  };
}

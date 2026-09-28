import 'server-only';

import type { PayProvider } from './types';

/**
 * Payment provider switch, read from the server environment.
 *
 * PAY_PROVIDER is `off` unless it is explicitly set to `aggregator`, so an
 * unconfigured deployment keeps the existing Stripe checkout path untouched.
 * Any unrecognised value falls back to `off` (fail closed).
 */
export function parsePayProvider(value: string | undefined | null): PayProvider {
  return (value ?? '').trim().toLowerCase() === 'aggregator' ? 'aggregator' : 'off';
}

export function getPayProvider(): PayProvider {
  return parsePayProvider(process.env.PAY_PROVIDER);
}

export function isAggregatorEnabled(): boolean {
  return getPayProvider() === 'aggregator';
}

/**
 * Public paid checkout is opt-in even when provider credentials exist.
 * This prevents test keys or a partially configured gateway from being
 * advertised as a live payment path.
 */
export function isPaidCheckoutEnabled(): boolean {
  return (process.env.PAID_CHECKOUT_ENABLED ?? '').trim().toLowerCase() === 'true';
}

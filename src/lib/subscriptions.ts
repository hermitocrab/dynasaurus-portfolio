export const SUBSCRIPTION_TIERS = [
  'free',
  'basic',
  'premium',
  'ultimate',
] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];
export type PaidSubscriptionTier = Exclude<SubscriptionTier, 'free'>;
export const PAID_SUBSCRIPTION_TIERS = ['basic', 'premium', 'ultimate'] as const satisfies readonly PaidSubscriptionTier[];

export interface SubscriptionPlan {
  name: string;
  amount: number;
  currency: 'cny';
  period: 'forever' | '/mo';
  description: string;
  features: readonly string[];
  quota: number | null;
  featured: boolean;
}

export const SUBSCRIPTION_CATALOG: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    name: 'Free',
    amount: 0,
    currency: 'cny',
    period: 'forever',
    description: 'Free forever',
    features: [
      '5 lookups/day',
      'All 4 modules',
      'Basic definitions',
      'One language pair',
      'History sync',
      'Audio upload',
    ],
    quota: 5,
    featured: false,
  },
  basic: {
    name: 'Basic',
    amount: 29,
    currency: 'cny',
    period: '/mo',
    description: 'Most popular',
    features: [
      'Unlimited lookups',
      'All 4 modules',
      'Full history',
      'B1+ Thesaurus',
      'Cloud sync',
      'Audio upload',
    ],
    quota: null,
    featured: true,
  },
  premium: {
    name: 'Premium',
    amount: 49,
    currency: 'cny',
    period: '/mo',
    description: 'Power user',
    features: [
      'Everything in Basic',
      'Word audio playback',
      'Audio upload',
      'Priority support',
      'Cloud sync',
      'Paid checkout coming soon',
    ],
    quota: null,
    featured: false,
  },
  ultimate: {
    name: 'Ultimate',
    amount: 79,
    currency: 'cny',
    period: '/mo',
    description: 'All access',
    features: [
      'Everything in Premium',
      'Early access features',
      'Cloud sync',
      'Priority support',
      'Audio upload',
      'Feature package being finalized',
    ],
    quota: null,
    featured: false,
  },
};

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === 'string' && SUBSCRIPTION_TIERS.includes(value as SubscriptionTier);
}

export function isPaidSubscriptionTier(value: unknown): value is PaidSubscriptionTier {
  return isSubscriptionTier(value) && value !== 'free';
}

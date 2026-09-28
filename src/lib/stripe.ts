import Stripe from 'stripe';
import { getServiceClient } from './supabase-admin';
import { getServerEnv } from './env';
import {
  PAID_SUBSCRIPTION_TIERS,
  SUBSCRIPTION_CATALOG,
  type PaidSubscriptionTier,
  type SubscriptionTier,
} from './subscriptions';

const env = getServerEnv();

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

export const SUBSCRIPTION_PRICES: Record<SubscriptionTier, { 
  priceId: string; 
  name: string; 
  amount: number;
  currency: string;
  features: readonly string[];
  quota: number | null;
}> = {
  free: {
    ...SUBSCRIPTION_CATALOG.free,
    priceId: '',
  },
  basic: {
    ...SUBSCRIPTION_CATALOG.basic,
    priceId: env.STRIPE_PRICE_BASIC,
  },
  premium: {
    ...SUBSCRIPTION_CATALOG.premium,
    priceId: env.STRIPE_PRICE_PREMIUM,
  },
  ultimate: {
    ...SUBSCRIPTION_CATALOG.ultimate,
    priceId: env.STRIPE_PRICE_ULTIMATE,
  },
};

async function getOrCreateStripeCustomer(userId: string, email?: string) {
  const supabase = getServiceClient();
  const { data: existing, error: lookupError } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw new Error(`Unable to read billing customer: ${lookupError.message}`);
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const customer = await stripe.customers.create(
    {
      ...(email ? { email } : {}),
      metadata: { supabase_user_id: userId },
    },
    { idempotencyKey: `billing-customer:${userId}` },
  );

  const { error: insertError } = await supabase.from('billing_customers').insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  if (!insertError) return customer.id;

  // A concurrent request may have inserted the same user after our lookup.
  const { data: winner, error: retryError } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (retryError || !winner?.stripe_customer_id) {
    throw new Error(`Unable to save billing customer: ${insertError.message}`);
  }

  return winner.stripe_customer_id as string;
}

export async function createCheckoutSession({
  userId,
  email,
  tier,
}: {
  userId: string;
  email?: string;
  tier: PaidSubscriptionTier;
}) {
  const priceId = SUBSCRIPTION_PRICES[tier].priceId;
  if (!priceId) throw new Error(`No Stripe price ID for tier: ${tier}`);
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const idempotencyWindow = Math.floor(Date.now() / 60_000);

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      // Omit payment_method_types so Stripe can use Dashboard-configured methods.
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/pricing`,
      client_reference_id: userId,
      metadata: { userId, tier },
      subscription_data: { metadata: { userId, tier } },
    },
    { idempotencyKey: `checkout:${userId}:${tier}:${idempotencyWindow}` },
  );

  return session;
}

export class BillingCustomerNotFoundError extends Error {}

export async function createCustomerPortalSession(userId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Unable to read billing customer: ${error.message}`);
  if (!data?.stripe_customer_id) {
    throw new BillingCustomerNotFoundError('No billing account exists for this user.');
  }

  return stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${env.APP_URL}/pricing`,
  });
}

type ServiceClient = ReturnType<typeof getServiceClient>;
type SubscriptionStatus = Stripe.Subscription.Status;

const WEBHOOK_EVENT_PRIORITIES = {
  'checkout.session.completed': 10,
  'invoice.payment_failed': 30,
  'customer.subscription.updated': 50,
  'invoice.paid': 70,
  'customer.subscription.deleted': 100,
} as const;

export class InvalidWebhookSignatureError extends Error {}

function resourceId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function tierForPriceId(priceId: string): PaidSubscriptionTier | null {
  return PAID_SUBSCRIPTION_TIERS.find((tier) => SUBSCRIPTION_PRICES[tier].priceId === priceId) ?? null;
}

async function userIdForSubscription(client: ServiceClient, subscription: Stripe.Subscription) {
  const customerId = resourceId(subscription.customer);
  if (!customerId) throw new Error(`Subscription ${subscription.id} has no Stripe customer.`);

  const { data, error } = await client
    .from('billing_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) throw new Error(`Unable to read billing customer: ${error.message}`);
  if (!data?.user_id) throw new Error(`No billing customer mapping exists for ${customerId}.`);

  const metadataUserId = subscription.metadata.userId;
  if (metadataUserId && metadataUserId !== data.user_id) {
    throw new Error(`Stripe subscription ${subscription.id} has conflicting user metadata.`);
  }

  return data.user_id as string;
}

async function saveSubscriptionSnapshot({
  client,
  subscription,
  event,
  priority,
  statusOverride,
}: {
  client: ServiceClient;
  subscription: Stripe.Subscription;
  event: Stripe.Event;
  priority: number;
  statusOverride?: SubscriptionStatus;
}) {
  const item = subscription.items.data.find((candidate) => tierForPriceId(candidate.price.id));
  if (!item) return false;

  const tier = tierForPriceId(item.price.id);
  if (!tier) return false;
  const userId = await userIdForSubscription(client, subscription);

  const { error } = await client.rpc('upsert_subscription_from_stripe', {
    p_stripe_subscription_id: subscription.id,
    p_user_id: userId,
    p_stripe_price_id: item.price.id,
    p_tier: tier,
    p_status: statusOverride ?? subscription.status,
    p_current_period_start: new Date(item.current_period_start * 1000).toISOString(),
    p_current_period_end: new Date(item.current_period_end * 1000).toISOString(),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_event_created: event.created,
    p_event_priority: priority,
    p_event_id: event.id,
  });

  if (error) throw new Error(`Unable to persist subscription: ${error.message}`);
  return true;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return resourceId(invoice.parent?.subscription_details?.subscription);
}

async function processStripeEvent(client: ServiceClient, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = resourceId(event.data.object.subscription);
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await saveSubscriptionSnapshot({
        client,
        subscription,
        event,
        priority: WEBHOOK_EVENT_PRIORITIES[event.type],
      });
      return;
    }

    case 'invoice.paid': {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await saveSubscriptionSnapshot({
        client,
        subscription,
        event,
        priority: WEBHOOK_EVENT_PRIORITIES[event.type],
      });
      return;
    }

    case 'invoice.payment_failed': {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const statusOverride: SubscriptionStatus = (
        subscription.status === 'active' || subscription.status === 'trialing'
      ) ? 'past_due' : subscription.status;
      await saveSubscriptionSnapshot({
        client,
        subscription,
        event,
        priority: WEBHOOK_EVENT_PRIORITIES[event.type],
        statusOverride,
      });
      return;
    }

    case 'customer.subscription.updated': {
      await saveSubscriptionSnapshot({
        client,
        subscription: event.data.object,
        event,
        priority: WEBHOOK_EVENT_PRIORITIES[event.type],
      });
      return;
    }

    case 'customer.subscription.deleted': {
      await saveSubscriptionSnapshot({
        client,
        subscription: event.data.object,
        event,
        priority: WEBHOOK_EVENT_PRIORITIES[event.type],
        statusOverride: 'canceled',
      });
      return;
    }
  }
}

async function markWebhookProcessed(client: ServiceClient, eventId: string) {
  const { data, error } = await client
    .from('stripe_webhook_events')
    .update({ processed_at: new Date().toISOString(), processing_error: null })
    .eq('event_id', eventId)
    .select('event_id')
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to mark webhook processed: ${error?.message ?? 'event row not found'}`);
  }
}

async function markWebhookFailed(client: ServiceClient, eventId: string, message: string) {
  const { data, error } = await client
    .from('stripe_webhook_events')
    .update({ processed_at: null, processing_error: message.slice(0, 2000) })
    .eq('event_id', eventId)
    .select('event_id')
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to record webhook failure: ${error?.message ?? 'event row not found'}`);
  }
}

export async function handleStripeWebhook(body: string, signature: string) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new InvalidWebhookSignatureError('Invalid Stripe webhook signature.');
  }

  const client = getServiceClient();
  const { data: claim, error: claimError } = await client.rpc('claim_stripe_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (claimError) throw new Error(`Unable to claim webhook event: ${claimError.message}`);

  if (claim === 'processed' || claim === 'processing') {
    return { received: true, duplicate: true };
  }
  if (claim !== 'claimed') {
    throw new Error('Webhook event claim returned an invalid state.');
  }

  try {
    await processStripeEvent(client, event);
    await markWebhookProcessed(client, event.id);
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message : 'Unknown webhook processing error';
    await markWebhookFailed(client, event.id, message);
    throw processingError;
  }

  return { received: true };
}

export async function checkUserQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const supabase = getServiceClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .single();
  
  const entitledStatuses = new Set(['active', 'trialing', 'past_due']);
  const tier = sub && entitledStatuses.has(sub.status)
    ? (sub.tier as SubscriptionTier)
    : 'free';
  const limit = SUBSCRIPTION_PRICES[tier].quota;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('query_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  return { allowed: limit === null || (count || 0) < limit, used: count || 0, limit };
}

export { stripe };

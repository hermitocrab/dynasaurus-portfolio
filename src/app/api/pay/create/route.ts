import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getServiceClient } from '@/lib/supabase-admin';
import { isPaidSubscriptionTier, SUBSCRIPTION_CATALOG } from '@/lib/subscriptions';
import { isAggregatorEnabled, isPaidCheckoutEnabled } from '@/lib/payments/provider';
import { isPayChannel } from '@/lib/payments/types';
import {
  AggregatorGatewayError,
  amountCentsForTier,
  createGatewayOrder,
  generateOutTradeNo,
  getAggregatorConfig,
  markOrderStatus,
} from '@/lib/payments/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/**
 * Creates an aggregator (Alipay / WeChat) order and returns the payload the
 * browser needs to finish the payment. Disabled — and therefore a 404 — unless
 * PAY_PROVIDER=aggregator.
 */
export async function POST(request: NextRequest) {
  if (!isPaidCheckoutEnabled() || !isAggregatorEnabled()) {
    return json({ error: 'Payment channel is disabled' }, 404);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!rawBody || typeof rawBody !== 'object') return json({ error: 'Invalid JSON body' }, 400);

  const body = rawBody as Record<string, unknown>;
  const tier = body.tier;
  const channel = body.channel;

  if (!isPaidSubscriptionTier(tier)) return json({ error: 'Unknown subscription tier' }, 400);
  if (!isPayChannel(channel)) return json({ error: 'Unsupported payment channel' }, 400);

  const config = getAggregatorConfig();
  if (!config) return json({ error: 'Payment channel is not configured yet' }, 503);

  let userId: string;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: 'Authentication required' }, 401);
    userId = user.id;
  } catch {
    return json({ error: 'Authentication required' }, 401);
  }

  const amountCents = amountCentsForTier(tier);
  const outTradeNo = generateOutTradeNo();

  try {
    const service = getServiceClient();
    const { error: insertError } = await service.from('payment_orders').insert({
      out_trade_no: outTradeNo,
      user_id: userId,
      provider: 'aggregator',
      channel,
      tier,
      amount_cents: amountCents,
      status: 'created',
    });
    if (insertError) throw new Error(insertError.message);

    const gateway = await createGatewayOrder({
      outTradeNo,
      tier,
      channel,
      amountCents,
      subject: `DynaSaurus ${SUBSCRIPTION_CATALOG[tier].name}`,
    });

    const { error: updateError } = await service
      .from('payment_orders')
      .update({
        status: 'pending',
        provider_trade_no: gateway.providerTradeNo,
        pay_url: gateway.payUrl,
        raw_create: gateway.raw,
        updated_at: new Date().toISOString(),
      })
      .eq('out_trade_no', outTradeNo);
    if (updateError) throw new Error(updateError.message);

    return json({
      orderId: outTradeNo,
      outTradeNo,
      tier,
      channel,
      amountCents,
      currency: 'CNY',
      payUrl: gateway.payUrl,
      qrCode: gateway.qrCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown payment error';
    console.error(`Aggregator order failed (${outTradeNo}):`, message);

    try {
      await markOrderStatus({ outTradeNo, status: 'failed', note: message });
    } catch {
      // The order row stays in `created`; the gateway call already failed.
    }

    const status = error instanceof AggregatorGatewayError ? 502 : 500;
    return json({ error: 'Unable to start the payment. Please try again.' }, status);
  }
}

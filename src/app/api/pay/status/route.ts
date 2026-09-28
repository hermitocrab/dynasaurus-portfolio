import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isAggregatorEnabled } from '@/lib/payments/provider';
import { readOrderStatus } from '@/lib/payments/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/** Owner-scoped order status for the post-payment confirmation screen. */
export async function GET(request: NextRequest) {
  if (!isAggregatorEnabled()) return json({ error: 'Payment channel is disabled' }, 404);

  const outTradeNo = request.nextUrl.searchParams.get('order')?.trim() ?? '';
  if (!outTradeNo) return json({ error: 'An order reference is required' }, 400);

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: 'Authentication required' }, 401);

    const order = await readOrderStatus({ userId: user.id, outTradeNo });
    if (!order) return json({ error: 'Order not found' }, 404);

    return json({
      orderId: order.outTradeNo,
      tier: order.tier,
      channel: order.channel,
      status: order.status,
      amountCents: order.amountCents,
      currency: 'CNY',
      confirmed: order.status === 'paid',
      paidAt: order.paidAt,
    });
  } catch (error) {
    console.error('Payment status lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Unable to read the order status' }, 500);
  }
}

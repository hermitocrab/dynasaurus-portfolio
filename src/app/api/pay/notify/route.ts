import { NextRequest, NextResponse } from 'next/server';
import { isAggregatorEnabled } from '@/lib/payments/provider';
import {
  AggregatorPersistenceError,
  getAggregatorConfig,
  grantAggregatorSubscription,
  interpretNotify,
  markOrderStatus,
  NOTIFY_ACK,
  parseNotifyPayload,
  verifySignature,
} from '@/lib/payments/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ack(body = NOTIFY_ACK, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' },
  });
}

/**
 * Aggregator payment callback.
 *
 * Verifies the signature, then grants the subscription through an idempotent
 * database function keyed on the merchant order number — repeated callbacks
 * return `duplicate` and never extend a period twice.
 */
export async function POST(request: NextRequest) {
  if (!isAggregatorEnabled()) return ack('disabled', 404);

  const config = getAggregatorConfig();
  if (!config) return ack('not configured', 503);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return ack('bad request', 400);
  }

  const params = parseNotifyPayload(rawBody, request.headers.get('content-type'));
  if (!verifySignature(params, config.secret, config.signType)) {
    // Never echo the payload: it contains merchant data.
    return ack('sign error', 400);
  }

  const outcome = interpretNotify(params);
  if (!outcome) return ack('bad request', 400);

  if (!outcome.success) {
    try {
      await markOrderStatus({
        outTradeNo: outcome.outTradeNo,
        status: 'failed',
        note: 'gateway reported a non-success status',
        rawNotify: params,
      });
    } catch (error) {
      console.error('Aggregator notify: failed to record non-success status:', error instanceof Error ? error.message : 'unknown');
    }
    return ack();
  }

  try {
    const result = await grantAggregatorSubscription({
      outTradeNo: outcome.outTradeNo,
      providerTradeNo: outcome.providerTradeNo,
      amountCents: outcome.amountCents,
      rawNotify: params,
    });

    if (result === 'amount_mismatch' || result === 'no_user' || result === 'closed') {
      console.error(`Aggregator notify: order ${outcome.outTradeNo} needs manual review (${result}).`);
    }

    // Always acknowledge a signed callback so the gateway stops retrying.
    return ack();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`Aggregator notify: grant failed for ${outcome.outTradeNo}:`, message);
    // Non-200 tells the gateway to retry; the grant is idempotent.
    return ack(error instanceof AggregatorPersistenceError ? 'retry' : 'error', 500);
  }
}

export async function GET() {
  if (!isAggregatorEnabled()) return ack('disabled', 404);
  return ack('method not allowed', 405);
}

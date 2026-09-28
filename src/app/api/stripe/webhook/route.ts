import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook, InvalidWebhookSignatureError } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  try {
    const result = await handleStripeWebhook(body, signature);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 });
    }

    console.error('Stripe webhook processing failed:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

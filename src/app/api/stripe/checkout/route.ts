import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isPaidSubscriptionTier } from '@/lib/subscriptions';
import { isPaidCheckoutEnabled } from '@/lib/payments/provider';

export async function POST(req: NextRequest) {
  if (!isPaidCheckoutEnabled()) {
    return NextResponse.json({ error: 'Paid checkout is not available yet' }, { status: 404 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object with tier is required' }, { status: 400 });
    }

    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'tier') {
      return NextResponse.json({ error: 'Only tier may be provided' }, { status: 400 });
    }

    const tier = (body as { tier?: unknown }).tier;
    if (!isPaidSubscriptionTier(tier)) {
      return NextResponse.json({ error: 'Invalid paid subscription tier' }, { status: 400 });
    }

    const session = await createCheckoutSession({ userId: user.id, email: user.email, tier });
    if (!session.url) throw new Error('Stripe did not return a hosted Checkout URL.');
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Unable to start checkout' },
      { status: 500 }
    );
  }
}

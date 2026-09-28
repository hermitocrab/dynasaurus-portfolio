import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Authentication required' }, 401);

  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return json({ error: 'A valid Checkout Session is required' }, 400);
  }

  try {
    // The URL parameter is only a lookup key. Stripe data and the authenticated
    // user are checked server-side before any subscription state is returned.
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const checkoutUserId = checkoutSession.client_reference_id ?? checkoutSession.metadata?.userId;
    if (checkoutUserId !== user.id) return json({ error: 'Checkout Session not found' }, 404);

    const subscriptionId = typeof checkoutSession.subscription === 'string'
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;
    if (!subscriptionId) {
      return json({ confirmed: false, status: 'pending' });
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('tier, status, current_period_end, cancel_at_period_end, updated_at')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!subscription) return json({ confirmed: false, status: 'pending' });

    const confirmed = subscription.status === 'active' || subscription.status === 'trialing';
    return json({ confirmed, ...subscription });
  } catch (error) {
    console.error('Subscription status lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Unable to confirm subscription status' }, 500);
  }
}

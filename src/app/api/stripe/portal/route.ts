import { NextResponse } from 'next/server';
import { BillingCustomerNotFoundError, createCustomerPortalSession } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await createCustomerPortalSession(user.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingCustomerNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Unable to open the billing portal' },
      { status: 500 }
    );
  }
}

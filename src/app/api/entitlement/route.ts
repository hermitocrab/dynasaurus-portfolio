import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { validateActivatedLicense } from '@/lib/activation';
import { isPaidSubscriptionTier, type SubscriptionTier } from '@/lib/subscriptions';
import { resolveSubscriptionEntitlement } from '@/lib/payments/entitlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/**
 * Entitlement probe used by the free-tier ad gate.
 *
 * Returns `{ known, tier }` only — never an email, a key, or a customer id.
 *
 * Failure policy is fail closed: when an entitlement source cannot be read we
 * answer `known: false`, and the client then renders no ads at all. A paying
 * user must never see an ad because a lookup failed.
 */
export async function POST(request: NextRequest) {
  let licenseKey = '';
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    if (body && typeof body.license === 'string') licenseKey = body.license.trim();
  } catch {
    // An empty body is valid: anonymous visitors have no entitlement.
  }

  let tier: SubscriptionTier = 'free';
  let source = 'anonymous';

  if (licenseKey) {
    try {
      const license = await validateActivatedLicense(licenseKey);
      if (license) {
        // Any valid license (activation code, Kee shared key, staff key) is
        // paid access, so it never carries ads. Non-catalogue tiers map to basic.
        tier = isPaidSubscriptionTier(license.tier) ? license.tier : 'basic';
        source = 'license';
      }
    } catch (error) {
      console.error('Entitlement lookup failed (license):', error instanceof Error ? error.message : 'unknown');
      return json({ known: false, tier: 'free', source: 'unknown', adsEligible: false });
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const entitlement = await resolveSubscriptionEntitlement(user.id);
      if (entitlement) {
        tier = entitlement.tier;
        source = entitlement.source;
      }
    }
  } catch (error) {
    console.error('Entitlement lookup failed (subscription):', error instanceof Error ? error.message : 'unknown');
    return json({ known: false, tier: 'free', source: 'unknown', adsEligible: false });
  }

  return json({
    known: true,
    tier,
    source,
    adsEligible: tier === 'free',
  });
}

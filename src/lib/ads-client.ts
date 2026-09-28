'use client';

import { useEffect, useState } from 'react';
import type { AdEligibility } from './ads';

/**
 * Client-side entitlement probe for the ad gate.
 *
 * The request is fired once per page load, only when ads are enabled, and only
 * after mount — ads never block first paint. While the answer is unknown the
 * hook returns null, so no ad markup and no ad script exist in the DOM.
 */

const LICENSE_KEY = 'dynasaurus-license';

let pending: Promise<AdEligibility> | null = null;

const UNKNOWN: AdEligibility = { known: false, tier: 'free' };

function readLicenseKey(): string | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const code = (parsed as { code?: unknown } | null)?.code;
    return typeof code === 'string' && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

async function fetchEligibility(): Promise<AdEligibility> {
  try {
    const response = await fetch('/api/entitlement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: readLicenseKey() }),
      cache: 'no-store',
    });
    if (!response.ok) return UNKNOWN;

    const payload = (await response.json().catch(() => null)) as
      | { known?: unknown; tier?: unknown }
      | null;
    if (!payload || typeof payload !== 'object') return UNKNOWN;

    return {
      known: payload.known === true,
      tier: typeof payload.tier === 'string' ? payload.tier : 'free',
    };
  } catch {
    return UNKNOWN;
  }
}

export function useAdEligibility(enabled: boolean): AdEligibility | null {
  const [eligibility, setEligibility] = useState<AdEligibility | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    if (!pending) pending = fetchEligibility();
    void pending.then((value) => {
      if (active) setEligibility(value);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return enabled ? eligibility : null;
}

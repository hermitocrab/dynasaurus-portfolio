'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { getAdsConfig, getHouseAd, shouldShowAds, type AdPlacement } from '@/lib/ads';
import { useAdEligibility } from '@/lib/ads-client';

/**
 * Free-tier ad slot.
 *
 * Contract:
 * - Ads are off unless NEXT_PUBLIC_ADS_ENABLED is true *and* the network is
 *   fully configured (see lib/ads.ts) — otherwise this renders nothing at all.
 * - Paid tiers and unknown entitlement states render nothing: no markup, no
 *   inline script, no network request.
 * - The script itself is loaded with `lazyOnload`, so it never delays first
 *   paint or the lookup flow.
 */

const PLACEMENT_CLASS: Record<AdPlacement, string> = {
  result: 'mx-auto w-full max-w-2xl',
  sidebar: 'w-full',
};

const PLACEMENT_MIN_HEIGHT: Record<AdPlacement, string> = {
  result: 'min-h-[96px]',
  sidebar: 'min-h-[250px]',
};

export default function AdSlot({ placement }: { placement: AdPlacement }) {
  const config = getAdsConfig();
  const eligibility = useAdEligibility(config.enabled);
  const houseAd = getHouseAd(config, placement);
  const slot = config.slots[placement];
  const visible = shouldShowAds(config, eligibility) && (config.houseOnly ? Boolean(houseAd) : Boolean(slot));

  useEffect(() => {
    if (!visible || !slot || config.network !== 'adsense') return;
    try {
      const target = window as unknown as { adsbygoogle?: unknown[] };
      target.adsbygoogle = target.adsbygoogle || [];
      target.adsbygoogle.push({});
    } catch {
      // Blocked by an ad blocker or a strict CSP — the slot stays empty.
    }
  }, [visible, slot, config.network]);

  if (!visible || !config.network) return null;
  if (!config.houseOnly && !slot) return null;

  return (
    <aside
      data-ad-placement={placement}
      data-ad-network={config.network}
      aria-label="Advertisement"
      className={`${PLACEMENT_CLASS[placement]} overflow-hidden rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)]/60`}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          Ad · 广告
        </span>
        <span className="text-[9px] text-[var(--color-text-muted)]">Free plan</span>
      </div>

      <div className={`px-3 pb-3 pt-1 ${PLACEMENT_MIN_HEIGHT[placement]}`}>
        {houseAd ? (
          <a
            href={houseAd.href}
            data-house-ad={houseAd.id}
            className="flex h-full w-full flex-col justify-between gap-2 rounded-xl bg-[var(--color-bg)]/60 p-3 no-underline transition hover:opacity-90"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">{houseAd.title}</p>
              {houseAd.body ? (
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {houseAd.body}
                </p>
              ) : null}
            </div>
            {houseAd.cta ? (
              <span className="text-xs font-semibold text-[var(--color-accent)]">{houseAd.cta} →</span>
            ) : null}
          </a>
        ) : config.network === 'adsense' ? (
          <ins
            className="adsbygoogle block"
            style={{ display: 'block' }}
            data-ad-client={config.clientId}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div
            className="ad-network-container block h-full w-full"
            data-ad-network={config.network}
            data-ad-client={config.clientId}
            data-ad-slot={slot}
          />
        )}
      </div>

      {/* House creatives render locally — no ad script, no third-party request. */}
      {config.scriptUrl ? <Script src={config.scriptUrl} strategy="lazyOnload" /> : null}
    </aside>
  );
}

'use client';

import { useState } from 'react';
import type { PaidSubscriptionTier } from '@/lib/subscriptions';
import type { PayProvider } from '@/lib/payments/types';
import { usePayChannel } from '@/lib/pay-channel';

/**
 * Checkout button.
 *
 * Public checkout is fail-closed through `checkoutEnabled`. When enabled, a
 * configured aggregator posts to /api/pay/create; otherwise Stripe Checkout is
 * used. Test or incomplete deployments render a disabled coming-soon state.
 */
export default function CheckoutButton({
  tier,
  label,
  featured,
  provider = 'off',
  checkoutEnabled = false,
}: {
  tier: PaidSubscriptionTier;
  label: string;
  featured: boolean;
  provider?: PayProvider;
  checkoutEnabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const channel = usePayChannel();

  const startAggregatorPayment = async () => {
    const response = await fetch('/api/pay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, channel }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = '/auth/login?next=/pricing';
      return;
    }
    if (!response.ok) {
      throw new Error(
        typeof result.error === 'string' ? result.error : 'Unable to start the payment.',
      );
    }
    if (typeof result.payUrl === 'string' && result.payUrl) {
      window.location.assign(result.payUrl);
      return;
    }
    if (typeof result.qrCode === 'string' && result.qrCode) {
      setQrCode(result.qrCode);
      setLoading(false);
      return;
    }
    throw new Error('The payment gateway did not return a payable link.');
  };

  const startStripeCheckout = async () => {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = '/auth/login?next=/pricing';
      return;
    }
    if (!response.ok || typeof result.url !== 'string') {
      throw new Error(typeof result.error === 'string' ? result.error : 'Unable to start checkout.');
    }

    window.location.assign(result.url);
  };

  const startCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      if (provider === 'aggregator') {
        await startAggregatorPayment();
      } else {
        await startStripeCheckout();
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading || !checkoutEnabled}
        className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition-all disabled:cursor-wait disabled:opacity-60 ${
          featured
            ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] text-black shadow-lg hover:scale-[1.02] active:scale-[0.98]'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        {!checkoutEnabled
          ? 'Coming soon'
          : loading
            ? (provider === 'aggregator' ? '正在创建订单…' : 'Opening secure checkout…')
            : label}
      </button>
      {!checkoutEnabled && (
        <p className="mt-2 text-center text-[11px] leading-5 text-[var(--color-text-muted)]">
          Paid checkout is not yet available.
        </p>
      )}
      {qrCode && (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
          <p className="text-[11px] text-[var(--color-text-muted)]">用支付宝 / 微信扫码，或在手机打开下面的支付链接</p>
          <code className="mt-2 block break-all text-[10px] text-[var(--color-accent-cool)]">{qrCode}</code>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

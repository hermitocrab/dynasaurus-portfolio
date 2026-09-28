'use client';

import type { PayProvider } from '@/lib/payments/types';
import { PAY_CHANNELS, PAY_CHANNEL_LABELS } from '@/lib/payments/types';
import { setPayChannel, usePayChannel } from '@/lib/pay-channel';

/**
 * Payment methods shown at the top of the pricing page.
 *
 * Payment methods are shown only after the server explicitly enables public
 * checkout. An unconfigured or test deployment advertises no live method.
 */
export default function PaymentMethods({
  provider,
  checkoutEnabled,
}: {
  provider: PayProvider;
  checkoutEnabled: boolean;
}) {
  const channel = usePayChannel();

  if (!checkoutEnabled) {
    return (
      <p className="mt-6 text-xs font-medium text-[var(--color-accent-warm)]">
        Paid checkout is coming soon. Cards, WeChat Pay, and Alipay are not live yet.
      </p>
    );
  }

  if (provider !== 'aggregator') {
    return (
      <div className="flex gap-3 justify-center mt-6 text-xs text-[var(--color-text-muted)]">
        <span>💳 Cards</span>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2.5">
      <div
        role="radiogroup"
        aria-label="Payment method"
        className="flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      >
        {PAY_CHANNELS.map((id) => {
          const active = channel === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPayChannel(id)}
              className={`min-h-9 rounded-full px-4 text-xs font-bold transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] text-black shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {PAY_CHANNEL_LABELS[id]}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        扫码支付 · 支持支付宝 / 微信 · 由聚合支付通道处理
      </p>
    </div>
  );
}

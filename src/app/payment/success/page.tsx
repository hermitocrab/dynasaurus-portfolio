'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ConfirmationState = 'confirming' | 'confirmed' | 'action_required' | 'delayed' | 'error';

interface SubscriptionResult {
  confirmed?: boolean;
  tier?: string;
  status?: string;
  error?: string;
}

/**
 * Post-payment confirmation screen.
 *
 * `?session_id=` (Stripe Checkout) and `?order=` (aggregator Alipay / WeChat)
 * are both supported; neither parameter existing keeps the original behaviour.
 */
export default function PaymentSuccessPage() {
  const [state, setState] = useState<ConfirmationState>('confirming');
  const [tier, setTier] = useState('');
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const orderId = params.get('order');

    if (!sessionId && !orderId) {
      setState('error');
      setMessage('This confirmation link is missing its payment reference.');
      return;
    }

    const poll = async () => {
      attempts += 1;
      try {
        const endpoint = orderId
          ? `/api/pay/status?order=${encodeURIComponent(orderId)}`
          : `/api/subscription/status?session_id=${encodeURIComponent(sessionId as string)}`;

        const response = await fetch(endpoint, { cache: 'no-store' });
        const result = await response.json().catch(() => ({})) as SubscriptionResult;
        if (cancelled) return;

        if (response.status === 401) {
          setState('error');
          setMessage('Sign in again to confirm this payment.');
          return;
        }
        if (!response.ok) {
          throw new Error(result.error || 'Unable to confirm subscription status.');
        }
        if (result.confirmed) {
          setTier(result.tier || 'paid');
          setState('confirmed');
          setMessage(
            orderId
              ? '支付已确认，订阅已生效。Payment confirmed — your subscription is active.'
              : 'Stripe and DynaSaurus now agree that your subscription is active.',
          );
          return;
        }
        if (orderId
          ? ['failed', 'expired', 'review'].includes(result.status || '')
          : ['past_due', 'unpaid', 'incomplete_expired', 'canceled'].includes(result.status || '')) {
          setState('action_required');
          setMessage(
            orderId
              ? 'This payment did not complete. Try again, or send Kee the order reference from this page.'
              : 'Stripe could not confirm the payment. Open billing settings or try checkout again.',
          );
          return;
        }
        if (attempts >= 30) {
          setState('delayed');
          setMessage('Confirmation is taking longer than usual. Your access will update automatically when the payment callback arrives.');
          return;
        }

        timer = setTimeout(poll, 2000);
      } catch (error) {
        if (cancelled) return;
        if (attempts < 30) {
          timer = setTimeout(poll, 2000);
          return;
        }
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to confirm subscription status.');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const icon = state === 'confirmed' ? '✅' : state === 'action_required' || state === 'error' ? '⚠️' : '⏳';
  const title = state === 'confirmed'
    ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} confirmed`
    : state === 'confirming'
      ? 'Confirming payment'
      : state === 'delayed'
        ? 'Still confirming'
        : 'Payment needs attention';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6 text-center">
      <main className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] px-8 py-14 shadow-2xl">
        <div className={`mb-5 text-6xl ${state === 'confirming' ? 'animate-pulse' : ''}`}>{icon}</div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)]">{title}</h1>
        <p role="status" className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--color-text-muted)]">{message}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-full bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] px-6 py-3 text-sm font-bold text-black">
            Go to DynaSaurus
          </Link>
          {(state === 'action_required' || state === 'delayed' || state === 'error') && (
            <Link href="/pricing" className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm font-bold text-[var(--color-text-secondary)]">
              Back to pricing
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

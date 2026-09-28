import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNav from "@/components/MarketingNav";
import PaymentMethods from "@/components/PaymentMethods";
import { SUBSCRIPTION_CATALOG, SUBSCRIPTION_TIERS } from "@/lib/subscriptions";
import { getPayProvider, isPaidCheckoutEnabled } from "@/lib/payments/provider";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "DynaSaurus Pricing",
  description:
    "Compare the DynaSaurus Free plan and planned paid tiers. Free includes five daily lookups; paid checkout is not yet available.",
  path: "/pricing",
});

const TIER_COLORS = {
  free: "text-[var(--color-text-muted)]",
  basic: "text-[var(--color-accent-warm)]",
  premium: "text-[#FF6B6B]",
  ultimate: "text-[#A78BFA]",
} as const;

export default function PricingPage() {
  // PAY_PROVIDER=off (the default) keeps the Stripe-era payment strip and
  // checkout flow exactly as they were.
  const payProvider = getPayProvider();
  const checkoutEnabled = isPaidCheckoutEnabled();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <MarketingNav />
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="text-5xl mb-4">🦕</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[var(--color-text-primary)]">
            Simple Pricing
          </h1>
          <p className="text-[var(--color-text-muted)] mt-3 text-lg max-w-md mx-auto">
            Free is available now. Planned paid tiers are shown in CNY; live checkout is not available yet.
          </p>
          <PaymentMethods provider={payProvider} checkoutEnabled={checkoutEnabled} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {SUBSCRIPTION_TIERS.map((tierId) => {
            const tier = SUBSCRIPTION_CATALOG[tierId];
            const isFree = tierId === "free";

            return (
            <div
              key={tierId}
              className={`relative bg-[var(--color-panel)] border rounded-2xl p-7 transition-all duration-200 hover:-translate-y-1 ${
                tier.featured
                  ? "border-[#FF6B6B]/40 shadow-xl shadow-[#FF6B6B]/5"
                  : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              {!isFree && !checkoutEnabled ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Planned
                </div>
              ) : tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] text-black text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${TIER_COLORS[tierId]}`}>{tier.name}</div>
              <div className="text-4xl font-black tracking-tight text-[var(--color-text-primary)] mb-1">
                ¥{tier.amount}<span className="ml-1 text-sm font-normal text-[var(--color-text-muted)]">{tier.period}</span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mb-6">{tier.description}</div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((f, i) => (
                  <li key={i} className="text-sm flex items-start gap-2 text-[var(--color-text-secondary)]">
                    <span className="text-xs mt-0.5 text-[var(--color-accent-cool)]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isFree ? (
                <Link
                  href="/"
                  className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]"
                >
                  Start Free
                </Link>
              ) : (
                <CheckoutButton
                  tier={tierId}
                  label={`Get ${tier.name}`}
                  featured={tier.featured}
                  provider={payProvider}
                  checkoutEnabled={checkoutEnabled}
                />
              )}
            </div>
          )})}
        </div>

        <div className="text-center mt-12">
          {!checkoutEnabled && (
            <p className="mx-auto mb-5 max-w-2xl text-xs leading-6 text-[var(--color-text-muted)]">
              Paid prices and feature packages are a preview and may change before checkout opens. No real-money payment
              method is active today.
            </p>
          )}
          <Link href="/" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            ← Back to DynaSaurus
          </Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}

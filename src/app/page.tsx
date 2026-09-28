import DynaSaurusApp from "@/components/DynaSaurusApp";
import StructuredData from "@/components/StructuredData";
import { PRODUCT_FACTS } from "@/lib/product-facts";
import {
  createPageMetadata,
  PRODUCT_DESCRIPTION,
  PRODUCT_TITLE,
} from "@/lib/seo";

export const metadata = createPageMetadata({
  title: PRODUCT_TITLE,
  description: PRODUCT_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <DynaSaurusApp />
      <section
        aria-labelledby="what-is-dynasaurus"
        className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent-warm)]">
            AI language learning, made personal
          </p>
          <h2
            id="what-is-dynasaurus"
            className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl"
          >
            What is DynaSaurus?
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
            {PRODUCT_FACTS.definition}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PRODUCT_FACTS.coreModules.map(({ name, description }) => (
              <article
                key={name}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
              >
                <h3 className="font-bold text-[var(--color-text-primary)]">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:p-8">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">How the RUA method works</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
              RUA means Recognise, Understand, and Apply: identify a word&apos;s meaning, form, and pronunciation;
              understand its context, collocations, and connotations; then apply it through level-appropriate,
              cross-linguistic practice.
            </p>
            <p className="mt-3 text-xs leading-6 text-[var(--color-text-muted)]">
              You can start without an account. The Free plan includes {PRODUCT_FACTS.freeDailyLookups} lookups per day;
              an account is used for cloud history sync.
            </p>
          </div>

          <nav aria-label="Learn more about DynaSaurus" className="mt-10 flex flex-wrap gap-3 text-sm">
            <a href="/intro" className="rounded-full bg-[var(--color-accent)] px-5 py-3 font-bold text-white">
              See how it works
            </a>
            <a href="/method/rua" className="rounded-full border border-[var(--color-border)] px-5 py-3 font-semibold text-[var(--color-text-primary)]">
              Explore RUA
            </a>
            <a href="/about" className="rounded-full border border-[var(--color-border)] px-5 py-3 font-semibold text-[var(--color-text-primary)]">
              About
            </a>
            <a href="/faq" className="rounded-full border border-[var(--color-border)] px-5 py-3 font-semibold text-[var(--color-text-primary)]">
              FAQ
            </a>
            <a href="/privacy" className="rounded-full border border-[var(--color-border)] px-5 py-3 font-semibold text-[var(--color-text-primary)]">
              Privacy
            </a>
          </nav>
        </div>
      </section>
    </>
  );
}

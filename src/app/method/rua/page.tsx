import JsonLd from "@/components/JsonLd";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNav from "@/components/MarketingNav";
import { PRODUCT_FACTS } from "@/lib/product-facts";
import { createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "The RUA Language-Learning Method",
  description:
    "RUA is DynaSaurus’s three-stage learning workflow: Recognise, Understand, and Apply. See how it turns a definition into usable language.",
  path: "/method/rua",
});

const methodJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${SITE_URL}/method/rua#article`,
  headline: "The RUA Language-Learning Method",
  description: "RUA is DynaSaurus’s three-stage learning workflow: Recognise, Understand, and Apply.",
  url: `${SITE_URL}/method/rua`,
  dateModified: PRODUCT_FACTS.lastReviewed,
  author: {
    "@type": "Person",
    "@id": `${SITE_URL}/#creator`,
    name: PRODUCT_FACTS.creator.name,
    url: PRODUCT_FACTS.creator.url,
  },
  about: { "@id": `${SITE_URL}/#app` },
  inLanguage: "en",
};

export default function RuaMethodPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd data={methodJsonLd} />
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent-warm)]">Learning framework</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          RUA: Recognise, Understand, Apply
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
          RUA is the three-stage workflow DynaSaurus uses to move from identifying a word to using it. It organizes an
          explanation around recognition, contextual understanding, and practice tailored to the learner&apos;s level,
          first language, and interests.
        </p>

        <section aria-labelledby="three-stages" className="mt-14">
          <h2 id="three-stages" className="text-2xl font-black text-[var(--color-text-primary)]">The three stages</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {PRODUCT_FACTS.rua.steps.map((step, index) => (
              <li key={step.name} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
                <p className="text-4xl font-black text-[var(--color-accent)]">{index + 1}</p>
                <h3 className="mt-4 text-xl font-bold text-[var(--color-text-primary)]">{step.name}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="worked-example" className="mt-14 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent-cool)]">Illustrative example</p>
          <h2 id="worked-example" className="mt-2 text-2xl font-black text-[var(--color-text-primary)]">Learning “carving” across sports</h2>
          <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            <p><strong className="text-[var(--color-text-primary)]">Recognise:</strong> identify the relevant sense of “carving,” its form, and how it is pronounced—not every dictionary sense at once.</p>
            <p><strong className="text-[var(--color-text-primary)]">Understand:</strong> compare how the word appears in familiar skateboarding language and in a new snowboarding context, including useful collocations such as “carve a turn.”</p>
            <p><strong className="text-[var(--color-text-primary)]">Apply:</strong> use the word in a new sentence, contrast it with a close alternative, and practise it at the learner&apos;s CEFR level.</p>
          </div>
        </section>

        <section aria-labelledby="method-limits" className="mt-14">
          <h2 id="method-limits" className="text-2xl font-black text-[var(--color-text-primary)]">What RUA does—and does not—claim</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
            RUA is a product learning framework for structuring explanations and practice. It is not presented here as a
            clinical intervention or as proof of a guaranteed score or learning outcome. The quality of an AI-generated
            response still depends on the input and should be checked when accuracy matters.
          </p>
          <p className="mt-5 text-xs text-[var(--color-text-muted)]">
            Written by {PRODUCT_FACTS.creator.name} · Last reviewed {PRODUCT_FACTS.lastReviewed}
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

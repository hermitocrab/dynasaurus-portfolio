import JsonLd from "@/components/JsonLd";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNav from "@/components/MarketingNav";
import { PRODUCT_FACTS } from "@/lib/product-facts";
import { createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About DynaSaurus",
  description: `${PRODUCT_FACTS.definition} Learn who created it, what it does, and the facts behind the product.`,
  path: "/about",
});

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}/about#webpage`,
  url: `${SITE_URL}/about`,
  name: "About DynaSaurus",
  description: PRODUCT_FACTS.definition,
  dateModified: PRODUCT_FACTS.lastReviewed,
  mainEntity: {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: PRODUCT_FACTS.name,
    alternateName: PRODUCT_FACTS.chineseName,
    url: SITE_URL,
    applicationCategory: "EducationalApplication",
    creator: {
      "@type": "Person",
      "@id": `${SITE_URL}/#creator`,
      name: PRODUCT_FACTS.creator.name,
      jobTitle: PRODUCT_FACTS.creator.role,
      url: PRODUCT_FACTS.creator.url,
    },
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd data={aboutJsonLd} />
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent-warm)]">Product facts</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          About DynaSaurus
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
          {PRODUCT_FACTS.definition}
        </p>
        <p lang="zh-CN" className="mt-4 max-w-3xl text-base leading-8 text-[var(--color-text-muted)]">
          DynaSaurus（词灵龙）是由 Kee Lee 创建的个性化 AI 语言学习网页应用。它会根据学习者的 CEFR
          等级、母语和兴趣，调整词汇解释、翻译、语法反馈与雅思口语练习。
        </p>

        <section aria-labelledby="quick-facts" className="mt-14">
          <h2 id="quick-facts" className="text-2xl font-black text-[var(--color-text-primary)]">Quick facts</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Creator", `${PRODUCT_FACTS.creator.name} · ${PRODUCT_FACTS.creator.role}`],
              ["Format", "Web application"],
              ["Core modules", String(PRODUCT_FACTS.coreModules.length)],
              ["Learning levels", `${PRODUCT_FACTS.cefrLevels[0]}–${PRODUCT_FACTS.cefrLevels.at(-1)}`],
              ["Language settings", String(PRODUCT_FACTS.interfaceLanguages.length)],
              ["Free access", `${PRODUCT_FACTS.freeDailyLookups} lookups per day`],
            ].map(([term, value]) => (
              <div key={term} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
                <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{term}</dt>
                <dd className="mt-2 font-bold text-[var(--color-text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="current-capabilities" className="mt-14">
          <h2 id="current-capabilities" className="text-2xl font-black text-[var(--color-text-primary)]">
            What it is designed to do
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PRODUCT_FACTS.coreModules.map((module) => (
              <article key={module.name} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
                <h3 className="font-bold text-[var(--color-text-primary)]">{module.name}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{module.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="scope" className="mt-14 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:p-8">
          <h2 id="scope" className="text-2xl font-black text-[var(--color-text-primary)]">Scope and limitations</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            <p>
              DynaSaurus provides AI-generated learning support. AI output can be incomplete or wrong, so learners should
              verify high-stakes, specialist, legal, medical, or exam-critical information with an appropriate source.
            </p>
            <p>
              DynaSaurus does not issue official IELTS scores and is not a replacement for an accredited examiner or a teacher.
              No product-specific outcome study, rating, or customer-result claim is published on this site.
            </p>
            <p>
              {PRODUCT_FACTS.languageClaim} This describes interface and profile choices; it is not a claim that every speech,
              media, or instructional feature has identical coverage in every language.
            </p>
          </div>
        </section>

        <section aria-labelledby="ownership" className="mt-14">
          <h2 id="ownership" className="text-2xl font-black text-[var(--color-text-primary)]">Creator and product identity</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
            DynaSaurus is created by <a className="text-[var(--color-accent-cool)] underline underline-offset-4" href={PRODUCT_FACTS.creator.url}>Kee Lee</a>.
            DynaSaurus and 词灵龙 are names for this product. DynamOS is a separate wider platform name and is not another
            name for DynaSaurus.
          </p>
          <p className="mt-5 text-xs text-[var(--color-text-muted)]">Facts last reviewed: {PRODUCT_FACTS.lastReviewed}</p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

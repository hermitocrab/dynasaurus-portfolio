import { PRODUCT_FACTS } from "@/lib/product-facts";
import { SITE_URL } from "@/lib/seo";

export default function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#creator`,
        name: PRODUCT_FACTS.creator.name,
        url: PRODUCT_FACTS.creator.url,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: PRODUCT_FACTS.name,
        alternateName: PRODUCT_FACTS.chineseName,
        url: SITE_URL,
        description: PRODUCT_FACTS.definition,
        inLanguage: "en",
        creator: { "@id": `${SITE_URL}/#creator` },
        about: { "@id": `${SITE_URL}/#app` },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: PRODUCT_FACTS.name,
        alternateName: PRODUCT_FACTS.chineseName,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: PRODUCT_FACTS.definition,
        creator: { "@id": `${SITE_URL}/#creator` },
        isAccessibleForFree: true,
        inLanguage: "en",
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
        },
        featureList: [
          ...PRODUCT_FACTS.coreModules.map(({ name }) => name),
          `CEFR support from ${PRODUCT_FACTS.cefrLevels[0]} to ${PRODUCT_FACTS.cefrLevels.at(-1)}`,
        ],
        offers: {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "CNY",
          description: `${PRODUCT_FACTS.freeDailyLookups} lookups per day`,
          url: SITE_URL,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

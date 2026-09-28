import type { Metadata } from "next";
import { PRODUCT_FACTS } from "@/lib/product-facts";

export const SITE_NAME = PRODUCT_FACTS.name;
export const SITE_URL = PRODUCT_FACTS.canonicalUrl;
export const PRODUCT_TITLE = "DynaSaurus | Personalized AI Language Tutor";
export const PRODUCT_DESCRIPTION =
  "DynaSaurus is Kee Lee’s personalized AI language-learning app for vocabulary, translation, grammar feedback, and IELTS speaking practice.";

export const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "DynaSaurus — personalized AI language tutor",
};

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  socialTitle?: string;
}

export function createPageMetadata({
  title,
  description,
  path,
  socialTitle,
}: PageMetadataOptions): Metadata {
  const canonical = new URL(path, SITE_URL).toString();
  const absoluteTitle = path === "/" ? title : `${title} | ${SITE_NAME}`;
  const shareTitle = socialTitle ?? absoluteTitle;

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      locale: "en_US",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [SOCIAL_IMAGE.url],
    },
  };
}

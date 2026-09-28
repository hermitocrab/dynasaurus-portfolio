import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const contentUpdated = new Date("2026-09-25T00:00:00+08:00");

  return [
    {
      url: SITE_URL,
      lastModified: contentUpdated,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/intro`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/method/rua`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/mini`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: contentUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-09-15T00:00:00+08:00"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

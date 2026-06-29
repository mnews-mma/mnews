import type { MetadataRoute } from "next";
import { FIGHTERS } from "@/lib/fighters";

const BASE_URL = "https://www.mnews.jp";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "always",
      priority: 1,
    },
    {
      url: `${BASE_URL}/archive`,
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/fighters`,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const fighterRoutes: MetadataRoute.Sitemap = FIGHTERS.map((f) => ({
    url: `${BASE_URL}/fighters/${f.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...fighterRoutes];
}

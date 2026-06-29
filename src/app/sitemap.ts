import type { MetadataRoute } from "next";
import { FIGHTERS } from "@/lib/fighters";
import { EVENT_RESULTS } from "@/lib/eventResults";

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
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];

  const fighterRoutes: MetadataRoute.Sitemap = FIGHTERS.map((f) => ({
    url: `${BASE_URL}/fighters/${f.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const resultRoutes: MetadataRoute.Sitemap = EVENT_RESULTS.map((e) => ({
    url: `${BASE_URL}/results/${e.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...fighterRoutes, ...resultRoutes];
}

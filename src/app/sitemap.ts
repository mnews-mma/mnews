import type { MetadataRoute } from "next";
import { FIGHTERS } from "@/lib/fighters";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { EVENTS } from "@/lib/events";

const BASE_URL = "https://www.mnews.jp";
const TODAY = new Date().toISOString().split("T")[0];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "always", priority: 1, lastModified: TODAY },
    { url: `${BASE_URL}/archive`, changeFrequency: "hourly", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/fighters`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/events`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/rizin`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/deep`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/pancrase`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/shooto`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/deep-2026`, changeFrequency: "weekly", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/results`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.2 },
  ];

  // hidden 選手(Mレーティングが乗るまで伏せる新規投入ぶん)はサイトマップに載せない。
  const fighterRoutes: MetadataRoute.Sitemap = FIGHTERS.filter((f) => !f.hidden).map((f) => ({
    url: `${BASE_URL}/fighters/${f.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
    lastModified: TODAY,
  }));

  // 結果ページの lastModified は大会日（掲載確定の基準日）
  const resultRoutes: MetadataRoute.Sitemap = EVENT_RESULTS.map((e) => ({
    url: `${BASE_URL}/results/${e.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: e.date,
  } as MetadataRoute.Sitemap[number]));

  const eventRoutes: MetadataRoute.Sitemap = EVENTS.map((e) => ({
    url: `${BASE_URL}/events/${e.slug}`,
    changeFrequency: e.status === "upcoming" ? "daily" : "weekly",
    priority: e.status === "upcoming" ? 0.8 : 0.6,
    lastModified: e.status === "upcoming" ? TODAY : e.date,
  } as MetadataRoute.Sitemap[number]));

  return [...staticRoutes, ...fighterRoutes, ...resultRoutes, ...eventRoutes];
}

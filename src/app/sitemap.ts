import type { MetadataRoute } from "next";
import { FIGHTERS } from "@/lib/fighters";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { EVENTS } from "@/lib/events";
import { ORIGINAL_ARTICLES } from "@/lib/originalArticles";
import { fetchRankings } from "@/lib/mnewsRatingData";
import { DIVISION_SLUG, PUBLISHED_DIVISIONS } from "@/lib/mnewsRating/divisions";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { isVsPairIndexable, normalizeVsSlugs } from "@/lib/vsPairing";

const BASE_URL = "https://www.mnews.jp";
const TODAY = new Date().toISOString().split("T")[0];

// data/rankings.jsonはビルド無しの日次バッチでも更新される(GitHub raw経由)ため、
// 他のstaticRoutesと違いここだけfetchして最新のupdatedAtをlastmodに反映する
// (指示書: 「日次バッチ後にlastmodが更新されること」)。
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rankings = await fetchRankings();
  const rankingsUpdatedAt = Object.values(rankings)[0]?.updatedAt.slice(0, 10) ?? TODAY;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "always", priority: 1, lastModified: TODAY },
    { url: `${BASE_URL}/archive`, changeFrequency: "hourly", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/fighters`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/events`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/rizin`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/deep`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/pancrase`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/shooto`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/ranking/undefeated`, changeFrequency: "daily", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/rankings`, changeFrequency: "daily", priority: 0.8, lastModified: rankingsUpdatedAt },
    { url: `${BASE_URL}/rankings/methodology`, changeFrequency: "monthly", priority: 0.4, lastModified: TODAY },
    { url: `${BASE_URL}/deep-2026`, changeFrequency: "weekly", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/results`, changeFrequency: "daily", priority: 0.8, lastModified: TODAY },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.2 },
  ];

  const rankingDivisionRoutes: MetadataRoute.Sitemap = PUBLISHED_DIVISIONS.map((division) => ({
    url: `${BASE_URL}/rankings/${DIVISION_SLUG[division]}`,
    changeFrequency: "daily",
    priority: 0.8,
    lastModified: rankings[DIVISION_SLUG[division]]?.updatedAt.slice(0, 10) ?? rankingsUpdatedAt,
  }));

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

  const articleRoutes: MetadataRoute.Sitemap = ORIGINAL_ARTICLES.map((a) => ({
    url: `${BASE_URL}/articles/${a.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: a.publishedAt,
  }));

  // /vs/{a}/{b} は組み合わせが選手数の二乗のオーダーで発生する(spec §4)ため、
  // 索引許可条件(過去対戦・共通対戦相手・同一団体同一階級のいずれか)を満たす
  // ペアのみ載せる。判定ロジックはgenerateMetadataのrobots判定と同一関数
  // (isVsPairIndexable)を共有し、二重実装しない。
  const visibleFighters = await getVisibleFighters();
  const vsRoutes: MetadataRoute.Sitemap = [];
  for (let i = 0; i < visibleFighters.length; i++) {
    for (let j = i + 1; j < visibleFighters.length; j++) {
      const fA = visibleFighters[i];
      const fB = visibleFighters[j];
      if (!isVsPairIndexable(fA, fB, fA, fB)) continue;
      const norm = normalizeVsSlugs(fA.slug, fB.slug);
      vsRoutes.push({
        url: `${BASE_URL}/vs/${norm.a}/${norm.b}`,
        changeFrequency: "weekly",
        priority: 0.4,
        lastModified: TODAY,
      });
    }
  }

  return [
    ...staticRoutes,
    ...rankingDivisionRoutes,
    ...fighterRoutes,
    ...resultRoutes,
    ...eventRoutes,
    ...articleRoutes,
    ...vsRoutes,
  ];
}

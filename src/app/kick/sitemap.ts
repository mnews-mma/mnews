import type { MetadataRoute } from "next";
import { getKickIndex } from "@/lib/kick/data";
import { toJstDateStr } from "@/lib/eventCountdown";

const BASE_URL = "https://www.mnews.jp";

/**
 * /kick 専用のsitemap(https://www.mnews.jp/kick/sitemap.xml)。
 * ルート直下の src/app/sitemap.ts(既存、revalidate:3600のISR)とは意図的に分離する。
 * 理由:
 *  - 既存sitemapのレスポンスサイズ・生成コストに一切触れずに済む
 *    (選手2,482件を混ぜ込むと既存の生成ロジックへ手を入れる必要が生じる)
 *  - Search Consoleで立ち技セクションのインデックス到達状況を独立して追える
 *    (mnews本体で「sitemapには載っているが内部リンクがJS依存で生HTMLに0件」
 *    という所見を過去に掴んだ実績があり、切り分けができる構成を維持する)
 * data/kick/generated/ はビルド時に確定した静的データなので、ここでの読み出しも
 * ビルド時のみ発生する(リクエスト時の集計はしない)。
 */
export default function kickSitemap(): MetadataRoute.Sitemap {
  const { fighters } = getKickIndex();
  const TODAY = toJstDateStr();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/kick`, changeFrequency: "weekly", priority: 0.7, lastModified: TODAY },
    { url: `${BASE_URL}/kick/fighters`, changeFrequency: "weekly", priority: 0.7, lastModified: TODAY },
  ];

  const fighterRoutes: MetadataRoute.Sitemap = fighters.map((f) => ({
    url: `${BASE_URL}/kick/fighters/${encodeURIComponent(f.slug)}`,
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: TODAY,
  }));

  return [...staticRoutes, ...fighterRoutes];
}

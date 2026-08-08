import type { MetadataRoute } from "next";

// 全UAグループ共通で必ず入れるDisallow。この配列自体には/dream?を含めない
// (2026-08-08決定)。理由: 「共通配列に入れてシェアbotだけAllowで上書きする」
// 設計は、Allow/Disallowのどちらが勝つかがルールの並び順・最長一致に依存し
// クローラー実装によって解釈が割れうる。そのため、シェアbotグループには
// COMMON_DISALLOWのみ(=/dream?を含まない)を明示的に持たせ、"*"グループにだけ
// /dream?を追加する形にする(Allow上書きに頼らない)。
const COMMON_DISALLOW = ["/admin/"];

// OGP展開のためにページ本文を取得するボット。/dream?a=&b=(noindex,follow)を
// クロールされるとその都度サーバーレンダリングが発生し、検索エンジンによる
// 巡回と合わせてFluid Active CPUを消費する主要因になっていた(2026-08-07の
// 本番停止調査で判明)。ここに挙げたUAは"*"グループとは別に自分専用の
// ルールグループを持つため、"*"グループのDisallow(/dream?を含む)を一切
// 継承しない。COMMON_DISALLOW(/admin/)だけは明示的に引き継ぐ。
//
// 対象: シェア時にOGPカードを展開する主要プラットフォームのクローラーUA。
// このリストに無いUAは"*"グループの規則に従う(=/dream?はクロール不可になる)。
// 新たに対応したいプラットフォームが出た場合はここに追加する。
const SHARE_UNFURL_BOTS = [
  "Twitterbot",
  "facebookexternalhit",
  "Slackbot-LinkExpanding",
  "LINE",
  "Discordbot",
  "LinkedInBot",
  "TelegramBot",
  "WhatsApp",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...SHARE_UNFURL_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: COMMON_DISALLOW,
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: [...COMMON_DISALLOW, "/dream?"],
      },
    ],
    sitemap: "https://www.mnews.jp/sitemap.xml",
  };
}

import type { MetadataRoute } from "next";
import { COMMON_DISALLOW, SHARE_UNFURL_BOTS, SEO_AUDIT_BOTS } from "@/lib/robotsShareBots";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...SHARE_UNFURL_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: COMMON_DISALLOW,
      })),
      // SEO監査系クローラーはサイト全体を拒否する(allowは付けない)。
      // "*"グループとは別の専用グループなので、"*"のAllow: /は継承しない。
      ...SEO_AUDIT_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: [...COMMON_DISALLOW, "/dream?"],
      },
    ],
    // /kick は既存sitemap.xmlのISR(revalidate:3600)や生成コストに触れないよう
    // 専用sitemap(/kick/sitemap.xml)に分離している(src/app/kick/sitemap.ts参照)。
    // 既存の申告は変更せず、配列にして追加するだけにする。
    sitemap: ["https://www.mnews.jp/sitemap.xml", "https://www.mnews.jp/kick/sitemap.xml"],
  };
}

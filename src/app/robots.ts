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
    sitemap: "https://www.mnews.jp/sitemap.xml",
  };
}

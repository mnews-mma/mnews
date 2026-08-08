import type { MetadataRoute } from "next";
import { COMMON_DISALLOW, SHARE_UNFURL_BOTS } from "@/lib/robotsShareBots";

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

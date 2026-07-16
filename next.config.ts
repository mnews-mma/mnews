import type { NextConfig } from "next";
import { FIGHTER_SLUG_REDIRECTS } from "./src/lib/fighterSlugRedirects";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // 選手slug変更時の恒久リダイレクト(外部リンク・被リンク保護)。
  // 一覧はsrc/lib/fighterSlugRedirects.tsが単一の情報源(削除・上書き禁止、
  // 旧slugは追記のみ)。
  async redirects() {
    return FIGHTER_SLUG_REDIRECTS.map(({ from, to }) => ({
      source: `/fighters/${from}`,
      destination: `/fighters/${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;

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
    return [
      ...FIGHTER_SLUG_REDIRECTS.map(({ from, to }) => ({
        source: `/fighters/${from}`,
        destination: `/fighters/${to}`,
        permanent: true,
      })),
      // /tools/fighter-cardは/dreamと機能重複のため統合・廃止(2026-07-17)。
      // 固有機能(選手名検索・階級絞り込み・A/B入れ替え)はDreamPickerV2へ移植済み。
      { source: "/tools/fighter-card", destination: "/dream", permanent: true },
    ];
  },
};

export default nextConfig;

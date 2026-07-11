// data/rankings.json の読み出し(Edge Runtime向け・fs不使用)。
// /api/og/rankings/[division] のようなedge runtimeルートからのみ使う。
// 通常ページ(Node runtime)はローカルフォールバック付きのmnewsRatingData.tsを使うこと。
import type { RankingsFile, DivisionRankings } from "./mnewsRating/rankingsFile";

const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const RAW_URL = `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/rankings.json?v=${CACHE_BUSTER}`;

export async function fetchDivisionRankingsEdge(divisionSlug: string): Promise<DivisionRankings | null> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) {
      const all = (await res.json()) as RankingsFile;
      return all[divisionSlug] ?? null;
    }
  } catch {
    /* フォールバックなし。呼び出し側(OG route)はnullを見てデフォルト画像へ */
  }
  return null;
}

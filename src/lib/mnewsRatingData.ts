// data/rankings.json の読み出し。org-rankings/fighterRecordsと同じ思想:
// 本番はGitHub rawを取得日つきで参照し、日次バッチ(update-mnews-rating.ts)が
// 更新すれば再デプロイ無しで反映される(revalidate)。取得失敗時やプレビュー
// (未マージ)時はリポジトリ同梱のローカルファイルにフォールバックする。
import fs from "fs";
import path from "path";
import type { RankingsFile, DivisionRankings } from "./mnewsRating/rankingsFile";

const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const RAW_URL = `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/rankings.json?v=${CACHE_BUSTER}`;

async function fetchWithLocalFallback(): Promise<RankingsFile> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as RankingsFile;
  } catch {
    /* fall through to local */
  }
  try {
    const local = path.join(process.cwd(), "data", "rankings.json");
    return JSON.parse(fs.readFileSync(local, "utf8")) as RankingsFile;
  } catch {
    return {};
  }
}

export async function fetchRankings(): Promise<RankingsFile> {
  return fetchWithLocalFallback();
}

export async function fetchDivisionRankings(divisionSlug: string): Promise<DivisionRankings | null> {
  const all = await fetchWithLocalFallback();
  return all[divisionSlug] ?? null;
}

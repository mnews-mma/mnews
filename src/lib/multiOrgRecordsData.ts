// data/rizinRecords.json・data/shootoRecords.json・data/pancraseRecords.json
// の読み出し。orgRankingsData.ts/mnewsRatingData.tsと同じ思想: 本番はGitHub
// rawを取得日つきで参照し、更新があれば再デプロイ無しで反映される
// (revalidate)。取得失敗時やプレビュー(未マージ)時はリポジトリ同梱の
// ローカルファイルにフォールバックする。
//
// デプロイ毎に変わるコミットSHAをクエリに付け、Vercel Data Cache
// (revalidate:3600)をデプロイ単位でバスターする(mnewsRatingData.ts等と
// 完全に同型)。
import fs from "fs";
import path from "path";
import type { RizinRecordsEvent } from "./mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "./mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "./mnewsRating/pancraseRecordsTypes";

const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const MULTI_ORG_RECORDS_REVALIDATE = 3600;

function rawUrl(file: string): string {
  return `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/${file}?v=${CACHE_BUSTER}`;
}

async function fetchJsonArrayWithLocalFallback<T>(file: string): Promise<T[]> {
  try {
    const res = await fetch(rawUrl(file), { next: { revalidate: MULTI_ORG_RECORDS_REVALIDATE } });
    if (res.ok) return (await res.json()) as T[];
  } catch {
    /* fall through to local */
  }
  try {
    const local = path.join(process.cwd(), "data", file);
    return JSON.parse(fs.readFileSync(local, "utf8")) as T[];
  } catch {
    return [];
  }
}

export async function fetchRizinRecords(): Promise<RizinRecordsEvent[]> {
  return fetchJsonArrayWithLocalFallback<RizinRecordsEvent>("rizinRecords.json");
}

export async function fetchShootoRecords(): Promise<ShootoRecordsEvent[]> {
  return fetchJsonArrayWithLocalFallback<ShootoRecordsEvent>("shootoRecords.json");
}

export async function fetchPancraseRecords(): Promise<PancraseRecordsEvent[]> {
  return fetchJsonArrayWithLocalFallback<PancraseRecordsEvent>("pancraseRecords.json");
}

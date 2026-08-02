// data/rizinRecords.json・data/shootoRecords.json・data/pancraseRecords.json・
// data/deepRecords.json・data/shootoProfileBouts.json(指示書R-8)の読み出し。
// orgRankingsData.ts/mnewsRatingData.tsと同じ思想: 本番はGitHub rawを取得日
// つきで参照し、更新があれば再デプロイ無しで反映される(revalidate)。取得失敗時
// やプレビュー(未マージ)時はリポジトリ同梱のローカルファイルにフォールバックする。
//
// デプロイ毎に変わるコミットSHAをクエリに付け、Vercel Data Cache
// (revalidate:3600)をデプロイ単位でバスターする(mnewsRatingData.ts等と
// 完全に同型)。
import fs from "fs";
import path from "path";
import type { RizinRecordsEvent } from "./mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "./mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "./mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "./mnewsRating/deepScraper";

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

// data/shootoProfileBouts.json(指示書R-8): 修斗公式サイトの選手プロフィール
// ページ(/fighters/?id=NNN)経由で発見した、大会アーカイブ(/result/)には
// 出てこないbout(2012-12-24より前の試合・大会自体がアーカイブに無い試合)を
// 1bout=1件の疑似ShootoRecordsEvent互換オブジェクトとして格納したファイル。
// 既存のdata/shootoRecords.jsonとは完全に分離しており(出所の切り分けを保つため
// 混在させない)、ここで単純にconcatして返す。呼び出し元(multiOrgRecord.ts等)は
// 変更不要(返り値の配列が長くなるだけ)。
export async function fetchShootoRecords(): Promise<ShootoRecordsEvent[]> {
  const [archive, profile] = await Promise.all([
    fetchJsonArrayWithLocalFallback<ShootoRecordsEvent>("shootoRecords.json"),
    fetchJsonArrayWithLocalFallback<ShootoRecordsEvent>("shootoProfileBouts.json"),
  ]);
  return [...archive, ...profile];
}

export async function fetchPancraseRecords(): Promise<PancraseRecordsEvent[]> {
  return fetchJsonArrayWithLocalFallback<PancraseRecordsEvent>("pancraseRecords.json");
}

export async function fetchDeepRecords(): Promise<DeepRecordsEvent[]> {
  return fetchJsonArrayWithLocalFallback<DeepRecordsEvent>("deepRecords.json");
}

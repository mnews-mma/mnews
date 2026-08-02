// multiOrgRecordsData.ts の Edge Runtime 版。/api/og/* は edge runtime
// (next/og の ImageResponse) で動いており、Node固有API(fs/path)を含む
// モジュールをimportするとビルドが失敗する(実測確認済み: multiOrgRecordsData.tsの
// ローカルファイルfallbackがfs/pathを使っているため)。edge runtimeにはそもそも
// リポジトリ同梱のdata/配下を読めるファイルシステムが無く、ローカルfallback自体が
// 意味を持たないため、GitHub raw fetchのみのこちらを別ファイルとして持つ
// (multiOrgRecordsData.ts本体は他の大多数の呼び出し元がNode/RSCコンテキストの
// ため変更しない)。取得失敗時は空配列を返す(捏造しない。呼び出し側は
// 4団体合算0件として通常どおりフォールバック)。
import type { RizinRecordsEvent } from "./mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "./mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "./mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "./mnewsRating/deepScraper";

const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const MULTI_ORG_RECORDS_REVALIDATE = 3600;

function rawUrl(file: string): string {
  return `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/${file}?v=${CACHE_BUSTER}`;
}

async function fetchJsonArray<T>(file: string): Promise<T[]> {
  try {
    const res = await fetch(rawUrl(file), { next: { revalidate: MULTI_ORG_RECORDS_REVALIDATE } });
    if (res.ok) return (await res.json()) as T[];
  } catch {
    /* fall through */
  }
  return [];
}

export async function fetchRizinRecordsEdge(): Promise<RizinRecordsEvent[]> {
  return fetchJsonArray<RizinRecordsEvent>("rizinRecords.json");
}

export async function fetchShootoRecordsEdge(): Promise<ShootoRecordsEvent[]> {
  const [archive, profile] = await Promise.all([
    fetchJsonArray<ShootoRecordsEvent>("shootoRecords.json"),
    fetchJsonArray<ShootoRecordsEvent>("shootoProfileBouts.json"),
  ]);
  return [...archive, ...profile];
}

export async function fetchPancraseRecordsEdge(): Promise<PancraseRecordsEvent[]> {
  return fetchJsonArray<PancraseRecordsEvent>("pancraseRecords.json");
}

export async function fetchDeepRecordsEdge(): Promise<DeepRecordsEvent[]> {
  return fetchJsonArray<DeepRecordsEvent>("deepRecords.json");
}

// data/rizinRecords.json・data/shootoRecords.json・data/pancraseRecords.json・
// data/deepRecords.json・data/shootoProfileBouts.json(指示書R-8)の読み出し。
// orgRankingsData.ts/mnewsRatingData.tsと同じ思想: 本番はGitHub rawを取得日
// つきで参照し、更新があれば再デプロイ無しで反映される(revalidate)。取得失敗時
// やプレビュー(未マージ)時はリポジトリ同梱のローカルファイルにフォールバックする。
//
// デプロイ毎に変わるコミットSHAをクエリに付け、Vercel Data Cache
// (revalidate:3600)をデプロイ単位でバスターする(mnewsRatingData.ts等と
// 完全に同型)。
//
// プロセス内メモリキャッシュ(getMultiOrgSourceDataCached、2026-08-02追加):
// Next.jsのfetch Data Cache(next.revalidate)は1エントリ2MBまでしかキャッシュ
// できず、実測で以下3ファイルが上限超過によりキャッシュされていないことを
// 確認した(`Failed to set Next.js data cache ... items over 2MB can not be
// cached` を本番相当ビルドのログで実測):
//   pancraseRecords.json(raw取得時約6.4MB)・shootoRecords.json(約3.1MB)・
//   deepRecords.json(約2.2MB)
// つまりrevalidate:3600を指定していてもこの3ファイルは毎リクエストGitHub raw
// への実フェッチ+JSON.parseが発生していた(rizinRecords.json・
// shootoProfileBouts.jsonの2ファイルのみfetch Data Cacheの対象内)。さらに
// /fighters/[slug]は1リクエスト中に3箇所(generateMetadata・本体・同階級
// カード)から独立にこの5ファイル分の取得を呼んでおり、Next.jsの自動fetch
// memoization(1リクエスト内の重複排除)も効いていないことを実測で確認した
// (1リクエストで計15回のGitHub raw fetchが発生)。
// これがVercel Fluid Active CPUが2026-07-29〜31に急増した主因(4団体戦績
// 表示機能の投入・公開と時期が一致)。
//
// 対策として、Next.jsのfetch Data Cacheに頼らずプロセス内(Vercel Fluidの
// ウォームインスタンス内で維持されるJSのモジュールスコープ変数)で5ファイル
// をまとめて1時間キャッシュする。2MB制限を回避しつつ、1リクエスト内の
// 複数呼び出しも自然に1回のフェッチへ収束する(in-flightのPromiseを共有する
// ため)。
//
// 【既知の許容仕様】夜間バッチ(update-fighter-records.yml、JST 2:30)が
// data/*.jsonを更新しても、このキャッシュのTTL(1時間)が切れるまでは
// 更新前の値を返す。最大1時間の遅延はfetchFighterRecords()等の既存キャッシュ
// と同じ許容範囲であり意図した挙動。「バッチを回したのに数値が変わらない」
// と誤ってバグ調査をしないこと(このコメントが根拠)。即時反映が必要な場合は
// このキャッシュにrevalidateエンドポイントは無いため、新規デプロイ
// (CACHE_BUSTERが変わりキャッシュも入れ替わる)を待つ必要がある。
import fs from "fs";
import path from "path";
import type { RizinRecordsEvent } from "./mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "./mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "./mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "./mnewsRating/deepScraper";
import type { MultiOrgSourceData } from "./mnewsRating/multiOrgRecord";

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

async function loadMultiOrgSourceData(): Promise<MultiOrgSourceData> {
  const [rizinEvents, shootoArchive, shootoProfile, pancraseEvents, deepEvents] = await Promise.all([
    fetchJsonArrayWithLocalFallback<RizinRecordsEvent>("rizinRecords.json"),
    fetchJsonArrayWithLocalFallback<ShootoRecordsEvent>("shootoRecords.json"),
    fetchJsonArrayWithLocalFallback<ShootoRecordsEvent>("shootoProfileBouts.json"),
    fetchJsonArrayWithLocalFallback<PancraseRecordsEvent>("pancraseRecords.json"),
    fetchJsonArrayWithLocalFallback<DeepRecordsEvent>("deepRecords.json"),
  ]);
  return {
    rizinEvents,
    // fetchShootoRecords()が従来返していたのと同じ結合順(archive→profile)。
    shootoEvents: [...shootoArchive, ...shootoProfile],
    pancraseEvents,
    deepEvents,
  };
}

let inFlight: Promise<MultiOrgSourceData> | null = null;
let resolved: { data: MultiOrgSourceData; expiresAt: number } | null = null;

// 5ファイル分をまとめて1時間キャッシュして返す。同時に何箇所から呼ばれても
// (1リクエスト内の複数呼び出し・複数リクエストの重なりいずれも)実フェッチは
// 1回に収束する(in-flightのPromiseを共有するため)。全ソース取得失敗(ローカル
// fallbackも失敗)の空データはキャッシュしない(一時障害を1時間固定化しない)。
export function getMultiOrgSourceDataCached(): Promise<MultiOrgSourceData> {
  const now = Date.now();
  if (resolved && resolved.expiresAt > now) return Promise.resolve(resolved.data);
  if (inFlight) return inFlight;

  inFlight = loadMultiOrgSourceData()
    .then((data) => {
      const isEmpty =
        data.rizinEvents.length === 0 &&
        data.shootoEvents.length === 0 &&
        data.pancraseEvents.length === 0 &&
        data.deepEvents.length === 0;
      if (!isEmpty) resolved = { data, expiresAt: Date.now() + MULTI_ORG_RECORDS_REVALIDATE * 1000 };
      inFlight = null;
      return data;
    })
    .catch((err) => {
      inFlight = null;
      throw err;
    });
  return inFlight;
}

// 既存呼び出し元(4団体を個別にimportしている箇所)向けの互換API。内部実装は
// 上記の単一キャッシュ済みスナップショット経由に統一した(戻り値の形は従来と
// 完全に同一)。
export async function fetchRizinRecords(): Promise<RizinRecordsEvent[]> {
  return (await getMultiOrgSourceDataCached()).rizinEvents;
}

export async function fetchShootoRecords(): Promise<ShootoRecordsEvent[]> {
  return (await getMultiOrgSourceDataCached()).shootoEvents;
}

export async function fetchPancraseRecords(): Promise<PancraseRecordsEvent[]> {
  return (await getMultiOrgSourceDataCached()).pancraseEvents;
}

export async function fetchDeepRecords(): Promise<DeepRecordsEvent[]> {
  return (await getMultiOrgSourceDataCached()).deepEvents;
}

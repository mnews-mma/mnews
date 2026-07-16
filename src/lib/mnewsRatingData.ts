// data/rankings.json の読み出し。org-rankings/fighterRecordsと同じ思想:
// 本番はGitHub rawを参照し、日次バッチ(update-mnews-rating.ts)がmainを更新
// すれば再デプロイ無しで反映される。取得失敗時やプレビュー(未マージ)時は
// リポジトリ同梱のローカルファイルにフォールバックする。
//
// キャッシュ(2026-07-17改訂・P0-C): fetchはData Cache(revalidate=
// RANKINGS_REVALIDATE)に乗る。URLの?v=<デプロイのcommit SHA>により、新規
// デプロイ時はキャッシュキーが変わり初回アクセスで必ず最新を取得する。
// デプロイを伴わないcron更新(mainへの[skip ci]付きcommit)ではキャッシュ
// キーが変わらないが、revalidate窓で自動的に最新化される。ページISR
// (export const revalidate)も同じ RANKINGS_REVALIDATE を使い、データ層と
// ページ層のキャッシュ窓を揃えることで全ページ同時反映=新旧混在ゼロを
// 構造的に担保する。
//
// 旧トークン方式(revalidateTag + 専用エンドポイント /api/revalidate-rankings
// + REVALIDATE_TOKEN)は撤去した。raw参照でデプロイ非依存に最新化される以上、
// 即時パージが解いていたのは「最大1時間の遅延」のみで、その遅延は
// revalidate短縮で吸収できるため。人間のトークン設定という運用負債を排した。
import fs from "fs";
import path from "path";
import type { RankingsFile, DivisionRankings } from "./mnewsRating/rankingsFile";

// データ層(fetch)とページ層(ISR)で共有する再検証間隔(秒)。
// cronは1日2回更新のため、15分あれば実用上の遅延は十分小さい。
// 両層で必ず同じ値を使うこと(=ページ間で反映タイミングがズレない)。
export const RANKINGS_REVALIDATE = 900;

const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const RAW_URL = `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/rankings.json?v=${CACHE_BUSTER}`;

async function fetchWithLocalFallback(): Promise<RankingsFile> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: RANKINGS_REVALIDATE } });
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

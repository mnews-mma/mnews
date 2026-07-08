import { Fighter } from "./fighters";
import { ResolvedFighter } from "./feeds/resolveFighter";

// data/fighterRecords.json の読み出し。org-rankingsと同じ思想:
// バッチ(scripts/update-fighter-records.ts)が焼き込んだ結果をGitHub raw経由で読むだけにし、
// リクエスト時にはWikipediaへ一切fetchしない(可視選手数がリクエストごとに変動する問題の
// 恒久対策)。/api/og/* はedge runtimeのため fs は使えない → fetch() のみに統一する。
// デプロイ毎に変わるコミットSHAをクエリに付け、Vercel Data Cache(revalidate:3600)を
// デプロイ単位でバスターする。これが無いと、選手追加やバッチ更新をコミット→デプロイ
// しても、旧JSONをキャッシュしたfetch()の結果が最大1時間残り、新規選手が0-0-0の
// まま表示される(GitHub rawは未知クエリを無視するので実体取得には影響しない)。
// SHAはデプロイ内では一定=1時間キャッシュは効き、新デプロイでのみ確実に更新される。
const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const RAW_URL = `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/fighterRecords.json?v=${CACHE_BUSTER}`;

export interface FighterRecordEntry {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
  history: ResolvedFighter["history"];
  live: boolean;
  nickname?: string;
  birthPlace?: string;
  age?: number;
  noRecordData?: boolean;
}

export type FighterRecordsFile = Record<string, FighterRecordEntry>;

export async function fetchFighterRecords(): Promise<FighterRecordsFile> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as FighterRecordsFile;
  } catch {
    /* 取得失敗時は空({})を返す。呼び出し側はライブfetchへフォールバックせず、
       全選手を「未焼き込み」(live:false, noRecordData無し=非表示化しない)として
       扱う。捏造ゼロ・障害時に画面を壊さない安全側デフォルト。 */
  }
  return {};
}

// fetchFighterRecords()の厳格版。取得失敗を握り潰さず、成功/失敗を呼び出し側に
// 明示的に伝える。VSカード(/api/og/vs/*)のように「実在する選手の戦績が
// 一時的なfetch失敗で0-0のシード値にすり替わり、そのまま確定画像として
// 生成・拡散されてしまう」事故を防ぎたい場面でのみ使う。通常のページ表示
// (選手詳細・ランキング等)は従来通りfetchFighterRecords()の安全側
// フォールバック(空扱いでも画面は壊れない)を使い続ける。
export async function fetchFighterRecordsStrict(): Promise<
  { ok: true; records: FighterRecordsFile } | { ok: false }
> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return { ok: true, records: (await res.json()) as FighterRecordsFile };
  } catch {
    /* fall through */
  }
  return { ok: false };
}

// Fighter(静的シード)にキャッシュ済み戦績をマージしてResolvedFighter相当にする。
// キャッシュに無い(バッチ未対象=hiddenのみのはず)選手はシードのままlive:falseで返す。
export function mergeFighterRecord(fighter: Fighter, records: FighterRecordsFile): ResolvedFighter {
  const rec = records[fighter.slug];
  if (!rec) return { ...fighter, live: false };
  return { ...fighter, ...rec };
}

export function resolveFightersFromRecords(
  fighters: Fighter[],
  records: FighterRecordsFile
): ResolvedFighter[] {
  return fighters.map((f) => mergeFighterRecord(f, records));
}

// resolveFighter()/resolveFighters()(ライブfetch版)のドロップイン置き換え。
// バッチ専用のライブ版はresolveFighter.tsに残し、表示側は必ずこちら経由にする。
export async function resolveFighterCached(fighter: Fighter): Promise<ResolvedFighter> {
  const records = await fetchFighterRecords();
  return mergeFighterRecord(fighter, records);
}

export async function resolveFightersCached(fighters: Fighter[]): Promise<ResolvedFighter[]> {
  const records = await fetchFighterRecords();
  return resolveFightersFromRecords(fighters, records);
}

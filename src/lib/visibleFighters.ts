import { FIGHTERS } from "./fighters";
import { ResolvedFighter } from "./feeds/resolveFighter";
import { fetchFighterRecords, resolveFightersFromRecords } from "./fighterRecordsCache";
import { fetchRizinRecords, fetchShootoRecords, fetchPancraseRecords, fetchDeepRecords } from "./multiOrgRecordsData";
import { computeMultiOrgRecord } from "./mnewsRating/multiOrgRecord";
import { SHOW_MULTI_ORG_RECORD } from "./featureFlags";

// /fighters 一覧・Xカードツールで共通の「公開母集団」を返す。
// 公開条件 = 非hidden(needsReview/HELDは hidden 側で既に除外) かつ 表示できる戦績が
// 何かある(Wikipedia通算 または 4団体合算のいずれか)。除外条件は「Wikipedia由来の
// 戦績がない」ではなく「表示できる戦績が何もない」であるべき、という判断
// (2026-07-31)。SHOW_MULTI_ORG_RECORDがoffの間は従来どおりWikipedia通算のみで判定する。
// 両画面で必ず同じ母集団になるようこの1関数に集約する(⑤の /fighters ↔ Xカード
// 不整合の恒久解消)。
//
// 戦績データはリクエスト時にWikipediaへライブfetchせず、バッチ(update-fighter-records.ts)が
// 焼き込んだ data/fighterRecords.json を読むだけにする(可視選手数がリクエストごとに
// 変動する問題の恒久対策)。
export async function getVisibleFighters(): Promise<ResolvedFighter[]> {
  const records = await fetchFighterRecords();
  const resolved = resolveFightersFromRecords(FIGHTERS.filter((f) => !f.hidden), records);
  if (!SHOW_MULTI_ORG_RECORD) return resolved.filter((f) => !f.noRecordData);

  const [rizinEvents, shootoEvents, pancraseEvents, deepEvents] = await Promise.all([
    fetchRizinRecords(),
    fetchShootoRecords(),
    fetchPancraseRecords(),
    fetchDeepRecords(),
  ]);
  return resolved
    .map((f) => {
      if (!f.noRecordData) return f;
      const mr = computeMultiOrgRecord(f.slug, { rizinEvents, shootoEvents, pancraseEvents, deepEvents });
      if (mr.wins === 0 && mr.losses === 0 && mr.draws === 0) return f;
      return { ...f, multiOrgRecord: { wins: mr.wins, losses: mr.losses, draws: mr.draws } };
    })
    .filter((f) => !f.noRecordData || !!f.multiOrgRecord);
}

// 上記と同じ可視性判定でslugのSetだけを返す。イベント/戦績ページの対戦相手リンク
// (findFighterSlugByNameのvisibleSlugs引数)で使う軽量ヘルパー。判定ロジックの
// 二重定義を避けるため、必ずこの関数(=getVisibleFighters)経由で導出する。
export async function getVisibleFighterSlugs(): Promise<Set<string>> {
  const visible = await getVisibleFighters();
  return new Set(visible.map((f) => f.slug));
}

// /ranking/{org}(現王者・序列表)で「名前+リンク」にできる選手を絞り込む。
// 「表示できる戦績が何かある」の判定はgetVisibleFighterSlugs()(=getVisibleFighters())
// 1箇所に一本化し、呼び出し側で同じ条件を再実装しない(2026-07-31、/fighters一覧と
// ランキングページで別実装の同一判定が存在していたことが原因の不整合を解消)。
export async function filterVisibleSlugs(slugs: Iterable<string>): Promise<string[]> {
  const visible = await getVisibleFighterSlugs();
  return Array.from(slugs).filter((s) => visible.has(s));
}

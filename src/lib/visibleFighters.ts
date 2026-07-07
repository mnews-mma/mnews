import { FIGHTERS } from "./fighters";
import { ResolvedFighter } from "./feeds/resolveFighter";
import { fetchFighterRecords, resolveFightersFromRecords } from "./fighterRecordsCache";

// /fighters 一覧・Xカードツールで共通の「公開母集団」を返す。
// 公開条件 = 非hidden(needsReview/HELDは hidden 側で既に除外) かつ 戦績あり
// (no-data は薄い/空の戦績なので面に出さない)。両画面で必ず同じ母集団になるよう
// この1関数に集約する(⑤の /fighters ↔ Xカード 不整合の恒久解消)。
//
// 戦績データはリクエスト時にWikipediaへライブfetchせず、バッチ(update-fighter-records.ts)が
// 焼き込んだ data/fighterRecords.json を読むだけにする(可視選手数がリクエストごとに
// 変動する問題の恒久対策)。
export async function getVisibleFighters(): Promise<ResolvedFighter[]> {
  const records = await fetchFighterRecords();
  const resolved = resolveFightersFromRecords(FIGHTERS.filter((f) => !f.hidden), records);
  return resolved.filter((f) => !f.noRecordData);
}

// 上記と同じ可視性判定でslugのSetだけを返す。イベント/戦績ページの対戦相手リンク
// (findFighterSlugByNameのvisibleSlugs引数)で使う軽量ヘルパー。判定ロジックの
// 二重定義を避けるため、必ずこの関数(=getVisibleFighters)経由で導出する。
export async function getVisibleFighterSlugs(): Promise<Set<string>> {
  const visible = await getVisibleFighters();
  return new Set(visible.map((f) => f.slug));
}

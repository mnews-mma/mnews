import { FIGHTERS } from "./fighters";
import { resolveFighters, ResolvedFighter } from "./feeds/resolveFighter";

// /fighters 一覧・Xカードツールで共通の「公開母集団」を返す。
// 公開条件 = 非hidden(needsReview/HELDは hidden 側で既に除外) かつ 戦績あり
// (no-data は薄い/空の戦績なので面に出さない)。両画面で必ず同じ母集団になるよう
// この1関数に集約する(⑤の /fighters ↔ Xカード 不整合の恒久解消)。
export async function getVisibleFighters(): Promise<ResolvedFighter[]> {
  const resolved = await resolveFighters(FIGHTERS.filter((f) => !f.hidden));
  return resolved.filter((f) => !f.noRecordData);
}

// 上記と同じ可視性判定でslugのSetだけを返す。イベント/戦績ページの対戦相手リンク
// (findFighterSlugByNameのvisibleSlugs引数)で使う軽量ヘルパー。判定ロジックの
// 二重定義を避けるため、必ずこの関数(=getVisibleFighters)経由で導出する。
export async function getVisibleFighterSlugs(): Promise<Set<string>> {
  const visible = await getVisibleFighters();
  return new Set(visible.map((f) => f.slug));
}

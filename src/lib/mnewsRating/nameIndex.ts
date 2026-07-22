// history.opponent(自由記述の日本語名)を自社DB内のslugへ解決するための索引。
// FIGHTERS(fighters.ts)は名前解決のみに参照する(fighters.tsは変更しない)。
// レーティング対象母集団はあくまで fighterRecords.json にデータを持つ選手に限る。
import { FIGHTERS } from "../fighters";
import { FighterRecordsInput } from "./engine";

// NFKC正規化: Wikipedia由来データに康熙部首(例: U+2F2D「⼭」)等のCJK互換
// 異体字が混入し、見た目は同一漢字でも文字コードが違うため名前解決が失敗する
// ケースがある(伊藤裕樹「杉⼭廣平」問題、2026-07-22発見)。上流(ja.Wikipedia)
// 自体がこの異体字を使っているため、データ側の1文字修正では次回スクレイプで
// 再発する。NFKCは全角/半角・互換文字の統合のみ行い、意味の異なる漢字同士を
// 同一視することはない(Unicode標準の等価性テーブルに基づく決定的な正規化)。
const norm = (s: string) => s.normalize("NFKC").replace(/[\s　・]/g, "");

export function buildOpponentResolver(
  records: FighterRecordsInput
): (opponentName: string) => string | null {
  const byName = new Map<string, string>();
  for (const f of FIGHTERS) {
    if (!records[f.slug]) continue;
    const candidates = [f.nameJa, f.nameEn, ...(f.aliases ?? [])];
    for (const c of candidates) {
      if (!c) continue;
      const key = norm(c);
      if (!byName.has(key)) byName.set(key, f.slug);
    }
  }
  return (opponentName: string) => byName.get(norm(opponentName)) ?? null;
}

// slug → 正規化済みの既知の名前表記一覧(nameJa/nameEn/aliases)。
// engine.tsの重複bout検出(dedupeGhostWallBouts)で、解決に失敗した相手名
// (wall bout)が実は既知の選手の別表記である可能性を、厳密な完全一致ではなく
// 部分一致で判定するために使う(西谷大成 ⊃ 大成 のようなケース)。
export function buildKnownNamesLookup(records: FighterRecordsInput): (slug: string) => string[] {
  const byslug = new Map<string, string[]>();
  for (const f of FIGHTERS) {
    if (!records[f.slug]) continue;
    const names = [f.nameJa, f.nameEn, ...(f.aliases ?? [])].filter((n): n is string => !!n).map(norm);
    byslug.set(f.slug, names);
  }
  return (slug: string) => byslug.get(slug) ?? [];
}

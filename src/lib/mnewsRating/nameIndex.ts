// history.opponent(自由記述の日本語名)を自社DB内のslugへ解決するための索引。
// FIGHTERS(fighters.ts)は名前解決のみに参照する(fighters.tsは変更しない)。
// レーティング対象母集団はあくまで fighterRecords.json にデータを持つ選手に限る。
import { FIGHTERS } from "../fighters";
import { FighterRecordsInput } from "./engine";

const norm = (s: string) => s.replace(/[\s　・]/g, "");

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

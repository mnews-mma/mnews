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

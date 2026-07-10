import type { FighterRecordEntry } from "./fighterRecordsCache";

// 戦績ストリップ(events/[slug]・results/[slug]で共用)のデータ算出ロジック。
// fighterRecords.json のみをソースとし、算出不能な項目はnullで返す(呼び出し側が非表示にする)。

export interface FighterStripStats {
  record: string; // 例 "12-3-1"(wins-losses-draws)
  // フィニッシュ率 = (KO+一本)/勝数。勝数0は算出不能としてnull。
  finishRate: number | null;
  // 直近5戦。history を日付降順に並べ替えてから先頭5件を取る
  // (元データが既に降順の場合も多いが、順序を前提にしない)。
  last5: FighterRecordEntry["history"][number]["result"][];
}

export const LAST5_SYMBOL: Record<FighterRecordEntry["history"][number]["result"], string> = {
  win: "○",
  loss: "●",
  draw: "△",
  nc: "△",
};

export function computeFighterStripStats(entry: FighterRecordEntry): FighterStripStats {
  const record = `${entry.wins}-${entry.losses}-${entry.draws}`;
  const finishRate = entry.wins > 0 ? Math.round(((entry.ko + entry.sub) / entry.wins) * 100) : null;
  const last5 = [...entry.history]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
    .map((h) => h.result);
  return { record, finishRate, last5 };
}

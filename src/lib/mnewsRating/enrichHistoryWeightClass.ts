// fighterRecords.jsonのhistory配列(RIZIN MMA boutのみ)に、EVENT_RESULTSから
// 突合したbout単位のweightClassを付与する。RIZIN MMA以外(キックルール・
// エキシビション・非RIZIN)のboutには一切触れない(既存のweightClass値も
// 上書きしない=推測での書き換えをしない)。
import { HistoryEntryLike, isRizinMmaEvent } from "./engine";
import { lookupBoutWeightClass } from "./boutWeightClassLookup";

export interface HistoryEntryWithWeightClass extends HistoryEntryLike {
  weightClass?: string;
}

export interface EnrichResult<T> {
  history: T[];
  nullBouts: Array<{ date: string; opponent: string }>;
}

// Tは呼び出し元の実際の型(fighters.tsのFightRecord等)をそのまま保持する
// (roundが必須フィールドの型でも、weightClassだけを追加で上書きできるようにする)。
export function enrichHistoryWithWeightClass<T extends HistoryEntryLike & { weightClass?: string }>(
  fighterName: string,
  history: T[]
): EnrichResult<T> {
  const nullBouts: Array<{ date: string; opponent: string }> = [];
  const enriched = history.map((h) => {
    if (!isRizinMmaEvent(h.event)) return h;
    const wc = lookupBoutWeightClass(fighterName, h.opponent, h.date);
    if (!wc) {
      nullBouts.push({ date: h.date, opponent: h.opponent });
      return h;
    }
    return { ...h, weightClass: wc };
  });
  return { history: enriched, nullBouts };
}

// Phase 2: rizinRecords.json(RIZIN公式ソース)を、対応するfighterRecords.json
// history側の試合より優先して使う配線。「rizinRecordsにエントリがあれば優先・
// 無ければ従来historyにフォールバック」という単純な優先順位を、bout単位(1試合
// ごと)で適用する。日付+選手slugで対応するrizinRecordsの試合を特定できた場合
// のみ上書きし、特定できない試合は元のhistoryをそのまま使う(推測での補完はしない)。
//
// 上書きするのはresult/method/weightClassの3フィールドのみ(date/opponent/event
// はhistory側の表記をそのまま維持する。recordOverrides.tsのpatch-weight-classと
// 同じ「必要最小限のフィールドだけ直す」設計)。
// - ルール種別がMMA以外(キックボクシング等)の試合はhistoryから除外する
//   (RIZIN戦績としては数えない。捏造ではなく対象外として扱う)。
// - 試合中止(cancelled)もhistoryから除外する(試合が成立していないため)。
// - 決着種別が判定不能(unknown)の場合は上書きせず元のhistoryのまま使う。
import { HistoryEntryLike, isRizinMmaEvent } from "./engine";
import { RizinRecordsBout, RizinRecordsEvent } from "./rizinScraper";

// slug+日付 → その試合のrizinRecords該当エントリ、の索引を1回だけ構築する。
export function buildRizinRecordsIndex(events: RizinRecordsEvent[]): Map<string, RizinRecordsBout> {
  const index = new Map<string, RizinRecordsBout>();
  for (const ev of events) {
    for (const b of ev.bouts) {
      if (b.fighterASlug) index.set(`${b.fighterASlug}|${ev.date}`, b);
      if (b.fighterBSlug) index.set(`${b.fighterBSlug}|${ev.date}`, b);
    }
  }
  return index;
}

function formatWeightClass(b: RizinRecordsBout): string | undefined {
  if (b.namedDivision) return b.namedDivision;
  if (b.weightKg) return `${b.weightKg}kg契約`;
  return undefined;
}

export interface RizinOverrideResult {
  history: HistoryEntryLike[];
  overriddenCount: number; // result/methodを公式ソースで上書きした試合数
  excludedCount: number; // MMA以外・試合中止で除外した試合数
}

export function applyRizinRecordsToHistory(
  slug: string,
  history: HistoryEntryLike[],
  index: Map<string, RizinRecordsBout>
): RizinOverrideResult {
  let overriddenCount = 0;
  let excludedCount = 0;
  const result: HistoryEntryLike[] = [];

  for (const h of history) {
    if (!isRizinMmaEvent(h.event)) {
      result.push(h);
      continue;
    }
    const match = index.get(`${slug}|${h.date}`);
    if (!match) {
      result.push(h); // 対応するrizinRecordsが無い試合はフォールバック(元のまま)
      continue;
    }
    if (match.ruleType !== "MMA" || match.resultType === "cancelled") {
      excludedCount++;
      continue; // MMA以外・中止試合は戦績集計から除外する
    }
    if (match.resultType === "unknown") {
      result.push(h); // 判定不能は補完せず元のまま
      continue;
    }

    let newResult: HistoryEntryLike["result"];
    if (match.resultType === "nc") newResult = "nc";
    else if (match.resultType === "draw") newResult = "draw";
    else newResult = match.winnerSlug === slug ? "win" : "loss";

    overriddenCount++;
    result.push({
      ...h,
      result: newResult,
      method: match.methodRaw || h.method,
      weightClass: formatWeightClass(match) ?? h.weightClass,
      isOpeningFight: match.isOpeningFight,
    });
  }

  return { history: result, overriddenCount, excludedCount };
}

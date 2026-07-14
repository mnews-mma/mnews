import { EVENTS, MEvent } from "./events";
import { EVENT_RESULTS, EventResult } from "./eventResults";

// トップページの「大会週ハブ」判定(RIZIN限定)。大会前後の検索・SNSが動く期間
// だけ、トップ一等地を該当大会の対戦カード/結果ハブに切り替えるための判定
// ロジック。既存の「結果投入→EVENTS手動削除」運用フローとは完全に独立した
// 日付ベースのwindow判定(events/[slug]のdaysUntilと同じ考え方を流用)。
//
// window: 大会日を基準に [大会-3日, 大会+1日](両端含む)。
// - この期間中、大会がまだEVENTS配列にある(status問わず)場合はphase="scheduled"
//   (対戦カードハブ)。
// - 結果が既にEVENT_RESULTSへ投入済み(＝EVENTSからは手動削除済みが通常)なら
//   phase="resultsReady"(結果ハブ)。
// - 大会日を過ぎているのにまだEVENT_RESULTSに無い(結果投入が人力で追いついて
//   いない)期間は、EVENTS側に残っている限りphase="scheduled"のまま
//   (=空の結果ハブを出さず、カード+ニュースハブを維持する。呼び出し側の
//   要件)。
const WINDOW_BEFORE_DAYS = 3;
const WINDOW_AFTER_DAYS = 1;

export interface EventWeekHub {
  slug: string;
  eventName: string;
  date: string;
  venue?: string;
  phase: "scheduled" | "resultsReady";
  scheduledEvent?: MEvent;
  resultsEvent?: EventResult;
}

// asOf基準でのUTC暦日差(b - a、日単位)。時刻は無視する。
function dayDiff(a: string, b: Date): number {
  const target = new Date(a);
  const aUTC = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bUTC - aUTC) / 86400000);
}

export function getActiveRizinEventWeek(asOf: Date = new Date()): EventWeekHub | null {
  // 1. 結果投入済み(EVENT_RESULTS)のRIZIN大会を優先チェック(trailing windowのみ)。
  //    結果が入っている時点で「開催前」ではあり得ないため-3日側は見ない。
  const resultsCandidates = EVENT_RESULTS.filter((r) => {
    if (r.org !== "rizin") return false;
    const diff = dayDiff(r.date, asOf);
    return diff >= 0 && diff <= WINDOW_AFTER_DAYS;
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (resultsCandidates.length > 0) {
    const r = resultsCandidates[0];
    return { slug: r.slug, eventName: r.eventName, date: r.date, venue: r.venue, phase: "resultsReady", resultsEvent: r };
  }

  // 2. 開催予定(EVENTS)のRIZIN大会をfull window判定。
  const scheduledCandidates = EVENTS.filter((e) => {
    if (e.org !== "rizin") return false;
    const diff = dayDiff(e.date, asOf);
    return diff >= -WINDOW_BEFORE_DAYS && diff <= WINDOW_AFTER_DAYS;
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (scheduledCandidates.length > 0) {
    const e = scheduledCandidates[0];
    return { slug: e.slug, eventName: e.eventName, date: e.date, venue: e.venue, phase: "scheduled", scheduledEvent: e };
  }

  return null;
}

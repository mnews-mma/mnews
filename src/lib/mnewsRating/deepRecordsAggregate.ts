// data/deepRecords.json(DEEP公式サイトから機械取得した生の試合一覧、2024年
// 以降のみ)から、選手単位の戦績集計を導出する純関数群。設計思想は
// shootoRecordsAggregate.ts(computeFighterShootoRecord)に揃える(resultType別
// 振り分け、突合はslug完全一致のみ=捏造ゼロ)。
//
// ruleTypeによる絞り込みについて: shootoScraper.ts側と同じ事情で、DEEP公式
// ページにもbout単位の明示的なルール種別表記が無く、ruleTypeは全件"unknown"で
// 入る。DEEPにはグラップリングルール限定の undercard(例: 「DEEP JEWELS 56kg
// 以下 グラップリングルール」)が実在するが、ruleTypeで判別できないため
// 除外できない(shootoと同じ精度上の既知の限界。KICK冠のイベント単位除外は
// scripts/build-deep-records.ts側のisKickEventで行っている)。
import { DeepRecordsBout, DeepRecordsEvent } from "./deepScraper";

export interface DeepFighterBout {
  event: string;
  date: string;
  opponentName: string;
  opponentSlug: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  isWin: boolean;
  methodRaw: string;
  namedDivision: string | null;
}

export interface DeepExcludedBout {
  event: string;
  date: string;
  opponentName: string;
  reason: string;
}

export interface DeepFighterRecord {
  wins: number;
  losses: number;
  draws: number;
  ncs: number;
  bouts: DeepFighterBout[];
  excluded: DeepExcludedBout[];
}

export function computeFighterDeepRecord(events: DeepRecordsEvent[], slug: string): DeepFighterRecord {
  const bouts: DeepFighterBout[] = [];
  const excluded: DeepExcludedBout[] = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let ncs = 0;

  for (const ev of events) {
    for (const b of ev.bouts as DeepRecordsBout[]) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;

      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      const isWin = (isA && b.winnerName === b.fighterAName) || (isB && b.winnerName === b.fighterBName);

      if (b.resultType === "nc") ncs++;
      else if (b.resultType === "draw") draws++;
      else if (b.resultType === "decisive") {
        if (isWin) wins++;
        else losses++;
      }
      // cancelled/unknownは勝敗・NCいずれにも数えない。boutsには記録として残す。

      bouts.push({
        event: ev.eventName,
        date: ev.date,
        opponentName,
        opponentSlug,
        resultType: b.resultType,
        isWin,
        methodRaw: b.methodRaw,
        namedDivision: b.namedDivision,
      });
    }
  }

  bouts.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { wins, losses, draws, ncs, bouts, excluded };
}

// 指示書E(2026-07-31): rizinRecordsAggregate.tsのcountUnresolvedRizinBoutSides
// と同じ思想。選手に紐付けない、data全体のslug未解決bout側の総数。
// DEEPは修斗/パンクラス(backfill-shooto-pancrase-slugs.ts)やRIZIN
// (backfill-rizin-slugs.ts)と異なり専用のslugバックフィルスクリプトが
// 現状存在しない(絶対件数は歴史の長いパンクラスの方が多いが、これは
// バックフィル未整備が主因ではなく母数の差によるもの。scripts/
// check-null-slug-baseline.tsのBASELINE参照)。
export function countUnresolvedDeepBoutSides(events: DeepRecordsEvent[]): number {
  let count = 0;
  for (const ev of events) {
    for (const b of ev.bouts as DeepRecordsBout[]) {
      if (b.fighterASlug === null && b.fighterAName) count++;
      if (b.fighterBSlug === null && b.fighterBName) count++;
    }
  }
  return count;
}

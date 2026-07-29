// data/pancraseRecords.json(パンクラス公式アーカイブから機械取得した生の試合
// 一覧)から、選手単位の戦績集計を導出する純関数群。設計思想はrizinRecordsAggregate.ts
// の computeFighterMmaRecord() に揃える(resultType別振り分け、対象外は
// 削除ではなく理由つきでexcludedとして返す=捏造ゼロ)。突合はslug完全一致の
// みで行う(名前によるフォールバック突合は行わない)。
//
// slug解決について: data/pancraseRecords.jsonのfighterASlug/fighterBSlugは、
// scripts/backfill-shooto-pancrase-slugs.tsによるバックフィル(hidden選手も
// 含めた完全一致解決)を経た値を前提とする。
import { PancraseRecordsBout, PancraseRecordsEvent } from "./pancraseRecordsTypes";

export interface PancraseFighterBout {
  event: string;
  date: string | null;
  opponentName: string;
  opponentSlug: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  isWin: boolean;
  methodRaw: string;
  namedDivision: string | null;
}

export interface PancraseExcludedBout {
  event: string;
  date: string | null;
  opponentName: string;
  reason: string;
}

export interface PancraseFighterRecord {
  wins: number;
  losses: number;
  draws: number;
  ncs: number;
  bouts: PancraseFighterBout[];
  excluded: PancraseExcludedBout[];
}

// 集計対象に含めるルール種別。パンクラスもMMA以外(エキシビジョン・
// キックボクシング・プロレスルール・グラップリング・シュートボクシング)の
// 特別試合が実在する(実測: 4877試合中27試合)ため、rizinRecordsAggregate.ts
// と同じくMMAのみを「パンクラス(MMA)戦績」として数える。
const MMA_RULE_TYPES = new Set(["MMA"]);

export function computeFighterPancraseRecord(events: PancraseRecordsEvent[], slug: string): PancraseFighterRecord {
  const bouts: PancraseFighterBout[] = [];
  const excluded: PancraseExcludedBout[] = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let ncs = 0;

  for (const ev of events) {
    for (const b of ev.bouts as PancraseRecordsBout[]) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;

      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      if (!MMA_RULE_TYPES.has(b.ruleType)) {
        excluded.push({
          event: ev.eventName,
          date: ev.date,
          opponentName,
          reason: `ルール種別がMMA以外(${b.ruleType})`,
        });
        continue;
      }

      // 勝者判定はwinnerSlugではなくwinnerName(常にfighterAName/fighterBName
      // いずれかの文字列そのもの、decisiveでなければnull)との文字列一致で行う。
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

  bouts.sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));
  return { wins, losses, draws, ncs, bouts, excluded };
}

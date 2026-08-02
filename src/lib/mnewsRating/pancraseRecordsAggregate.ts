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
import { classifyMmaRuleType, buildRuleTypeHaystack, nonMmaRuleExcludedReason } from "./nonProBoutFilter";

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
// 特別試合が実在する(実測: 4877試合中27〜28件)ため、rizinRecordsAggregate.ts
// と同じくMMAのみを「パンクラス(MMA)戦績」として数える。
//
// b.ruleType(スクレイプ時にbuild-pancrase-records.tsのresolveRuleType()が
// 計算し保存した値)は信用せず、headingText/namedDivisionから毎回
// classifyMmaRuleType()で判定し直す(PR #369)。パンクラスはheadingTextが
// data/pancraseRecords.jsonに保存されているため、ruleType判定パターンが
// 将来更新されても再スクレイプ不要でその場で反映される(RIZINはruleLineRaw
// 自体が保存されないため、この方式は取れない)。

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

      // "unknown"(headingTextが空)は除外しない。実測(パンクラスは0件・修斗は
      // 1件・DEEPは295件)で、DEEPには単にヘッダー抽出ができていないだけの
      // 正当なMMA戦(slug解決済み112件)が多数含まれることを確認済みのため、
      // 「ルール情報が無い」ことを「非MMA」の根拠にはしない(捏造ゼロの原則。
      // deepRecordsAggregate.ts・shootoRecordsAggregate.tsも同じ判定式)。
      const ruleType = classifyMmaRuleType(buildRuleTypeHaystack(b));
      if (ruleType !== "MMA" && ruleType !== "unknown") {
        excluded.push({
          event: ev.eventName,
          date: ev.date,
          opponentName,
          reason: nonMmaRuleExcludedReason(ruleType),
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

// 指示書E(2026-07-31): rizinRecordsAggregate.tsのcountUnresolvedRizinBoutSides
// と同じ思想。選手に紐付けない、data全体のslug未解決bout側の総数。
export function countUnresolvedPancraseBoutSides(events: PancraseRecordsEvent[]): number {
  let count = 0;
  for (const ev of events) {
    for (const b of ev.bouts as PancraseRecordsBout[]) {
      if (b.fighterASlug === null && b.fighterAName) count++;
      if (b.fighterBSlug === null && b.fighterBName) count++;
    }
  }
  return count;
}

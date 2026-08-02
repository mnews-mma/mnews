// data/shootoRecords.json(修斗公式サイトから機械取得した生の試合一覧)から、
// 選手単位の戦績集計を導出する純関数群。設計思想はrizinRecordsAggregate.ts
// の computeFighterMmaRecord() に揃える(resultType別振り分け、対象外は
// 削除ではなく理由つきでexcludedとして返す=捏造ゼロ)。突合はslug完全一致の
// みで行う(名前によるフォールバック突合は行わない)。
//
// ruleTypeによる絞り込みについて: shootoScraper.ts側のコメントの通り、修斗公式
// ページにはbout単位の明示的なルール種別表記フィールドが無く、スクレイプ時に
// 保存されるruleTypeは全件"unknown"で入る。
//
// 訂正(PR #369): 「修斗はキックボクシング等の異種目カードを持たない純MMA団体」
// という以前のこのコメントの前提は誤りだった。実際には新空手道連盟/CKC提供の
// キックボクシングトーナメント・COLORSブランドのグラップリングマッチ・
// 引退興行のエキシビジョンマッチ等が本戦カードに混在しており(悉皆調査で65件
// 確認)、ruleTypeでの絞り込みが無かったため無条件でMMA戦績に算入されていた
// (影響選手7名、out/non-mma-rule-contamination-audit.md参照)。headingText/
// namedDivisionにはルール原文が残っているため、下記computeFighterShootoRecord()
// で毎回classifyMmaRuleType()に通して判定する。ただし"unknown"(headingTextが
// 空)は除外しない(実測1件のみで影響なし。pancraseRecordsAggregate.ts参照)。
//
// slug解決について: data/shootoRecords.jsonのfighterASlug/fighterBSlugは、
// scripts/backfill-shooto-pancrase-slugs.tsによるバックフィル(hidden選手も
// 含めた完全一致解決)を経た値を前提とする。
import { ShootoRecordsBout, ShootoRecordsEvent } from "./shootoScraper";
import { classifyMmaRuleType, buildRuleTypeHaystack, nonMmaRuleExcludedReason } from "./nonProBoutFilter";

export interface ShootoFighterBout {
  event: string;
  date: string;
  opponentName: string;
  opponentSlug: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  isWin: boolean;
  methodRaw: string;
  namedDivision: string | null;
}

export interface ShootoExcludedBout {
  event: string;
  date: string;
  opponentName: string;
  reason: string;
}

export interface ShootoFighterRecord {
  wins: number;
  losses: number;
  draws: number;
  ncs: number;
  bouts: ShootoFighterBout[];
  excluded: ShootoExcludedBout[];
}

export function computeFighterShootoRecord(events: ShootoRecordsEvent[], slug: string): ShootoFighterRecord {
  const bouts: ShootoFighterBout[] = [];
  const excluded: ShootoExcludedBout[] = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let ncs = 0;

  for (const ev of events) {
    for (const b of ev.bouts as ShootoRecordsBout[]) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;

      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      // "unknown"(headingTextが空)は除外しない(ファイル冒頭コメント参照)。
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
export function countUnresolvedShootoBoutSides(events: ShootoRecordsEvent[]): number {
  let count = 0;
  for (const ev of events) {
    for (const b of ev.bouts) {
      if (b.fighterASlug === null && b.fighterAName) count++;
      if (b.fighterBSlug === null && b.fighterBName) count++;
    }
  }
  return count;
}

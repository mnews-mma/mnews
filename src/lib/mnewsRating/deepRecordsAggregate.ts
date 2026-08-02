// data/deepRecords.json(DEEP公式サイトから機械取得した生の試合一覧、2024年
// 以降のみ)から、選手単位の戦績集計を導出する純関数群。設計思想は
// shootoRecordsAggregate.ts(computeFighterShootoRecord)に揃える(resultType別
// 振り分け、突合はslug完全一致のみ=捏造ゼロ)。
//
// ruleTypeによる絞り込みについて: DEEP公式ページにはbout単位の明示的なルール
// 種別表記フィールドが無く、スクレイプ時に保存されるruleTypeは全件"unknown"で
// 入る。ただしheadingText/namedDivisionにはルール原文がそのまま残っているため
// (例:「DEEP JEWELS 56kg以下 グラップリングルール」「DEEP 90kg以下
// キックルール 3分3R」)、下記computeFighterDeepRecord()で毎回
// classifyMmaRuleType()に通して判定する(PR #369)。
//
// イベントタイトル単位の"KICK"冠除外(scripts/build-deep-records.tsの
// isKickEvent)は、全カードがキックボクシングの大会をそもそもスクレイプ対象
// から外す別の仕組みで、この関数のbout単位フィルタとは独立している。
// isKickEventだけでは「大会タイトルはMMA本戦だが一部undercardのみ非MMAルール」
// という混在カードを捕捉できない(実例: DEEP HAMAMATSU IMPACT 2023、全15試合中
// 9試合がキックボクシングundercard)。
import { DeepRecordsBout, DeepRecordsEvent } from "./deepScraper";
import { classifyMmaRuleType, buildRuleTypeHaystack, nonMmaRuleExcludedReason } from "./nonProBoutFilter";

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
//
// 訂正(指示書I・2026-07-31): PR #300時点でこのコメントに「DEEPには専用の
// slugバックフィルスクリプトが存在しない」と書いていたが誤り。
// scripts/backfill-shooto-pancrase-slugs.tsは2026-07-29時点で既に
// deepRecords.jsonもTARGET_FILESに含めている。ただし実行履歴
// (git log -- data/deepRecords.json)にバックフィル起因のコミットが
// 一度も無く、コード追加後に実際は一度も実行されていなかった
// (#301のalias追加を受けて指示書Iで初めて実行・確認)。
// 絶対件数は歴史の長いパンクラスの方が多いが、これは母数の差による。
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

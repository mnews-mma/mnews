// RIZIN・修斗・パンクラス・DEEPの4団体公式データ(data/rizinRecords.json・
// data/shootoRecords.json・data/pancraseRecords.json・data/deepRecords.json)を
// 合算した選手戦績(選手プロフィールページ「2行目」表示用)を薄くラップする。
//
// 集計元はこの4ファイルのみ。src/lib/fighters.tsのwins/losses/history
// フィールド(PR #252が投入した値)は一切参照しない(#252投入値は#258の
// 調査でドロー誤判定由来の誤りが見つかっており信頼できないため、必ず
// data/配下の生データから毎回再集計する)。
//
// 選手とboutの突合はslug完全一致のみで行う(名前によるフォールバック突合は
// 行わない)。data/shootoRecords.json・data/pancraseRecords.json・
// data/deepRecords.jsonのfighterASlug/fighterBSlugは、
// scripts/backfill-shooto-pancrase-slugs.tsによるバックフィル(hidden選手も
// 含めた完全一致解決)を経た値を前提とする。
//
// 各団体の集計本体(resultType別振り分け・ルール種別フィルタ)は
// rizinRecordsAggregate.ts(既存のcomputeFighterMmaRecordをそのまま使う)・
// shootoRecordsAggregate.ts・pancraseRecordsAggregate.ts・
// deepRecordsAggregate.tsにある。このファイルは4団体の結果を合算するだけ。
//
// DEEPはDEEP公式 /result/ の全期間が対象(scripts/build-deep-records.ts参照)。
// トーナメント優勝者サマリーのみのページ(F7)・本文が空のページ(F11)・
// アマチュア大会は個別対戦結果を投入できないため除外している
// (out/deep-format-variants-full-221.md・out/deep-records-data-ingest-report.md
// 参照)。
import { RizinRecordsEvent } from "./rizinScraper";
import { computeFighterMmaRecord } from "./rizinRecordsAggregate";
import { ShootoRecordsEvent } from "./shootoScraper";
import { computeFighterShootoRecord } from "./shootoRecordsAggregate";
import { PancraseRecordsEvent } from "./pancraseRecordsTypes";
import { computeFighterPancraseRecord } from "./pancraseRecordsAggregate";
import { DeepRecordsEvent } from "./deepScraper";
import { computeFighterDeepRecord } from "./deepRecordsAggregate";
import { normalizeFinishText } from "../finishTextNormalize";

// 表示ラベル用の固定表記(実装済み4団体を列挙。並び順は確定済み:
// RIZIN・DEEP・パンクラス・修斗、2026-07-30ユーザー指定)。
export const MULTI_ORG_RECORD_LABEL = "RIZIN・DEEP・パンクラス・修斗 通算";

export interface MultiOrgRecord {
  wins: number;
  losses: number;
  draws: number;
  // 集計に使った団体のうち、この選手について1件以上boutが見つかった団体
  // (表示には使わず、検証・デバッグ用の内訳として残す)。
  orgsWithBouts: string[];
}

export function computeMultiOrgRecord(
  slug: string,
  data: {
    rizinEvents: RizinRecordsEvent[];
    shootoEvents: ShootoRecordsEvent[];
    pancraseEvents: PancraseRecordsEvent[];
    deepEvents: DeepRecordsEvent[];
  }
): MultiOrgRecord {
  const rizin = computeFighterMmaRecord(data.rizinEvents, slug);
  const shooto = computeFighterShootoRecord(data.shootoEvents, slug);
  const pancrase = computeFighterPancraseRecord(data.pancraseEvents, slug);
  const deep = computeFighterDeepRecord(data.deepEvents, slug);

  const orgsWithBouts: string[] = [];
  if (rizin.bouts.length > 0 || rizin.excluded.length > 0) orgsWithBouts.push("RIZIN");
  if (deep.bouts.length > 0 || deep.excluded.length > 0) orgsWithBouts.push("DEEP");
  if (pancrase.bouts.length > 0 || pancrase.excluded.length > 0) orgsWithBouts.push("パンクラス");
  if (shooto.bouts.length > 0 || shooto.excluded.length > 0) orgsWithBouts.push("修斗");

  return {
    wins: rizin.wins + shooto.wins + pancrase.wins + deep.wins,
    losses: rizin.losses + shooto.losses + pancrase.losses + deep.losses,
    draws: rizin.draws + shooto.draws + pancrase.draws + deep.draws,
    orgsWithBouts,
  };
}

// Wikipedia記事が無い選手(noRecordData)向けの対戦テーブル用。上と同じ3団体の
// bouts(集計対象=MMAルール戦のみ、ルール種別対象外はこの時点で除外済み)を
// 日付降順にマージして返す。resultTypeの扱いはcomputeMultiOrgRecord(2行目集計)
// と揃える: decisive→win/loss、draw→draw、nc→nc(無効。既存の対戦テーブルの
// "無効"表示と同じ)。cancelled/unknownは2行目の勝敗・NC集計に数えないのと同様、
// この対戦テーブルにも出さない(相当する表示区分が既存テーブルに無いため)。
export interface MultiOrgBoutRow {
  date: string;
  opponentName: string;
  opponentSlug: string | null;
  result: "win" | "loss" | "draw" | "nc";
  method: string;
  event: string;
}

function toBoutRow(b: {
  event: string;
  date: string | null;
  opponentName: string;
  opponentSlug: string | null;
  resultType: string;
  isWin: boolean;
  methodRaw: string;
}): MultiOrgBoutRow | null {
  if (!b.date) return null; // 日付未確定の試合(実測: パンクラス418大会中2件)は出さない
  let result: MultiOrgBoutRow["result"];
  if (b.resultType === "decisive") result = b.isWin ? "win" : "loss";
  else if (b.resultType === "draw") result = "draw";
  else if (b.resultType === "nc") result = "nc";
  else return null; // cancelled/unknown
  return {
    date: b.date,
    opponentName: b.opponentName,
    opponentSlug: b.opponentSlug,
    result,
    method: normalizeFinishText(b.methodRaw),
    event: b.event,
  };
}

export function computeMultiOrgBoutTable(
  slug: string,
  data: {
    rizinEvents: RizinRecordsEvent[];
    shootoEvents: ShootoRecordsEvent[];
    pancraseEvents: PancraseRecordsEvent[];
    deepEvents: DeepRecordsEvent[];
  }
): MultiOrgBoutRow[] {
  const rizin = computeFighterMmaRecord(data.rizinEvents, slug);
  const shooto = computeFighterShootoRecord(data.shootoEvents, slug);
  const pancrase = computeFighterPancraseRecord(data.pancraseEvents, slug);
  const deep = computeFighterDeepRecord(data.deepEvents, slug);

  const rows = [...rizin.bouts, ...deep.bouts, ...shooto.bouts, ...pancrase.bouts]
    .map(toBoutRow)
    .filter((r): r is MultiOrgBoutRow => r !== null);

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

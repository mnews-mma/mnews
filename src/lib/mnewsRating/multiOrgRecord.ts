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
import { tallyMethods } from "../methodClassify";
import { FighterRecordEntry } from "../fighterRecordsCache";

// 表示ラベル用の固定表記(実装済み4団体を列挙。並び順は確定済み:
// RIZIN・DEEP・パンクラス・修斗、2026-07-30ユーザー指定)。
export const MULTI_ORG_RECORD_LABEL = "RIZIN・DEEP・パンクラス・修斗 通算";
// 対戦カード(EventBoutCardV2)のバッジ用短縮表記。カード内は余白が限られるため
// MULTI_ORG_RECORD_LABELより短い表記を別途持つ(指示書指定の文言)。
export const MULTI_ORG_RECORD_LABEL_SHORT = "4団体通算";

export interface MultiOrgRecord {
  wins: number;
  losses: number;
  draws: number;
  // 集計に使った団体のうち、この選手について1件以上boutが見つかった団体
  // (表示には使わず、検証・デバッグ用の内訳として残す)。
  orgsWithBouts: string[];
}

// 4団体合算で1件でも試合が見つかっているか(wins/losses/draws合計>0)。
// fighters/[slug]/page.tsxは同等のチェックをインラインで持つ(既存箇所は変更しない
// 方針のためこの関数への置き換えはしていない)。対戦カード側の新規呼び出し元
// (EventBoutCardV2)から使う。
export function hasMultiOrgRecord(record: MultiOrgRecord): boolean {
  return record.wins > 0 || record.losses > 0 || record.draws > 0;
}

// EventBoutCardV2が選手片側ぶんの4団体合算データをまとめて受け取るための型
// (record=勝敗・rates=KO/一本/判定+勝率/フィニッシュ率・rows=対戦テーブル行)。
export interface MultiOrgSideRecord {
  record: MultiOrgRecord;
  rates: MultiOrgRates;
  rows: MultiOrgBoutRow[];
}

// computeMultiOrgRecord/computeMultiOrgBoutTableのdata引数と同じ形。
// 呼び出し側(events/[slug]/page.tsx等)がfetch結果をローカル変数に保持する際の
// 型注釈用にexportする(関数シグネチャ自体は変更しない)。
export interface MultiOrgSourceData {
  rizinEvents: RizinRecordsEvent[];
  shootoEvents: ShootoRecordsEvent[];
  pancraseEvents: PancraseRecordsEvent[];
  deepEvents: DeepRecordsEvent[];
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

// 指示書A(2026-08-01): 4団体集計側(2行目)にもWikipedia由来(1行目)と同じ
// KO/一本/判定の内訳・勝率・フィニッシュ率を出す。分類はclassifyMethodJa
// (tallyMethods経由)を使い、Wikipedia側(calcFighterRates)と同一の判定基準に
// 揃える。methodテキストはcomputeMultiOrgBoutTable()が返す時点で既に
// normalizeFinishText(PR #303)を通過済みのものを使う(呼び出し側で別途
// 正規化する必要はない)。
export interface MultiOrgRates {
  ko: number;
  sub: number;
  decision: number;
  winRate: number | null;
  finishRate: number | null;
}

export function computeMultiOrgRates(record: MultiOrgRecord, rows: MultiOrgBoutRow[]): MultiOrgRates {
  const winRows = rows.filter((r) => r.result === "win");
  const { ko, sub, decision } = tallyMethods(winRows);
  const decided = record.wins + record.losses;
  const winRate = decided > 0 ? Math.round((record.wins / decided) * 100) : null;
  const finishRate = record.wins > 0 ? Math.round(((ko + sub) / record.wins) * 100) : null;
  return { ko, sub, decision, winRate, finishRate };
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

// 1行目(Wikipedia/静的シード由来)の戦績を信頼せず、4団体合算に差し替えるべきか
// の判定。fighters/[slug]/page.tsxのスタットカード2行目抑制(suppressNoRecordRow・
// limitedSourceRow1Exceeded、指示書R-2)と同一条件をここに集約し、単一の戦績数値を
// 出す他の消費箇所(次戦カード・一覧カード等)からも同じ判定を使えるようにする。
// - noRecordData: 1行目の戦績データ自体が無い(常に差し替え対象)。
// - needsReview: 1行目はfighters.tsへの直書き(PR #252等)で、未レビューの暫定値。
//   4団体合算に1件でも試合があれば常に差し替える(「多いほうを採る」ヒューリスティックは
//   使わない。直書き側の試合数が多いという理由だけで、除外基準の変更やパーサ修正が
//   永遠に反映されない状態になっていたため=杉本恵の事例、指示書「直書き選手横断監査」
//   2026-08-02)。ただし live===true(Wikipedia解決成功)の場合はこの限りではない
//   (指示書「SARAMI Wikipedia戦績抑制」2026-08-03): mergeFighterRecord()は
//   fighters.ts直書きのneedsReviewフラグをクリアせずWikipedia側の値で
//   wins/losses/historyだけを上書きするため、1行目が既に信頼できるWikipedia値に
//   更新された後もneedsReviewだけが古いまま残るケースがある(SARAMI等14名で実測)。
//   liveフラグ自体がWikipedia解決成功の一次情報(hasWikipediaRecord参照)なので、
//   これが立っていればneedsReviewの「直書き値だから信頼しない」という前提が
//   もはや成立しない。
// - recordFromResults: 1行目は常に0(EVENT_RESULTSから動的生成する設計のスタブ)なので、
//   従来通り総試合数比較でも実質的に同じ結果になる。変更不要。
export function shouldPreferMultiOrgRecord(
  fighter: { needsReview?: boolean; recordFromResults?: boolean; noRecordData?: boolean; live?: boolean },
  rowOneWins: number,
  rowOneLosses: number,
  rowOneDraws: number,
  record: MultiOrgRecord
): boolean {
  if (fighter.noRecordData) return true;
  if (fighter.needsReview && !fighter.live) return record.wins + record.losses + record.draws > 0;
  if (!fighter.recordFromResults) return false;
  return record.wins + record.losses + record.draws > rowOneWins + rowOneLosses + rowOneDraws;
}

// fighter(FighterRecordEntry互換)のwins/losses/draws/ko/sub/decision/historyを
// 4団体合算(record/rates/rows)で置き換えたオブジェクトを返す。新規の数値生成は
// しない(computeMultiOrgRecord/Rates/BoutTableの結果をそのまま転記するのみ)。
// historyの各行はMultiOrgBoutRow(opponentName)をFightRecord互換(opponent)に
// 詰め替えるだけで、roundは4団体合算側に個別フィールドが無いため空文字にする
// (round表示箇所は無いため実害なし)。
export function withMultiOrgRecord<T extends FighterRecordEntry>(
  fighter: T,
  record: MultiOrgRecord,
  rates: MultiOrgRates,
  rows: MultiOrgBoutRow[]
): T {
  return {
    ...fighter,
    wins: record.wins,
    losses: record.losses,
    draws: record.draws,
    ko: rates.ko,
    sub: rates.sub,
    decision: rates.decision,
    history: rows.map((r) => ({
      date: r.date,
      opponent: r.opponentName,
      result: r.result,
      method: r.method,
      event: r.event,
      round: "",
    })),
    // 差し替え後は実際の数値がある状態なので「データなし」扱いを解除する
    // (noRecordData由来の差し替えでも、needsReview/recordFromResults由来の
    // 差し替えでも同じ)。
    noRecordData: false,
  };
}

// shouldPreferMultiOrgRecord + withMultiOrgRecordをまとめたヘルパー。呼び出し側が
// 4団体ソースデータ(rizin/shooto/pancrase/deep)を既に取得済みの場合に使う
// (次戦カード・同階級選手カード・/fighters一覧などcomputeMultiOrgRecord呼び出し元が
// 複数箇所に分散しないようにする)。差し替え不要、または差し替え先も0件
// (合算データ自体が無い。捏造しない)の場合は元のfighterをそのまま返す。
export function resolveDisplayRecord<T extends FighterRecordEntry & { slug: string }>(
  fighter: T,
  data: MultiOrgSourceData
): T {
  const record = computeMultiOrgRecord(fighter.slug, data);
  if (!shouldPreferMultiOrgRecord(fighter, fighter.wins, fighter.losses, fighter.draws, record)) return fighter;
  if (record.wins === 0 && record.losses === 0 && record.draws === 0) return fighter;
  const rows = computeMultiOrgBoutTable(fighter.slug, data);
  const rates = computeMultiOrgRates(record, rows);
  return withMultiOrgRecord(fighter, record, rates, rows);
}

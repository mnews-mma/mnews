// 選手ページのヘッダー戦績(通算試合数)と対戦テーブルの行数が食い違う選手の悉皆調査。
// 読み取り専用(data/・src配下への書き込みは一切行わない)。
//
// 背景: src/app/fighters/[slug]/page.tsx は「ヘッダー」と「対戦テーブル」を
// 別々のロジックで独立に計算している。
//  - ヘッダー(通算試合数として表示される数値)は、suppressNoRecordRow が true の
//    ときは 2行目(RIZIN・DEEP・パンクラス・修斗 4団体合算 = multiOrgRecord)、
//    false のときは 1行目(data/fighterRecords.json の wins/losses/draws)。
//  - 対戦テーブルは history.length > 0 ならその history をそのまま使い、
//    4団体合算(multiOrgBoutRows)へは絶対にフォールバックしない
//    (page.tsx:353-372 の displayHistory 分岐)。
// この2つは別データソース・別条件分岐のため、一致する保証がどこにも無い。
//
// 実行: npx tsx scripts/investigate-header-table-row-mismatch.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { FighterRecordEntry, FighterRecordsFile, mergeFighterRecord } from "../src/lib/fighterRecordsCache";
import { computeMultiOrgRecord, computeMultiOrgBoutTable } from "../src/lib/mnewsRating/multiOrgRecord";
import { SHOW_MULTI_ORG_RECORD } from "../src/lib/featureFlags";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

function readLocalJson<T>(file: string): T {
  const p = path.join(process.cwd(), "data", file);
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

async function main() {
  // 本番と同じ判定ロジックにするため page.tsx / multiOrgRecordsData.ts と同じ
  // 生データを使う。ネットワーク取得(GitHub raw)には依存させず、リポジトリ同梱の
  // data/配下(このworktreeはorigin/main分岐直後でmainと一致)をローカルで読む。
  const fighterRecords = readLocalJson<FighterRecordsFile>("fighterRecords.json");
  const rizinEvents = readLocalJson<RizinRecordsEvent[]>("rizinRecords.json");
  const shootoArchive = readLocalJson<ShootoRecordsEvent[]>("shootoRecords.json");
  let shootoProfile: ShootoRecordsEvent[] = [];
  try {
    shootoProfile = readLocalJson<ShootoRecordsEvent[]>("shootoProfileBouts.json");
  } catch {
    /* R-8投入前は未生成の可能性があるため無くても続行する */
  }
  const shootoEvents = [...shootoArchive, ...shootoProfile];
  const pancraseEvents = readLocalJson<PancraseRecordsEvent[]>("pancraseRecords.json");
  const deepEvents = readLocalJson<DeepRecordsEvent[]>("deepRecords.json");
  const multiOrgData = { rizinEvents, shootoEvents, pancraseEvents, deepEvents };

  type Row = {
    slug: string;
    nameJa: string;
    hidden: boolean;
    needsReview: boolean;
    recordFromResults: boolean;
    noRecordData: boolean;
    row1Total: number;
    multiOrgTotal: number;
    suppressNoRecordRow: boolean;
    headerTotal: number;
    headerSource: "row1(wikipedia)" | "row2(multiOrg)";
    historyLen: number;
    multiOrgBoutLen: number;
    tableTotal: number;
    tableSource: "history(wikipedia)" | "multiOrgBoutTable" | "empty";
  };

  const rows: Row[] = [];

  for (const seed of FIGHTERS as Fighter[]) {
    const resolved = mergeFighterRecord(seed, fighterRecords);
    const { wins, losses, draws, history, noRecordData } = resolved;
    const row1Total = wins + losses + draws;

    const multiOrgRecord = computeMultiOrgRecord(seed.slug, multiOrgData);
    const multiOrgTotal = multiOrgRecord.wins + multiOrgRecord.losses + multiOrgRecord.draws;
    const hasMultiOrgRecord = multiOrgTotal > 0;

    const limitedSourceRow1Exceeded =
      !!(seed.needsReview || seed.recordFromResults) && multiOrgTotal > row1Total;
    const suppressNoRecordRow =
      !!(noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;

    // ヘッダーとして「最初に目に入る総試合数」。両方非表示(通算戦績データなし かつ
    // 4団体合算も0件)の選手は比較対象外としてスキップする。
    if (noRecordData && !hasMultiOrgRecord) continue;

    const headerTotal = suppressNoRecordRow ? multiOrgTotal : row1Total;
    const headerSource: Row["headerSource"] = suppressNoRecordRow ? "row2(multiOrg)" : "row1(wikipedia)";

    const multiOrgBoutLen = SHOW_MULTI_ORG_RECORD ? computeMultiOrgBoutTable(seed.slug, multiOrgData).length : 0;
    const tableTotal = history.length > 0 ? history.length : multiOrgBoutLen;
    const tableSource: Row["tableSource"] =
      history.length > 0 ? "history(wikipedia)" : multiOrgBoutLen > 0 ? "multiOrgBoutTable" : "empty";

    rows.push({
      slug: seed.slug,
      nameJa: seed.nameJa,
      hidden: !!seed.hidden,
      needsReview: !!seed.needsReview,
      recordFromResults: !!seed.recordFromResults,
      noRecordData: !!noRecordData,
      row1Total,
      multiOrgTotal,
      suppressNoRecordRow,
      headerTotal,
      headerSource,
      historyLen: history.length,
      multiOrgBoutLen,
      tableTotal,
      tableSource,
    });
  }

  const mismatches = rows.filter((r) => r.headerTotal !== r.tableTotal);

  // 原因パターン分類:
  // A: ヘッダーが2行目(multiOrg)なのにテーブルはhistory(1行目相当)のまま
  //    (ユーザー報告のtamura-hibikiと同型。history.length>0かつsuppress中)
  // B: ヘッダーが1行目(wikipedia)なのにテーブル行数(history.length)と数が違う
  //    (同一batch内でwins/losses/draws合計とhistory配列長がズレている)
  // C: ヘッダーが2行目でテーブルもmultiOrgBoutTableだが件数が違う
  //    (multiOrgRecordとmultiOrgBoutTableの集計元が食い違っている=実装バグの可能性)
  const patternA = mismatches.filter((r) => r.suppressNoRecordRow && r.historyLen > 0);
  const patternB = mismatches.filter((r) => !r.suppressNoRecordRow);
  const patternC = mismatches.filter(
    (r) => r.suppressNoRecordRow && r.historyLen === 0 && r.tableSource === "multiOrgBoutTable"
  );
  const patternOther = mismatches.filter(
    (r) => !patternA.includes(r) && !patternB.includes(r) && !patternC.includes(r)
  );

  console.log(`調査対象選手数(通算戦績が何らか表示される選手): ${rows.length}`);
  console.log(`ヘッダー総試合数 ≠ テーブル行数: ${mismatches.length}件`);
  console.log(`  うち hidden: ${mismatches.filter((r) => r.hidden).length}件`);
  console.log(`  パターンA(ヘッダー=2行目multiOrg / テーブル=historyのまま): ${patternA.length}件`);
  console.log(`  パターンB(ヘッダー=1行目wikipedia / history.lengthと不一致): ${patternB.length}件`);
  console.log(`  パターンC(ヘッダー=2行目multiOrg / テーブルもmultiOrgBoutTableだが件数不一致): ${patternC.length}件`);
  console.log(`  パターンその他: ${patternOther.length}件`);

  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });

  const csvHeader = [
    "slug",
    "nameJa",
    "hidden",
    "needsReview",
    "recordFromResults",
    "headerSource",
    "headerTotal",
    "tableSource",
    "tableTotal",
    "row1Total(wikipedia)",
    "multiOrgTotal",
    "historyLen",
    "multiOrgBoutLen",
    "pattern",
  ].join(",");
  const patternOf = (r: Row) =>
    patternA.includes(r) ? "A" : patternB.includes(r) ? "B" : patternC.includes(r) ? "C" : "other";
  const csvLines = mismatches
    .sort((a, b) => b.headerTotal - b.tableTotal - (a.headerTotal - a.tableTotal))
    .map((r) =>
      [
        r.slug,
        `"${r.nameJa}"`,
        r.hidden,
        r.needsReview,
        r.recordFromResults,
        r.headerSource,
        r.headerTotal,
        r.tableSource,
        r.tableTotal,
        r.row1Total,
        r.multiOrgTotal,
        r.historyLen,
        r.multiOrgBoutLen,
        patternOf(r),
      ].join(",")
    );
  fs.writeFileSync(path.join(outDir, "header-table-row-mismatch.csv"), [csvHeader, ...csvLines].join("\n") + "\n");

  console.log(`\n詳細一覧: out/header-table-row-mismatch.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

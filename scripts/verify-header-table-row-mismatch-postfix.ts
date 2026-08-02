// PR #359(investigate/header-table-row-mismatch)の悉皆調査スクリプトを、
// 指示書R-9の修正(page.tsx displayHistoryをsuppressNoRecordRow基準に統一)後の
// 状態で再実行し、A型34件・C型5件の不一致がどう変化したかを検証する。
// 読み取り専用(data/・src配下への書き込みは一切行わない)。
//
// 修正内容: displayHistoryは、suppressNoRecordRow(ヘッダーが2行目=4団体合算を
// 表示中)ならテーブルも常にmultiOrgBoutRowsを使う。それ以外は従来どおり
// history優先(無ければ4団体boutにフォールバック)。B型(38件、Wikipedia側の
// NC由来カウント差)はこの分岐を通らないため無変更のはず。
//
// 実行: npx tsx scripts/verify-header-table-row-mismatch-postfix.ts
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

    // 修正後のpage.tsx displayHistory分岐を再現(指示書R-9): suppressNoRecordRow中は
    // ヘッダーと同じmultiOrgBoutRowsをテーブルにも使う。
    const multiOrgBoutLen = SHOW_MULTI_ORG_RECORD ? computeMultiOrgBoutTable(seed.slug, multiOrgData).length : 0;
    const tableTotal = suppressNoRecordRow
      ? multiOrgBoutLen
      : history.length > 0
        ? history.length
        : multiOrgBoutLen;
    const tableSource: Row["tableSource"] = suppressNoRecordRow
      ? multiOrgBoutLen > 0
        ? "multiOrgBoutTable"
        : "empty"
      : history.length > 0
        ? "history(wikipedia)"
        : multiOrgBoutLen > 0
          ? "multiOrgBoutTable"
          : "empty";

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

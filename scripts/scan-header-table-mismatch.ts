// 指示書L: 選手ページのヘッダー(通算戦績スタットカード)と対戦テーブルの
// 表示件数・内訳が食い違うケースを全365名で走査する。read-only(data/・
// コードは一切書き換えない)。
//
// src/app/fighters/[slug]/page.tsxの実装(displayHistory選択ロジック、
// suppressNoRecordRow判定)をそのまま再現する。1行目(Wikipedia通算)側は
// fighter.wins/losses/draws vs fighter.history、2行目(4団体合算)側は
// multiOrgRecord vs computeMultiOrgBoutTable()の結果を突き合わせる。
//
// 実行: npx tsx scripts/scan-header-table-mismatch.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { mergeFighterRecord, FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import {
  computeMultiOrgRecord,
  computeMultiOrgBoutTable,
  shouldPreferMultiOrgRecord,
  MultiOrgSourceData,
} from "../src/lib/mnewsRating/multiOrgRecord";
import { SHOW_MULTI_ORG_RECORD } from "../src/lib/featureFlags";

function main() {
  const records: FighterRecordsFile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "fighterRecords.json"), "utf8"));
  const rizinEvents = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "rizinRecords.json"), "utf8"));
  const shootoArchive = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8"));
  const shootoProfile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoProfileBouts.json"), "utf8"));
  const pancraseEvents = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "pancraseRecords.json"), "utf8"));
  const deepEvents = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "deepRecords.json"), "utf8"));
  const multiOrgData: MultiOrgSourceData = {
    rizinEvents,
    shootoEvents: [...shootoArchive, ...shootoProfile],
    pancraseEvents,
    deepEvents,
  };

  interface Result {
    slug: string;
    nameJa: string;
    org: string;
    row: "1行目" | "2行目";
    headerTotal: number;
    headerWLD: string;
    tableRowCount: number;
    tableWLD: string;
    countDiff: number; // tableRowCount - headerTotal
    breakdownMismatch: boolean; // 件数は一致するが内訳(勝/敗/分)が違う
    pattern: "table_fewer" | "table_more" | "table_more_nc_explained" | "content_differs";
    tableOtherCount: number;
  }

  const results: Result[] = [];

  for (const f of FIGHTERS) {
    const fighter = mergeFighterRecord(f, records);
    const { wins, losses, draws, history, noRecordData } = fighter;

    const multiOrgRecord = computeMultiOrgRecord(f.slug, multiOrgData);
    const hasMultiOrgRecord = multiOrgRecord.wins > 0 || multiOrgRecord.losses > 0 || multiOrgRecord.draws > 0;
    const limitedSourceRow1Exceeded = shouldPreferMultiOrgRecord(
      fighter as any,
      wins,
      losses,
      draws,
      multiOrgRecord
    );
    const suppressNoRecordRow = (noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;

    let headerTotal: number;
    let headerW: number, headerL: number, headerD: number;
    let tableRowCount: number;
    let tableW: number, tableL: number, tableD: number;
    let row: "1行目" | "2行目";

    if (suppressNoRecordRow) {
      row = "2行目";
      headerW = multiOrgRecord.wins;
      headerL = multiOrgRecord.losses;
      headerD = multiOrgRecord.draws;
      headerTotal = headerW + headerL + headerD;
      const rows = computeMultiOrgBoutTable(f.slug, multiOrgData);
      tableRowCount = rows.length;
      tableW = rows.filter((r) => r.result === "win").length;
      tableL = rows.filter((r) => r.result === "loss").length;
      tableD = rows.filter((r) => r.result === "draw").length;
    } else {
      row = "1行目";
      headerW = wins;
      headerL = losses;
      headerD = draws;
      headerTotal = headerW + headerL + headerD;
      if (history && history.length > 0) {
        tableRowCount = history.length;
        tableW = history.filter((h: any) => h.result === "win").length;
        tableL = history.filter((h: any) => h.result === "loss").length;
        tableD = history.filter((h: any) => h.result === "draw").length;
      } else if (SHOW_MULTI_ORG_RECORD) {
        const rows = computeMultiOrgBoutTable(f.slug, multiOrgData);
        tableRowCount = rows.length;
        tableW = rows.filter((r) => r.result === "win").length;
        tableL = rows.filter((r) => r.result === "loss").length;
        tableD = rows.filter((r) => r.result === "draw").length;
      } else {
        tableRowCount = 0;
        tableW = tableL = tableD = 0;
      }
    }

    const countDiff = tableRowCount - headerTotal;
    const breakdownMismatch = countDiff === 0 && (headerW !== tableW || headerL !== tableL || headerD !== tableD);

    if (countDiff === 0 && !breakdownMismatch) continue; // 完全一致、対象外

    // table_more側で、増分がちょうど「勝敗分以外(nc等)」の行数と一致するかを見る。
    // 一致すればヘッダー集計(勝敗分のみ)とテーブル(nc等も含む全履歴)の設計上の
    // 差である可能性が高く、Wikipedia側の内部矛盾(historyReconciles失敗)とは
    // 別の性質として区別する。
    const tableOtherCount = tableRowCount - tableW - tableL - tableD;
    const explainedByNonDecisive = countDiff > 0 && countDiff === tableOtherCount;

    const pattern: Result["pattern"] = breakdownMismatch
      ? "content_differs"
      : countDiff < 0
        ? "table_fewer"
        : explainedByNonDecisive
          ? "table_more_nc_explained"
          : "table_more";

    results.push({
      slug: f.slug,
      nameJa: f.nameJa,
      org: f.org,
      row,
      headerTotal,
      headerWLD: `${headerW}-${headerL}-${headerD}`,
      tableRowCount,
      tableWLD: `${tableW}-${tableL}-${tableD}`,
      countDiff,
      breakdownMismatch,
      pattern,
      tableOtherCount,
    });
  }

  // 影響が目に見える順(headerTotalとtableRowCountの差の絶対値が大きい順)に並べる。
  results.sort((a, b) => Math.abs(b.countDiff) - Math.abs(a.countDiff) || (b.breakdownMismatch ? 1 : 0) - (a.breakdownMismatch ? 1 : 0));

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.pattern] = (counts[r.pattern] ?? 0) + 1;
  const byRow: Record<string, number> = {};
  for (const r of results) byRow[r.row] = (byRow[r.row] ?? 0) + 1;

  console.log(`監査対象: ${FIGHTERS.length}名`);
  console.log(`食い違いあり: ${results.length}名`);
  console.log("パターン別:", JSON.stringify(counts, null, 2));
  console.log("表示行(1行目/2行目)別:", JSON.stringify(byRow, null, 2));

  console.log("\n=== 全件(影響が大きい順) ===");
  for (const r of results) {
    console.log(
      `${r.slug} (${r.nameJa}, ${r.org}, ${r.row}) header=${r.headerWLD}(${r.headerTotal}) table=${r.tableWLD}(${r.tableRowCount}) diff=${r.countDiff} pattern=${r.pattern}`
    );
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "header-table-mismatch-full-scan.json"),
    JSON.stringify({ scannedCount: FIGHTERS.length, mismatchCount: results.length, counts, byRow, results }, null, 2) + "\n"
  );
  console.log("\n書き出し: out/header-table-mismatch-full-scan.json");
}

main();

// 指示書M: 指示書Lのスキャン(scan-header-table-mismatch.ts)が
// 「合計件数の差がNC件数と一致する」ことだけで無害と判定していたため、
// 勝敗の中身が入れ替わっているのに合計だけ一致するケース(大原樹理)を
// 見逃していた。本スクリプトはbreakdownMismatchをcountDiffの値によらず
// 常にW/L/D個別比較で判定し直し、全365名を再走査する。read-only。
//
// 実行: npx tsx scripts/rescan-header-table-mismatch-strict.ts
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
    headerWLD: string;
    tableWLD: string;
    countDiff: number;
    breakdownMismatch: boolean;
    pattern: string;
  }

  const results: Result[] = [];

  for (const f of FIGHTERS) {
    const fighter = mergeFighterRecord(f, records);
    const { wins, losses, draws, history, noRecordData } = fighter;

    const multiOrgRecord = computeMultiOrgRecord(f.slug, multiOrgData);
    const hasMultiOrgRecord = multiOrgRecord.wins > 0 || multiOrgRecord.losses > 0 || multiOrgRecord.draws > 0;
    const limitedSourceRow1Exceeded = shouldPreferMultiOrgRecord(fighter as any, wins, losses, draws, multiOrgRecord);
    const suppressNoRecordRow = (noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;

    let headerW: number, headerL: number, headerD: number;
    let tableRowCount: number;
    let tableW: number, tableL: number, tableD: number;
    let row: "1行目" | "2行目";

    if (suppressNoRecordRow) {
      row = "2行目";
      headerW = multiOrgRecord.wins;
      headerL = multiOrgRecord.losses;
      headerD = multiOrgRecord.draws;
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

    const headerTotal = headerW + headerL + headerD;
    const countDiff = tableRowCount - headerTotal;
    // 修正点: countDiffが0以外でも、W/L/Dそれぞれの個別一致を常にチェックする
    const breakdownMismatch = headerW !== tableW || headerL !== tableL || headerD !== tableD;

    if (countDiff === 0 && !breakdownMismatch) continue; // 完全一致、対象外

    const tableOtherCount = tableRowCount - tableW - tableL - tableD;
    const explainedByNonDecisive = countDiff > 0 && countDiff === tableOtherCount && !breakdownMismatch;

    const pattern = breakdownMismatch
      ? "content_differs_or_swapped"
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
      headerWLD: `${headerW}-${headerL}-${headerD}`,
      tableWLD: `${tableW}-${tableL}-${tableD}`,
      countDiff,
      breakdownMismatch,
      pattern,
    });
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.pattern] = (counts[r.pattern] ?? 0) + 1;

  console.log(`監査対象: ${FIGHTERS.length}名`);
  console.log(`食い違いあり: ${results.length}名`);
  console.log("パターン別:", JSON.stringify(counts, null, 2));

  const genuine = results.filter((r) => r.breakdownMismatch);
  console.log(`\n=== breakdownMismatch=true (内訳が真に食い違う) ${genuine.length}名 ===`);
  for (const r of genuine) {
    console.log(`${r.slug} (${r.nameJa}, ${r.org}, ${r.row}) header=${r.headerWLD} table=${r.tableWLD} countDiff=${r.countDiff}`);
  }

  console.log(`\n=== table_more_nc_explained (真に無害) ${results.filter(r=>r.pattern==="table_more_nc_explained").length}名 ===`);
  for (const r of results.filter(r=>r.pattern==="table_more_nc_explained")) {
    console.log(`${r.slug} (${r.nameJa})`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "rescan-header-table-mismatch-strict.json"),
    JSON.stringify({ scannedCount: FIGHTERS.length, mismatchCount: results.length, counts, results }, null, 2) + "\n"
  );
  console.log("\n書き出し: out/rescan-header-table-mismatch-strict.json");
}

main();

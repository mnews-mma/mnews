// 指示書②(訂正版): page.tsxの実際の表示ロジック(suppressNoRecordRowによる
// 1行目→4団体合算への差し替え)を反映してチャート≠1行目を再監査する。
// v1(audit-chart-vs-row1.ts)は data/fighterRecords.json の生historyだけを見て
// おり、needsReview選手が実際には4団体合算(shootoRecords.json等)側の
// テーブルを表示していることを見落としていた(結果、mio-shiyama/erika等
// 6名を誤って「fighters.tsのhistory直書きが原因」と判定した)。
// read-only。出力はout/のみ。
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { tallyMethods, isUnknownMethod } from "../src/lib/methodClassify";
import {
  computeMultiOrgRecord,
  computeMultiOrgBoutTable,
  shouldPreferMultiOrgRecord,
  MultiOrgBoutRow,
} from "../src/lib/mnewsRating/multiOrgRecord";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

const DATA_DIR = path.join(process.cwd(), "data");
function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}
const rizinEvents = loadJson<RizinRecordsEvent[]>("rizinRecords.json");
const shootoEvents = loadJson<ShootoRecordsEvent[]>("shootoRecords.json");
const pancraseEvents = loadJson<PancraseRecordsEvent[]>("pancraseRecords.json");
const deepEvents = loadJson<DeepRecordsEvent[]>("deepRecords.json");
const multiOrgData = { rizinEvents, shootoEvents, pancraseEvents, deepEvents };

interface HistoryEntry {
  date: string;
  opponent: string;
  result: string;
  method: string;
  event: string;
}
interface FighterRecordEntry {
  wins: number;
  losses: number;
  draws: number;
  history?: HistoryEntry[];
  noRecordData?: boolean;
}
const fighterRecordsFile = loadJson<Record<string, FighterRecordEntry>>("fighterRecords.json");

interface Row {
  slug: string;
  source: "multiOrg" | "seed";
  headerWins: number;
  headerLosses: number;
  rowWins: number;
  rowLosses: number;
  chartWins: number;
  chartLosses: number;
  reason: "row-count-mismatch" | "method-text-missing" | "other";
  unknownRows: { date: string; opponent: string; event: string; result: string; method: string }[];
}

const rows: Row[] = [];

for (const f of FIGHTERS as Fighter[]) {
  const rec = fighterRecordsFile[f.slug];
  if (!rec || !rec.history || rec.history.length === 0) continue;

  const multiRecord = computeMultiOrgRecord(f.slug, multiOrgData);
  const hasMultiOrgRecord = multiRecord.wins > 0 || multiRecord.losses > 0 || multiRecord.draws > 0;
  const prefersMultiOrg =
    shouldPreferMultiOrgRecord(f, rec.wins, rec.losses, rec.draws, multiRecord) && hasMultiOrgRecord;

  let headerWins: number, headerLosses: number;
  let boutRows: { date: string; opponent: string; event: string; result: string; method: string }[];
  let source: Row["source"];

  if (prefersMultiOrg) {
    source = "multiOrg";
    headerWins = multiRecord.wins;
    headerLosses = multiRecord.losses;
    const table = computeMultiOrgBoutTable(f.slug, multiOrgData);
    boutRows = table.map((b: MultiOrgBoutRow) => ({
      date: b.date,
      opponent: b.opponentName,
      event: b.event,
      result: b.result,
      method: b.method,
    }));
  } else {
    source = "seed";
    headerWins = rec.wins;
    headerLosses = rec.losses;
    boutRows = rec.history.map((h) => ({
      date: h.date,
      opponent: h.opponent,
      event: h.event,
      result: h.result,
      method: h.method,
    }));
  }

  const wins = boutRows.filter((h) => h.result === "win");
  const losses = boutRows.filter((h) => h.result === "loss");
  const rowWins = wins.length;
  const rowLosses = losses.length;

  const winTally = tallyMethods(wins);
  const lossTally = tallyMethods(losses);
  const chartWins = winTally.ko + winTally.sub + winTally.decision + winTally.other;
  const chartLosses = lossTally.ko + lossTally.sub + lossTally.decision + lossTally.other;

  if (chartWins === headerWins && chartLosses === headerLosses) continue;

  let reason: Row["reason"];
  if (rowWins !== headerWins || rowLosses !== headerLosses) {
    reason = "row-count-mismatch";
  } else {
    const hasUnknown = wins.some((h) => isUnknownMethod(h.method)) || losses.some((h) => isUnknownMethod(h.method));
    reason = hasUnknown ? "method-text-missing" : "other";
  }

  const unknownRows = [...wins, ...losses].filter((h) => isUnknownMethod(h.method));

  rows.push({
    slug: f.slug,
    source,
    headerWins,
    headerLosses,
    rowWins,
    rowLosses,
    chartWins,
    chartLosses,
    reason,
    unknownRows,
  });
}

console.log(`対象選手数: ${rows.length + "件のうちチャート≠1行目"}`);
console.log(`チャート≠1行目 の選手数: ${rows.length}`);
const byReason: Record<string, Row[]> = {};
for (const r of rows) (byReason[r.reason] ??= []).push(r);
for (const [reason, list] of Object.entries(byReason)) {
  console.log(`  ${reason}: ${list.length}名 (source内訳: multiOrg=${list.filter((r) => r.source === "multiOrg").length}, seed=${list.filter((r) => r.source === "seed").length})`);
}

console.log("\n=== method-text-missing 該当者(source別) ===");
for (const r of byReason["method-text-missing"] ?? []) {
  console.log(`${r.slug}\tsource=${r.source}\theader ${r.headerWins}-${r.headerLosses}\tchart ${r.chartWins}-${r.chartLosses}`);
  for (const u of r.unknownRows) {
    console.log(`    ${u.date} vs ${u.opponent} (${u.event}) result=${u.result} method="${u.method}"`);
  }
}

console.log("\n=== row-count-mismatch 該当者(参考、source別) ===");
for (const r of byReason["row-count-mismatch"] ?? []) {
  console.log(`${r.slug}\tsource=${r.source}\theader ${r.headerWins}-${r.headerLosses}\trow ${r.rowWins}-${r.rowLosses}\tchart ${r.chartWins}-${r.chartLosses}`);
}

fs.mkdirSync(path.join(process.cwd(), "out"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "out", "chart-vs-row1-audit-v2.json"), JSON.stringify(rows, null, 2));
console.log(`\n${rows.length}件を out/chart-vs-row1-audit-v2.json に出力`);

// 指示書②: 選手ページのMethodButterfly(チャート)合計と1行目(通算戦績)の
// 勝敗数が食い違う選手を全数スキャンし、原因を2種類に切り分ける。
// read-only。src/・dataは一切変更しない。出力はout/のみ。
//
// チャート = tallyMethods(history)のwinTotal/lossTotal(isUnknownMethodな
// 試合を「捏造ゼロ」方針で除外して集計。src/lib/methodClassify.ts)。
// 1行目 = data/fighterRecords.jsonのトップレベルwins/losses
// (wikipedia.tsのparseJaRecordTotals={{MMA statsbox3}}等の集計欄、
// なければtally(history)にフォールバック)。
//
// 原因切り分け:
// - 1行目 と history中のwin/loss行数 自体が食い違う → 「infobox/表不整合」
//   (決着方法テキストの有無と無関係な、行数レベルの構造的ズレ)
// - 1行目 と history行数は一致するが、一部の行のmethodテキストが
//   isUnknownMethod()と判定される → 「決着方法テキスト欠落」
import fs from "fs";
import path from "path";
import { tallyMethods, isUnknownMethod } from "../src/lib/methodClassify";

interface HistoryEntry {
  date: string;
  opponent: string;
  result: string;
  method: string;
  event: string;
  round?: string;
}
interface FighterRecordEntry {
  wins: number;
  losses: number;
  draws: number;
  ko?: number;
  sub?: number;
  decision?: number;
  history?: HistoryEntry[];
  noRecordData?: boolean;
  needsReview?: boolean;
}

const dataPath = path.join(process.cwd(), "data", "fighterRecords.json");
const data: Record<string, FighterRecordEntry> = JSON.parse(fs.readFileSync(dataPath, "utf8"));

interface Row {
  slug: string;
  headerWins: number;
  headerLosses: number;
  histWins: number;
  histLosses: number;
  chartWins: number;
  chartLosses: number;
  reason: "infobox-table-mismatch" | "method-text-missing" | "other";
  unknownMethodRows: HistoryEntry[];
}

const rows: Row[] = [];

for (const [slug, entry] of Object.entries(data)) {
  if (!entry.history || entry.history.length === 0) continue;
  const wins = entry.history.filter((h) => h.result === "win");
  const losses = entry.history.filter((h) => h.result === "loss");
  const histWins = wins.length;
  const histLosses = losses.length;

  const winTally = tallyMethods(wins);
  const lossTally = tallyMethods(losses);
  const chartWins = winTally.ko + winTally.sub + winTally.decision + winTally.other;
  const chartLosses = lossTally.ko + lossTally.sub + lossTally.decision + lossTally.other;

  if (chartWins === entry.wins && chartLosses === entry.losses) continue; // 一致、対象外

  let reason: Row["reason"];
  if (histWins !== entry.wins || histLosses !== entry.losses) {
    reason = "infobox-table-mismatch";
  } else {
    const unknownInWinsOrLosses =
      wins.some((h) => isUnknownMethod(h.method)) || losses.some((h) => isUnknownMethod(h.method));
    reason = unknownInWinsOrLosses ? "method-text-missing" : "other";
  }

  const unknownMethodRows = [...wins, ...losses].filter((h) => isUnknownMethod(h.method));

  rows.push({
    slug,
    headerWins: entry.wins,
    headerLosses: entry.losses,
    histWins,
    histLosses,
    chartWins,
    chartLosses,
    reason,
    unknownMethodRows,
  });
}

console.log(`対象(history>0)選手数: ${Object.values(data).filter((e) => e.history && e.history.length > 0).length}`);
console.log(`チャート≠1行目 の選手数: ${rows.length}`);
const byReason: Record<string, Row[]> = {};
for (const r of rows) {
  (byReason[r.reason] ??= []).push(r);
}
for (const [reason, list] of Object.entries(byReason)) {
  console.log(`  ${reason}: ${list.length}名`);
}

console.log("\n=== method-text-missing 該当者 ===");
for (const r of byReason["method-text-missing"] ?? []) {
  console.log(
    `${r.slug}\theader ${r.headerWins}-${r.headerLosses}\tchart ${r.chartWins}-${r.chartLosses}\tunknown行:`
  );
  for (const u of r.unknownMethodRows) {
    console.log(`    ${u.date} vs ${u.opponent} (${u.event}) result=${u.result} method="${u.method}"`);
  }
}

console.log("\n=== infobox-table-mismatch 該当者(参考) ===");
for (const r of byReason["infobox-table-mismatch"] ?? []) {
  console.log(
    `${r.slug}\theader ${r.headerWins}-${r.headerLosses}\thist ${r.histWins}-${r.histLosses}\tchart ${r.chartWins}-${r.chartLosses}`
  );
}

console.log("\n=== other 該当者(参考) ===");
for (const r of byReason["other"] ?? []) {
  console.log(`${r.slug}\theader ${r.headerWins}-${r.headerLosses}\tchart ${r.chartWins}-${r.chartLosses}`);
}

fs.mkdirSync(path.join(process.cwd(), "out"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "out", "chart-vs-row1-audit.json"),
  JSON.stringify(rows, null, 2)
);
console.log(`\n${rows.length}件を out/chart-vs-row1-audit.json に出力`);

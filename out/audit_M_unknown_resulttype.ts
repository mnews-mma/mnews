import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}

const sources: Record<string, any[]> = {
  RIZIN: loadJson("rizinRecords.json"),
  修斗: loadJson("shootoRecords.json"),
  パンクラス: loadJson("pancraseRecords.json"),
  DEEP: loadJson("deepRecords.json"),
};

interface Row {
  org: string;
  year: string;
  event: string;
  date: string;
  format: string | null;
  fighterAName: string;
  fighterBName: string;
  methodRaw: string;
}
const rows: Row[] = [];
const byOrgYear: Record<string, Record<string, number>> = {};
const byOrgTotal: Record<string, number> = {};
const byFormat: Record<string, number> = {};

for (const [org, events] of Object.entries(sources)) {
  byOrgYear[org] = {};
  byOrgTotal[org] = 0;
  for (const ev of events) {
    const year = (ev.date || "").slice(0, 4) || "不明";
    for (const b of ev.bouts) {
      if (b.resultType !== "unknown") continue;
      byOrgYear[org][year] = (byOrgYear[org][year] ?? 0) + 1;
      byOrgTotal[org]++;
      const fmt = b.format ?? "(no format field)";
      byFormat[`${org}:${fmt}`] = (byFormat[`${org}:${fmt}`] ?? 0) + 1;
      rows.push({
        org,
        year,
        event: ev.eventName,
        date: ev.date,
        format: b.format ?? null,
        fighterAName: b.fighterAName,
        fighterBName: b.fighterBName,
        methodRaw: b.methodRaw,
      });
    }
  }
}

console.log("=== 団体別合計 ===");
console.log(byOrgTotal);
console.log("\n=== 団体×フォーマット別 ===");
console.log(byFormat);
console.log("\n=== 団体×年代別 ===");
for (const [org, years] of Object.entries(byOrgYear)) {
  console.log(`--- ${org} ---`);
  const sorted = Object.entries(years).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [y, c] of sorted) console.log(`  ${y}: ${c}`);
}

fs.writeFileSync(path.join(process.cwd(), "out", "M_unknown_resulttype_all.json"), JSON.stringify(rows, null, 2));
console.log(`\n全件: out/M_unknown_resulttype_all.json (${rows.length}件)`);

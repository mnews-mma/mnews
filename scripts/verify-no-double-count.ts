// 生成した data/shootoProfileBouts.json の各bout(fighterBSlug解決済み)について、
// 相手側(fighterBSlug)が既存データ(data/shootoRecords.json または
// fighters.ts の history)に同一日付のboutを既に持っていないかを確認する。
// 持っている場合、相手側の2行目集計でこのboutが二重計上されるリスクがある。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";

const archive: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8"));
const profile: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoProfileBouts.json"), "utf8"));

const archiveDateSlug = new Set<string>();
for (const e of archive) {
  for (const b of e.bouts) {
    if (b.fighterASlug) archiveDateSlug.add(`${e.date}|${b.fighterASlug}`);
    if (b.fighterBSlug) archiveDateSlug.add(`${e.date}|${b.fighterBSlug}`);
  }
}

const historyDateSlug = new Set<string>();
for (const f of FIGHTERS) {
  if (Array.isArray(f.history)) {
    for (const h of f.history) {
      historyDateSlug.add(`${h.date}|${f.slug}`);
    }
  }
}

let collisions = 0;
for (const e of profile) {
  const b = e.bouts[0];
  const oppSlug = b.fighterBSlug;
  if (!oppSlug) continue;
  const key = `${e.date}|${oppSlug}`;
  if (archiveDateSlug.has(key)) {
    console.log(`[archive collision] ${e.date} ${b.fighterAName} vs ${b.fighterBName}(${oppSlug}) - opponent already has this date in shootoRecords.json`);
    collisions++;
  }
  if (historyDateSlug.has(key)) {
    console.log(`[history collision] ${e.date} ${b.fighterAName} vs ${b.fighterBName}(${oppSlug}) - opponent already has this date in fighters.ts history`);
    collisions++;
  }
}
console.log(`\ntotal collisions: ${collisions}`);

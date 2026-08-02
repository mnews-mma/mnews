// 指示書R-8 受入条件2・3の監査。
// 全選手について投入前後の2行目(computeMultiOrgRecord)をdiffし、
// - 増分がdata/shootoProfileBouts.json由来のbout数と一致するか(既存773件の二重計上が無いか)
// - 1行目(data/fighterRecords.json、Wikipedia由来の実データがある選手のみ)を
//   2行目が新たに上回るケースが無いか
// を確認する。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";

const archive: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8"));
const profile: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoProfileBouts.json"), "utf8"));
const fighterRecords: Record<string, { wins: number; losses: number; draws: number }> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "fighterRecords.json"), "utf8")
);

// data/shootoProfileBouts.json中でこのslugが関与するbout数(fighterA or fighterB)。
function profileBoutCountFor(slug: string): number {
  let n = 0;
  for (const e of profile) {
    const b = e.bouts[0];
    if (b.fighterASlug === slug || b.fighterBSlug === slug) n++;
  }
  return n;
}

const emptyData = { rizinEvents: [] as any[], pancraseEvents: [] as any[], deepEvents: [] as any[] };

let checkedCount = 0;
let changedCount = 0;
const violations: any[] = [];
const changes: any[] = [];

for (const f of FIGHTERS) {
  const before = computeMultiOrgRecord(f.slug, { ...emptyData, shootoEvents: archive });
  const after = computeMultiOrgRecord(f.slug, { ...emptyData, shootoEvents: [...archive, ...profile] });
  checkedCount++;
  const beforeTotal = before.wins + before.losses + before.draws;
  const afterTotal = after.wins + after.losses + after.draws;
  if (afterTotal === beforeTotal) continue; // 変化なし

  changedCount++;
  const expectedIncrement = profileBoutCountFor(f.slug);
  const actualIncrement = afterTotal - beforeTotal;

  const fr = fighterRecords[f.slug];
  const row1Total = fr ? fr.wins + fr.losses + fr.draws : 0;
  const row1HasRealData = !!fr && row1Total > 0;

  const crossedOver = row1HasRealData && beforeTotal <= row1Total && afterTotal > row1Total;

  const rec = {
    slug: f.slug,
    nameJa: f.nameJa,
    before: { ...before, total: beforeTotal },
    after: { ...after, total: afterTotal },
    expectedIncrement,
    actualIncrement,
    incrementMatchesExpected: expectedIncrement === actualIncrement,
    row1: fr ? { ...fr, total: row1Total } : null,
    row1HasRealData,
    row2ExceedsRow1After: row1HasRealData && afterTotal > row1Total,
    crossedOverNewly: crossedOver,
  };
  changes.push(rec);
  if (!rec.incrementMatchesExpected || crossedOver) violations.push(rec);
}

console.log(`監査対象選手数: ${checkedCount}`);
console.log(`2行目が変化した選手数: ${changedCount}`);
console.log(`\n=== 変化した選手一覧 ===`);
for (const c of changes) {
  console.log(
    `${c.slug}(${c.nameJa}): before=${c.before.wins}-${c.before.losses}-${c.before.draws}(${c.before.total}) -> after=${c.after.wins}-${c.after.losses}-${c.after.draws}(${c.after.total}) | 増分実測=${c.actualIncrement} 期待=${c.expectedIncrement} 一致=${c.incrementMatchesExpected} | 1行目=${c.row1 ? c.row1.total : "無し(noRecordData)"} | 新たに2行目>1行目=${c.crossedOverNewly}`
  );
}

console.log(`\n=== 違反(増分不一致 or 1行目超過が新規発生) ===`);
console.log(`件数: ${violations.length}`);
for (const v of violations) {
  console.log(JSON.stringify(v, null, 2));
}

fs.writeFileSync(
  path.join(process.cwd(), "out", "r8-ingestion-audit.json"),
  JSON.stringify({ checkedCount, changedCount, changes, violations }, null, 2) + "\n"
);
console.log(`\n書き出し: out/r8-ingestion-audit.json`);

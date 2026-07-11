// data/fighterRecords.json の既存history(RIZIN MMA boutのみ)に、EVENT_RESULTSから
// 突合したbout単位のweightClassを一括付与する一回限りのバックフィル。
// Wikipediaへの再fetchは行わない(既存データをその場でenrichするだけ)ため、
// update-fighter-records.tsの通常実行より速く・安全に反映できる。
// 今後の日次バッチ(update-fighter-records.ts)は毎回自動でこのenrichmentを
// 適用するため、このスクリプトは「今すぐ既存データに反映したい」場合の一回限りの
// 実行用(再実行しても安全=既に付与済みのweightClassは同じロジックで再計算される)。
//
// 実行: npx tsx scripts/backfill-bout-weightclass.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import type { FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { enrichHistoryWithWeightClass } from "../src/lib/mnewsRating/enrichHistoryWeightClass";

const OUT = path.join(process.cwd(), "data", "fighterRecords.json");

function main() {
  const records: FighterRecordsFile = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  let enrichedBoutCount = 0;
  const nullBoutLines: string[] = [];

  for (const [slug, entry] of Object.entries(records)) {
    if (entry.noRecordData || !entry.history) continue;
    const nameJa = nameBySlug.get(slug);
    if (!nameJa) continue; // FIGHTERSに存在しないslug(データ不整合)は触らない

    const { history, nullBouts } = enrichHistoryWithWeightClass(nameJa, entry.history);
    enrichedBoutCount += history.filter((h) => h.weightClass).length;
    entry.history = history;
    for (const b of nullBouts) nullBoutLines.push(`${slug}(${nameJa}) ${b.date} vs ${b.opponent}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");

  console.log(`=== bout単位weightClassバックフィル完了 ===`);
  console.log(`付与できたRIZIN MMA bout数: ${enrichedBoutCount}`);
  console.log(`突合できなかった(weightClass不明のまま)bout数: ${nullBoutLines.length}`);
  if (nullBoutLines.length) {
    console.log(`--- 不明bout一覧(先頭30件) ---`);
    nullBoutLines.slice(0, 30).forEach((l) => console.log(`  ${l}`));
  }
}

main();

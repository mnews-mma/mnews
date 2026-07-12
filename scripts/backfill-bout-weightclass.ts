// data/fighterRecords.json の既存データに対する一回限りのバックフィル。
// Wikipediaへの再fetchは行わない(既存データをその場でenrichするだけ)ため、
// update-fighter-records.tsの通常実行より速く・安全に反映できる。
// 今後の日次バッチ(update-fighter-records.ts)は毎回自動で同じ処理を適用するため、
// このスクリプトは「今すぐ既存データに反映したい」場合の一回限りの実行用
// (再実行しても安全=同じロジックで再計算されるだけ)。
//
// 1. recordOverrides.ts: 上流データの誤り・欠落を出典付きで訂正
// 2. enrichHistoryWeightClass.ts: RIZIN MMA boutにEVENT_RESULTS突合のweightClassを付与
//
// 実行: npx tsx scripts/backfill-bout-weightclass.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import type { FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { enrichHistoryWithWeightClass } from "../src/lib/mnewsRating/enrichHistoryWeightClass";
import { applyRecordOverrides } from "../src/lib/mnewsRating/recordOverrides";

const OUT = path.join(process.cwd(), "data", "fighterRecords.json");

function main() {
  const records: FighterRecordsFile = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  let enrichedBoutCount = 0;
  let overriddenFighterCount = 0;
  const nullBoutLines: string[] = [];

  for (const [slug, entry] of Object.entries(records)) {
    if (entry.noRecordData || !entry.history) continue;
    const nameJa = nameBySlug.get(slug);
    if (!nameJa) continue; // FIGHTERSに存在しないslug(データ不整合)は触らない

    const correctedHistory = applyRecordOverrides(slug, entry.history);
    if (correctedHistory !== entry.history) overriddenFighterCount++;

    const { history, nullBouts } = enrichHistoryWithWeightClass(nameJa, correctedHistory);
    enrichedBoutCount += history.filter((h) => h.weightClass).length;
    entry.history = history;
    // 注意: entry.wins等はdata/fighterRecords.json側の「既に確定済みの」集計値
    // (Wikipedia生値ではない)。applyRecordOverridesToTotalsは「Wikipedia生値」への
    // 一回加算を前提とした関数のため、このスクリプトで再適用すると二重加算になる
    // (update-fighter-records.tsの日次バッチは毎回Wikipediaから生値を取得し直すため
    // 安全だが、こちらは既存データをその場でenrichするだけなので対象外)。
    // このスクリプトはweightClass付与のみを担当し、集計値の再計算は行わない。
    for (const b of nullBouts) nullBoutLines.push(`${slug}(${nameJa}) ${b.date} vs ${b.opponent}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");

  console.log(`=== data/fighterRecords.json バックフィル完了 ===`);
  console.log(`戦績訂正オーバーライドを適用した選手数: ${overriddenFighterCount}`);
  console.log(`付与できたRIZIN MMA bout(weightClass)数: ${enrichedBoutCount}`);
  console.log(`突合できなかった(weightClass不明のまま)bout数: ${nullBoutLines.length}`);
  if (nullBoutLines.length) {
    console.log(`--- 不明bout一覧(先頭30件) ---`);
    nullBoutLines.slice(0, 30).forEach((l) => console.log(`  ${l}`));
  }
}

main();

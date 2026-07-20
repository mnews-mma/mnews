// recordDisplayExclusions(表示戦績のみ除外する事実オーバーレイ)のzero-match
// 監査。読み取り専用・本番不変。各エントリが実際にbouts配列中の対応する試合と
// マッチしているかを、本番と同じロジック(buildBouts→bNode/aNode疑似ノードID)で
// 検証する。設定してあるのに1件もマッチしないエントリ(zero-match)は「沈黙する
// 誤設定」であり、表示戦績が意図通り除外されていないサイレントno-opの可能性が
// ある。
//
// 実行: npx tsx scripts/audit-record-display-exclusions.ts
import fs from "fs";
import { buildBouts, FighterRecordsInput } from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { FIGHTER_DIVISION_OVERLAYS } from "../src/lib/mnewsRating/fighterDivisions";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

function main() {
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync("data/fighterRecords.json", "utf8"));
  const rizinEvents: RizinRecordsEvent[] = JSON.parse(fs.readFileSync("data/rizinRecords.json", "utf8"));
  const index = buildRizinRecordsIndex(rizinEvents);
  const records: FighterRecordsInput = {};
  for (const [slug, entry] of Object.entries(rawRecords)) {
    const { history } = applyRizinRecordsToHistory(slug, entry.history ?? [], index);
    records[slug] = { ...entry, history };
  }

  const asOf = new Date();
  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  const { bouts } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, asOf, isOpeningFightOverride);

  let totalExclusions = 0;
  let matched = 0;
  const zeroMatch: { slug: string; date: string; opponentNode: string }[] = [];

  for (const overlay of FIGHTER_DIVISION_OVERLAYS) {
    for (const excl of overlay.recordDisplayExclusions ?? []) {
      totalExclusions++;
      const hit = bouts.some(
        (b) =>
          b.date === excl.date &&
          ((b.aNode === overlay.slug && b.bNode === excl.opponentSlug) || (b.bNode === overlay.slug && b.aNode === excl.opponentSlug))
      );
      if (hit) matched++;
      else zeroMatch.push({ slug: overlay.slug, date: excl.date, opponentNode: excl.opponentSlug });
    }
  }

  console.log(`=== recordDisplayExclusions zero-match監査 ===`);
  console.log(`定義エントリ総数: ${totalExclusions}件`);
  console.log(`マッチ確認できた件数: ${matched}件`);
  console.log(`zero-match(設定してあるが1件もマッチしない): ${zeroMatch.length}件`);
  for (const z of zeroMatch) {
    console.log(`  NG: ${z.slug} date=${z.date} opponentNode=${z.opponentNode}`);
  }
}

main();

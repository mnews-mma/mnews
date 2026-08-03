// 指示書I「既存ルールの十分性チェック」: shouldPreferMultiOrgRecord()は
// noRecordData/needsReview/recordFromResultsのいずれも立っていない選手を
// 常にfalse(1行目を信頼)と判定する。もし公開中の選手の中に「どのフラグも
// 立っていないのに1行目合計が0、かつ4団体合算には試合がある」選手がいると、
// 今回2行目の表示条件にsuppressNoRecordRowを追加した結果、1行目は
// (noRecordData=false なので)『データなし』表示にはならないが空欄同然の
// カード(0-0-0)になり、2行目(実データ)も出ないという新規リグレッションに
// なる。0件であることを確認するための悉皆チェック(read-only)。
//
// 実行: npx tsx scripts/audit-flagless-zero-row1-multiorg.ts
import { FIGHTERS } from "../src/lib/fighters";
import { fetchFighterRecords, resolveFightersFromRecords } from "../src/lib/fighterRecordsCache";
import { getMultiOrgSummaryCached } from "../src/lib/mnewsRating/multiOrgRecordCache";

async function main() {
  const records = await fetchFighterRecords();
  const visible = resolveFightersFromRecords(
    FIGHTERS.filter((f) => !f.hidden),
    records
  );

  console.log(`公開対象(non-hidden): ${visible.length}名`);

  const candidates = visible.filter((f) => {
    if (f.noRecordData || f.needsReview || f.recordFromResults) return false;
    const total = (f.wins ?? 0) + (f.losses ?? 0) + (f.draws ?? 0);
    return total === 0;
  });

  console.log(
    `フラグなし(noRecordData/needsReview/recordFromResultsいずれもfalse)かつ1行目合計0: ${candidates.length}名`
  );

  const hits: { slug: string; nameJa: string; multiOrg: string }[] = [];
  for (const f of candidates) {
    const { record } = await getMultiOrgSummaryCached(f.slug);
    const total = record.wins + record.losses + record.draws;
    if (total > 0) {
      hits.push({ slug: f.slug, nameJa: f.nameJa, multiOrg: `${record.wins}-${record.losses}-${record.draws}` });
    }
  }

  console.log(`\n該当(=新規リグレッション対象): ${hits.length}名`);
  for (const h of hits) {
    console.log(`  ${h.slug} (${h.nameJa}): multiOrg=${h.multiOrg}`);
  }

  if (hits.length === 0) {
    console.log("\n結論: 0件。既存のshouldPreferMultiOrgRecord()のままで十分。変更不要。");
  } else {
    console.log("\n結論: 該当あり。shouldPreferMultiOrgRecordのnoRecordData判定を一般化する必要あり。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

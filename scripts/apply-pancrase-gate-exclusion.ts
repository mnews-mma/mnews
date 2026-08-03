// 指示書④(パンクラスゲート系262bout除外)専用の適用スクリプト。
//
// 本来はscripts/filter-nonpro-bouts.tsを再実行すれば全カテゴリ(karate/kids/
// submission_only/amateur/tryout/cage_gate/pancrase_gate)がまとめて適用される
// はずだが、2026-08-03時点でdata/pancraseRecords.json・data/shootoRecords.jsonは
// 既に(このPRとは無関係な原因で)CAGE GATE 37bout・amateur 7bout・修斗側
// karate/kids/submission_only/amateur/tryout 計190boutが再混入した状態にある
// (.github/workflows/update-org-records.ymlが生スクレイパー
// (build-shooto-records.ts/build-pancrase-records.ts)を直接叩いてcommitしており、
// filter-nonpro-bouts.tsを一度も呼んでいないため、日次実行のたびに過去の除外PR
// (#265・#268・#269)の内容が silently 巻き戻る構造的な問題。詳細は
// out/pancrase-gate-exclusion-measurement.mdの「波及」節参照)。
//
// この既存の再混入を直す責務は本PRのスコープ外(指示書④はパンクラスゲートのみ)
// かつ pipeline側(update-org-records.yml)の修正が本質的な対処であるため、この
// スクリプトは data/pancraseRecords.json から not_pro_pancrase_gate カテゴリに
// 該当するboutだけを取り除く。CAGE GATE・amateur等の再混入分は意図的に触らない
// (=このPRの前後でそれらのbout数は不変)。data/shootoRecords.jsonは
// パンクラスゲートのキーワードに一切ヒットしないため完全に無変更。
//
// 実行方法: npx tsx scripts/apply-pancrase-gate-exclusion.ts [--dry-run]
import fs from "fs";
import path from "path";
import { classifyNonProBout } from "../src/lib/mnewsRating/nonProBoutFilter";
import { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";

const DRY_RUN = process.argv.includes("--dry-run");
const PANCRASE_PATH = path.join(__dirname, "..", "data", "pancraseRecords.json");

const pancraseRaw: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf-8"));

let totalBoutsBefore = 0;
let removed = 0;
const eventsBecameEmpty: { date: string | null; eventName: string }[] = [];

const filtered = pancraseRaw.map((ev) => {
  totalBoutsBefore += ev.bouts.length;
  const hadBouts = ev.bouts.length > 0;
  const keptBouts = ev.bouts.filter((b) => {
    const category = classifyNonProBout(b as any);
    if (category === "not_pro_pancrase_gate") {
      removed++;
      return false;
    }
    return true; // 他カテゴリ(cage_gate/amateur等)は今回のスコープ外のため意図的に残す
  });
  if (hadBouts && keptBouts.length === 0) {
    eventsBecameEmpty.push({ date: ev.date, eventName: ev.eventName });
  }
  return { ...ev, bouts: keptBouts };
});

console.log(`全bout数: ${totalBoutsBefore} → ${totalBoutsBefore - removed}(${removed}件除外、カテゴリ: not_pro_pancrase_gate)`);
console.log(`0boutになった大会: ${eventsBecameEmpty.length}件`, eventsBecameEmpty);

if (!DRY_RUN) {
  fs.writeFileSync(PANCRASE_PATH, JSON.stringify(filtered, null, 2) + "\n");
  console.log(`書き込み完了: ${PANCRASE_PATH}`);
} else {
  console.log("--dry-run のためファイルへの書き込みはしていません。");
}

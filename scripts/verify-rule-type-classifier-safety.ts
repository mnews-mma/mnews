// 検証専用スクリプト(read-only、data/は一切書き換えない)。
// classifyMmaRuleType()を*RecordsAggregate.tsに組み込む前の安全確認。
//
// 1. パンクラス: 保存済みb.ruleType(スクレイプ時にresolveRuleType()で計算)と、
//    新しい共通判定器をheadingText+namedDivisionに通した結果を全4877bout突合し、
//    差分(=挙動が変わるbout)を全件列挙する。差分が「ISKAオリエンタル・ルール」
//    1件のみであることを確認する。
// 2. DEEP/修斗: 新しい共通判定器で非MMAと判定される全boutを列挙する(元々
//    ruleTypeでの絞り込みが無いため「差分」ではなく「新規除外候補」)。
import fs from "fs";
import { classifyMmaRuleType, buildRuleTypeHaystack } from "../src/lib/mnewsRating/nonProBoutFilter";

function main() {
  console.log("=== 1. パンクラス: 保存済みruleType vs 新判定器の突合 ===\n");
  const pancraseEvents = JSON.parse(fs.readFileSync("data/pancraseRecords.json", "utf8"));
  let total = 0;
  let diffCount = 0;
  for (const ev of pancraseEvents) {
    for (const b of ev.bouts) {
      total++;
      const stored = b.ruleType as string;
      const fresh = classifyMmaRuleType(buildRuleTypeHaystack(b));
      if (stored !== fresh) {
        diffCount++;
        console.log(
          `[差分] ${ev.eventName} / ${ev.date} / #${b.cardPosition} ${b.fighterAName}(${b.fighterASlug ?? "-"}) vs ${b.fighterBName}(${b.fighterBSlug ?? "-"})`
        );
        console.log(`  保存済み: ${stored} -> 新判定: ${fresh}`);
        console.log(`  headingText: ${b.headingText}`);
        console.log(`  namedDivision: ${b.namedDivision}`);
      }
    }
  }
  console.log(`\n総bout数: ${total} / 差分件数: ${diffCount}\n`);

  for (const [file, label] of [
    ["data/deepRecords.json", "DEEP"],
    ["data/shootoRecords.json", "修斗"],
  ] as const) {
    console.log(`=== 2. ${label}: 新判定器による非MMA判定候補(全件) ===\n`);
    const events = JSON.parse(fs.readFileSync(file, "utf8"));
    let totalB = 0;
    const hits: { event: string; date: string | null; cardPosition: number; a: string; aSlug: string | null; b: string; bSlug: string | null; ruleType: string; heading: string; named: string | null }[] = [];
    for (const ev of events) {
      for (const b of ev.bouts) {
        totalB++;
        const ruleType = classifyMmaRuleType(buildRuleTypeHaystack(b));
        if (ruleType !== "MMA" && ruleType !== "unknown") {
          hits.push({
            event: ev.eventName,
            date: ev.date,
            cardPosition: b.cardPosition,
            a: b.fighterAName,
            aSlug: b.fighterASlug,
            b: b.fighterBName,
            bSlug: b.fighterBSlug,
            ruleType,
            heading: b.headingText,
            named: b.namedDivision,
          });
        }
      }
    }
    console.log(`総bout数: ${totalB} / 非MMA判定件数: ${hits.length}\n`);
    const resolved = hits.filter((h) => h.aSlug || h.bSlug);
    console.log(`うちslug解決済み(選手記録に影響): ${resolved.length}件`);
    console.log(`\n--- 全件(未解決含む。誤除外(=本来MMAの試合)がないかの目視確認用) ---`);
    for (const h of hits) {
      const resolvedMark = h.aSlug || h.bSlug ? "★" : " ";
      console.log(`${resolvedMark} [${h.event} / ${h.date} / #${h.cardPosition}] ${h.a}(${h.aSlug ?? "-"}) vs ${h.b}(${h.bSlug ?? "-"}) -> ${h.ruleType}`);
      console.log(`    headingText: ${h.heading}`);
      if (h.named && h.named !== h.heading) console.log(`    namedDivision: ${h.named}`);
    }
    console.log();
  }
}

main();

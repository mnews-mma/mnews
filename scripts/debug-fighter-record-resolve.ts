// #288で追加した5名(知名昴海・万智・百湖・東ようこ・中井りん)について、
// resolveFighter.ts と同じ判定(ja-wiki既定タイトル解決→EVENT_RESULTS由来の
// 履歴とのoverlapガード)を個別に再現し、どのステップで通算戦績が
// 取れていないかを可視化する調査専用スクリプト(read-only、書き込みなし)。
//
// 実行: npx tsx scripts/debug-fighter-record-resolve.ts
import { fetchJaWikiFighterRecord } from "../src/lib/feeds/wikipedia";
import { deriveHistoryFromEventResults } from "../src/lib/fighterRecordFromResults";
import { FIGHTERS } from "../src/lib/fighters";

async function main() {
  const targets = ["china-sukai", "fukuda-machi", "saito-momoko", "higashi-yoko", "nakai-rin"];
  for (const slug of targets) {
    const fighter = FIGHTERS.find((f) => f.slug === slug)!;
    const jaTitle = fighter.wikiTitleJa ?? fighter.nameJa.replace(/\s/g, "");
    console.log(`\n=== ${slug} (${fighter.nameJa}) jaTitle="${jaTitle}" ===`);
    const jaWiki = await fetchJaWikiFighterRecord(jaTitle).catch((e) => {
      console.log("  fetch error:", e);
      return null;
    });
    if (!jaWiki) {
      console.log("  jaWiki: null (記事なし or パース失敗)");
      continue;
    }
    console.log(`  jaWiki totals: ${jaWiki.wins}-${jaWiki.losses}-${jaWiki.draws} / history件数=${jaWiki.history.length}`);
    console.log(`  jaWiki history opponents (先頭5件): ${jaWiki.history.slice(0, 5).map((h) => h.opponent).join(", ")}`);

    const derived = deriveHistoryFromEventResults(fighter.nameJa, fighter.slug);
    console.log(`  derived(EVENT_RESULTS由来) 件数=${derived.length}`);
    console.log(`  derived opponents: ${derived.map((h) => h.opponent).join(", ")}`);

    const norm = (s: string) => s.replace(/[\s　・☆]/g, "");
    const wikiOpp = new Set(jaWiki.history.map((h) => norm(h.opponent)));
    const overlap = derived.filter((h) => wikiOpp.has(norm(h.opponent)));
    console.log(`  overlap件数: ${overlap.length} (${overlap.map((h) => h.opponent).join(", ")})`);
  }
}

main();

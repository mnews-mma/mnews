// #252(パンクラス・修斗94名投入)の92名について、resolveFighter()(ライブWikipedia解決、
// data/への書き込みは一切しない純粋fetch)を直接呼び、Wikipedia記事が自動一致した
// (live:true)選手を特定する。各対象について、投入したhistory(archive集計)の対戦相手が
// Wikipedia側historyの対戦相手にどれだけ含まれるか(包含率)を機械的に算出するだけで、
// 同名別人の断定・修正は行わない。data/fighterRecords.json 等への書き込みは発生しない
// (resolveFighter自体がfs操作を持たないため)。
import { readFileSync, writeFileSync } from "fs";
import { FIGHTERS } from "../../src/lib/fighters";
import { resolveFighter } from "../../src/lib/feeds/resolveFighter";

const gen = JSON.parse(readFileSync("/tmp/ri94_generated.json", "utf8"));
const targetSlugs: string[] = gen.results.map((r: any) => r.slug);

function normName(s: string): string {
  // NFKC正規化 + 空白除去(全角/半角スペース)。指示書どおりの表記ゆれ吸収基準。
  return s.normalize("NFKC").replace(/[\s　]/g, "");
}

async function main() {
  const liveMatches: {
    slug: string;
    nameJa: string;
    myOpponents: string[];
    wikiOpponents: string[];
    myBoutCount: number;
    wikiBoutCount: number;
    matchedCount: number;
    unmatchedOpponents: string[];
    containmentRate: number;
  }[] = [];

  const noWikiFetch: string[] = [];

  for (const slug of targetSlugs) {
    const fighter = FIGHTERS.find((f) => f.slug === slug);
    if (!fighter) {
      console.error(`[エラー] FIGHTERSにslug="${slug}"が見つからない(想定外)`);
      continue;
    }
    const r = await resolveFighter(fighter);
    if (!r.live) continue; // live:false = Wikipedia不一致(想定どおり、seedがそのまま採用される側)。分析対象外。

    const myOpponents = fighter.history.map((h) => h.opponent);
    const wikiOpponents = r.history.map((h) => h.opponent);
    const wikiOpponentSetNorm = new Set(wikiOpponents.map(normName));

    const unmatchedOpponents: string[] = [];
    let matchedCount = 0;
    for (const opp of myOpponents) {
      if (wikiOpponentSetNorm.has(normName(opp))) {
        matchedCount++;
      } else {
        unmatchedOpponents.push(opp);
      }
    }
    const containmentRate = myOpponents.length > 0 ? matchedCount / myOpponents.length : 0;

    liveMatches.push({
      slug,
      nameJa: fighter.nameJa,
      myOpponents,
      wikiOpponents,
      myBoutCount: myOpponents.length,
      wikiBoutCount: wikiOpponents.length,
      matchedCount,
      unmatchedOpponents,
      containmentRate,
    });

    // resolveWithRetryのような待機は無いが、Wikipedia APIへの連続fetch負荷を下げるため
    // 選手間に軽くウェイトを入れる(update-fighter-records.tsと同じ配慮)。
    await new Promise((res) => setTimeout(res, 200));
  }

  liveMatches.sort((a, b) => a.containmentRate - b.containmentRate);

  writeFileSync(
    "/tmp/name_collision_11_result.json",
    JSON.stringify({ liveMatches, noWikiFetch, totalChecked: targetSlugs.length }, null, 1)
  );

  console.log(`対象92名中チェック完了: ${targetSlugs.length}名`);
  console.log(`Wikipedia自動一致(live:true): ${liveMatches.length}名`);
  console.log(`historyFetch失敗: ${noWikiFetch.length}名`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

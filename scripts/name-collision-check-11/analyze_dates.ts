// out/name-collision-check-11.md で包含率100%未満だった6名について、
// 「投入側にあってWiki側に(相手名の正規化一致で)無い」bout単位で、同じ日付の
// エントリがWiki側historyに存在するかを突合する。data/への書き込みは発生しない
// (resolveFighterは純粋fetch関数)。同名別人の判定・修正・alias追加はしない。
import { writeFileSync } from "fs";
import { FIGHTERS } from "../../src/lib/fighters";
import { resolveFighter } from "../../src/lib/feeds/resolveFighter";

const TARGET_SLUGS = [
  "iwasaki-taiga", // 岩﨑大河
  "kurobe-mina", // 黒部三奈
  "nakajima-riku", // 中島陸
  "unconfirmed-shooto-1875", // 砂辺光久
  "watanabe-ayaka", // 渡辺彩華
  "aya-murakami", // 村上彩
];

function normName(s: string): string {
  return s.normalize("NFKC").replace(/[\s　]/g, "");
}

function detectOrgs(events: string[]): string[] {
  const orgs = new Set<string>();
  for (const ev of events) {
    if (/RIZIN/i.test(ev)) orgs.add("RIZIN");
    else if (/DEEP/i.test(ev)) orgs.add("DEEP");
    else if (/PANCRASE|パンクラス/i.test(ev)) orgs.add("PANCRASE");
    else if (/SHOOTO|修斗/i.test(ev)) orgs.add("SHOOTO");
    else if (/UFC/i.test(ev)) orgs.add("UFC");
    else if (/\bONE\b/i.test(ev)) orgs.add("ONE");
    else orgs.add("other");
  }
  return [...orgs].sort();
}

interface DateMatchResult {
  slug: string;
  nameJa: string;
  wikiYearRange: string;
  wikiOrgsLine: string;
  unmatchedBouts: {
    date: string;
    myOpponent: string;
    classification: "date_match_diff_opponent" | "date_missing_in_wiki" | "UNCLASSIFIED";
    wikiEntriesSameDate: { date: string; opponent: string; event: string }[];
  }[];
}

async function main() {
  const results: DateMatchResult[] = [];
  const unclassified: any[] = [];

  for (const slug of TARGET_SLUGS) {
    const fighter = FIGHTERS.find((f) => f.slug === slug);
    if (!fighter) throw new Error(`FIGHTERSにslug="${slug}"が見つからない`);

    const r = await resolveFighter(fighter);
    if (!r.live) throw new Error(`${slug}: 前回はlive:trueだったが今回はlive:false(再現性なし、停止)`);

    const wikiOpponentSetNorm = new Set(r.history.map((h) => normName(h.opponent)));
    const wikiDateIndex = new Map<string, { date: string; opponent: string; event: string }[]>();
    for (const h of r.history) {
      if (!wikiDateIndex.has(h.date)) wikiDateIndex.set(h.date, []);
      wikiDateIndex.get(h.date)!.push({ date: h.date, opponent: h.opponent, event: h.event });
    }

    const unmatchedBouts: DateMatchResult["unmatchedBouts"] = [];
    for (const myBout of fighter.history) {
      if (wikiOpponentSetNorm.has(normName(myBout.opponent))) continue; // 相手名一致=前回レポートの「一致」側。対象外。

      const sameDate = wikiDateIndex.get(myBout.date) ?? [];
      let classification: DateMatchResult["unmatchedBouts"][number]["classification"];
      if (sameDate.length > 0) {
        classification = "date_match_diff_opponent";
      } else if (sameDate.length === 0) {
        classification = "date_missing_in_wiki";
      } else {
        classification = "UNCLASSIFIED";
      }
      if (classification === "UNCLASSIFIED") {
        unclassified.push({ slug, date: myBout.date, opponent: myBout.opponent });
      }
      unmatchedBouts.push({
        date: myBout.date,
        myOpponent: myBout.opponent,
        classification,
        wikiEntriesSameDate: sameDate,
      });
    }

    const wikiDates = r.history.map((h) => h.date).filter(Boolean).sort();
    const wikiYearRange =
      wikiDates.length > 0
        ? `${wikiDates[0].slice(0, 4)}〜${wikiDates[wikiDates.length - 1].slice(0, 4)}`
        : "(不明)";
    const wikiOrgsLine = detectOrgs(r.history.map((h) => h.event)).join("+");

    results.push({
      slug,
      nameJa: fighter.nameJa,
      wikiYearRange,
      wikiOrgsLine,
      unmatchedBouts,
    });

    await new Promise((res) => setTimeout(res, 200));
  }

  writeFileSync("/tmp/name_collision_date_match_result.json", JSON.stringify({ results, unclassified }, null, 1));

  console.log(`対象6名処理完了`);
  console.log(`分類不能(停止条件): ${unclassified.length}件`);
  for (const r of results) {
    console.log(`${r.nameJa}(${r.slug}): 未一致bout ${r.unmatchedBouts.length}件`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

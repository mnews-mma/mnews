// mnewsレーティング算出 — フェーズ1確認用スクリプト。
// data/fighterRecords.json を実データとして読み、フェザー級の順位をコンソールに
// 出力する(rankings.json生成・ページ実装はまだ行わない)。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { buildBouts, buildDisplayEntries, computeRawRatings, FighterRecordsInput } from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver } from "../src/lib/mnewsRating/nameIndex";
import { isFeatherweightProfile } from "../src/lib/mnewsRating/division";
import { ALGORITHM_VERSION, RATING_NAME } from "../src/lib/mnewsRating/constants";

const DATA_PATH = path.join(process.cwd(), "data", "fighterRecords.json");

function main() {
  const records: FighterRecordsInput = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const resolve = buildOpponentResolver(records);
  const { bouts, warnings } = buildBouts(records, resolve);
  const states = computeRawRatings(bouts);
  const asOf = new Date();
  const display = buildDisplayEntries(states, asOf);

  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
  const classBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.weightClass]));

  const featherweightAll = [...display.values()].filter((e) => isFeatherweightProfile(classBySlug.get(e.slug)));
  const eligible = featherweightAll.filter((e) => e.eligible).sort((a, b) => b.displayRating - a.displayRating);
  const ineligible = featherweightAll.filter((e) => !e.eligible).sort((a, b) => b.displayRating - a.displayRating);

  console.log(`=== ${RATING_NAME} v${ALGORITHM_VERSION} フェザー級 (asOf=${asOf.toISOString().slice(0, 10)}) ===`);
  console.log(`RIZIN MMA対戦(重複排除後): ${bouts.length}件 / 除外warning: ${warnings.length}件\n`);

  console.log(`--- 掲載資格あり(${eligible.length}名) ---`);
  eligible.forEach((e, i) => {
    const name = nameBySlug.get(e.slug) ?? e.slug;
    console.log(
      `${String(i + 1).padStart(2)}. ${name.padEnd(14)} raw=${Math.round(e.rawRating)} disp=${Math.round(e.displayRating)}  ` +
        `RIZIN戦績=${e.wins}-${e.losses}-${e.draws}(${e.fights}戦)  最終試合=${e.lastFightDate}`
    );
  });

  if (ineligible.length) {
    console.log(`\n--- フェザー級だが掲載資格なし(参考レートのみ・${ineligible.length}名) ---`);
    ineligible.forEach((e) => {
      const name = nameBySlug.get(e.slug) ?? e.slug;
      console.log(
        `    ${name.padEnd(14)} disp=${Math.round(e.displayRating)}  RIZIN戦績=${e.wins}-${e.losses}-${e.draws}(${e.fights}戦)  最終試合=${e.lastFightDate ?? "-"}`
      );
    });
  }

  if (warnings.length) {
    console.log(`\n--- 除外warning(全${warnings.length}件中、先頭30件) ---`);
    warnings.slice(0, 30).forEach((w) => {
      const name = nameBySlug.get(w.slug) ?? w.slug;
      console.log(`    ${name} ${w.date || "(日付欠損)"} vs ${w.opponent || "(相手欠損)"}: ${w.reason}`);
    });
  }
}

main();

// デプロイ前ゲート: data/rankings.json が参照するfighterId(champion/entries)が
// すべてfighters.ts(FIGHTERS)に存在することを検査する。
//
// 表示側(resolveDivisionRankingView, src/lib/mnewsRating/divisionRankingView.ts)は
// 解決できないfighterIdを行ごと非表示にして繰り上げる設計にしたため、素の
// スラッグが画面に漏れ出すことはない。ただしそれは「表示上の最終防衛ライン」で
// あって「無言で選手が1人消える」こと自体は防げないため、データ生成側の不整合を
// ビルド時に検出して人手の修正を促す。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import type { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";

const DATA_PATH = path.join(process.cwd(), "data", "rankings.json");

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.log("[ランキングスラッグ検査] data/rankings.json が存在しないためスキップ");
    return;
  }

  let rankings: RankingsFile;
  try {
    rankings = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (e) {
    console.error(`[ランキングスラッグ検査] data/rankings.json のJSON解析に失敗: ${e}`);
    process.exit(1);
  }

  const knownSlugs = new Set(FIGHTERS.map((f) => f.slug));
  const missing: string[] = [];

  for (const [divisionSlug, data] of Object.entries(rankings)) {
    if (data.champion && !knownSlugs.has(data.champion.fighterId)) {
      missing.push(`${divisionSlug}: champion "${data.champion.fighterId}" がfighters.tsに存在しません`);
    }
    for (const entry of data.entries) {
      if (!knownSlugs.has(entry.fighterId)) {
        missing.push(`${divisionSlug}: rank${entry.rank} "${entry.fighterId}" がfighters.tsに存在しません`);
      }
    }
  }

  if (missing.length) {
    console.error(
      `[ランキングスラッグ検査] ★fighters.tsに存在しないfighterIdを検出(${missing.length}件)。デプロイをブロックします:\n  ${missing.join("\n  ")}\n` +
        `表示側は該当選手を非表示+繰り上げで吸収するが、無言で選手が消えるため元データ(fighterId)かfighters.tsの登録漏れを修正してください。`
    );
    process.exit(1);
  }

  console.log("[ランキングスラッグ検査] OK");
}

main();

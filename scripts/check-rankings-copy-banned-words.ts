// デプロイ前ゲート: /rankings/[division]の固有テキスト(PR-B、
// src/lib/rankingsDivisionCopy.ts)に禁止語が混入していないかを検査する。
//
// 禁止事項(指示書PR-B B-3):
//   - 順位変動への言及(SUPPRESS_RANKING_MOVEMENT中のため。「上昇」「新規
//     ランクイン」「陥落」いずれも不可)
//   - 評価語・予測(「最有力」「注目」「充実した」「激戦区」等)
// 圏外落ちした選手の名指し・数値レーティングの露出・値欠損時の推定補完は
// buildDivisionCopy自体の設計(上位表示者のみ扱う・rating/rawRatingを一切
// 参照しない型・欠損時は行/段落ごと省略)で構造的に防止しているため、
// 文字列検査の対象はここでは「順位変動」「評価語・予測」の2カテゴリのみ。
//
// 実行: npx tsx scripts/check-rankings-copy-banned-words.ts
import fs from "fs";
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "../src/lib/mnewsRating/divisions";
import { getDivisionRankingView, resolveDivisionRankingView } from "../src/lib/mnewsRating/divisionRankingView";
import type { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";
import { buildDivisionCopy, assembleDivisionCopyText } from "../src/lib/rankingsDivisionCopy";
import { FIGHTERS } from "../src/lib/fighters";
import type { FighterRecordsFile } from "../src/lib/fighterRecordsCache";

// 順位変動語(明示例) + 評価語・予測語(明示例)。指示書に列挙された語のみを対象にし、
// 過剰に広い辞書で無関係な文言まで誤検出しない。
const BANNED_WORDS = [
  "上昇",
  "下降",
  "新規ランクイン",
  "ランクイン",
  "陥落",
  "圏外",
  "最有力",
  "注目",
  "充実した",
  "激戦区",
];

function main() {
  const rankings: RankingsFile = JSON.parse(fs.readFileSync("data/rankings.json", "utf8"));
  const fighterRecords: FighterRecordsFile = JSON.parse(fs.readFileSync("data/fighterRecords.json", "utf8"));
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  const violations: string[] = [];

  for (const division of PUBLISHED_DIVISIONS) {
    const slug = DIVISION_SLUG[division];
    const data = rankings[slug];
    const view = resolveDivisionRankingView(getDivisionRankingView(data), nameBySlug);
    const copy = buildDivisionCopy(division, view, fighterRecords);
    const text = assembleDivisionCopyText(copy);

    for (const word of BANNED_WORDS) {
      if (text.includes(word)) {
        violations.push(`${division}: 禁止語「${word}」を検出`);
      }
    }
  }

  if (violations.length) {
    console.error(`[ランキング固有テキスト 禁止語検査] ★検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`[ランキング固有テキスト 禁止語検査] OK (公開${PUBLISHED_DIVISIONS.length}階級、禁止語${BANNED_WORDS.length}件のいずれも検出なし)`);
}

main();

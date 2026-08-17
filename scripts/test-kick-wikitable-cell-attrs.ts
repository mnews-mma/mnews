// PR-G(2026-08-17): PR-21.5(#559、fd6543b、wikitableセル属性による列ずれ)で実際に
// 起きた壊れ方 — アダム・ワット選手の記事で実測: {{Fight-cont|×|align=left|
// {{flagicon|NLD}} [[ロブ・カーマン]]|2R 2:18 KO|...}} のように、wikitableのセル属性
// (align=left等)がFight-cont行の位置引数として数えられてしまい、対戦相手欄にセル属性
// 文字列が入り、決着欄が相手名、大会名が決着、以降全フィールドが1つずつ後ろにずれていた
// — を合成フィクスチャで再現し、修正後ロジック(scripts/lib/kickWikitextMirror.ts、
// ingest_wikipedia.py _strip_cell_attrs()のTS移植)が列ずれを防げることを固定する
// 回帰テスト。
//
// 実行方法: npx tsx scripts/test-kick-wikitable-cell-attrs.ts
import { stripCellAttrsMirror } from "./lib/kickWikitextMirror";

let failures = 0;
function assertEqual<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`✗ ${label}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// PR-21.5本文の実例そのもの(mark|セル属性|相手|決着|大会名|日付 の6パーツ)。
const partsWithAttr = ["×", "align=left", "ロブ・カーマン", "2R 2:18 KO", "K-1 GRAND PRIX", "1993年4月30日"];
const stripped = stripCellAttrsMirror(partsWithAttr);
assertEqual(
  stripped,
  ["×", "ロブ・カーマン", "2R 2:18 KO", "K-1 GRAND PRIX", "1993年4月30日"],
  "align=left セル属性を除去して以降のフィールドの列ずれを防ぐ",
);
// 除去後、位置0=mark, 位置1=相手名になっている(セル属性を除去しないと位置1に
// "align=left"が入り、以降のフィールドが1つずつ後ろにずれたままになる)。
assertEqual(stripped[1], "ロブ・カーマン", "除去後、相手名フィールドが正しい位置(1番目)に来る");

// style/colspan等、他のセル属性キーも同様に除去できる。
assertEqual(
  stripCellAttrsMirror(["○", "style=\"text-align:left\"", "相手名"]),
  ["○", "相手名"],
  "style属性も除去できる",
);
assertEqual(stripCellAttrsMirror(["○", "colspan=2", "相手名"]), ["○", "相手名"], "colspan属性も除去できる");

// セル属性ではない通常のフィールド値は誤って除去しない(安全側の確認)。
// フランス語名の「=」区切り(ジャン=クロード)はセル属性のキー名(align/style等)で
// 始まらないため、除去対象にならない。
assertEqual(
  stripCellAttrsMirror(["○", "ジャン=クロード・リビエール", "判定"]),
  ["○", "ジャン=クロード・リビエール", "判定"],
  "「=」を含む通常の人名(ジャン=クロード)は誤って除去しない",
);

if (failures > 0) {
  console.error(`\n[test:kick-wikitable-cell-attrs] ${failures}件失敗しました。`);
  process.exit(1);
}
console.log("\n[test:kick-wikitable-cell-attrs] OK(全件成功)");

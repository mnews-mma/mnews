// PR-G(2026-08-17): PR-14(Wikipedia戦績パーサのネストテンプレートバグ修正)で実際に
// 起きた壊れ方 — {{仮リンク|名前|en|英語名}}のようなネストしたテンプレートを含む
// {{Fight-cont|...}}行が、そのテンプレート自身の"}}"で打ち切られ、決着・大会名・日付が
// 丸ごと空になっていた(out/kana-leg4-report.md: 修正前15,058行中594行が空) — を
// 合成wikitextフィクスチャで再現し、修正後ロジック(scripts/lib/kickWikitextMirror.ts、
// scripts/standup-pipeline/ingest_wikipedia.py find_fight_cont_blocks()のTS移植)が
// 正しく全フィールドを抽出できることを固定する回帰テスト。
//
// 実行方法: npx tsx scripts/test-kick-wikitext-nested-template.ts
import { findFightContBlocksLegacyBuggyMirror, findFightContBlocksMirror } from "./lib/kickWikitextMirror";

let failures = 0;
function assertTrue(cond: boolean, label: string, detail?: string) {
  if (!cond) {
    failures++;
    console.error(`✗ ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// PR-14本文の実例(対戦相手欄に{{仮リンク}}テンプレートがネストしたFight-cont行)。
const FIXTURE =
  "==戦績==\n" +
  "{{Fight-cont|×|{{仮リンク|ロブ・カーマン|en|Rob Kaman}}|2R 2:18 KO|K-1 GRAND PRIX '93|1993年4月30日}}\n" +
  "他のテキスト";

const blocks = findFightContBlocksMirror(FIXTURE);
assertTrue(blocks.length === 1, "Fight-contブロックを1件検出する", `検出数=${blocks.length}`);

const content = blocks[0]?.content ?? "";
// 新実装は"{{"のネスト深さを数えて真の終端(最後の"}}")まで抽出するため、
// ネストしたテンプレートの後ろにある決着・大会名・日付フィールドが欠落しない。
assertTrue(content.includes("1993年4月30日"), "ネストしたテンプレート以降の日付フィールドが欠落しない", content);
assertTrue(content.includes("K-1 GRAND PRIX"), "ネストしたテンプレート以降の大会名フィールドが欠落しない", content);
assertTrue(content.includes("2R 2:18 KO"), "ネストしたテンプレート以降の決着フィールドが欠落しない", content);

// 旧実装(非貪欲マッチ、PR-14修正前)は同じフィクスチャで実際に壊れることも確認する
// (この対比が無いと、新実装が「たまたま」通っているだけなのか判別できないため)。
const legacyBlocks = findFightContBlocksLegacyBuggyMirror(FIXTURE);
const legacyContent = legacyBlocks[0]?.content ?? "";
assertTrue(
  !legacyContent.includes("1993年4月30日"),
  "(対比)旧実装は同じフィクスチャで日付フィールドが欠落する再現ができる",
  legacyContent,
);

if (failures > 0) {
  console.error(`\n[test:kick-wikitext-nested-template] ${failures}件失敗しました。`);
  process.exit(1);
}
console.log("\n[test:kick-wikitext-nested-template] OK(全件成功)");

// 日本語版Wikipediaの戦績パース(src/lib/feeds/wikipedia.ts)のユニットテスト。
// 実行: npx tsx scripts/test-wikipedia-parser.ts
import { parseJaFightHistory } from "../src/lib/feeds/wikipedia";

let passes = 0;
let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// ── 1. 2026-07-13緊急修正: 太字疑似見出し'''アマチュア...'''もアマチュア戦として除去する ──
// (シェイドゥラエフの実データパターン: GAMMA: Asian-Pacific Championships 2022の
// 3試合が正式な==見出し==を伴わない'''アマチュア総合格闘技'''という太字テキストの
// 下に置かれており、既存のstripAmateurSections(==見出し==専用)では除去できず、
// 通算戦績カード(19-0、Wikipedia infobox由来)と「勝ち方の内訳」バー(history全体を
// 数えるため22戦分)が食い違う事故の原因になっていた)。
{
  const wikitext = `
=== 総合格闘技 ===
{{Fight-start}}
{{Fight-header}}
{{Fight-cont|○|久保優太|1R 4:13 TKO（パウンド）|RIZIN LANDMARK 13|2026年4月12日}}
{{Fight-end}}
<ref>出典</ref>

'''アマチュア総合格闘技'''
{{Fight-start}}
{{Fight-header}}
{{Fight-cont|○|イブラヒム・カスエフ|1R 2:26 三角絞め|GAMMA: Asian-Pacific Championships 2022|2022年11月12日}}
{{Fight-cont|○|アリジ・ベシ|1R 0:51 キムラロック|GAMMA: Asian-Pacific Championships 2022|2022年11月11日}}
{{Fight-end}}
<ref>出典2</ref>

== 獲得タイトル ==
`;
  const history = parseJaFightHistory(wikitext);
  check(history.length === 1, `太字疑似見出し: GAMMA(アマチュア)2試合を除去し、プロ戦1試合のみ残る (got ${history.length})`);
  check(
    history.every((h) => !h.event.includes("GAMMA")),
    "太字疑似見出し: GAMMA戦がhistoryに一切含まれない"
  );
  check(history[0]?.opponent === "久保優太", "太字疑似見出し: 正式な==見出し==下のプロ戦は正しく残る");
}

// ── 2. 回帰確認: 正式な==アマチュア...==見出しは従来どおり除去される ──
{
  const wikitext = `
=== 総合格闘技 ===
{{Fight-start}}
{{Fight-header}}
{{Fight-cont|○|A選手|1R KO|RIZIN.1|2020年1月1日}}
{{Fight-end}}

=== アマチュア総合格闘技 ===
{{Fight-start}}
{{Fight-header}}
{{Fight-cont|○|B選手|判定|大会|2019年1月1日}}
{{Fight-end}}

== 獲得タイトル ==
`;
  const history = parseJaFightHistory(wikitext);
  check(history.length === 1 && history[0].opponent === "A選手", "回帰: 正式な==見出し==のアマチュア節は従来どおり除去される");
}

// ── 3. 回帰確認: 「獲得タイトル」節内の無関係な'''太字'''テキストには反応しない ──
// (芳賀ビラル海の実データパターン: ==獲得タイトル==節に'''アマチュア'''という
// 太字の小見出しがあるが、これはFight-cont試合履歴とは無関係。総合格闘技節の
// 外にあるため、そもそもextractMmaSection/parseJaFightHistoryの対象範囲外になる)。
{
  const wikitext = `
=== 総合格闘技 ===
{{Fight-start}}
{{Fight-header}}
{{Fight-cont|○|A選手|1R KO|RIZIN.1|2020年1月1日}}
{{Fight-end}}

== 獲得タイトル ==
'''アマチュア'''
* 何かの大会 優勝
`;
  const history = parseJaFightHistory(wikitext);
  check(history.length === 1 && history[0].opponent === "A選手", "回帰: 総合格闘技節の外の'''アマチュア'''太字テキストは無関係(節の範囲外のため無影響)");
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);

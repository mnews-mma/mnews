// デプロイ前ゲート: イベントページの対戦カードで、選手名フォントサイズが
// 必ずページ単位のnameSizeOverride(events/[slug]/page.tsxが算出する
// ページ内共通サイズ)を経由して決まることを検査する。
//
// 経緯: nameSizeOverrideを無視してカード単体でfighterNameSize()を
// 計算し直すコード(戦績あり用のMatchupTape、戦績なし簡易表示用の
// EventBoutCardV2フォールバック分岐、それぞれ)が紛れ込むたび、そのカードだけ
// 他カードよりサイズがズレる回帰が2026-07-17に複数回発生した。判定は
// 正規表現ベースの簡易チェック(tscの型情報を使わない): 対象ファイル内で
// FighterNameTextへ渡すfontSize値・その元になる変数の代入行に、必ず
// "nameSizeOverride" という識別子が含まれていることを確認する。
import fs from "fs";
import path from "path";

const TARGET_FILES = [
  "src/components/matchup/MatchupTape.tsx",
  "src/components/matchup/EventBoutCardV2.tsx",
];

// fontSizeを決める行の候補: `fontSize={...}` 直書き、または
// `const xxxSize = ...` のようにfontSizeへ渡す変数を定義する行。
const FONT_SIZE_ASSIGN_RE = /fontSize=\{[^}]*\}|const\s+\w*[Ss]ize\s*=\s*.+;/g;

function main() {
  const violations: string[] = [];

  for (const rel of TARGET_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    const matches = content.match(FONT_SIZE_ASSIGN_RE) ?? [];
    if (matches.length === 0) {
      violations.push(`${rel}: fontSize指定が見つかりません(選手名サイズ描画自体が無くなっていないか確認してください)`);
      continue;
    }
    for (const m of matches) {
      // fighterNameSize()を直接使わない行(nickなど無関係な代入)はスキップ。
      if (!/fighterNameSize\(/.test(m)) continue;
      if (!m.includes("nameSizeOverride")) {
        violations.push(`${rel}: nameSizeOverrideを経由しないサイズ算出を検出: ${m.trim()}`);
      }
    }
  }

  if (violations.length) {
    console.error(
      `[イベントカード選手名サイズ検査] ★nameSizeOverrideを無視したサイズ算出を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}\n` +
        `イベントページの対戦カードは戦績あり/なしいずれの表示分岐でも、ページ単位のnameSizeOverride(events/[slug]/page.tsxで算出)を必ず経由してフォントサイズを決めてください。カード単体でfighterNameSize()を再計算すると、他カードとサイズがズレる回帰になります。`
    );
    process.exit(1);
  }

  console.log("[イベントカード選手名サイズ検査] OK");
}

main();

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
//
// 2026-07-18拡張: 上記は「ページ内で全選手名が同一サイズ」しか保証しない。
// nameSizeOverride自体がevents/[slug]/page.tsx側でページ内最長名から
// 算出されていた場合、大会をまたぐと絶対値が変わってしまう
// (例: LANDMARK15=13px / rizin-54=17px)。デザイン変更により「全イベント
// 横断で選手名フォントサイズを統一」する方針になったため、以下も追加検査する:
//   (a) events/[slug]/page.tsxのpageNameSizeが、ページ単位のMath.min再計算
//       ("pageNameSize = Math.min(pageNameSize, ..." 等)ではなく、
//       events.tsが全EVENTSから一度だけ算出するGLOBAL_FIGHTER_NAME_SIZE
//       定数をそのまま使っていること。
//   (b) GLOBAL_FIGHTER_NAME_SIZE自体が実際にEVENTS全体(全イベント・全カード)
//       から正しく算出された値と一致すること(events.ts側の計算式が壊れて
//       いないかをこのスクリプトが独立に再計算して照合する)。
// events/[slug]/page.tsxは全イベントで共有される単一のテンプレートなので、
// (a)(b)が成り立てば「どのイベントページでも同一フォントサイズ」が保証される。
import fs from "fs";
import path from "path";
import { EVENTS, GLOBAL_FIGHTER_NAME_SIZE } from "../src/lib/events";
import { fighterNameSize } from "../src/lib/vsMath";

const TARGET_FILES = [
  "src/components/matchup/MatchupTape.tsx",
  "src/components/matchup/EventBoutCardV2.tsx",
];

const EVENT_PAGE_FILE = "src/app/events/[slug]/page.tsx";

// fontSizeを決める行の候補: `fontSize={...}` 直書き、または
// `const xxxSize = ...` のようにfontSizeへ渡す変数を定義する行。
const FONT_SIZE_ASSIGN_RE = /fontSize=\{[^}]*\}|const\s+\w*[Ss]ize\s*=\s*.+;/g;

function checkNameSizeOverridePropagation(violations: string[]) {
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
}

function checkCrossEventUniformSize(violations: string[]) {
  const file = path.join(process.cwd(), EVENT_PAGE_FILE);
  if (!fs.existsSync(file)) {
    violations.push(`${EVENT_PAGE_FILE}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
    return;
  }
  const content = fs.readFileSync(file, "utf8");

  // (a) 旧ロジック(ページ内orderedBoutsからMath.minで都度算出)への差し戻し検出。
  if (/pageNameSize\s*=\s*Math\.min\(/.test(content)) {
    violations.push(
      `${EVENT_PAGE_FILE}: pageNameSizeをページ内のMath.min再計算で求めています(全イベント横断統一の方針に反する旧ロジックへの差し戻しの可能性)`
    );
  }
  // pageNameSizeがGLOBAL_FIGHTER_NAME_SIZEから代入されていることを確認。
  if (!/pageNameSize\s*=\s*GLOBAL_FIGHTER_NAME_SIZE\b/.test(content)) {
    violations.push(
      `${EVENT_PAGE_FILE}: pageNameSizeがGLOBAL_FIGHTER_NAME_SIZE(events.ts、全EVENTS横断で算出)から代入されていません`
    );
  }

  // (b) GLOBAL_FIGHTER_NAME_SIZE自体の値がEVENTS全体から正しく算出されているか、
  // このスクリプトで独立に再計算して照合する(events.ts側の計算式が壊れて
  // 特定イベントの値に固定されていないかを検出する)。
  let expected = 20;
  for (const event of EVENTS) {
    for (const b of event.bouts) {
      expected = Math.min(expected, fighterNameSize(b.fighterA), fighterNameSize(b.fighterB));
    }
  }
  if (GLOBAL_FIGHTER_NAME_SIZE !== expected) {
    violations.push(
      `src/lib/events.ts: GLOBAL_FIGHTER_NAME_SIZE(${GLOBAL_FIGHTER_NAME_SIZE})がEVENTS全体から算出される期待値(${expected})と一致しません`
    );
  }
}

function main() {
  const violations: string[] = [];

  checkNameSizeOverridePropagation(violations);
  checkCrossEventUniformSize(violations);

  if (violations.length) {
    console.error(
      `[イベントカード選手名サイズ検査] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}\n` +
        `イベントページの対戦カードは戦績あり/なしいずれの表示分岐でも、ページ単位のnameSizeOverrideを必ず経由してフォントサイズを決めてください。` +
        `またnameSizeOverrideの値自体は、ページ内最長名ではなく全イベント横断のGLOBAL_FIGHTER_NAME_SIZE(events.ts)を使い、どのイベントページでも同一のフォントサイズになるようにしてください。`
    );
    process.exit(1);
  }

  console.log("[イベントカード選手名サイズ検査] OK");
}

main();

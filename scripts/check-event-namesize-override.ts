// デプロイ前ゲート: Web側(オンページ)の選手名フォントサイズが
// 「サイト全体で単一の値(GLOBAL_FIGHTER_NAME_SIZE)」になっていることを検査する。
//
// 契約(2026-07-22 再確立):
//   - 選手名サイズは src/lib/events.ts の GLOBAL_FIGHTER_NAME_SIZE ただ1つ。
//     イベントページ内のカード間でも、ページ間(選手ページの次戦カード /
//     /events / /vs / /dream)でも、絶対に大きさが変わらない。
//   - カード描画コンポーネントは fighterNameSize() を直接呼ばない
//     (カードごと・ページごとに別サイズになる回帰の温床。過去5回再発)。
//   - GLOBAL_FIGHTER_NAME_SIZE は「最も厳しい1名」で決まるため、
//     折り返し計算の誤りや極端な表記1件でサイト全体が縮む。
//     下限(GLOBAL_NAME_SIZE_FLOOR)を割ったらビルドを止め、原因の名前を表示する。
//
// 経緯: 2026-07-22、区切りの無い長い名前(ステファン"スマッシュ")を
// fighterNameSize()が折り返し不能と誤判定し、全カードが11pxまで縮んだ。
// その対策として一度「カード単体で決める」方式(PR #182)に倒したが、
// 今度はイベントページ内でカードごとに大きさが変わりユーザー要件に反したため、
// 単一サイズへ戻した上で真因(折り返し判定)を修正した。
import fs from "fs";
import path from "path";
import { EVENTS, GLOBAL_FIGHTER_NAME_SIZE, GLOBAL_NAME_SIZE_FLOOR } from "../src/lib/events";
import { fighterNameSize, CEILING_WEB } from "../src/lib/vsMath";

// 選手名を描画する全コンポーネント + それを使うページ。
// これらの中で fighterNameSize() を直接呼んではいけない
// (サイズは必ず GLOBAL_FIGHTER_NAME_SIZE 経由)。
const NO_LOCAL_SIZE_FILES = [
  "src/components/matchup/MatchupTape.tsx",
  "src/components/matchup/EventBoutCardV2.tsx",
  "src/components/matchup/VsCard.tsx",
  "src/components/matchup/NextFightCardV2.tsx",
  "src/app/events/[slug]/page.tsx",
  "src/app/vs/[slugA]/[slugB]/page.tsx",
  "src/app/dream/page.tsx",
];

function checkNoLocalSizeComputation(violations: string[]) {
  for (const rel of NO_LOCAL_SIZE_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      const code = line.replace(/\/\/.*$/, ""); // 行コメントは除外
      if (/fighterNameSize\s*\(/.test(code)) {
        violations.push(
          `${rel}: コンポーネント/ページ側でfighterNameSize()を直接呼んでいます(サイズはGLOBAL_FIGHTER_NAME_SIZE経由に統一): ${line.trim()}`
        );
      }
    }
  }
}

// MatchupTape: 左右のFighterNameTextへ渡すfontSizeが単一の共有変数経由で、
// その共有変数がGLOBAL_FIGHTER_NAME_SIZEそのものであること。
function checkMatchupTapeUsesGlobal(violations: string[]) {
  const rel = "src/components/matchup/MatchupTape.tsx";
  const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  if (!/const\s+sharedNameSize\s*=\s*GLOBAL_FIGHTER_NAME_SIZE\s*;/.test(content)) {
    violations.push(`${rel}: sharedNameSizeがGLOBAL_FIGHTER_NAME_SIZEそのものではありません(単一サイズからの逸脱)`);
  }
  for (const m of content.match(/fontSize=\{[^}]*\}/g) ?? []) {
    if (!m.includes("sharedNameSize")) {
      violations.push(`${rel}: FighterNameTextへのfontSizeが共有変数(sharedNameSize)を経由していません: ${m}`);
    }
  }
}

// EventBoutCardV2(両者データ無しの簡易表示)も同じ単一サイズを使うこと。
function checkEventBoutFallbackUsesGlobal(violations: string[]) {
  const rel = "src/components/matchup/EventBoutCardV2.tsx";
  const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  if (!/const\s+sharedFallbackNameSize\s*=\s*GLOBAL_FIGHTER_NAME_SIZE\s*;/.test(content)) {
    violations.push(`${rel}: sharedFallbackNameSizeがGLOBAL_FIGHTER_NAME_SIZEそのものではありません(単一サイズからの逸脱)`);
  }
  for (const m of content.match(/fontSize=\{[^}]*\}/g) ?? []) {
    if (!m.includes("sharedFallbackNameSize")) {
      violations.push(`${rel}: 簡易表示のfontSizeが共有変数(sharedFallbackNameSize)を経由していません: ${m}`);
    }
  }
}

// ★本命の再発防止: 単一サイズが「1名の巻き添え」で異常に縮んでいないか。
// 下限を割った場合、原因になっている名前を全部出して人間が判断できるようにする。
function checkGlobalSizeFloor(violations: string[]) {
  if (GLOBAL_FIGHTER_NAME_SIZE >= GLOBAL_NAME_SIZE_FLOOR) return;

  const culprits: string[] = [];
  for (const event of EVENTS) {
    for (const b of event.bouts) {
      for (const name of [b.fighterA, b.fighterB]) {
        if (fighterNameSize(name) < GLOBAL_NAME_SIZE_FLOOR) {
          culprits.push(`「${name}」(${event.slug}) = ${fighterNameSize(name)}px`);
        }
      }
    }
  }
  violations.push(
    `GLOBAL_FIGHTER_NAME_SIZE(${GLOBAL_FIGHTER_NAME_SIZE}px)が下限(${GLOBAL_NAME_SIZE_FLOOR}px)を下回りました。` +
      `以下の名前がサイト全体のサイズを引き下げています:\n    ${[...new Set(culprits)].join("\n    ")}\n` +
      `  対処: (1) fighterNameSize()の折り返し判定が実際の描画(renderWrappableName)とズレていないか確認、` +
      `(2) 表記自体が異常(不要な記号・全角空白など)なら events.ts のデータを見直す。` +
      `下限を安易に下げるとサイト全体の選手名が小さくなります。`
  );
}

// fighterNameSize()自体が全EVENTSの実名に対して想定範囲に収まること。
function checkSizeRangeOverAllEvents(violations: string[]) {
  for (const event of EVENTS) {
    for (const b of event.bouts) {
      for (const name of [b.fighterA, b.fighterB]) {
        const size = fighterNameSize(name);
        if (!(size >= 11 && size <= CEILING_WEB)) {
          violations.push(`fighterNameSize("${name}") = ${size} が想定範囲(11〜${CEILING_WEB}px)外です`);
        }
      }
    }
  }
}

function main() {
  const violations: string[] = [];

  checkNoLocalSizeComputation(violations);
  checkMatchupTapeUsesGlobal(violations);
  checkEventBoutFallbackUsesGlobal(violations);
  checkGlobalSizeFloor(violations);
  checkSizeRangeOverAllEvents(violations);

  if (violations.length) {
    console.error(
      `[選手名サイズ検査(全サイト単一)] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}\n` +
        `Web側の選手名サイズはGLOBAL_FIGHTER_NAME_SIZE(events.ts)ただ1つです。` +
        `カード単体/ページ単体での再計算を追加しないでください。`
    );
    process.exit(1);
  }

  console.log(
    `[選手名サイズ検査(全サイト単一)] OK (GLOBAL_FIGHTER_NAME_SIZE=${GLOBAL_FIGHTER_NAME_SIZE}, floor=${GLOBAL_NAME_SIZE_FLOOR}, CEILING_WEB=${CEILING_WEB})`
  );
}

main();

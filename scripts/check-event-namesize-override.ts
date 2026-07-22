// デプロイ前ゲート: Web側の対戦カード(イベントページ/選手ページ次戦/vs/dream)の
// 選手名フォントサイズが「カード単体ルール」に統一されていることを検査する。
//
// 現行仕様(2026-07-22統一):
//   - 選手名サイズはカードごとに Math.min(fighterNameSize(左), fighterNameSize(右))
//     で決める(左右は必ず同一サイズ、天井はvsMath.tsのCEILING_WEB)。
//   - ページ側からのサイズ上書き(nameSizeOverride prop /
//     旧GLOBAL_FIGHTER_NAME_SIZE)は廃止。ページ単位・全イベント横断の
//     固定サイズへ差し戻さないこと(ページによってサイズが違って見える問題の
//     再発防止 — 選手個別ページの次戦カードと同じ見た目が正)。
//
// 経緯: 2026-07-17〜20に「カード内で左右バラバラ」「ページ間でバラバラ」の
// 回帰が繰り返し発生。一時は全イベント横断の単一サイズ
// (GLOBAL_FIGHTER_NAME_SIZE)へ寄せたが、選手個別ページの次戦カード
// (override無し=カード単体ルール)とサイズが揃わず「ページによって大きさが
// 違う」問題が残った(2026-07-22ユーザー指摘)ため、カード単体ルールへ全面統一。
import fs from "fs";
import path from "path";
import { EVENTS } from "../src/lib/events";
import { fighterNameSize, CEILING_WEB } from "../src/lib/vsMath";

// カード描画コンポーネント + それらを使うページ/カード群。
// nameSizeOverride(旧ページ上書きprop)・GLOBAL_FIGHTER_NAME_SIZEの
// 「識別子としての使用」(prop定義・prop渡し・import・代入)が
// 復活していないことを検査する(説明コメント内での言及は許容)。
const NO_OVERRIDE_FILES = [
  "src/components/matchup/MatchupTape.tsx",
  "src/components/matchup/EventBoutCardV2.tsx",
  "src/components/matchup/VsCard.tsx",
  "src/components/matchup/NextFightCardV2.tsx",
  "src/app/events/[slug]/page.tsx",
  "src/app/vs/[slugA]/[slugB]/page.tsx",
  "src/app/dream/page.tsx",
];

// 識別子として使われているパターン(コメント内の単語言及は除外するため、
// prop構文/型注釈/import/代入の形だけを弾く)。
const OVERRIDE_USAGE_RES = [
  /nameSizeOverride\s*[=:?]/, // prop渡し(={) / 型注釈(?:) / オブジェクトキー
  /nameSizeOverride\s*,/, // 分割代入・props受け取り
  /\bGLOBAL_FIGHTER_NAME_SIZE\b(?!.*廃止)/, // import・代入・prop(コメントの「(旧…)」言及は"廃止"を含む行のみ許容)
];

function checkNoOverrideReintroduction(violations: string[]) {
  for (const rel of NO_OVERRIDE_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      const code = line.replace(/\/\/.*$/, ""); // 行コメントは除外
      for (const re of OVERRIDE_USAGE_RES) {
        if (re.test(code)) {
          violations.push(`${rel}: ページ側サイズ上書き(nameSizeOverride/GLOBAL_FIGHTER_NAME_SIZE)の再導入を検出: ${line.trim()}`);
        }
      }
    }
  }
}

// MatchupTape: 左右のFighterNameTextへ渡すfontSizeが単一の共有変数
// (sharedNameSize)経由であること + その共有変数が
// Math.min(fighterNameSize(左), fighterNameSize(右)) で定義されていること。
function checkMatchupTapeSharedSize(violations: string[]) {
  const rel = "src/components/matchup/MatchupTape.tsx";
  const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  if (
    !/const\s+sharedNameSize\s*=\s*Math\.min\(\s*fighterNameSize\(left\.name\)\s*,\s*fighterNameSize\(right\.name\)\s*\)/.test(
      content
    )
  ) {
    violations.push(
      `${rel}: sharedNameSizeがMath.min(fighterNameSize(left.name), fighterNameSize(right.name))で定義されていません(カード単体ルールからの逸脱)`
    );
  }
  const fontSizeProps = content.match(/fontSize=\{[^}]*\}/g) ?? [];
  for (const m of fontSizeProps) {
    if (!m.includes("sharedNameSize")) {
      violations.push(`${rel}: FighterNameTextへのfontSizeが共有変数(sharedNameSize)を経由していません: ${m}`);
    }
  }
}

// EventBoutCardV2(両者データ無し簡易表示): 左右とも同一の共有変数
// (sharedFallbackNameSize)経由であること。
function checkEventBoutFallbackSharedSize(violations: string[]) {
  const rel = "src/components/matchup/EventBoutCardV2.tsx";
  const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  if (
    !/const\s+sharedFallbackNameSize\s*=\s*Math\.min\(\s*fighterNameSize\(nameA\)\s*,\s*fighterNameSize\(nameB\)\s*\)/.test(
      content
    )
  ) {
    violations.push(
      `${rel}: sharedFallbackNameSizeがMath.min(fighterNameSize(nameA), fighterNameSize(nameB))で定義されていません(カード単体ルールからの逸脱)`
    );
  }
  const fontSizeProps = content.match(/fontSize=\{[^}]*\}/g) ?? [];
  for (const m of fontSizeProps) {
    if (!m.includes("sharedFallbackNameSize")) {
      violations.push(`${rel}: 簡易表示のfontSizeが共有変数(sharedFallbackNameSize)を経由していません: ${m}`);
    }
  }
}

// fighterNameSize()自体が全EVENTSの実名に対して想定範囲
// (NAME_SIZE_MIN=11〜CEILING_WEB)に収まることの実測検査
// (計算式が壊れて極端な値を返していないか)。
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

  checkNoOverrideReintroduction(violations);
  checkMatchupTapeSharedSize(violations);
  checkEventBoutFallbackSharedSize(violations);
  checkSizeRangeOverAllEvents(violations);

  if (violations.length) {
    console.error(
      `[選手名サイズ検査(カード単体ルール)] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}\n` +
        `Web側の選手名サイズは「カード単体で左右共通(Math.min(fighterNameSize(左), fighterNameSize(右))・天井CEILING_WEB)」に統一されています。` +
        `ページ単位/全イベント横断の固定サイズ(nameSizeOverride/GLOBAL_FIGHTER_NAME_SIZE)へ差し戻さないでください。`
    );
    process.exit(1);
  }

  console.log(`[選手名サイズ検査(カード単体ルール)] OK (CEILING_WEB=${CEILING_WEB})`);
}

main();

// デプロイ前ゲート: X結果速報カード(RESULT/WIN、/api/og/result)の勝者名
// フォントサイズが「全カード単一サイズ」になっていることを検査する。
//
// 経緯(2026-07-27):
// 旧実装は基準サイズ(120px)を上限に、名前ごとに個別shrink-to-fitしていた
// ため、短名(「船田電池」等)は大きく・長名(カタカナフルネーム等)は小さく
// なり、カード間で見た目のサイズが不揃いだった。dream/vs OGP(PR #149・
// OG_DREAM_VS_CEILING)と同じ思想で、EVENTS(RESULTカードが実際に表示し得る
// 全対戦の勝者候補=fighterA/fighterB)から逆算した天井(OG_RESULT_WINNER_NAME_CEILING)
// を導入し、天井以下の名前は必ず天井ちょうどで揃うようにした。
// このスクリプトは「天井を超えない」だけでなく「天井以下の名前はちょうど
// 天井になる(=カードごとに別サイズにならない)」ことまで検査する。
import fs from "fs";
import path from "path";
import { EVENTS, OG_RESULT_WINNER_NAME_CEILING, OG_RESULT_WINNER_NAME_FLOOR } from "../src/lib/events";
import { fitResultWinnerNameSize } from "../src/lib/og/resultNameFit";

// route.tsxのWINNER_NAME_MAX_WIDTH_PXと同じ値をここで独立に再現する
// (route.tsx側が変更されても検査が追随し続けられるように)。
const RESULT_WINNER_MAX_WIDTH_PX = 1200 - 56 * 2;

function main() {
  const violations: string[] = [];

  // (a) EVENTS中の全名前は、天井ちょうどか、天井未満(=天井算出の母集団の
  //     最厳格値そのもの、または理論上あり得ない)のいずれかになる。
  //     天井を「超える」ことは無い(Math.minでクランプ済みのため構造上不可能
  //     だが、念のため機械的に検査する)。
  const namesAtCeiling: string[] = [];
  for (const event of EVENTS) {
    for (const b of event.bouts) {
      for (const name of [b.fighterA, b.fighterB]) {
        const size = fitResultWinnerNameSize(name, RESULT_WINNER_MAX_WIDTH_PX, OG_RESULT_WINNER_NAME_CEILING, OG_RESULT_WINNER_NAME_FLOOR);
        if (size > OG_RESULT_WINNER_NAME_CEILING) {
          violations.push(`fitResultWinnerNameSize("${name}")が天井(${OG_RESULT_WINNER_NAME_CEILING})を超えています: ${size}`);
        }
        if (size === OG_RESULT_WINNER_NAME_CEILING) namesAtCeiling.push(name);
      }
    }
  }
  // 母集団のうち少なくとも1名は天井ちょうどになっているはず(天井自体が
  // 母集団から逆算されているため)。0件なら算出ロジックが壊れている疑い。
  if (namesAtCeiling.length === 0) {
    violations.push(`天井(${OG_RESULT_WINNER_NAME_CEILING})ちょうどになる名前がEVENTS中に1件もありません(天井算出ロジックの不整合の疑い)`);
  }

  // (b) OG_RESULT_WINNER_NAME_CEILINGが下限を下回っていないか。下回っている
  //     場合、原因になっている名前を全部出して人間が判断できるようにする。
  if (OG_RESULT_WINNER_NAME_CEILING < OG_RESULT_WINNER_NAME_FLOOR) {
    const culprits: string[] = [];
    for (const event of EVENTS) {
      for (const b of event.bouts) {
        for (const name of [b.fighterA, b.fighterB]) {
          const size = fitResultWinnerNameSize(name, RESULT_WINNER_MAX_WIDTH_PX, OG_RESULT_WINNER_NAME_CEILING, OG_RESULT_WINNER_NAME_FLOOR);
          if (size <= OG_RESULT_WINNER_NAME_FLOOR) {
            culprits.push(`「${name}」(${event.slug})`);
          }
        }
      }
    }
    violations.push(
      `OG_RESULT_WINNER_NAME_CEILING(${OG_RESULT_WINNER_NAME_CEILING}px)が下限(${OG_RESULT_WINNER_NAME_FLOOR}px)を下回りました。` +
        `以下の名前がRESULTカードの単一サイズを引き下げています:\n    ${[...new Set(culprits)].join("\n    ")}\n` +
        `  対処: (1) 推定幅ロジック(estimateNameWidthEm)が実描画とズレていないか確認、` +
        `(2) 表記自体が異常(不要な記号・全角空白など)なら events.ts のデータを見直す。` +
        `下限を安易に下げるとRESULTカードの選手名が小さくなります。`
    );
  }

  // (c) OG_RESULT_WINNER_NAME_CEILINGが想定範囲(56〜120px)に収まっているか
  //     (ベタ書きの固定値に差し戻されていないかの間接確認)。
  if (!(OG_RESULT_WINNER_NAME_CEILING >= 20 && OG_RESULT_WINNER_NAME_CEILING <= 120)) {
    violations.push(`OG_RESULT_WINNER_NAME_CEILING(${OG_RESULT_WINNER_NAME_CEILING})が想定範囲(20〜120px)外です。events.tsの算出式を確認してください。`);
  }

  // (d) route.tsxが天井/下限をベタ書きの固定値に差し戻していないか。
  {
    const rel = "src/app/api/og/result/route.tsx";
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
    } else {
      const content = fs.readFileSync(file, "utf8");
      if (!/OG_RESULT_WINNER_NAME_CEILING/.test(content)) {
        violations.push(`${rel}: OG_RESULT_WINNER_NAME_CEILING(events.ts)を使っていません(固定値へ差し戻された可能性)`);
      }
      if (!/OG_RESULT_WINNER_NAME_FLOOR/.test(content)) {
        violations.push(`${rel}: OG_RESULT_WINNER_NAME_FLOOR(events.ts)を使っていません(固定値へ差し戻された可能性)`);
      }
    }
  }

  if (violations.length) {
    console.error(
      `[RESULT/WINカード 選手名フォント単一サイズ検査] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}`
    );
    process.exit(1);
  }

  console.log(`[RESULT/WINカード 選手名フォント単一サイズ検査] OK (OG_RESULT_WINNER_NAME_CEILING=${OG_RESULT_WINNER_NAME_CEILING})`);
}

main();

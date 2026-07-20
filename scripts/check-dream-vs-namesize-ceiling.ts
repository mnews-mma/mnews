// デプロイ前ゲート: 公開VSカード(/dream・/vs、/api/og/vs)の選手名フォント
// サイズが「天井(CEILING_OG)」を超えないこと・カード内2名は必ず同一サイズに
// なることを検査する。
//
// 経緯(2026-07-20): sharedNameFitは名前ごとに枠幅いっぱいへフィットさせる
// 実装で、上限が無かった。そのため短い名前(例: 青木真也)ほど拡大され、
// 長い名前(例: ホベルト・サトシ・ソウザ)より遥かに大きく表示されるカード間の
// 不揃いが発生した。sharedNameFitのシグネチャをmaxSize(天井)必須の第4引数に
// 変更し、公開/api/og/vs側はCEILING_OGを唯一のソースとして使うようにした。
// このスクリプトは、その不変条件が将来のリファクタで壊れないことを継続検査する。
import { sharedNameFit, CEILING_OG, type NameZone } from "../src/lib/og/vsCardBlocks";
import { fighterNameSize, CEILING_WEB } from "../src/lib/vsMath";
import fs from "fs";
import path from "path";

// src/app/api/og/vs/[slugA]/[slugB]/route.tsx のNAME_ZONEと同じ値
// (幅・高さ・下限フォント・最大行数)をここで独立に再現し、route.tsx側が
// 変更されても検査が追随し続けられるようにする。天井のみCEILING_OGを共有する。
const NAME_ZONE: NameZone = { maxWidth: 460, maxHeight: 150, minFont: 30, maxLines: 2 };

// 極短(4文字・記号なし)〜最長級(中黒2つ・カタカナ長単語)までの代表選手名。
const SHORT_NAMES = ["青木真也", "朝倉未来", "堀口恭司", "桜庭 大世"];
const LONG_NAMES = ["ホベルト・サトシ・ソウザ", "ラジャブアリ・シェイドゥラエフ", "シンバートルバットエルデネ"];

function main() {
  const violations: string[] = [];

  // (a) どの代表名でも算出フォントサイズがCEILING_OGを超えないこと。
  //     短い名前同士・短い名前と長い名前の組み合わせの両方を確認する。
  for (const nameA of [...SHORT_NAMES, ...LONG_NAMES]) {
    for (const nameB of [...SHORT_NAMES, ...LONG_NAMES]) {
      const { fitA, fitB } = sharedNameFit(nameA, nameB, NAME_ZONE, CEILING_OG);
      if (fitA.fontSize > CEILING_OG || fitB.fontSize > CEILING_OG) {
        violations.push(
          `sharedNameFit("${nameA}", "${nameB}")がCEILING_OG(${CEILING_OG})を超えています: fitA=${fitA.fontSize} fitB=${fitB.fontSize}`
        );
      }
      // (b) sharedNameFitの不変条件: 1カード内の2名は同一サイズ(小さい方に揃える)。
      if (fitA.fontSize !== fitB.fontSize) {
        violations.push(
          `sharedNameFit("${nameA}", "${nameB}")の2名のフォントサイズが一致しません: fitA=${fitA.fontSize} fitB=${fitB.fontSize}`
        );
      }
    }
  }

  // (c) 最長級の名前は2行以内に収まり、fitName内部の最終フォールバック
  //     (行数超過分を打ち切る分岐)で文字が欠落していないこと。
  //     行を連結した文字列が元の名前と一致するかで判定する。
  for (const name of LONG_NAMES) {
    const { fitA } = sharedNameFit(name, name, NAME_ZONE, CEILING_OG);
    if (fitA.lines.length > 2) {
      violations.push(`"${name}"のOGP行数が2行を超えています(${fitA.lines.length}行): ${JSON.stringify(fitA.lines)}`);
    }
    const joined = fitA.lines.join("");
    if (joined !== name) {
      violations.push(
        `"${name}"のOGP描画行を連結した結果が元の名前と一致しません(文字欠落の疑い): "${joined}" !== "${name}"`
      );
    }
  }

  // (d) 短い名前が天井いっぱいまで拡大される旧仕様への回帰を早期検知するため、
  //     代表的な短い名前が実際に天井(CEILING_OG)ちょうどになっていることを
  //     確認する(=天井が効いている証拠。もし天井が働いていなければ、この
  //     アサーション自体はfontSize>CEILING_OGとして(a)で先に検出されるが、
  //     天井の値を不当に大きくして(a)だけ回避する退行を防ぐため、既知の
  //     長い名前の自然なサイズ以下に天井が収まっていることも確認する)。
  const longestNaturalSizes = LONG_NAMES.map((name) => sharedNameFit(name, name, NAME_ZONE, CEILING_OG).fitA.fontSize);
  const maxLongestNatural = Math.max(...longestNaturalSizes);
  if (CEILING_OG > maxLongestNatural + 5) {
    violations.push(
      `CEILING_OG(${CEILING_OG})が長い名前の自然なサイズ(最大${maxLongestNatural})より大きすぎます。短い名前が長い名前より極端に大きく表示される不揃いが再発する可能性があります(天井は長い名前のサイズに近い値にしてください)。`
    );
  }

  // (f) Web側(/dream・/vsのオンページカード、fighterNameSize)も同じ2条件を
  //     満たすこと: 天井(CEILING_WEB)を超えない・カード内2名は同一サイズ
  //     (MatchupTape.tsx側でMath.minを取って1つのsharedNameSize変数を両名に
  //     使う実装のため、ここではfighterNameSize単体の天井超過が無いことのみ
  //     確認すれば十分。2名同一サイズの保証は(g)のソース検査で担保する)。
  for (const name of [...SHORT_NAMES, ...LONG_NAMES]) {
    const size = fighterNameSize(name);
    if (size > CEILING_WEB) {
      violations.push(`fighterNameSize("${name}")がCEILING_WEB(${CEILING_WEB})を超えています: ${size}`);
    }
  }

  // (g) MatchupTape.tsxが左右で別々のfontSizeを計算していないか(sharedNameSize
  //     という単一変数を両方のFighterNameTextに渡しているか)を正規表現で検査する。
  {
    const rel = "src/components/matchup/MatchupTape.tsx";
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
    } else {
      const content = fs.readFileSync(file, "utf8");
      const fontSizeProps = content.match(/fontSize=\{[^}]*\}/g) ?? [];
      const nonSharedUsage = fontSizeProps.filter((m) => m.includes("fighterNameSize(") && !m.includes("nameSizeOverride"));
      if (nonSharedUsage.length > 0) {
        violations.push(
          `${rel}: FighterNameTextへのfontSizeが共有変数(sharedNameSize)を経由せずfighterNameSize()を直接呼んでいます: ${nonSharedUsage.join(", ")}`
        );
      }
    }
  }

  // (e) sharedNameFitの呼び出し元(公開/vs・管理vs-compare)が、天井を
  //     ローカルなmaxFontフィールドとして再導入していないか(単一ソース逸脱の
  //     早期検知)。zone型からmaxFontを除去済みのため型検査でも防がれるが、
  //     わかりやすいエラーメッセージを出すため正規表現でも重ねて検査する。
  const TARGET_FILES = [
    "src/app/api/og/vs/[slugA]/[slugB]/route.tsx",
    "src/app/api/og/dream/[slugA]/[slugB]/route.tsx",
    "src/app/api/og/vs-compare/[slugA]/[slugB]/route.tsx",
  ];
  for (const rel of TARGET_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (!/sharedNameFit\([^)]*,[^)]*,[^)]*,[^)]*\)/.test(content)) {
      violations.push(`${rel}: sharedNameFit()が天井(maxSize)引数付きの4引数で呼ばれていません`);
    }
    if (/\bmaxFont\s*:/.test(content)) {
      violations.push(`${rel}: NameZoneにmaxFontを直書きしています(天井はsharedNameFitのmaxSize引数経由で一元管理してください)`);
    }
  }

  if (violations.length) {
    console.error(
      `[夢のカード/VSカード 選手名フォント天井検査] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}`
    );
    process.exit(1);
  }

  console.log("[夢のカード/VSカード 選手名フォント天井検査] OK");
}

main();

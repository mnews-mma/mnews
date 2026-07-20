// デプロイ前ゲート: 公開VSカード(/dream・/vs、/api/og/vs・/api/og/dream)の
// 選手名フォントサイズが「全カード単一サイズ」になっていることを検査する。
//
// 経緯(2026-07-20、PR-A→PR-C):
// 1st fix(PR-A): sharedNameFitに固定天井(CEILING_OG=63のベタ書き)を導入し、
// 短い名前(青木真也)が枠幅いっぱいに拡大される不揃いは止めた。しかし天井
// そのものが長い名前(サトシ・ソウザ=63px)より緩かったため、天井以下の名前は
// カードごとに別々のサイズになる不揃いが残っていた。
// 2nd fix(PR-C、本ファイル): 天井を63のベタ書きから、events.tsの
// OG_DREAM_VS_CEILING(EVENTS参照セットの最長名から逆算・GLOBAL_FIGHTER_NAME_SIZE
// と同思想)に変更。天井以下の名前は「天井ちょうど」で揃うようになり、初めて
// 真に単一サイズになった。Web側(/dream・/vsのオンページカード)も同じPRで
// events.tsのGLOBAL_FIGHTER_NAME_SIZEをnameSizeOverride経由で強制し単一化。
// このスクリプトは「天井を超えない」だけでなく「天井以下の名前はちょうど
// 天井になる(=カードごとに別サイズにならない)」ことまで検査する
// (前者だけのassertでは今回の不揃いを検出できなかったため強化)。
import { sharedNameFit, type NameZone } from "../src/lib/og/vsCardBlocks";
import { OG_DREAM_VS_CEILING, GLOBAL_FIGHTER_NAME_SIZE } from "../src/lib/events";
import fs from "fs";
import path from "path";

// src/app/api/og/vs・og/dream route.tsxのNAME_ZONEと同じ値(幅・高さ・下限
// フォント・最大行数)をここで独立に再現する(route.tsx側が変更されても検査が
// 追随し続けられるように。天井のみOG_DREAM_VS_CEILINGを共有する)。
const NAME_ZONE: NameZone = { maxWidth: 460, maxHeight: 150, minFont: 30, maxLines: 2 };

// 天井(OG_DREAM_VS_CEILING)以下に収まるはずの代表名(極短〜サトシ・ソウザ級)。
// いずれも「天井ちょうど」のサイズになることを期待する。
const WITHIN_CEILING_NAMES = [
  "青木真也",
  "朝倉未来",
  "堀口恭司",
  "桜庭 大世",
  "ホベルト・サトシ・ソウザ",
  "ラジャブアリ・シェイドゥラエフ",
];
// 天井の算出根拠(EVENTS参照セット)に無い、それより長い極端な例。
// 天井には届かず、天井未満の自然なサイズになることを期待する。
const BEYOND_CEILING_NAMES = ["シンバートルバットエルデネ"];

function main() {
  const violations: string[] = [];

  // (a) 天井以下の代表名は、どの組み合わせでも「天井ちょうど」のサイズになる
  //     こと(=カードごとに別サイズにならない、真の単一サイズ)。
  //     「天井を超えない」だけのassertだと、天井以下で複数の値に散らばる
  //     今回の不揃いパターンを検出できないため、等号で検査する。
  for (const nameA of WITHIN_CEILING_NAMES) {
    for (const nameB of WITHIN_CEILING_NAMES) {
      const { fitA, fitB } = sharedNameFit(nameA, nameB, NAME_ZONE, OG_DREAM_VS_CEILING);
      if (fitA.fontSize !== OG_DREAM_VS_CEILING || fitB.fontSize !== OG_DREAM_VS_CEILING) {
        violations.push(
          `sharedNameFit("${nameA}", "${nameB}")が天井(${OG_DREAM_VS_CEILING})ちょうどになっていません: fitA=${fitA.fontSize} fitB=${fitB.fontSize}`
        );
      }
    }
  }

  // (b) 天井より長い極端な名前は、天井"未満"になること(天井を超えないことの
  //     確認は当然として、天井ちょうどに強制されて2行に収まらなくなる
  //     ケースが無いことも兼ねて確認する)。
  for (const name of BEYOND_CEILING_NAMES) {
    const { fitA } = sharedNameFit(name, name, NAME_ZONE, OG_DREAM_VS_CEILING);
    if (fitA.fontSize >= OG_DREAM_VS_CEILING) {
      violations.push(
        `"${name}"(天井算出根拠の外側の極端な例)が天井(${OG_DREAM_VS_CEILING})未満になっていません: ${fitA.fontSize}`
      );
    }
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

  // (c) OG_DREAM_VS_CEILINGがベタ書きの固定値に差し戻されていないか
  //     (events.tsのEVENTS参照セットから逆算される値であることの間接確認)。
  //     妥当な範囲(20〜108px)に収まっているかだけを機械的に検査する
  //     (具体的な数値はEVENTSの中身が変わるたびに変わり得るため固定しない)。
  if (!(OG_DREAM_VS_CEILING >= 20 && OG_DREAM_VS_CEILING <= 108)) {
    violations.push(`OG_DREAM_VS_CEILING(${OG_DREAM_VS_CEILING})が想定範囲(20〜108px)外です。events.tsの算出式を確認してください。`);
  }
  if (!(GLOBAL_FIGHTER_NAME_SIZE >= 11 && GLOBAL_FIGHTER_NAME_SIZE <= 20)) {
    violations.push(`GLOBAL_FIGHTER_NAME_SIZE(${GLOBAL_FIGHTER_NAME_SIZE})が想定範囲(11〜20px)外です。events.tsの算出式を確認してください。`);
  }

  // (d) sharedNameFitの呼び出し元(公開/vs・/dream・管理vs-compare)が、天井を
  //     ローカルなmaxFontフィールドとして再導入していないか(単一ソース逸脱の
  //     早期検知)。zone型からmaxFontを除去済みのため型検査でも防がれるが、
  //     わかりやすいエラーメッセージを出すため正規表現でも重ねて検査する。
  const OG_ROUTE_FILES = [
    "src/app/api/og/vs/[slugA]/[slugB]/route.tsx",
    "src/app/api/og/dream/[slugA]/[slugB]/route.tsx",
    "src/app/api/og/vs-compare/[slugA]/[slugB]/route.tsx",
  ];
  for (const rel of OG_ROUTE_FILES) {
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
  {
    const rel = "src/app/api/og/vs/[slugA]/[slugB]/route.tsx";
    const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    if (!/OG_DREAM_VS_CEILING/.test(content)) {
      violations.push(`${rel}: OG_DREAM_VS_CEILING(events.ts)を使っていません(固定値へ差し戻された可能性)`);
    }
  }
  {
    const rel = "src/app/api/og/dream/[slugA]/[slugB]/route.tsx";
    const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    if (!/OG_DREAM_VS_CEILING/.test(content)) {
      violations.push(`${rel}: OG_DREAM_VS_CEILING(events.ts)を使っていません(固定値へ差し戻された可能性)`);
    }
  }

  // (e) Web側(/dream・/vs)のページが、VsCardへ必ずnameSizeOverride
  //     (GLOBAL_FIGHTER_NAME_SIZE)を渡していること。渡し忘れるとそのページ
  //     だけ従来のカード単体計算(fighterNameSize経由)に戻り、単一サイズが
  //     崩れる。
  const WEB_PAGE_FILES = [
    "src/app/dream/page.tsx",
    "src/app/vs/[slugA]/[slugB]/page.tsx",
  ];
  for (const rel of WEB_PAGE_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
      violations.push(`${rel}: ファイルが見つかりません(対象ファイル名が変わった場合はこのスクリプトも更新してください)`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (!/GLOBAL_FIGHTER_NAME_SIZE/.test(content)) {
      violations.push(`${rel}: GLOBAL_FIGHTER_NAME_SIZE(events.ts)をimportしていません`);
    }
    if (!/nameSizeOverride=\{GLOBAL_FIGHTER_NAME_SIZE\}/.test(content)) {
      violations.push(`${rel}: <VsCard>へnameSizeOverride={GLOBAL_FIGHTER_NAME_SIZE}を渡していません`);
    }
  }

  // (f) VsCard.tsxがnameSizeOverrideを受け取り、MatchupTapeへ転送している
  //     こと(プロップのバケツリレーが途中で切れていないか)。
  {
    const rel = "src/components/matchup/VsCard.tsx";
    const content = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    if (!/nameSizeOverride=\{nameSizeOverride\}/.test(content)) {
      violations.push(`${rel}: <MatchupTape>へnameSizeOverride={nameSizeOverride}を転送していません`);
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

  if (violations.length) {
    console.error(
      `[夢のカード/VSカード 選手名フォント単一サイズ検査] ★問題を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}`
    );
    process.exit(1);
  }

  console.log(`[夢のカード/VSカード 選手名フォント単一サイズ検査] OK (OG_DREAM_VS_CEILING=${OG_DREAM_VS_CEILING}, GLOBAL_FIGHTER_NAME_SIZE=${GLOBAL_FIGHTER_NAME_SIZE})`);
}

main();

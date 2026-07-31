// normalizeFinishText(決着欄の記号・単位の字面統一)の固定入出力テスト。
// 4団体data/*.json(methodRaw、10,062件/ユニーク4,611種)を全件分類した結果、
// 語順まで統一する案は指示書の4カテゴリに収まらないパターンが約42%あり
// 断念した(2026-07-31)。代わりに「記号と単位の字面だけ」を対象にした
// 狭いスコープに変更している。ここではその字面正規化と、既存の
// normalizeDecisionScorePerspective(判定スコアの視点並べ替え)を
// 「字面正規化→視点並べ替え」の順で適用した最終出力を固定する。
import { normalizeFinishText } from "../src/lib/finishTextNormalize";
import { normalizeDecisionScorePerspective } from "../src/lib/decisionScorePerspective";

interface Case {
  input: string;
  expected: string;
  note: string;
}

// 1. 分/秒記号→漢字単位
const timeMarkCases: Case[] = [
  { input: "3R 2’38” TKO", expected: "3R 2分38秒 TKO", note: "カーリークォート(デコード後の標準形)" },
  { input: "1R 3’13” TKO", expected: "1R 3分13秒 TKO", note: "カーリークォート" },
  { input: "2R 3′ 12″ 判定0-2", expected: "2R 3分12秒 判定0-2", note: "プライム記号+間に空白" },
  { input: "2R 3`17” TKO", expected: "2R 3分17秒 TKO", note: "バッククォート(スクレイパー表記ゆれ)" },
  { input: "2R 4’08” TKO", expected: "2R 4分08秒 TKO", note: "ゼロ埋め秒" },
];

// 2. 未知の二重アーティファクト(壊れた変換より素通し優先)
const garbledPassthroughCases: Case[] = [
  { input: "2R 4’分’09”秒” TKO", expected: "2R 4’分’09”秒” TKO", note: "分秒の漢字と記号が混在した既知の破損データ" },
  { input: "2R 0”59” TKO", expected: "2R 0”59” TKO", note: "開始記号が秒側(”)のみで分秒判別不能" },
  { input: "1R 1’20”秒” TKO", expected: "1R 1’20”秒” TKO", note: "秒の直後に別の引用符が続く二重アーティファクト" },
];

// 3. ダッシュ類→半角ハイフン
const dashCases: Case[] = [
  { input: "判定3－0", expected: "判定3-0", note: "全角ハイフンマイナス" },
  { input: "判定3‐0", expected: "判定3-0", note: "HYPHEN(U+2010)" },
  { input: "判定 0ｰ3", expected: "判定0-3", note: "半角カナ長音がダッシュ代わりに混入" },
  { input: "TKO レフェリーストップ", expected: "TKO レフェリーストップ", note: "カタカナ長音(ー)は対象外・誤爆しない" },
];

// 4. 判定の囲み・コロン・スペースを外す
const judgeWrapCases: Case[] = [
  { input: "[判定0-3]", expected: "判定0-3", note: "角括弧" },
  { input: "[判定0-3] ※18-20×3", expected: "判定0-3 ※18-20×3", note: "角括弧+※以降は保持" },
  { input: "（判定：3-0）", expected: "判定3-0", note: "全角括弧+全角コロン" },
  { input: "（判定3-0）", expected: "判定3-0", note: "全角括弧のみ" },
  { input: "判定 3-0", expected: "判定3-0", note: "スペース区切り" },
  { input: "3R 判定（3-0）", expected: "3R 判定3-0", note: "ラウンド接頭+全角括弧" },
  { input: "3R 判定(3-0)", expected: "3R 判定3-0", note: "ラウンド接頭+半角括弧" },
  { input: "判定3-0 ※三者とも20-18", expected: "判定3-0 ※三者とも20-18", note: "※以降は原文保持" },
];

// 5. 残った全角括弧・全角コロン・連続空白の正規化(判定以外にも適用)
const generalWidthCases: Case[] = [
  { input: "S 1R 4分58秒（タップアウト：肩固め）", expected: "S 1R 4分58秒(タップアウト:肩固め)", note: "S接頭辞・構造は不変、括弧とコロンのみ半角化" },
  { input: "（2R 腕十字）", expected: "(2R 腕十字)", note: "判定以外の全角括弧も半角化" },
  { input: "判定3-0 （20-17・20-17・20-17）", expected: "判定3-0 (20-17・20-17・20-17)", note: "中点(・)は対象外のまま保持" },
];

// 6. 対象外(素通し)カテゴリ: 延長R・不戦勝・反則失格・テクニカル判定・
//    S/TS接頭辞・コロン時間形式・語順そのもの
const outOfScopePassthroughCases: Case[] = [
  { input: "延長3分00秒、判定/2-0", expected: "延長3分00秒、判定/2-0", note: "延長ラウンドは語順・区切りとも不変" },
  { input: "EXR 3:00、判定/3-0", expected: "EXR 3:00、判定/3-0", note: "延長ラウンド表記(EXR)・コロン時間は対象外" },
  { input: "不戦勝", expected: "不戦勝", note: "決着区分そのもの" },
  { input: "反則失格", expected: "反則失格", note: "決着区分そのもの" },
  { input: "テクニカル判定", expected: "テクニカル判定", note: "「判定」を含むが囲み無しなので無変換" },
  { input: "TS リアネイキッドチョーク", expected: "TS リアネイキッドチョーク", note: "サブミッション接頭辞は語順不変" },
  { input: "1R 2:06、ギブアップ/チョークスリーパー", expected: "1R 2:06、ギブアップ/チョークスリーパー", note: "コロン時間形式は対象外(分/秒記号ではない)" },
  { input: "TKO 1R 3分50秒 ※パンチ", expected: "TKO 1R 3分50秒 ※パンチ", note: "方式が先に来る語順もそのまま許容" },
  { input: "", expected: "", note: "空文字列" },
  { input: "●", expected: "●", note: "スクレイパー抽出バグの疑いがある記号混入(別スコープで対応予定・ここでは素通し確認のみ)" },
];

const allCases: Case[] = [
  ...timeMarkCases,
  ...garbledPassthroughCases,
  ...dashCases,
  ...judgeWrapCases,
  ...generalWidthCases,
  ...outOfScopePassthroughCases,
];

// normalizeDecisionScorePerspective との合成(字面正規化→視点並べ替えの順)。
// 本番のtoBoutRow()と同じ適用順序をここで固定する。
interface CombinedCase {
  input: string;
  result: "win" | "loss" | "draw" | "nc";
  expected: string;
  note: string;
}

const combinedCases: CombinedCase[] = [
  {
    input: "[判定0-3]",
    result: "win",
    expected: "判定3-0",
    // 字面正規化で「判定0-3」になった後、勝者視点(大きい数が先)に
    // 並べ替えられる。normalizeDecisionScorePerspectiveの区切り文字許容
    // ([^0-9]{0,6})は正規化後の「判定」+数字(区切り文字0文字)でも
    // 問題なくマッチすることを確認する。
    note: "囲み除去後に視点並べ替えが機能すること",
  },
  {
    input: "判定 0-3",
    result: "loss",
    expected: "判定0-3",
    note: "敗者視点は小さい数が先なので並べ替え不要・スペースのみ除去",
  },
  {
    input: "（判定：3-0）",
    result: "win",
    expected: "判定3-0",
    note: "既に勝者視点どおりの並びなので囲み除去のみ",
  },
  {
    input: "判定3-0",
    result: "draw",
    expected: "判定3-0",
    note: "ドローはスコア並べ替え対象外(normalizeDecisionScorePerspective側の既存仕様)",
  },
];

function main() {
  let pass = 0;
  const failures: string[] = [];

  for (const c of allCases) {
    const got = normalizeFinishText(c.input);
    if (got === c.expected) {
      pass++;
    } else {
      failures.push(`normalizeFinishText(${JSON.stringify(c.input)}) => ${JSON.stringify(got)}, expected ${JSON.stringify(c.expected)} [${c.note}]`);
    }
  }

  for (const c of combinedCases) {
    const got = normalizeDecisionScorePerspective(normalizeFinishText(c.input), c.result);
    if (got === c.expected) {
      pass++;
    } else {
      failures.push(
        `normalizeDecisionScorePerspective(normalizeFinishText(${JSON.stringify(c.input)}), "${c.result}") => ${JSON.stringify(got)}, expected ${JSON.stringify(c.expected)} [${c.note}]`
      );
    }
  }

  const total = allCases.length + combinedCases.length;
  if (failures.length) {
    console.error(`[finish-text-normalize テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`[finish-text-normalize テスト] ${pass}件成功 / ${total - pass}件失敗`);
}

main();

// /rankings/[division] の固有テキスト(PR-B)生成。表・数字だけのページに
// 情報量を足しSEOでの発見性を上げる。data/rankings.json・data/fighterRecords.json・
// champions.ts(コミット済みデータ)から機械生成する純粋関数のみで構成し、
// 同じ入力から常に同じ出力になる(決定性)。
//
// 禁止事項(指示書PR-B B-3準拠。scripts/check-rankings-copy-banned-words.tsで機械チェック):
//   - 順位変動への言及(SUPPRESS_RANKING_MOVEMENT中のため)
//   - 評価語・予測
//   - 圏外落ちした選手の名指し(→ 上位表示者のみを扱うため構造的に混入しない)
//   - 数値レーティングの露出(→ rating/rawRatingを一切参照しない型のみ使用)
//   - 値が欠けている場合の推定補完(→ 欠ける項目はその行/段落ごと省略)
import { MnewsDivision } from "./mnewsRating/divisions";
import { WEIGHT_KG } from "./weightClasses";
import { RATING_NAME } from "./mnewsRating/constants";
import { RANKING_DISPLAY_CAP } from "./mnewsRating/divisionRankingView";
import type { ResolvedDivisionRankingView, ResolvedRankingEntry } from "./mnewsRating/divisionRankingView";
import { RIZIN_CHAMPIONS } from "./champions";
import { classifyMethodJa, isUnknownMethod } from "./methodClassify";
import { formatEventYearMonthJa } from "./eventCountdown";
import type { FighterRecordsFile } from "./fighterRecordsCache";

const RESULT_LABEL_JA: Record<string, string> = { win: "勝", loss: "敗", draw: "分", nc: "無効" };
const METHOD_LABEL_JA: Record<string, string> = { ko: "KO", sub: "一本", decision: "判定" };

// 算出基準の1段落要約は本文中でメソドロジーページへリンクする。JSXでの
// レンダリング時にlinkTextの位置へ実際の<a>を差し込めるよう、地の文を
// before/afterに分けて返す(生成ロジック自体はプレーンな文字列のみ扱う)。
export interface AlgorithmSummary {
  before: string;
  linkText: string;
  linkHref: string;
  after: string;
}

export interface DivisionCopy {
  definitionParagraph: string;
  algorithmSummary: AlgorithmSummary;
  scopeParagraph: string;
  championParagraph: string | null;
  recentFacts: string[]; // 上位5名の直近戦事実(取れなかった選手は行ごと省略)
}

function buildRecentFactLine(entry: ResolvedRankingEntry, fighterRecords: FighterRecordsFile): string | null {
  if (!entry.lastFight) return null;
  const record = fighterRecords[entry.fighterId];
  const bout = record?.history.find((h) => h.date === entry.lastFight);
  if (!bout) return null;

  const resultLabel = RESULT_LABEL_JA[bout.result];
  if (!resultLabel) return null;

  const methodKey = isUnknownMethod(bout.method) ? null : classifyMethodJa(bout.method);
  const methodLabel = methodKey && methodKey !== "other" ? METHOD_LABEL_JA[methodKey] : "";

  const yearMonth = formatEventYearMonthJa(entry.lastFight);
  return `${entry.displayRank}位 ${entry.nameJa}: ${yearMonth} ${bout.event} 対${bout.opponent} ${resultLabel}${methodLabel}`;
}

export function buildDivisionCopy(
  division: MnewsDivision,
  view: ResolvedDivisionRankingView,
  fighterRecords: FighterRecordsFile
): DivisionCopy {
  const weightKg = WEIGHT_KG[division];
  const definitionParagraph = weightKg
    ? `${division}は契約体重${weightKg}kg以下の階級です。`
    : `${division}の契約体重の定義データがありません。`;

  const algorithmSummary: AlgorithmSummary = {
    before: `${RATING_NAME}は、mnews.jpが独自に算出する非公式ランキングです。強い相手への勝利やフィニッシュ(KO/TKO・一本)を重視し、直近18ヶ月以内にRIZINで一定以上の試合実績がある選手のみを対象にAIが総合評価します。編集部による主観的な順位補正は行いません。詳しい評価方針は`,
    linkText: "ランキングについて",
    linkHref: "/rankings/methodology",
    after: "で公開しています。",
  };

  const scopeParagraph = `掲載は王者と上位${RANKING_DISPLAY_CAP}位までです。階級を判定できない選手は掲載を保留しており、順位によって除外しているわけではありません。`;

  const champion = RIZIN_CHAMPIONS.find((c) => c.weightClass === division) ?? null;
  const championParagraph = champion ? `現王者は${champion.name}(${champion.generation})です。` : null;

  const recentFacts = view.contenders
    .slice(0, 5)
    .map((entry) => buildRecentFactLine(entry, fighterRecords))
    .filter((line): line is string => line !== null);

  return { definitionParagraph, algorithmSummary, scopeParagraph, championParagraph, recentFacts };
}

// 禁止語チェック・文字数検証・JSX以外の場での確認用に、全パラグラフを1本の
// プレーンテキストへ結合する(algorithmSummaryはbefore+linkText+afterを連結。
// 実ページのJSXでは同じ3片を<a>タグで組み立てるため、テキストとしての内容は
// 完全に一致する)。
export function assembleDivisionCopyText(copy: DivisionCopy): string {
  return [
    copy.definitionParagraph,
    copy.algorithmSummary.before + copy.algorithmSummary.linkText + copy.algorithmSummary.after,
    copy.scopeParagraph,
    copy.championParagraph,
    ...copy.recentFacts,
  ]
    .filter((s): s is string => !!s)
    .join("\n");
}

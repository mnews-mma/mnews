// SEOメタ(title/description)の生成テンプレートを1箇所に集約する
// (選手名サイズ・通称・コーナー割当と同じ「単一ソース化」原則)。
// data/配下のデータは一切変更せず、既存フィールドの読み出し・整形のみを行う。
import { fullWidthLength } from "./tweetDigest";
import { toJstDateStr } from "./eventCountdown";

const FIGHTER_TITLE_MAX = 36;
const FIGHTER_DESCRIPTION_MAX = 75;

export interface FighterMetaInput {
  nameJa: string;
  nameEn: string;
  orgLabel: string;
  noRecordData: boolean;
  wins: number;
  losses: number;
  draws: number;
  historyLength: number;
  // history[0](最新の1戦)の日付("YYYY-MM-DD")と大会名。無ければnull。
  latestDate: string | null;
  latestEvent: string | null;
  rank: { divisionName: string; label: "王者" | number } | null;
}

// 直近試合の一言「{YYYY年M月} {大会名}」。評価語・予測は含めない機械生成。
// 日付文字列("YYYY-MM-DD")の年月抽出は正規表現ではなく文字列split(eventCountdown.ts
// のformatEventDateJa/shiftDateStrと同じ手法)で行う。既知の暦日文字列の構成要素を
// 取り出すだけでtzの概念が絡まないため、new Date()もローカルgetterも不要。
function latestResultClause(input: FighterMetaInput): string | null {
  if (!input.latestDate || !input.latestEvent) return null;
  const parts = input.latestDate.split("-");
  if (parts.length < 2) return null;
  const [y, m] = parts.map(Number);
  if (!y || !m) return null;
  return `${y}年${m}月 ${input.latestEvent}`;
}

export function buildFighterTitle(input: FighterMetaInput): string {
  if (input.noRecordData) {
    return `${input.nameJa}（${input.orgLabel}）の戦績・試合結果 | Mニュース`;
  }

  const total = input.wins + input.losses + input.draws;
  const core = `${input.nameJa} 戦績${input.wins}勝${input.losses}敗${input.draws}分`;
  // 通算(wins+losses+draws)と試合明細テーブルの行数(historyLength)が
  // 一致しない選手では「全{N}戦」の句ごと省略する(数字を突き合わない値で出さない)。
  const resultsClause = input.historyLength > 0 && input.historyLength === total ? `全${input.historyLength}戦の結果` : null;
  const recentClause = latestResultClause(input);

  const assemble = (clauses: (string | null)[]) => {
    const joined = clauses.filter((c): c is string => !!c).join("・");
    return joined ? `${core}｜${joined}｜Mニュース` : `${core}｜Mニュース`;
  };

  // 32-36字を目標に、超過時は末尾(直近試合の一言 → 全N戦)の句単位で落とす。
  // 選手名・戦績数字・ブランド名は必ず残す。
  let title = assemble([resultsClause, recentClause]);
  if (fullWidthLength(title) > FIGHTER_TITLE_MAX && recentClause) {
    title = assemble([resultsClause, null]);
  }
  if (fullWidthLength(title) > FIGHTER_TITLE_MAX && resultsClause) {
    title = assemble([null, null]);
  }
  return title;
}

function assembleDescription(
  input: FighterMetaInput,
  opts: { includeAlt: boolean; includeOrg: boolean; includeRank: boolean }
): string {
  const altName = opts.includeAlt && input.nameEn && input.nameEn !== input.nameJa ? `（${input.nameEn}）` : "";
  // 16位以下(表示ランクヘルパーの戻り値がnull)の選手には付けない。
  const rankClause = opts.includeRank && input.rank
    ? input.rank.label === "王者"
      ? `AI RIZIN${input.rank.divisionName}王者。`
      : `AI RIZIN${input.rank.divisionName}ランキング${input.rank.label}位。`
    : "";
  const orgClause = opts.includeOrg ? `${input.orgLabel}所属。` : "";

  if (input.noRecordData) {
    return `${rankClause}${input.nameJa}${altName}のプロフィールを掲載。${orgClause}`;
  }
  return `${rankClause}${input.nameJa}${altName}の戦績・全試合結果・決着方法の内訳をデータベースで掲載。通算${input.wins}勝${input.losses}敗${input.draws}分。${orgClause}`;
}

export function buildFighterDescription(input: FighterMetaInput): string {
  // 60-75字目標。超過時は末尾から句単位で落とす(英字別表記 → 所属句 → ランク句の順。
  // 選手名・本文(戦績・全試合結果の説明)・戦績数字は必ず残す)。
  let desc = assembleDescription(input, { includeAlt: true, includeOrg: true, includeRank: true });
  if (fullWidthLength(desc) > FIGHTER_DESCRIPTION_MAX) {
    desc = assembleDescription(input, { includeAlt: false, includeOrg: true, includeRank: true });
  }
  if (fullWidthLength(desc) > FIGHTER_DESCRIPTION_MAX) {
    desc = assembleDescription(input, { includeAlt: false, includeOrg: false, includeRank: true });
  }
  if (fullWidthLength(desc) > FIGHTER_DESCRIPTION_MAX) {
    desc = assembleDescription(input, { includeAlt: false, includeOrg: false, includeRank: false });
  }
  return desc;
}

// 実カード(findMatchupEvent一致)/非実カードでtitleの意図(検索意図=カード情報)を
// 分ける。descriptionは既存の戦績・共通対戦相手数のロジックを維持する(変更対象外)。
export function buildVsTitle(nameA: string, nameB: string, matchupEventName: string | null): string {
  return matchupEventName
    ? `${nameA} vs ${nameB}｜${matchupEventName} 対戦カード・戦績比較・過去の対戦｜Mニュース`
    : `${nameA} vs ${nameB} 戦績比較｜共通の対戦相手・過去の対戦｜Mニュース`;
}

// updatedAt(UTC ISO文字列) → JST暦日の「YYYY年M月D日」。JST変換自体は
// eventCountdown.tsのtoJstDateStr(single source)を直接呼び、ここでは
// 解決済みの暦日文字列("YYYY-MM-DD")を punctuation 整形するだけ(tz概念を
// 含む処理を独自ラッパーに切り出さない。フェーズ2-Aが/rankings系で確立した
// 呼び方と同じ)。不正値はnull(埋め草を出さない)。

export function buildRankingsHubTitle(updatedAt: string | null): string {
  const jstDate = updatedAt ? toJstDateStr(Date.parse(updatedAt)) : null;
  const [y, m, d] = jstDate ? jstDate.split("-").map(Number) : [];
  const dateStr = jstDate ? `${y}年${m}月${d}日` : null;
  return dateStr
    ? `AI RIZINランキング｜RIZIN全階級の選手順位【${dateStr}更新】｜Mニュース`
    : `AI RIZINランキング｜RIZIN全階級の選手順位｜Mニュース`;
}

export function buildRankingsDivisionTitle(division: string, updatedAt: string | null): string {
  const jstDate = updatedAt ? toJstDateStr(Date.parse(updatedAt)) : null;
  const [y, m, d] = jstDate ? jstDate.split("-").map(Number) : [];
  const dateStr = jstDate ? `${y}年${m}月${d}日` : null;
  return dateStr
    ? `AI RIZIN${division}ランキング【${dateStr}更新】｜RIZIN選手の階級別順位｜Mニュース`
    : `AI RIZIN${division}ランキング｜RIZIN選手の階級別順位｜Mニュース`;
}

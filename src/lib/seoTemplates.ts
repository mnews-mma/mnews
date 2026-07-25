// SEOメタ(title/description)の生成テンプレートを1箇所に集約する
// (選手名サイズ・通称・コーナー割当と同じ「単一ソース化」原則)。
// data/配下のデータは一切変更せず、既存フィールドの読み出し・整形のみを行う。
import { fullWidthLength } from "./tweetDigest";
import { toJstDateStr, formatEventYearMonthJa, formatDateJa, formatMonthDayNumeric } from "./eventCountdown";

const FIGHTER_TITLE_MAX = 36;
const FIGHTER_DESCRIPTION_MAX = 75;
// 次戦句(「次戦8/11 RIZIN」等)の上限字数。指示書followups-2026-07-26e C-1の
// 実測(N1〜N3は全件12字以内、N4のみ相手姓で超過)に基づく。超えたら出さない
// (切り詰めて壊さない)。
const NEXT_FIGHT_CLAUSE_MAX = 12;

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
  // 発表済みかつ未消化(EVENTS側でstatus:upcoming/liveのイベント)の次戦。
  // 無ければnull。orgLabelが取れない場合はnextFightClause側でN3
  // (「次戦{M}/{D}」)にフォールバックする。
  nextFight: { date: string; orgLabel: string | null } | null;
}

// 直近試合の一言「{YYYY年M月} {大会名}」。評価語・予測は含めない機械生成。
// 日付文字列("YYYY-MM-DD")→「YYYY年M月」の整形はeventCountdown.tsの
// formatEventYearMonthJa(single source)を呼ぶ。ここで独自にsplit/parseしない
// (component側の独自ロジックが再発の温床になるため。formatJaDate削除と同じ理由)。
// この関数自体の文言・ロジックは指示書followups-2026-07-26e以降も変更しない
// (PR-Aの結果ベース句。次戦句は下のnextFightClauseとして別関数にし、呼び出し側で
// 排他的に出し分ける=既存の文言・ロジックへは一切手を入れない)。
function latestResultClause(input: FighterMetaInput): string | null {
  if (!input.latestDate || !input.latestEvent) return null;
  return `${formatEventYearMonthJa(input.latestDate)} ${input.latestEvent}`;
}

// 次戦句「次戦{M}/{D} {団体短縮名}」(N1)。指示書followups-2026-07-26e C-2c:
// 既存descriptionの全フォールバック後にN1を追加しても57%(34/60件)が75字を
// 超過したため、追加ではなく「置換」方式にする(呼び出し側でlatestResultClause /
// 通算戦績の説明文と排他的に出し分ける)。団体短縮名(orgLabel)が取れない場合は
// N3「次戦{M}/{D}」にフォールバックし、それでも12字を超える場合はnull
// (次戦句を出さない。切り詰めて情報を壊さない)。
// 日付整形はeventCountdown.tsのformatMonthDayNumeric(single source)経由。
function nextFightClause(input: FighterMetaInput): string | null {
  if (!input.nextFight) return null;
  const md = formatMonthDayNumeric(input.nextFight.date);
  const withOrg = input.nextFight.orgLabel ? `次戦${md} ${input.nextFight.orgLabel}` : null;
  if (withOrg && fullWidthLength(withOrg) <= NEXT_FIGHT_CLAUSE_MAX) return withOrg;
  const withoutOrg = `次戦${md}`;
  return fullWidthLength(withoutOrg) <= NEXT_FIGHT_CLAUSE_MAX ? withoutOrg : null;
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
  // 次戦句(未消化)がある場合は直近結果の一言を置換する(排他・併記しない)。
  // latestResultClause自体の文言・ロジックは変更せず、呼ぶかどうかだけを切り替える。
  const recentClause = nextFightClause(input) ?? latestResultClause(input);

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
  // 次戦句(未消化)がある場合、通算戦績の説明文を次戦告知に「置換」する
  // (指示書followups-2026-07-26e C-2c。追加ではない。既存の戦績説明文
  // ="の戦績・全試合結果・決着方法の内訳をデータベースで掲載。通算X勝Y敗Z分。"
  // という文言自体は一切変更せず、次戦句がある間だけ呼ばない)。
  const nfClause = nextFightClause(input);
  if (nfClause) {
    return `${rankClause}${input.nameJa}${altName} ${nfClause}。${orgClause}`;
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
// eventCountdown.tsのtoJstDateStr(single source)を直接呼び、暦日文字列→
// 表示整形もeventCountdown.tsのformatDateJaを呼ぶ(ここでは独自にsplitしない。
// component側の独自ロジックが再発の温床になるため)。不正値はnull(埋め草を
// 出さない)。

export function buildRankingsHubTitle(updatedAt: string | null): string {
  const jstDate = updatedAt ? toJstDateStr(Date.parse(updatedAt)) : null;
  const dateStr = jstDate ? formatDateJa(jstDate) : null;
  return dateStr
    ? `AI RIZINランキング｜RIZIN全階級の選手順位【${dateStr}更新】｜Mニュース`
    : `AI RIZINランキング｜RIZIN全階級の選手順位｜Mニュース`;
}

export function buildRankingsDivisionTitle(division: string, updatedAt: string | null): string {
  const jstDate = updatedAt ? toJstDateStr(Date.parse(updatedAt)) : null;
  const dateStr = jstDate ? formatDateJa(jstDate) : null;
  return dateStr
    ? `AI RIZIN${division}ランキング【${dateStr}更新】｜RIZIN選手の階級別順位｜Mニュース`
    : `AI RIZIN${division}ランキング｜RIZIN選手の階級別順位｜Mニュース`;
}

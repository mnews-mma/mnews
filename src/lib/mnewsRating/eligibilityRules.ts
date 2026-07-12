// 掲載資格ルールの追加分(B-1: ランカー勝ち特例 / B-2: 階級変更後の資格スコープ)。
// Eloレート計算(engine.ts)・階級バケット判定(divisions.ts)には一切手を加えない。
// ここは「誰を掲載資格ありとするか」の判定レイヤーのみを担う純関数群。
import { Bout, EligibilityCounts, isEligible } from "./engine";
import { MnewsDivision, NAMED_DIVISION_RE, mapToDivision } from "./divisions";
import { ELIGIBILITY_MIN_FIGHTS, ELIGIBILITY_RECENT_MIN_FIGHTS, ELIGIBILITY_RECENT_YEAR_START } from "./constants";

export interface FighterBoutSummary {
  date: string;
  weightClass?: string;
  isWin: boolean;
  opponentNode: string;
}

// bouts(Eloエンジンが既に重複排除・計量オーバーNC裁定を適用済みの対戦リスト)から、
// 指定選手の対戦だけをその選手視点(isWin)に正規化して取り出す。資格判定は
// 常にこの「エンジンが正とみなした対戦」を土台にする(生のhistoryを別途
// 数え直すと、矛盾除外やNC裁定がここだけ二重実装になりズレる元になるため)。
export function summarizeBoutsForFighter(bouts: Bout[], slug: string): FighterBoutSummary[] {
  const out: FighterBoutSummary[] = [];
  for (const b of bouts) {
    if (b.aNode === slug) {
      out.push({ date: b.date, weightClass: b.weightClass, isWin: b.scoreA === 1, opponentNode: b.bNode });
    } else if (b.bNode === slug) {
      out.push({ date: b.date, weightClass: b.weightClass, isWin: b.scoreA === 0, opponentNode: b.aNode });
    }
  }
  return out;
}

// B-2: 階級変更の検出。判明済みweightClassのうち階級名が明示されており
// (NAMED_DIVISION_RE、latestRizinDivisionと同じ判定基準を共有)、かつ現在の
// 掲載階級と食い違う対戦の中で最も新しい日付を「変更の起点」とする。
// 単発の未明示キャッチウェイト戦(kg契約のみの表記)はlatestRizinDivision同様
// ノイズとみなし証拠にしない(武田光司・コレスニックの71.0kg契約と同じ理由)。
// 該当が無ければnull(=階級変更は検出されない。資格判定は全期間のまま)。
export function detectDivisionChangeCutoff(summaries: FighterBoutSummary[], currentDivision: MnewsDivision): string | null {
  const mismatches = summaries
    .filter((s): s is FighterBoutSummary & { weightClass: string } => !!s.weightClass && NAMED_DIVISION_RE.test(s.weightClass))
    .map((s) => ({ date: s.date, division: mapToDivision(s.weightClass) }))
    .filter((s): s is { date: string; division: MnewsDivision } => s.division !== null && s.division !== currentDivision);
  if (mismatches.length === 0) return null;
  return mismatches.reduce((latest, m) => (m.date > latest.date ? m : latest)).date;
}

// B-2: 資格判定用のfights/winsを算出する。階級変更が検出された場合は
// cutoff日より後の対戦のみでカウントする(=変更後の当該階級の試合で評価)。
// 直近性(18ヶ月)は既存どおりRatingState.lastFightDate(階級横断・全期間)を
// 呼び出し側で別途使うため、ここでは扱わない。
export function computeEligibilityFightsAndWins(
  summaries: FighterBoutSummary[],
  currentDivision: MnewsDivision
): { fights: number; wins: number } {
  const cutoff = detectDivisionChangeCutoff(summaries, currentDivision);
  const scoped = cutoff ? summaries.filter((s) => s.date > cutoff) : summaries;
  return { fights: scoped.length, wins: scoped.filter((s) => s.isWin).length };
}

// B-2適用後の「標準の掲載資格」を判定する(1勝以上は階級変更後スコープ、
// 18ヶ月直近性は既存の全期間lastFightDateのまま)。
// 試合数の要件(v4追加)は「通算ELIGIBILITY_MIN_FIGHTS戦以上」OR
// 「ELIGIBILITY_RECENT_YEAR_START年以降にELIGIBILITY_RECENT_MIN_FIGHTS戦以上」の
// いずれかを満たせばよい(直近活動が濃い選手を拾うための代替基準)。
export function isStandardEligible(
  summaries: FighterBoutSummary[],
  currentDivision: MnewsDivision,
  lastFightDate: string | null,
  asOf: Date
): boolean {
  const cutoff = detectDivisionChangeCutoff(summaries, currentDivision);
  const scoped = cutoff ? summaries.filter((s) => s.date > cutoff) : summaries;
  const fights = scoped.length;
  const wins = scoped.filter((s) => s.isWin).length;
  const recentFights = scoped.filter((s) => s.date >= `${ELIGIBILITY_RECENT_YEAR_START}-01-01`).length;
  const meetsFightBar = fights >= ELIGIBILITY_MIN_FIGHTS || recentFights >= ELIGIBILITY_RECENT_MIN_FIGHTS;
  const counts: EligibilityCounts = { fights: meetsFightBar ? Math.max(fights, ELIGIBILITY_MIN_FIGHTS) : fights, wins, lastFightDate };
  return isEligible(counts, asOf);
}

// B-1: ランカー勝ち特例。baseRankersByDivisionは「標準資格(B-2適用後)を満たす
// 選手」の階級別集合を1回だけ確定させたもの(単一パス。この特例で新規に資格を
// 得た選手を倒したかは見ない=カスケードしない)。対象選手が、自分の掲載階級の
// ベースランカーに対し、yearPrefix年に開催されたRIZIN MMA本戦で勝っていれば
// 免除対象とする(順位はElo通りのまま。ここは資格の可否のみを返す)。
export function findRankerWinExemptions(
  boutSummariesBySlug: Map<string, FighterBoutSummary[]>,
  divisionBySlug: Map<string, MnewsDivision | null>,
  baseRankersByDivision: Map<MnewsDivision, Set<string>>,
  yearPrefix: string
): Set<string> {
  const exempted = new Set<string>();
  for (const [slug, summaries] of boutSummariesBySlug) {
    const division = divisionBySlug.get(slug);
    if (!division) continue;
    const rankers = baseRankersByDivision.get(division);
    if (!rankers || rankers.size === 0) continue;
    const beatARanker = summaries.some((s) => s.isWin && s.date.startsWith(yearPrefix) && rankers.has(s.opponentNode));
    if (beatARanker) exempted.add(slug);
  }
  return exempted;
}

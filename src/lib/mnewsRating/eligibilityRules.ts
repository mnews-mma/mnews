// 掲載資格ルールの追加分(B-1: ランカー勝ち特例 / B-2: 階級変更後の資格スコープ)。
// Eloレート計算(engine.ts)・階級バケット判定(divisions.ts)には一切手を加えない。
// ここは「誰を掲載資格ありとするか」の判定レイヤーのみを担う純関数群。
import { Bout, EligibilityCounts, isEligible } from "./engine";
import { MnewsDivision, NAMED_DIVISION_RE, mapToDivision } from "./divisions";
import {
  ELIGIBILITY_MAX_INACTIVE_MONTHS,
  ELIGIBILITY_MIN_FIGHTS,
  ELIGIBILITY_RECENT_MIN_FIGHTS,
  ELIGIBILITY_RECENT_YEAR_START,
} from "./constants";

export interface FighterBoutSummary {
  date: string;
  weightClass?: string;
  isWin: boolean;
  opponentNode: string;
  // オープニングファイト(前座)判定。掲載資格のカウント対象・ランカー勝ち
  // 特例の「本戦での勝利」判定からは除外する(2026-07-13追加)。未設定はfalse扱い。
  isOpeningFight?: boolean;
}

// bouts(Eloエンジンが既に重複排除・計量オーバーNC裁定を適用済みの対戦リスト)から、
// 指定選手の対戦だけをその選手視点(isWin)に正規化して取り出す。資格判定は
// 常にこの「エンジンが正とみなした対戦」を土台にする(生のhistoryを別途
// 数え直すと、矛盾除外やNC裁定がここだけ二重実装になりズレる元になるため)。
export function summarizeBoutsForFighter(bouts: Bout[], slug: string): FighterBoutSummary[] {
  const out: FighterBoutSummary[] = [];
  for (const b of bouts) {
    if (b.aNode === slug) {
      out.push({ date: b.date, weightClass: b.weightClass, isWin: b.scoreA === 1, opponentNode: b.bNode, isOpeningFight: b.isOpeningFight });
    } else if (b.bNode === slug) {
      out.push({ date: b.date, weightClass: b.weightClass, isWin: b.scoreA === 0, opponentNode: b.aNode, isOpeningFight: b.isOpeningFight });
    }
  }
  return out;
}

// 掲載資格のカウント対象試合(オープニングファイトを除いたもの)を返す共通ヘルパー。
// B-2(階級変更検出・資格スコープ)・B-1(ランカー勝ち特例)いずれもこの絞り込み後の
// 対戦を土台にする(オープニングファイトは「試合数」にも「相手の質」にも
// 数えない、という方針を一箇所に集約する)。
function excludeOpeningFights(summaries: FighterBoutSummary[]): FighterBoutSummary[] {
  return summaries.filter((s) => !s.isOpeningFight);
}

// B-2: 階級変更の検出。判明済みweightClassのうち階級名が明示されており
// (NAMED_DIVISION_RE、latestRizinDivisionと同じ判定基準を共有)、かつ現在の
// 掲載階級と食い違う対戦の中で最も新しい日付を「変更の起点」とする。
// 単発の未明示キャッチウェイト戦(kg契約のみの表記)はlatestRizinDivision同様
// ノイズとみなし証拠にしない(武田光司・コレスニックの71.0kg契約と同じ理由)。
// 該当が無ければnull(=階級変更は検出されない。資格判定は全期間のまま)。
//
// 2026-07-13再修正: 単発の他階級進出(1戦のみで、その前後の直近の判明済み
// 試合がいずれも現階級)は「階級変更」と見なさない。ミスマッチの試合の
// 直前・直後(時系列で隣接する判明済み試合。明示・未明示のkg換算いずれでも可。
// latestRizinDivisionと同じmapToDivision基準)がどちらも現階級相当であれば、
// 一時的な遠征として無視する(ケラモフの実データ: 2024-12-31のライト級
// タイトルマッチ1戦のみが階級越えで、直前・直後はいずれも未明示の66kg契約=
// フェザー級相当。これを階級変更と誤判定すると資格対象試合が2戦まで絞り
// 込まれ、脱落してしまっていた)。単に「その後どこかで現階級に戻っている」
// だけでは不十分(直前・直後どちらも隣接一致を要求しないと、実際に階級を
// 移った選手の変更前戦績まで無視してしまう=既存テストで確認済み)。
export function detectDivisionChangeCutoff(summaries: FighterBoutSummary[], currentDivision: MnewsDivision): string | null {
  const known = summaries
    .filter((s): s is FighterBoutSummary & { weightClass: string } => !!s.weightClass)
    .map((s) => ({ date: s.date, division: mapToDivision(s.weightClass), named: NAMED_DIVISION_RE.test(s.weightClass) }))
    .filter((s): s is { date: string; division: MnewsDivision; named: boolean } => s.division !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const mismatchDates: string[] = [];
  known.forEach((k, i) => {
    if (!k.named || k.division === currentDivision) return;
    const prev = known[i - 1];
    const next = known[i + 1];
    const isIsolatedExcursion = prev?.division === currentDivision && next?.division === currentDivision;
    if (!isIsolatedExcursion) mismatchDates.push(k.date);
  });
  if (mismatchDates.length === 0) return null;
  return mismatchDates.reduce((latest, d) => (d > latest ? d : latest));
}

// 2026-07-13追加: 直近の活動と3年超も間が空いた古い試合が、階級名の明示が
// 無いというだけの理由で無条件に「通算◯戦」の資格カウントへ混入し続ける穴を
// 塞ぐ。detectDivisionChangeCutoffの階級不一致検出とは独立に、時系列で隣接
// する既知の対戦同士の間隔がELIGIBILITY_MAX_INACTIVE_MONTHSを超える箇所が
// あれば、そこより前の対戦は「現在の活動と地続きではない過去」とみなし資格
// カウントから除外する(中村大介: 2022-03-20を最後に2025-05-04まで約38ヶ月
// 空いており、直近1戦しか実質無いのに空白前の2戦を合算して通算3戦の資格
// バーを満たしてしまっていた)。既存の武田光司・コレスニック・ケラモフの
// ケースはいずれも最大空白が18ヶ月未満のため、この一般ルール追加では
// 資格判定が変わらないことをテストで確認済み。
function detectInactivityGapCutoff(summaries: FighterBoutSummary[]): string | null {
  const sorted = [...summaries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const gapCutoffDates: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gapMonths = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (30.44 * 86400000);
    if (gapMonths > ELIGIBILITY_MAX_INACTIVE_MONTHS) gapCutoffDates.push(sorted[i - 1].date);
  }
  if (gapCutoffDates.length === 0) return null;
  return gapCutoffDates.reduce((latest, d) => (d > latest ? d : latest));
}

// 階級変更(B-2)・活動空白(上記)いずれかで検出されたcutoffのうち、より新しい
// (=より対象試合を絞り込む)方を採用する。
function resolveEligibilityScope(summaries: FighterBoutSummary[], currentDivision: MnewsDivision): FighterBoutSummary[] {
  const withoutOpeners = excludeOpeningFights(summaries);
  const divisionCutoff = detectDivisionChangeCutoff(withoutOpeners, currentDivision);
  // 2026-07-19(確立ベテラン例外): 活動空白カットオフは薄いカムバック(中村大介=
  // 空白前2戦)を弾く穴埋めであって、空白前に既にELIGIBILITY_MIN_FIGHTS戦以上を積んだ
  // 確立選手が復帰して直近に試合している場合まで過去を全消しする意図ではない。
  // 空白前の対戦数が資格バー以上なら確立済みとみなし活動空白カットオフを無効化する
  // (階級変更カットオフは別途そのまま効く)。ケース(空白前7戦)該当・中村(2戦)非該当。
  const rawGapCutoff = detectInactivityGapCutoff(withoutOpeners);
  const preGapFights = rawGapCutoff ? withoutOpeners.filter((s) => s.date <= rawGapCutoff).length : 0;
  const gapCutoff = rawGapCutoff && preGapFights >= ELIGIBILITY_MIN_FIGHTS ? null : rawGapCutoff;
  const cutoff =
    divisionCutoff && gapCutoff ? (divisionCutoff > gapCutoff ? divisionCutoff : gapCutoff) : divisionCutoff ?? gapCutoff;
  return cutoff ? withoutOpeners.filter((s) => s.date > cutoff) : withoutOpeners;
}

// B-2: 資格判定用のfights/winsを算出する。階級変更または活動空白のcutoffが
// 検出された場合はcutoff日より後の対戦のみでカウントする(=変更後の当該階級・
// 現在の活動と地続きの試合で評価)。オープニングファイトは資格カウントの
// 対象試合に含めない(2026-07-13追加)。直近性(18ヶ月)は既存どおり
// RatingState.lastFightDate(階級横断・全期間)を呼び出し側で別途使うため、
// ここでは扱わない。
export function computeEligibilityFightsAndWins(
  summaries: FighterBoutSummary[],
  currentDivision: MnewsDivision
): { fights: number; wins: number } {
  const scoped = resolveEligibilityScope(summaries, currentDivision);
  return { fights: scoped.length, wins: scoped.filter((s) => s.isWin).length };
}

// B-2適用後の「標準の掲載資格」を判定する(1勝以上は階級変更後スコープ、
// 18ヶ月直近性は既存の全期間lastFightDateのまま)。
// 試合数の要件は「通算ELIGIBILITY_MIN_FIGHTS戦以上」OR「ELIGIBILITY_RECENT_YEAR_START年
// 以降にELIGIBILITY_RECENT_MIN_FIGHTS戦以上」のいずれかを満たせばよい(直近活動が
// 濃い選手を拾うための代替基準)。オープニングファイトはどちらのカウントにも
// 含めない(2026-07-13追加)。
export function isStandardEligible(
  summaries: FighterBoutSummary[],
  currentDivision: MnewsDivision,
  lastFightDate: string | null,
  asOf: Date
): boolean {
  const scoped = resolveEligibilityScope(summaries, currentDivision);
  const fights = scoped.length;
  const wins = scoped.filter((s) => s.isWin).length;
  const recentFights = scoped.filter((s) => s.date >= `${ELIGIBILITY_RECENT_YEAR_START}-01-01`).length;
  const meetsFightBar = fights >= ELIGIBILITY_MIN_FIGHTS || recentFights >= ELIGIBILITY_RECENT_MIN_FIGHTS;
  const counts: EligibilityCounts = { fights: meetsFightBar ? Math.max(fights, ELIGIBILITY_MIN_FIGHTS) : fights, wins, lastFightDate };
  return isEligible(counts, asOf);
}

// 2026-07-13厳格化: 対戦相手が、その勝利の日付「時点で」標準資格(B-2)を
// 満たしていたかを判定する。baseRankersByDivisionは現在(バッチ実行時点)の
// 標準資格集合の1スナップショットのため、「今は標準資格があるが、倒された
// その試合の時点ではまだ資格条件(通算3戦 or 直近年2戦、1勝以上)を満たして
// いなかった相手」への勝利まで特例対象に含めてしまう穴があった。対戦相手
// 自身の対戦をその日付以前だけに絞り、その日を基準日として標準資格を
// 再判定することでこれを塞ぐ(階級は現在の掲載階級をそのまま使う。階級変更
// 自体はB-2の別ロジックで扱うためここでは再判定しない=対象外)。
function wasStandardEligibleAsOfDate(
  opponentSlug: string,
  asOfDateStr: string,
  boutSummariesBySlug: Map<string, FighterBoutSummary[]>,
  divisionBySlug: Map<string, MnewsDivision | null>
): boolean {
  const opponentDivision = divisionBySlug.get(opponentSlug);
  if (!opponentDivision) return false;
  const opponentSummaries = boutSummariesBySlug.get(opponentSlug) ?? [];
  const scoped = opponentSummaries.filter((s) => s.date <= asOfDateStr);
  if (scoped.length === 0) return false;
  const lastFightDate = scoped.reduce((latest, s) => (s.date > latest ? s.date : latest), scoped[0].date);
  const asOfDate = new Date(`${asOfDateStr}T00:00:00Z`);
  return isStandardEligible(scoped, opponentDivision, lastFightDate, asOfDate);
}

// B-1: ランカー勝ち特例。baseRankersByDivisionは「標準資格(B-2適用後)を満たす
// 選手」の階級別集合を1回だけ確定させたもの(単一パス。この特例で新規に資格を
// 得た選手を倒したかは見ない=カスケードしない)。対象選手が、自分の掲載階級の
// ベースランカーに対し、yearPrefix年に開催された本戦(オープニングファイトで
// ない)RIZIN MMAで勝っており、かつその対戦相手がその勝利の時点でも標準資格
// (=ランキング掲載中のランカー)だった場合にのみ免除対象とする(順位はElo
// 通りのまま。ここは資格の可否のみを返す)。ノーランカー(その時点でまだ標準
// 資格を満たしていなかった相手)への勝利、およびオープニングファイトでの
// 勝利では特例は発動しない(2026-07-13追加)。
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
    const beatARanker = summaries.some(
      (s) =>
        s.isWin &&
        !s.isOpeningFight &&
        s.date.startsWith(yearPrefix) &&
        rankers.has(s.opponentNode) &&
        wasStandardEligibleAsOfDate(s.opponentNode, s.date, boutSummariesBySlug, divisionBySlug)
    );
    if (beatARanker) exempted.add(slug);
  }
  return exempted;
}

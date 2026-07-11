// mnewsレーティング: 純関数Eloエンジン。I/O(fs/fetch)を一切持たない。
// 呼び出し側(scripts/compute-mnews-rating.ts、将来のrankings.json生成バッチ)が
// data/fighterRecords.json と選手名インデックスを読み込み、ここへ渡す。
// 同じ入力(records + resolveOpponentSlug + asOf)なら必ず同じ出力になる決定論的
// フル再計算(冪等性優先・差分計算はしない)。
import {
  DECAY_FLOOR,
  DECAY_PERIOD_DAYS,
  DECAY_PER_PERIOD,
  ELIGIBILITY_MAX_INACTIVE_MONTHS,
  ELIGIBILITY_MIN_FIGHTS,
  ELIGIBILITY_MIN_WINS,
  INITIAL_RATING,
  K_BASE,
  K_FINISH,
  UNRATED_OPPONENT_RATING,
} from "./constants";

export interface HistoryEntryLike {
  date: string;
  opponent: string;
  result: "win" | "loss" | "draw" | "nc";
  method: string;
  event: string;
  round?: string;
}

export interface FighterRecordEntryLike {
  history: HistoryEntryLike[];
}

export type FighterRecordsInput = Record<string, FighterRecordEntryLike>;

export interface ExclusionWarning {
  slug: string;
  date: string;
  opponent: string;
  reason: string;
}

export type MethodClass = "finish" | "decision" | "unknown";

const NON_MMA_EVENT_KEYWORDS = /キックルール|kickboxing|エキシビション|exhibition/i;

// RIZIN開催のMMAルール試合のみを対象にする(キックルール・エキシビションは除外)。
export function isRizinMmaEvent(eventName: string): boolean {
  const ev = eventName ?? "";
  if (!/RIZIN/i.test(ev)) return false;
  if (NON_MMA_EVENT_KEYWORDS.test(ev)) return false;
  return true;
}

// method文字列(例: "1R 1:08 KO（右ストレート）" "5分3R終了 判定3-0"
// "2R 3:44 リアネイキッドチョーク")からフィニッシュ/判定を分類する。
// 空文字・欠損は unknown とし、勝手に決着種別を推測しない。
export function classifyMethod(method: string): MethodClass {
  const m = (method ?? "").trim();
  if (!m) return "unknown";
  if (/判定/.test(m)) return "decision";
  if (/KO/i.test(m)) return "finish"; // TKOも"KO"を含むため同時に拾う
  // 判定でもKO/TKOでもない場合、この戦績フォーマットでは一本勝ちの技名のみが
  // 記載される(データ実地調査で確認済み)。
  return "finish";
}

export interface Bout {
  key: string;
  date: string;
  aSlug: string;
  bSlug: string | null; // null = 自社DB圏外の相手(中立レートとして計算)
  opponentLabel: string; // 表示・ログ用の相手名(history.opponentそのまま)
  scoreA: number; // aSlug視点: 1=勝ち, 0=負け, 0.5=分け
  finish: boolean;
}

export interface BuildBoutsResult {
  bouts: Bout[];
  warnings: ExclusionWarning[];
}

// records内の全選手の全履歴からRIZIN MMA試合のみを抽出し、DB内対決は日付+両slugで
// 重複排除した「対戦」の配列にする(両者の履歴に二重計上されるのを防ぐ)。
// resolveOpponentSlug: history.opponent(自由記述の名前)→自社DB内の相手slug。
// 解決できない場合は null を返してよい(その場合は中立レート相手として扱う)。
export function buildBouts(
  records: FighterRecordsInput,
  resolveOpponentSlug: (opponentName: string, selfSlug: string) => string | null
): BuildBoutsResult {
  const warnings: ExclusionWarning[] = [];
  const boutMap = new Map<string, Bout>();

  for (const [slug, entry] of Object.entries(records)) {
    for (const h of entry.history ?? []) {
      if (!isRizinMmaEvent(h.event)) continue;
      if (h.result === "nc") continue; // ノーコンテスト・無効試合はレート変動なし

      if (!h.date || !h.opponent) {
        warnings.push({ slug, date: h.date ?? "", opponent: h.opponent ?? "", reason: "日付または対戦相手名が欠損" });
        continue;
      }

      const cls = classifyMethod(h.method);
      if (cls === "unknown") {
        warnings.push({ slug, date: h.date, opponent: h.opponent, reason: "決着方法(method)が空でフィニッシュ/判定を判定不能" });
        continue;
      }

      const scoreA = h.result === "win" ? 1 : h.result === "draw" ? 0.5 : 0;
      const finish = cls === "finish";

      const oppSlug = resolveOpponentSlug(h.opponent, slug);
      if (oppSlug === slug) {
        warnings.push({ slug, date: h.date, opponent: h.opponent, reason: "対戦相手が自分自身に解決された(データ不整合)" });
        continue;
      }

      if (oppSlug && records[oppSlug]) {
        // DB内対決: date + sorted(slug) で一意化。scoreは常に「ソート先頭選手視点」に揃える。
        const [a, b] = [slug, oppSlug].sort();
        const key = `db|${h.date}|${a}|${b}`;
        if (boutMap.has(key)) continue;
        const scoreForA = a === slug ? scoreA : 1 - scoreA;
        boutMap.set(key, { key, date: h.date, aSlug: a, bSlug: b, opponentLabel: h.opponent, scoreA: scoreForA, finish });
      } else {
        // 自社DB圏外の相手: その選手の履歴にしか現れないため一意。
        const key = `wall|${h.date}|${slug}|${h.opponent}`;
        if (boutMap.has(key)) continue;
        boutMap.set(key, { key, date: h.date, aSlug: slug, bSlug: null, opponentLabel: h.opponent, scoreA, finish });
      }
    }
  }

  const bouts = [...boutMap.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.key < y.key ? -1 : 1));
  return { bouts, warnings };
}

export interface RatingState {
  rawRating: number;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  lastFightDate: string | null;
}

function freshState(): RatingState {
  return { rawRating: INITIAL_RATING, fights: 0, wins: 0, losses: 0, draws: 0, lastFightDate: null };
}

function expectedScore(rSelf: number, rOpp: number): number {
  return 1 / (1 + Math.pow(10, (rOpp - rSelf) / 400));
}

function applyResult(state: RatingState, score: number, opponentRating: number, k: number, date: string): RatingState {
  const expected = expectedScore(state.rawRating, opponentRating);
  return {
    rawRating: state.rawRating + k * (score - expected),
    fights: state.fights + 1,
    wins: state.wins + (score === 1 ? 1 : 0),
    losses: state.losses + (score === 0 ? 1 : 0),
    draws: state.draws + (score === 0.5 ? 1 : 0),
    lastFightDate: date,
  };
}

// 日付昇順の全対戦を逐次再生し、素のレート(rawRating)を返す。
// 冪等性優先: 常に全履歴を頭から再計算する(バッチ実行日には一切依存しない)。
export function computeRawRatings(bouts: Bout[]): Map<string, RatingState> {
  const states = new Map<string, RatingState>();
  const get = (slug: string) => states.get(slug) ?? freshState();

  const sorted = [...bouts].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.key < y.key ? -1 : 1));

  for (const bout of sorted) {
    const k = bout.finish ? K_FINISH : K_BASE;
    const a = get(bout.aSlug);

    if (bout.bSlug) {
      const b = get(bout.bSlug);
      const newA = applyResult(a, bout.scoreA, b.rawRating, k, bout.date);
      const newB = applyResult(b, 1 - bout.scoreA, a.rawRating, k, bout.date);
      states.set(bout.aSlug, newA);
      states.set(bout.bSlug, newB);
    } else {
      const newA = applyResult(a, bout.scoreA, UNRATED_OPPONENT_RATING, k, bout.date);
      states.set(bout.aSlug, newA);
    }
  }

  return states;
}

// 不活性ディケイ: 最終試合からDECAY_PERIOD_DAYSごとにDECAY_PER_PERIODを減衰(下限DECAY_FLOOR)。
// 表示用レートにのみ適用し、rawRatingには一切影響しない(次回のElo計算はrawRatingを使う)。
export function applyInactivityDecay(rawRating: number, lastFightDate: string | null, asOf: Date): number {
  if (!lastFightDate) return rawRating;
  const lastMs = new Date(lastFightDate).getTime();
  const daysSince = (asOf.getTime() - lastMs) / 86400000;
  const periods = Math.floor(daysSince / DECAY_PERIOD_DAYS);
  if (periods <= 0) return rawRating;
  return Math.max(DECAY_FLOOR, rawRating - periods * DECAY_PER_PERIOD);
}

export interface DisplayEntry {
  slug: string;
  rawRating: number;
  displayRating: number;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  lastFightDate: string | null;
  eligible: boolean;
}

// 掲載資格: RIZIN通算3試合以上・直近18ヶ月以内に試合・RIZIN1勝以上。
export function isEligible(state: RatingState, asOf: Date): boolean {
  if (state.fights < ELIGIBILITY_MIN_FIGHTS) return false;
  if (state.wins < ELIGIBILITY_MIN_WINS) return false;
  if (!state.lastFightDate) return false;
  const monthsSince = (asOf.getTime() - new Date(state.lastFightDate).getTime()) / (30.44 * 86400000);
  if (monthsSince > ELIGIBILITY_MAX_INACTIVE_MONTHS) return false;
  return true;
}

export function buildDisplayEntries(states: Map<string, RatingState>, asOf: Date): Map<string, DisplayEntry> {
  const out = new Map<string, DisplayEntry>();
  for (const [slug, state] of states) {
    out.set(slug, {
      slug,
      rawRating: state.rawRating,
      displayRating: applyInactivityDecay(state.rawRating, state.lastFightDate, asOf),
      fights: state.fights,
      wins: state.wins,
      losses: state.losses,
      draws: state.draws,
      lastFightDate: state.lastFightDate,
      eligible: isEligible(state, asOf),
    });
  }
  return out;
}

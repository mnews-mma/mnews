// トップページのライブ帯(イベント接近時のみ表示)のステート判定。
// mnews-homepage-instructions.md §1。日数計算はJSTで行い、呼び出し側が
// SSR/ISRで確定させたstartOfTodayJstMs(JST 0:00のUTCエポックms)を渡す
// ことで、クライアント時刻に一切依存しない。
//
// 大前提: 試合結果の速報はやらない。「速報」「LIVE」「リアルタイム」「即日反映」
// の文言はこのモジュール・呼び出し側とも使わないこと。
export type LiveBandState = "PRE" | "DAY" | "POST";

export interface LiveBandInfo {
  state: LiveBandState;
  eventName: string;
  slug: string;
  daysUntil: number; // PRE: 1〜3 / DAY: 0 / POST: -1
}

interface UpcomingEventLike {
  slug: string;
  eventName: string;
  date: string; // YYYY-MM-DD
}

interface ResultEventLike {
  slug: string;
  eventName: string;
  date: string; // YYYY-MM-DD
}

function daysUntilFromJstMidnight(dateStr: string, startOfTodayJstMs: number): number {
  const eventMs = Date.parse(`${dateStr}T00:00:00+09:00`);
  return Math.round((eventMs - startOfTodayJstMs) / 86400000);
}

// 複数大会が候補になった場合は開催日が近い方(|daysUntil|が小さい方)を優先。
// 同着はPRE/DAY(daysUntil>=0、能動的に見に行ける対戦カード導線)をPOSTより優先する。
export function computeLiveBand(
  startOfTodayJstMs: number,
  upcomingEvents: UpcomingEventLike[],
  results: ResultEventLike[]
): LiveBandInfo | null {
  const candidates: LiveBandInfo[] = [];

  // POSTはresultsのみを対象にする(upcomingEventsのdaysUntil===-1は見ない)。
  // POST帯は/results/{slug}へリンクするため、結果がまだ掲載されていない
  // (=EVENT_RESULTSに無い)翌日には帯自体を出さない方が、404リンクを出すより
  // 安全なため。結果掲載が遅れた場合は自然にPOST帯が出ないだけで、フォールバック
  // 表示等はしない。
  for (const e of upcomingEvents) {
    const daysUntil = daysUntilFromJstMidnight(e.date, startOfTodayJstMs);
    if (daysUntil === 0) {
      candidates.push({ state: "DAY", eventName: e.eventName, slug: e.slug, daysUntil: 0 });
    } else if (daysUntil >= 1 && daysUntil <= 3) {
      candidates.push({ state: "PRE", eventName: e.eventName, slug: e.slug, daysUntil });
    }
  }

  for (const r of results) {
    const daysUntil = daysUntilFromJstMidnight(r.date, startOfTodayJstMs);
    if (daysUntil === -1) {
      candidates.push({ state: "POST", eventName: r.eventName, slug: r.slug, daysUntil: -1 });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const diff = Math.abs(a.daysUntil) - Math.abs(b.daysUntil);
    if (diff !== 0) return diff;
    return b.daysUntil - a.daysUntil; // 同着はdaysUntilが大きい(PRE/DAY寄り)方を優先
  });
  return candidates[0];
}

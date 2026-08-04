/**
 * src/app/fighters/[slug]/page.tsx の findEventSlug() と同一ロジック。
 * 監査(audit-event-slug-links.ts)・ゲート(check-event-slug-links.ts)から参照する。
 *
 * 注意: ゲート(check-event-slug-links.ts)は findEventSlug の内部条件を再検査
 * するのではなく、その出力が「slug実在 / 正規化後の名前完全一致 or alias表に
 * 明示 / 開催日±1日」を満たすかを独立に検査する。page.tsx側を変えたら
 * こちらも同期すること。
 */
import { EVENT_RESULTS, LISTED_EVENT_RESULTS } from "../../src/lib/eventResults";
import { shiftDateStr } from "../../src/lib/eventCountdown";

export const normEventName = (s: string) => s.replace(/\s/g, "");
const isDigitChar = (c: string | undefined) => !!c && /[0-9０-９]/.test(c);
const eventDigitRuns = (s: string) => (s.match(/[0-9０-９]+/g) ?? []).join(",");

interface EventIndexEntry {
  slug: string;
  date: string;
  normName: string;
  digitRuns: string;
  headIsDigit: boolean;
  tailIsDigit: boolean;
}

// page.tsx と同じく LISTED_EVENT_RESULTS(unlisted除外済み)から索引を作る。
const EVENT_INDEX: EventIndexEntry[] = LISTED_EVENT_RESULTS.map((e) => {
  const normName = normEventName(e.eventName);
  return {
    slug: e.slug,
    date: e.date,
    normName,
    digitRuns: eventDigitRuns(normName),
    headIsDigit: isDigitChar(normName[0]),
    tailIsDigit: isDigitChar(normName[normName.length - 1]),
  };
});

const EVENT_BY_NORM_NAME = new Map<string, EventIndexEntry[]>();
for (const e of EVENT_INDEX) {
  const list = EVENT_BY_NORM_NAME.get(e.normName);
  if (list) list.push(e);
  else EVENT_BY_NORM_NAME.set(e.normName, [e]);
}

function matchesEventName(target: string, e: EventIndexEntry): boolean {
  const en = e.normName;
  if (en === target) return true;
  for (let i = target.indexOf(en); i !== -1; i = target.indexOf(en, i + 1)) {
    if (e.headIsDigit && isDigitChar(target[i - 1])) continue;
    if (e.tailIsDigit && isDigitChar(target[i + en.length])) continue;
    return true;
  }
  if (target.length >= 8 && en.includes(target)) {
    const runs = eventDigitRuns(target);
    if (runs !== "" && runs === e.digitRuns) return true;
  }
  return false;
}

/** 大会名だけで一致する候補(日付判定の前段)。 */
export function findEventNameMatches(eventName: string): EventIndexEntry[] {
  const target = normEventName(eventName);
  return EVENT_BY_NORM_NAME.get(target) ?? EVENT_INDEX.filter((e) => matchesEventName(target, e));
}

/** 名前+日付の両方を通った候補。2件以上なら大会を特定できていない。 */
export function findEventCandidates(eventName: string, boutDate?: string): EventIndexEntry[] {
  const nameMatches = findEventNameMatches(eventName);
  if (nameMatches.length === 0 || !boutDate) return nameMatches;
  const allowed = [boutDate, shiftDateStr(boutDate, 1), shiftDateStr(boutDate, -1)];
  return nameMatches.filter((e) => allowed.includes(e.date));
}

export function findEventSlug(eventName: string, boutDate?: string): string | null {
  const candidates = findEventCandidates(eventName, boutDate);
  // 候補が2件以上残る場合(同日開催の紛らわしい大会名など)は先頭を採らず
  // リンクしない。誤リンクを出すよりリンク無しのほうが害が小さい。
  if (candidates.length !== 1) return null;
  return candidates[0].slug;
}

/** 修正前の実装(素朴な双方向部分一致)。監査での旧新比較にのみ使う。 */
export function findEventSlugLegacy(eventName: string): string | null {
  const target = normEventName(eventName);
  const match = EVENT_RESULTS.find((e) => {
    const en = normEventName(e.eventName);
    if (en === target || target.includes(en)) return true;
    if (target.length >= 8 && en.includes(target)) return true;
    return false;
  });
  return match ? match.slug : null;
}

export interface BoutRow {
  fighter: string;
  date: string;
  event: string;
  opponent: string;
}

/** 対戦テーブルに出うる全boutを data/ から集める。 */
export function collectBoutRows(sources: Record<string, unknown>): BoutRow[] {
  const rows: BoutRow[] = [];
  for (const source of Object.values(sources)) {
    if (!source || typeof source !== "object") continue;
    for (const [fighter, rec] of Object.entries(source as Record<string, unknown>)) {
      if (!rec || typeof rec !== "object") continue;
      for (const key of ["history", "bouts"]) {
        const arr = (rec as Record<string, unknown>)[key];
        if (!Array.isArray(arr)) continue;
        for (const b of arr) {
          const r = b as Record<string, unknown>;
          if (typeof r.event !== "string" || !r.event.trim()) continue;
          rows.push({
            fighter,
            date: typeof r.date === "string" ? r.date : "",
            event: r.event.trim(),
            opponent: String(r.opponentName ?? r.opponent ?? ""),
          });
        }
      }
    }
  }
  return rows;
}

export const ALL_RECORD_SOURCES = [
  "fighterRecords",
  "rizinRecords",
  "shootoRecords",
  "pancraseRecords",
  "deepRecords",
] as const;

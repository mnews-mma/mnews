/**
 * src/app/fighters/[slug]/page.tsx の findEventSlug() と同一ロジック。
 * 監査スクリプト(audit-event-slug-links.ts)・ゲート(check-event-slug-links.ts)
 * から参照する。page.tsx側を変更したらこちらも同期すること
 * (check-event-slug-links.ts が両者の出力一致を検査する)。
 */
import { EVENT_RESULTS } from "../../src/lib/eventResults";

export const EVENT_LINK_DATE_TOLERANCE_DAYS = 1;

export function parseYmd(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/** 大会名だけで一致する候補(日付判定の前段)。 */
export function findEventNameMatches(eventName: string) {
  const norm = (s: string) => s.replace(/\s/g, "");
  const isDigit = (c: string | undefined) => !!c && /[0-9０-９]/.test(c);
  const digitRuns = (s: string) => (s.match(/[0-9０-９]+/g) ?? []).join(",");
  const target = norm(eventName);
  return EVENT_RESULTS.filter((e) => {
    const en = norm(e.eventName);
    if (en === target) return true;
    const headCut = isDigit(en[0]);
    const tailCut = isDigit(en[en.length - 1]);
    for (let i = target.indexOf(en); i !== -1; i = target.indexOf(en, i + 1)) {
      if (headCut && isDigit(target[i - 1])) continue;
      if (tailCut && isDigit(target[i + en.length])) continue;
      return true;
    }
    if (target.length >= 8 && en.includes(target)) {
      const runs = digitRuns(target);
      if (runs !== "" && runs === digitRuns(en)) return true;
    }
    return false;
  });
}

export function findEventSlug(eventName: string, boutDate?: string): string | null {
  const nameMatches = findEventNameMatches(eventName);
  if (nameMatches.length === 0) return null;
  const boutAt = boutDate ? parseYmd(boutDate) : null;
  if (boutAt === null) return nameMatches[0].slug;
  const sameDay = nameMatches.find((e) => {
    const eventAt = parseYmd(String(e.date ?? ""));
    if (eventAt === null) return false;
    return Math.abs(boutAt - eventAt) <= EVENT_LINK_DATE_TOLERANCE_DAYS * 86400000;
  });
  return sameDay ? sameDay.slug : null;
}

/** 修正前の実装(素朴な双方向部分一致)。監査での旧新比較にのみ使う。 */
export function findEventSlugLegacy(eventName: string): string | null {
  const norm = (s: string) => s.replace(/\s/g, "");
  const target = norm(eventName);
  const match = EVENT_RESULTS.find((e) => {
    const en = norm(e.eventName);
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

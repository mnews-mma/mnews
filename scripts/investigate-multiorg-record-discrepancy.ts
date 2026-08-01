// 指示書R/R-1b(2026-08-01, read-only調査専用): fighterRecords.json(1行目)と
// computeMultiOrgRecord(2行目、RIZIN・修斗・パンクラス・DEEP4団体合算)を
// 全選手で突合し、2行目が1行目を上回る(=1行目に対応が無いboutが2行目に
// 算入されている)選手を列挙する。
//
// 出力: out/multiorg-discrepancy-fighter-summary.json(該当選手ごとのサマリー、
// needsReview/recordFromResultsフラグ付き)・out/multiorg-discrepancy-excess-bouts.csv
// (超過bout全件、正規化経路ラベル付き)。
//
// このスクリプトはdata/・src/への書き込みを一切行わない(read-only)。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "out");

// --- scripts/lib/fighterNameBackfill.tsの正規化ロジックの複製(調査目的の
// 分類専用。本体は変更しない) ---
const VARIANT_CHAR_MAP: Record<string, string> = {
  "髙": "高",
  "﨑": "崎",
  "齋": "斉",
  "齊": "斉",
  "斎": "斉",
  "濵": "浜",
};
const VARIANT_CHAR_RE = new RegExp(`[${Object.keys(VARIANT_CHAR_MAP).join("")}]`, "g");
const HOMOGRAPH_CHAR_MAP: Record<string, string> = {
  "ニ": "二",
  "ロ": "口",
  "カ": "力",
  "エ": "工",
  "ト": "卜",
};
const HOMOGRAPH_CHAR_RE = new RegExp(`[${Object.keys(HOMOGRAPH_CHAR_MAP).join("")}]`, "g");
const QUOTE_SYMBOL_RE = /["'‘’“”〝〞〟・·‧]/g;
const QUOTED_INSERT_RE = /["'‘’“”][^"'‘’“”]*["'‘’“”]|「[^」]*」/g;

function nfkcWs(s: string): string {
  return s.normalize("NFKC").replace(/[\s　]/g, "");
}
function stripQuoteSymbols(s: string): string {
  return s.replace(QUOTE_SYMBOL_RE, "");
}
function applyVariant(s: string): string {
  return s.replace(VARIANT_CHAR_RE, (c) => VARIANT_CHAR_MAP[c]);
}
function applyHomograph(s: string): string {
  return s.replace(HOMOGRAPH_CHAR_RE, (c) => HOMOGRAPH_CHAR_MAP[c]);
}
function fullNormalize(s: string): string {
  return applyHomograph(applyVariant(stripQuoteSymbols(nfkcWs(s))));
}
function stripQuotedInsert(name: string): string {
  return name.replace(QUOTED_INSERT_RE, "");
}

type MatchLabel =
  | "exact"
  | "nfkc_whitespace"
  | "quote_symbol"
  | "variant_char"
  | "homograph_char"
  | "quoted_insert"
  | "no_match_found";

// raw(bout側生表記)とcanonicalRaw(fighters.ts側表記)を同じ段階まで
// 同時に正規化して比較する。canonical側だけ先にフル正規化すると、
// 両辺とも元々同じ文字種を使っているだけのケースまで誤ってhomograph_char
// 等に分類されてしまうため、必ず対で進める。
function classifyOne(raw: string, canonicalRaw: string): MatchLabel | null {
  if (raw === canonicalRaw) return "exact";
  const rawA = nfkcWs(raw);
  const canA = nfkcWs(canonicalRaw);
  if (rawA === canA) return "nfkc_whitespace";
  const rawB = stripQuoteSymbols(rawA);
  const canB = stripQuoteSymbols(canA);
  if (rawB === canB) return "quote_symbol";
  const rawC = applyVariant(rawB);
  const canC = applyVariant(canB);
  if (rawC === canC) return "variant_char";
  const rawD = applyHomograph(rawC);
  const canD = applyHomograph(canC);
  if (rawD === canD) return "homograph_char";
  const stripped = stripQuotedInsert(raw);
  if (stripped !== raw && fullNormalize(stripped) === fullNormalize(canonicalRaw)) return "quoted_insert";
  return null;
}

function classifyMatch(raw: string, slug: string): { label: MatchLabel; matchedAgainst: string } {
  const fighter = FIGHTERS.find((f) => f.slug === slug);
  if (!fighter) return { label: "no_match_found", matchedAgainst: "(fighter not found)" };
  const candidates = [fighter.nameJa, ...((fighter as { aliases?: string[] }).aliases ?? [])];
  let best: { label: MatchLabel; matchedAgainst: string } | null = null;
  const rank: MatchLabel[] = ["exact", "nfkc_whitespace", "quote_symbol", "variant_char", "homograph_char", "quoted_insert"];
  for (const cand of candidates) {
    const label = classifyOne(raw, cand);
    if (label && (!best || rank.indexOf(label) < rank.indexOf(best.label))) {
      best = { label, matchedAgainst: cand };
    }
  }
  return best ?? { label: "no_match_found", matchedAgainst: "(none)" };
}

// --- 生データ読み込み ---
interface RawBout {
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string;
  resultType: string;
  winnerName: string | null;
  methodRaw: string;
}
interface RawEvent {
  eventName: string;
  date: string | null;
  bouts: RawBout[];
}
function loadEvents(file: string): RawEvent[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as RawEvent[];
}
const rizinEvents = loadEvents("rizinRecords.json");
const shootoEvents = loadEvents("shootoRecords.json");
const pancraseEvents = loadEvents("pancraseRecords.json");
const deepEvents = loadEvents("deepRecords.json");

const MMA_RULE_TYPES = new Set(["MMA"]);

interface CountedBout {
  org: string;
  event: string;
  date: string | null;
  resultType: string;
  isWin: boolean;
  ownRaw: string;
  opponentRaw: string;
  opponentSlug: string | null;
  methodRaw: string;
}

function gatherCountedBouts(org: string, events: RawEvent[], slug: string, requireMma: boolean): CountedBout[] {
  const out: CountedBout[] = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;
      if (requireMma && !MMA_RULE_TYPES.has(b.ruleType)) continue;
      if (b.resultType !== "decisive" && b.resultType !== "draw") continue; // wins/losses/drawsに寄与する試合のみ
      const ownRaw = isA ? b.fighterAName : b.fighterBName;
      const opponentRaw = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;
      const isWin = (isA && b.winnerName === b.fighterAName) || (isB && b.winnerName === b.fighterBName);
      out.push({ org, event: ev.eventName, date: ev.date, resultType: b.resultType, isWin, ownRaw, opponentRaw, opponentSlug, methodRaw: b.methodRaw });
    }
  }
  return out;
}

function computeSecondLine(slug: string) {
  return [
    ...gatherCountedBouts("RIZIN", rizinEvents, slug, true),
    ...gatherCountedBouts("修斗", shootoEvents, slug, false),
    ...gatherCountedBouts("パンクラス", pancraseEvents, slug, true),
    ...gatherCountedBouts("DEEP", deepEvents, slug, false),
  ];
}

// --- fighterRecords.json(1行目) ---
interface HistoryEntry {
  date: string;
  opponent: string;
  result: string;
  method: string;
  event: string;
}
const fighterRecords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "fighterRecords.json"), "utf8")) as Record<
  string,
  { wins: number; losses: number; draws: number; history?: HistoryEntry[]; noRecordData?: boolean }
>;

// --- R1: 全選手突合 ---
interface OverRow {
  slug: string;
  firstWins: number;
  firstLosses: number;
  firstDraws: number;
  firstTotal: number;
  secondWins: number;
  secondLosses: number;
  secondDraws: number;
  secondTotal: number;
  exceedWins: number;
  exceedLosses: number;
  exceedDraws: number;
  exceedTotal: number;
  maxExceed: number;
  needsReview: boolean;
  recordFromResults: boolean;
}

const slugs = Object.keys(fighterRecords).filter((s) => !fighterRecords[s].noRecordData);
const over: OverRow[] = [];

for (const slug of slugs) {
  const first = fighterRecords[slug];
  const firstTotal = first.wins + first.losses + first.draws;
  const counted = computeSecondLine(slug);
  const secondWins = counted.filter((b) => b.resultType === "decisive" && b.isWin).length;
  const secondLosses = counted.filter((b) => b.resultType === "decisive" && !b.isWin).length;
  const secondDraws = counted.filter((b) => b.resultType === "draw").length;
  const secondTotal = counted.length;

  const exceedWins = secondWins - first.wins;
  const exceedLosses = secondLosses - first.losses;
  const exceedDraws = secondDraws - first.draws;
  const exceedTotal = secondTotal - firstTotal;

  if (exceedWins > 0 || exceedLosses > 0 || exceedDraws > 0 || exceedTotal > 0) {
    const fighter = FIGHTERS.find((f) => f.slug === slug);
    over.push({
      slug,
      firstWins: first.wins,
      firstLosses: first.losses,
      firstDraws: first.draws,
      firstTotal,
      secondWins,
      secondLosses,
      secondDraws,
      secondTotal,
      exceedWins,
      exceedLosses,
      exceedDraws,
      exceedTotal,
      maxExceed: Math.max(exceedWins, exceedLosses, exceedDraws, exceedTotal),
      needsReview: !!fighter?.needsReview,
      recordFromResults: !!(fighter as { recordFromResults?: boolean } | undefined)?.recordFromResults,
    });
  }
}
over.sort((a, b) => b.maxExceed - a.maxExceed);

console.log(`fighterRecords.json total: ${Object.keys(fighterRecords).length}, with record data: ${slugs.length}`);
console.log(`\n=== 2行目が1行目を上回る選手: ${over.length}名 ===\n`);
for (const r of over) {
  console.log(
    `${r.slug}: 1行目=${r.firstWins}-${r.firstLosses}-${r.firstDraws}(計${r.firstTotal}) 2行目=${r.secondWins}-${r.secondLosses}-${r.secondDraws}(計${r.secondTotal}) needsReview=${r.needsReview} recordFromResults=${r.recordFromResults}`
  );
}

// --- R-1b: 超過bout抽出+正規化経路分類 ---
interface ExcessRow {
  slug: string;
  org: string;
  date: string | null;
  event: string;
  opponentRaw: string;
  ownRaw: string;
  resultType: string;
  matchLabel: MatchLabel;
  matchedAgainst: string;
}
const excessRows: ExcessRow[] = [];

for (const r of over) {
  const first = fighterRecords[r.slug];
  const historyDates = new Set((first.history ?? []).map((h) => h.date));
  const counted = computeSecondLine(r.slug);
  for (const b of counted) {
    if (b.date && historyDates.has(b.date)) continue;
    const { label, matchedAgainst } = classifyMatch(b.ownRaw, r.slug);
    excessRows.push({ slug: r.slug, org: b.org, date: b.date, event: b.event, opponentRaw: b.opponentRaw, ownRaw: b.ownRaw, resultType: b.resultType, matchLabel: label, matchedAgainst });
  }
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function csvEscape(s: string | null): string {
  if (s === null) return "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const csvLines: string[] = [["slug", "org", "date", "event", "opponentRaw", "ownRaw", "resultType", "matchLabel", "matchedAgainst"].join(",")];
for (const r of excessRows) {
  csvLines.push([r.slug, r.org, r.date, r.event, r.opponentRaw, r.ownRaw, r.resultType, r.matchLabel, r.matchedAgainst].map(csvEscape).join(","));
}
fs.writeFileSync(path.join(OUT_DIR, "multiorg-discrepancy-excess-bouts.csv"), csvLines.join("\n") + "\n");
fs.writeFileSync(path.join(OUT_DIR, "multiorg-discrepancy-fighter-summary.json"), JSON.stringify(over, null, 2));

const labelCounts = new Map<string, { fighters: Set<string>; bouts: number }>();
for (const r of excessRows) {
  if (!labelCounts.has(r.matchLabel)) labelCounts.set(r.matchLabel, { fighters: new Set(), bouts: 0 });
  const e = labelCounts.get(r.matchLabel)!;
  e.fighters.add(r.slug);
  e.bouts += 1;
}
console.log("\n=== マッチ種別ごとの集計 ===");
for (const [label, e] of [...labelCounts.entries()].sort((a, b) => b[1].bouts - a[1].bouts)) {
  console.log(`${label}: 選手${e.fighters.size}名 / 超過bout${e.bouts}件`);
}

const flagged = over.filter((r) => r.needsReview || r.recordFromResults);
console.log(`\nneedsReview または recordFromResults: ${flagged.length}/${over.length}名`);
console.log(`\nCSV: out/multiorg-discrepancy-excess-bouts.csv (${excessRows.length}行)`);
console.log(`JSON: out/multiorg-discrepancy-fighter-summary.json (${over.length}名)`);

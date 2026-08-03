// 指示書C: 修斗クロスorg監査(261名候補)。
// #418(kasuya-yusuke)で判明した「org!=="shooto"かつorgsにshootoを含まない261名」
// について、修斗公式選手一覧ページ(1ページ、追加fetch不要)のnameJa表記突合で
// idを特定し(推測なし)、特定できた選手のみプロフィールページを取得して
// mnews側の修斗boutと突合する。read-only(data/・fighters.tsへの書き込みは
// 一切行わない)。
//
// 実行: npx tsx scripts/investigate-shooto-crossorg-audit-261.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { assertAllowedByRobots } from "./lib/robotsGate";
import { normalize as bfNormalize } from "./lib/fighterNameBackfill";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_PROFILE_FETCH = 300;
const LISTING_URL = "https://www.shooto-mma.com/fighters/";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

// ── a) 母数確定: 261名候補の抽出 ──
const candidates: Fighter[] = FIGHTERS.filter(
  (f) => f.org !== "shooto" && !(f.orgs ?? []).includes("shooto")
);

// 単独名・短い名前(同名別人リスクが高い、要裏取り扱い)。
function isHighCollisionRiskName(name: string): boolean {
  return bfNormalize(name).length <= 3;
}

// ── b) 修斗公式選手一覧ページの解析(1ページのみ) ──
interface SiteRow {
  id: string;
  siteNameJa: string;
  siteNameEn: string;
  gym: string;
  lastDate: string;
  weightClass: string;
}

const LISTING_ROW_RE =
  /<tr><td><a href="\.\/\?id=(\d+)">([^<]*)<\/a><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g;

function parseListing(html: string): SiteRow[] {
  const rows: SiteRow[] = [];
  let m: RegExpExecArray | null;
  LISTING_ROW_RE.lastIndex = 0;
  while ((m = LISTING_ROW_RE.exec(html))) {
    rows.push({
      id: m[1],
      siteNameJa: m[2].trim(),
      siteNameEn: m[3].trim(),
      gym: m[4].trim(),
      lastDate: m[5].trim(),
      weightClass: m[6].trim(),
    });
  }
  return rows;
}

type MatchAxis = "nameJa" | "alias";

interface MatchResult {
  slug: string;
  nameJa: string;
  org: string;
  matched: boolean;
  ambiguous: boolean;
  highCollisionRisk: boolean;
  matchAxis: MatchAxis | null;
  matchedRaw: string | null; // nameJa/aliasのどの文字列で一致したか
  id: string | null;
  siteNameJa: string | null;
  siteNameEn: string | null;
  ambiguousIds: string[];
}

async function main() {
  const listingHtml = await fetchHtml(LISTING_URL);
  const siteRows = parseListing(listingHtml);
  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-crossorg-listing-raw.json"),
    JSON.stringify(siteRows, null, 2) + "\n"
  );

  // 正規化nameJa -> id[](複数あれば同名衝突=ambiguous)。
  // 単純な空白除去(normName)だけでなく異体字・同形字統一(bfNormalize、
  // fighterNameBackfill.tsの正規化ルールを流用)も適用し、表記ゆれによる
  // 見かけ上の不一致(髙→高等)を減らす。
  const siteIndex = new Map<string, SiteRow[]>();
  for (const row of siteRows) {
    const n = bfNormalize(row.siteNameJa);
    if (!n) continue;
    const arr = siteIndex.get(n) ?? [];
    arr.push(row);
    siteIndex.set(n, arr);
  }

  const matches: MatchResult[] = [];
  for (const f of candidates) {
    const highCollisionRisk = isHighCollisionRiskName(f.nameJa);
    let matchAxis: MatchAxis | null = null;
    let matchedRaw: string | null = null;
    let rowsFound: SiteRow[] = [];

    const nameJaKey = bfNormalize(f.nameJa);
    if (nameJaKey && siteIndex.has(nameJaKey)) {
      rowsFound = siteIndex.get(nameJaKey)!;
      matchAxis = "nameJa";
      matchedRaw = f.nameJa;
    } else {
      for (const alias of f.aliases ?? []) {
        const aliasKey = bfNormalize(alias);
        if (aliasKey && siteIndex.has(aliasKey)) {
          rowsFound = siteIndex.get(aliasKey)!;
          matchAxis = "alias";
          matchedRaw = alias;
          break;
        }
      }
    }

    if (rowsFound.length === 0) {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: false,
        ambiguous: false,
        highCollisionRisk,
        matchAxis: null,
        matchedRaw: null,
        id: null,
        siteNameJa: null,
        siteNameEn: null,
        ambiguousIds: [],
      });
    } else if (rowsFound.length > 1) {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: false,
        ambiguous: true,
        highCollisionRisk: true, // 複数id該当は無条件で要裏取り
        matchAxis,
        matchedRaw,
        id: null,
        siteNameJa: rowsFound[0].siteNameJa,
        siteNameEn: null,
        ambiguousIds: rowsFound.map((r) => r.id),
      });
    } else {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: true,
        ambiguous: false,
        highCollisionRisk,
        matchAxis,
        matchedRaw,
        id: rowsFound[0].id,
        siteNameJa: rowsFound[0].siteNameJa,
        siteNameEn: rowsFound[0].siteNameEn,
        ambiguousIds: [],
      });
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-crossorg-id-matches.json"),
    JSON.stringify(matches, null, 2) + "\n"
  );

  const matchedTargets = matches.filter((m) => m.matched && m.id);
  const unmatched = matches.filter((m) => !m.matched && !m.ambiguous);
  const ambiguous = matches.filter((m) => m.ambiguous);
  const aliasAxisMatches = matchedTargets.filter((m) => m.matchAxis === "alias");

  console.log(`候補総数: ${candidates.length}`);
  console.log(`id特定: ${matchedTargets.length} (うちaliasesで一致=名寄せ軸ヒット: ${aliasAxisMatches.length})`);
  console.log(`未特定: ${unmatched.length}`);
  console.log(`同名複数該当(ambiguous): ${ambiguous.length}`);

  if (matchedTargets.length > MAX_PROFILE_FETCH) {
    console.log(
      `\n[STOP] id特定できた${matchedTargets.length}名がfetch上限${MAX_PROFILE_FETCH}件を超過。分割が必要なためプロフィールfetchは行わず停止する。`
    );
    const summaryOnly = {
      candidatesTotal: candidates.length,
      matchedCount: matchedTargets.length,
      aliasAxisMatchCount: aliasAxisMatches.length,
      unmatchedCount: unmatched.length,
      ambiguousCount: ambiguous.length,
      stoppedForFetchCap: true,
    };
    fs.writeFileSync(
      path.join(process.cwd(), "out", "shooto-crossorg-audit-summary.json"),
      JSON.stringify(summaryOnly, null, 2) + "\n"
    );
    return;
  }

  // ── c) 既存データ突合(shootoRecords.json + shootoProfileBouts.json + fighters.ts history) ──
  const shootoRecordsPath = path.join(process.cwd(), "data", "shootoRecords.json");
  const shootoProfileBoutsPath = path.join(process.cwd(), "data", "shootoProfileBouts.json");
  const shootoRecords: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(shootoRecordsPath, "utf8"));
  const shootoProfileBouts: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(shootoProfileBoutsPath, "utf8"));
  const combinedEvents = [...shootoRecords, ...shootoProfileBouts];
  const eventIdSet = new Set<number>(shootoRecords.map((e) => e.shootoEventId));
  const fighterBySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

  interface ExistingBout {
    source: "shootoData" | "fightersHistory";
    date: string;
    opponentNorm: string;
    opponentRaw: string;
    result: "win" | "loss" | "draw" | "unknown";
  }

  function buildExistingIndex(slug: string): ExistingBout[] {
    const out: ExistingBout[] = [];
    const rec = computeFighterShootoRecord(combinedEvents, slug);
    for (const b of rec.bouts) {
      let result: ExistingBout["result"] = "unknown";
      if (b.resultType === "draw") result = "draw";
      else if (b.resultType === "decisive") result = b.isWin ? "win" : "loss";
      out.push({
        source: "shootoData",
        date: b.date,
        opponentNorm: normName(b.opponentName),
        opponentRaw: b.opponentName,
        result,
      });
    }
    const fighter = fighterBySlug.get(slug);
    if (fighter && Array.isArray((fighter as any).history)) {
      for (const h of (fighter as any).history as any[]) {
        out.push({
          source: "fightersHistory",
          date: h.date,
          opponentNorm: normName(h.opponent),
          opponentRaw: h.opponent,
          result: h.result === "nc" ? "unknown" : h.result,
        });
      }
    }
    const dedupMap = new Map<string, ExistingBout>();
    for (const e of out) {
      const key = `${e.date}|${e.opponentNorm}`;
      const existingEntry = dedupMap.get(key);
      if (!existingEntry || (existingEntry.source === "fightersHistory" && e.source === "shootoData")) {
        dedupMap.set(key, e);
      }
    }
    return [...dedupMap.values()];
  }

  interface ProfileBout {
    section: "SHOOTO" | "VTJ";
    date: string;
    symbol: string;
    result: "win" | "loss" | "draw" | "unknown";
    opponentNameRaw: string;
    methodRaw: string;
    linkedResultId: string | null;
  }

  function resultFromSymbol(sym: string): ProfileBout["result"] {
    if (sym === "○") return "win";
    if (sym === "×") return "loss";
    if (sym === "△") return "draw";
    return "unknown";
  }

  const ROW_RE =
    /<tr><td[^>]*>(?:<a href="\/result\/\?id=(\d+)">)?(\d{4}-\d{2}-\d{2})(?:<\/a>)?<\/td><td[^>]*>([○×△])<\/td><td><a href="\/fighters\/\?id=(\d+)">([^<]*)<\/a><p>([^<]*)<\/p><\/tr>/g;

  function parseProfilePage(html: string): { totalHeader: { total: number; win: number; lose: number; draw: number } | null; bouts: ProfileBout[] } {
    const bouts: ProfileBout[] = [];
    const headerMatch = html.match(
      /<span class="total_num"><b>(\d+)<\/b>戦<\/span><span class="win_num"><b>(\d+)<\/b>勝<\/span><span class="lose_num"><b>(\d+)<\/b>敗<\/span>/
    );
    const drawMatch = html.match(/<span class="draw_num"><b>(\d+)<\/b>分<\/span>/);
    const totalHeader = headerMatch
      ? {
          total: Number(headerMatch[1]),
          win: Number(headerMatch[2]),
          lose: Number(headerMatch[3]),
          draw: drawMatch ? Number(drawMatch[1]) : 0,
        }
      : null;

    const sectionRe = /<h5>(SHOOTO戦績|VTJ戦績)<\/h5><table[^>]*>([\s\S]*?)<\/table>/g;
    let secM: RegExpExecArray | null;
    while ((secM = sectionRe.exec(html))) {
      const section: "SHOOTO" | "VTJ" = secM[1] === "SHOOTO戦績" ? "SHOOTO" : "VTJ";
      const tableHtml = secM[2];
      let rowM: RegExpExecArray | null;
      ROW_RE.lastIndex = 0;
      while ((rowM = ROW_RE.exec(tableHtml))) {
        const [, resultId, date, symbol, , oppNameRaw, methodRaw] = rowM;
        bouts.push({
          section,
          date,
          symbol,
          result: resultFromSymbol(symbol),
          opponentNameRaw: oppNameRaw.trim(),
          methodRaw: methodRaw.trim(),
          linkedResultId: resultId ?? null,
        });
      }
    }
    return { totalHeader, bouts };
  }

  const CUTOFF = "2012-12-24";
  type Category = "matched" | "new1_precutoff" | "new2a_bout_missing_in_existing_event" | "new2b_event_missing" | "mismatch";

  interface FighterGapResult {
    slug: string;
    nameJa: string;
    org: string;
    matchAxis: MatchAxis | null;
    highCollisionRisk: boolean;
    shootoId: string;
    profileTotalHeader: { total: number; win: number; lose: number; draw: number } | null;
    profileBoutCount: number;
    existingBoutCount: number;
    gapCount: number;
    gapCategoryCounts: Record<string, number>;
    mismatchCount: number;
  }

  const perFighterResults: FighterGapResult[] = [];
  const unreachable: { slug: string; nameJa: string; id: string; error: string }[] = [];
  let fetchedCount = 0;

  for (const t of matchedTargets) {
    const url = `https://www.shooto-mma.com/fighters/?id=${t.id}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      unreachable.push({ slug: t.slug, nameJa: t.nameJa, id: t.id!, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const { totalHeader, bouts } = parseProfilePage(html);
    const existing = buildExistingIndex(t.slug);
    const existingByKey = new Map<string, ExistingBout[]>();
    for (const e of existing) {
      const key = `${e.date}|${e.opponentNorm}`;
      const arr = existingByKey.get(key) ?? [];
      arr.push(e);
      existingByKey.set(key, arr);
    }

    const categoryCounts: Record<string, number> = {};
    let mismatchCount = 0;
    for (const b of bouts) {
      const oppNorm = normName(b.opponentNameRaw);
      const candidatesFound = existingByKey.get(`${b.date}|${oppNorm}`) ?? [];
      let category: Category;
      if (candidatesFound.length === 0) {
        if (b.date < CUTOFF) category = "new1_precutoff";
        else if (b.linkedResultId && eventIdSet.has(Number(b.linkedResultId))) category = "new2a_bout_missing_in_existing_event";
        else category = "new2b_event_missing";
      } else {
        const cand = candidatesFound[0];
        category = "matched";
        if (cand.result !== "unknown" && b.result !== "unknown" && cand.result !== b.result) {
          category = "mismatch";
          mismatchCount++;
        }
      }
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }

    const gapCount = bouts.length - (categoryCounts["matched"] ?? 0);

    perFighterResults.push({
      slug: t.slug,
      nameJa: t.nameJa,
      org: t.org,
      matchAxis: t.matchAxis,
      highCollisionRisk: t.highCollisionRisk,
      shootoId: t.id!,
      profileTotalHeader: totalHeader,
      profileBoutCount: bouts.length,
      existingBoutCount: categoryCounts["matched"] ?? 0,
      gapCount,
      gapCategoryCounts: categoryCounts,
      mismatchCount,
    });
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-crossorg-per-fighter.json"),
    JSON.stringify(perFighterResults, null, 2) + "\n"
  );

  const fightersWithGap = perFighterResults.filter((r) => r.gapCount > 0);
  const totalGapBouts = perFighterResults.reduce((s, r) => s + r.gapCount, 0);
  const totalMismatch = perFighterResults.reduce((s, r) => s + r.mismatchCount, 0);

  const summary = {
    candidatesTotal: candidates.length,
    matchedCount: matchedTargets.length,
    aliasAxisMatchCount: aliasAxisMatches.length,
    aliasAxisMatches: aliasAxisMatches.map((m) => ({ slug: m.slug, nameJa: m.nameJa, matchedRaw: m.matchedRaw, siteNameJa: m.siteNameJa })),
    unmatchedCount: unmatched.length,
    unmatched: unmatched.map((m) => ({ slug: m.slug, nameJa: m.nameJa, org: m.org })),
    ambiguousCount: ambiguous.length,
    ambiguous: ambiguous.map((m) => ({ slug: m.slug, nameJa: m.nameJa, ambiguousIds: m.ambiguousIds })),
    fetchedCount,
    unreachableCount: unreachable.length,
    unreachable,
    fightersWithGapCount: fightersWithGap.length,
    totalGapBouts,
    totalMismatch,
    highCollisionRiskMatchedCount: matchedTargets.filter((m) => m.highCollisionRisk).length,
  };
  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-crossorg-audit-summary.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

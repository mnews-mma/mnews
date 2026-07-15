// P1(σディスカウント D=70)+P2(単調性オーバーレイ N=2) 最終確認ダンプ。
// data/rankings.json等への書き込みは一切行わない(読み取り専用・目視確認用)。
// 王者の除外・番号付けは実運用(scripts/update-mnews-rating.ts)と同じロジックで
// 解決するため、この採番は公開ページ(/rankings/[division])の表示と一致する。
// 実行: npx tsx scripts/dump-ranking-p1-comparison.ts
import fs from "fs";
import path from "path";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  computePreDebutRecords,
  computeInitialRatingOverrides,
  detectWeighInMiss,
  filterPublishableStates,
  isRizinMmaEvent,
  DisplayEntry,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, MnewsDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { findRankerWinExemptions, isStandardEligible, summarizeBoutsForFighter } from "../src/lib/mnewsRating/eligibilityRules";
import { buildDivisionRankings, ChampionOverlay, FighterMeta, roundToDisplayStep } from "../src/lib/mnewsRating/rankingsFile";
import { extractH2HWinsForDivision, H2HWin } from "../src/lib/mnewsRating/monotonicity";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import {
  ELO_PARAMS_V5,
  DECAY_PARAMS_V6,
  INITIAL_RATING_BOOST_PARAMS_V6,
  SIGMA_DISCOUNT_COEFFICIENT_V7,
  MONOTONICITY_MAX_RANK_GAP,
} from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");

function applyRizinRecordsOverride(records: FighterRecordsInput): FighterRecordsInput {
  if (!fs.existsSync(RIZIN_RECORDS_PATH)) return records;
  const rizinEvents: RizinRecordsEvent[] = JSON.parse(fs.readFileSync(RIZIN_RECORDS_PATH, "utf8"));
  const index = buildRizinRecordsIndex(rizinEvents);
  const out: FighterRecordsInput = {};
  for (const [slug, entry] of Object.entries(records)) {
    const { history } = applyRizinRecordsToHistory(slug, entry.history ?? [], index);
    out[slug] = { ...entry, history };
  }
  return out;
}

function lastRizinMmaWeighInMiss(records: FighterRecordsInput, slug: string): boolean {
  const history = (records[slug]?.history ?? []).filter((h) => isRizinMmaEvent(h.event));
  const latest = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return latest ? detectWeighInMiss(latest) : false;
}

// 王者は「事実」としてElo掲載資格とは独立に表示する(update-mnews-rating.tsの
// championOverlayForと同一ロジック)。この解決を省略すると番号付きランキングの
// 採番が公開ページ(王者別掲→1..N)とズレる(2026-07-16に判明した表示アーティファクト)。
function championOverlayFor(division: MnewsDivision, display: Map<string, DisplayEntry>): ChampionOverlay | null {
  const champ = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
  if (!champ || !champ.slug) return null;
  const d = display.get(champ.slug);
  return {
    fighterId: champ.slug,
    rating: d ? roundToDisplayStep(d.displayRating) : null,
    record: d ? { wins: d.wins, losses: d.losses, draws: d.draws } : null,
    lastFight: d?.lastFightDate ?? null,
  };
}

function setup() {
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const records = applyRizinRecordsOverride(rawRecords);

  const nominalWeightClassBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.weightClass]));
  const divisionBySlug = new Map(
    Object.entries(records).map(([slug, entry]) => [
      slug,
      getDivisionOverlay(slug) ?? latestRizinDivision(entry.history ?? [], nominalWeightClassBySlug.get(slug)),
    ])
  );

  const asOf = new Date();
  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  const { bouts } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, asOf, isOpeningFightOverride);
  const preDebutRecords = computePreDebutRecords(records);
  const rizinFightCountsForSeed = new Map(
    [...preDebutRecords.keys()].map((slug) => [slug, summarizeBoutsForFighter(bouts, slug).length])
  );
  const initialRatingOverrides = computeInitialRatingOverrides(preDebutRecords, INITIAL_RATING_BOOST_PARAMS_V6, rizinFightCountsForSeed);
  const states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides);
  const publishable = filterPublishableStates(states, records);
  const display = buildDisplayEntries(publishable, asOf, DECAY_PARAMS_V6);

  const hiddenSlugs = new Set(FIGHTERS.filter((f) => f.hidden).map((f) => f.slug));
  const isExcludedByFact = (slug: string): boolean => isRetired(slug) || hiddenSlugs.has(slug);

  const boutSummariesBySlug = new Map<string, ReturnType<typeof summarizeBoutsForFighter>>();
  for (const slug of Object.keys(records)) {
    boutSummariesBySlug.set(slug, summarizeBoutsForFighter(bouts, slug));
  }

  const baseRankersByDivision = new Map<MnewsDivision, Set<string>>();
  for (const division of MNEWS_DIVISIONS) baseRankersByDivision.set(division, new Set());
  for (const [slug, division] of divisionBySlug) {
    if (!division || isExcludedByFact(slug)) continue;
    const summaries = boutSummariesBySlug.get(slug) ?? [];
    const lastFightDate = display.get(slug)?.lastFightDate ?? null;
    if (isStandardEligible(summaries, division, lastFightDate, asOf)) {
      baseRankersByDivision.get(division)!.add(slug);
    }
  }

  const currentYearPrefix = `${asOf.getFullYear()}-`;
  const rankerWinExemptions = findRankerWinExemptions(boutSummariesBySlug, divisionBySlug, baseRankersByDivision, currentYearPrefix);

  const eligibleEntriesByDivision = new Map<MnewsDivision, Array<{ meta: FighterMeta; display: DisplayEntry }>>();
  const h2hWinsByDivision = new Map<MnewsDivision, H2HWin[]>();
  const championByDivision = new Map<MnewsDivision, ChampionOverlay | null>();
  for (const division of MNEWS_DIVISIONS) {
    const rankers = baseRankersByDivision.get(division)!;
    const entries = [...display.entries()]
      .filter(([slug]) => divisionBySlug.get(slug) === division && !isExcludedByFact(slug) && (rankers.has(slug) || rankerWinExemptions.has(slug)))
      .map(([slug, e]) => ({ meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) }, display: e }));
    eligibleEntriesByDivision.set(division, entries);
    h2hWinsByDivision.set(division, extractH2HWinsForDivision(bouts, new Set(entries.map((e) => e.meta.slug))));
    championByDivision.set(division, championOverlayFor(division, display));
  }

  return { asOf, eligibleEntriesByDivision, h2hWinsByDivision, championByDivision };
}

function main() {
  console.log(`=== P1(σディスカウント D=${SIGMA_DISCOUNT_COEFFICIENT_V7})+P2(単調性オーバーレイ N=${MONOTONICITY_MAX_RANK_GAP}) 最終確認ダンプ ===`);
  console.log("読み取り専用・data/rankings.json等への書き込みなし。採番は公開ページと同一ロジック(王者別掲)\n");

  const { asOf, eligibleEntriesByDivision, h2hWinsByDivision, championByDivision } = setup();

  for (const division of MNEWS_DIVISIONS) {
    const eligibleEntries = eligibleEntriesByDivision.get(division)!;
    if (eligibleEntries.length === 0) continue;
    const h2hWins = h2hWinsByDivision.get(division)!;
    const champion = championByDivision.get(division)!;

    // 現行(σディスカウントなし・単調性オーバーレイなし)
    const baseline = buildDivisionRankings(division, eligibleEntries, asOf, undefined, champion);
    const baselineRankBySlug = new Map(baseline.entries.map((e) => [e.fighterId, e.rank]));

    // 最終候補(D=70 + 単調性オーバーレイN=2)
    const final = buildDivisionRankings(division, eligibleEntries, asOf, undefined, champion, "overlay", SIGMA_DISCOUNT_COEFFICIENT_V7, {
      h2hWins,
      maxRankGap: MONOTONICITY_MAX_RANK_GAP,
    });
    const finalRankBySlug = new Map(final.entries.map((e) => [e.fighterId, e.rank]));

    console.log(`\n=== ${division}${champion ? `(王者: ${champion.fighterId})` : ""} ===`);
    console.log(`${"slug".padEnd(24)} ${"旧rank".padEnd(7)} ${"新rank".padEnd(7)} ${"rawR".padEnd(9)} n`);

    const rows = eligibleEntries
      .filter((e) => e.meta.slug !== champion?.fighterId)
      .map((e) => ({
        slug: e.meta.slug,
        rawR: e.display.displayRating,
        n: e.display.fights,
        oldRank: baselineRankBySlug.get(e.meta.slug) ?? 999,
        newRank: finalRankBySlug.get(e.meta.slug) ?? 999,
      }))
      .sort((a, b) => a.newRank - b.newRank);

    for (const row of rows) {
      const moved = row.oldRank !== row.newRank ? ` (${row.oldRank > row.newRank ? "↑" : "↓"}${Math.abs(row.oldRank - row.newRank)})` : "";
      console.log(
        `${row.slug.padEnd(24)} ${String(row.oldRank).padEnd(7)} ${(String(row.newRank) + moved).padEnd(7)} ${row.rawR.toFixed(1).padEnd(9)} ${row.n}`
      );
    }
  }
}

main();

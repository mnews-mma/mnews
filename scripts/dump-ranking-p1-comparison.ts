// P1改訂(σディスカウント)+P2(単調性オーバーレイ)比較ダンプ。
// data/rankings.json等への書き込みは一切行わない(読み取り専用・目視レビュー用)。
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
  Bout,
  DisplayEntry,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, MnewsDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { findRankerWinExemptions, isStandardEligible, summarizeBoutsForFighter } from "../src/lib/mnewsRating/eligibilityRules";
import { buildDivisionRankings, FighterMeta } from "../src/lib/mnewsRating/rankingsFile";
import { H2HWin } from "../src/lib/mnewsRating/monotonicity";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import {
  ELO_PARAMS_V5,
  DECAY_PARAMS_V6,
  INITIAL_RATING_BOOST_PARAMS_V6,
  SIGMA_DISCOUNT_CANDIDATES,
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

// 指定階級の資格保有選手同士の決着済み対戦(引き分け/NC除く)をH2HWin[]化する。
// boutsはElo計算用の全対戦(階級横断)なので、両ノードが対象divisionのslug集合に
// 含まれるものだけを抽出する。
function extractH2HWinsForDivision(bouts: Bout[], divisionSlugs: Set<string>): H2HWin[] {
  const wins: H2HWin[] = [];
  for (const b of bouts) {
    if (!divisionSlugs.has(b.aNode) || !divisionSlugs.has(b.bNode)) continue;
    if (b.scoreA === 1) wins.push({ winnerSlug: b.aNode, loserSlug: b.bNode });
    else if (b.scoreA === 0) wins.push({ winnerSlug: b.bNode, loserSlug: b.aNode });
    // scoreA===0.5(引き分け)は方向性シグナルが無いためスキップ
  }
  return wins;
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
  for (const division of MNEWS_DIVISIONS) {
    const rankers = baseRankersByDivision.get(division)!;
    const entries = [...display.entries()]
      .filter(([slug]) => divisionBySlug.get(slug) === division && !isExcludedByFact(slug) && (rankers.has(slug) || rankerWinExemptions.has(slug)))
      .map(([slug, e]) => ({ meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) }, display: e }));
    eligibleEntriesByDivision.set(division, entries);
    h2hWinsByDivision.set(division, extractH2HWinsForDivision(bouts, new Set(entries.map((e) => e.meta.slug))));
  }

  return { asOf, eligibleEntriesByDivision, h2hWinsByDivision };
}

function main() {
  console.log("=== P1(σディスカウント)+P2(単調性オーバーレイ N=" + MONOTONICITY_MAX_RANK_GAP + ") 比較ダンプ ===");
  console.log("読み取り専用・data/rankings.json等への書き込みなし\n");

  const { asOf, eligibleEntriesByDivision, h2hWinsByDivision } = setup();

  for (const division of MNEWS_DIVISIONS) {
    const eligibleEntries = eligibleEntriesByDivision.get(division)!;
    if (eligibleEntries.length === 0) continue;
    const h2hWins = h2hWinsByDivision.get(division)!;

    // 現行(σディスカウントなし・単調性オーバーレイなし)の順位
    const current = buildDivisionRankings(division, eligibleEntries, asOf, undefined, null);
    const currentRankBySlug = new Map(current.entries.map((e) => [e.fighterId, e.rank]));

    const candidateResults = SIGMA_DISCOUNT_CANDIDATES.map((coefficient) => {
      const ranked = buildDivisionRankings(division, eligibleEntries, asOf, undefined, null, "overlay", coefficient, {
        h2hWins,
        maxRankGap: MONOTONICITY_MAX_RANK_GAP,
      });
      return { coefficient, rankBySlug: new Map(ranked.entries.map((e) => [e.fighterId, e.rank])) };
    });

    console.log(`\n=== ${division} (${eligibleEntries.length}名) ===`);
    console.log(
      `${"slug".padEnd(24)} ${"現行".padEnd(5)} ${"rawR".padEnd(9)} ${"n".padEnd(3)} ` +
        SIGMA_DISCOUNT_CANDIDATES.map((d) => `D=${d}`.padEnd(7)).join(" ")
    );

    const rows = eligibleEntries
      .map((e) => ({
        slug: e.meta.slug,
        rawR: e.display.displayRating,
        n: e.display.fights,
        currentRank: currentRankBySlug.get(e.meta.slug) ?? 999,
      }))
      .sort((a, b) => a.currentRank - b.currentRank);

    for (const row of rows) {
      const discountedRanks = candidateResults.map((c) => String(c.rankBySlug.get(row.slug) ?? "-").padEnd(7)).join(" ");
      console.log(
        `${row.slug.padEnd(24)} ${String(row.currentRank).padEnd(5)} ${row.rawR.toFixed(1).padEnd(9)} ${String(row.n).padEnd(3)} ${discountedRanks}`
      );
    }
  }
}

main();

// P1(小サンプル補正+敗北ペナルティ強化)比較ダンプ。data/rankings.json等への
// 書き込みは一切行わない(読み取り専用・目視レビュー用)。
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
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, MnewsDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { findRankerWinExemptions, isStandardEligible, summarizeBoutsForFighter } from "../src/lib/mnewsRating/eligibilityRules";
import { buildDivisionRankings, divisionRankingsKey } from "../src/lib/mnewsRating/rankingsFile";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import { ELO_PARAMS_V5, ELO_PARAMS_V6, DECAY_PARAMS_V6, INITIAL_RATING_BOOST_PARAMS_V6, DISPLAY_SHRINKAGE_PARAMS_V7 } from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShrinkageParams, AsymmetricEloParams } from "../src/lib/mnewsRating/engine";

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

function computeRankings(eloParams: AsymmetricEloParams, shrinkageParams: ShrinkageParams | undefined) {
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
  const states = computeRawRatings(bouts, eloParams, initialRatingOverrides);
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

  const out: Record<string, ReturnType<typeof buildDivisionRankings>> = {};
  for (const division of MNEWS_DIVISIONS) {
    const champ = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
    const champD = champ?.slug ? display.get(champ.slug) : undefined;
    const champion = champ?.slug
      ? { fighterId: champ.slug, rating: champD ? Math.round(champD.displayRating / 10) * 10 : null, record: champD ? { wins: champD.wins, losses: champD.losses, draws: champD.draws } : null, lastFight: champD?.lastFightDate ?? null }
      : null;
    const rankers = baseRankersByDivision.get(division)!;
    const eligibleEntries = [...display.entries()]
      .filter(([slug]) => divisionBySlug.get(slug) === division && !isExcludedByFact(slug) && (rankers.has(slug) || rankerWinExemptions.has(slug)))
      .map(([slug, e]) => ({ meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) }, display: e }));
    const key = divisionRankingsKey(division);
    out[key] = buildDivisionRankings(division, eligibleEntries, asOf, undefined, champion, undefined, shrinkageParams);
  }
  return out;
}

function main() {
  console.log("=== P1比較ダンプ(読み取り専用・data/rankings.json等への書き込みなし) ===\n");
  const current = computeRankings(ELO_PARAMS_V5, undefined);
  const candidate = computeRankings(ELO_PARAMS_V6, DISPLAY_SHRINKAGE_PARAMS_V7);

  for (const division of MNEWS_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const cur = current[key];
    const cand = candidate[key];
    console.log(`\n--- ${division} ---`);
    console.log(`${"slug".padEnd(24)} ${"現行rank".padEnd(9)} ${"現行rating".padEnd(11)} ${"候補rank".padEnd(9)} ${"候補rating".padEnd(11)} 変化`);
    const curRankBySlug = new Map(cur.entries.map((e) => [e.fighterId, e]));
    const candRankBySlug = new Map(cand.entries.map((e) => [e.fighterId, e]));
    const allSlugs = new Set([...curRankBySlug.keys(), ...candRankBySlug.keys()]);
    const rows = [...allSlugs].map((slug) => {
      const c = curRankBySlug.get(slug);
      const n = candRankBySlug.get(slug);
      return { slug, c, n, sortKey: n?.rank ?? c?.rank ?? 999 };
    });
    rows.sort((a, b) => a.sortKey - b.sortKey);
    for (const { slug, c, n } of rows) {
      const cRank = c ? String(c.rank) : "-";
      const cRating = c ? String(c.rating) : "-";
      const nRank = n ? String(n.rank) : "-";
      const nRating = n ? String(n.rating) : "-";
      const rankDelta = c && n ? n.rank - c.rank : null;
      const mark = rankDelta === null ? (c && !n ? "圏外化" : !c && n ? "新規掲載" : "") : rankDelta === 0 ? "" : rankDelta < 0 ? `↑${-rankDelta}` : `↓${rankDelta}`;
      console.log(`${slug.padEnd(24)} ${cRank.padEnd(9)} ${cRating.padEnd(11)} ${nRank.padEnd(9)} ${nRating.padEnd(11)} ${mark}`);
    }
  }
}

main();

// v9(recency撤回・H2H弱整合)最終確認ダンプ。読み取り専用・data/rankings.json
// 等への書き込みは一切行わない。「旧rank」は現在デプロイ済みのdata/rankings.json
// (v8)、「新rank」はupdate-mnews-rating.tsと同一ロジックで計算したv9候補。
// 実行: npx tsx scripts/dump-ranking-v9-comparison.ts [maxRankGap]
// (maxRankGap省略時はconstants.tsのMONOTONICITY_MAX_RANK_GAP_V9を使う。
// 候補値の比較検証用に引数で上書きできるようにしてある)
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
import { buildDivisionRankings, ChampionOverlay, FighterMeta, divisionRankingsKey, roundToDisplayStep, RankingsFile } from "../src/lib/mnewsRating/rankingsFile";
import { extractH2HWinsForDivision, checkH2HInvariant } from "../src/lib/mnewsRating/monotonicity";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { isDivisionExit } from "../src/lib/mnewsRating/divisionExits";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import {
  ELO_PARAMS_V5,
  DECAY_PARAMS_V6,
  INITIAL_RATING_BOOST_PARAMS_V6,
  SIGMA_DISCOUNT_COEFFICIENT_V7,
  MONOTONICITY_MAX_RANK_GAP_V9,
} from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");
const DEPLOYED_RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");

const argGap = process.argv[2] ? Number(process.argv[2]) : undefined;
const MAX_RANK_GAP = argGap !== undefined && !Number.isNaN(argGap) ? argGap : MONOTONICITY_MAX_RANK_GAP_V9;

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

function loadDeployedRankings(): RankingsFile {
  if (!fs.existsSync(DEPLOYED_RANKINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(DEPLOYED_RANKINGS_PATH, "utf8")) as RankingsFile;
}

function main() {
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const records = applyRizinRecordsOverride(rawRecords);
  const deployed = loadDeployedRankings();

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
  // recency K減衰は撤回済み。第4引数を渡さない(v8までと同じ挙動)。
  const states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides);
  const publishable = filterPublishableStates(states, records);
  const display = buildDisplayEntries(publishable, asOf, DECAY_PARAMS_V6);

  const hiddenSlugs = new Set(FIGHTERS.filter((f) => f.hidden).map((f) => f.slug));
  const isExcludedByFact = (slug: string, division: MnewsDivision): boolean =>
    isRetired(slug) || hiddenSlugs.has(slug) || isDivisionExit(slug, division);

  const boutSummariesBySlug = new Map<string, ReturnType<typeof summarizeBoutsForFighter>>();
  for (const slug of Object.keys(records)) {
    boutSummariesBySlug.set(slug, summarizeBoutsForFighter(bouts, slug));
  }

  const baseRankersByDivision = new Map<MnewsDivision, Set<string>>();
  for (const division of MNEWS_DIVISIONS) baseRankersByDivision.set(division, new Set());
  for (const [slug, division] of divisionBySlug) {
    if (!division) continue;
    if (isExcludedByFact(slug, division)) continue;
    const summaries = boutSummariesBySlug.get(slug) ?? [];
    const lastFightDate = display.get(slug)?.lastFightDate ?? null;
    if (isStandardEligible(summaries, division, lastFightDate, asOf)) {
      baseRankersByDivision.get(division)!.add(slug);
    }
  }

  const currentYearPrefix = `${asOf.getFullYear()}-`;
  const rankerWinExemptions = findRankerWinExemptions(boutSummariesBySlug, divisionBySlug, baseRankersByDivision, currentYearPrefix);

  console.log(`=== v9(recency撤回・H2H弱整合)最終確認ダンプ σ=${SIGMA_DISCOUNT_COEFFICIENT_V7} maxRankGap=${MAX_RANK_GAP} ===`);
  console.log("読み取り専用・書き込みなし。「旧rank」は現在の data/rankings.json(v8)。\n");

  let totalViolations = 0;

  for (const division of MNEWS_DIVISIONS) {
    const champion = championOverlayFor(division, display);
    const rankers = baseRankersByDivision.get(division)!;
    const eligibleEntries = [...display.entries()]
      .filter(
        ([slug]) =>
          divisionBySlug.get(slug) === division &&
          !isExcludedByFact(slug, division) &&
          (rankers.has(slug) || rankerWinExemptions.has(slug))
      )
      .map(([slug, e]) => ({
        meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) } as FighterMeta,
        display: e,
      }));
    if (eligibleEntries.length === 0) continue;

    const divisionSlugs = new Set(eligibleEntries.map((e) => e.meta.slug));
    const h2hWins = extractH2HWinsForDivision(bouts, divisionSlugs);

    let preCorrectionOrder: string[] = [];
    const final = buildDivisionRankings(
      division,
      eligibleEntries,
      asOf,
      undefined,
      champion,
      "overlay",
      SIGMA_DISCOUNT_COEFFICIENT_V7,
      { h2hWins, maxRankGap: MAX_RANK_GAP },
      (slugs) => {
        preCorrectionOrder = slugs;
      }
    );

    const finalRankedSlugs = final.entries.map((e) => e.fighterId);
    const violations = checkH2HInvariant(finalRankedSlugs, h2hWins, MAX_RANK_GAP, preCorrectionOrder);
    totalViolations += violations.length;

    const deployedKey = divisionRankingsKey(division);
    const deployedRanks = new Map((deployed[deployedKey]?.entries ?? []).map((e) => [e.fighterId, e.rank]));
    const deployedChampionRaw = deployed[deployedKey]?.champion?.rating ?? null;

    console.log(`\n=== ${division}${champion ? `(王者: ${champion.fighterId})` : ""} ===`);
    if (champion) {
      const champDisplay = display.get(champion.fighterId);
      const champNewRaw = champDisplay ? champDisplay.displayRating : null;
      console.log(
        `  王者rawRating: 旧(表示丸め)=${deployedChampionRaw ?? "N/A"} 新(生値)=${champNewRaw !== null ? champNewRaw.toFixed(1) : "N/A"} lastFight=${champion.lastFight ?? "N/A"}`
      );
    }
    if (violations.length > 0) {
      console.log(`  [H2H違反 ${violations.length}件]`);
      for (const v of violations) {
        console.log(`    NG: ${v.winner}(${v.winnerRank}位) が ${v.loser}(${v.loserRank}位) に直接勝っているのに下位のまま`);
      }
    }
    console.log(`${"slug".padEnd(24)} ${"旧rank".padEnd(7)} ${"新rank".padEnd(9)} ${"rawR".padEnd(9)} n`);

    const rows = final.entries.map((e) => ({
      slug: e.fighterId,
      rawR: e.rawRating,
      n: eligibleEntries.find((x) => x.meta.slug === e.fighterId)?.display.fights ?? 0,
      oldRank: deployedRanks.get(e.fighterId) ?? 999,
      newRank: e.rank,
    }));

    for (const row of rows) {
      const moved = row.oldRank !== 999 && row.oldRank !== row.newRank ? ` (${row.oldRank > row.newRank ? "↑" : "↓"}${Math.abs(row.oldRank - row.newRank)})` : row.oldRank === 999 ? " (新規)" : "";
      console.log(
        `${row.slug.padEnd(24)} ${String(row.oldRank === 999 ? "-" : row.oldRank).padEnd(7)} ${(String(row.newRank) + moved).padEnd(9)} ${row.rawR.toFixed(1).padEnd(9)} ${row.n}`
      );
    }
  }

  console.log(`\n合計H2H違反件数: ${totalViolations}`);
}

main();

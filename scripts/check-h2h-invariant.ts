// H2H不変条件の機械チェック(読み取り専用・data/rankings.json等への書き込み
// なし)。2026-07-17 P0-Bで追加、以後の回帰テストとして常設する。
// 全階級・全H2Hペアについて「勝者の順位<=敗者の順位」または循環(スキップ
// 対象)のいずれかが成立していることを検証する。update-mnews-rating.ts側にも
// 同じチェックを書き込み前の自己検証として組み込み済みだが、このスクリプトは
// 書き込みを伴わずに現在のdata/fighterRecords.jsonから再計算して単体で
// 検証できる(CI・手動確認用)。
// 実行: npx tsx scripts/check-h2h-invariant.ts
import fs from "fs";
import path from "path";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  computePreDebutRecords,
  computeInitialRatingOverrides,
  filterPublishableStates,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, MnewsDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { findRankerWinExemptions, isStandardEligible, summarizeBoutsForFighter } from "../src/lib/mnewsRating/eligibilityRules";
import { buildDivisionRankings, ChampionOverlay, FighterMeta } from "../src/lib/mnewsRating/rankingsFile";
import { extractH2HWinsForDivision, checkH2HInvariant, checkRecentH2HInvariant } from "../src/lib/mnewsRating/monotonicity";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import { ELO_PARAMS_V5, DECAY_PARAMS_V6, INITIAL_RATING_BOOST_PARAMS_V6, SIGMA_DISCOUNT_COEFFICIENT_V7 } from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import { DisplayEntry } from "../src/lib/mnewsRating/engine";

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

function championOverlayFor(division: MnewsDivision, display: Map<string, DisplayEntry>): ChampionOverlay | null {
  const champ = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
  if (!champ || !champ.slug) return null;
  const d = display.get(champ.slug);
  return {
    fighterId: champ.slug,
    rating: null,
    record: d ? { wins: d.wins, losses: d.losses, draws: d.draws } : null,
    lastFight: d?.lastFightDate ?? null,
  };
}

function main() {
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

  let totalViolations = 0;
  console.log("=== H2H不変条件 機械チェック(全階級) ===");
  console.log("読み取り専用・書き込みなし。違反0件であることを確認する。\n");

  for (const division of MNEWS_DIVISIONS) {
    const rankers = baseRankersByDivision.get(division)!;
    const eligibleEntries = [...display.entries()]
      .filter(
        ([slug]) =>
          divisionBySlug.get(slug) === division && !isExcludedByFact(slug) && (rankers.has(slug) || rankerWinExemptions.has(slug))
      )
      .map(([slug, e]) => ({ meta: { slug, division, weighInMiss: false } as FighterMeta, display: e }));
    if (eligibleEntries.length === 0) continue;

    const champion = championOverlayFor(division, display);
    const divisionSlugs = new Set(eligibleEntries.map((e) => e.meta.slug));
    const h2hWins = extractH2HWinsForDivision(bouts, divisionSlugs);
    const result = buildDivisionRankings(division, eligibleEntries, asOf, undefined, champion, "overlay", SIGMA_DISCOUNT_COEFFICIENT_V7, {
      h2hWins,
    });
    const finalRankedSlugs = result.entries.map((e) => e.fighterId);
    const violations = checkH2HInvariant(finalRankedSlugs, h2hWins);

    console.log(`${division}: H2Hペア${h2hWins.length}件中、違反${violations.length}件(循環除外)`);
    for (const v of violations) {
      console.log(`  NG: ${v.winner}(${v.winnerRank}位) が ${v.loser}(${v.loserRank}位) に直接勝っているのに下位のまま`);
      totalViolations++;
    }

    // 非対称ガード(2026-07-17・(b)案): 循環内リオーダーは最も古い辺だけを
    // 諦める設計のため、直近半年以内の対戦は循環の有無を問わず違反ゼロで
    // なければならない。
    const recentViolations = checkRecentH2HInvariant(finalRankedSlugs, h2hWins, asOf);
    console.log(`${division}: 直近半年以内H2H非対称ガード違反${recentViolations.length}件`);
    for (const v of recentViolations) {
      console.log(`  NG(直近半年): ${v.winner}(${v.winnerRank}位) が ${v.loser}(${v.loserRank}位) に直近半年以内の直接対決で勝っているのに下位のまま`);
      totalViolations++;
    }
  }

  console.log(`\n合計違反件数: ${totalViolations}`);
  if (totalViolations > 0) {
    console.error("FAIL: H2H不変条件違反が検出されました。");
    process.exit(1);
  }
  console.log("PASS: 全階級でH2H不変条件が成立しています(循環はスキップ対象外として除外済み)。");
}

main();

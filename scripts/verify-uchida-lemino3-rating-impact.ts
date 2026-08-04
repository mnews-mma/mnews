/**
 * 残件1の受入条件4: 日付訂正がmnewsレーティング(rankings.json)に波及しないことの確認。
 * read-only(data/には一切書き込まない)。
 *
 * 試合日が10日動くとboutの時系列が変わり、Eloの計算順(=レート)が動きうる。
 * update-mnews-rating.ts と同じ順序・同じパラメータでレーティングを算出し、
 * 訂正前/訂正後(=バッチ適用後の姿)の結果を突き合わせる。
 */
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  filterPublishableStates,
  FighterRecordsInput,
  computePreDebutRecords,
  computeInitialRatingOverrides,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { summarizeBoutsForFighter } from "../src/lib/mnewsRating/eligibilityRules";
import { ELO_PARAMS_V5, INITIAL_RATING_BOOST_PARAMS_V6, DECAY_PARAMS_V6 } from "../src/lib/mnewsRating/constants";
import { applyRecordOverrides, lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import type { FightRecord } from "../src/lib/fighters";

const DATA_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const raw: FighterRecordsInput = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// 「オーバーライド適用後」= 日次バッチが再生成した後の data/fighterRecords.json
const patched: FighterRecordsInput = {};
for (const [slug, entry] of Object.entries(raw)) {
  patched[slug] = { ...entry, history: applyRecordOverrides(slug, (entry.history ?? []) as FightRecord[]) };
}

// asOf は両方で同一値に固定する(実行時刻の差でディケイ等がぶれないように)。
const ASOF = new Date("2026-08-04T00:00:00Z");

function computeRanking(records: FighterRecordsInput) {
  const nominalWeightClassBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.weightClass]));
  const divisionBySlug = new Map(
    Object.entries(records).map(([slug, entry]) => [
      slug,
      latestRizinDivision((entry.history ?? []) as FightRecord[], nominalWeightClassBySlug.get(slug)),
    ]),
  );
  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  const { bouts } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, ASOF, isOpeningFightOverride);
  const preDebutRecords = computePreDebutRecords(records);
  const rizinFightCountsForSeed = new Map(
    [...preDebutRecords.keys()].map((slug) => [slug, summarizeBoutsForFighter(bouts, slug).length]),
  );
  const initialRatingOverrides = computeInitialRatingOverrides(
    preDebutRecords,
    INITIAL_RATING_BOOST_PARAMS_V6,
    rizinFightCountsForSeed,
  );
  const states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides);
  const publishable = filterPublishableStates(states, records);
  const display = buildDisplayEntries(publishable, ASOF, DECAY_PARAMS_V6);
  const hidden = new Set(FIGHTERS.filter((f) => f.hidden).map((f) => f.slug));
  return {
    boutCount: bouts.length,
    entries: [...display.values()]
      .filter((e) => !hidden.has(e.slug))
      .map((e) => ({ ...e, division: divisionBySlug.get(e.slug) ?? null }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

const before = computeRanking(raw);
const after = computeRanking(patched);

console.log(`bout総数: ${before.boutCount} → ${after.boutCount}`);
console.log(`掲載対象エントリ数: ${before.entries.length} → ${after.entries.length}`);

const a = JSON.stringify(before.entries);
const b = JSON.stringify(after.entries);
if (a === b) {
  console.log("✓ レーティング算出結果(rankings.jsonの生成元)は完全一致。差分ゼロ。");
  process.exit(0);
}

console.log("✗ 差分あり。内訳:");
const byslugBefore = new Map(before.entries.map((e) => [e.slug, e]));
for (const e of after.entries) {
  const prev = byslugBefore.get(e.slug);
  if (!prev) {
    console.log(`  + ${e.slug} (新規)`);
    continue;
  }
  if (JSON.stringify(prev) !== JSON.stringify(e)) {
    console.log(`  ~ ${e.slug}`);
    console.log(`      前: ${JSON.stringify(prev)}`);
    console.log(`      後: ${JSON.stringify(e)}`);
  }
}
const afterSlugs = new Set(after.entries.map((e) => e.slug));
for (const e of before.entries) if (!afterSlugs.has(e.slug)) console.log(`  - ${e.slug} (消失)`);
process.exit(1);

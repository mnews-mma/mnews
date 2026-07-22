// パウンドフォーパウンド(P4P)ランキング data/p4p.json 生成バッチ。
//
// 2026-07-21試算PR #172(scripts/check-p4p-trial.ts)で人間レビューを経て確定
// したロジックを本番生成コードへ移植したもの。
//
// blast radius最小化(2026-07-22指示書#5 §0): data/rankings.json は1バイトも
// 変更しない。このスクリプトはdata/rankings.json・data/fighterRecords.json・
// data/rizinRecords.json・src/lib/championDefenses.ts を読み取り専用の入力とし、
// data/p4p.json という別の成果物ファイルにのみ書き込む。scripts/update-mnews-
// rating.tsやengine.tsには一切変更を加えない(P4P専用ロジックをエンジンに
// 逆流させない)。
//
// 王者のrawRating取得について: data/rankings.jsonのchampion overlayは丸め済み
// displayRatingしか保持しない(CHAMPION_DISPLAY_MODE="overlay"の設計上、王者は
// entries配列から除外されるため)。そのため、update-mnews-rating.ts/
// check-h2h-invariant.tsと同じ思想で、エンジン(engine.ts)をここでも読み取り
// 専用に再実行し(bouts→raw Elo→display)、王者のσディスカウント後rawRatingだけ
// を個別に算出する。エンジン自体・定数は一切変更しない。
//
// 実行: npx tsx scripts/generate-p4p.ts
// 日次パイプラインへの自動組み込みは本PRのスコープ外(運用判断待ち)。
import fs from "fs";
import path from "path";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  computeSigmaDiscountedRating,
  computePreDebutRecords,
  computeInitialRatingOverrides,
  filterPublishableStates,
  DisplayEntry,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { PUBLISHED_DIVISIONS } from "../src/lib/mnewsRating/divisions";
import { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";
import {
  buildP4PFile,
  computeP4PRankPositionDeltas,
  ChampionRawRatingInput,
  P4PFile,
} from "../src/lib/mnewsRating/p4pFile";
import {
  checkP4PAllChampionsPresent,
  checkP4PDivisionOrderInvariant,
  checkP4PPublishedDivisionsOnly,
} from "../src/lib/rankings/requiredInvariants";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { CHAMPION_DEFENSES } from "../src/lib/championDefenses";
import {
  ELO_PARAMS_V5,
  DECAY_PARAMS_V6,
  INITIAL_RATING_BOOST_PARAMS_V6,
  SIGMA_DISCOUNT_COEFFICIENT_V7,
} from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

const RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");
const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");
const OUT_PATH = path.join(process.cwd(), "data", "p4p.json");

function loadRankings(): RankingsFile {
  if (!fs.existsSync(RANKINGS_PATH)) {
    throw new Error(`[FATAL] data/rankings.json が存在しません: ${RANKINGS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8")) as RankingsFile;
}

function loadP4PFile(): P4PFile | null {
  if (!fs.existsSync(OUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) as P4PFile;
  } catch {
    return null; // 破損時は前回データ無しとして続行(既存rankings.json生成と同じ思想)
  }
}

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

// update-mnews-rating.ts/check-h2h-invariant.ts/scripts/check-p4p-trial.tsと
// 同じ思想の読み取り専用エンジン再実行。王者のrawRating取得だけがこの再計算の
// 目的で、階級付け・掲載資格判定はここでは行わない(data/rankings.jsonを正として使う)。
function recomputeDisplayMap(): Map<string, DisplayEntry> {
  if (!fs.existsSync(RECORDS_PATH)) {
    throw new Error(`[FATAL] data/fighterRecords.json が存在しません: ${RECORDS_PATH}`);
  }
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const records = applyRizinRecordsOverride(rawRecords);

  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  // buildBoutsはasOfより未来の日付のboutを除外する仕様のため、最新bout日を
  // 発見するための1回目の呼び出しには「未来の何も除外しない」固定の定数日付を
  // 使い、そこから求めたlatestBoutDateを2回目の呼び出しの実asOfにする
  // (壁時計非依存)。DECAY_PARAMS_V6はperPeriod=0(不活性ディケイ廃止済み)の
  // ためdisplayRatingの値自体はasOfに依存しない。
  const FAR_FUTURE_PROBE = new Date("2999-01-01T00:00:00.000Z");
  const provisionalBouts = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, FAR_FUTURE_PROBE, isOpeningFightOverride).bouts;
  const latestBoutDate = provisionalBouts.reduce((m, b) => (b.date > m ? b.date : m), "");
  const asOf = latestBoutDate ? new Date(latestBoutDate) : FAR_FUTURE_PROBE;

  const { bouts } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, asOf, isOpeningFightOverride);
  const preDebutRecords = computePreDebutRecords(records);
  const rizinFightCountsForSeed = new Map<string, number>();
  for (const slug of preDebutRecords.keys()) {
    rizinFightCountsForSeed.set(slug, bouts.filter((b) => b.aNode === slug || b.bNode === slug).length);
  }
  const initialRatingOverrides = computeInitialRatingOverrides(preDebutRecords, INITIAL_RATING_BOOST_PARAMS_V6, rizinFightCountsForSeed);
  const states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides);
  const publishable = filterPublishableStates(states, records);
  return buildDisplayEntries(publishable, asOf, DECAY_PARAMS_V6);
}

function effectiveRatingOf(display: DisplayEntry): number {
  return computeSigmaDiscountedRating(display.displayRating, display.fights, SIGMA_DISCOUNT_COEFFICIENT_V7);
}

// 公開4階級の現王者(champions.ts)について、エンジン再計算からσディスカウント
// 後rawRatingを取得する。取得できなかった王者(display未算出等)は王者ティア
// から除外し、理由をコンソールに警告として残す(捏造禁止・生成は継続する)。
function resolveChampionRawRatings(displayMap: Map<string, DisplayEntry>): ChampionRawRatingInput[] {
  const out: ChampionRawRatingInput[] = [];
  for (const division of PUBLISHED_DIVISIONS) {
    const champ = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
    if (!champ || !champ.slug) {
      console.warn(`[WARN] ${division}: champions.tsに現王者エントリなし(王座空位/未掲載)。P4P王者ティアから除外`);
      continue;
    }
    const display = displayMap.get(champ.slug);
    if (!display) {
      console.warn(`[WARN] ${division}: 王者「${champ.name}」(${champ.slug})のdisplay entryがエンジン再計算で見つからず。P4P王者ティアから除外`);
      continue;
    }
    out.push({ slug: champ.slug, division, rawRating: effectiveRatingOf(display) });
  }
  return out;
}

function runOnce(): P4PFile {
  const rankings = loadRankings();
  const prev = loadP4PFile();
  const displayMap = recomputeDisplayMap();
  const championRawRatings = resolveChampionRawRatings(displayMap);

  const algorithmVersion = Object.values(rankings)[0]?.algorithmVersion ?? -1;
  if (algorithmVersion === -1) {
    throw new Error("[FATAL] data/rankings.jsonからalgorithmVersionを取得できません");
  }

  const file = buildP4PFile({
    rankings,
    championRawRatings,
    defenseData: CHAMPION_DEFENSES,
    // 壁時計非依存(指示書§4系の既存方針を踏襲): updatedAtはdata/rankings.json
    // 側の最新updatedAtをそのまま転記する(このスクリプト自身の実行時刻は使わない)。
    updatedAt: Object.values(rankings).reduce((m, d) => (d.updatedAt > m ? d.updatedAt : m), ""),
    algorithmVersion,
  });

  // ▲▼semantics(2026-07-22指示書#5 §5、提案ベース・レビュー対象): 既存の
  // 階級別ランキング(update-mnews-rating.ts)は「出場者スコープ」で▲▼を出す
  // — その選手自身がlastFight=直近イベント日と一致する場合のみ、というルール
  // (他選手の挿入シフトや無関係な再較正による見かけの順位変動を「成績変動」と
  // 誤読させないため)。P4Pは階級横断のため、この考え方をそのまま適用すると
  // むしろ相性が良い: 2026-07-21試算PR #172のD-1診断で「公開rank不変の階級でも
  // 他階級の実際の変動につられてP4Pグローバル順位が動くケース」が確認されて
  // おり(全て他階級の実変動由来=legit、純粋ノイズは0件)、出場者スコープで
  // 絞ればこの「自分は試合していないのに順位表示だけ動く」ケースを構造的に
  // 排除できる。よって、この選手自身のlastFightが全エントリ中の最新イベント日
  // と一致する場合のみ▲▼/NEWを出し、それ以外は「—」に固定する。
  const latestEventDate = file.entries.reduce((m, e) => (e.lastFight && e.lastFight > m ? e.lastFight : m), "");
  const deltas = computeP4PRankPositionDeltas(file.entries, prev);
  const withDeltas: P4PFile = {
    ...file,
    entries: file.entries.map((e) => {
      const competedInLatestEvent = e.lastFight === latestEventDate && latestEventDate !== "";
      return {
        ...e,
        rankPositionDelta: competedInLatestEvent ? deltas.get(e.fighterId) ?? { kind: "same" as const, positions: 0 } : { kind: "same" as const, positions: 0 },
      };
    }),
  };

  // 自己検証: 破れたら書き込み自体を止める(既存パイプラインのH2H不変条件
  // チェックと同じ「書き込み前に必ず検証」の設計を踏襲)。王者ティア固定を
  // 撤回したため(2026-07-22)、「王者が先頭を占める」ではなく「rawRatingを
  // 算出できた王者が全員entriesに存在する(位置は問わない)」ことを検証する。
  const expectedChampionSlugs = championRawRatings.map((c) => c.slug);
  const errors = [
    ...checkP4PAllChampionsPresent(withDeltas, expectedChampionSlugs),
    ...checkP4PDivisionOrderInvariant(withDeltas),
    ...checkP4PPublishedDivisionsOnly(withDeltas),
  ];
  if (errors.length > 0) {
    console.error("[FATAL] P4P自己検証失敗:");
    for (const e of errors) console.error(`  ${e}`);
    throw new Error("P4P自己検証失敗");
  }

  if (file.defenseDataIssues.length > 0) {
    console.warn(`[WARN] 防衛回数データ未取得(${file.defenseDataIssues.length}件、生成は継続):`);
    for (const issue of file.defenseDataIssues) console.warn(`  ${issue}`);
  }

  return withDeltas;
}

function main() {
  // 決定性の自己検証: 同一コミット上で2回連続実行し、出力が完全一致することを確認する。
  const first = runOnce();
  const second = runOnce();
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    console.error("[FATAL] 決定性自己検証失敗: 2回連続実行の出力が一致しません");
    process.exit(1);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(first, null, 2) + "\n");
  console.log(`[OK] ${OUT_PATH} を生成しました(決定性チェックOK)`);
  console.log(`候補総数(王者含む): ${first.entries.length}`);
  const championCount = first.entries.filter((e) => e.tier === "champion").length;
  console.log(`王者ティア: ${championCount}名`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}

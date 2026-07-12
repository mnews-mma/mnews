// mnewsレーティング rankings.json 生成バッチ。
// data/fighterRecords.json(前段のupdate-fighter-records.tsが更新した最新版)を
// 読み、階級別ランキングを算出してdata/rankings.jsonへ書き出す。
// 上書き前のdata/rankings.jsonはdata/rankings.prev.jsonへ退避し(次回バッチの
// delta算出に使う)、1階級でも順位変動があった日はその日の全階級スナップショットを
// data/rankings/archive/YYYY-MM-DD.jsonへ永続保存する(機関としての歴史的記録)。
//
// 実行: npx tsx scripts/update-mnews-rating.ts
import fs from "fs";
import path from "path";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  detectWeighInMiss,
  filterPublishableStates,
  isRizinMmaEvent,
  DisplayEntry,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver, buildKnownNamesLookup } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, MnewsDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import {
  FighterBoutSummary,
  findRankerWinExemptions,
  isStandardEligible,
  summarizeBoutsForFighter,
} from "../src/lib/mnewsRating/eligibilityRules";
import {
  buildDivisionRankings,
  divisionRankingsKey,
  hasRankingChange,
  shouldSuppressDelta,
  ChampionOverlay,
  RankingsFile,
} from "../src/lib/mnewsRating/rankingsFile";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { ALGORITHM_VERSION } from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss } from "../src/lib/mnewsRating/recordOverrides";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const OUT = path.join(process.cwd(), "data", "rankings.json");
const OUT_PREV = path.join(process.cwd(), "data", "rankings.prev.json");
const ARCHIVE_DIR = path.join(process.cwd(), "data", "rankings", "archive");

// 既存JSONの読み込み。破損している場合は空({})にフォールバックして続行する
// (update-org-rankings.tsと同じ思想: 破損ファイルでのクラッシュループを避ける)。
function loadRankingsFile(file: string): RankingsFile {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as RankingsFile;
  } catch (e) {
    console.warn(`[WARN] ${file} の読み込みに失敗(JSON破損の疑い)。前回値なしとして続行: ${e}`);
    return {};
  }
}

function lastRizinMmaWeighInMiss(records: FighterRecordsInput, slug: string): boolean {
  const history = (records[slug]?.history ?? []).filter((h) => isRizinMmaEvent(h.event));
  const latest = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return latest ? detectWeighInMiss(latest) : false;
}

// 王者は「事実」として、Elo掲載資格とは独立に表示する。displayは
// filterPublishableStates由来(掲載資格でフィルタする前の全既知選手)なので、
// 王者がEloの掲載資格を満たさなくても(あるいはレートが一切算出できていなくても)
// ここで参照できる。RIZINに現王座が存在しない階級・DBに未登録の王者はnull。
function championOverlayFor(division: MnewsDivision, display: Map<string, DisplayEntry>): ChampionOverlay | null {
  const champ = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
  if (!champ || !champ.slug) return null;
  const d = display.get(champ.slug);
  return {
    fighterId: champ.slug,
    rating: d ? Math.round(d.displayRating) : null,
    record: d ? { wins: d.wins, losses: d.losses, draws: d.draws } : null,
    lastFight: d ? d.lastFightDate : null,
  };
}

function main() {
  if (!fs.existsSync(RECORDS_PATH)) {
    console.log("[mnewsレーティング] data/fighterRecords.json が存在しないためスキップ");
    return;
  }

  const records: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const prevOut = loadRankingsFile(OUT);

  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  const { bouts, warnings } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss);
  const states = computeRawRatings(bouts);
  const publishable = filterPublishableStates(states, records);
  const asOf = new Date();
  const display = buildDisplayEntries(publishable, asOf);

  // 掲載階級は「階級が判明している直近のRIZIN MMA試合の階級」で決める
  // (fighters.tsの名目weightClassへはフォールバックしない)。
  const divisionBySlug = new Map(
    Object.entries(records).map(([slug, entry]) => [slug, latestRizinDivision(entry.history ?? [])])
  );

  // B-1(ランカー勝ち特例)・B-2(階級変更後の資格スコープ)。二段階・単一パスで
  // 掲載資格を確定する。順位はここでは一切決めない(Eloレート順は
  // buildDivisionRankings側でこれまでどおりdisplayRating降順に組み立てる)。
  const boutSummariesBySlug = new Map<string, FighterBoutSummary[]>();
  for (const slug of Object.keys(records)) {
    boutSummariesBySlug.set(slug, summarizeBoutsForFighter(bouts, slug));
  }

  // 1段階目: B-2適用後の「標準の掲載資格」を満たす選手を階級ごとのベース
  // ランカー集合として1回だけ確定する(この時点の集合は後段で更新しない)。
  const baseRankersByDivision = new Map<MnewsDivision, Set<string>>();
  for (const division of MNEWS_DIVISIONS) baseRankersByDivision.set(division, new Set());
  for (const [slug, division] of divisionBySlug) {
    if (!division) continue;
    const summaries = boutSummariesBySlug.get(slug) ?? [];
    const lastFightDate = display.get(slug)?.lastFightDate ?? null;
    if (isStandardEligible(summaries, division, lastFightDate, asOf)) {
      baseRankersByDivision.get(division)!.add(slug);
    }
  }

  // 2段階目: 1段階目で確定したベースランカーに、当年開催のRIZIN MMA本戦で
  // 勝った選手は3戦要件を免除する(単一パス。ここで新たに資格を得た選手を
  // 倒したかは見ない=カスケードしない)。
  const currentYearPrefix = `${asOf.getFullYear()}-`;
  const rankerWinExemptions = findRankerWinExemptions(
    boutSummariesBySlug,
    divisionBySlug,
    baseRankersByDivision,
    currentYearPrefix
  );

  const out: RankingsFile = {};
  for (const division of MNEWS_DIVISIONS) {
    const champion = championOverlayFor(division, display);
    const rankers = baseRankersByDivision.get(division)!;
    const eligibleEntries = [...display.entries()]
      .filter(([slug]) => divisionBySlug.get(slug) === division && (rankers.has(slug) || rankerWinExemptions.has(slug)))
      .map(([slug, e]) => ({
        meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) },
        display: e,
      }));
    const key = divisionRankingsKey(division);
    out[key] = buildDivisionRankings(division, eligibleEntries, asOf, prevOut[key], champion);
  }

  // 1階級でも順位変動があれば、その日の全階級スナップショットをアーカイブする。
  const changed = Object.entries(out).some(([key, div]) => hasRankingChange(div, prevOut[key]));
  if (changed) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const dateKey = asOf.toISOString().slice(0, 10);
    fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateKey}.json`), JSON.stringify(out, null, 2) + "\n");
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT_PREV, JSON.stringify(prevOut, null, 2) + "\n");
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`=== mnewsレーティング rankings.json 更新 (asOf=${asOf.toISOString()}) ===`);
  for (const division of MNEWS_DIVISIONS) {
    const key = divisionRankingsKey(division);
    console.log(`  ${division}: ${out[key].entries.length}名掲載`);
  }
  console.log(`除外warning: ${warnings.length}件 / アーカイブ保存: ${changed ? "あり(" + asOf.toISOString().slice(0, 10) + ")" : "なし(変動なし)"}`);

  // C-3: algorithmVersionが前回から変わった日は、係数変更による見かけ上の増減を
  // 「実際の順位変動」と誤認させないため全選手のdeltaを一律nullにする(buildDivisionRankings側で
  // 実施済み)。ここでは適用有無・理由を内部ログに残すのみ。
  const versionChangedDivisions = MNEWS_DIVISIONS.filter((d) => shouldSuppressDelta(prevOut[divisionRankingsKey(d)]));
  if (versionChangedDivisions.length) {
    const prevVersion = prevOut[divisionRankingsKey(versionChangedDivisions[0])]?.algorithmVersion;
    console.log(
      `[INFO] algorithmVersion変更を検出(v${prevVersion} → v${ALGORITHM_VERSION})のため、本日のdeltaは全選手nullに抑制(対象${versionChangedDivisions.length}階級): ${versionChangedDivisions.join(", ")}`
    );
  }

  // 掲載資格(3戦以上・直近18ヶ月以内・1勝以上)は満たすのに、階級が判明している
  // RIZIN MMA boutが1つも無いため、どの階級ランキングにも掲載されなかった選手。
  // 手動配置の対象ではなく、EVENT_RESULTS側のデータ拡充で解消すべき対象として
  // 可視化する(A-3)。
  const eligibleUnknownDivision = [...display.entries()]
    .filter(([slug, e]) => e.eligible && divisionBySlug.get(slug) == null)
    .map(([slug]) => slug);
  if (eligibleUnknownDivision.length) {
    console.warn(
      `[WARN] 掲載資格ありだが階級不明のため全ランキング非掲載(${eligibleUnknownDivision.length}名・EVENT_RESULTS側のデータ拡充対象):\n  ${eligibleUnknownDivision.join(", ")}`
    );
  }
}

// main()は同期関数だが、他のバッチスクリプト(update-fighter-records.ts等)と
// 同じ規約で明示的にcatch→process.exit(1)する。data/rankings.jsonへの書き込みは
// mainの最後(全計算完了後)にしかないため、途中で例外が飛べば何も書き込まれず
// 前回のrankings.jsonがそのまま残る(中途半端なファイルを書かない)。
// CI(update-fighter-records.yml)は前段のupdate-fighter-records.tsが失敗すれば
// GitHub Actionsのデフォルト挙動でこのステップ自体が実行されない。
try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}

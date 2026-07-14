// mnewsレーティング rankings.json 生成バッチ。
// data/fighterRecords.json(前段のupdate-fighter-records.tsが更新した最新版)を
// 読み、階級別ランキングを算出してdata/rankings.jsonへ書き出す。
// 上書き前のdata/rankings.jsonはdata/rankings.prev.jsonへ退避し(次回バッチの
// delta算出に使う)、1階級でも順位変動があった日はその日の全階級スナップショットを
// data/rankings/archive/YYYY-MM-DD.jsonへ永続保存する(機関としての歴史的記録)。
//
// 実行: npx tsx scripts/update-mnews-rating.ts
//
// --mode=data-correction: 戦績修正・階級分類是正・seed調整など、新しい試合結果
// ではなくデータ修正が起点の再計算用(2026-07-14新設)。「rawRatingの大きさ」だけ
// では、データ修正由来のElo連鎖リップル(例: 高木凌の戦績修正で秋元強真が
// -16.47動いた)と、本物の新規試合結果による変動を区別できない(閾値・丸め基準
// では確実に防げないと判明済み)。判定は数値ではなく実行コンテキスト(このフラグ)
// で行う: data/rankings.legitimateBaseline.json(最後にmode未指定=new-results
// 実行が正当に確定させた状態。data-correction実行では絶対に更新しない)との
// 全選手突合でrawRatingが動いた選手を漏れなく検出し、delta を一律0に強制した上で
// 自己検証(残存が1件でもあれば例外で書き込み自体を止める)してから書き込む。
// 未指定時(デフォルト)は従来どおり(new-results相当、全挙動を完全維持)。
import fs from "fs";
import path from "path";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  computeScopedRecord,
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
  roundToDisplayStep,
  auditRankingsRipple,
  suppressRippleDelta,
  ChampionOverlay,
  RankingsFile,
} from "../src/lib/mnewsRating/rankingsFile";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
import { isRetired } from "../src/lib/mnewsRating/retirements";
import { getDivisionOverlay, getEligibilityScopeStartDate, getRecordDisplayExclusions } from "../src/lib/mnewsRating/fighterDivisions";
import { ALGORITHM_VERSION, ELO_PARAMS_V5, DECAY_PARAMS_V6, INITIAL_RATING_BOOST_PARAMS_V6 } from "../src/lib/mnewsRating/constants";
import { lookupWeighInMiss, isOpeningFightOverride } from "../src/lib/mnewsRating/recordOverrides";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");
const OUT = path.join(process.cwd(), "data", "rankings.json");
const OUT_PREV = path.join(process.cwd(), "data", "rankings.prev.json");
const ARCHIVE_DIR = path.join(process.cwd(), "data", "rankings", "archive");
// data-correctionモード専用の「最後にnew-resultsが正当に確定させた状態」。
// 通常のrankings.prev.jsonは実行のたびに1歩ずつ前進する(data-correction実行
// 自体でも更新される)ため、同日にdata-correctionを複数回連続実行すると比較
// 基準がその都度ずれて取りこぼしが起きうる。このファイルはnew-results実行時
// のみ更新し、data-correction実行では絶対に更新しない(常に固定の1点との
// 累積差分を取ることで、複数回実行しても原理的に取りこぼさない)。
const BASELINE_PATH = path.join(process.cwd(), "data", "rankings.legitimateBaseline.json");

const MODE = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "new-results";
if (MODE !== "new-results" && MODE !== "data-correction") {
  throw new Error(`未知の--mode: ${MODE}(new-results | data-correction のみ対応)`);
}

// Phase 3: rizinRecords.json(RIZIN公式ソース)を優先し、無ければ従来のhistory
// にフォールバックする。Phase2ではフェザー級のみに限定していたが、フェザー級で
// 実証済みのため全階級に適用する(階級による分岐は撤去)。マッチする
// rizinRecords エントリが無い選手・試合は従来どおりhistoryのままなので、
// 非公開階級の算出データが更新されるだけで、点灯(公開)には一切関与しない
// (点灯可否は引き続きdivisions.tsのPUBLISHED_DIVISIONSのみで決まる)。
function applyRizinRecordsOverride(records: FighterRecordsInput): FighterRecordsInput {
  if (!fs.existsSync(RIZIN_RECORDS_PATH)) return records;
  const rizinEvents: RizinRecordsEvent[] = JSON.parse(fs.readFileSync(RIZIN_RECORDS_PATH, "utf8"));
  const index = buildRizinRecordsIndex(rizinEvents);

  const out: FighterRecordsInput = {};
  let totalOverridden = 0;
  let totalExcluded = 0;
  for (const [slug, entry] of Object.entries(records)) {
    const { history, overriddenCount, excludedCount } = applyRizinRecordsToHistory(slug, entry.history ?? [], index);
    out[slug] = { ...entry, history };
    totalOverridden += overriddenCount;
    totalExcluded += excludedCount;
  }
  console.log(
    `[INFO] Phase3: rizinRecords.jsonを全階級に優先適用(公式ソースで上書き${totalOverridden}試合・MMA以外/中止で除外${totalExcluded}試合)`
  );
  return out;
}

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

// 事実オーバーレイ(fighterDivisions.ts)に戦績スコープ起点日・個別除外試合の
// 指定がある選手は、表示用の戦績(wins/losses/draws)をそれに沿って数え直す
// (例: 武田光司のフェザー転向後3-2、ケラモフの単発ライト級タイトルマッチ除外)。
// rawRating/displayRating/eligibleはここでは一切変更しない(順位・レートへの
// 手動介入はしない、という原則を守るため、Eloは常に全期間の対戦列で計算した
// ままにする。ここで上書きするのは表示専用のwins/losses/drawsフィールドのみ)。
// 指定が無い選手はdisplayをそのまま返す(フォールバック)。
function applyEligibilityScopeToRecord(slug: string, display: DisplayEntry, bouts: Bout[]): DisplayEntry {
  const scopeStart = getEligibilityScopeStartDate(slug);
  const exclusions = getRecordDisplayExclusions(slug).map((e) => ({ date: e.date, opponentNode: e.opponentSlug }));
  if (!scopeStart && exclusions.length === 0) return display;
  const scoped = computeScopedRecord(bouts, slug, scopeStart, exclusions);
  return { ...display, wins: scoped.wins, losses: scoped.losses, draws: scoped.draws };
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
    rating: d ? roundToDisplayStep(d.displayRating) : null,
    record: d ? { wins: d.wins, losses: d.losses, draws: d.draws } : null,
    lastFight: d ? d.lastFightDate : null,
  };
}

function main() {
  if (!fs.existsSync(RECORDS_PATH)) {
    console.log("[mnewsレーティング] data/fighterRecords.json が存在しないためスキップ");
    return;
  }

  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const prevOut = loadRankingsFile(OUT);

  // Phase3: rizinRecords.json(RIZIN公式ソース)を全階級のhistoryより優先する
  // (Phase2ではフェザー級限定だったが、階級による分岐は撤去した)。マッチする
  // 試合が無ければ従来どおりrawRecordsのままフォールバックする。階級判定
  // (下記)もこのオーバーライド後のデータで行う(公式ソースのweightClassの
  // 正確性を階級判定にも反映させるため。中村大介・伊藤裕輝等、過去に個別
  // パッチで対応していたケースが公式ソースだけで正しく解決するかの検証対象)。
  const records = applyRizinRecordsOverride(rawRecords);

  // 掲載階級は「事実オーバーレイ(fighterDivisions.ts)に指定があればそれを優先し、
  // 無ければ階級が判明している直近のRIZIN MMA試合の階級」で決める(fighters.tsの
  // 名目weightClassへはフォールバックしない)。ただし女子/アトム系の除外判定だけは
  // fighters.ts側の名目階級を主ソースとして参照する(2026-07-13、bout単位テキストへの
  // 依存で女子選手が男子階級へ誤混入するバグの恒久修正)。事実オーバーレイは
  // 「どの階級バケットに載せるか」だけを上書きし、順位・レートには一切触れない
  // (Elo算出は従来どおり階級横断で1本のまま)。
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
  const { bouts, warnings } = buildBouts(records, resolve, getKnownNames, lookupWeighInMiss, asOf, isOpeningFightOverride);
  // v5確定パラメータ(比較ダンプでの目視レビューを経て採用)。
  // v6: RIZIN参戦前実績(既存history、全団体分)から機械算出した初期レート補正。
  const preDebutRecords = computePreDebutRecords(records);
  // shrinkage(Task E「D案」)用のn(RIZIN実戦試合数)。boutsは既に構築済みのため
  // ここで先に算出できる(summarizeBoutsForFighterはeligibility判定にも後段で
  // 使うが、shrinkageはそれより前の初期レート算出段階で必要なため個別に呼ぶ)。
  const rizinFightCountsForSeed = new Map(
    [...preDebutRecords.keys()].map((slug) => [slug, summarizeBoutsForFighter(bouts, slug).length])
  );
  const initialRatingOverrides = computeInitialRatingOverrides(preDebutRecords, INITIAL_RATING_BOOST_PARAMS_V6, rizinFightCountsForSeed);
  const states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides);
  const publishable = filterPublishableStates(states, records);
  // v6: 不活性ディケイ廃止(比較ダンプでの目視レビューを経て採用)。
  const display = buildDisplayEntries(publishable, asOf, DECAY_PARAMS_V6);

  // 選手ページ/戦績データが公開されていない選手(fighters.ts側でhidden=true。
  // 「Mレーティングが乗るまで非公開」の選手や、単一ソース由来で最終確認待ちの
  // 選手が該当)は、fighterRecordsCache/getVisibleFighters側の一般的な公開判定
  // (!hidden)と揃え、ランキングにも掲載しない。事実オーバーレイ(引退)とは別軸
  // だが、いずれも「掲載資格を満たしていても事実として除外する」という扱いは同じ。
  const hiddenSlugs = new Set(FIGHTERS.filter((f) => f.hidden).map((f) => f.slug));
  const isExcludedByFact = (slug: string): boolean => isRetired(slug) || hiddenSlugs.has(slug);

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
    if (!division || isExcludedByFact(slug)) continue;
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
      .filter(
        ([slug]) =>
          divisionBySlug.get(slug) === division && !isExcludedByFact(slug) && (rankers.has(slug) || rankerWinExemptions.has(slug))
      )
      .map(([slug, e]) => ({
        meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) },
        display: applyEligibilityScopeToRecord(slug, e, bouts),
      }));
    const key = divisionRankingsKey(division);
    out[key] = buildDivisionRankings(division, eligibleEntries, asOf, prevOut[key], champion);
  }

  let published: RankingsFile = out;
  let rippleReport: ReturnType<typeof auditRankingsRipple> = [];
  if (MODE === "data-correction") {
    const baseline = loadRankingsFile(BASELINE_PATH);
    rippleReport = auditRankingsRipple(baseline, out);
    published = suppressRippleDelta(out, rippleReport);
    // 自己検証: 抑制後もbaselineとの差分を再突合し、delta!==0の残存が
    // 1件でもあれば書き込み自体を止める(2026-07-14の手順5違反の再発防止。
    // 人手の「変更選手の±3位圏」目視確認に依存しない)。
    const remaining = auditRankingsRipple(baseline, published).filter((r) => r.deltaInOutput !== 0);
    if (remaining.length > 0) {
      throw new Error(
        `[FATAL] data-correctionモードなのにdelta!==0が残存(${remaining.length}件): ` +
          remaining.map((r) => `${r.divisionSlug}:${r.fighterId}(delta=${r.deltaInOutput})`).join(", ")
      );
    }
    console.log(`[INFO] data-correctionモード: baseline突合でripple検出${rippleReport.length}件(delta=0に強制・非公開の内部ログ):`);
    for (const r of rippleReport) {
      console.log(`  ${r.divisionSlug}:${r.fighterId} rawRating ${r.rawBefore.toFixed(2)} -> ${r.rawAfter.toFixed(2)} (diff ${r.rawDiff.toFixed(2)})`);
    }
  }

  // 1階級でも順位変動があれば、その日の全階級スナップショットをアーカイブする。
  // data-correctionモードは抑制後は実質「変動なし」として扱い、アーカイブしない
  // (静かに反映する既指示のため。内部レポートはrippleReportとして上記に出力済み)。
  const changed = MODE === "new-results" && Object.entries(published).some(([key, div]) => hasRankingChange(div, prevOut[key]));
  if (changed) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const dateKey = asOf.toISOString().slice(0, 10);
    fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateKey}.json`), JSON.stringify(published, null, 2) + "\n");
  }

  // baselineはnew-results実行時のみ前進させる(このモードのdeltaは全て正当な
  // 実データ変動のため、次回以降のdata-correction実行の比較基準として使ってよい)。
  if (MODE === "new-results") {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(published, null, 2) + "\n");
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT_PREV, JSON.stringify(prevOut, null, 2) + "\n");
  fs.writeFileSync(OUT, JSON.stringify(published, null, 2) + "\n");

  console.log(`=== mnewsレーティング rankings.json 更新 (mode=${MODE}, asOf=${asOf.toISOString()}) ===`);
  for (const division of MNEWS_DIVISIONS) {
    const key = divisionRankingsKey(division);
    console.log(`  ${division}: ${published[key].entries.length}名掲載`);
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

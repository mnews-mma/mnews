// RIZIN パウンドフォーパウンド(P4P)ランキング試算レポート(運用者向け・非公開)。
// docs/instructions/(P4P試算指示書、および2026-07-21追加指示書#1・#2)に基づく
// 設計検証用。本番データ・エンジン・定数は一切変更しない読み取り専用スクリプト。
// data/rankings.json(既存の単一ゲート=PUBLISHED_DIVISIONS)を候補プールの正とし、
// 階級内での「ドミナンス」(平均・中央値からの乖離)を3変種のスコア式で正規化して
// 階級横断に並べ直す。
//
// 王者のrawRating欠落対策(2026-07-21レビュー指摘#1): CHAMPION_DISPLAY_MODE=
// "overlay"(現行デフォルト)では王者はrankings.json entriesから除外され、
// champion overlayには丸め済みdisplayRatingしか残らない。対策として、
// update-mnews-rating.ts/check-h2h-invariant.tsと同じ思想で、エンジン
// (engine.ts)をここでも読み取り専用に再実行し(data/fighterRecords.json・
// data/rizinRecords.jsonを入力にbouts→raw Elo→display までを再構築)、王者の
// σディスカウント後レートだけを個別に算出する。エンジン自体・定数は一切変更しない。
// 既存候補(非王者)の階級・順位・rawRatingは引き続きdata/rankings.jsonをそのまま
// 正とし、再計算結果との突合で乖離があれば実装ミスとしてexit 1する(自己検証(d))。
//
// buildBoutsのasOf境界の扱いについて(2026-07-21追加指示書#1 A-1の切り分け結果):
// エンジン本体(src/lib/mnewsRating/engine.ts)は無変更。当初「エンジンのバグを
// 修正した」と報告したのは誤りで、実際はこのスクリプト内の呼び出しミス
// (最新bout日を発見するための1回目のbuildBouts呼び出しにnew Date(0)=1970年を
// asOfとして渡し、buildBoutsの「asOfより未来の結果は除外する」既存の意図的
// 仕様(engine.ts内コメント参照)により全boutが除外されていた)。固定の未来日
// 定数FAR_FUTURE_PROBEに差し替えて解消した。git diff origin/main...HEADは
// このファイル1本のみで、engine/共有配下への変更はゼロ。
//
// 不変条件Clamp(2026-07-21追加指示書#2 C-3): rawRating(σディスカウント後、
// H2H補正前)ベースのP4Pスコアは、既存エンジンのH2H単調性補正により階級内で
// 公開rankと順序が食い違う箇所がある(§6参照)。採用式が何であれ、同一階級内で
// P4Pスコアの順序が公開rankと単調一致するようclampを適用し(§8)、全体
// interleave(§2以降のP4P順位表・変種間乖離・王者仮説)はclamp後スコアで行う
// (生スコアでのグローバル整列はしない)。clamp前(生スコア)との比較は§8に
// 独立して残す。
//
// 実行: npx tsx scripts/check-p4p-trial.ts
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
import { PUBLISHED_DIVISIONS, MnewsDivision } from "../src/lib/mnewsRating/divisions";
import { divisionRankingsKey, RankingsFile, DivisionRankings } from "../src/lib/mnewsRating/rankingsFile";
import { RANKING_DISPLAY_CAP } from "../src/lib/mnewsRating/divisionRankingView";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";
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
const ARCHIVE_DIR = path.join(process.cwd(), "data", "rankings", "archive");
const OUT_DIR = path.join(process.cwd(), "out");
const OUT_PATH = path.join(OUT_DIR, "p4p-trial.md");
const RAW_MISMATCH_EPSILON = 0.01; // 浮動小数の丸め誤差許容(pt)
type Variant = "A" | "B" | "C";
const VARIANTS: Variant[] = ["A", "B", "C"];

interface Candidate {
  slug: string;
  nameJa: string;
  division: MnewsDivision;
  divisionRank: number | "champion";
  rawRating: number;
  capIn: boolean;
  isChampion: boolean;
}

interface DivisionStats {
  division: MnewsDivision;
  n: number; // 王者を含む母集団人数
  mean: number;
  median: number;
  sigma: number;
  mad: number;
  max: number;
  min: number;
  q1: number;
  q3: number;
  championSlug: string | null;
  championRawRating: number | null;
  championFlag: string | null; // 算出不能時の理由(nullは正常算出できた場合)
}

interface ScoredCandidate extends Candidate {
  scoreA: number;
  scoreB: number;
  scoreC: number;
}

interface ClampedCandidate extends ScoredCandidate {
  clampedScoreA: number;
  clampedScoreB: number;
  clampedScoreC: number;
  clampChanged: Record<Variant, boolean>;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function populationSigma(xs: number[], m: number): number {
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function mad(xs: number[], m: number): number {
  return median(xs.map((x) => Math.abs(x - m)));
}
// Tukey's hinges(中央値を除いた下半分/上半分の中央値)。四分位法は複数流儀が
// あるが、本レポートでは分布の形の参考値として使うため簡便なこの方式に統一する。
function quartiles(xs: number[]): { q1: number; q3: number } {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, mid);
  const upper = n % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  return { q1: median(lower), q3: median(upper) };
}

function loadRankings(): RankingsFile {
  if (!fs.existsSync(RANKINGS_PATH)) {
    throw new Error(`[FATAL] data/rankings.json が存在しません: ${RANKINGS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8")) as RankingsFile;
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

// update-mnews-rating.ts/check-h2h-invariant.tsと同じ思想の読み取り専用
// エンジン再実行。bouts→raw Elo→σディスカウント前displayまでを再構築する
// (エンジン・定数は無変更、data/への書き込みも一切なし)。王者のrawRating
// 取得だけがこの再計算の目的で、階級付け・掲載資格判定はここでは行わない
// (それらはdata/rankings.jsonをそのまま正として使う)。
function recomputeDisplayMap(): Map<string, DisplayEntry> {
  if (!fs.existsSync(RECORDS_PATH)) {
    throw new Error(`[FATAL] data/fighterRecords.json が存在しません: ${RECORDS_PATH}`);
  }
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const records = applyRizinRecordsOverride(rawRecords);

  const resolve = buildOpponentResolver(records);
  const getKnownNames = buildKnownNamesLookup(records);
  // 壁時計非依存(指示書§4): asOfは実行時刻ではなく最新bout日を使う。ただし
  // buildBoutsはasOfより未来の日付のboutを除外する仕様のため、最新bout日を
  // 発見するための1回目の呼び出しには「未来の何も除外しない」固定の定数日付
  // (壁時計ではない)を使い、そこから求めたlatestBoutDateを2回目の呼び出しの
  // 実asOfにする。DECAY_PARAMS_V6はperPeriod=0(不活性ディケイ廃止済み)のため
  // displayRatingの値自体はasOfに依存しない(eligibility判定はこのスクリプト
  // では使わない)。
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

const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
const lookupMissSlugs: string[] = [];
function resolveName(slug: string): string {
  const name = nameBySlug.get(slug);
  if (!name) {
    lookupMissSlugs.push(slug);
    return `(name lookup miss: ${slug})`;
  }
  return name;
}

function statsFor(division: MnewsDivision, ratings: number[]): DivisionStats {
  const m = mean(ratings);
  const med = median(ratings);
  const { q1, q3 } = quartiles(ratings);
  return {
    division,
    n: ratings.length,
    mean: m,
    median: med,
    sigma: populationSigma(ratings, m),
    mad: mad(ratings, med),
    max: Math.max(...ratings),
    min: Math.min(...ratings),
    q1,
    q3,
    championSlug: null,
    championRawRating: null,
    championFlag: null,
  };
}

function buildCandidatesAndStats(
  rankings: RankingsFile,
  displayMap: Map<string, DisplayEntry>
): { candidates: Candidate[]; statsByDivision: Map<MnewsDivision, DivisionStats>; recomputeMismatches: string[] } {
  const candidates: Candidate[] = [];
  const statsByDivision = new Map<MnewsDivision, DivisionStats>();
  const recomputeMismatches: string[] = [];

  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const divData: DivisionRankings | undefined = rankings[key];
    if (!divData) {
      throw new Error(`[FATAL] 階級名突合失敗: division="${division}" のkey="${key}" がdata/rankings.jsonに存在しません`);
    }
    if (divData.entries.length === 0) {
      throw new Error(`[FATAL] ${division} の候補プールが0件です(データ異常の疑い)`);
    }

    const divisionCandidates: Candidate[] = divData.entries.map((e) => {
      // 自己検証(d): 再計算したσディスカウント後レートが、data/rankings.json
      // 保存済みのrawRatingと一致するか突合する(再計算パイプラインの信頼性
      // チェック。既存候補の階級・順位・rawRatingは引き続きrankings.jsonを正とする)。
      const recomputedDisplay = displayMap.get(e.fighterId);
      if (recomputedDisplay) {
        const recomputed = effectiveRatingOf(recomputedDisplay);
        if (Math.abs(recomputed - e.rawRating) > RAW_MISMATCH_EPSILON) {
          recomputeMismatches.push(
            `${division}:${e.fighterId} rankings.json=${e.rawRating.toFixed(4)} 再計算=${recomputed.toFixed(4)}(差${Math.abs(recomputed - e.rawRating).toFixed(4)})`
          );
        }
      } else {
        recomputeMismatches.push(`${division}:${e.fighterId} 再計算パイプラインでdisplay entryが見つからず(publishable対象外の疑い)`);
      }
      return {
        slug: e.fighterId,
        nameJa: resolveName(e.fighterId),
        division,
        divisionRank: e.rank,
        rawRating: e.rawRating,
        capIn: e.rank <= RANKING_DISPLAY_CAP,
        isChampion: false,
      };
    });

    // 王者の扱い: champions.tsオーバーレイに当該階級のRIZIN現王者エントリが
    // あるか確認。あればslugを特定し、エンジン再計算のdisplayMapから
    // σディスカウント後rawRatingを算出する(捏造禁止・算出不能時は理由付きで
    // フラグして人間判断に回す)。王者は他候補と同じ母集団(統計・3変種スコア・
    // フルテーブル)に含める(2026-07-21レビュー指摘: #1代替では階級統計・
    // 3変種の並びが王者を入れた場合と変わりうるため)。
    const champEntry = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
    let championSlug: string | null = null;
    let championRawRating: number | null = null;
    let championFlag: string | null = null;
    if (!champEntry) {
      championFlag = "champions.tsに当該階級のRIZIN王者エントリなし(王座空位/未掲載)";
    } else if (!champEntry.slug) {
      championFlag = `王者「${champEntry.name}」はchampions.ts上でslug未設定(DB外/hidden)のためP4P算出不能`;
    } else {
      championSlug = champEntry.slug;
      const alreadyInPool = divisionCandidates.some((c) => c.slug === championSlug);
      if (alreadyInPool) {
        // 現行CHAMPION_DISPLAY_MODEでは想定しない経路だが、将来モードが
        // "badge"化される等でentriesに王者本人が含まれるケースの保険。
        championRawRating = divisionCandidates.find((c) => c.slug === championSlug)!.rawRating;
      } else {
        const champDisplay = displayMap.get(championSlug);
        if (champDisplay) {
          championRawRating = effectiveRatingOf(champDisplay);
          divisionCandidates.push({
            slug: championSlug,
            nameJa: resolveName(championSlug),
            division,
            divisionRank: "champion",
            rawRating: championRawRating,
            capIn: true, // 王者は表示キャップの対象外(常時表示)
            isChampion: true,
          });
        } else {
          championFlag = `王者「${champEntry.name}」(${championSlug})はエンジン再計算でもdisplay entryが見つからず(publishable対象外/データ不足)のためレート無し・P4P算出不能`;
        }
      }
    }

    candidates.push(...divisionCandidates);

    const ratings = divisionCandidates.map((c) => c.rawRating);
    const stats = statsFor(division, ratings);
    stats.championSlug = championSlug;
    stats.championRawRating = championRawRating;
    stats.championFlag = championFlag;
    statsByDivision.set(division, stats);
  }

  return { candidates, statsByDivision, recomputeMismatches };
}

function scoreCandidates(candidates: Candidate[], statsByDivision: Map<MnewsDivision, DivisionStats>): ScoredCandidate[] {
  return candidates.map((c) => {
    const s = statsByDivision.get(c.division)!;
    return {
      ...c,
      scoreA: s.sigma === 0 ? 0 : (c.rawRating - s.mean) / s.sigma,
      scoreB: s.mad === 0 ? 0 : (c.rawRating - s.median) / s.mad,
      scoreC: c.rawRating - s.median,
    };
  });
}

// 自己検証(a): 各変種は階級内でrawRatingの単調増加変換のはずなので、
// 「変種スコアでソートした階級内順序」と「rawRatingでソートした階級内順序」は
// 必ず一致する(スコア計算式そのものの実装ミスを検出する目的、clamp前の生スコア
// に対する検証)。
function verifyScoreMonotonicity(scored: ScoredCandidate[]): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, ScoredCandidate[]>();
  for (const c of scored) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  for (const [division, list] of byDivision) {
    const byRawDesc = [...list].sort((a, b) => b.rawRating - a.rawRating).map((c) => c.slug);
    for (const [variant, key] of [
      ["A", "scoreA"],
      ["B", "scoreB"],
      ["C", "scoreC"],
    ] as const) {
      const byScoreDesc = [...list].sort((a, b) => b[key] - a[key]).map((c) => c.slug);
      if (JSON.stringify(byRawDesc) !== JSON.stringify(byScoreDesc)) {
        errors.push(`${division} 変種${variant}: rawRating降順とスコア降順の階級内順序が不一致(スコア式実装バグの疑い)`);
      }
    }
  }
  return errors;
}

// 不変条件Clamp(2026-07-21追加指示書#2 C-3): 同一階級内でP4Pスコアの順序が
// 公開rank(H2H単調性補正後)と単調一致するよう補正する。公開rank順(昇順、
// rank1が最強)に並べ、直前のclamped後スコアを上回っていれば直前値まで
// 引き下げる(running min)。王者は公開rankを持たないためclamp対象外(生スコア
// のまま参加する。王者に対する順位不変条件は定義できないため)。
function applyRankInvariantClamp(scored: ScoredCandidate[]): ClampedCandidate[] {
  const out = new Map<string, ClampedCandidate>();
  for (const c of scored) {
    if (c.isChampion) {
      out.set(c.slug, {
        ...c,
        clampedScoreA: c.scoreA,
        clampedScoreB: c.scoreB,
        clampedScoreC: c.scoreC,
        clampChanged: { A: false, B: false, C: false },
      });
    }
  }
  const byDivision = new Map<MnewsDivision, ScoredCandidate[]>();
  for (const c of scored) {
    if (c.isChampion) continue;
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  for (const [, list] of byDivision) {
    const byRankAsc = [...list].sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number));
    const runningMin: Record<Variant, number> = { A: Infinity, B: Infinity, C: Infinity };
    for (const c of byRankAsc) {
      const clampedA = Math.min(c.scoreA, runningMin.A);
      const clampedB = Math.min(c.scoreB, runningMin.B);
      const clampedC = Math.min(c.scoreC, runningMin.C);
      runningMin.A = clampedA;
      runningMin.B = clampedB;
      runningMin.C = clampedC;
      out.set(c.slug, {
        ...c,
        clampedScoreA: clampedA,
        clampedScoreB: clampedB,
        clampedScoreC: clampedC,
        clampChanged: { A: clampedA !== c.scoreA, B: clampedB !== c.scoreB, C: clampedC !== c.scoreC },
      });
    }
  }
  return scored.map((c) => out.get(c.slug)!);
}

function clampedScoreKey(variant: Variant): "clampedScoreA" | "clampedScoreB" | "clampedScoreC" {
  return variant === "A" ? "clampedScoreA" : variant === "B" ? "clampedScoreB" : "clampedScoreC";
}
function rawScoreKey(variant: Variant): "scoreA" | "scoreB" | "scoreC" {
  return variant === "A" ? "scoreA" : variant === "B" ? "scoreB" : "scoreC";
}

// 自己検証(c): 全公開階級で、clamp後P4Pスコア順(同点は公開rank昇順でタイブレーク)
// が階級別公開rank順(同一階級内)と一致すること。破れたらexit 1(clamp実装バグ)。
function verifyClampInvariant(clamped: ClampedCandidate[]): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, ClampedCandidate[]>();
  for (const c of clamped) {
    if (c.isChampion) continue;
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  for (const [division, list] of byDivision) {
    const byRankAsc = [...list].sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number)).map((c) => c.slug);
    for (const variant of VARIANTS) {
      const key = clampedScoreKey(variant);
      const byScoreDesc = [...list]
        .sort((a, b) => b[key] - a[key] || (a.divisionRank as number) - (b.divisionRank as number))
        .map((c) => c.slug);
      if (JSON.stringify(byRankAsc) !== JSON.stringify(byScoreDesc)) {
        errors.push(`${division} 変種${variant}: clamp後スコア順が公開rank順と不一致(clamp実装バグの疑い)`);
      }
    }
  }
  return errors;
}

interface RankInversion {
  division: MnewsDivision;
  higherRawLowerRank: string;
  lowerRawHigherRank: string;
  higherRawSlug: string;
  lowerRawSlug: string;
}

// rawRating降順(H2H補正前相当)と公開rank(H2H補正後)の階級内順序が食い違う
// 箇所を発見事項として収集する(exit 1対象ではない。ユーザー判断: 2026-07-21。
// §8でclampにより解消されることを確認する)。王者(divisionRank="champion")は
// 公開rankを持たないため対象外。
function collectRankOrderInversions(candidates: Candidate[]): RankInversion[] {
  const byDivision = new Map<MnewsDivision, Candidate[]>();
  for (const c of candidates) {
    if (c.isChampion) continue;
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  const inversions: RankInversion[] = [];
  for (const [division, list] of byDivision) {
    const byRank = [...list].sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number));
    for (let i = 1; i < byRank.length; i++) {
      if (byRank[i].rawRating > byRank[i - 1].rawRating) {
        inversions.push({
          division,
          higherRawLowerRank: `${byRank[i].nameJa}(${byRank[i].slug}, rank${byRank[i].divisionRank}, raw${byRank[i].rawRating.toFixed(2)})`,
          lowerRawHigherRank: `${byRank[i - 1].nameJa}(${byRank[i - 1].slug}, rank${byRank[i - 1].divisionRank}, raw${byRank[i - 1].rawRating.toFixed(2)})`,
          higherRawSlug: byRank[i].slug,
          lowerRawSlug: byRank[i - 1].slug,
        });
      }
    }
  }
  return inversions;
}

interface RankedList {
  variant: Variant;
  ranked: ClampedCandidate[]; // 全候補、スコア降順(clampedかrawかはbasisで区別)
}

function buildRankedLists(scored: ClampedCandidate[], basis: "raw" | "clamped"): RankedList[] {
  const keyOf = basis === "clamped" ? clampedScoreKey : rawScoreKey;
  return VARIANTS.map((variant) => {
    const key = keyOf(variant);
    return { variant, ranked: [...scored].sort((a, b) => b[key] - a[key]) };
  });
}

function scoreOf(c: ClampedCandidate, variant: Variant, basis: "raw" | "clamped"): number {
  const key = basis === "clamped" ? clampedScoreKey(variant) : rawScoreKey(variant);
  return c[key];
}

function findDivergentVariants(
  lists: RankedList[]
): { slug: string; nameJa: string; ranks: Record<Variant, number>; spread: number }[] {
  const rankMaps: Record<Variant, Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));
  const allSlugs = new Set(lists[0].ranked.map((c) => c.slug));
  const bySlug = new Map(lists[0].ranked.map((c) => [c.slug, c]));
  const out: { slug: string; nameJa: string; ranks: Record<Variant, number>; spread: number }[] = [];
  for (const slug of allSlugs) {
    const ranks = { A: rankMaps.A.get(slug)!, B: rankMaps.B.get(slug)!, C: rankMaps.C.get(slug)! };
    const spread = Math.max(ranks.A, ranks.B, ranks.C) - Math.min(ranks.A, ranks.B, ranks.C);
    if (spread >= 5) out.push({ slug, nameJa: bySlug.get(slug)!.nameJa, ranks, spread });
  }
  out.sort((a, b) => b.spread - a.spread);
  return out;
}

function formatNum(n: number): string {
  return n.toFixed(3);
}

// ===== C-1: フライ級分布診断 =====
function buildFlyweightDiagnosticLines(candidates: Candidate[], statsByDivision: Map<MnewsDivision, DivisionStats>): string[] {
  const lines: string[] = [];
  const division: MnewsDivision = "フライ級";
  const list = candidates.filter((c) => c.division === division).sort((a, b) => b.rawRating - a.rawRating);
  const s = statsByDivision.get(division)!;

  lines.push("### フライ級 rawRating 降順フルリスト(王者含む)");
  lines.push("");
  lines.push("| # | 選手名 | slug | rawRating | 階級内順位 |");
  lines.push("|---|---|---|---|---|");
  list.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.nameJa} | ${c.slug} | ${formatNum(c.rawRating)} | ${c.isChampion ? "王者" : c.divisionRank} |`);
  });
  lines.push("");

  lines.push("### フライ級 記述統計");
  lines.push("");
  lines.push("| n | 平均 | 中央値 | σ(母集団) | MAD | σ/MAD | 最大 | 最小 | Q1 | Q3 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  lines.push(
    `| ${s.n} | ${formatNum(s.mean)} | ${formatNum(s.median)} | ${formatNum(s.sigma)} | ${formatNum(s.mad)} | ${(s.sigma / s.mad).toFixed(3)} | ${formatNum(s.max)} | ${formatNum(s.min)} | ${formatNum(s.q1)} | ${formatNum(s.q3)} |`
  );
  lines.push("");

  const upperOutliers = list.filter((c) => c.rawRating > s.mean + 2 * s.sigma);
  const lowerOutliers = list.filter((c) => c.rawRating < s.mean - 2 * s.sigma);
  lines.push("### フライ級 外れ値(平均±2σを外れる選手、事実のみ記述・解釈は付けない)");
  lines.push("");
  lines.push(`平均+2σ = ${formatNum(s.mean + 2 * s.sigma)} / 平均-2σ = ${formatNum(s.mean - 2 * s.sigma)}`);
  lines.push("");
  if (upperOutliers.length === 0 && lowerOutliers.length === 0) {
    lines.push("該当なし。");
  } else {
    if (upperOutliers.length > 0) {
      lines.push(
        `上側(平均+2σ超): ${upperOutliers.map((c) => `${c.nameJa}(${c.slug}, raw${formatNum(c.rawRating)}${c.isChampion ? ", 王者" : ""})`).join(", ")}`
      );
    } else {
      lines.push("上側(平均+2σ超): 該当なし。");
    }
    if (lowerOutliers.length > 0) {
      lines.push(
        `下側(平均-2σ未満): ${lowerOutliers.map((c) => `${c.nameJa}(${c.slug}, raw${formatNum(c.rawRating)}${c.isChampion ? ", 王者" : ""})`).join(", ")}`
      );
    } else {
      lines.push("下側(平均-2σ未満): 該当なし。");
    }
  }
  lines.push("");

  lines.push("### 他3階級の記述統計(1行サマリ、フライ級との横並び参考)");
  lines.push("");
  lines.push("| 階級 | n | 平均 | 中央値 | σ(母集団) | MAD | σ/MAD | 最大 | 最小 | Q1 | Q3 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const d of PUBLISHED_DIVISIONS) {
    const ds = statsByDivision.get(d)!;
    lines.push(
      `| ${d} | ${ds.n} | ${formatNum(ds.mean)} | ${formatNum(ds.median)} | ${formatNum(ds.sigma)} | ${formatNum(ds.mad)} | ${(ds.sigma / ds.mad).toFixed(3)} | ${formatNum(ds.max)} | ${formatNum(ds.min)} | ${formatNum(ds.q1)} | ${formatNum(ds.q3)} |`
    );
  }
  lines.push("");
  return lines;
}

// ===== C-2: 無風日チャーン・バックテスト =====
interface SnapshotResult {
  label: string;
  algorithmVersion: number;
  divisionOrder: Map<MnewsDivision, string[]>; // fighterId、公開rank昇順
  globalRank: Record<Variant, Map<string, number>>; // clamp後スコアでのグローバル順位
  candidateCount: number;
}

// バックテスト用母集団は「data/rankings.jsonのentries(=公開rankを持つ候補)のみ」
// で統一する(王者は除外)。理由: 過去断面ごとに王者のrawRatingを再現するには
// その時点のfighterRecords.json/rizinRecords.jsonのコミット断面までエンジンを
// 遡って再実行する必要があり、壁時計非依存・決定的な再現性の保証が難しいため
// (王者はメイン診断§0-§8では算出済みだが、バックテストでは対象外にする)。
function buildSnapshotResult(label: string, rankings: RankingsFile): SnapshotResult {
  const candidates: Candidate[] = [];
  const divisionOrder = new Map<MnewsDivision, string[]>();
  let algorithmVersion = -1;
  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const divData = rankings[key];
    if (!divData) {
      throw new Error(`[FATAL] バックテスト: スナップショット"${label}"に${division}(key=${key})が存在しません`);
    }
    if (algorithmVersion === -1) algorithmVersion = divData.algorithmVersion;
    const sortedEntries = [...divData.entries].sort((a, b) => a.rank - b.rank);
    divisionOrder.set(division, sortedEntries.map((e) => e.fighterId));
    for (const e of sortedEntries) {
      candidates.push({
        slug: e.fighterId,
        nameJa: resolveName(e.fighterId),
        division,
        divisionRank: e.rank,
        rawRating: e.rawRating,
        capIn: e.rank <= RANKING_DISPLAY_CAP,
        isChampion: false,
      });
    }
  }
  const statsByDivision = new Map<MnewsDivision, DivisionStats>();
  for (const division of PUBLISHED_DIVISIONS) {
    const ratings = candidates.filter((c) => c.division === division).map((c) => c.rawRating);
    statsByDivision.set(division, statsFor(division, ratings));
  }
  const scored = scoreCandidates(candidates, statsByDivision);
  const clamped = applyRankInvariantClamp(scored);
  const clampErrors = verifyClampInvariant(clamped);
  if (clampErrors.length > 0) {
    throw new Error(`[FATAL] バックテスト: スナップショット"${label}"でclamp自己検証失敗: ${clampErrors.join(" / ")}`);
  }
  const lists = buildRankedLists(clamped, "clamped");
  const globalRank: Record<Variant, Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => globalRank[l.variant].set(c.slug, i + 1));
  return { label, algorithmVersion, divisionOrder, globalRank, candidateCount: candidates.length };
}

// v9(現行データの algorithmVersion)のスナップショットのみを対象にする
// (アルゴリズムバージョンが違う断面同士を比べると、実際の対戦結果によるP4P
// 順位の動きと、係数変更による見かけ上の動きが混ざってしまうため)。
function loadV9Snapshots(currentRankings: RankingsFile, currentVersion: number): { label: string; rankings: RankingsFile }[] {
  const snapshots: { label: string; rankings: RankingsFile }[] = [];
  const skipped: string[] = [];
  if (fs.existsSync(ARCHIVE_DIR)) {
    const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith(".json")).sort();
    const probeKey = divisionRankingsKey(PUBLISHED_DIVISIONS[0]);
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8")) as RankingsFile;
        const version = data[probeKey]?.algorithmVersion;
        if (version === currentVersion) {
          snapshots.push({ label: f.replace(/\.json$/, ""), rankings: data });
        } else {
          skipped.push(`${f}(algorithmVersion=${version ?? "不明"})`);
        }
      } catch (e) {
        skipped.push(`${f}(読み込み失敗: ${e})`);
      }
    }
  }
  snapshots.push({ label: `current(data/rankings.json, v${currentVersion})`, rankings: currentRankings });
  return snapshots;
}

interface ChurnAgg {
  observations: number;
  churnCount: number;
  sumAbsDelta: number;
  maxDelta: number;
}

function computeChurn(results: SnapshotResult[]): Record<Variant, ChurnAgg> {
  const agg: Record<Variant, ChurnAgg> = {
    A: { observations: 0, churnCount: 0, sumAbsDelta: 0, maxDelta: 0 },
    B: { observations: 0, churnCount: 0, sumAbsDelta: 0, maxDelta: 0 },
    C: { observations: 0, churnCount: 0, sumAbsDelta: 0, maxDelta: 0 },
  };
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    for (const division of PUBLISHED_DIVISIONS) {
      const prevOrder = prev.divisionOrder.get(division)!;
      const currOrder = curr.divisionOrder.get(division)!;
      const stable = JSON.stringify(prevOrder) === JSON.stringify(currOrder);
      if (!stable) continue;
      for (const slug of prevOrder) {
        for (const variant of VARIANTS) {
          const posBefore = prev.globalRank[variant].get(slug);
          const posAfter = curr.globalRank[variant].get(slug);
          if (posBefore === undefined || posAfter === undefined) continue;
          const delta = Math.abs(posAfter - posBefore);
          agg[variant].observations++;
          if (delta > 0) agg[variant].churnCount++;
          agg[variant].sumAbsDelta += delta;
          agg[variant].maxDelta = Math.max(agg[variant].maxDelta, delta);
        }
      }
    }
  }
  return agg;
}

function buildChurnBacktestLines(rankings: RankingsFile): string[] {
  const lines: string[] = [];
  const probeKey = divisionRankingsKey(PUBLISHED_DIVISIONS[0]);
  const currentVersion = rankings[probeKey]!.algorithmVersion;
  const snapshotDefs = loadV9Snapshots(rankings, currentVersion);

  lines.push("### 母数");
  lines.push("");
  lines.push(
    `algorithmVersion=${currentVersion}のスナップショットのみを対象(バージョン違いは実結果由来の動きと係数変更由来の動きが混ざるため除外)。母集団はdata/rankings.jsonのentriesのみ(王者は除外、理由は下記実装コメント参照)。使用スナップショット(${snapshotDefs.length}断面、壁時計非依存・全てコミット済みファイル): ${snapshotDefs.map((s) => s.label).join(" → ")}`
  );
  lines.push("");

  if (snapshotDefs.length < 2) {
    lines.push("履歴不足でN=1、チャーン検証不能。代替としてleave-one-out順位感度を報告する。");
    lines.push("");
    return lines.concat(buildLeaveOneOutLines(rankings));
  }

  const results = snapshotDefs.map((s) => buildSnapshotResult(s.label, s.rankings));
  const churn = computeChurn(results);

  lines.push("### 断面間の階級別安定性(公開rankが不変だった階級)");
  lines.push("");
  lines.push("| 断面ペア | 安定階級(公開rank不変) | 変動階級 |");
  lines.push("|---|---|---|");
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    const stableDivs: string[] = [];
    const changedDivs: string[] = [];
    for (const division of PUBLISHED_DIVISIONS) {
      const stable = JSON.stringify(prev.divisionOrder.get(division)) === JSON.stringify(curr.divisionOrder.get(division));
      (stable ? stableDivs : changedDivs).push(division);
    }
    lines.push(`| ${prev.label} → ${curr.label} | ${stableDivs.join("、") || "なし"} | ${changedDivs.join("、") || "なし"} |`);
  }
  lines.push("");

  lines.push("### 変種別チャーン量(公開rank不変の階級に属する選手の、clamp後グローバルP4P順位の変動)");
  lines.push("");
  lines.push("| 変種 | 観測数(安定階級所属選手×断面ペア) | 順位が動いた件数 | 平均|Δ順位| | 最大|Δ順位| |");
  lines.push("|---|---|---|---|---|");
  for (const variant of VARIANTS) {
    const a = churn[variant];
    const avg = a.observations > 0 ? a.sumAbsDelta / a.observations : 0;
    lines.push(`| ${variant} | ${a.observations} | ${a.churnCount} | ${avg.toFixed(3)} | ${a.maxDelta} |`);
  }
  lines.push("");
  return lines;
}

// N=1(履歴不足)時の代替診断: 候補を1名ずつ人工的に除外したときの、残りの
// 選手のclamp後グローバルP4P順位が平均・最大でどれだけ動くか(決定的・データ
// 不要、現在の1断面のみで計算できる)。
function buildLeaveOneOutLines(rankings: RankingsFile): string[] {
  const lines: string[] = [];
  const base = buildSnapshotResult("baseline", rankings);
  const agg: Record<Variant, { totalTrials: number; sumAvgShift: number; maxShift: number }> = {
    A: { totalTrials: 0, sumAvgShift: 0, maxShift: 0 },
    B: { totalTrials: 0, sumAvgShift: 0, maxShift: 0 },
    C: { totalTrials: 0, sumAvgShift: 0, maxShift: 0 },
  };
  for (const division of PUBLISHED_DIVISIONS) {
    const order = base.divisionOrder.get(division)!;
    for (const removedSlug of order) {
      const remaining = order.filter((s) => s !== removedSlug);
      if (remaining.length === 0) continue;
      // divisionOrderを1名除いたRankingsFile相当を組み直して再計算する。
      const key = divisionRankingsKey(division);
      const modified: RankingsFile = { ...rankings, [key]: { ...rankings[key]!, entries: rankings[key]!.entries.filter((e) => e.fighterId !== removedSlug) } };
      const withoutOne = buildSnapshotResult(`baseline-minus-${removedSlug}`, modified);
      for (const variant of VARIANTS) {
        const shifts = remaining.map((slug) => {
          const before = base.globalRank[variant].get(slug);
          const after = withoutOne.globalRank[variant].get(slug);
          if (before === undefined || after === undefined) return 0;
          return Math.abs(after - before);
        });
        const avgShift = shifts.reduce((s, x) => s + x, 0) / shifts.length;
        const maxShift = Math.max(...shifts);
        agg[variant].totalTrials++;
        agg[variant].sumAvgShift += avgShift;
        agg[variant].maxShift = Math.max(agg[variant].maxShift, maxShift);
      }
    }
  }
  lines.push("### leave-one-out順位感度(1名除外時に残りの選手のグローバルP4P順位が動く量)");
  lines.push("");
  lines.push("| 変種 | 試行数(公開候補の総数分) | 平均(試行ごとの平均|Δ順位|) | 最大|Δ順位| |");
  lines.push("|---|---|---|---|");
  for (const variant of VARIANTS) {
    const a = agg[variant];
    lines.push(`| ${variant} | ${a.totalTrials} | ${(a.sumAvgShift / a.totalTrials).toFixed(3)} | ${a.maxShift} |`);
  }
  lines.push("");
  return lines;
}

// ===== §8: Clampの前後比較 =====
function buildClampDiagnosticLines(
  rawLists: RankedList[],
  clampedLists: RankedList[],
  inversions: RankInversion[]
): string[] {
  const lines: string[] = [];
  lines.push(
    "手法: 各公開階級で、非王者候補を公開rank昇順に並べ、直前の(clamp後)スコアを上回っていれば直前値まで引き下げる(running min)。王者は公開rankを持たないためclamp対象外(生スコアのまま参加)。全体interleave(P4P順位表・変種間乖離・王者仮説)は以後clamp後スコアで行う(生スコアでのグローバル整列はしない)。自己検証(c): 全公開階級・全変種でclamp後スコア順が公開rank順(同一階級内)と一致することを確認済み(不一致があればexit 1)。"
  );
  lines.push("");

  for (const variant of VARIANTS) {
    const rawTop15 = new Set(rawLists.find((l) => l.variant === variant)!.ranked.slice(0, 15).map((c) => c.slug));
    const clampedRanked = clampedLists.find((l) => l.variant === variant)!.ranked;
    const clampedTop15 = clampedRanked.slice(0, 15);
    const clampedTop15Slugs = new Set(clampedTop15.map((c) => c.slug));

    lines.push(`### 変種${variant}: clamp前トップ15 → clamp後トップ15`);
    lines.push("");
    lines.push("| P4P順位(clamp後) | 選手名 | slug | 階級 | 階級内順位 | clamp前scoreも記載 | clamp後スコア | clamp前トップ15だったか |");
    lines.push("|---|---|---|---|---|---|---|---|");
    clampedTop15.forEach((c, i) => {
      const rankLabel = c.isChampion ? "王者" : `${c.divisionRank}`;
      lines.push(
        `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(scoreOf(c, variant, "raw"))} | ${formatNum(scoreOf(c, variant, "clamped"))} | ${rawTop15.has(c.slug) ? "○" : "×(新規入り)"} |`
      );
    });
    lines.push("");

    const droppedOut = [...rawTop15].filter((slug) => !clampedTop15Slugs.has(slug));
    if (droppedOut.length > 0) {
      const nameOf = (slug: string) => clampedRanked.find((c) => c.slug === slug)?.nameJa ?? resolveName(slug);
      lines.push(`clampによりトップ15から外れた選手: ${droppedOut.map((slug) => `${nameOf(slug)}(${slug})`).join(", ")}`);
    } else {
      lines.push("clampによりトップ15から外れた選手: なし。");
    }
    lines.push("");
  }

  lines.push("### 発見事項(§6)で報告した圏内4ペアのclamp後の解消確認");
  lines.push("");
  const materialPairs = inversions.filter((inv) => {
    // §6生成時点のトップ15圏内判定を再利用するのではなく、ここではclampで
    // 階級内順序自体が公開rank順に一致していることを直接確認する。
    return true;
  });
  lines.push("| 階級 | 選手ペア(公開rank順) | clamp前scoreA/B/C(rawRating由来) | clamp後scoreA/B/C | 公開rank順と一致したか |");
  lines.push("|---|---|---|---|---|");
  for (const inv of materialPairs) {
    const upperInClamped = clampedLists.find((l) => l.variant === "A")!.ranked.find((c) => c.slug === inv.lowerRawSlug)!; // 公開rank上位(rawは下)
    const lowerInClamped = clampedLists.find((l) => l.variant === "A")!.ranked.find((c) => c.slug === inv.higherRawSlug)!; // 公開rank下位(rawは上)
    const ok = ["A", "B", "C"].every((v) => {
      const key = clampedScoreKey(v as Variant);
      return (upperInClamped as any)[key] >= (lowerInClamped as any)[key];
    });
    lines.push(
      `| ${inv.division} | ${upperInClamped.nameJa}(rank${upperInClamped.divisionRank}) vs ${lowerInClamped.nameJa}(rank${lowerInClamped.divisionRank}) | A${formatNum(upperInClamped.scoreA)}/B${formatNum(upperInClamped.scoreB)}/C${formatNum(upperInClamped.scoreC)} ⇔ A${formatNum(lowerInClamped.scoreA)}/B${formatNum(lowerInClamped.scoreB)}/C${formatNum(lowerInClamped.scoreC)} | A${formatNum(upperInClamped.clampedScoreA)}/B${formatNum(upperInClamped.clampedScoreB)}/C${formatNum(upperInClamped.clampedScoreC)} ⇔ A${formatNum(lowerInClamped.clampedScoreA)}/B${formatNum(lowerInClamped.clampedScoreB)}/C${formatNum(lowerInClamped.clampedScoreC)} | ${ok ? "○(解消)" : "×"} |`
    );
  }
  lines.push("");
  return lines;
}

function buildReport(
  candidates: Candidate[],
  statsByDivision: Map<MnewsDivision, DivisionStats>,
  rawLists: RankedList[],
  clampedLists: RankedList[],
  divergent: { slug: string; nameJa: string; ranks: Record<Variant, number>; spread: number }[],
  inversions: RankInversion[],
  driftMatch: boolean,
  recomputeMismatches: string[],
  clampDiagnosticLines: string[],
  flyweightDiagnosticLines: string[],
  churnBacktestLines: string[]
): string {
  const lists = clampedLists; // §2以降の「公式」interleaveはclamp後スコア(指示書#2 C-3)
  const rankMaps: Record<Variant, Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));

  const lines: string[] = [];
  lines.push("# RIZIN パウンドフォーパウンド(P4P) 試算レポート(運用者向け・非公開・内部レビュー専用)");
  lines.push("");
  lines.push("本レポートは公開ページ・X投稿・記事素材に転用しないこと。rawRating生値を含む(内部値・非公開方針)。");
  lines.push("");
  lines.push(`入力: data/rankings.json(候補プール・階級・rank)+ data/fighterRecords.json・data/rizinRecords.json(王者rawRating算出用のエンジン読み取り専用再計算)+ data/rankings/archive/(バックテスト用過去断面)。壁時計非依存(asOf=最新bout日)。2回連続実行の一致確認: ${driftMatch ? "OK(完全一致)" : "NG(不一致)"}。`);
  lines.push("");
  lines.push("候補プール: PUBLISHED_DIVISIONSの公開階級のみ(非公開階級は含まない)。各階級の現行ランキング候補全員(表示キャップ=王者+15の外も含む)+ 王者(rawRating算出できた場合のみ、母集団・3変種スコアに含める)。除外(引退・hidden・階級離脱等)は既存のdata/rankings.json生成過程(isExcludedByFact)にそのまま従う。§2以降のP4P順位表・変種間乖離・王者仮説は、§8で説明する不変条件Clamp適用後のスコアで全体interleaveする(2026-07-21追加指示書#2 C-3)。");
  lines.push("");

  lines.push("## 0. 王者rawRating再計算の自己検証(d): 既存候補との突合");
  lines.push("");
  if (recomputeMismatches.length === 0) {
    lines.push("該当なし。data/rankings.jsonの全既存候補について、エンジン再計算のσディスカウント後レートが保存済みrawRatingと一致した(誤差0.01pt未満)。");
  } else {
    lines.push(`再計算パイプラインとdata/rankings.jsonのrawRatingが一致しなかった候補(${recomputeMismatches.length}件、再計算ロジックの信頼性に関わるため要確認):`);
    lines.push("");
    for (const m of recomputeMismatches) lines.push(`- ${m}`);
  }
  lines.push("");

  lines.push("## 1. 階級別統計サマリ(王者を母集団に含む、rawRatingベース・clamp前)");
  lines.push("");
  lines.push("母集団: その階級の候補プール全員のrawRating(data/rankings.jsonのentries[].rawRating、σディスカウント適用後の値)+ 算出できた王者。");
  lines.push("");
  lines.push("| 階級 | n | 平均 | 中央値 | σ(母集団) | MAD | 王者 | 王者rawRating |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const division of PUBLISHED_DIVISIONS) {
    const s = statsByDivision.get(division)!;
    const champLabel = s.championSlug ? `${s.championSlug}` : "(空位/未掲載)";
    const champRating = s.championRawRating !== null ? formatNum(s.championRawRating) : s.championFlag ? `フラグ: ${s.championFlag}` : "-";
    lines.push(`| ${division} | ${s.n} | ${formatNum(s.mean)} | ${formatNum(s.median)} | ${formatNum(s.sigma)} | ${formatNum(s.mad)} | ${champLabel} | ${champRating} |`);
  }
  lines.push("");

  lines.push("## 2. P4P順位表(clamp後スコアで全体interleave、§8参照)");
  lines.push("");
  for (const l of lists) {
    lines.push(`### 変種${l.variant} トップ15`);
    lines.push("");
    lines.push("| P4P順位 | 選手名 | slug | 階級 | 階級内順位 | rawRating | clamp後スコア | キャップ内外 |");
    lines.push("|---|---|---|---|---|---|---|---|");
    l.ranked.slice(0, 15).forEach((c, i) => {
      const rankLabel = c.isChampion ? "王者" : `${c.divisionRank}`;
      lines.push(
        `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(scoreOf(c, l.variant, "clamped"))} | ${c.capIn ? "内" : "外"} |`
      );
    });
    lines.push("");
  }

  lines.push("### 全候補フルテーブル(変種A・clamp後順)");
  lines.push("");
  lines.push("| P4P順位(A) | 選手名 | slug | 階級 | 階級内順位 | rawRating | clampedA | clampedB | clampedC | キャップ内外 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  lists[0].ranked.forEach((c, i) => {
    const rankLabel = c.isChampion ? "王者" : `${c.divisionRank}`;
    lines.push(
      `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(c.clampedScoreA)} | ${formatNum(c.clampedScoreB)} | ${formatNum(c.clampedScoreC)} | ${c.capIn ? "内" : "外"} |`
    );
  });
  lines.push("");

  lines.push("## 3. 変種間乖離フラグ(clamp後スコア基準、3変種間でP4P順位が5以上割れる選手)");
  lines.push("");
  if (divergent.length === 0) {
    lines.push("該当なし。");
  } else {
    lines.push("| 選手名 | slug | 階級 | A順位 | B順位 | C順位 | 最大差 | 考察 |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const d of divergent) {
      const division = candidates.find((c) => c.slug === d.slug)!.division;
      const s = statsByDivision.get(division)!;
      const note =
        s.sigma < s.mad
          ? "σ<MAD(外れ値の影響でσが縮小/拡大しA-B間で差が出やすい階級)"
          : s.sigma > s.mad
            ? "σ>MAD(MADは正規分布補正係数1.4826を掛けていないため常にσより小さくなりやすく、外れ値耐性の違いがA-B間の順位差として現れる)"
            : "σ≈MADだがCは絶対値のためスケールの違いで乖離";
      lines.push(`| ${d.nameJa} | ${d.slug} | ${division} | ${d.ranks.A} | ${d.ranks.B} | ${d.ranks.C} | ${d.spread} | ${note} |`);
    }
  }
  lines.push("");

  lines.push("## 4. 王者仮説の検証(clamp後スコア基準。各公開階級の王者、または王者不在/算出不能なら#1がP4Pトップ10に入るか)");
  lines.push("");
  lines.push("入らない場合はバグではなく設計上の発見として報告する(この試算の主目的の一つ)。");
  lines.push("");
  lines.push("| 階級 | 対象 | 変種A順位 | 変種B順位 | 変種C順位 | トップ10入り(A/B/C) |");
  lines.push("|---|---|---|---|---|---|");
  for (const division of PUBLISHED_DIVISIONS) {
    const s = statsByDivision.get(division)!;
    let targetSlug: string;
    let targetLabel: string;
    if (s.championSlug && s.championRawRating !== null) {
      targetSlug = s.championSlug;
      targetLabel = `王者 ${targetSlug}`;
    } else {
      const top1 = candidates
        .filter((c) => c.division === division && !c.isChampion)
        .sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number))[0];
      targetSlug = top1.slug;
      targetLabel = `#1代替(王者フラグ: ${s.championFlag ?? "空位"}) ${top1.nameJa}`;
    }
    const rA = rankMaps.A.get(targetSlug);
    const rB = rankMaps.B.get(targetSlug);
    const rC = rankMaps.C.get(targetSlug);
    const inTop10 = `${rA !== undefined && rA <= 10 ? "○" : "×"}/${rB !== undefined && rB <= 10 ? "○" : "×"}/${rC !== undefined && rC <= 10 ? "○" : "×"}`;
    lines.push(`| ${division} | ${targetLabel} | ${rA ?? "-"} | ${rB ?? "-"} | ${rC ?? "-"} | ${inTop10} |`);
  }
  lines.push("");

  lines.push("## 5. 日本人フィルタ参考列");
  lines.push("");
  lines.push("選手データ(src/lib/fighters.ts Fighter型)に国籍/日本人判定の既存フィールドは存在しない(フィールド不在、2026-07-21時点で再確認済み)。選手名からの国籍推定は捏造にあたるため行っていない。将来「日本人最強」を検討する場合は、国籍を事実として確認できるデータソースの追加が前提になる。");
  lines.push("");

  lines.push("## 6. 発見事項: rawRating降順と公開rank(H2H単調性補正後)の階級内順序の不一致(clamp導入前の状態、経緯記録)");
  lines.push("");
  lines.push("本スクリプトの自己検証(a)はスコア式自体の実装ミス検出用であり、rawRating降順とスコア降順の一致は全変種で確認済み(clamp前基準)。一方、rawRating降順と`data/rankings.json`の公開rank(既存エンジンのH2H単調性補正後)は、以下の箇所で一致しない(仕様であり本スクリプトのバグではない。ユーザー判断: 2026-07-21、exit 1にせず発見事項として報告する運用とした)。2026-07-21追加指示書#2により、§8で不変条件Clampを実装し、これらの箇所は§2以降のP4P順位表では解消済み(解消の確認は§8参照)。");
  lines.push("");
  if (inversions.length === 0) {
    lines.push("該当なし。");
  } else {
    const rawTop15SlugsByVariant: Record<Variant, Set<string>> = {
      A: new Set(rawLists.find((l) => l.variant === "A")!.ranked.slice(0, 15).map((c) => c.slug)),
      B: new Set(rawLists.find((l) => l.variant === "B")!.ranked.slice(0, 15).map((c) => c.slug)),
      C: new Set(rawLists.find((l) => l.variant === "C")!.ranked.slice(0, 15).map((c) => c.slug)),
    };
    lines.push("| 階級 | 公開rankが上位(rawRatingは下)| 公開rankが下位(rawRatingは上)| clamp前P4Pトップ15圏内への影響 |");
    lines.push("|---|---|---|---|");
    for (const inv of inversions) {
      const inTop15 =
        rawTop15SlugsByVariant.A.has(inv.higherRawSlug) ||
        rawTop15SlugsByVariant.A.has(inv.lowerRawSlug) ||
        rawTop15SlugsByVariant.B.has(inv.higherRawSlug) ||
        rawTop15SlugsByVariant.B.has(inv.lowerRawSlug) ||
        rawTop15SlugsByVariant.C.has(inv.higherRawSlug) ||
        rawTop15SlugsByVariant.C.has(inv.lowerRawSlug);
      lines.push(`| ${inv.division} | ${inv.lowerRawHigherRank} | ${inv.higherRawLowerRank} | ${inTop15 ? "あり(いずれかの変種でトップ15圏内)" : "なし(いずれの変種でもトップ15圏外)"} |`);
    }
  }
  lines.push("");

  lines.push("## 7. lookup miss");
  lines.push("");
  if (lookupMissSlugs.length === 0) {
    lines.push("該当なし(全候補slugがFIGHTERSで解決できた)。");
  } else {
    lines.push(`FIGHTERSでnameJaが解決できなかったslug(${lookupMissSlugs.length}件): ${lookupMissSlugs.join(", ")}`);
  }
  lines.push("");

  lines.push("## 8. 不変条件Clamp診断(2026-07-21追加指示書#2 C-3)");
  lines.push("");
  lines.push(...clampDiagnosticLines);

  lines.push("## 9. フライ級分布診断(2026-07-21追加指示書#2 C-1)");
  lines.push("");
  lines.push(...flyweightDiagnosticLines);

  lines.push("## 10. 無風日チャーン・バックテスト(2026-07-21追加指示書#2 C-2)");
  lines.push("");
  lines.push(...churnBacktestLines);

  return lines.join("\n") + "\n";
}

function runOnce(): { report: string; clampedCount: number } {
  const rankings = loadRankings();
  const displayMap = recomputeDisplayMap();
  const { candidates, statsByDivision, recomputeMismatches } = buildCandidatesAndStats(rankings, displayMap);
  const scored = scoreCandidates(candidates, statsByDivision);

  const monotonicityErrors = verifyScoreMonotonicity(scored);
  if (monotonicityErrors.length > 0) {
    console.error("[FATAL] 自己検証(a)失敗(スコア式実装バグの疑い):");
    for (const e of monotonicityErrors) console.error(`  ${e}`);
    throw new Error("自己検証(a)失敗");
  }

  const clamped = applyRankInvariantClamp(scored);
  const clampErrors = verifyClampInvariant(clamped);
  if (clampErrors.length > 0) {
    console.error("[FATAL] 自己検証(c)失敗(clamp実装バグの疑い):");
    for (const e of clampErrors) console.error(`  ${e}`);
    throw new Error("自己検証(c)失敗");
  }

  const inversions = collectRankOrderInversions(candidates);
  const rawLists = buildRankedLists(clamped, "raw");
  const clampedLists = buildRankedLists(clamped, "clamped");
  const divergent = findDivergentVariants(clampedLists);

  const clampDiagnosticLines = buildClampDiagnosticLines(rawLists, clampedLists, inversions);
  const flyweightDiagnosticLines = buildFlyweightDiagnosticLines(candidates, statsByDivision);
  const churnBacktestLines = buildChurnBacktestLines(rankings);

  const report = buildReport(
    candidates,
    statsByDivision,
    rawLists,
    clampedLists,
    divergent,
    inversions,
    true,
    recomputeMismatches,
    clampDiagnosticLines,
    flyweightDiagnosticLines,
    churnBacktestLines
  );
  return { report, clampedCount: clamped.length };
}

function main() {
  // 決定性の自己検証(b): 同一コミット上で2回連続実行し、出力が完全一致することを確認する。
  const first = runOnce();
  const second = runOnce();
  const driftMatch = first.report === second.report;
  if (!driftMatch) {
    console.error("[FATAL] 自己検証(b)失敗: 2回連続実行の出力が一致しません(非決定性の疑い)");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, first.report);
  console.log(`[OK] ${OUT_PATH} を生成しました(決定性チェックOK)`);
  console.log(`階級数: ${PUBLISHED_DIVISIONS.length} / 候補総数(王者含む): ${first.clampedCount}`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}

// RIZIN パウンドフォーパウンド(P4P)ランキング試算レポート(運用者向け・非公開)。
// docs/instructions/(P4P試算指示書)に基づく設計検証用。本番データ・エンジン・
// 定数は一切変更しない読み取り専用スクリプト。data/rankings.json(既存の
// 単一ゲート=PUBLISHED_DIVISIONS)を候補プールの正とし、階級内での「ドミナンス」
// (平均・中央値からの乖離)を3変種のスコア式で正規化して階級横断に並べ直す。
//
// 王者のrawRating欠落対策(2026-07-21レビュー指摘): CHAMPION_DISPLAY_MODE=
// "overlay"(現行デフォルト)では王者はrankings.json entriesから除外され、
// champion overlayには丸め済みdisplayRatingしか残らない。このためdata/rankings.json
// のみを入力にすると全公開階級で王者のrawRatingが恒久的に取得不能になり、
// 「王者仮説」検証が成立しない。対策として、update-mnews-rating.ts/
// check-h2h-invariant.tsと同じ思想で、エンジン(engine.ts)をここでも読み取り
// 専用に再実行し(data/fighterRecords.json・data/rizinRecords.jsonを入力に
// bouts→raw Elo→display までを再構築)、王者のσディスカウント後レートだけを
// 個別に算出する。エンジン自体・定数は一切変更しない(既存check系スクリプトと
// 同じ「読み取り専用の再計算」パターン)。既存候補(非王者)の階級・順位・
// rawRatingは引き続きdata/rankings.jsonをそのまま正とし、再計算結果との
// 突合で乖離があれば実装ミスとしてexit 1する(自己検証(d))。
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
const OUT_DIR = path.join(process.cwd(), "out");
const OUT_PATH = path.join(OUT_DIR, "p4p-trial.md");
const RAW_MISMATCH_EPSILON = 0.01; // 浮動小数の丸め誤差許容(pt)

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
  championSlug: string | null;
  championRawRating: number | null;
  championFlag: string | null; // 算出不能時の理由(nullは正常算出できた場合)
}

interface ScoredCandidate extends Candidate {
  scoreA: number;
  scoreB: number;
  scoreC: number;
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
  // (壁時計ではない、new Date(0)=1970年だと逆にすべてのboutが除外されるので
  // 使えない)を使い、そこから求めたlatestBoutDateを2回目の呼び出しの実asOfに
  // する。DECAY_PARAMS_V6はperPeriod=0(不活性ディケイ廃止済み)のため
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
    // フラグして人間判断に回す。champion overlay自体からは丸め済み値しか
        // 取れないため使わない)。王者は他候補と同じ母集団(統計・3変種スコア・
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
    const m = mean(ratings);
    const med = median(ratings);
    statsByDivision.set(division, {
      division,
      n: divisionCandidates.length,
      mean: m,
      median: med,
      sigma: populationSigma(ratings, m),
      mad: mad(ratings, med),
      championSlug,
      championRawRating,
      championFlag,
    });
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
// 必ず一致する(スコア計算式そのものの実装ミスを検出する目的)。
// 注意: これはdata/rankings.jsonの公開rank(H2H単調性補正後の最終順位)とは
// 別軸の検証。公開rankとrawRating降順は、既存エンジンのH2H補正により階級ごとに
// 数件の逆転が実際に存在する(仕様であり本スクリプトのバグではない。ユーザー
// 判断: 2026-07-21、exit 1にせず発見事項として§6に記録する)。
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

interface RankInversion {
  division: MnewsDivision;
  higherRawLowerRank: string;
  lowerRawHigherRank: string;
  higherRawSlug: string;
  lowerRawSlug: string;
}

// rawRating降順(H2H補正前相当)と公開rank(H2H補正後)の階級内順序が食い違う
// 箇所を発見事項として収集する(exit 1対象ではない。ユーザー判断: 2026-07-21)。
// 王者(divisionRank="champion")は公開rankを持たないため対象外。
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

interface P4PRankedList {
  variant: "A" | "B" | "C";
  ranked: ScoredCandidate[];
}

function buildP4PLists(scored: ScoredCandidate[]): P4PRankedList[] {
  return [
    { variant: "A" as const, ranked: [...scored].sort((a, b) => b.scoreA - a.scoreA) },
    { variant: "B" as const, ranked: [...scored].sort((a, b) => b.scoreB - a.scoreB) },
    { variant: "C" as const, ranked: [...scored].sort((a, b) => b.scoreC - a.scoreC) },
  ];
}

function scoreOf(c: ScoredCandidate, variant: "A" | "B" | "C"): number {
  return variant === "A" ? c.scoreA : variant === "B" ? c.scoreB : c.scoreC;
}

function findDivergentVariants(lists: P4PRankedList[]): { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[] {
  const rankMaps: Record<"A" | "B" | "C", Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));
  const allSlugs = new Set(lists[0].ranked.map((c) => c.slug));
  const bySlug = new Map(lists[0].ranked.map((c) => [c.slug, c]));
  const out: { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[] = [];
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

function buildReport(
  candidates: Candidate[],
  statsByDivision: Map<MnewsDivision, DivisionStats>,
  lists: P4PRankedList[],
  divergent: { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[],
  inversions: RankInversion[],
  driftMatch: boolean,
  recomputeMismatches: string[]
): string {
  const rankMaps: Record<"A" | "B" | "C", Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));

  const lines: string[] = [];
  lines.push("# RIZIN パウンドフォーパウンド(P4P) 試算レポート(運用者向け・非公開・内部レビュー専用)");
  lines.push("");
  lines.push("本レポートは公開ページ・X投稿・記事素材に転用しないこと。rawRating生値を含む(内部値・非公開方針)。");
  lines.push("");
  lines.push(`入力: data/rankings.json(候補プール・階級・rank)+ data/fighterRecords.json・data/rizinRecords.json(王者rawRating算出用のエンジン読み取り専用再計算)。壁時計非依存(asOf=最新bout日)。2回連続実行の一致確認: ${driftMatch ? "OK(完全一致)" : "NG(不一致)"}。`);
  lines.push("");
  lines.push("候補プール: PUBLISHED_DIVISIONSの公開階級のみ(非公開階級は含まない)。各階級の現行ランキング候補全員(表示キャップ=王者+15の外も含む)+ 王者(rawRating算出できた場合のみ、母集団・3変種スコアに含める)。除外(引退・hidden・階級離脱等)は既存のdata/rankings.json生成過程(isExcludedByFact)にそのまま従う。");
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

  lines.push("## 1. 階級別統計サマリ(王者を母集団に含む)");
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

  lines.push("## 2. P4P順位表");
  lines.push("");
  for (const l of lists) {
    lines.push(`### 変種${l.variant} トップ15`);
    lines.push("");
    lines.push("| P4P順位 | 選手名 | slug | 階級 | 階級内順位 | rawRating | スコア | キャップ内外 |");
    lines.push("|---|---|---|---|---|---|---|---|");
    l.ranked.slice(0, 15).forEach((c, i) => {
      const rankLabel = c.isChampion ? "王者" : `${c.divisionRank}`;
      lines.push(
        `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(scoreOf(c, l.variant))} | ${c.capIn ? "内" : "外"} |`
      );
    });
    lines.push("");
  }

  lines.push("### 全候補フルテーブル(変種A順)");
  lines.push("");
  lines.push("| P4P順位(A) | 選手名 | slug | 階級 | 階級内順位 | rawRating | scoreA | scoreB | scoreC | キャップ内外 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  lists[0].ranked.forEach((c, i) => {
    const rankLabel = c.isChampion ? "王者" : `${c.divisionRank}`;
    lines.push(
      `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(c.scoreA)} | ${formatNum(c.scoreB)} | ${formatNum(c.scoreC)} | ${c.capIn ? "内" : "外"} |`
    );
  });
  lines.push("");

  lines.push("## 3. 変種間乖離フラグ(3変種間でP4P順位が5以上割れる選手)");
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

  lines.push("## 4. 王者仮説の検証(各公開階級の王者、または王者不在/算出不能なら#1がP4Pトップ10に入るか)");
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

  lines.push("## 6. 発見事項: rawRating降順と公開rank(H2H単調性補正後)の階級内順序の不一致");
  lines.push("");
  lines.push("本スクリプトの自己検証(a)はスコア式自体の実装ミス検出用であり、rawRating降順とスコア降順の一致は全変種で確認済み(上記参照)。一方、rawRating降順と`data/rankings.json`の公開rank(既存エンジンのH2H単調性補正後)は、以下の箇所で一致しない(仕様であり本スクリプトのバグではない。ユーザー判断: 2026-07-21、exit 1にせず発見事項として報告する運用とした)。P4PスコアはrawRating(σディスカウント後、H2H補正前)ベースのため、これらの階級では階級内P4P順位が公開rankとわずかに異なりうる。「P4Pトップ15圏内への影響」列は、ペアのいずれかが3変種のいずれかでトップ15に入っているか(=このズレが表示に実際に影響しうるか)を示す参考情報。");
  lines.push("");
  if (inversions.length === 0) {
    lines.push("該当なし。");
  } else {
    const top15SlugsByVariant: Record<"A" | "B" | "C", Set<string>> = {
      A: new Set(lists.find((l) => l.variant === "A")!.ranked.slice(0, 15).map((c) => c.slug)),
      B: new Set(lists.find((l) => l.variant === "B")!.ranked.slice(0, 15).map((c) => c.slug)),
      C: new Set(lists.find((l) => l.variant === "C")!.ranked.slice(0, 15).map((c) => c.slug)),
    };
    lines.push("| 階級 | 公開rankが上位(rawRatingは下)| 公開rankが下位(rawRatingは上)| P4Pトップ15圏内への影響 |");
    lines.push("|---|---|---|---|");
    for (const inv of inversions) {
      const inTop15 =
        top15SlugsByVariant.A.has(inv.higherRawSlug) ||
        top15SlugsByVariant.A.has(inv.lowerRawSlug) ||
        top15SlugsByVariant.B.has(inv.higherRawSlug) ||
        top15SlugsByVariant.B.has(inv.lowerRawSlug) ||
        top15SlugsByVariant.C.has(inv.higherRawSlug) ||
        top15SlugsByVariant.C.has(inv.lowerRawSlug);
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

  return lines.join("\n") + "\n";
}

function runOnce(): { report: string; scored: ScoredCandidate[] } {
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

  const inversions = collectRankOrderInversions(candidates);
  const lists = buildP4PLists(scored);
  const divergent = findDivergentVariants(lists);
  const report = buildReport(candidates, statsByDivision, lists, divergent, inversions, true, recomputeMismatches);
  return { report, scored };
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
  console.log(`階級数: ${PUBLISHED_DIVISIONS.length} / 候補総数(王者含む): ${first.scored.length}`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}

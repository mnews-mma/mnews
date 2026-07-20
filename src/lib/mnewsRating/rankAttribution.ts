// PR-3(2026-07-20): 選手ごとの順位変動の要因分解ログ(out/rank-attribution.md)。
//
// 背景: 「ヒロヤが#13→#16に落ちた原因(敗戦-12pt+H2Hエッジ失効の複合)」の
// ような調査を、毎回十数コマンドの手動調査ではなく生成時に自動で出力できる
// ようにする。運用者向けのデバッグ支援ツールであり、公開ページには一切出さない
// (out/はgitignore対象・非公開・committedにしない)。ランキング本体の計算・
// 出力(rankings.json)には一切影響しない読み取り専用の副産物ログ。
//
// このモジュールはランキング本体のロジック(engine.ts/monotonicity.ts/
// rankingsFile.ts/eligibilityRules.ts)を一切変更せず、それらが既に計算した
// 値を「収集」してMarkdownにまとめるだけ。scripts/update-mnews-rating.tsから:
//   1. RankAttributionCollectorを生成し、computeRawRatingsのonBoutフックに
//      collector.onBoutを渡す(bout単位のrawレート変動を収集)。
//   2. 階級ごとのループでresolvePairDirections(h2hWins)の結果と、
//      computeExpiredH2HEdgesの結果をcollector.recordDivisionH2Hに渡す。
//   3. 選手ごとにexplainStandardEligibility(現在)の結果と、baseline時点の
//      掲載有無をcollector.recordEligibilityに渡す。
//   4. 全処理完了後、writeRankAttributionReportを1回呼ぶ。
import fs from "fs";
import path from "path";
import { Bout, computeSigmaDiscountedRating } from "./engine";
import { extractH2HWinsForDivision, resolvePairDirections, ResolvedPair } from "./monotonicity";
import { RankingsFile, divisionRankingsKey } from "./rankingsFile";
import { MNEWS_DIVISIONS, MnewsDivision } from "./divisions";
import { computeRankPositionDeltas, formatRankPositionDelta } from "./rankPositionDelta";
import { SIGMA_DISCOUNT_COEFFICIENT_V7 } from "./constants";
import { EligibilityExplanation } from "./eligibilityRules";

const OUT_DIR = path.join(process.cwd(), "out");
const OUT_PATH = path.join(OUT_DIR, "rank-attribution.md");

interface BoutRawDelta {
  opponent: string;
  date: string;
  delta: number; // このboutでの当該選手のrawRating変動(符号付き、小数点2桁)
  result: "win" | "loss" | "draw";
}

interface DivisionH2HInfo {
  resolvedPairs: ResolvedPair[]; // 今回有効なH2H制約(このdivisionの全ペア)
  expiredPairs: ResolvedPair[]; // 前回は有効・今回は窓外になり失効したH2H制約
}

interface EligibilityRecord {
  wasListedBefore: boolean; // baseline時点でこの階級のentriesに掲載されていたか
  isListedNow: boolean; // 今回entriesに掲載されているか
  explanation: EligibilityExplanation; // 現在の資格判定内訳(explainStandardEligibility)
}

// PR-3: 失効したH2Hエッジ(前回は有効・今回は窓外)を検出する純関数。
// bouts: 全期間の対戦(Elo計算用、階級横断)。divisionSlugsは今回時点の
// 資格保有選手集合(前回時点のdivisionSlugsは保存されていないため近似として
// 流用する。boutsはbuildBoutsが毎回全期間をフル再計算するため大きくは
// ズレない)。prevLatestBoutDateは前回実行時点の当該階級のlatestBoutDate
// (近似。rankings.jsonのentries.lastFight最大値から呼び出し側が算出する)。
// nullなら(前回データなし)失効判定は行わず空配列を返す。
export function computeExpiredH2HEdges(
  bouts: { aNode: string; bNode: string; scoreA: number; date: string }[],
  divisionSlugs: Set<string>,
  prevLatestBoutDate: string | null,
  currentResolvedPairs: ResolvedPair[],
  recencyMonths: number
): ResolvedPair[] {
  if (!prevLatestBoutDate) return [];
  const prevCutoff = (() => {
    const d = new Date(prevLatestBoutDate);
    d.setMonth(d.getMonth() - recencyMonths);
    return d.toISOString().slice(0, 10);
  })();
  const prevH2hWins = extractH2HWinsForDivision(bouts, divisionSlugs, prevCutoff);
  const prevResolvedPairs = resolvePairDirections(prevH2hWins);
  const currentKeys = new Set(currentResolvedPairs.map((p) => `${p.winner}|${p.loser}`));
  return prevResolvedPairs.filter((p) => !currentKeys.has(`${p.winner}|${p.loser}`));
}

// bout単位のrawレート変動・H2H関与/失効エッジ・資格変化を、生成バッチ実行中に
// 収集する。ランキング計算のロジックには一切介入しない(読み取り専用の観測フック)。
export class RankAttributionCollector {
  private boutDeltasBySlug = new Map<string, BoutRawDelta[]>();
  private h2hInfoByDivision = new Map<MnewsDivision, DivisionH2HInfo>();
  private eligibilityBySlug = new Map<string, EligibilityRecord>();

  // computeRawRatingsのonBoutフックとしてそのまま渡せる形。
  onBout = (
    bout: Bout,
    aBefore: number,
    bBefore: number,
    _aFights: number,
    _bFights: number,
    aAfter: number,
    bAfter: number
  ): void => {
    const record = (slug: string, opponent: string, before: number, after: number, isWinner: boolean) => {
      if (!this.boutDeltasBySlug.has(slug)) this.boutDeltasBySlug.set(slug, []);
      this.boutDeltasBySlug.get(slug)!.push({
        opponent,
        date: bout.date,
        delta: Math.round((after - before) * 100) / 100,
        result: bout.scoreA === 0.5 ? "draw" : isWinner ? "win" : "loss",
      });
    };
    record(bout.aNode, bout.bNode, aBefore, aAfter, bout.scoreA === 1);
    record(bout.bNode, bout.aNode, bBefore, bAfter, bout.scoreA === 0);
  };

  recordDivisionH2H(division: MnewsDivision, resolvedPairs: ResolvedPair[], expiredPairs: ResolvedPair[]): void {
    this.h2hInfoByDivision.set(division, { resolvedPairs, expiredPairs });
  }

  recordEligibility(slug: string, wasListedBefore: boolean, isListedNow: boolean, explanation: EligibilityExplanation): void {
    this.eligibilityBySlug.set(slug, { wasListedBefore, isListedNow, explanation });
  }

  getBoutDeltas(slug: string): BoutRawDelta[] {
    return this.boutDeltasBySlug.get(slug) ?? [];
  }

  getH2HInfo(division: MnewsDivision): DivisionH2HInfo {
    return this.h2hInfoByDivision.get(division) ?? { resolvedPairs: [], expiredPairs: [] };
  }

  getEligibility(slug: string): EligibilityRecord | undefined {
    return this.eligibilityBySlug.get(slug);
  }
}

function fightsOf(record: { wins: number; losses: number; draws: number }): number {
  return record.wins + record.losses + record.draws;
}

// attributionレポート用のbaseline解決(PR-3時点は実行前のrankings.jsonをそのまま
// 使う)。PR-6でpre-eventスナップショット(イベント反映バッチ開始時点の凍結
// コピー)が導入されたら、ここで「pre-eventスナップショットが存在すれば
// そちらを優先」という条件分岐に切り替える(呼び出し側=update-mnews-rating.ts
// は無改修で済む)。
export function resolveAttributionBaseline(prevOut: RankingsFile): RankingsFile {
  return prevOut;
}

function formatEligibilityExplanation(e: EligibilityExplanation): string {
  const fightRoute = e.meetsFightBar
    ? e.qualifiesViaRecent
      ? `直近ルート達成(直近年${e.recentFights}戦)`
      : `通算ルート達成(通算${e.fights}戦)`
    : `未達成(通算${e.fights}戦・直近年${e.recentFights}戦)`;
  const winPart = e.qualifiesViaRecent
    ? `勝利${e.wins}(直近ルートのため免除・実効${e.effectiveWins})`
    : `勝利${e.wins}(実効${e.effectiveWins})`;
  return `試合数要件: ${fightRoute} / ${winPart} / オープニングファイト除外${e.totalExcludedByOpeningFight}件 / 判定=${e.eligible ? "資格あり" : "資格なし"}`;
}

// out/rank-attribution.mdを書き出す。書き込み失敗(out/作成不可等)はレポート
// 生成の失敗であり、rankings.json本体の生成・書き込みには影響させない
// (呼び出し側でtry/catchすることを想定、この関数自体は例外を投げうる)。
export function writeRankAttributionReport(
  collector: RankAttributionCollector,
  published: RankingsFile,
  prevOut: RankingsFile
): void {
  const lines: string[] = [];
  lines.push("# mnewsレーティング 順位変動 要因分解レポート(運用者向け・非公開)");
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("公開ページには一切出しません。out/はgitignore対象です。");
  lines.push("");

  for (const division of MNEWS_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const current = published[key];
    const prev = prevOut[key];
    if (!current) continue;

    const deltas = computeRankPositionDeltas(current, prev);
    const prevRatingBySlug = new Map((prev?.entries ?? []).map((e) => [e.fighterId, e]));
    const h2hInfo = collector.getH2HInfo(division);
    const resolvedBySlug = new Map<string, ResolvedPair[]>();
    for (const p of h2hInfo.resolvedPairs) {
      for (const slug of [p.winner, p.loser]) {
        if (!resolvedBySlug.has(slug)) resolvedBySlug.set(slug, []);
        resolvedBySlug.get(slug)!.push(p);
      }
    }
    const expiredBySlug = new Map<string, ResolvedPair[]>();
    for (const p of h2hInfo.expiredPairs) {
      for (const slug of [p.winner, p.loser]) {
        if (!expiredBySlug.has(slug)) expiredBySlug.set(slug, []);
        expiredBySlug.get(slug)!.push(p);
      }
    }

    const divisionLines: string[] = [];
    for (const entry of current.entries) {
      const slug = entry.fighterId;
      const boutDeltas = collector.getBoutDeltas(slug);
      const posDelta = deltas.get(slug) ?? null;
      const prevEntry = prevRatingBySlug.get(slug);
      const rawDiff = prevEntry ? Math.round((entry.rawRating - prevEntry.rawRating) * 100) / 100 : null;
      const involvedH2H = resolvedBySlug.get(slug) ?? [];
      const expiredH2H = expiredBySlug.get(slug) ?? [];
      const eligibility = collector.getEligibility(slug);
      // 資格ステータス変化(非掲載→掲載、または掲載→非掲載相当のflip)。
      // naokiのようにrawレート差分ゼロ・H2H無関与でも順位変動(新規掲載)だけは
      // 起きるケースを取りこぼさないための独立した絞り込み条件。
      const eligibilityFlipped = eligibility ? eligibility.wasListedBefore !== eligibility.isListedNow : false;

      // 出力対象は「今回の実行で観測可能な変化があった選手」のみに絞る
      // (rawレート差分・順位変動・H2Hエッジの失効・資格ステータス変化の
      // いずれかがある選手)。「適用中のH2H制約」自体は変化ではなく静的な
      // 情報(常にほぼ全選手が何らかの制約に関与しうる)なので、絞り込み
      // 条件には含めない(対象選手の詳細セクションの参考情報としてのみ出す)。
      // 全選手を出すと運用者向けログとして肥大化しすぎるため。
      const hasChange =
        (rawDiff !== null && rawDiff !== 0) ||
        (posDelta && posDelta.kind !== "same") ||
        expiredH2H.length > 0 ||
        eligibilityFlipped;
      if (!hasChange) continue;

      const fights = fightsOf(entry.record);
      const currentDiscount = computeSigmaDiscountedRating(entry.rawRating, fights, SIGMA_DISCOUNT_COEFFICIENT_V7) - entry.rawRating;
      const prevFights = prevEntry ? fightsOf(prevEntry.record) : null;
      const prevDiscount =
        prevEntry && prevFights !== null
          ? computeSigmaDiscountedRating(prevEntry.rawRating, prevFights, SIGMA_DISCOUNT_COEFFICIENT_V7) - prevEntry.rawRating
          : null;

      divisionLines.push(`### ${slug}`);
      divisionLines.push("");
      if (eligibilityFlipped && eligibility) {
        divisionLines.push(
          `- 資格ステータス変化: ${eligibility.wasListedBefore ? "掲載" : "非掲載"} → ${eligibility.isListedNow ? "掲載" : "非掲載"}`
        );
        divisionLines.push(`  - 現在の資格判定内訳: ${formatEligibilityExplanation(eligibility.explanation)}`);
      }
      const prevRank = prevEntry ? prevOut[key]?.entries.find((e) => e.fighterId === slug)?.rank : undefined;
      divisionLines.push(
        `- 順位変動: ${prevRank !== undefined ? `${prevRank}位` : "(前回未掲載)"} → ${entry.rank}位(${formatRankPositionDelta(posDelta)})`
      );
      divisionLines.push(`- rawレート: ${prevEntry ? prevEntry.rawRating.toFixed(2) : "(前回未掲載)"} → ${entry.rawRating.toFixed(2)}${rawDiff !== null ? ` (差分 ${rawDiff >= 0 ? "+" : ""}${rawDiff.toFixed(2)})` : ""}`);
      if (boutDeltas.length > 0) {
        divisionLines.push(`- bout単位の内訳(全期間・当バッチで再計算されたもの):`);
        for (const b of boutDeltas) {
          divisionLines.push(
            `  - ${b.date} vs ${b.opponent}: ${b.delta >= 0 ? "+" : ""}${b.delta.toFixed(2)}pt (${b.result})`
          );
        }
      }
      divisionLines.push(
        `- σディスカウント: fights ${prevFights ?? "?"} → ${fights}, discount ${prevDiscount !== null ? prevDiscount.toFixed(2) : "?"} → ${currentDiscount.toFixed(2)}`
      );
      if (involvedH2H.length > 0) {
        divisionLines.push(`- 適用中のH2H制約(このペアがどちらかの順位を固定):`);
        for (const p of involvedH2H) {
          divisionLines.push(`  - ${p.winner} > ${p.loser}(${p.date})`);
        }
      }
      if (expiredH2H.length > 0) {
        divisionLines.push(`- 今回失効したH2Hエッジ(前回は窓内・今回は窓外。順位固定が解除された可能性):`);
        for (const p of expiredH2H) {
          divisionLines.push(`  - ${p.winner} > ${p.loser}(${p.date})`);
        }
      }
      divisionLines.push("");
    }

    if (divisionLines.length > 0) {
      lines.push(`## ${division}`);
      lines.push("");
      lines.push(...divisionLines);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n");
}

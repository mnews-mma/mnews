// rankings.json の出力構造を組み立てる純関数群。I/O(fs)は持たない。
// 呼び出し側(scripts/update-mnews-rating.ts)がdata/fighterRecords.jsonと
// 前回のrankings.jsonを読み込み、ここへ渡す。
import { ALGORITHM_VERSION, CHAMPION_DISPLAY_MODE } from "./constants";
import { computeSigmaDiscountedRating, DisplayEntry } from "./engine";
import { DIVISION_SLUG, MnewsDivision } from "./divisions";
import { applyHeadToHeadMonotonicity, H2HWin } from "./monotonicity";
import type { RankPositionDelta } from "./rankPositionDelta";

export interface RankingEntryRecord {
  wins: number;
  losses: number;
  draws: number;
}

// 表示用レートの丸め幅(B案: 10点刻み)。画面・ウィジェット・OGP・選手詳細等の
// 外向き出力に出るレートはすべてこの粒度に丸める(内部の生Eloレートは出さない)。
export const RATING_DISPLAY_STEP = 10;

export function roundToDisplayStep(value: number): number {
  return Math.round(value / RATING_DISPLAY_STEP) * RATING_DISPLAY_STEP;
}

export interface RankingEntry {
  fighterId: string;
  rank: number;
  rating: number; // 表示用(10点刻みに丸め済み)。順位はこの値ではなくrawRatingで決まる
  // 前回バッチとのdelta算出専用の内部値(生の表示レート、丸めなし)。
  // 画面・ウィジェット・OGP等では一切参照しない(常にrating/deltaのみを使う)。
  rawRating: number;
  delta: number | null; // 前回バッチとの差分。生レート同士の差(丸め後の値の差ではない)。初回(前回データ無し)はnull
  record: RankingEntryRecord;
  lastFight: string | null;
  weighInMiss: boolean;
  // CHAMPION_DISPLAY_MODE==="badge"時のみ、王者の行にtrueが付く。
  // "overlay"時は王者自体がentriesに含まれないため常にundefined。
  isChampion?: boolean;
  // A-4(2026-07-18)追加: 前回スナップショットとの「順位番号(rank)」差分
  // (▲上昇/▼下降/—変動なし/NEW新規ランクイン)。buildDivisionRankings自体は
  // このフィールドを設定しない(スコア確定ロジックに差分計算を混在させない)。
  // 呼び出し側(update-mnews-rating.ts)がbuildDivisionRankings確定後に
  // rankPositionDelta.tsの純関数で後付けする。前回データが無い場合や
  // 未計算の場合はnull(捏造しない)。
  rankPositionDelta?: RankPositionDelta | null;
}

// 王者の事実オーバーレイ(Elo掲載資格とは独立)。CHAMPION_DISPLAY_MODE==="overlay"の
// 場合のみ設定され、番号付きentriesからは除外した上でここに別掲載する。
// レート算出が無い(Eloデータが一切無い)王者はrating/record/lastFightがnullのまま
// 名前(fighterId)だけの事実表示になる(推測で埋めない)。
export interface ChampionOverlay {
  fighterId: string;
  rating: number | null;
  record: RankingEntryRecord | null;
  lastFight: string | null;
}

export interface DivisionRankings {
  division: MnewsDivision;
  updatedAt: string; // ISO
  algorithmVersion: number;
  champion: ChampionOverlay | null;
  entries: RankingEntry[];
}

export type RankingsFile = Record<string, DivisionRankings>; // key = DIVISION_SLUG

export interface FighterMeta {
  slug: string;
  division: MnewsDivision | null;
  weighInMiss: boolean;
}

// algorithmVersionが前回バッチから変わった日はdeltaを一律nullにする(C-3)。
// 係数変更による見かけ上の大きな増減を「実際の順位変動」と誤認させないため。
// 個別のレート判定ではなくバージョン差分をトリガーにすることで、将来の係数
// 変更時も自動で効く(このファイルを毎回書き換える必要が無い)。
export function shouldSuppressDelta(prev: DivisionRankings | undefined): boolean {
  return prev !== undefined && prev.algorithmVersion !== ALGORITHM_VERSION;
}

// 掲載資格ありのdisplayEntryを階級ごとに束ね、レート降順で順位を振る。
// champion指定時、mode==="overlay"(デフォルト=CHAMPION_DISPLAY_MODE)なら番号付き
// リストから王者を除外し、別途championフィールドとして返す(UFC方式)。
// modeは通常呼び出し側で指定不要(CHAMPION_DISPLAY_MODEが使われる)。テストで
// overlay/badge両方の切替動作を検証するために引数化してある。
export function buildDivisionRankings(
  division: MnewsDivision,
  eligibleEntries: Array<{ meta: FighterMeta; display: DisplayEntry }>,
  updatedAt: Date,
  prev: DivisionRankings | undefined,
  champion: ChampionOverlay | null,
  mode: "overlay" | "badge" = CHAMPION_DISPLAY_MODE,
  // 不確実性ディスカウント(P1・2026-07-16追加、未採用/比較検証用)。指定時のみ
  // 順位付け指標を R - coefficient/√n に変更する(engine.tsのcomputeSigmaDiscountedRating
  // 参照)。未指定(デフォルト)は従来どおり生の表示レートをそのまま使う
  // (挙動を完全維持)。
  sigmaDiscountCoefficient?: number,
  // 直接対決の単調性オーバーレイ(P2・2026-07-16採用、2026-07-17 P0-Bで
  // ハード制約化=距離制限撤廃、2026-07-16 v9改訂でmaxRankGapによる弱い
  // 整合に戻す)。指定時のみ、上記の順位付け後に「AがBに直接勝っているのに
  // 順位がAの方が下」を補正する(monotonicity.ts参照)。h2hWinsはこの
  // division内の決着済み対戦のみを渡すこと(呼び出し側の責務)。maxRankGap
  // 省略時は距離無制限(v8互換)。
  monotonicity?: { h2hWins: H2HWin[]; maxRankGap?: number },
  // ダンプ/検証用: monotonicity補正が適用される直前の順序(σディスカウント後・
  // maxRankGapフィルタの基準になった並び)を通知する。ランキング本体には
  // 一切影響しない読み取り専用のフック(engine.tsのcomputeRawRatings
  // onBoutと同じ思想)。checkH2HInvariant等の自己検証で、構築時と同じ基準で
  // gap判定するために使う(post-hoc最終順位でgapを測ると構築時の判定と
  // ズレるため)。
  onPreCorrectionOrder?: (slugs: string[]) => void
): DivisionRankings {
  const isBadgeMode = mode === "badge";
  const suppressDelta = shouldSuppressDelta(prev);
  // delta算出は生の表示レート(丸め前)同士の差で行う(rawRatingが無い旧スナップ
  // ショットとの互換のため、無ければ丸め済みratingにフォールバックする)。
  const prevRawRatingByFighter = new Map((prev?.entries ?? []).map((e) => [e.fighterId, e.rawRating ?? e.rating]));

  const pool = isBadgeMode ? eligibleEntries : eligibleEntries.filter((e) => e.meta.slug !== champion?.fighterId);
  const effectiveRating = (e: { meta: FighterMeta; display: DisplayEntry }): number =>
    sigmaDiscountCoefficient !== undefined
      ? computeSigmaDiscountedRating(e.display.displayRating, e.display.fights, sigmaDiscountCoefficient)
      : e.display.displayRating;
  // 順位は常に生の表示レート(丸め前、sigmaDiscountCoefficient指定時は
  // ディスカウント後)の降順で決める。丸めて同点表示になっても順位は一意
  // (生レートの差で決まる)。
  let sorted = [...pool].sort((a, b) => effectiveRating(b) - effectiveRating(a));

  if (monotonicity) {
    onPreCorrectionOrder?.(sorted.map((e) => e.meta.slug));
    const bySlug = new Map(sorted.map((e) => [e.meta.slug, e]));
    const reorderedSlugs = applyHeadToHeadMonotonicity(
      sorted.map((e) => e.meta.slug),
      monotonicity.h2hWins,
      monotonicity.maxRankGap
    );
    sorted = reorderedSlugs.map((slug) => bySlug.get(slug)!);
  }

  const entries: RankingEntry[] = sorted.map((e, i) => {
    const rawRating = effectiveRating(e);
    const rating = roundToDisplayStep(rawRating);
    const prevRawRating = prevRawRatingByFighter.get(e.meta.slug);
    return {
      fighterId: e.meta.slug,
      rank: i + 1,
      rating,
      rawRating,
      delta: suppressDelta || prevRawRating === undefined ? null : Math.round(rawRating - prevRawRating),
      record: { wins: e.display.wins, losses: e.display.losses, draws: e.display.draws },
      lastFight: e.display.lastFightDate,
      weighInMiss: e.meta.weighInMiss,
      ...(isBadgeMode && champion?.fighterId === e.meta.slug ? { isChampion: true } : {}),
    };
  });

  return {
    division,
    updatedAt: updatedAt.toISOString(),
    algorithmVersion: ALGORITHM_VERSION,
    champion: isBadgeMode ? null : champion,
    entries,
  };
}

export function divisionRankingsKey(division: MnewsDivision): string {
  return DIVISION_SLUG[division];
}

// そのバッチ実行で「順位変動があった日」かどうか。1件でもdeltaが非null&非ゼロ、
// または掲載選手の顔ぶれ(fighterIdの集合)が前回と変わっていればtrueとする
// (アーカイブ保存の要否判定に使う)。
export function hasRankingChange(current: DivisionRankings, prev: DivisionRankings | undefined): boolean {
  if (!prev) return current.entries.length > 0; // 初回公開もアーカイブ対象
  if (prev.algorithmVersion !== current.algorithmVersion) return true; // バージョン変更は無条件でアーカイブ対象
  const prevIds = prev.entries.map((e) => e.fighterId).join(",");
  const currentIds = current.entries.map((e) => e.fighterId).join(",");
  if (prevIds !== currentIds) return true;
  return current.entries.some((e) => e.delta !== null && e.delta !== 0);
}

// data-correctionモード専用。「rawRatingの大きさ」では実データ修正由来の
// ripple(例: 2026-07-14の秋元強真-16.47)と本物の新規試合結果による変動を
// 区別できないため(閾値・丸め基準では確実に防げないと判明済み)、判定は
// 実行コンテキスト(呼び出し元がdata-correctionモードかどうか)で行う。
// この関数はそのモードでの唯一の検出ロジック: baseline(最後にnew-results
// モードが正当に確定させた状態)と現在の生成結果を全階級・全選手突合し、
// rawRatingが動いた選手を漏れなく列挙する(±3位圏等の目視推測はしない)。
export interface RippleEntry {
  divisionSlug: string;
  fighterId: string;
  rawBefore: number;
  rawAfter: number;
  rawDiff: number; // after - before
  deltaInOutput: number | null;
}

export function auditRankingsRipple(baseline: RankingsFile, current: RankingsFile, epsilon = 0.001): RippleEntry[] {
  const out: RippleEntry[] = [];
  for (const [divisionSlug, div] of Object.entries(current)) {
    const baseEntries = new Map((baseline[divisionSlug]?.entries ?? []).map((e) => [e.fighterId, e]));
    for (const e of div.entries) {
      const base = baseEntries.get(e.fighterId);
      if (!base) continue; // 新規掲載選手はripple対象外(baseline側に無い=比較不能)
      const rawDiff = e.rawRating - base.rawRating;
      if (Math.abs(rawDiff) > epsilon) {
        out.push({
          divisionSlug,
          fighterId: e.fighterId,
          rawBefore: base.rawRating,
          rawAfter: e.rawRating,
          rawDiff,
          deltaInOutput: e.delta,
        });
      }
    }
  }
  return out;
}

// data-correctionモード実行結果に、auditRankingsRippleで検出されたripple対象
// 選手のdeltaを一律0に強制する(丸め・閾値ではなく「このモードで動いた選手は
// 全員」という一律ルール)。呼び出し側(update-mnews-rating.ts)は、この適用後に
// 必ずauditRankingsRippleを再実行してdeltaInOutput===0が全件で成立することを
// 自己検証してから書き込むこと(2026-07-14の手順5違反の再発防止)。
export function suppressRippleDelta(current: RankingsFile, ripple: RippleEntry[]): RankingsFile {
  const targets = new Set(ripple.map((r) => `${r.divisionSlug}:${r.fighterId}`));
  const out: RankingsFile = {};
  for (const [divisionSlug, div] of Object.entries(current)) {
    out[divisionSlug] = {
      ...div,
      entries: div.entries.map((e) => (targets.has(`${divisionSlug}:${e.fighterId}`) ? { ...e, delta: 0 } : e)),
    };
  }
  return out;
}

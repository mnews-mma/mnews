// パウンドフォーパウンド(P4P)ランキングの生成ロジック(2026-07-22追加)。
//
// 設計方針改訂(2026-07-22、王者ティア固定を撤回): 当初(2026-07-21試算PR #172)
// は「王者を必ずP4P1〜4位に固定し、防衛回数→勝率でタイブレークする」設計
// だったが、人間レビューで「防衛回数の重み付けは階級の厳しさを考慮しておらず、
// かといって階級難易度まで加味すると複雑になりすぎる」との指摘を受け、
// 王者ティアの固定枠を撤回した。現在の設計は以下のシンプルな1本のルールのみ:
// - 全員(王者+挑戦者)を、階級内平均・σからのドミナンスzスコア(1本の指標)で
//   階級横断にフラットに並べる。防衛回数・勝率は表示上の参考情報としては残すが、
//   順位には一切使わない。
// - ただし挑戦者(非王者)については、同一階級内の順序が公開rank順(1位>2位…)を
//   絶対に逆転しないようclamp(running-min方式)をかける。王者は階級内の「公開
//   rank」という概念を持たない(overlay設計、番号付きランキングの対象外)ため、
//   clamp対象外(生のzスコアのままグローバル順位に参加する)。
//
// このモジュールはdata/rankings.json(既存Eloランキング)を読み取り専用の入力
// とし、data/rankings.json自体・engine.ts・共有定数には一切影響しない
// (P4P専用ロジックはこのファイルとscripts/generate-p4p.tsのみに閉じる)。
import { MnewsDivision, PUBLISHED_DIVISIONS } from "./divisions";
import { RankingsFile, RankingEntryRecord, divisionRankingsKey } from "./rankingsFile";
import { ChampionDefenseEntry } from "../championDefenses";

export type P4PTier = "champion" | "challenger";

export interface P4PRankPositionDelta {
  kind: "up" | "down" | "same" | "new";
  positions: number;
}

export interface P4PEntry {
  fighterId: string;
  division: MnewsDivision;
  p4pRank: number; // 1始まり、王者ティア→挑戦者の順
  divisionRank: number | "champion"; // 階級内位置(公開rank、王者は"champion")
  tier: P4PTier;
  defenseCount: number | null; // 王者のみ。取得不能はnull(0埋め・推定禁止)
  record: RankingEntryRecord;
  lastFight: string | null;
  // buildP4PFileの時点ではnull。scripts/generate-p4p.tsがcomputeP4PRankPositionDeltas
  // で前回data/p4p.jsonとの差分を算出した後に埋める(rankPositionDelta.tsの
  // 既存の階級別ランキングと同じ「後処理として付与する」設計を踏襲)。
  rankPositionDelta: P4PRankPositionDelta | null;
  // 内部専用フィールド(次回実行時のdelta計算にのみ使う、公開ページには出さない)。
  internalScore: number; // 挑戦者=clamp後zスコア、王者=タイブレークに使った生zスコア
}

export interface P4PFile {
  updatedAt: string; // ISO
  algorithmVersion: number; // 参照したdata/rankings.jsonの各階級algorithmVersion(全階級一致が前提)
  entries: P4PEntry[]; // p4pRank昇順、全候補(表示キャップはページ側で適用)
  defenseDataIssues: string[]; // 現王者で防衛回数データが無かった場合の明細(空なら問題なし)
}

// data/rankings.jsonのentries由来の候補(非王者)。
interface ChallengerCandidate {
  slug: string;
  division: MnewsDivision;
  divisionRank: number;
  rawRating: number;
  record: RankingEntryRecord;
  lastFight: string | null;
}

// エンジン読み取り専用再計算で得た王者のσディスカウント後rawRating
// (rankings.jsonのchampion overlayはrawRatingを保持しないため、
// scripts/generate-p4p.ts側でengine.tsを読み取り専用に再実行して渡す)。
export interface ChampionRawRatingInput {
  slug: string;
  division: MnewsDivision;
  rawRating: number;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// 挑戦者候補をdata/rankings.jsonのentriesからそのまま抽出する(公開階級のみ)。
export function collectChallengerCandidates(rankings: RankingsFile): ChallengerCandidate[] {
  const out: ChallengerCandidate[] = [];
  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const divData = rankings[key];
    if (!divData) continue; // 空データは「候補0件」として続行(異常系はgenerate-p4p.ts側でexit1)
    for (const e of divData.entries) {
      out.push({
        slug: e.fighterId,
        division,
        divisionRank: e.rank,
        rawRating: e.rawRating,
        record: e.record,
        lastFight: e.lastFight,
      });
    }
  }
  return out;
}

// 階級ごとの平均・σ(母集団)。2026-07-21試算PR #172の統計サマリ(§1)と同じ
// 定義に揃える: 母集団は「その階級の候補プール全員」= 挑戦者 + 王者(算出できた
// 場合)。王者を母集団から除くと、承認済みの試算結果(トップ15の並び順)から
// ズレる(挑戦者のzスコアが変わり、挑戦者間の順序が変わりうる)ため、必ず
// 王者を含めて計算すること。
function divisionStats(
  challengers: ChallengerCandidate[],
  championRawRatings: ChampionRawRatingInput[]
): Map<MnewsDivision, { mean: number; sigma: number }> {
  const out = new Map<MnewsDivision, { mean: number; sigma: number }>();
  for (const division of PUBLISHED_DIVISIONS) {
    const ratings = challengers.filter((c) => c.division === division).map((c) => c.rawRating);
    const champ = championRawRatings.find((c) => c.division === division);
    if (champ) ratings.push(champ.rawRating);
    if (ratings.length === 0) continue;
    const m = mean(ratings);
    const sigma = Math.sqrt(mean(ratings.map((x) => (x - m) ** 2)));
    out.set(division, { mean: m, sigma });
  }
  return out;
}

interface ScoredChallenger extends ChallengerCandidate {
  rawScore: number; // (rawRating-平均)/σ
  clampedScore: number; // 階級内running-min適用後
}

// 不変条件Clamp: 各階級で公開rank昇順に並べ、直前の(clamp後)スコアを上回って
// いれば直前値まで引き下げる(running min)。これにより同一階級内でP4Pスコア
// 順が必ず公開rank順と一致する(2026-07-21試算PR #172 §8で検証済みのロジック
// をそのまま移植)。
function scoreAndClampChallengers(
  challengers: ChallengerCandidate[],
  stats: Map<MnewsDivision, { mean: number; sigma: number }>
): ScoredChallenger[] {
  const byDivision = new Map<MnewsDivision, ChallengerCandidate[]>();
  for (const c of challengers) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  const out: ScoredChallenger[] = [];
  for (const [division, list] of byDivision) {
    const s = stats.get(division);
    const byRankAsc = [...list].sort((a, b) => a.divisionRank - b.divisionRank);
    let runningMin = Infinity;
    for (const c of byRankAsc) {
      const rawScore = s && s.sigma !== 0 ? (c.rawRating - s.mean) / s.sigma : 0;
      const clampedScore = Math.min(rawScore, runningMin);
      runningMin = clampedScore;
      out.push({ ...c, rawScore, clampedScore });
    }
  }
  return out;
}

export interface ChampionTierEntry {
  slug: string;
  division: MnewsDivision;
  record: RankingEntryRecord;
  lastFight: string | null;
  winRate: number | null;
  defenseCount: number | null;
  scoreA: number; // グローバル順位に使う王者本人のドミナンスzスコア(挑戦者と同じ階級内平均/σ基準)。clamp対象外。
}

// 王者ごとのドミナンスzスコア・戦績・防衛回数を算出する(順位付けはしない)。
// 2026-07-22改訂: 防衛回数・通算勝率は表示上の参考情報として引き続き算出・
// 保持するが、順位には使わない(王者どうしの序列も含め、全員を同じzスコア
// 1本で比較する設計に変更したため)。防衛回数データが無い王者は取得不能を
// 明示フラグする(0埋め・推定は禁止、championDefenses.ts参照)。
export function buildChampionEntries(
  championRawRatings: ChampionRawRatingInput[],
  championRecords: Map<string, { record: RankingEntryRecord; lastFight: string | null }>,
  defenseData: ChampionDefenseEntry[],
  challengerStats: Map<MnewsDivision, { mean: number; sigma: number }>
): { champions: ChampionTierEntry[]; defenseDataIssues: string[] } {
  const defenseBySlug = new Map(defenseData.map((d) => [d.slug, d]));
  const issues: string[] = [];
  const champions: ChampionTierEntry[] = [];
  for (const champ of championRawRatings) {
    const recordInfo = championRecords.get(champ.slug);
    const record = recordInfo?.record ?? { wins: 0, losses: 0, draws: 0 };
    const winRate = record.wins + record.losses > 0 ? record.wins / (record.wins + record.losses) : null;
    const defenseEntry = defenseBySlug.get(champ.slug);
    if (!defenseEntry) {
      issues.push(`${champ.division}:${champ.slug} — 防衛回数データが championDefenses.ts に見つからず(取得不能として扱う)`);
    }
    const s = challengerStats.get(champ.division);
    const scoreA = s && s.sigma !== 0 ? (champ.rawRating - s.mean) / s.sigma : 0;
    champions.push({
      slug: champ.slug,
      division: champ.division,
      record,
      lastFight: recordInfo?.lastFight ?? null,
      winRate,
      defenseCount: defenseEntry?.defenseCount ?? null,
      scoreA,
    });
  }
  return { champions, defenseDataIssues: issues };
}

// 前回のp4p.jsonとの▲▼(順位番号)差分。既存の階級別ランキングの
// computeRankPositionDeltas(rankPositionDelta.ts)と同じ「rank番号だけを比較する
// 純粋関数」という設計を踏襲する(スコア再計算には一切関与しない)。
export function computeP4PRankPositionDeltas(
  currentEntries: P4PEntry[],
  prev: P4PFile | null
): Map<string, P4PRankPositionDelta> {
  const out = new Map<string, P4PRankPositionDelta>();
  if (!prev) {
    for (const e of currentEntries) out.set(e.fighterId, { kind: "same", positions: 0 });
    return out;
  }
  const prevRankByFighter = new Map(prev.entries.map((e) => [e.fighterId, e.p4pRank]));
  for (const e of currentEntries) {
    const prevRank = prevRankByFighter.get(e.fighterId);
    if (prevRank === undefined) {
      out.set(e.fighterId, { kind: "new", positions: 0 });
      continue;
    }
    const diff = prevRank - e.p4pRank;
    if (diff > 0) out.set(e.fighterId, { kind: "up", positions: diff });
    else if (diff < 0) out.set(e.fighterId, { kind: "down", positions: -diff });
    else out.set(e.fighterId, { kind: "same", positions: 0 });
  }
  return out;
}

export interface BuildP4PFileInput {
  rankings: RankingsFile;
  championRawRatings: ChampionRawRatingInput[]; // scripts/generate-p4p.ts側のエンジン読み取り専用再計算で取得
  defenseData: ChampionDefenseEntry[];
  updatedAt: string; // ISO(壁時計非依存にするため呼び出し側から渡す)
  algorithmVersion: number;
}

// data/rankings.jsonの各階級champion overlay(record/lastFightは既に格納済み。
// rawRatingだけがoverlayに無いためscripts/generate-p4p.ts側の再計算で補う)。
function collectChampionRecords(rankings: RankingsFile): Map<string, { record: RankingEntryRecord; lastFight: string | null }> {
  const out = new Map<string, { record: RankingEntryRecord; lastFight: string | null }>();
  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const champion = rankings[key]?.champion;
    if (champion && champion.record) {
      out.set(champion.fighterId, { record: champion.record, lastFight: champion.lastFight });
    }
  }
  return out;
}

// P4Pファイル本体を構築する(2026-07-22改訂: 王者ティア固定を撤回。全員を
// 同じドミナンスzスコア1本でフラットに並べる。挑戦者はclamp後のスコアを
// 使うため、同一階級内の公開rank順は引き続き逆転しない。王者はclamp対象外
// [公開rankという概念を持たないため]で、生のzスコアのままグローバル順位に
// 参加する=場合によっては挑戦者より下位に来ることもある、という仕様変更)。
export function buildP4PFile(input: BuildP4PFileInput): P4PFile {
  const challengerCandidates = collectChallengerCandidates(input.rankings);
  const stats = divisionStats(challengerCandidates, input.championRawRatings);
  const scoredChallengers = scoreAndClampChallengers(challengerCandidates, stats);
  const championRecords = collectChampionRecords(input.rankings);
  const { champions, defenseDataIssues } = buildChampionEntries(input.championRawRatings, championRecords, input.defenseData, stats);

  const combined: P4PEntry[] = [
    ...champions.map((c) => ({
      fighterId: c.slug,
      division: c.division,
      p4pRank: 0, // 後で振り直す
      divisionRank: "champion" as const,
      tier: "champion" as const,
      defenseCount: c.defenseCount,
      record: c.record,
      lastFight: c.lastFight,
      rankPositionDelta: null,
      internalScore: c.scoreA,
    })),
    ...scoredChallengers.map((c) => ({
      fighterId: c.slug,
      division: c.division,
      p4pRank: 0,
      divisionRank: c.divisionRank,
      tier: "challenger" as const,
      defenseCount: null,
      record: c.record,
      lastFight: c.lastFight,
      rankPositionDelta: null,
      internalScore: c.clampedScore,
    })),
  ];
  // 全員を同じinternalScore(ドミナンスzスコア、挑戦者はclamp後)で降順ソート。
  // 同点タイブレーク: まず階級内順位(公開rank、王者は0扱い)昇順。clampは
  // 意図的に同点(スコアが直前値まで引き下げられる)を作るため、同一階級内の
  // 同点をfighterId(アルファベット順)で解決すると公開rank順が壊れ、
  // verifyDivisionOrderInvariantが破れる。階級内順位で解決すれば同一階級内は
  // 常に公開rank順のまま、異なる階級間の同点はどちらが先でも不変条件に影響
  // しないため、最後にfighterIdで完全決定的にする。
  const entries = combined.sort((a, b) => {
    if (b.internalScore !== a.internalScore) return b.internalScore - a.internalScore;
    const rankA = a.divisionRank === "champion" ? 0 : a.divisionRank;
    const rankB = b.divisionRank === "champion" ? 0 : b.divisionRank;
    if (rankA !== rankB) return rankA - rankB;
    return a.fighterId.localeCompare(b.fighterId);
  });
  entries.forEach((e, i) => {
    e.p4pRank = i + 1;
  });

  return {
    updatedAt: input.updatedAt,
    algorithmVersion: input.algorithmVersion,
    entries,
    defenseDataIssues,
  };
}

// ===== 自己検証(scripts/generate-p4p.ts側で呼び出し、破れたらexit 1) =====
//
// 2026-07-22改訂: 王者ティア固定を撤回したため、「王者が先頭N件を占める」
// という不変条件は無くなった(王者が挑戦者より下位に来るのは仕様どおり)。
// 代わりに「全公開階級の王者が必ずentriesに1件ずつ存在すること」(算出できな
// かった王者が黙って消えていないか)を確認する。

// 1. rawRatingを算出できた王者が、全員entriesに含まれていること(位置は問わない)。
export function verifyAllChampionsPresent(file: P4PFile, expectedChampionSlugs: string[]): string[] {
  const errors: string[] = [];
  const presentSlugs = new Set(file.entries.filter((e) => e.tier === "champion").map((e) => e.fighterId));
  for (const slug of expectedChampionSlugs) {
    if (!presentSlugs.has(slug)) errors.push(`王者${slug}がentriesに存在しない(消失の疑い)`);
  }
  if (presentSlugs.size !== expectedChampionSlugs.length) {
    errors.push(`王者tierの件数が期待値と不一致(期待: ${expectedChampionSlugs.length} / 実際: ${presentSlugs.size})`);
  }
  return errors;
}

// 2. 同一階級内のP4P順序 == 階級別公開rank順(逆転ゼロ)。王者は対象外。
export function verifyDivisionOrderInvariant(file: P4PFile): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, P4PEntry[]>();
  for (const e of file.entries) {
    if (e.tier === "champion") continue;
    if (!byDivision.has(e.division)) byDivision.set(e.division, []);
    byDivision.get(e.division)!.push(e);
  }
  for (const [division, list] of byDivision) {
    const byPublicRank = [...list].sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number)).map((e) => e.fighterId);
    const byP4PRank = [...list].sort((a, b) => a.p4pRank - b.p4pRank).map((e) => e.fighterId);
    if (JSON.stringify(byPublicRank) !== JSON.stringify(byP4PRank)) {
      errors.push(`${division}: P4P順序が公開rank順と不一致(逆転を検出)`);
    }
  }
  return errors;
}

// 3. 非公開階級の選手が一切出ないこと(候補プールをPUBLISHED_DIVISIONSのみから
// 組み立てている以上構造的に満たすはずだが、将来の改修による混入を防ぐ最終防衛)。
export function verifyPublishedDivisionsOnly(file: P4PFile): string[] {
  const errors: string[] = [];
  for (const e of file.entries) {
    if (!PUBLISHED_DIVISIONS.includes(e.division)) {
      errors.push(`${e.fighterId}: 非公開階級(${e.division})のエントリが混入`);
    }
  }
  return errors;
}

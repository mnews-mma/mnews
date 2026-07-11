// rankings.json の出力構造を組み立てる純関数群。I/O(fs)は持たない。
// 呼び出し側(scripts/update-mnews-rating.ts)がdata/fighterRecords.jsonと
// 前回のrankings.jsonを読み込み、ここへ渡す。
import { ALGORITHM_VERSION, CHAMPION_DISPLAY_MODE } from "./constants";
import { DisplayEntry } from "./engine";
import { DIVISION_SLUG, MnewsDivision } from "./divisions";

export interface RankingEntryRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface RankingEntry {
  fighterId: string;
  rank: number;
  rating: number;
  delta: number | null; // 前回バッチとの差分。初回(前回データ無し)はnull
  record: RankingEntryRecord;
  lastFight: string | null;
  weighInMiss: boolean;
  // CHAMPION_DISPLAY_MODE==="badge"時のみ、王者の行にtrueが付く。
  // "overlay"時は王者自体がentriesに含まれないため常にundefined。
  isChampion?: boolean;
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

// 掲載資格ありのdisplayEntryを階級ごとに束ね、レート降順で順位を振る。
// champion指定時(CHAMPION_DISPLAY_MODE==="overlay")は番号付きリストから
// 王者を除外し、別途championフィールドとして返す(UFC方式)。
export function buildDivisionRankings(
  division: MnewsDivision,
  eligibleEntries: Array<{ meta: FighterMeta; display: DisplayEntry }>,
  updatedAt: Date,
  prev: DivisionRankings | undefined,
  champion: ChampionOverlay | null
): DivisionRankings {
  const isBadgeMode = CHAMPION_DISPLAY_MODE === "badge";
  const prevRatingByFighter = new Map((prev?.entries ?? []).map((e) => [e.fighterId, e.rating]));

  const pool = isBadgeMode ? eligibleEntries : eligibleEntries.filter((e) => e.meta.slug !== champion?.fighterId);
  const sorted = [...pool].sort((a, b) => b.display.displayRating - a.display.displayRating);

  const entries: RankingEntry[] = sorted.map((e, i) => {
    const rating = Math.round(e.display.displayRating);
    const prevRating = prevRatingByFighter.get(e.meta.slug);
    return {
      fighterId: e.meta.slug,
      rank: i + 1,
      rating,
      delta: prevRating === undefined ? null : rating - prevRating,
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
  const prevIds = prev.entries.map((e) => e.fighterId).join(",");
  const currentIds = current.entries.map((e) => e.fighterId).join(",");
  if (prevIds !== currentIds) return true;
  return current.entries.some((e) => e.delta !== null && e.delta !== 0);
}

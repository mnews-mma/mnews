// 「ある階級の王者＋Eloコンテンダー」を組み立てる唯一の共有関数。
// ランキングページ(/rankings/[division]・/rankings)とトップページウィジェット
// (MnewsRatingSection)は、必ずこの関数経由でdata/rankings.jsonの
// DivisionRankingsから表示用データを取り出す(それぞれが独自に組み立てない)。
// 王者はentries(番号付きリスト)からは既にbuildDivisionRankings側で除外済み
// なので、ここでは「champion + entriesの先頭N件」を返すだけ。両者を必ず
// セットで返す型にすることで、片方だけを取り出して王者を出し忘れるドリフトを
// 構造的に防ぐ。
import type { DivisionRankings, ChampionOverlay, RankingEntry } from "./rankingsFile";

export interface DivisionRankingView {
  champion: ChampionOverlay | null;
  contenders: RankingEntry[];
}

// topN省略時は全件(ランキングページ本体用)。指定時は先頭N件(ウィジェット用)。
export function getDivisionRankingView(data: DivisionRankings | null | undefined, topN?: number): DivisionRankingView {
  if (!data) return { champion: null, contenders: [] };
  const contenders = topN !== undefined ? data.entries.slice(0, topN) : data.entries;
  return { champion: data.champion, contenders };
}

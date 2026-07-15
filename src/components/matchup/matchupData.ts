import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeFighterStripStats, computeWinRate } from "@/lib/fighterStrip";

export type Result = FighterRecordEntry["history"][number]["result"];

export interface TapeFighterData {
  slug?: string | null;
  name: string;
  nickname?: string;
  record: string;
  winRate: number | null;
  finishRate: number | null;
  last5?: Result[];
  methodCounts?: { ko: number; sub: number; decision: number };
  // このカードが表す試合そのものの決着マーク(◯✕△、events向け・確定結果がある場合のみ)。
  // last5(直近5戦の勝敗)とは別概念。
  resultMark?: "win" | "loss" | "draw";
}

// entry(FighterRecordEntry)から表示用データを組み立てる。既存の算出ロジック
// (computeFighterStripStats/computeWinRate)を再利用するのみで新規の数値生成はしない。
export function buildTapeData(
  name: string,
  slug: string | null | undefined,
  entry: FighterRecordEntry,
  opts?: {
    nickname?: string;
    withLast5?: boolean;
    withMethodCounts?: boolean;
    resultMark?: TapeFighterData["resultMark"];
  }
): TapeFighterData {
  const stats = computeFighterStripStats(entry);
  return {
    slug,
    name,
    nickname: opts?.nickname,
    record: stats.record,
    winRate: computeWinRate(entry),
    finishRate: stats.finishRate,
    last5: opts?.withLast5 ? stats.last5 : undefined,
    methodCounts: opts?.withMethodCounts ? { ko: entry.ko, sub: entry.sub, decision: entry.decision } : undefined,
    resultMark: opts?.resultMark,
  };
}

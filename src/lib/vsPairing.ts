// /vs・/dream共通のペア正規化・索引可否判定(docs/instructions/vs-dream-merge-instructions.md準拠)。
import type { Fighter } from "./fighters";
import type { FighterRecordEntry } from "./fighterRecordsCache";
import { computeHeadToHead, computeCommonOpponents } from "./articleGenerator";

// 正規順 = スラッグの辞書順昇順(spec §1.2)。/vs/a/bと/vs/b/aの重複URLを許さない。
export function normalizeVsSlugs(slugA: string, slugB: string): { a: string; b: string; wasSwapped: boolean } {
  if (slugA <= slugB) return { a: slugA, b: slugB, wasSwapped: false };
  return { a: slugB, b: slugA, wasSwapped: true };
}

// noindex解除条件(spec §4): 過去対戦1回以上 / 共通対戦相手1人以上 / 同一団体かつ同一階級。
export function isVsPairIndexable(
  fighterA: Pick<Fighter, "org" | "weightClass" | "nameJa">,
  fighterB: Pick<Fighter, "org" | "weightClass" | "nameJa">,
  entryA: FighterRecordEntry,
  entryB: FighterRecordEntry
): boolean {
  if (fighterA.org === fighterB.org && fighterA.weightClass === fighterB.weightClass) return true;
  if (computeHeadToHead(entryA, fighterB.nameJa).length > 0) return true;
  if (computeCommonOpponents(entryA, entryB).length > 0) return true;
  return false;
}

// シェア文言(spec §3)。将来イベント連動時の差し替えに備え1箇所に集約する。
export function vsShareText(nameA: string, nameB: string): string {
  return `もし「${nameA} vs ${nameB}」が実現したら―― #夢のカード`;
}

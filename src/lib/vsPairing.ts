// /vs・/dream共通のペア正規化・索引可否判定(docs/instructions/vs-dream-merge-instructions.md準拠)。
import type { Fighter } from "./fighters";
import type { FighterRecordEntry } from "./fighterRecordsCache";
import { computeHeadToHead, computeCommonOpponents } from "./articleGenerator";
import { findMatchupEvent } from "./events";

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
// 架空カード(夢のカード)用のデフォルト文言。
export function vsShareText(nameA: string, nameB: string): string {
  return `もし「${nameA} vs ${nameB}」が実現したら―― #夢のカード`;
}

// spec §3で予告されていた「将来イベント連動時の差し替え」を実装したもの(旧PR#28の
// 運用フィードバック: 実際に組まれている大会の対戦カードを「もし実現したら」と
// 仮定形で投稿するのは実態と合わない、との指摘)。
// findMatchupEvent()で開催予定大会の実カードと一致すれば【大会名_注目カード】タグを
// 冒頭に付けた実況調の文言にし、一致しなければ従来の夢のカード文言にフォールバックする。
export function buildVsShareText(nameA: string, nameB: string): string {
  const matchup = findMatchupEvent(nameA, nameB);
  if (matchup) return `【${matchup.event.eventName}_注目カード】${nameA} vs ${nameB}`;
  return vsShareText(nameA, nameB);
}

// /dream(夢のカード)専用のシェア文言。ユーザーが自由入力した大会名を
// 常に「もし実現したら」の仮定形で扱う(実在イベントとの自動一致判定=
// findMatchupEventは使わない。夢のカードは本質的に仮定であり、実在大会名を
// 入れても実況調に切り替えない=buildVsShareTextとは意図的に別ロジック)。
// 階級はシェア文言には含めない(カード本体で表示するため)。
export function buildDreamShareText(nameA: string, nameB: string, eventName?: string): string {
  if (eventName) return `もし${eventName}で「${nameA} vs ${nameB}」が実現したら―― #夢のカード`;
  return vsShareText(nameA, nameB);
}

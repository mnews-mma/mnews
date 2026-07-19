// A-4(2026-07-18)追加: 「▲▼順位変動」の後処理パイプライン。
//
// 重要な制約: v9のMレーティングのスコア計算ロジック(engine.ts)・共通対戦相手
// (H2H)ロジック(monotonicity.ts)・ランキング資格判定(eligibilityRules.ts)には
// 一切関与しない。ここで扱うのはbuildDivisionRankings()が既に確定させた
// DivisionRankings(rank済みのentries)を入力として受け取り、前回スナップショット
// との「順位番号(rank)」の比較だけを行う純粋関数。scripts/update-mnews-rating.ts
// から、buildDivisionRankings呼び出し・全自己検証(H2H不変条件等)が完了した後の
// 最終段階でのみ呼び出す(スコア確定前には一切介入しない)。
import type { DivisionRankings } from "./rankingsFile";

export type RankPositionDeltaKind = "up" | "down" | "same" | "new" | "nr";

export interface RankPositionDelta {
  kind: RankPositionDeltaKind;
  // up/downの移動量(何個順位が動いたか)。same/newは常に0。
  positions: number;
}

const SAME: RankPositionDelta = { kind: "same", positions: 0 };
const NEW: RankPositionDelta = { kind: "new", positions: 0 };

// current(今回のランキング結果)のfighterIdごとに、prev(前回のランキング結果)
// との順位番号(rank)差分を算出する。
//
// - prev自体が存在しない(初回実行・まだ一度もスナップショットが無い)場合は、
//   指示どおり全選手を「変動なし」(same/—)として扱う("new"にはしない。
//   "NEW"は「前回の掲載リストに実在しなかった」ことを示す表示のため、
//   比較対象となる前回リストが無い初回とは意味が異なる)。
// - prevは存在するが、そのfighterIdがprev.entriesに無い場合は "new"(NEW表示)。
// - 両方に存在する場合はrankの差(前回rank - 今回rank)で up/down/same を判定する
//   (rank番号が小さいほど上位のため、前回より小さくなった=上昇)。
export function computeRankPositionDeltas(
  current: DivisionRankings,
  prev: DivisionRankings | undefined
): Map<string, RankPositionDelta> {
  const out = new Map<string, RankPositionDelta>();
  if (!prev) {
    for (const e of current.entries) out.set(e.fighterId, SAME);
    return out;
  }
  const prevRankByFighter = new Map(prev.entries.map((e) => [e.fighterId, e.rank]));
  for (const e of current.entries) {
    const prevRank = prevRankByFighter.get(e.fighterId);
    if (prevRank === undefined) {
      out.set(e.fighterId, NEW);
      continue;
    }
    const diff = prevRank - e.rank; // 正の値 = 順位番号が小さくなった = 上昇
    if (diff > 0) out.set(e.fighterId, { kind: "up", positions: diff });
    else if (diff < 0) out.set(e.fighterId, { kind: "down", positions: -diff });
    else out.set(e.fighterId, SAME);
  }
  return out;
}

// 表示用ラベル(▲n / ▼n / — / NEW)。数値そのものを捏造しない(未算出時は必ず—)。
export function formatRankPositionDelta(d: RankPositionDelta | null | undefined): string {
  if (!d) return "—";
  switch (d.kind) {
    case "new":
      return "NEW";
    case "nr":
      return "NR";
    case "same":
      return "—";
    case "up":
      return `▲${d.positions}`;
    case "down":
      return `▼${d.positions}`;
  }
}

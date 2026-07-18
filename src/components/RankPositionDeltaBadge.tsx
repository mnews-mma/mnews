// A-4(2026-07-18)追加: 「▲▼順位変動」表示。RankingDelta(レート点数の差分)とは
// 別の概念で、こちらは前回スナップショットとの「順位番号(何位から何位へ)」の
// 差分を表示する。数値は必ずrankPositionDelta.tsの後処理パイプラインから来た
// 値のみを使い、ここでは一切算出・捏造しない(未算出/前回データ無しは常に—)。
import { SUPPRESS_RANKING_MOVEMENT } from "@/lib/mnewsRating/rankingMovementGate";

export interface RankPositionDeltaValue {
  kind: "up" | "down" | "same" | "new";
  positions: number;
}

export default function RankPositionDeltaBadge({ delta }: { delta: RankPositionDeltaValue | null | undefined }) {
  // 一時ゲート(2026-07-18): 手動追加に伴う挿入シフトを成績変動と誤読させないため、
  // 明日のLANDMARK 15結果反映まで順位変動表示を一律「—」に固定する(rankingMovementGate.ts)。
  if (SUPPRESS_RANKING_MOVEMENT || !delta || delta.kind === "same") {
    return (
      <span style={{ color: "var(--muted)", fontSize: 11 }} title="前回から順位変動なし">
        —
      </span>
    );
  }
  if (delta.kind === "new") {
    return (
      <span style={{ color: "#b45309", fontWeight: 700, fontSize: 11 }} title="今回新規ランクイン">
        NEW
      </span>
    );
  }
  if (delta.kind === "up") {
    return (
      <span style={{ color: "#1a7a3c", fontWeight: 700 }} title={`前回から${delta.positions}位上昇`}>
        ▲{delta.positions}
      </span>
    );
  }
  return (
    <span style={{ color: "#1a5fb4", fontWeight: 700 }} title={`前回から${delta.positions}位下降`}>
      ▼{delta.positions}
    </span>
  );
}

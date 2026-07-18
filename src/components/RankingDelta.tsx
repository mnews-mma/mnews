// 前回バッチとのレート差分(▲上昇/▼下降/→変動なし/初回はハイフン)。
// 数値そのものが「機関としての鮮度シグナル」なので、算出できない場合に
// 0やダミー値で埋めない(捏造ゼロ)。
import { SUPPRESS_RANKING_MOVEMENT } from "@/lib/mnewsRating/rankingMovementGate";

export default function RankingDelta({ delta }: { delta: number | null }) {
  // 一時ゲート(2026-07-18): ズールー/中島の手動追加でElo再計算が対戦相手へ波及した
  // レート差分(▲1/▲6)を成績変動と誤読させないため、明日のLANDMARK 15結果反映まで
  // 前回比表示を一律「—」に固定する(rankingMovementGate.ts)。
  if (SUPPRESS_RANKING_MOVEMENT) {
    return (
      <span style={{ color: "var(--muted)", fontSize: 11 }} title="順位更新待ち（明日の大会結果反映後に前回比を再開）">
        —
      </span>
    );
  }
  if (delta === null) {
    return (
      <span style={{ color: "var(--muted)", fontSize: 11 }} title="初回掲載">
        —
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span style={{ color: "var(--muted)" }} title="前回から変動なし">
        →
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span style={{ color: "#1a7a3c", fontWeight: 700 }} title={`前回比 +${delta}`}>
        ▲{delta}
      </span>
    );
  }
  return (
    <span style={{ color: "#1a5fb4", fontWeight: 700 }} title={`前回比 ${delta}`}>
      ▼{Math.abs(delta)}
    </span>
  );
}

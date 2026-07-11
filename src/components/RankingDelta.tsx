// 前回バッチとのレート差分(▲上昇/▼下降/→変動なし/初回はハイフン)。
// 数値そのものが「機関としての鮮度シグナル」なので、算出できない場合に
// 0やダミー値で埋めない(捏造ゼロ)。
export default function RankingDelta({ delta }: { delta: number | null }) {
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

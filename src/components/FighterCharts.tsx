"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import type { MethodCounts, RecordTrendPoint } from "@/lib/fighterStrip";

// 既存の選手ページの決着内訳バー(.fbar-ko/.fbar-sub/.fbar-dec)と同じ配色に揃える
// (globals.css参照。新規の色は追加しない)。
const COLOR_KO = "#dc2626";
const COLOR_SUB = "#ea580c";
const COLOR_DEC = "#9ca3af";
// 既存の勝敗表示(.result-win/.result-loss)と同じ配色。
const COLOR_WIN = "#16a34a";
const COLOR_LOSS = "#dc2626";

const METHOD_LABELS: Record<keyof MethodCounts, string> = {
  ko: "KO",
  sub: "一本",
  decision: "判定",
  other: "その他",
};

function methodPieData(counts: MethodCounts) {
  return (["ko", "sub", "decision"] as const)
    .map((k) => ({ name: METHOD_LABELS[k], value: counts[k], key: k }))
    .filter((d) => d.value > 0);
}

const METHOD_COLOR: Record<string, string> = { ko: COLOR_KO, sub: COLOR_SUB, decision: COLOR_DEC };

// 決着内訳(勝ち/負けそれぞれのKO・一本・判定比率)。負けが0件(無敗選手)の場合は
// 負け側のグラフを出さない(空グラフを描かない)。
export function FinishBreakdownChart({
  winCounts,
  lossCounts,
}: {
  winCounts: MethodCounts;
  lossCounts: MethodCounts | null;
}) {
  const winData = methodPieData(winCounts);
  const lossData = lossCounts ? methodPieData(lossCounts) : [];
  if (winData.length === 0 && lossData.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
      {winData.length > 0 && (
        <div style={{ flex: 1, minWidth: 140, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>勝ちの内訳</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={winData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={55} isAnimationActive={false}>
                {winData.map((d) => (
                  <Cell key={d.key} fill={METHOD_COLOR[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}件`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {lossData.length > 0 && (
        <div style={{ flex: 1, minWidth: 140, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>負けの内訳</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={lossData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={55} isAnimationActive={false}>
                {lossData.map((d) => (
                  <Cell key={d.key} fill={METHOD_COLOR[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}件`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// 勝率・フィニッシュ率・KO率・一本率・判定率(数値+横棒)。nullの項目は行ごと出さない。
export function RateBars({
  rates,
}: {
  rates: { label: string; value: number | null }[];
}) {
  const data = rates.filter((r): r is { label: string; value: number } => r.value !== null);
  if (data.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <ResponsiveContainer width="100%" height={data.length * 32 + 10}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <Bar
            dataKey="value"
            fill="var(--accent)"
            radius={[0, 3, 3, 0]}
            barSize={14}
            isAnimationActive={false}
            label={{ position: "right", formatter: (v: unknown) => (v == null ? "" : `${v}%`), fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 戦績推移(通算勝敗の累積、日付昇順)。1件も試合が無い場合はnullを渡して非表示にする。
export function RecordTrendChart({ trend }: { trend: RecordTrendPoint[] }) {
  if (trend.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={trend} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={24} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} width={28} />
        <Tooltip />
        <Line type="stepAfter" dataKey="wins" name="通算勝ち" stroke={COLOR_WIN} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="losses" name="通算負け" stroke={COLOR_LOSS} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

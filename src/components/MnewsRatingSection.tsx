"use client";

import { useState } from "react";
import RankingDelta from "@/components/RankingDelta";

interface RatingEntry {
  fighterId: string;
  rank: number;
  delta: number | null;
}

interface ChampionEntry {
  fighterId: string;
}

interface DivisionView {
  champion: ChampionEntry | null;
  contenders: RatingEntry[];
}

const DIVISIONS = ["フライ級", "バンタム級", "フェザー級", "ライト級"] as const;
type Division = (typeof DIVISIONS)[number];

// トップページのAI RIZINランキング(独自算出)セクション。4階級ぶんの
// {champion, contenders}をサーバー側(getDivisionRankingView経由)で取得済みで
// 受け取り、階級切替はクライアント側のstate切り替えのみ(追加fetch無し)で行う。
// デフォルトはフェザー級。ランキングページ本体と同じ共有セレクタ由来のデータ
// なので、王者行の有無・並びが常に一致する(ここで独自に組み立てない)。
// レート数値は外向き表示に出さない方針のため、順位・選手名・戦績・前回比のみ
// 表示する(値自体もtoClientSafeDivisionRankingViewでprops化前に除去済み)。
export default function MnewsRatingSection({
  divisions,
  nameBySlug,
}: {
  divisions: Record<Division, DivisionView>;
  nameBySlug: Record<string, string>;
}) {
  const [division, setDivision] = useState<Division>("フェザー級");
  const view = divisions[division] ?? { champion: null, contenders: [] };

  if (!DIVISIONS.some((d) => (divisions[d]?.contenders.length ?? 0) > 0 || divisions[d]?.champion)) return null;

  return (
    <section className="rail-panel">
      <div
        className="rail-head"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
      >
        <span>AI RIZINランキング</span>
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value as Division)}
          style={{ fontSize: 12, padding: "4px 8px" }}
        >
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      {view.contenders.length > 0 || view.champion ? (
        <div className="rail-list">
          {view.champion && (
            <a href={`/fighters/${view.champion.fighterId}`} className="rail-item">
              <div className="rail-item-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--gold, #c29a4b)" }}>王者</span>
                <span style={{ flex: 1 }}>{nameBySlug[view.champion.fighterId] ?? view.champion.fighterId}</span>
                <RankingDelta delta={null} />
              </div>
            </a>
          )}
          {view.contenders.map((e) => (
            <a key={e.fighterId} href={`/fighters/${e.fighterId}`} className="rail-item">
              <div className="rail-item-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: e.rank <= 3 ? "var(--accent)" : "var(--muted)" }}>
                  {e.rank}
                </span>
                <span style={{ flex: 1 }}>{nameBySlug[e.fighterId] ?? e.fighterId}</span>
                <RankingDelta delta={e.delta} />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>この階級のデータは準備中です。</p>
      )}
      <a href="/rankings" className="rail-more">
        全ランキングを見る →
      </a>
    </section>
  );
}

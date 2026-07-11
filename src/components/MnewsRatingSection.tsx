"use client";

import { useState } from "react";
import RankingDelta from "@/components/RankingDelta";

interface RatingEntry {
  fighterId: string;
  rank: number;
  rating: number;
  delta: number | null;
}

const DIVISIONS = ["フライ級", "バンタム級", "フェザー級", "ライト級"] as const;
type Division = (typeof DIVISIONS)[number];

// トップページのMnewsRIZINレーティング(独自算出)セクション。4階級ぶんの
// トップ5をサーバー側で取得済みで受け取り、階級切替はクライアント側の
// state切り替えのみ(追加fetch無し)で行う。デフォルトはフェザー級。
export default function MnewsRatingSection({
  divisions,
  nameBySlug,
}: {
  divisions: Record<Division, RatingEntry[]>;
  nameBySlug: Record<string, string>;
}) {
  const [division, setDivision] = useState<Division>("フェザー級");
  const entries = divisions[division] ?? [];

  if (!DIVISIONS.some((d) => (divisions[d] ?? []).length > 0)) return null;

  return (
    <section className="rail-panel">
      <div
        className="rail-head"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
      >
        <span>MnewsRIZINレーティング</span>
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
      {entries.length > 0 ? (
        <div className="rail-list">
          {entries.map((e) => (
            <a key={e.fighterId} href={`/fighters/${e.fighterId}`} className="rail-item">
              <div className="rail-item-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: e.rank <= 3 ? "var(--accent)" : "var(--muted)" }}>
                  {e.rank}
                </span>
                <span style={{ flex: 1 }}>{nameBySlug[e.fighterId] ?? e.fighterId}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>{e.rating}</span>
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

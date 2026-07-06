"use client";

import { useMemo, useState } from "react";
import { calcFighterRates } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import type { OrgTag, OrgTagKey } from "@/lib/orgTags";

// 団体フィルタ = 今回の4タグ(現ランカー/2026出場の実態ベース。既存公開選手には付かない)。
// UFCはタグ付与条件が未定のため今回スコープ外(フィルタに出さない)。並び順固定。
const TAG_OPTIONS: { key: OrgTagKey; label: string }[] = [
  { key: "rizin", label: "RIZIN" },
  { key: "deep", label: "DEEP" },
  { key: "pancrase", label: "パンクラス" },
  { key: "shooto", label: "修斗" },
];

const TAG_COLOR: Record<OrgTagKey, string> = {
  pancrase: SOURCES.pancrase.color,
  shooto: SOURCES.shooto.color,
  deep: SOURCES.deep.color,
  rizin: SOURCES.rizin.color,
};

const WEIGHT_OPTIONS = ["女子アトム級", "フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];

const WEIGHT_ORDER: Record<string, number> = {
  "フェザー級": 0,
  "フライ級": 1,
  "バンタム級": 2,
  "ライト級": 3,
  "女子アトム級": 4,
  "ヘビー級": 5,
};

export default function FighterFilterGrid({
  fighters,
  tagsBySlug = {},
}: {
  fighters: ResolvedFighter[];
  tagsBySlug?: Record<string, OrgTag[]>;
}) {
  const [weightClass, setWeightClass] = useState<string | null>(null);
  const [tag, setTag] = useState<OrgTagKey | null>(null);

  const filtered = useMemo(() => {
    return fighters
      .filter((f) => {
        if (weightClass && f.weightClass !== weightClass) return false;
        if (tag && !(tagsBySlug[f.slug] || []).some((t) => t.key === tag)) return false;
        return true;
      })
      .sort((a, b) => {
        const orgA = a.org === "ufc" ? 0 : 1;
        const orgB = b.org === "ufc" ? 0 : 1;
        if (orgA !== orgB) return orgA - orgB;
        const wa = WEIGHT_ORDER[a.weightClass] ?? 9;
        const wb = WEIGHT_ORDER[b.weightClass] ?? 9;
        return wa - wb;
      });
  }, [fighters, weightClass, tag, tagsBySlug]);

  return (
    <>
      <div className="fighter-filter-bar">
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">階級</span>
          <button
            className={`fighter-filter-chip ${weightClass === null ? "active" : ""}`}
            onClick={() => setWeightClass(null)}
          >
            すべて
          </button>
          {WEIGHT_OPTIONS.map((w) => (
            <button
              key={w}
              className={`fighter-filter-chip ${weightClass === w ? "active" : ""}`}
              onClick={() => setWeightClass(w)}
            >
              {w.replace("級", "")}
            </button>
          ))}
        </div>
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">団体</span>
          <button
            className={`fighter-filter-chip ${tag === null ? "active" : ""}`}
            onClick={() => setTag(null)}
          >
            すべて
          </button>
          {TAG_OPTIONS.map((t) => (
            <button
              key={t.key}
              className={`fighter-filter-chip ${tag === t.key ? "active" : ""}`}
              onClick={() => setTag(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fighter-grid">
        {filtered.map((f) => {
          const { winRate, finishRate } = calcFighterRates(f);
          return (
            <a
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="fighter-card"
              style={{ borderLeftColor: SOURCES[f.org].color }}
            >
              <div className="fighter-org" style={{ color: SOURCES[f.org].color }}>
                {SOURCES[f.org].label} / {f.weightClass}
              </div>
              <div className="fighter-name">{f.nameJa}</div>
              {f.nickname && <div className="fighter-card-nickname">「{f.nickname}」</div>}
              {(tagsBySlug[f.slug] || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0 2px" }}>
                  {tagsBySlug[f.slug].map((t) => (
                    <span
                      key={t.key}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        color: "#fff",
                        background: TAG_COLOR[t.key],
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.label}
                      {t.rank ? ` ${/^\d+$/.test(t.rank) ? t.rank + "位" : t.rank}` : ""}
                    </span>
                  ))}
                </div>
              )}
              <div className="fighter-record">
                {f.wins}-{f.losses}-{f.draws}
              </div>
              <div className="fighter-breakdown">
                KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
              </div>
              <div className="fighter-rates">
                {winRate !== null && <span>勝率 {winRate}%</span>}
                {finishRate !== null && <span>フィニッシュ率 {finishRate}%</span>}
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

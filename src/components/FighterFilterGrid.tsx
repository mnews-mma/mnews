"use client";

import { useMemo, useState } from "react";
import { calcFighterRates } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ResolvedFighter } from "@/lib/feeds/resolveFighter";

const ORG_OPTIONS: { key: "ufc" | "rizin"; label: string }[] = [
  { key: "ufc", label: "UFC" },
  { key: "rizin", label: "RIZIN" },
];

const WEIGHT_OPTIONS = ["女子アトム級", "フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];

const WEIGHT_ORDER: Record<string, number> = {
  "フェザー級": 0,
  "フライ級": 1,
  "バンタム級": 2,
  "ライト級": 3,
  "女子アトム級": 4,
  "ヘビー級": 5,
};

export default function FighterFilterGrid({ fighters }: { fighters: ResolvedFighter[] }) {
  const [org, setOrg] = useState<string | null>(null);
  const [weightClass, setWeightClass] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return fighters
      .filter((f) => {
        if (org && f.org !== org) return false;
        if (weightClass && f.weightClass !== weightClass) return false;
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
  }, [fighters, org, weightClass]);

  return (
    <>
      <div className="fighter-filter-bar">
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">団体</span>
          <button
            className={`fighter-filter-chip ${org === null ? "active" : ""}`}
            onClick={() => setOrg(null)}
          >
            すべて
          </button>
          {ORG_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`fighter-filter-chip ${org === o.key ? "active" : ""}`}
              onClick={() => setOrg(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
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

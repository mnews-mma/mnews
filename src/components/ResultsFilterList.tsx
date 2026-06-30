"use client";

import { useMemo, useState } from "react";
import { EventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";

const ORG_OPTIONS: { key: "rizin" | "deep" | "pancrase" | "shooto"; label: string }[] = [
  { key: "rizin", label: "RIZIN" },
  { key: "deep", label: "DEEP" },
  { key: "pancrase", label: "パンクラス" },
  { key: "shooto", label: "修斗" },
];

export default function ResultsFilterList({ events }: { events: EventResult[] }) {
  const [org, setOrg] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set(events.map((e) => e.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => (org ? e.org === org : true) && (year ? e.date.startsWith(year) : true));
  }, [events, org, year]);

  return (
    <>
      <div className="fighter-filter-bar">
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">団体</span>
          <button className={`fighter-filter-chip ${org === null ? "active" : ""}`} onClick={() => setOrg(null)}>
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
          <span className="fighter-filter-label">開催年</span>
          <button className={`fighter-filter-chip ${year === null ? "active" : ""}`} onClick={() => setYear(null)}>
            すべて
          </button>
          {years.map((y) => (
            <button
              key={y}
              className={`fighter-filter-chip ${year === y ? "active" : ""}`}
              onClick={() => setYear(y)}
            >
              {y}年
            </button>
          ))}
        </div>
      </div>

      <div className="results-list">
        {filtered.map((e) => (
          <a
            key={e.slug}
            href={`/results/${e.slug}`}
            className="results-list-item"
            style={{ borderLeftColor: SOURCES[e.org].color }}
          >
            <div className="org-tag" style={{ color: SOURCES[e.org].color }}>
              {SOURCES[e.org].label}
            </div>
            <div className="results-list-title">{e.eventName}</div>
            <div className="results-list-meta">
              {e.date}
              {e.venue && <span> ／ {e.venue}</span>}
            </div>
          </a>
        ))}
      </div>
    </>
  );
}

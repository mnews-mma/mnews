"use client";

import { useMemo, useState } from "react";
import { MEvent } from "@/lib/events";
import { SOURCES, SourceKey } from "@/lib/sources";

const ORG_OPTIONS: { key: SourceKey; label: string }[] = [
  { key: "rizin", label: SOURCES.rizin.label },
  { key: "deep", label: SOURCES.deep.label },
  { key: "pancrase", label: SOURCES.pancrase.label },
  { key: "shooto", label: SOURCES.shooto.label },
];

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export default function EventsFilterList({ events }: { events: MEvent[] }) {
  const [org, setOrg] = useState<SourceKey | null>(null);

  // events は getUpcomingEvents() が返す開催日昇順の配列をそのままフィルタするだけで、
  // 新たなソートは行わない(挿入位置・ソート整合ルールに手を入れない)。
  const filtered = useMemo(() => {
    return events.filter((e) => (org ? e.org === org : true));
  }, [events, org]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      </div>

      <div className="results-list">
        {filtered.map((e, idx) => {
          const target = new Date(e.date);
          target.setHours(0, 0, 0, 0);
          const days = Math.round((target.getTime() - today.getTime()) / 86400000);
          const d = new Date(e.date);
          const dateJa = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAY_NAMES[d.getDay()]}）`;
          const nearest = idx === 0; // フィルタ後の先頭1件のみ赤で強調
          return (
            <a
              key={e.slug}
              href={`/events/${e.slug}`}
              className="results-list-item"
              style={{ borderLeftColor: SOURCES[e.org].color }}
            >
              <div className="org-tag" style={{ color: SOURCES[e.org].color }}>
                {SOURCES[e.org].label}
              </div>
              <div className="results-list-title">{e.eventName}</div>
              <div className="results-list-meta">
                {dateJa}
                {e.venue && <span> ／ {e.venue}</span>}
                <span className={nearest ? "rail-countdown-near" : "rail-countdown"}> — {days <= 0 ? "本日開催" : `あと${days}日`}</span>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

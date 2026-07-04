"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface RailEvent {
  slug: string;
  label: string;
  color: string;
  eventName: string;
  venue?: string;
  date: string; // YYYY-MM-DD
}

const DAY = ["日", "月", "火", "水", "木", "金", "土"];
// .home-rail(sticky top:64 + margin-top:12)＋下部余白ぶんを差し引く。
const RAIL_OFFSET = 96;
// 右レール化(=高さ収め)を有効にするビューポート幅。これ未満(スマホ/タブレット)は
// 下部に並ぶため収めない(全件表示)。
const RAIL_MIN_WIDTH = 1200;

export default function EventRail({ events }: { events: RailEvent[] }) {
  const headRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLAnchorElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // リストの最大高さ(px)。undefined=制限なし(全件)。item境界に丸めるので途中で切れない。
  const [listMax, setListMax] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    function measure() {
      // 右レールにならない幅では収めない(全件表示)
      if (window.innerWidth < RAIL_MIN_WIDTH) {
        setListMax(undefined);
        return;
      }
      const headH = headRef.current?.offsetHeight ?? 0;
      const moreH = moreRef.current?.offsetHeight ?? 0;
      const available = window.innerHeight - RAIL_OFFSET - headH - moreH;
      // 全itemは常にDOMにあるため offsetHeight は常に有効(隠さないので測定が安定)。
      let sum = 0;
      let fit = 0;
      for (let i = 0; i < events.length; i++) {
        const h = itemRefs.current[i]?.offsetHeight ?? 0;
        if (fit > 0 && sum + h > available) break; // 溢れる→ここまで(最低1件は残す)
        sum += h;
        fit++;
      }
      // item境界(累積高さ)でリストを丸める→途中で切れない。全件収まる場合は制限なし。
      setListMax(fit >= events.length ? undefined : sum);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="rail-panel">
      <div className="rail-head" ref={headRef}>
        開催予定の大会
      </div>
      <div
        className="rail-list"
        ref={listRef}
        style={listMax !== undefined ? { maxHeight: listMax, overflow: "hidden" } : undefined}
      >
        {events.map((e, idx) => {
          const target = new Date(e.date);
          target.setHours(0, 0, 0, 0);
          const days = Math.round((target.getTime() - today.getTime()) / 86400000);
          const d = new Date(e.date);
          const dateJa = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAY[d.getDay()]}）`;
          const nearest = idx === 0; // 最も近い1件のみ赤で強調
          return (
            <a
              key={e.slug}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              href={`/events/${e.slug}`}
              className="rail-item"
              style={{ borderLeftColor: e.color }}
            >
              <div className="rail-item-org" style={{ color: e.color }}>
                {e.label}
              </div>
              <div className="rail-item-title">{e.eventName}</div>
              <div className="rail-item-meta">
                {dateJa}
                {e.venue && <span> ／ {e.venue}</span>}
                <span className={nearest ? "rail-countdown-near" : "rail-countdown"}> — あと{days}日</span>
              </div>
            </a>
          );
        })}
      </div>
      <a href="/events" className="rail-more" ref={moreRef}>
        すべての大会を見る →
      </a>
    </div>
  );
}

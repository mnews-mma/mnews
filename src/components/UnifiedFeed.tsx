"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FeedArticle } from "@/lib/newsClassify";
import { relativeTimeJa } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";

type Filter = "all" | "official" | "media";

const CHIPS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "official", label: "公式" },
  { key: "media", label: "メディア" },
];

// 公式カードの団体バッジ。「○○公式」表記(団体カラー)で1つに集約する。
function officialBadge(source: FeedArticle["source"]) {
  const s = SOURCES[source];
  if (!s) return null;
  return (
    <span className="uf-org" style={{ background: s.color, color: "#fff" }}>
      {s.label}公式
    </span>
  );
}

const DAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

// detected_at(ISO) → JSTの暦日キー(YYYY-MM-DD)
function jstDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
function dayLabel(key: string, todayKey: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = DAY_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${m}月${d}日(${dow})`;
  return key === todayKey ? `今日 · ${base}` : base;
}

// 通常カード / 速報カード
function FeedCard({ a }: { a: FeedArticle }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`uf-card${a.flash ? " uf-flash" : ""}`}
    >
      <div className="uf-meta">
        {a.flash && <span className="uf-b-flash">速報</span>}
        {a.kind === "official" ? (
          officialBadge(a.source)
        ) : (
          <span className="uf-b-media">メディア</span>
        )}
        <span className="uf-time">{relativeTimeJa(a.publishedAt)}</span>
      </div>
      <h3 className="uf-title">{a.title}</h3>
      {a.kind === "media" && <div className="uf-src">via {a.origin}</div>}
    </a>
  );
}

export default function UnifiedFeed({ articles }: { articles: FeedArticle[] }) {
  const sp = useSearchParams();
  const initial = ((sp.get("f") as Filter) || "all") as Filter;
  const [filter, setFilter] = useState<Filter>(
    CHIPS.some((c) => c.key === initial) ? initial : "all"
  );

  function selectFilter(f: Filter) {
    setFilter(f);
    // ページ遷移なしでURLクエリだけ同期（直リンク・シェアで再現可能に）
    const url = f === "all" ? window.location.pathname : `${window.location.pathname}?f=${f}`;
    window.history.replaceState(null, "", url);
  }

  const filtered = articles.filter((a) => filter === "all" || a.kind === filter);
  const todayKey = jstDayKey(new Date().toISOString());

  // 日付でグルーピング（detected_at降順は入力側で確定済み）
  const days: { key: string; items: FeedArticle[] }[] = [];
  for (const a of filtered) {
    const key = jstDayKey(a.publishedAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(a);
    else days.push({ key, items: [a] });
  }

  return (
    <div className="uf">
      <div className="uf-chips" role="tablist" aria-label="フィード絞り込み">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={filter === c.key}
            className={`uf-chip${filter === c.key ? " on" : ""}`}
            onClick={() => selectFilter(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="uf-feed">
        {days.length === 0 && <div className="uf-empty">該当する記事がありません</div>}
        {days.map(({ key, items }) => (
          <div key={key}>
            <div className="uf-day">
              <span>{dayLabel(key, todayKey)}</span>
            </div>
            {items.map((a) => (
              <FeedCard key={a.id} a={a} />
            ))}
          </div>
        ))}
        {days.length > 0 && (
          <a href="/archive" className="uf-more">
            過去の記事 →
          </a>
        )}
      </div>
    </div>
  );
}

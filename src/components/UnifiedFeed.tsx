"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FeedArticle } from "@/lib/newsClassify";
import { relativeTimeJa } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";

type Filter = "all" | "official" | "media" | "original";

const CHIPS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "official", label: "公式" },
  { key: "media", label: "メディア" },
  { key: "original", label: "オリジナル" },
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

// 通常カード / 速報カード / オリジナル記事カード。関連選手チップは外部リンク<a>の
// 外・兄弟要素として配置する(ネストアンカー禁止のため、<a>自体を<div>でラップする)。
// オリジナル記事(isOriginal)は/articles/[slug]への内部リンクのため、
// target="_blank"を付けない(サイト内遷移として扱う)。
function FeedCard({ a }: { a: FeedArticle }) {
  const chips = a.relatedFighters ?? [];
  const linkProps = a.isOriginal ? {} : { target: "_blank", rel: "noopener noreferrer" };
  return (
    <div className="uf-card-wrap">
      <a href={a.url} {...linkProps} className="uf-card">
        <div className="uf-meta">
          {a.isOriginal ? (
            <span className="article-original-badge">オリジナル</span>
          ) : a.kind === "official" ? (
            officialBadge(a.source)
          ) : (
            <span className="uf-b-media">メディア</span>
          )}
          <span className="uf-time">{relativeTimeJa(a.publishedAt)}</span>
        </div>
        <h3 className="uf-title">{a.title}</h3>
        {!a.isOriginal && a.kind === "media" && <div className="uf-src">via {a.origin}</div>}
      </a>
      {chips.length > 0 && (
        <div className="uf-related-chips">
          <span className="uf-related-label">関連:</span>
          {chips.map((c) => (
            <a key={c.slug} href={`/fighters/${c.slug}`} className="uf-related-chip">
              {c.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UnifiedFeed({
  feeds,
}: {
  // タブ(all/official/media/original)ごとに既にbuildFeed()済みのリスト。
  // コンポーネント側ではソース絞り込み・窓・上限の再計算は一切行わない
  // (単一ルールはlib/feed.tsのbuildFeed()に集約する)。
  feeds: Record<Filter, FeedArticle[]>;
}) {
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

  const filtered = feeds[filter] ?? [];
  // タブは記事有無に関わらず常に表示する(/archiveと統一)。
  const visibleChips = CHIPS;
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
      <div className="uf-section-label">新着ニュース</div>
      <div className="uf-chips" role="tablist" aria-label="フィード絞り込み">
        {visibleChips.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={filter === c.key}
            className={`uf-chip${c.key === "original" ? " uf-chip--original" : ""}${filter === c.key ? " on" : ""}`}
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
            ニュース一覧を見る →
          </a>
        )}
      </div>
    </div>
  );
}

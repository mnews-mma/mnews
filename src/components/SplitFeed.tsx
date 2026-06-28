"use client";

import { useState } from "react";
import { Article, relativeTimeJa, isRecent } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";

function NewsCard({ article, showBadge }: { article: Article; showBadge: boolean }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`card ${article.source}-card`}
    >
      <div className="card-head">
        {showBadge && (
          <span className={`source-badge sb-${article.source}`}>{SOURCES[article.source].label}</span>
        )}
        {isRecent(article.publishedAt) && <span className="new-badge">NEW</span>}
      </div>
      <div className="card-title">{article.title}</div>
      <div className="card-body">{article.summary ?? ""}</div>
      <div className="card-foot">
        <span className="card-origin">via {article.origin}</span>
        <span className="card-time">{relativeTimeJa(article.publishedAt)}</span>
      </div>
    </a>
  );
}

export default function SplitFeed({
  official,
  news,
}: {
  official: Article[];
  news: Article[];
}) {
  const [tab, setTab] = useState<"official" | "news">("news");

  return (
    <div className="split-layout">
      <div className="split-tabs">
        <button
          className={`split-tab${tab === "news" ? " active" : ""}`}
          onClick={() => setTab("news")}
        >
          ニュース
        </button>
        <button
          className={`split-tab${tab === "official" ? " active" : ""}`}
          onClick={() => setTab("official")}
        >
          公式発表
        </button>
      </div>

      <div className={`split-col${tab === "news" ? " split-col-active" : ""}`}>
        <div className="split-col-head split-col-head--news">
          <span className="fl-title">ニュース</span>
          <span className="fl-count">{news.length}件</span>
        </div>
        <div className="card-grid">
          {news.map((a) => (
            <NewsCard key={a.id} article={a} showBadge={false} />
          ))}
        </div>
      </div>

      <div className={`split-col${tab === "official" ? " split-col-active" : ""}`}>
        <div className="split-col-head split-col-head--official">
          <span className="fl-title">公式発表</span>
          <span className="fl-count">{official.length}件</span>
        </div>
        <div className="card-grid">
          {official.map((a) => (
            <NewsCard key={a.id} article={a} showBadge />
          ))}
        </div>
      </div>
    </div>
  );
}

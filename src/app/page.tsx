import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ARTICLES, Article, relativeTimeJa, isRecent } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";
import { FIGHTERS } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";

export const revalidate = 1800; // 30分おき自動更新（mnews-spec.md）

const TICKER_FALLBACK = [
  "RIZIN・UFC・修斗・DEEP・ONE FC・パンクラスの最新ニュースを自動収集中…",
];

function buildMixMeter(articles: Article[]) {
  const counts = new Map<SourceKey, number>();
  for (const a of articles) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
  const total = articles.length || 1;
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

function buildSourceTally(articles: Article[]) {
  const counts = new Map<string, number>();
  for (const a of articles) counts.set(a.origin, (counts.get(a.origin) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default async function HomePage() {
  const seedFallback = ARTICLES;
  let articles: Article[] = seedFallback;
  let live = false;
  try {
    const result = await fetchAllArticles();
    if (result.articles.length >= 6) {
      articles = result.articles;
      live = true;
    }
  } catch {
    // fall back to seed data below
  }

  const TICKER_ITEMS = live
    ? articles.slice(0, 6).map((a) => {
        const bare = a.title.replace(/^【[^】]+】\s*/, "");
        return `【${SOURCES[a.source].label}】${bare}`;
      })
    : TICKER_FALLBACK;
  const TRENDING = articles.slice(5, 10).map((a) => a.title);
  const MIX_METER = buildMixMeter(articles);
  const SOURCE_TALLY = buildSourceTally(articles);

  const [hero, ...rest] = articles;
  const heroSubs = rest.slice(0, 3);
  const feedItems = rest.slice(3, 11);
  const bottomItems = rest.slice(11, 15);

  return (
    <>
      <Nav />

      <div className="signal-bar">
        <div className="sig sig-rizin" />
        <div className="sig sig-ufc" />
        <div className="sig sig-shooto" />
        <div className="sig sig-deep" />
        <div className="sig sig-one" />
        <div className="sig sig-pancrase" />
      </div>

      <div className="ticker">
        <div className="ticker-label">● BREAKING</div>
        <div className="ticker-scroll">
          <div className="ticker-inner">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ display: "inline-flex", gap: 48 }}>
                <span>{item}</span>
                {i < TICKER_ITEMS.length * 2 - 1 && <span className="tick-sep">/</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="hero">
        <a href={hero.url} target="_blank" rel="noopener noreferrer" className="hero-main">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isRecent(hero.publishedAt, 1) && <span className="hero-tag">BREAKING</span>}
            <span className={`source-badge sb-${hero.source}`}>
              {SOURCES[hero.source].label}
            </span>
          </div>
          <h1 className="hero-title">{hero.title}</h1>
          {hero.summary && <p className="hero-body">{hero.summary}</p>}
          <div className="hero-meta">
            <span className="hero-source-name">via {hero.origin}</span>
            <span className="hero-time">{relativeTimeJa(hero.publishedAt)}</span>
          </div>
        </a>

        <div className="hero-stack">
          {heroSubs.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`hero-sub ${a.source}`}
            >
              <div className={`source-badge sb-${a.source}`} style={{ width: "fit-content" }}>
                {SOURCES[a.source].label}
              </div>
              <div className="sub-title">{a.title}</div>
              <div className="sub-meta">
                {a.origin} · {relativeTimeJa(a.publishedAt)}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-layout">
        <div className="feed">
          <div className="feed-label">
            <span className="fl-title">最新ニュース</span>
            <span className="fl-count">{articles.length}件</span>
            <div className="fl-live">
              <div className="live-dot" />
              自動更新中
            </div>
          </div>

          <div className="card-grid">
            {feedItems.map((a, i) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`card ${a.source}-card${i === 0 ? " wide" : ""}`}
              >
                <div className="card-head">
                  <span className={`source-badge sb-${a.source}`}>{SOURCES[a.source].label}</span>
                  {isRecent(a.publishedAt) && <span className="new-badge">NEW</span>}
                </div>
                <div className="card-title">{a.title}</div>
                {a.summary && <div className="card-body">{a.summary}</div>}
                <div className="card-foot">
                  <span className="card-origin">via {a.origin}</span>
                  <span className="card-time">{relativeTimeJa(a.publishedAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sb-block">
            <div className="sb-title">MIX METER — 今日の配信比率</div>
            <div className="mix-meter">
              {MIX_METER.map((m) => (
                <div className="mm-row" key={m.key}>
                  <span className="mm-label">{SOURCES[m.key].label}</span>
                  <div className="mm-track">
                    <div
                      className="mm-fill"
                      style={{ width: `${m.pct}%`, background: SOURCES[m.key].color }}
                    />
                  </div>
                  <span className="mm-val">{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sb-block">
            <div className="sb-title">配信元メディア</div>
            {SOURCE_TALLY.map((s) => (
              <div className="source-item" key={s.name}>
                <div className="si-color" style={{ background: "var(--dim)" }} />
                <span className="si-name">{s.name}</span>
                <span className="si-count">{s.count}記事</span>
                <span className="si-arrow">›</span>
              </div>
            ))}
          </div>

          <div className="sb-block">
            <div className="sb-title">その他の最新トピック</div>
            {TRENDING.map((t, i) => (
              <div className="trend-item" key={i}>
                <div className="trend-n">{i + 1}</div>
                <div className="trend-title">{t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM GRID */}
      <div className="bottom-grid">
        {bottomItems.map((a) => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className={`bg-card ${a.source}`}>
            <span className={`source-badge sb-${a.source}`}>{SOURCES[a.source].label}</span>
            <div className="bg-title">{a.title}</div>
            <div className="bg-meta">
              {a.origin} · {relativeTimeJa(a.publishedAt)}
            </div>
          </a>
        ))}
      </div>

      {/* FIGHTER SECTION */}
      <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
        <div className="fighter-section-head">
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: 3 }}>
            👤 主要選手 戦績まとめ
          </div>
          <a
            href="/fighters"
            style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}
          >
            全選手を見る →
          </a>
        </div>
        <div className="fighter-grid">
          {FIGHTERS.map((f) => (
            <a key={f.slug} href={`/fighters/${f.slug}`} className="fighter-card" style={{ borderLeftColor: SOURCES[f.org].color }}>
              <div className="fighter-org" style={{ color: SOURCES[f.org].color }}>
                {SOURCES[f.org].label} / {f.weightClass}
              </div>
              <div className="fighter-name">{f.nameJa}</div>
              <div className="fighter-record">
                {f.wins}-{f.losses}-{f.draws}
              </div>
              <div className="fighter-breakdown">
                KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
              </div>
            </a>
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
}

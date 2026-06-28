import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ARTICLES, Article, relativeTimeJa, isRecent } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { FIGHTERS } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { resolveFighters } from "@/lib/feeds/resolveFighter";

// 外部フィード取得をビルド時ではなくリクエスト時に行う。
// データ自体は fetch() の revalidate 設定により30分キャッシュされる。
export const dynamic = "force-dynamic";

const TICKER_FALLBACK = [
  "RIZIN・UFC・修斗・DEEP・ONE・パンクラスの最新ニュースを自動収集中…",
];

// トップページの「主要選手 戦績まとめ」には載せない選手スラッグ。
const HOMEPAGE_HIDDEN_FIGHTERS = new Set([
  "izawa-seika",
  "hagiwara-kyohei",
  "wakamatsu-yuma",
  "takeda-koji",
]);

export default async function HomePage() {
  const seedFallback = ARTICLES;
  let articles: Article[] = seedFallback;
  let live = false;

  const [articlesResult, allFighters] = await Promise.all([
    fetchAllArticles().catch(() => null),
    resolveFighters(FIGHTERS),
  ]);
  if (articlesResult && articlesResult.articles.length >= 6) {
    articles = articlesResult.articles;
    live = true;
  }
  const fighters = allFighters.filter((f) => !HOMEPAGE_HIDDEN_FIGHTERS.has(f.slug));

  const TICKER_ITEMS = live
    ? articles.slice(0, 6).map((a) => {
        const bare = a.title.replace(/^【[^】]+】\s*/, "");
        return `【${SOURCES[a.source].label}】${bare}`;
      })
    : TICKER_FALLBACK;

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
            {feedItems.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`card ${a.source}-card`}
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
          {fighters.map((f) => (
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

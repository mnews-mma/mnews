import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import UnifiedFeed from "@/components/UnifiedFeed";
import EventRail from "@/components/EventRail";
import SocialSection from "@/components/SocialSection";
import { ARTICLES, Article } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { FIGHTERS, calcFighterRates } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { fetchLatestOfficialVideos } from "@/lib/feeds/youtube";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { getUpcomingEvents } from "@/lib/events";
import { toFeedArticles } from "@/lib/newsClassify";
import { fetchFirstSeenMap, enrichFirstSeen } from "@/lib/firstSeen";
import { pageMetadata } from "@/lib/seo";
import { buildSportsEventLd, eventOgImageUrl } from "@/lib/eventJsonLd";

// 外部フィード取得をビルド時ではなくリクエスト時に行う。
// データ自体は fetch() の revalidate 設定により30分キャッシュされる。
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "日本MMAニュース速報 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の格闘技ニュースを随時更新。日本人MMA選手の戦績・試合結果も掲載。",
  path: "/",
});

// トップページの「主要選手 戦績まとめ」には元からの8名のみ表示する。
// それ以外（SEO目的で追加した選手）は /fighters 一覧と詳細ページのみ。
const HOMEPAGE_FIGHTER_SLUGS = new Set([
  "taira-tatsuro",
  "nakamura-rinya",
  "horiguchi-kyoji",
  "asakura-kai",
  "hiramoto-ren",
  "asakura-mikuru",
  "koike-kleber",
  "akimoto-kyoma",
]);

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mニュース",
  url: "https://www.mnews.jp",
  description: "RIZIN・DEEP・パンクラス・修斗の格闘技ニュースを随時更新。日本人MMA選手の戦績・試合結果も掲載。",
  publisher: {
    "@type": "NewsMediaOrganization",
    name: "Mニュース",
    url: "https://www.mnews.jp",
    logo: { "@type": "ImageObject", url: "https://www.mnews.jp/logo.png" },
    sameAs: ["https://x.com/mnews_mma"],
  },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://www.mnews.jp/archive?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export default async function HomePage() {
  let articles: Article[] = ARTICLES;

  const homepageFighters = FIGHTERS.filter((f) => HOMEPAGE_FIGHTER_SLUGS.has(f.slug));

  const [articlesResult, fighters, videos, firstSeenMap] = await Promise.all([
    fetchAllArticles().catch(() => null),
    resolveFighters(homepageFighters),
    fetchLatestOfficialVideos().catch(() => []),
    fetchFirstSeenMap().catch(() => new Map<string, string>()),
  ]);
  if (articlesResult && articlesResult.articles.length >= 6) {
    articles = articlesResult.articles;
  }

  const upcomingEvents = getUpcomingEvents();

  // 統一フィード: 公式・メディアを混在させ、検知時刻(firstSeenAt)を detected_at
  // として分類・速報判定し、detected_at降順で並べる。表示は最大40件。
  const feedArticles = toFeedArticles(enrichFirstSeen(articles, firstSeenMap)).slice(0, 40);

  // 右レール用: 開催予定を開催日昇順で最大5件(表示件数はレール高さに応じて
  // EventRail側でさらに自動調整)。所属団体のラベル/色だけ先に確定させて渡す。
  const railEvents = upcomingEvents.slice(0, 5).map((e) => ({
    slug: e.slug,
    label: SOURCES[e.org].label,
    color: SOURCES[e.org].color,
    eventName: e.eventName,
    venue: e.venue,
    date: e.date,
  }));

  // トップに掲載する開催予定イベントの構造化データ(共通ビルダー経由)
  const upcomingEventsLd = upcomingEvents.map((e) =>
    buildSportsEventLd({
      name: e.eventName,
      date: e.date,
      startTime: e.startTime,
      venue: e.venue,
      org: e.org,
      path: `/events/${e.slug}`,
      status: e.status,
      fighters: [
        ...e.bouts.flatMap((b) => [b.fighterA, b.fighterB]),
        ...(e.expectedFighters ?? []),
      ],
      description: `${e.eventName}（${e.date}${e.venue ? "・" + e.venue : ""}）の対戦カード・開催情報`,
      imageUrl: eventOgImageUrl(e.slug, e.bouts.length > 0),
      ticketUrl: e.ticketUrl,
    })
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
      />
      {upcomingEventsLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(upcomingEventsLd) }}
        />
      )}
      <Nav />
      <h1 className="visually-hidden">日本MMAニュース速報 | Mニュース</h1>

      <div className="home-main">
        <div className="home-feed">
          <UnifiedFeed articles={feedArticles} />
        </div>

        {/* UPCOMING EVENTS: PC(≥1200px)は右レール(sticky・高さ収め) / スマホは従来どおり下部表示 */}
        {railEvents.length > 0 && (
          <aside className="home-rail">
            <EventRail events={railEvents} />
          </aside>
        )}
      </div>

      {/* RESULTS SECTION */}
      <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
        <div className="fighter-section-head">
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", letterSpacing: 3 }}>
            🥊 大会結果まとめ
          </div>
          <a
            href="/results"
            style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 2 }}
          >
            全大会結果を見る →
          </a>
        </div>
        <div className="results-list">
          {[...EVENT_RESULTS]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 4)
            .map((e) => (
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
      </div>

      <SocialSection videos={videos} />

      {/* FIGHTER SECTION */}
      <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
        <div className="fighter-section-head">
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", letterSpacing: 3 }}>
            👤 主要選手 戦績まとめ
          </div>
          <a
            href="/fighters"
            style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 2 }}
          >
            全選手を見る →
          </a>
        </div>
        <div className="fighter-grid">
          {fighters.map((f) => {
            const { winRate, finishRate } = calcFighterRates(f);
            return (
              <a key={f.slug} href={`/fighters/${f.slug}`} className="fighter-card" style={{ borderLeftColor: SOURCES[f.org].color }}>
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
        <div style={{ padding: "16px 24px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
          <a
            href="/fighters"
            style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 2 }}
          >
            全選手を見る →
          </a>
        </div>
      </div>

      <Footer />
    </>
  );
}

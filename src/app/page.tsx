import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SplitFeed from "@/components/SplitFeed";
import SocialSection from "@/components/SocialSection";
import { ARTICLES, Article, relativeTimeJa } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { FIGHTERS, calcFighterRates } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { fetchLatestOfficialVideos } from "@/lib/feeds/youtube";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { getUpcomingEvents } from "@/lib/events";
import { selectBreaking } from "@/lib/tweetDigest";
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

const OFFICIAL_ORGS = new Set(["rizin", "deep", "shooto", "pancrase"]);

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

  const officialAll = articles.filter((a) => OFFICIAL_ORGS.has(a.source));
  const newsAll = articles.filter((a) => !OFFICIAL_ORGS.has(a.source));
  // 公式・ニュース問わず全記事から、鮮度を重視したインパクト最上位を BREAKING として表示する。
  // 失効判定は「検知時刻」を起点にするため firstSeenAt を付与してから判定する。
  const breaking = selectBreaking(enrichFirstSeen(articles, firstSeenMap));
  // 2カラムの見た目の長さを揃えるため、件数の少ない方に合わせる
  // （どちらも公開日時の降順なので、それぞれの最新N件が残る）。最大10件。
  const evenCount = Math.min(officialAll.length, newsAll.length, 10);
  const official = officialAll.slice(0, evenCount);
  const news = newsAll.slice(0, evenCount);

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
      soldOut: !!e.ticketNote && e.ticketNote.includes("完売"),
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

      {breaking && (
        <a href={breaking.url} target="_blank" rel="noopener noreferrer" className="breaking-bar">
          <span className="breaking-tag">BREAKING</span>
          <span className="breaking-title">{breaking.title}</span>
          <span className="breaking-time">{relativeTimeJa(breaking.publishedAt)}</span>
        </a>
      )}

      <SplitFeed official={official} news={news} />

      {/* UPCOMING EVENTS SECTION */}
      {upcomingEvents.length > 0 && (
        <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
          <div className="fighter-section-head">
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: 3 }}>
              📅 開催予定の大会
            </div>
          </div>
          <div className="results-list">
            {upcomingEvents.map((e) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const target = new Date(e.date); target.setHours(0, 0, 0, 0);
              const days = Math.round((target.getTime() - today.getTime()) / 86400000);
              const d = new Date(e.date);
              const dayNames = ["日","月","火","水","木","金","土"];
              const dateJa = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${dayNames[d.getDay()]}）`;
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
                    <span className="upcoming-countdown"> — あと{days}日</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* RESULTS SECTION */}
      <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
        <div className="fighter-section-head">
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: 3 }}>
            🥊 大会結果まとめ
          </div>
          <a
            href="/results"
            style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}
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

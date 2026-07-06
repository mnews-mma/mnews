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

  // 統一フィード: 当日含む直近3日分(JST暦日)を表示。ただし3日分が8件未満なら
  // 直近8件まで遡って表示する(下限保証)。並び順・時刻は publishedAt 基準。
  const feedAll = toFeedArticles(enrichFirstSeen(articles, firstSeenMap));
  const jstNow = new Date(Date.now() + 9 * 3600_000);
  const startOfTodayJstMs =
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - 9 * 3600_000;
  const cutoffMs = startOfTodayJstMs - 2 * 86400_000; // 当日含む直近3日
  const within3d = feedAll.filter((a) => new Date(a.publishedAt).getTime() >= cutoffMs);
  const feedArticles = within3d.length >= 8 ? within3d : feedAll.slice(0, 8);

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

      <div className="home-wrap">
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

      <div className="home-sections">
        {/* 大会結果まとめ（開催予定の大会と同じパネル構造） */}
        <section className="rail-panel">
          <div className="rail-head">大会結果まとめ</div>
          <div className="rail-list">
            {[...EVENT_RESULTS]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, 4)
              .map((e) => (
                <a
                  key={e.slug}
                  href={`/results/${e.slug}`}
                  className="rail-item"
                  style={{ borderLeftColor: SOURCES[e.org].color }}
                >
                  <div className="rail-item-org" style={{ color: SOURCES[e.org].color }}>
                    {SOURCES[e.org].label}
                  </div>
                  <div className="rail-item-title">{e.eventName}</div>
                  <div className="rail-item-meta">
                    {e.date}
                    {e.venue && <span> ／ {e.venue}</span>}
                  </div>
                </a>
              ))}
          </div>
          <a href="/results" className="rail-more">全大会結果を見る →</a>
        </section>

        <SocialSection videos={videos} />

        {/* 主要選手 戦績まとめ（同じパネル構造・中身は戦績カード） */}
        <section className="rail-panel">
          <div className="rail-head">主要選手 戦績まとめ</div>
          <div className="fighter-grid">
            {fighters.map((f) => {
              const { winRate, finishRate } = calcFighterRates(f);
              return (
                <a key={f.slug} href={`/fighters/${f.slug}`} className="fighter-card">
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
          <a href="/fighters" className="rail-more">全選手を見る →</a>
        </section>

        {/* 公式ランキング(補助セクション。主目的は選手DBへの誘導のためトップ本体では目立たせない) */}
        <section className="rail-panel">
          <div className="rail-head">公式ランキング</div>
          <a href="/ranking/pancrase" className="rail-more">パンクラス 公式ランキングを見る →</a>
          <a href="/ranking/shooto" className="rail-more">修斗 公式ランキングを見る →</a>
        </section>
      </div>
      </div>

      <Footer />
    </>
  );
}

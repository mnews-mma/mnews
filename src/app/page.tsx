import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import UnifiedFeed from "@/components/UnifiedFeed";
import EventRail from "@/components/EventRail";
import SocialSection from "@/components/SocialSection";
import { ARTICLES, Article } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { FIGHTERS, calcFighterRates } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { resolveFightersCached } from "@/lib/fighterRecordsCache";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { fetchDivisionRankings } from "@/lib/mnewsRatingData";
import {
  getPublishedDivisionRankingView,
  resolveDivisionRankingView,
  toClientSafeResolvedDivisionRankingView,
} from "@/lib/mnewsRating/divisionRankingView";
import MnewsRatingSection from "@/components/MnewsRatingSection";
import HeroFighterSearch from "@/components/HeroFighterSearch";
import LiveBand from "@/components/LiveBand";
import { computeLiveBand } from "@/lib/liveBand";
import { computeFighterTags, OrgTag, OrgTagKey } from "@/lib/orgTags";
import { fetchLatestOfficialVideos } from "@/lib/feeds/youtube";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { getUpcomingEvents } from "@/lib/events";
import { toFeedArticles } from "@/lib/newsClassify";
import { matchRelatedFighters } from "@/lib/relatedFighterChips";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { ORIGINAL_ARTICLES, originalArticleToFeedArticle } from "@/lib/originalArticles";
import { fetchFirstSeenMap, enrichFirstSeen } from "@/lib/firstSeen";
import { pageMetadata } from "@/lib/seo";
import { buildSportsEventLd, eventOgImageUrl } from "@/lib/eventJsonLd";

// 外部フィード取得をビルド時ではなくリクエスト時に行う。
// データ自体は fetch() の revalidate 設定により30分キャッシュされる。
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "AI RIZINランキング・選手戦績DB｜日本MMAニュース【mnews】",
  description:
    "独自開発のAIが算出するRIZIN階級別ランキングと、RIZIN・DEEP・修斗・パンクラスの選手戦績データベース。大会情報・試合結果もまとめて掲載。",
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
  description:
    "独自開発のAIが算出するRIZIN階級別ランキングと、RIZIN・DEEP・修斗・パンクラスの選手戦績データベース。大会情報・試合結果もまとめて掲載。",
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

  // トップページのMnewsRIZINレーティングは階級切替式(デフォルト:フェザー級)。
  // 切替候補4階級ぶんを最初からまとめて取得し、クライアント側では追加fetch無しで
  // 即座に切り替えられるようにする(全階級公開はせず、この4階級のみが対象)。
  const [
    articlesResult,
    fighters,
    videos,
    firstSeenMap,
    orgRankings,
    visibleFighterSlugs,
    flyweightRankings,
    bantamweightRankings,
    featherweightRankings,
    lightweightRankings,
  ] = await Promise.all([
    fetchAllArticles().catch(() => null),
    resolveFightersCached(homepageFighters),
    fetchLatestOfficialVideos().catch(() => []),
    fetchFirstSeenMap().catch(() => new Map<string, string>()),
    fetchOrgRankings().catch(() => ({})),
    getVisibleFighterSlugs(),
    fetchDivisionRankings("flyweight").catch(() => null),
    fetchDivisionRankings("bantamweight").catch(() => null),
    fetchDivisionRankings("featherweight").catch(() => null),
    fetchDivisionRankings("lightweight").catch(() => null),
  ]);
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
  // ランキングページ本体と同じ共有セレクタ経由で{champion, contenders}を取り出す
  // (ここで独自に組み立てない=王者出し忘れ防止)。公開可否もPUBLISHED_DIVISIONS
  // (/rankingsと共通の唯一の真実源)をここで参照し、準備中の階級は挑戦者
  // ランキングを出さない(王者のみ表示。Elo算出済みでも/rankings非公開の階級を
  // トップだけフル表示してしまうドリフトを防ぐ)。
  // MnewsRatingSectionは"use client"のため、渡すpropsはRSCペイロードとして
  // HTML/JSにそのままシリアライズされる。rawRating(delta算出専用の内部の生
  // レート)を含めたまま渡すと、画面に描画しなくても生HTML上には出力されて
  // しまうため、toClientSafeResolvedDivisionRankingViewで必ず除去してから渡す。
  // resolveDivisionRankingViewはfighters.tsに存在しないfighterIdを除外して
  // 表示順位を振り直す(スラッグ生表示フォールバック禁止)。topNは除外・繰り上げ
  // 後の件数に適用するため、getPublishedDivisionRankingViewには渡さず全件取得
  // してからresolve側でtopN=5を適用する。
  const mnewsRatingDivisions = {
    フライ級: toClientSafeResolvedDivisionRankingView(
      resolveDivisionRankingView(getPublishedDivisionRankingView("フライ級", flyweightRankings), nameBySlug, 5)
    ),
    バンタム級: toClientSafeResolvedDivisionRankingView(
      resolveDivisionRankingView(getPublishedDivisionRankingView("バンタム級", bantamweightRankings), nameBySlug, 5)
    ),
    フェザー級: toClientSafeResolvedDivisionRankingView(
      resolveDivisionRankingView(getPublishedDivisionRankingView("フェザー級", featherweightRankings), nameBySlug, 5)
    ),
    ライト級: toClientSafeResolvedDivisionRankingView(
      resolveDivisionRankingView(getPublishedDivisionRankingView("ライト級", lightweightRankings), nameBySlug, 5)
    ),
  };
  // 団体タグを導出(/fighters と同じチップ体裁で出すため)。
  const tagsBySlug: Record<string, OrgTag[]> = {};
  for (const f of fighters) {
    const tags = computeFighterTags(f, orgRankings);
    if (tags.length) tagsBySlug[f.slug] = tags;
  }
  if (articlesResult && articlesResult.articles.length >= 6) {
    articles = articlesResult.articles;
  }

  const upcomingEvents = getUpcomingEvents();

  // 統一フィード: 当日含む直近3日分(JST暦日)を表示。ただし3日分が8件未満なら
  // 直近8件まで遡って表示する(下限保証)。並び順・時刻は publishedAt 基準。
  // オリジナル記事(数字で見る対戦カード等)もRSS由来記事と同じ並びに混在させる。
  const originalFeedArticles = ORIGINAL_ARTICLES.map(originalArticleToFeedArticle);
  const feedAll = [...toFeedArticles(enrichFirstSeen(articles, firstSeenMap)), ...originalFeedArticles].sort(
    (x, y) => new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime()
  );
  const jstNow = new Date(Date.now() + 9 * 3600_000);
  const startOfTodayJstMs =
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - 9 * 3600_000;

  // ライブ帯(mnews-homepage-instructions.md §1)。日数判定はJST・SSR確定
  // (force-dynamicのためリクエスト時に毎回再計算され、クライアント時刻には
  // 依存しない)。
  const liveBandInfo = computeLiveBand(startOfTodayJstMs, upcomingEvents, EVENT_RESULTS);
  const todayJstDateStr = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(jstNow.getUTCDate()).padStart(2, "0")}`;
  // POST帯の「AIランキング本日更新」文言は、実際に本日分のバッチが反映済みの
  // 場合のみ出す(未反映なのに更新済みと読める表現は不可、§1.1)。
  const rankingsUpdatedToday = featherweightRankings?.updatedAt
    ? featherweightRankings.updatedAt.slice(0, 10) === todayJstDateStr
    : false;

  // 直近48時間/最大15件の「鮮度ウィンドウ」はRSS由来のニュース記事に適用する。
  // オリジナル記事(数字で見る対戦カード等)のうち最新1件のみは鮮度で消える性質の
  // コンテンツではないため、公開日に関わらず固定枠として常にフィードへ含める
  // (でないと「オリジナル」フィルタタブが記事があるのに0件表示になる回帰が
  // 起きる)。ただし無制限に全オリジナル記事を鮮度ウィンドウ対象外にすると、
  // オリジナル記事が増えるにつれ何ヶ月も前の記事がトップに残り続けてしまうため、
  // 固定枠は最新1件のみとし、2件目以降のオリジナル記事は通常のRSS記事と同じ
  // 48時間ルールに従わせる(2026-07-18 明示化)。ウィンドウ超過分はトップには
  // 出さず/archive(ニュース一覧)側でのみ表示する。閑散期対策として48時間以内の
  // 件数がFEED_MIN_FALLBACK未満の場合は直近FEED_MIN_FALLBACK件を表示する
  // (0〜数件だけの寂しいトップにしない)。
  const FEED_WINDOW_HOURS = 48;
  const FEED_MAX_ITEMS = 15;
  const FEED_MIN_FALLBACK = 5;
  const ORIGINAL_PINNED_COUNT = 1;
  const cutoffMs = Date.now() - FEED_WINDOW_HOURS * 3600_000;
  // feedAllは公開日時降順でソート済みのため、先頭からのisOriginal抽出が
  // そのまま「最新のオリジナル記事」になる。
  const pinnedOriginals = feedAll.filter((a) => a.isOriginal).slice(0, ORIGINAL_PINNED_COUNT);
  const pinnedOriginalIds = new Set(pinnedOriginals.map((a) => a.id));
  const windowCandidates = feedAll.filter((a) => !pinnedOriginalIds.has(a.id));
  const within48h = windowCandidates.filter((a) => new Date(a.publishedAt).getTime() >= cutoffMs);
  const windowedRest =
    within48h.length >= FEED_MIN_FALLBACK ? within48h.slice(0, FEED_MAX_ITEMS) : windowCandidates.slice(0, FEED_MIN_FALLBACK);
  // 関連選手チップ: サーバー側(リクエスト時レンダリング)でタイトルとfighters.tsを
  // 突合。クライアントにはマッチング結果(name/slug)のみを渡す(ロジック自体は
  // 送らない)。visibleFighterSlugsで戦績データが空(noRecordData)の選手を除外し、
  // 中身の無い選手ページへのタグ化を防ぐ(選手ページ・対戦カードと同じ「表示可能」
  // 判定基準=getVisibleFighterSlugsに揃える)。
  const feedArticles = [...pinnedOriginals, ...windowedRest]
    .sort((x, y) => new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime())
    .map((a) => ({
      ...a,
      relatedFighters: matchRelatedFighters(a.title, visibleFighterSlugs),
    }));

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
      <h1 className="visually-hidden">日本MMAニュース・選手データベース</h1>

      {liveBandInfo && <LiveBand info={liveBandInfo} rankingsUpdatedToday={rankingsUpdatedToday} />}

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

      {/* ヒーロー(データ資産ブロック): ニュースフィードの直下に配置
          (mnews-homepage-instructions.md §2見直し)。AI RIZINランキングカード+
          選手DB検索ボックスの2枚構成。 */}
      <div className="home-hero">
        <MnewsRatingSection divisions={mnewsRatingDivisions} />
        <HeroFighterSearch />
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

        {/* 公式ランキング・王者(選手一覧より上に配置)。中身はリンク4本に統一
            (RIZIN/DEEP現王者・パンクラス/修斗ランキングの各専用ページへ)。
            mnews独自のMレーティングではなく団体公式の中立集約データである点を
            見出しで明示し、独自ランキング(/rankings)と混同させない。 */}
        <section className="rail-panel">
          <div className="rail-head">公式ランキング・王者</div>
          <a href="/ranking/rizin" className="rail-more">現RIZIN王者を見る →</a>
          <a href="/ranking/deep" className="rail-more">現DEEP王者を見る →</a>
          <a href="/ranking/pancrase" className="rail-more">パンクラス 公式ランキングを見る →</a>
          <a href="/ranking/shooto" className="rail-more">修斗 公式ランキングを見る →</a>
        </section>

        {/* 主要選手 戦績まとめ（/fighters と同じチップ体裁のカード） */}
        <section className="rail-panel">
          <div className="rail-head">主要選手 戦績まとめ</div>
          <div className="fighter-grid">
            {fighters.map((f) => {
              const { winRate, finishRate } = calcFighterRates(f);
              return (
                <a key={f.slug} href={`/fighters/${f.slug}`} className="fighter-card">
                  {/* 団体タグチップ＋階級チップ(区切り"/"や旧添字は廃止・/fighters と統一) */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    {(tagsBySlug[f.slug] || []).map((t) => (
                      <span
                        key={t.key}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          color: "#fff",
                          background: SOURCES[t.key as OrgTagKey].color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.label}
                      </span>
                    ))}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        color: "var(--muted)",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.weightClass}
                    </span>
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
      </div>
      </div>

      <Footer />
    </>
  );
}

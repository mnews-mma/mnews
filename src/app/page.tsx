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

// 外部フィード取得をビルド時ではなくリクエスト時に行う。
// データ自体は fetch() の revalidate 設定により30分キャッシュされる。
export const dynamic = "force-dynamic";

export const metadata = {
  title: "日本MMAニュース速報 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の最新ニュースを随時更新。選手戦績・試合結果も掲載。",
};

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

export default async function HomePage() {
  let articles: Article[] = ARTICLES;

  const homepageFighters = FIGHTERS.filter((f) => HOMEPAGE_FIGHTER_SLUGS.has(f.slug));

  const [articlesResult, fighters, videos] = await Promise.all([
    fetchAllArticles().catch(() => null),
    resolveFighters(homepageFighters),
    fetchLatestOfficialVideos().catch(() => []),
  ]);
  if (articlesResult && articlesResult.articles.length >= 6) {
    articles = articlesResult.articles;
  }

  const officialAll = articles.filter((a) => OFFICIAL_ORGS.has(a.source));
  const newsAll = articles.filter((a) => !OFFICIAL_ORGS.has(a.source));
  // ニュース欄の一番新しい記事を BREAKING として最上部に表示する。
  const breaking = newsAll[0];
  // 2カラムの見た目の長さを揃えるため、件数の少ない方に合わせる
  // （どちらも公開日時の降順なので、それぞれの最新N件が残る）。最大10件。
  const evenCount = Math.min(officialAll.length, newsAll.length, 10);
  const official = officialAll.slice(0, evenCount);
  const news = newsAll.slice(0, evenCount);

  return (
    <>
      <Nav />

      {breaking && (
        <a href={breaking.url} target="_blank" rel="noopener noreferrer" className="breaking-bar">
          <span className="breaking-tag">BREAKING</span>
          <span className="breaking-title">{breaking.title}</span>
          <span className="breaking-time">{relativeTimeJa(breaking.publishedAt)}</span>
        </a>
      )}

      <SplitFeed official={official} news={news} />

      {/* RESULTS SECTION */}
      <div style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
        <div className="fighter-section-head">
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: 3 }}>
            🥊 大会結果まとめ
          </div>
        </div>
        <div className="results-list">
          {EVENT_RESULTS.map((e) => (
            <a key={e.slug} href={`/results/${e.slug}`} className="results-list-item" style={{ borderLeftColor: SOURCES[e.org].color }}>
              <div className="fighter-org" style={{ color: SOURCES[e.org].color }}>
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
      </div>

      <Footer />
    </>
  );
}

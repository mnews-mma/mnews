import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SplitFeed from "@/components/SplitFeed";
import SocialSection from "@/components/SocialSection";
import { ARTICLES, Article } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { FIGHTERS } from "@/lib/fighters";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { fetchLatestOfficialVideos } from "@/lib/feeds/youtube";

// 外部フィード取得をビルド時ではなくリクエスト時に行う。
// データ自体は fetch() の revalidate 設定により30分キャッシュされる。
export const dynamic = "force-dynamic";

const OFFICIAL_ORGS = new Set(["rizin", "deep"]);

export default async function HomePage() {
  let articles: Article[] = ARTICLES;

  const [articlesResult, fighters, videos] = await Promise.all([
    fetchAllArticles().catch(() => null),
    resolveFighters(FIGHTERS),
    fetchLatestOfficialVideos().catch(() => []),
  ]);
  if (articlesResult && articlesResult.articles.length >= 6) {
    articles = articlesResult.articles;
  }

  const officialAll = articles.filter((a) => OFFICIAL_ORGS.has(a.source));
  const newsAll = articles.filter((a) => !OFFICIAL_ORGS.has(a.source));
  // 2カラムの見た目の長さを揃えるため、件数の少ない方に合わせる
  // （どちらも公開日時の降順なので、それぞれの最新N件が残る）。
  const evenCount = Math.min(officialAll.length, newsAll.length);
  const official = officialAll.slice(0, evenCount);
  const news = newsAll.slice(0, evenCount);

  return (
    <>
      <Nav />

      <SplitFeed official={official} news={news} />

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

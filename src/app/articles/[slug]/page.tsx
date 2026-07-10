import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { ORIGINAL_ARTICLES, getOriginalArticle } from "@/lib/originalArticles";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import { computeFighterStripStats, computeWinMethodBreakdown, LAST5_SYMBOL } from "@/lib/fighterStrip";
import { getEvent } from "@/lib/events";
import { getEventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";

export function generateStaticParams() {
  return ORIGINAL_ARTICLES.map((a) => ({ slug: a.slug }));
}

// eventSlugは開催予定(events.ts)/結果(eventResults.ts)のどちらも指しうるため両方探す。
function resolveEventLink(eventSlug: string) {
  const upcoming = getEvent(eventSlug);
  if (upcoming) {
    return { href: `/events/${eventSlug}`, eventName: upcoming.eventName, org: upcoming.org, date: upcoming.date };
  }
  const completed = getEventResult(eventSlug);
  if (completed) {
    return { href: `/results/${eventSlug}`, eventName: completed.eventName, org: completed.org, date: completed.date };
  }
  return null;
}

const RESULT_SYMBOL: Record<"win" | "loss" | "draw" | "nc", string> = {
  win: "○",
  loss: "●",
  draw: "△",
  nc: "△",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOriginalArticle(slug);
  if (!article) return { title: "記事が見つかりません | Mニュース", robots: { index: false, follow: false } };
  const firstFight = article.fights[0];
  const description = firstFight
    ? `${firstFight.fighterA.nameJa} vs ${firstFight.fighterB.nameJa}の戦績・フィニッシュ率・直近5戦を数字で比較。${article.title}`
    : article.title;
  return pageMetadata({
    title: `${article.title} | Mニュース`,
    description,
    path: `/articles/${article.slug}`,
    image: { url: ogImagePath(`/api/og/article/${article.slug}`), width: 1200, height: 630, alt: article.title },
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOriginalArticle(slug);
  if (!article) notFound();
  const records = await fetchFighterRecords();
  const eventLink = resolveEventLink(article.eventSlug);

  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: article.title }];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <span className="article-original-badge">オリジナル</span>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {article.title}
        </h1>
        <div className="page-sub">
          <time dateTime={article.publishedAt}>{article.publishedAt}</time>
          {eventLink && (
            <>
              {" ／ "}
              <a href={eventLink.href} style={{ color: SOURCES[eventLink.org].color }}>
                {eventLink.eventName}
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {article.fights.map((fight, i) => {
          const entryA = records[fight.fighterA.slug];
          const entryB = records[fight.fighterB.slug];
          return (
            <section key={i} className="article-fight-section">
              <h2 className="event-section-label" style={{ marginBottom: 16 }}>
                {fight.fighterA.nameJa} vs {fight.fighterB.nameJa}
                {fight.weightClass && <span className="bout-weight" style={{ marginLeft: 10 }}>{fight.weightClass}</span>}
                {fight.isTitleMatch && <span className="bout-title-badge" style={{ marginLeft: 10 }}>TITLE</span>}
              </h2>

              <div className="article-fighter-compare">
                {[fight.fighterA, fight.fighterB].map((f) => {
                  const entry = records[f.slug];
                  if (!entry) {
                    return (
                      <div key={f.slug} className="article-fighter-col">
                        <span className="article-fighter-name">{f.nameJa}</span>
                        <div className="article-fighter-nodata">戦績データ準備中</div>
                      </div>
                    );
                  }
                  const stats = computeFighterStripStats(entry);
                  const breakdown = computeWinMethodBreakdown(entry);
                  return (
                    <div key={f.slug} className="article-fighter-col">
                      <a href={`/fighters/${f.slug}`} className="article-fighter-name">
                        {f.nameJa}
                      </a>
                      <div className="article-fighter-record">{stats.record}</div>
                      {stats.finishRate !== null && (
                        <div className="article-fighter-stat">フィニッシュ率 {stats.finishRate}%</div>
                      )}
                      {breakdown && (
                        <div className="article-fighter-stat">
                          KO {breakdown.koPct}% ／ 一本 {breakdown.subPct}% ／ 判定 {breakdown.decisionPct}%
                        </div>
                      )}
                      {stats.last5.length > 0 && (
                        <div className="fighter-strip-last5">
                          {stats.last5.map((r, j) => (
                            <span key={j} className={`fighter-strip-last5-${r}`}>
                              {LAST5_SYMBOL[r]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {fight.commonOpponents && fight.commonOpponents.length > 0 && (
                <div className="article-subsection">
                  <div className="event-section-label" style={{ fontSize: 12, marginBottom: 8 }}>共通対戦相手</div>
                  <ul className="article-common-opponents">
                    {fight.commonOpponents.map((o) => (
                      <li key={o.name}>
                        {o.name} — {fight.fighterA.nameJa} {RESULT_SYMBOL[o.resultA]} ／ {fight.fighterB.nameJa}{" "}
                        {RESULT_SYMBOL[o.resultB]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fight.notablePoints && fight.notablePoints.length > 0 && (
                <div className="article-subsection">
                  <div className="event-section-label" style={{ fontSize: 12, marginBottom: 8 }}>注目点</div>
                  <ul className="article-notable-points">
                    {fight.notablePoints.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}

        {eventLink && (
          <p style={{ marginTop: 24, fontSize: 13 }}>
            <a href={eventLink.href} style={{ color: "var(--accent)" }}>
              → {eventLink.eventName} の大会ページを見る
            </a>
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}

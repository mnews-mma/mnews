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

// 対比行の強調判定: 差が5pt未満は両者とも通常表示(勝敗を付けない)。
// 5pt以上の差がある場合のみ優位側を強調(cmp-win)・劣位側をグレー(cmp-lose)にする。
function cmpClass(a: number, b: number): string {
  if (Math.abs(a - b) < 5) return "";
  return a > b ? "cmp-win" : "cmp-lose";
}

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

              {(() => {
                if (!entryA || !entryB) {
                  return (
                    <div className="cmp-card">
                      <div className="cmp-row cmp-row--header">
                        <span className="cmp-name cmp-left">{fight.fighterA.nameJa}</span>
                        <span className="cmp-vs">VS</span>
                        <span className="cmp-name cmp-right">{fight.fighterB.nameJa}</span>
                      </div>
                      <div className="article-fighter-nodata">戦績データ準備中</div>
                    </div>
                  );
                }
                const statsA = computeFighterStripStats(entryA);
                const statsB = computeFighterStripStats(entryB);
                const bdA = computeWinMethodBreakdown(entryA);
                const bdB = computeWinMethodBreakdown(entryB);
                return (
                  <div className="cmp-card">
                    <div className="cmp-row cmp-row--header">
                      <a href={`/fighters/${fight.fighterA.slug}`} className="cmp-name cmp-left">
                        {fight.fighterA.nameJa}
                      </a>
                      <span className="cmp-vs">VS</span>
                      <a href={`/fighters/${fight.fighterB.slug}`} className="cmp-name cmp-right">
                        {fight.fighterB.nameJa}
                      </a>
                    </div>

                    <div className="cmp-row">
                      <span className="cmp-val cmp-left">{statsA.record}</span>
                      <span className="cmp-label">戦績</span>
                      <span className="cmp-val cmp-right">{statsB.record}</span>
                    </div>

                    {statsA.finishRate !== null && statsB.finishRate !== null && (
                      <div className="cmp-row">
                        <span className={`cmp-val cmp-left ${cmpClass(statsA.finishRate, statsB.finishRate)}`}>
                          {statsA.finishRate}%
                        </span>
                        <span className="cmp-label">フィニッシュ率</span>
                        <span className={`cmp-val cmp-right ${cmpClass(statsB.finishRate, statsA.finishRate)}`}>
                          {statsB.finishRate}%
                        </span>
                      </div>
                    )}

                    {bdA && bdB && (
                      <>
                        <div className="cmp-row">
                          <span className={`cmp-val cmp-left ${cmpClass(bdA.koPct, bdB.koPct)}`}>{bdA.koPct}%</span>
                          <span className="cmp-label">KO率</span>
                          <span className={`cmp-val cmp-right ${cmpClass(bdB.koPct, bdA.koPct)}`}>{bdB.koPct}%</span>
                        </div>
                        <div className="cmp-row">
                          <span className={`cmp-val cmp-left ${cmpClass(bdA.subPct, bdB.subPct)}`}>{bdA.subPct}%</span>
                          <span className="cmp-label">一本率</span>
                          <span className={`cmp-val cmp-right ${cmpClass(bdB.subPct, bdA.subPct)}`}>{bdB.subPct}%</span>
                        </div>
                        <div className="cmp-row">
                          <span className={`cmp-val cmp-left ${cmpClass(bdA.decisionPct, bdB.decisionPct)}`}>
                            {bdA.decisionPct}%
                          </span>
                          <span className="cmp-label">判定率</span>
                          <span className={`cmp-val cmp-right ${cmpClass(bdB.decisionPct, bdA.decisionPct)}`}>
                            {bdB.decisionPct}%
                          </span>
                        </div>
                      </>
                    )}

                    {statsA.last5.length > 0 && statsB.last5.length > 0 && (
                      <div className="cmp-row cmp-row--last5">
                        <span className="cmp-last5 cmp-left">
                          {statsA.last5.map((r, j) => (
                            <span key={j} className={`fighter-strip-last5-${r}`}>
                              {LAST5_SYMBOL[r]}
                            </span>
                          ))}
                        </span>
                        <span className="cmp-label">直近5戦</span>
                        <span className="cmp-last5 cmp-right">
                          {statsB.last5.map((r, j) => (
                            <span key={j} className={`fighter-strip-last5-${r}`}>
                              {LAST5_SYMBOL[r]}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}

                    <div className="cmp-legend">○勝ち　●負け　△分け</div>
                  </div>
                );
              })()}

              {fight.commonOpponents && fight.commonOpponents.length > 0 && (
                <div className="article-subsection">
                  <div className="event-section-label" style={{ fontSize: 12, marginBottom: 8 }}>共通対戦相手</div>
                  <ul className="article-common-opponents">
                    {fight.commonOpponents.map((o, i) => (
                      <li key={o.name + i}>
                        {o.name} — {fight.fighterA.nameJa} {o.resultA ? RESULT_SYMBOL[o.resultA] : "-"} ／{" "}
                        {fight.fighterB.nameJa} {o.resultB ? RESULT_SYMBOL[o.resultB] : "-"}
                      </li>
                    ))}
                  </ul>
                  <div className="cmp-legend">○勝ち　●負け　△分け</div>
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

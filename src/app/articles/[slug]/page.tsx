import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { ORIGINAL_ARTICLES, getOriginalArticle } from "@/lib/originalArticles";
import { fetchFighterRecords, hasWikipediaRecord } from "@/lib/fighterRecordsCache";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { getEvent } from "@/lib/events";
import { getEventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import MatchupTape, { FighterNameText } from "@/components/matchup/MatchupTape";
import { buildTapeData, buildNoDataTapeData } from "@/components/matchup/matchupData";
import { CommonOpponentsInline } from "@/components/matchup/CommonOpponentsList";
import { GLOBAL_FIGHTER_NAME_SIZE } from "@/lib/events";
import matchupStyles from "@/styles/matchup.module.css";

// 予想勝者のバッジ(ひと目表・各カード見出しの両方で使う共通の見た目)。
function WinnerBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontWeight: 700,
        color: "var(--accent)",
        background: "rgba(232, 0, 45, 0.1)",
        padding: "3px 10px",
        borderRadius: 999,
      }}
    >
      <span aria-hidden="true">▶</span>
      {label}
    </span>
  );
}

export function generateStaticParams() {
  return ORIGINAL_ARTICLES.filter((a) => !a.hidden).map((a) => ({ slug: a.slug }));
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOriginalArticle(slug);
  if (!article || article.hidden) return { title: "記事が見つかりません | Mニュース", robots: { index: false, follow: false } };
  const firstFight = article.fights[0];
  const description = firstFight
    ? `${firstFight.fighterA.nameJa} vs ${firstFight.fighterB.nameJa}の戦績・フィニッシュ率・直近5戦を数字で比較。${article.title}`
    : article.body?.[0] ?? article.title;
  // 全カード予想(fights.length>1)はOG画像がbuildFullCardImage()の縦長レイアウトに
  // なるため、meta上のwidth/heightもそれに合わせる(route.tsxの
  // headerHeight(170)+TOP_GAP(26)+COLUMN_HEADER_HEIGHT(30)+ROW_HEIGHT(100)*N+
  // BOTTOM_GAP(32)+footerHeight(60)と同じ計算式を維持すること)。
  const isFullCard = article.fights.length > 1;
  const imageWidth = 1200;
  const imageHeight = isFullCard ? 318 + article.fights.length * 100 : 630;
  return pageMetadata({
    title: `${article.title} | Mニュース`,
    description,
    path: `/articles/${article.slug}`,
    image: { url: ogImagePath(`/api/og/article/${article.slug}`), width: imageWidth, height: imageHeight, alt: article.title },
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOriginalArticle(slug);
  if (!article || article.hidden) notFound();
  const [records, visibleSlugs] = await Promise.all([fetchFighterRecords(), getVisibleFighterSlugs()]);
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
        {article.body && (
          <div className="article-body" style={{ marginBottom: 24 }}>
            {article.body.map((p, i) => (
              <p key={i} style={{ marginBottom: 14, lineHeight: 1.8 }}>
                {p}
              </p>
            ))}
            {article.fights.length > 1 && (
              <p style={{ fontSize: 13 }}>
                <a href="/rankings" style={{ color: "var(--accent)" }}>
                  → AI RIZINランキングを見る
                </a>
              </p>
            )}
          </div>
        )}

        {article.rankingSnapshots && article.rankingSnapshots.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {article.rankingSnapshots.map((snap) => (
              <div key={snap.divisionSlug} className="article-subsection">
                <div className="event-section-label" style={{ fontSize: 12, marginBottom: 8 }}>
                  {snap.divisionLabel}
                </div>
                <p style={{ marginBottom: 6 }}>
                  王者: <strong>{snap.champion}</strong>
                </p>
                <ol style={{ marginBottom: 8, paddingLeft: 20 }}>
                  {snap.top5.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ol>
                <p style={{ fontSize: 13 }}>
                  <a href={`/rankings/${snap.divisionSlug}`} style={{ color: "var(--accent)" }}>
                    → {snap.divisionLabel}ランキングを見る
                  </a>
                </p>
              </div>
            ))}
            <p style={{ fontSize: 13, marginTop: 12 }}>
              <a href="/rankings/methodology" style={{ color: "var(--accent)" }}>
                → AI RIZINランキングの算出方法について
              </a>
            </p>
          </div>
        )}

        <div className={matchupStyles.mv2}>
        {article.fights.map((fight, i) => {
          const entryA = records[fight.fighterA.slug];
          const entryB = records[fight.fighterB.slug];
          const cardWinner = fight.predictedWinner === "B" ? fight.fighterB : fight.fighterA;
          return (
            <section key={i} className="article-fight-section">
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text, #0a0a0a)", marginBottom: 10, lineHeight: 1.4 }}>
                {fight.fighterA.nameJa} vs {fight.fighterB.nameJa}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {fight.weightClass && <span className="bout-weight">{fight.weightClass}</span>}
                {fight.isTitleMatch && <span className="bout-title-badge">TITLE</span>}
                {fight.predictedWinner && typeof fight.confidencePct === "number" && (
                  <WinnerBadge label={`AI予想 ${cardWinner.nameJa} ${fight.confidencePct}%`} />
                )}
              </div>

              {(() => {
                // /events/[slug]と同じMatchupTape(綱引きバー)・共通対戦相手UI
                // (CommonOpponentsInline、夢のカードと同じ意匠)を再利用する。
                // 共通対戦相手は独立した表(別枠)にせず、同じ.cardブロック内に
                // 続ける(2026-08-06、カードが分割された表の寄せ集めに見える・
                // 独自実装のデザインが既存意匠と不統一との指摘を受けて統合)。
                const hasDataA = hasWikipediaRecord(entryA);
                const hasDataB = hasWikipediaRecord(entryB);
                const anyData = hasDataA || hasDataB;
                return (
                  <div className={matchupStyles.card}>
                    {anyData ? (
                      <MatchupTape
                        left={
                          hasDataA
                            ? buildTapeData(fight.fighterA.nameJa, fight.fighterA.slug, entryA!, { withLast5: true })
                            : buildNoDataTapeData(fight.fighterA.nameJa, fight.fighterA.slug)
                        }
                        right={
                          hasDataB
                            ? buildTapeData(fight.fighterB.nameJa, fight.fighterB.slug, entryB!, { withLast5: true })
                            : buildNoDataTapeData(fight.fighterB.nameJa, fight.fighterB.slug)
                        }
                      />
                    ) : (
                      <>
                        <div className={matchupStyles.tape}>
                          <div className={`${matchupStyles.na} ${matchupStyles.cornerRed}`}>
                            <FighterNameText name={fight.fighterA.nameJa} fontSize={GLOBAL_FIGHTER_NAME_SIZE} />
                          </div>
                          <div className={matchupStyles.vs}>VS</div>
                          <div className={`${matchupStyles.nb} ${matchupStyles.cornerBlue}`}>
                            <FighterNameText name={fight.fighterB.nameJa} fontSize={GLOBAL_FIGHTER_NAME_SIZE} />
                          </div>
                        </div>
                        <div className={matchupStyles.emptyCommons}>戦績データ準備中</div>
                      </>
                    )}

                    {fight.commonOpponents && fight.commonOpponents.length > 0 && (
                      <div className={matchupStyles.commonsHead} style={{ borderTop: "1px solid var(--line-soft, #eee)" }}>
                        <h4>共通対戦相手</h4>
                        <CommonOpponentsInline
                          leftName={fight.fighterA.nameJa}
                          rightName={fight.fighterB.nameJa}
                          commons={fight.commonOpponents}
                          visibleSlugs={visibleSlugs}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

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
        </div>

        {article.closingNote && (
          <div className="article-body" style={{ marginTop: 24 }}>
            {article.closingNote.map((p, i) => (
              <p key={i} style={{ marginBottom: 10, lineHeight: 1.8, fontSize: 13, color: "var(--muted, #8b887e)" }}>
                {p}
              </p>
            ))}
          </div>
        )}

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

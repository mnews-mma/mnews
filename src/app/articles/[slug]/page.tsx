import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { ORIGINAL_ARTICLES, getOriginalArticle } from "@/lib/originalArticles";
import { fetchFighterRecords, hasWikipediaRecord } from "@/lib/fighterRecordsCache";
import { getEvent } from "@/lib/events";
import { getEventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import MatchupTape, { FighterNameText } from "@/components/matchup/MatchupTape";
import { buildTapeData, buildNoDataTapeData } from "@/components/matchup/matchupData";
import { CommonOpponentsInline } from "@/components/matchup/CommonOpponentsList";
import { GLOBAL_FIGHTER_NAME_SIZE } from "@/lib/events";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import matchupStyles from "@/styles/matchup.module.css";

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
  // headerHeight(170)/ROW_HEIGHT(100)/footerHeight(60)と同じ計算式を維持すること)。
  const isFullCard = article.fights.length > 1;
  const imageWidth = 1200;
  const imageHeight = isFullCard ? 170 + article.fights.length * 100 + 60 : 630;
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
  const records = await fetchFighterRecords();
  const visibleSlugs = await getVisibleFighterSlugs();
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
          </div>
        )}

        {article.fights.length > 1 && article.fights.every((f) => f.predictedWinner && typeof f.confidencePct === "number") && (
          <div className="article-subsection" style={{ marginBottom: 28 }}>
            <div className="event-section-label" style={{ fontSize: 12, marginBottom: 10 }}>
              全{article.fights.length}試合 AI予想ひと目表
            </div>
            <div style={{ border: "1px solid var(--line, #e5e0d5)", borderRadius: 10, overflow: "hidden" }}>
              {article.fights.map((fight, i) => {
                const winner = fight.predictedWinner === "B" ? fight.fighterB : fight.fighterA;
                const loser = fight.predictedWinner === "B" ? fight.fighterA : fight.fighterB;
                const boutNo = fight.weightClass?.split("／")[0] ?? "";
                return (
                  <div
                    key={i}
                    style={{
                      padding: "12px 14px",
                      borderTop: i === 0 ? "none" : "1px solid var(--line-soft, #eee)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--muted, #8b887e)" }}>
                      <span>{boutNo}</span>
                      <span>
                        AI予想 <strong style={{ color: "var(--accent)" }}>{fight.confidencePct}%</strong>
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.5 }}>
                      {loser.nameJa} vs <strong style={{ color: "var(--accent)" }}>{winner.nameJa}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
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
          return (
            <section key={i} className="article-fight-section">
              <h2 className="event-section-label" style={{ marginBottom: 16 }}>
                {fight.fighterA.nameJa} vs {fight.fighterB.nameJa}
                {fight.weightClass && <span className="bout-weight" style={{ marginLeft: 10 }}>{fight.weightClass}</span>}
                {fight.isTitleMatch && <span className="bout-title-badge" style={{ marginLeft: 10 }}>TITLE</span>}
              </h2>

              {(() => {
                // /events/[slug]と同じMatchupTape(綱引きバー)を再利用する
                // (2026-08-05、記事独自のcmp-card表形式より読みやすいとの
                // フィードバックを受けて統一)。データの有無判定・組み立ても
                // EventBoutCardV2と同じ関数(hasWikipediaRecord/buildTapeData/
                // buildNoDataTapeData)を使い、片方のみデータ有りの場合も
                // 表示できる(cmp-cardは両者揃わないと丸ごと非表示だった)。
                const hasDataA = hasWikipediaRecord(entryA);
                const hasDataB = hasWikipediaRecord(entryB);
                if (!hasDataA && !hasDataB) {
                  return (
                    <div className={matchupStyles.card}>
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
                    </div>
                  );
                }
                return (
                  <div className={matchupStyles.card}>
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
                  </div>
                );
              })()}

              {fight.commonOpponents && fight.commonOpponents.length > 0 && (
                <div className="article-subsection">
                  <div className="event-section-label" style={{ fontSize: 12, marginBottom: 8 }}>共通対戦相手</div>
                  <CommonOpponentsInline
                    leftName={fight.fighterA.nameJa}
                    rightName={fight.fighterB.nameJa}
                    commons={fight.commonOpponents}
                    visibleSlugs={visibleSlugs}
                  />
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
        </div>

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

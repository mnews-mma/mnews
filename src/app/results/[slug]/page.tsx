import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { EVENT_RESULTS, getEventResult, buildEventSummary } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";
import { pageMetadata, isoDate } from "@/lib/seo";
import { findFighterSlugByName } from "@/lib/fighters";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { buildSportsEventLd, eventResultOgImageUrl } from "@/lib/eventJsonLd";

// 結果ページは「答え合わせ」(勝敗・決着の記録)に徹し、予習用スタッツ
// (通算戦績・勝率・フィニッシュ率・直近5戦○●・共通対戦相手)は出さない
// (予習カード=events/dream/選手ページ次戦は別コンポーネントBoutCard/FighterStrip
// のfullバリアントを使っており、ここには影響しない)。
// 戦績データが無い(no-data)/hiddenの選手はリンクにせずテキスト表示にする
// (getVisibleFighters()由来のvisibleSlugsで判定・判定ロジックの二重定義はしない)。
function FighterCardName({ name, visibleSlugs }: { name: string; visibleSlugs: Set<string> }) {
  const slug = findFighterSlugByName(name, undefined, visibleSlugs);
  return slug ? (
    <a href={`/fighters/${slug}`} className="opponent-link">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

export function generateStaticParams() {
  return EVENT_RESULTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) return { title: "大会が見つかりません | Mニュース", robots: { index: false, follow: false } };
  const summary = buildEventSummary(event);
  const ogImage = eventResultOgImageUrl(event.slug, event.fights.length > 0);
  return pageMetadata({
    title: `${event.eventName} 全試合結果 | Mニュース`,
    description: summary || `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）全${event.fights.length}試合の勝敗・決着方法を掲載。`,
    path: `/results/${event.slug}`,
    image: { url: ogImage, width: 1200, height: 675, alt: `${event.eventName} 全試合結果` },
  });
}

export default async function EventResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) notFound();
  const visibleSlugs = await getVisibleFighterSlugs();

  const summary = buildEventSummary(event);
  const eventDate = isoDate(event.date);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会結果一覧", href: "/results" },
    { label: event.eventName },
  ];

  const sportsEventLd = buildSportsEventLd({
    name: event.eventName,
    date: event.date,
    venue: event.venue,
    org: event.org,
    path: `/results/${event.slug}`,
    status: "completed",
    fighters: event.fights.flatMap((f) => [f.fighterA, f.fighterB]),
    // 結果ページは要約(summary)を description に流用
    description:
      summary ||
      `${event.eventName}（${event.date}${event.venue ? "・" + event.venue : ""}）全${event.fights.length}試合の勝敗・決着方法を掲載。`,
    imageUrl: eventResultOgImageUrl(event.slug, event.fights.length > 0),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventLd) }}
      />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <div className="org-tag" style={{ color: SOURCES[event.org].color }}>
          {SOURCES[event.org].label}
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {event.eventName}
        </h1>
        <div className="page-sub">
          <time dateTime={eventDate}>{event.date}</time>
          {event.venue && <span> ／ {event.venue}</span>}
        </div>
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {summary && (
          <p className="event-summary">{summary}</p>
        )}

        {event.fights.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            試合結果データは準備中です。
          </p>
        ) : (
          <div className="table-outer">
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>階級</th>
                  <th>対戦カード</th>
                  <th>勝者</th>
                  <th>決着</th>
                  <th className="col-round-head">R</th>
                </tr>
              </thead>
              <tbody>
                {event.fights.map((f, i) => {
                  const [weightName, weightKg] = f.weightClass.split("（");
                  const kg = weightKg ? weightKg.replace("）", "") : null;
                  const isWin = f.winner && !["引き分け", "中止", "NC"].includes(f.winner);
                  return (
                    <tr key={i}>
                      <td className="col-weight">
                        {weightName}
                        {kg && <span className="col-weight-kg">{kg}</span>}
                      </td>
                      <td className="col-matchup">
                        <span className="matchup-name"><FighterCardName name={f.fighterA} visibleSlugs={visibleSlugs} /></span>
                        <span className="matchup-vs">vs</span>
                        <span className="matchup-name"><FighterCardName name={f.fighterB} visibleSlugs={visibleSlugs} /></span>
                      </td>
                      <td className="col-winner">
                        {f.winner ? (
                          <span className={isWin ? "winner-pill" : "draw-pill"}>
                            {f.winner}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="col-method-r">{f.method}</td>
                      <td className="col-round">{f.round ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}
        {event.sourceUrl && (
          <p style={{ marginTop: 24, fontSize: 12 }}>
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)" }}>
              出典: {event.sourceUrl}
            </a>
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}

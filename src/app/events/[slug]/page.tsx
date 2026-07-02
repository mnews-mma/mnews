import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { EVENTS, getEvent } from "@/lib/events";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { findFighterSlugByName } from "@/lib/fighters";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return { title: "大会が見つかりません | Mニュース" };

  const isCompleted = event.status === "completed";
  const title = isCompleted
    ? `${event.eventName} 全試合結果 | Mニュース`
    : `${event.eventName} 対戦カード・開催情報 | Mニュース`;
  const description = isCompleted
    ? `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）全${event.bouts.length}試合の勝敗・決着方法を掲載。`
    : `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）の対戦カード・開催情報。${event.bouts[0] ? event.bouts[0].fighterA + " vs " + event.bouts[0].fighterB + "など" : ""}全カード掲載。`;

  return pageMetadata({ title, description, path: `/events/${event.slug}` });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

function FighterName({ name }: { name: string }) {
  const slug = findFighterSlugByName(name);
  return slug ? (
    <a href={`/fighters/${slug}`} className="opponent-link">
      {name}
    </a>
  ) : (
    <>{name}</>
  );
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const days = daysUntil(event.date);
  const srcColor = SOURCES[event.org].color;
  const srcLabel = SOURCES[event.org].label;

  // 関連大会を解決
  const relatedEvents = (event.relatedEventSlugs ?? [])
    .map((s) => getEvent(s))
    .filter(Boolean) as NonNullable<ReturnType<typeof getEvent>>[];

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会情報", href: "/" },
    { label: event.eventName },
  ];

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.eventName,
    startDate: `${event.date}T${event.startTime ?? "14:00"}:00+09:00`,
    location: {
      "@type": "Place",
      name: event.venue ?? "",
    },
    organizer: { "@type": "Organization", name: srcLabel },
    competitor: event.bouts.flatMap((b) => [
      { "@type": "Person", name: b.fighterA },
      { "@type": "Person", name: b.fighterB },
    ]),
    url: `https://www.mnews.jp/events/${event.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <Nav />

      {/* ステータスバー */}
      {event.status === "live" && (
        <div className="event-live-bar">
          <span className="event-live-dot" />
          開催中
        </div>
      )}

      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <div className="org-tag" style={{ color: srcColor }}>
          {srcLabel}
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {event.eventName}
        </h1>
        <div className="page-sub">
          {formatDateJa(event.date)}
          {event.openTime && event.startTime && (
            <span> ／ 開場 {event.openTime} ／ 開始 {event.startTime}</span>
          )}
        </div>
        {event.venue && (
          <div className="page-sub" style={{ fontSize: 13 }}>
            {event.venue}
          </div>
        )}

        {/* カウントダウン (upcoming/live のみ) */}
        {event.status !== "completed" && days >= 0 && (
          <div className="event-countdown">
            {days === 0 ? "本日開催" : `開催まであと ${days} 日`}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {/* 同日開催の関連大会 */}
        {relatedEvents.length > 0 && (
          <div className="event-related">
            <div className="event-section-label">同日開催</div>
            <div className="event-related-links">
              {relatedEvents.map((r) => (
                <a key={r.slug} href={`/events/${r.slug}`} className="event-related-link"
                  style={{ borderLeftColor: SOURCES[r.org].color }}>
                  <span className="org-tag" style={{ color: SOURCES[r.org].color, fontSize: 11 }}>
                    {SOURCES[r.org].label}
                  </span>
                  <span>{r.eventName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.venue}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 放送・配信情報 */}
        {event.broadcast && event.broadcast.length > 0 && (
          <div className="event-broadcast">
            <div className="event-section-label">放送・配信</div>
            <ul className="event-broadcast-list">
              {event.broadcast.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 対戦カード / 試合結果 */}
        <h2 className="event-section-label" style={{ marginTop: 24, marginBottom: 16 }}>
          {event.status === "completed" ? "試合結果" : "対戦カード"}
        </h2>

        {event.bouts.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            対戦カードは準備中です。
          </p>
        ) : event.status === "upcoming" || event.status === "live" ? (
          /* upcoming / live: カード表示 */
          <div className="bout-list">
            {event.bouts.map((b, i) => (
              <div
                key={i}
                className={`bout-card${b.isTitleMatch ? " bout-card--title" : ""}${b.cancelled ? " bout-card--cancelled" : ""}`}
              >
                <div className="bout-card-meta">
                  <span className="bout-weight">{b.weightClass}</span>
                  {b.rule && <span className="bout-rule">{b.rule}</span>}
                  {b.isTitleMatch && <span className="bout-title-badge">TITLE</span>}
                  {b.cancelled && <span className="bout-cancelled-badge">中止・変更</span>}
                  {b.note && !b.isTitleMatch && !b.cancelled && (
                    <span className="bout-note">{b.note}</span>
                  )}
                </div>
                <div className="bout-fighters">
                  <span className="bout-fighter-a">
                    <FighterName name={b.fighterA} />
                  </span>
                  <span className="bout-vs">VS</span>
                  <span className="bout-fighter-b">
                    <FighterName name={b.fighterB} />
                  </span>
                </div>
                {b.result && event.status === "live" && (
                  <div className="bout-result">
                    {b.result.winner ?? "引き分け"} ／ {b.result.method}
                    {b.result.round && <span> ／ {b.result.round}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* completed: テーブル表示 */
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th className="col-wrap">階級</th>
                  <th>対戦カード</th>
                  <th>勝者</th>
                  <th className="col-wrap">決着</th>
                  <th>ラウンド</th>
                </tr>
              </thead>
              <tbody>
                {event.bouts.map((b, i) => (
                  <tr key={i}>
                    <td className="col-wrap">{b.weightClass}</td>
                    <td>
                      <FighterName name={b.fighterA} /> vs{" "}
                      <FighterName name={b.fighterB} />
                    </td>
                    <td
                      className={
                        b.result?.winner && !["引き分け", "中止", "NC"].includes(b.result.winner)
                          ? "result-win"
                          : "result-draw"
                      }
                    >
                      {b.result?.winner ?? "—"}
                    </td>
                    <td className="col-wrap">{b.result?.method ?? "—"}</td>
                    <td>{b.result?.round ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {event.sourceUrl && (
          <p style={{ marginTop: 24, fontSize: 12 }}>
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--muted)" }}
            >
              出典: {srcLabel} 公式サイト
            </a>
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}

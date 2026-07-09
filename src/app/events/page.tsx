import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { getUpcomingEvents } from "@/lib/events";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";

// 開催日までの残り日数(あと◯日)を都度算出するため動的レンダリング。
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "開催予定の大会一覧 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の主な開催予定大会を開催日順に掲載。",
  path: "/events",
});

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "大会一覧" }];

export default function EventsIndexPage() {
  const events = getUpcomingEvents(); // 開催日昇順
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">開催予定の大会</h1>
        <div className="page-sub">RIZIN・DEEP・パンクラス・修斗の主な開催予定大会（開催日順）</div>
      </div>
      <div className="results-list">
        {events.map((e, idx) => {
          const target = new Date(e.date);
          target.setHours(0, 0, 0, 0);
          const days = Math.round((target.getTime() - today.getTime()) / 86400000);
          const d = new Date(e.date);
          const dateJa = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAY_NAMES[d.getDay()]}）`;
          const nearest = idx === 0; // 最も近い1件のみ赤で強調
          return (
            <a
              key={e.slug}
              href={`/events/${e.slug}`}
              className="results-list-item"
              style={{ borderLeftColor: SOURCES[e.org].color }}
            >
              <div className="org-tag" style={{ color: SOURCES[e.org].color }}>
                {SOURCES[e.org].label}
              </div>
              <div className="results-list-title">{e.eventName}</div>
              <div className="results-list-meta">
                {dateJa}
                {e.venue && <span> ／ {e.venue}</span>}
                <span className={nearest ? "rail-countdown-near" : "rail-countdown"}> — {days <= 0 ? "本日開催" : `あと${days}日`}</span>
              </div>
            </a>
          );
        })}
      </div>
      <Footer />
    </>
  );
}

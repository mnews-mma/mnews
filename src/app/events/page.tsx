import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import EventsFilterList from "@/components/EventsFilterList";
import { getUpcomingEvents } from "@/lib/events";
import { pageMetadata } from "@/lib/seo";

// 開催日までの残り日数(あと◯日)を都度算出するため動的レンダリング。
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "開催予定の大会一覧 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の主な開催予定大会を開催日順に掲載。",
  path: "/events",
});

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "大会一覧" }];

export default function EventsIndexPage() {
  const events = getUpcomingEvents(); // 開催日昇順

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">開催予定の大会</h1>
        <div className="page-sub">RIZIN・DEEP・パンクラス・修斗の主な開催予定大会（開催日順）</div>
      </div>
      <EventsFilterList events={events} />
      <Footer />
    </>
  );
}

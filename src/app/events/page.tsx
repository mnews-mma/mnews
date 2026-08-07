import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import EventsFilterList from "@/components/EventsFilterList";
import { getUpcomingEvents } from "@/lib/events";
import { pageMetadata } from "@/lib/seo";

// 残り日数(あと◯日)の算出は、実際にはこのページではなくクライアント
// コンポーネント側(EventsFilterList、"use client")のレンダリング中に
// daysUntilEventJst()で行われるため、hydration時にブラウザ側で再計算される。
// つまり「都度算出のためforce-dynamicが必要」という当初の前提は成り立って
// おらず(2026-08-07確認)、ISR化してもクライアントで正しい日数に落ち着く
// (SSGはサーバーinitial値+client再計算、というeventCountdown.tsの方針どおり)。
// ただしサーバー生成HTMLに焼かれる初期値と開催予定の絞り込み
// (getUpcomingEvents)はキャッシュ期間ぶん古くなりうるため、JST日付境界を
// またぐ窓を小さく保つ目的でrevalidateは短め(10分)にしている。
export const revalidate = 600;

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

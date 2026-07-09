import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ResultsFilterList from "@/components/ResultsFilterList";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "大会結果一覧 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の大会結果をまとめて掲載。",
  path: "/results",
});

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "大会結果一覧" }];

export default function ResultsIndexPage() {
  const events = [...EVENT_RESULTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">大会結果一覧</h1>
        <div className="page-sub">RIZIN・DEEP・パンクラス・修斗の大会結果まとめ</div>
      </div>
      <ResultsFilterList events={events} />
      <Footer />
    </>
  );
}

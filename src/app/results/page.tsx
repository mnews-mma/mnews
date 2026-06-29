import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ResultsFilterList from "@/components/ResultsFilterList";
import { EVENT_RESULTS } from "@/lib/eventResults";

export const metadata = {
  title: "大会結果一覧 | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の大会結果をまとめて掲載。",
};

export default function ResultsIndexPage() {
  const events = [...EVENT_RESULTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">大会結果一覧</div>
        <div className="page-sub">RIZIN・DEEP・パンクラス・修斗の大会結果まとめ</div>
      </div>
      <ResultsFilterList events={events} />
      <Footer />
    </>
  );
}

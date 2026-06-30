import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "選手戦績一覧 — Mニュース",
  description: "UFC・RIZIN所属選手の戦績・試合結果をまとめて掲載。",
  path: "/fighters",
});

export default async function FightersPage() {
  const fighters = await resolveFighters(FIGHTERS);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">選手戦績一覧</div>
        <div className="page-sub">日本人MMA選手の戦績データ</div>
      </div>
      <FighterFilterGrid fighters={fighters} />
      <Footer />
    </>
  );
}

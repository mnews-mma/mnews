import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "選手戦績一覧 | Mニュース",
  description: "UFC・RIZIN所属選手の戦績・試合結果をまとめて掲載。",
  path: "/fighters",
});

export default async function FightersPage() {
  // hidden 選手(Mレーティングが乗るまで伏せる新規投入ぶん)は一覧に出さない。
  const fighters = await resolveFighters(FIGHTERS.filter((f) => !f.hidden));

  return (
    <>
      <Nav />
      <div className="page-head">
        <h1 className="page-title">選手戦績一覧</h1>
        <div className="page-sub">
          日本人MMA選手の戦績データ
          <a href="/tools/fighter-card" style={{ fontSize: 13, color: "var(--accent)", marginLeft: 8 }}>
            → X投稿用カード作成
          </a>
        </div>
      </div>
      <FighterFilterGrid fighters={fighters} />
      <Footer />
    </>
  );
}

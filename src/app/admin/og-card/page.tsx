import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OgCardTool from "@/components/OgCardTool";
import { FIGHTERS } from "@/lib/fighters";

export const metadata = {
  title: "X投稿用カード作成 — Mニュース",
  robots: { index: false, follow: false },
};

export default function OgCardToolPage() {
  const fighters = FIGHTERS.map((f) => ({ slug: f.slug, nameJa: f.nameJa }));

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">X投稿用カード作成</div>
        <div className="page-sub">選手を選ぶとX投稿用の戦績カードURLが生成されます</div>
      </div>
      <Suspense fallback={null}>
        <OgCardTool fighters={fighters} />
      </Suspense>
      <Footer />
    </>
  );
}

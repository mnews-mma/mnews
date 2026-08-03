import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";
import { SHOW_MULTI_ORG_RECORD } from "@/lib/featureFlags";

export const metadata = pageMetadata({
  title: "戦績の集計方法について｜mnews",
  description: "選手ページに表示される「通算戦績」と「RIZIN・DEEP・パンクラス・修斗 通算」の違いと集計範囲を解説します。",
  path: "/methodology/records",
});

export default function MethodologyRecordsPage() {
  if (!SHOW_MULTI_ORG_RECORD) notFound();

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "戦績の集計方法について" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">戦績の集計方法について</h1>
      </div>

      <div className="prose">
        <h2>戦績の2つの表示について</h2>
        <p>
          選手ページには、条件によって2種類の戦績が表示されます。
        </p>

        <p>
          <strong>通算戦績</strong>
          <br />
          海外の団体を含む、全キャリアの成績です。公開情報から確認できる選手にのみ表示されます。
        </p>

        <p>
          <strong>RIZIN・DEEP・パンクラス・修斗 通算</strong>
          <br />
          mnewsが4団体の公式記録から独自に集計した成績です。この4団体で行われた試合のみを数えます。
        </p>

        <p>
          2つは対象とする範囲が違うため、数字は一致しないことがあります。差にあたる試合は、
          UFCやBellatorなど集計対象外の団体で行われたものです。
        </p>

        <p>
          4団体通算を用意しているのは、国内団体で長く戦っていても全キャリアの通算成績が確認できない選手が
          数多くいるためです。各団体の公式記録は残っているので、そこから積み上げれば戦績を示すことができます。
        </p>

        <p>
          一部を除き4団体の大会データを集計しています。各団体の公式サイトで公開されている試合結果を
          出典としています。
        </p>

        <p className="prose-updated">mnews.jp独自集計。</p>
      </div>
      <Footer />
    </>
  );
}

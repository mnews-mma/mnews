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

  const coverage = [
    { org: "RIZIN", period: "2016年〜" },
    { org: "DEEP", period: "2002年〜" },
    { org: "パンクラス", period: "1993年〜" },
    { org: "修斗", period: "2012年〜" },
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
          2つは対象とする範囲が違うため、数字は一致しません。たとえば堀口恭司選手は通算36勝6敗に対し、
          4団体通算は16勝1敗です。差にあたる試合は、UFCやBellatorなど集計対象外の団体で行われたものです。
        </p>

        <p>
          4団体通算を用意しているのは、国内団体で長く戦っていても全キャリアの通算成績が確認できない選手が
          数多くいるためです。各団体の公式記録は残っているので、そこから積み上げれば戦績を示すことができます。
        </p>

        <h2>収録範囲</h2>
        <p style={{ marginBottom: 16 }}>
          収録期間は、各団体の公式サイトに結果アーカイブが残っており、継続的に取得できる範囲で定めています。
          アマチュア大会は含みません。また、公式サイトに結果が掲載されていない大会など、期間内でも一部収録
          できていない大会があります。
        </p>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--s2)" }}>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>団体</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>収録期間</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row, i) => (
                <tr key={row.org} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--s2)" : undefined }}>
                  <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{row.org}</td>
                  <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{row.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>各団体の公式サイトで公開されている試合結果を出典としています。</p>

        <p className="prose-updated">mnews.jp独自集計。</p>
      </div>
      <Footer />
    </>
  );
}

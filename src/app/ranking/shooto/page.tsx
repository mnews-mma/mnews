import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { pageMetadata } from "@/lib/seo";

// cron(update-org-rankings)が data/orgRankings.json を更新→raw参照で自動反映。
export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "修斗 公式ランキング（階級別・最新）| Mニュース",
  description:
    "修斗（SHOOTO）世界ランキングを階級別に掲載。フライ級・バンタム級・フェザー級・ライト級の王者・ランカーを最新の公式発表から転載。",
  path: "/ranking/shooto",
});

export default async function ShootoRankingPage() {
  const { shooto } = await fetchOrgRankings();
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "修斗 公式ランキング" }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">修斗 公式ランキング</h1>
        <div className="page-sub">階級別の王者・ランカー（団体公式・世界ランキングの転載・自動更新）</div>
      </div>
      {shooto && shooto.classes.length > 0 ? (
        <OrgRankingView data={shooto} />
      ) : (
        <div style={{ padding: "0 24px 48px", color: "var(--muted)", fontSize: 13 }}>
          ランキングを取得中です。しばらくしてから再度ご確認ください。
        </div>
      )}
      <Footer />
    </>
  );
}

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { filterVisibleSlugs } from "@/lib/visibleFighters";
import { pageMetadata } from "@/lib/seo";
import { buildOfficialRankingTitle, buildOfficialRankingDescription, buildRankingItemLists } from "@/lib/orgRankings";

// cron(update-org-rankings)が data/orgRankings.json を更新→raw参照で自動反映。
export const revalidate = 3600;

// title・descriptionとも階級数/階級リストで動的化(SEO: 戦績ページと同じ思想)。
// 階級リストをハードコードすると団体側の階級構成変化でdescriptionだけが実態と
// 乖離するため、data/orgRankings.json由来で生成する(buildOfficialRankingDescription)。
// OGP画像/canonicalはpageMetadataの固定値のまま変更しない。
export async function generateMetadata() {
  const { shooto } = await fetchOrgRankings();
  return pageMetadata({
    title: buildOfficialRankingTitle("修斗", shooto),
    description: buildOfficialRankingDescription("修斗", shooto),
    path: "/ranking/shooto",
  });
}

export default async function ShootoRankingPage() {
  const { shooto } = await fetchOrgRankings();
  const matched = new Set<string>();
  for (const c of shooto?.classes ?? []) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await filterVisibleSlugs(matched);
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "修斗 公式ランキング" }];
  const itemLists = shooto ? buildRankingItemLists("修斗", shooto) : [];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      {itemLists.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">修斗 公式ランキング（階級別）</h1>
      </div>
      {shooto && shooto.classes.length > 0 ? (
        <OrgRankingView data={shooto} linkableSlugs={linkable} />
      ) : (
        <div style={{ padding: "0 24px 48px", color: "var(--muted)", fontSize: 13 }}>
          ランキングを取得中です。しばらくしてから再度ご確認ください。
        </div>
      )}
      <Footer />
    </>
  );
}

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { filterVisibleSlugs } from "@/lib/visibleFighters";
import { deepRankingData } from "@/lib/champions";
import { pageMetadata } from "@/lib/seo";
import { buildChampionTitle } from "@/lib/orgRankings";

// titleのみ王座数(空位除外)で動的化(SEO)。deepRankingData()のfetchedDateは
// champions.ts内のハードコード固定値のため、嘘シグナルになるtitleへは出さない。
// description/OGP画像/canonicalはpageMetadataの固定値のまま変更しない。
export function generateMetadata() {
  const deep = deepRankingData();
  return pageMetadata({
    title: buildChampionTitle("DEEP", deep),
    description:
      "DEEP各階級の現王者・暫定王者を掲載。公式サイトの発表に基づく(空位の階級は「空位」と明記)。",
    path: "/ranking/deep",
  });
}

export default async function DeepChampionsPage() {
  const deep = deepRankingData();
  const matched = new Set<string>();
  for (const c of deep.classes) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await filterVisibleSlugs(matched);
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "DEEP 現王者" }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">DEEP 現王者一覧（階級別）</h1>
      </div>
      <OrgRankingView data={deep} linkableSlugs={linkable} />
      <Footer />
    </>
  );
}

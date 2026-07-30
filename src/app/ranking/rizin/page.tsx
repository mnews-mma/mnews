import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { filterVisibleSlugs } from "@/lib/visibleFighters";
import { RIZIN_CHAMPIONS, championsToRankingData } from "@/lib/champions";
import { pageMetadata } from "@/lib/seo";
import { buildChampionTitle } from "@/lib/orgRankings";

// titleのみ王座数で動的化(SEO)。championsToRankingDataのfetchedDateは
// champions.ts内のハードコード固定値のため、嘘シグナルになるtitleへは出さない。
// description/OGP画像/canonicalはpageMetadataの固定値のまま変更しない。
export function generateMetadata() {
  const rizin = championsToRankingData("rizin", RIZIN_CHAMPIONS);
  return pageMetadata({
    title: buildChampionTitle("RIZIN", rizin),
    description:
      "RIZIN各階級の現王者(正規王者)を掲載。公式サイトの発表に基づき、暫定王者・空位の階級は除いています。",
    path: "/ranking/rizin",
  });
}

export default async function RizinChampionsPage() {
  const rizin = championsToRankingData("rizin", RIZIN_CHAMPIONS);
  const matched = new Set<string>();
  for (const c of rizin.classes) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await filterVisibleSlugs(matched);
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "RIZIN 現王者" }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">RIZIN 現王者一覧（階級別）</h1>
      </div>
      <OrgRankingView data={rizin} linkableSlugs={linkable} />
      <Footer />
    </>
  );
}

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFightersCached } from "@/lib/fighterRecordsCache";
import { RIZIN_CHAMPIONS, championsToRankingData } from "@/lib/champions";
import { pageMetadata } from "@/lib/seo";
import { buildChampionTitle } from "@/lib/orgRankings";

// ランキング表で「名前＋リンク」にできるのは 公開かつ戦績データありの選手だけ。
// no-data / hidden(needsReview) / 未照合は名前のみ表示にする(パンクラス/修斗と同じ挙動)。
async function linkableSlugsFor(slugs: Set<string>): Promise<string[]> {
  const fs = FIGHTERS.filter((f) => slugs.has(f.slug) && !f.hidden);
  const resolved = await resolveFightersCached(fs);
  return resolved.filter((r) => !r.noRecordData).map((r) => r.slug);
}

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
  const linkable = await linkableSlugsFor(matched);
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

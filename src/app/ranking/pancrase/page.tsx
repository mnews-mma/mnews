import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFightersCached } from "@/lib/fighterRecordsCache";
import { pageMetadata } from "@/lib/seo";
import { buildOfficialRankingTitle, buildOfficialRankingDescription, buildRankingItemLists } from "@/lib/orgRankings";

// ランキング表で「名前＋リンク」にできるのは 公開かつ戦績データありの選手だけ。
// no-data / hidden(needsReview) / 未照合 は名前のみ表示にする。
async function linkableSlugsFor(slugs: Set<string>): Promise<string[]> {
  const fs = FIGHTERS.filter((f) => slugs.has(f.slug) && !f.hidden);
  const resolved = await resolveFightersCached(fs);
  return resolved.filter((r) => !r.noRecordData).map((r) => r.slug);
}

// cron(update-org-rankings)が data/orgRankings.json を更新→raw参照で自動反映。
export const revalidate = 3600;

// title・descriptionとも階級数/階級リストで動的化(SEO: 戦績ページと同じ思想)。
// 階級リストをハードコードすると団体側の階級構成変化でdescriptionだけが実態と
// 乖離するため、data/orgRankings.json由来で生成する(buildOfficialRankingDescription)。
// OGP画像/canonicalはpageMetadataの固定値のまま変更しない。
export async function generateMetadata() {
  const { pancrase } = await fetchOrgRankings();
  return pageMetadata({
    title: buildOfficialRankingTitle("パンクラス", pancrase),
    description: buildOfficialRankingDescription("パンクラス", pancrase),
    path: "/ranking/pancrase",
  });
}

export default async function PancraseRankingPage() {
  const { pancrase } = await fetchOrgRankings();
  const matched = new Set<string>();
  for (const c of pancrase?.classes ?? []) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await linkableSlugsFor(matched);
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "パンクラス 公式ランキング" }];
  const itemLists = pancrase ? buildRankingItemLists("パンクラス", pancrase) : [];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      {itemLists.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">パンクラス 公式ランキング（階級別）</h1>
      </div>
      {pancrase && pancrase.classes.length > 0 ? (
        <OrgRankingView data={pancrase} linkableSlugs={linkable} />
      ) : (
        <div style={{ padding: "0 24px 48px", color: "var(--muted)", fontSize: 13 }}>
          ランキングを取得中です。しばらくしてから再度ご確認ください。
        </div>
      )}
      <Footer />
    </>
  );
}

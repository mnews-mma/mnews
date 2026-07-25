import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFightersCached } from "@/lib/fighterRecordsCache";
import { pageMetadata } from "@/lib/seo";
import { fullWidthLength } from "@/lib/tweetDigest";
import { buildOfficialRankingTitle, buildOfficialRankingWeightClassList, buildRankingItemLists } from "@/lib/orgRankings";

// ランキング表で「名前＋リンク」にできるのは 公開かつ戦績データありの選手だけ。
async function linkableSlugsFor(slugs: Set<string>): Promise<string[]> {
  const fs = FIGHTERS.filter((f) => slugs.has(f.slug) && !f.hidden);
  const resolved = await resolveFightersCached(fs);
  return resolved.filter((r) => !r.noRecordData).map((r) => r.slug);
}

// cron(update-org-rankings)が data/orgRankings.json を更新→raw参照で自動反映。
export const revalidate = 3600;

// titleは階級数・発表ラベルで動的化(SEO: 戦績ページと同じ思想)。descriptionの階級リストも
// 実データから動的化(指示書PR-I I2-3。ハードコード4階級だとtitleの「全N階級」と食い違うため)。
// OGP画像/canonicalはpageMetadataの固定値のまま変更しない。
const RANKING_DESCRIPTION_MAX = 75;
export async function generateMetadata() {
  const { shooto } = await fetchOrgRankings();
  const prefix = "修斗（SHOOTO）世界ランキングを階級別に掲載。";
  const suffix = "の王者・ランカーを最新の公式発表から転載。";
  const fallbackClasses = "フライ級・バンタム級・フェザー級・ライト級";
  const classList = shooto
    ? buildOfficialRankingWeightClassList(shooto, RANKING_DESCRIPTION_MAX - fullWidthLength(prefix) - fullWidthLength(suffix))
    : fallbackClasses;
  return pageMetadata({
    title: buildOfficialRankingTitle("修斗", shooto),
    description: `${prefix}${classList || fallbackClasses}${suffix}`,
    path: "/ranking/shooto",
  });
}

export default async function ShootoRankingPage() {
  const { shooto } = await fetchOrgRankings();
  const matched = new Set<string>();
  for (const c of shooto?.classes ?? []) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await linkableSlugsFor(matched);
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

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import OrgRankingView from "@/components/OrgRankingView";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFightersCached } from "@/lib/fighterRecordsCache";
import { pageMetadata } from "@/lib/seo";

// ランキング表で「名前＋リンク」にできるのは 公開かつ戦績データありの選手だけ。
// no-data / hidden(needsReview) / 未照合 は名前のみ表示にする。
async function linkableSlugsFor(slugs: Set<string>): Promise<string[]> {
  const fs = FIGHTERS.filter((f) => slugs.has(f.slug) && !f.hidden);
  const resolved = await resolveFightersCached(fs);
  return resolved.filter((r) => !r.noRecordData).map((r) => r.slug);
}

// cron(update-org-rankings)が data/orgRankings.json を更新→raw参照で自動反映。
export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "パンクラス 公式ランキング（階級別・最新）| Mニュース",
  description:
    "パンクラス（PANCRASE）公式ランキングを階級別に掲載。フライ級・バンタム級・フェザー級・ライト級の王者・ランカーを最新の公式発表から転載。",
  path: "/ranking/pancrase",
});

export default async function PancraseRankingPage() {
  const { pancrase } = await fetchOrgRankings();
  const matched = new Set<string>();
  for (const c of pancrase?.classes ?? []) for (const e of c.entries) if (e.slug) matched.add(e.slug);
  const linkable = await linkableSlugsFor(matched);
  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "パンクラス 公式ランキング" }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">パンクラス 公式ランキング</h1>
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

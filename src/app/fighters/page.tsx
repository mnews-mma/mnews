import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { computeFighterTags, OrgTag } from "@/lib/orgTags";
import { pageMetadata } from "@/lib/seo";

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "選手戦績一覧" }];

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "選手戦績一覧 | Mニュース",
  description: "RIZIN・UFC・DEEP・修斗・パンクラスなど、日本MMA主要選手の戦績・試合結果をまとめて掲載。",
  path: "/fighters",
});

export default async function FightersPage() {
  // 公開母集団(非hidden かつ 戦績あり)。Xカードツールと同一ソースに集約。
  const fighters = await getVisibleFighters();

  // 団体タグは導出(選手データは書き換えない)。全公開選手に一律ルールで付与
  // (UFC=org / RIZIN=2026出場 / DEEP=2026本戦orgdeep / パンクラス・修斗=現ランカー)。
  const orgRankings = await fetchOrgRankings();
  const tagsBySlug: Record<string, OrgTag[]> = {};
  for (const f of fighters) {
    const tags = computeFighterTags(f, orgRankings);
    if (tags.length) tagsBySlug[f.slug] = tags;
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">選手戦績一覧</h1>
        <div className="page-sub">
          日本MMA主要選手の戦績データ
          <a href="/tools/fighter-card" style={{ fontSize: 13, color: "var(--accent)", marginLeft: 8 }}>
            → X投稿用カード作成
          </a>
        </div>
      </div>
      <FighterFilterGrid fighters={fighters} tagsBySlug={tagsBySlug} />
      <Footer />
    </>
  );
}

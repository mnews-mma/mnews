import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import DataFreshness from "@/components/DataFreshness";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { computeFighterTags, OrgTag } from "@/lib/orgTags";
import { fetchFighterRecordsGeneratedAt } from "@/lib/fighterRecordsCache";
import { pageMetadata, SITE_URL } from "@/lib/seo";

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "選手戦績一覧" }];

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "MMA戦績データベース｜日本人選手の戦績・勝率・フィニッシュ率 - Mニュース",
  description:
    "RIZIN・DEEP・パンクラス・修斗などに参戦する日本人MMA選手の戦績を掲載。勝敗・KO/一本/判定の内訳、勝率、フィニッシュ率をデータで確認できます。",
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

  const generatedAt = await fetchFighterRecordsGeneratedAt();

  // ItemList: 一覧に表示される選手をPersonとして列挙(position=表示順)。
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MMA選手 戦績一覧",
    numberOfItems: fighters.length,
    ...(generatedAt ? { dateModified: generatedAt } : {}),
    itemListElement: fighters.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "Person", name: f.nameJa, url: `${SITE_URL}/fighters/${f.slug}` },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">MMA選手 戦績一覧</h1>
        <div className="page-sub" style={{ fontFamily: "var(--body)", fontSize: 13, letterSpacing: 0, color: "var(--text)", lineHeight: 1.8 }}>
          RIZIN・DEEP・パンクラス・修斗などに参戦する日本人MMA選手の戦績を掲載。勝敗・KO/一本/判定の内訳、勝率、フィニッシュ率をデータで確認できます。
        </div>
        <div className="page-sub">
          日本MMA主要選手の戦績データ
          <a href="/tools/fighter-card" style={{ fontSize: 13, color: "var(--accent)", marginLeft: 8 }}>
            → X投稿用カード作成
          </a>
          <a href="/ranking/undefeated" style={{ fontSize: 13, color: "var(--accent)", marginLeft: 8 }}>
            → 無敗の日本人選手一覧
          </a>
        </div>
        <DataFreshness generatedAt={generatedAt} />
      </div>
      <FighterFilterGrid fighters={fighters} tagsBySlug={tagsBySlug} />
      <Footer />
    </>
  );
}

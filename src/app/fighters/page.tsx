import { Suspense } from "react";
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

// force-dynamicだった(2026-07-30〜)。中身(4団体合算戦績)はGitHub raw fetchの
// revalidate:3600に律速されており日次バッチ以外では変わらないため、ISR化して
// リクエスト毎のフルルート再レンダリングを避ける(Fluid Active CPU増加対策)。
// searchParamsは使っていないため、force-dynamicを外してもrevalidateが素直に効く
// (/fighters/[slug]は?wc=等のsearchParams参照がありforce-dynamicを外しても
// 動的レンダリングのままなので対象外。next buildの出力(ƒのまま)で実測確認済み)。
export const revalidate = 3600;

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
        <div className="page-sub">日本MMA主要選手の戦績データ</div>
        {/* /dreamへの導線: ユーザーのやりたいこと(2選手の比較・カード作り)を
            主語にした文言で、検索ボックス周りと同じトーンのボタン型にする */}
        <a href="/dream" className="dream-cta">
          好きな2人で対戦カードを作る →
        </a>
        <DataFreshness generatedAt={generatedAt} />
      </div>
      {/* FighterFilterGridはuseSearchParams()を使うクライアントコンポーネントで、
          ISR(revalidate)化した静的生成時にはSuspense境界が無いとビルドが失敗する
          (force-dynamicの間はこの制約に引っかかっていなかった)。fallbackは実質
          表示されない(SSR結果に含まれるため)ため見た目上の変化はない。 */}
      <Suspense fallback={null}>
        <FighterFilterGrid fighters={fighters} tagsBySlug={tagsBySlug} />
      </Suspense>
      <Footer />
    </>
  );
}

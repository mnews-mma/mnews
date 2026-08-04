import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import FighterCardGrid from "@/components/FighterCardGrid";
import DataFreshness from "@/components/DataFreshness";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { fetchOrgTagOverrides } from "@/lib/orgTagOverridesData";
import { computeFighterTags, OrgTag } from "@/lib/orgTags";
import { fetchFighterRecordsGeneratedAt } from "@/lib/fighterRecordsCache";
import { weightSortKey } from "@/lib/weightClasses";
import { pageMetadata, SITE_URL } from "@/lib/seo";

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "選手戦績一覧" }];

// force-dynamicだった(2026-07-30〜)。中身(4団体合算戦績)はGitHub raw fetchの
// revalidate:3600に律速されており日次バッチ以外では変わらないため、ISR化して
// リクエスト毎のフルルート再レンダリングを避ける(Fluid Active CPU増加対策)。
// searchParamsは使っていないため、force-dynamicを外してもrevalidateが素直に効く。
// (/fighters/[slug]も2026-08-04に?wc=を廃止してISR化済み。当該ファイル冒頭参照)
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
  const [orgRankings, orgTagOverrides] = await Promise.all([fetchOrgRankings(), fetchOrgTagOverrides()]);
  const tagsBySlug: Record<string, OrgTag[]> = {};
  for (const f of fighters) {
    const tags = computeFighterTags(f, orgRankings, orgTagOverrides);
    if (tags.length) tagsBySlug[f.slug] = tags;
  }

  const generatedAt = await fetchFighterRecordsGeneratedAt();

  // 階級フィルタの選択肢は実際にDBへ存在する階級だけを、共有の体重ソートキーで
  // 並べて出す(配列順・追加順に依存しない。後から階級を足しても正しい位置に入る)。
  // 階級が未確定(空/"不明")の選手は選択肢に出さない(選手自体は「すべて」表示に残る)。
  const weightOptions = Array.from(new Set(fighters.map((f) => f.weightClass).filter((w) => w && w !== "不明"))).sort(
    (a, b) => weightSortKey(a) - weightSortKey(b)
  );

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
      {/* FighterFilterGridはuseSearchParams()を使うクライアントコンポーネント
          (検索入力・階級/団体チップのUIとフィルタ状態管理のみ)。ISR(revalidate)化
          した静的生成時にはSuspense境界が無いとビルドが失敗するため引き続き
          Suspenseで包む。フォールバック(null)は静的HTMLに焼き込まれ、フィルタバー
          自体はハイドレーション後にのみ表示される(この挙動はSSR化前と同じ・
          変更なし)。
          カードグリッドの実描画はFighterCardGrid(Server Component)に分離し、
          Suspenseの外に置くことで、useSearchParams()の制約を受けず全件が
          静的HTMLに出力されるようにしている(out/fighters-index-ssr-feasibility.md)。 */}
      <Suspense fallback={null}>
        <FighterFilterGrid weightOptions={weightOptions} />
      </Suspense>
      <FighterCardGrid fighters={fighters} tagsBySlug={tagsBySlug} />
      <Footer />
    </>
  );
}

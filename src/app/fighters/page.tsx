import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FighterFilterGrid from "@/components/FighterFilterGrid";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { computeFighterTags, OrgTag } from "@/lib/orgTags";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "選手戦績一覧 | Mニュース",
  description: "UFC・RIZIN所属選手の戦績・試合結果をまとめて掲載。",
  path: "/fighters",
});

export default async function FightersPage() {
  // hidden 選手(Mレーティングが乗るまで伏せる新規投入ぶん)は一覧に出さない。
  const resolved = await resolveFighters(FIGHTERS.filter((f) => !f.hidden));
  // 戦績データが無い(no data)選手はカード一覧に出さない(薄いものを出さない)。
  // 公式順位という別の存在意義がある修斗/パンクラスのno-data選手はランキング表に
  // 名前で残る(そちらは維持)が、選手一覧のカードには載せない。
  const fighters = resolved.filter((f) => !f.noRecordData);

  // 団体タグは導出(選手データは書き換えない)。付与は二次PRの新規公開昇格分のみ
  // (computeFighterTags 側で NEW_TAGGED_SLUGS にゲート済み。既存公開選手は空)。
  const orgRankings = await fetchOrgRankings();
  const tagsBySlug: Record<string, OrgTag[]> = {};
  for (const f of fighters) {
    const tags = computeFighterTags(f, orgRankings);
    if (tags.length) tagsBySlug[f.slug] = tags;
  }

  return (
    <>
      <Nav />
      <div className="page-head">
        <h1 className="page-title">選手戦績一覧</h1>
        <div className="page-sub">
          日本人MMA選手の戦績データ
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

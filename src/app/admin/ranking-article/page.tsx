import { FIGHTERS } from "@/lib/fighters";
import { fetchDivisionRankings } from "@/lib/mnewsRatingData";
import { getDivisionRankingView, resolveDivisionRankingView } from "@/lib/mnewsRating/divisionRankingView";
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "@/lib/mnewsRating/divisions";
import type { RankingDivisionSnapshot } from "@/lib/originalArticles";
import RankingArticleTool from "@/components/RankingArticleTool";

// ランキング変動記事(告知記事)のドラフト工場(管理画面)。/admin/drafts同様、
// この画面からのDB・git自動書き込みは一切行わない(常に「生成→コピー→
// 人間が手動でoriginalArticles.tsへ追記してコミット」運用)。
export const dynamic = "force-dynamic";

export const metadata = {
  title: "ランキング変動記事作成 | Mニュース",
  robots: { index: false, follow: false },
};

export default async function AdminRankingArticlePage() {
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  // 公開4階級それぞれの王者+上位5位を、/rankings/[division]と同じ
  // resolveDivisionRankingView経由で取得する(zero-fabrication: 表示中の
  // ランキングと必ず一致させるため、この画面独自の集計ロジックは持たない)。
  const snapshots: RankingDivisionSnapshot[] = await Promise.all(
    PUBLISHED_DIVISIONS.map(async (division) => {
      const data = await fetchDivisionRankings(DIVISION_SLUG[division]);
      const view = resolveDivisionRankingView(getDivisionRankingView(data), nameBySlug, 5);
      return {
        divisionLabel: division,
        divisionSlug: DIVISION_SLUG[division],
        champion: view.champion?.nameJa ?? "",
        top5: view.contenders.map((c) => c.nameJa),
      };
    })
  );

  return <RankingArticleTool initialSnapshots={snapshots} />;
}

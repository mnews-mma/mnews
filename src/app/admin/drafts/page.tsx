import { FIGHTERS } from "@/lib/fighters";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import { fetchOrgRankings, fetchOrgRankingsPrev } from "@/lib/orgRankingsData";
import { diffRankings } from "@/lib/rankingDiff";
import DraftsTool from "@/components/DraftsTool";

// 投稿の下書き工場(管理画面)。誤爆防止のためX投稿API連携は一切持たない
// (常に「生成→プレビュー→コピー→手動ポスト」)。
export const dynamic = "force-dynamic";

export const metadata = {
  title: "投稿ドラフト | Mニュース",
  robots: { index: false, follow: false },
};

export default async function AdminDraftsPage() {
  const [records, cur, prev] = await Promise.all([
    fetchFighterRecords(),
    fetchOrgRankings(),
    fetchOrgRankingsPrev(),
  ]);

  // 選手セレクタ(タブ①③)は全FIGHTERS対象(hidden含む)。運用スタッフは公開前
  // 選手も参照できる必要があるため、公開判定(getVisibleFighters)は使わない。
  const fighters = FIGHTERS.map((f) => {
    const rec = records[f.slug];
    return {
      slug: f.slug,
      nameJa: f.nameJa,
      wins: rec && !rec.noRecordData ? rec.wins : undefined,
      losses: rec && !rec.noRecordData ? rec.losses : undefined,
      draws: rec && !rec.noRecordData ? rec.draws : undefined,
    };
  });

  const changes = [
    ...diffRankings(prev.pancrase, cur.pancrase),
    ...diffRankings(prev.shooto, cur.shooto),
    ...diffRankings(prev.deep, cur.deep),
  ];

  return <DraftsTool fighters={fighters} changes={changes} />;
}

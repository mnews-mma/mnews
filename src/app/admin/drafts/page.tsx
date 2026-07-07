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

  // 選手セレクタ(タブ①)は全FIGHTERS対象(hidden含む。運用スタッフは公開前選手も
  // 参照できる必要があるため公開判定=getVisibleFightersは使わない)。ただし
  // nodata選手(戦績データ無し)は戦績サマリを出せないため選択肢自体から除外する。
  const fighters = FIGHTERS.filter((f) => {
    const rec = records[f.slug];
    return rec && !rec.noRecordData;
  }).map((f) => {
    const rec = records[f.slug]!;
    return {
      slug: f.slug,
      nameJa: f.nameJa,
      wins: rec.wins,
      losses: rec.losses,
      ko: rec.ko,
      sub: rec.sub,
    };
  });

  const changes = [
    ...diffRankings(prev.pancrase, cur.pancrase),
    ...diffRankings(prev.shooto, cur.shooto),
    ...diffRankings(prev.deep, cur.deep),
  ];

  return <DraftsTool fighters={fighters} changes={changes} />;
}

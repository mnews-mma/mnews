import { FIGHTERS } from "@/lib/fighters";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import DraftsTool from "@/components/DraftsTool";

// 対戦カード決定のX投稿文ドラフト工場(管理画面)。誤爆防止のためX投稿API連携は
// 一切持たない(常に「生成→プレビュー→コピー→手動ポスト」)。
export const dynamic = "force-dynamic";

export const metadata = {
  title: "対戦カード決定投稿 | Mニュース",
  robots: { index: false, follow: false },
};

export default async function AdminDraftsPage() {
  const records = await fetchFighterRecords();

  // 選手セレクタは全FIGHTERS対象(hidden含む。運用スタッフは公開前選手も参照
  // できる必要があるため公開判定=getVisibleFightersは使わない)。ただし
  // nodata選手(戦績データ無し)は戦績サマリを出せないため選択肢自体から除外する。
  const fighters = FIGHTERS.filter((f) => {
    const rec = records[f.slug];
    return rec && !rec.noRecordData;
  }).map((f) => {
    const rec = records[f.slug]!;
    return {
      slug: f.slug,
      nameJa: f.nameJa,
      weightClass: f.weightClass,
      wins: rec.wins,
      losses: rec.losses,
      draws: rec.draws,
      ko: rec.ko,
      sub: rec.sub,
      history: rec.history,
    };
  });

  return <DraftsTool fighters={fighters} fighterRecords={records} />;
}

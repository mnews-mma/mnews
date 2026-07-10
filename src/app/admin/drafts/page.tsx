import { FIGHTERS } from "@/lib/fighters";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import { fetchOrgRankings, fetchOrgRankingsPrev } from "@/lib/orgRankingsData";
import { diffRankings } from "@/lib/rankingDiff";
import { EVENTS } from "@/lib/events";
import { EVENT_RESULTS } from "@/lib/eventResults";
import DraftsTool, { type ArticleEventOption } from "@/components/DraftsTool";

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

  // タブ③(数字で見る記事生成)用: 大会選択の候補。開催予定(bouts)・結果(fights)
  // 双方を、対象試合ピッカーが扱える共通形状に正規化する(元データは変更しない)。
  const eventOptions: ArticleEventOption[] = [
    ...EVENTS.map((e) => ({
      slug: e.slug,
      eventName: e.eventName,
      fights: e.bouts.map((b) => ({
        fighterA: b.fighterA,
        fighterB: b.fighterB,
        weightClass: b.weightClass,
        isTitleMatch: b.isTitleMatch,
      })),
    })),
    ...EVENT_RESULTS.map((e) => ({
      slug: e.slug,
      eventName: e.eventName,
      fights: e.fights.map((f) => ({
        fighterA: f.fighterA,
        fighterB: f.fighterB,
        weightClass: f.weightClass,
      })),
    })),
  ];

  // タブ③は共通対戦相手・直近5戦の算出にhistory全量が要るため、フル戦績を渡す
  // (管理画面は/admin配下で認証必須。運用頻度が低いため848KB程度のペイロードは許容)。
  return <DraftsTool fighters={fighters} changes={changes} events={eventOptions} fighterRecords={records} />;
}

import { getUpcomingEvents } from "@/lib/events";
import LiveResultTool from "@/components/LiveResultTool";

export const dynamic = "force-dynamic";

// 大会当日のライブ入力(7/5暫定版: 結果カード生成+X手動ポスト)。
// サイトへの結果反映(git commit経由)とX自動ポストは7/13までに実装予定。
export default function AdminLivePage() {
  const events = getUpcomingEvents().map((e) => ({
    slug: e.slug,
    eventName: e.eventName,
    date: e.date,
    org: e.org,
    bouts: e.bouts.map((b, i) => ({
      index: i,
      weightClass: b.weightClass,
      fighterA: b.fighterA,
      fighterB: b.fighterB,
      isTitleMatch: !!b.isTitleMatch,
      cancelled: !!b.cancelled,
    })),
  }));

  return <LiveResultTool events={events} />;
}

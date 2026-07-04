import { getUpcomingEvents } from "@/lib/events";
import WeighInTool from "@/components/WeighInTool";

export const dynamic = "force-dynamic";

// 大会前日の計量結果まとめ投稿(手動入力データから整形)。
// 公式計量結果を見ながら手入力する運用(データソースは自作、転載ではない)。
export default function AdminWeighInPage() {
  const events = getUpcomingEvents().map((e) => ({
    slug: e.slug,
    eventName: e.eventName,
    date: e.date,
    bouts: e.bouts
      .filter((b) => !b.cancelled)
      .map((b) => ({ fighterA: b.fighterA, fighterB: b.fighterB })),
  }));

  return <WeighInTool events={events} />;
}

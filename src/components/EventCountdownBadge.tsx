"use client";

import { useEffect, useState } from "react";
import { daysUntilEventJst } from "@/lib/eventCountdown";

// 大会詳細ページのカウントダウン表示。詳細ページは SSG(generateStaticParams)
// のため、サーバー側で日数を算出すると build 時点の値で固定されてしまう
// (=日付が変わっても更新されない/UTCビルドだと JST とずれる)。そこで
// クライアント側で現在時刻(JST正規化)から算出し、静的ページでも常に正しい
// 残り日数を表示する。文言・見た目は従来のサーバー描画時と同一。
export default function EventCountdownBadge({ date }: { date: string }) {
  const [days, setDays] = useState(() => daysUntilEventJst(date));

  // マウント後にクライアントの現在時刻で再計算(静的HTMLの build 時値を上書き)。
  useEffect(() => {
    setDays(daysUntilEventJst(date));
  }, [date]);

  // 開催済み(負数)は表示しない。呼び出し側で status !== "completed" を担保する。
  if (days < 0) return null;

  return (
    <div className="event-countdown" suppressHydrationWarning>
      {days === 0 ? "本日開催" : `開催まであと ${days} 日`}
    </div>
  );
}

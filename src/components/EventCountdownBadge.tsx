"use client";

import { useEffect, useState } from "react";
import { daysUntilEventJst, startOfTodayJstMs } from "@/lib/eventCountdown";

const DAY_MS = 86_400_000;

// 大会詳細ページのカウントダウン表示。
//
// initialDays はサーバー(SSGビルド時)にJST基準で算出した値をpropsで受け取り、
// useStateの初期値にそのまま使う(クライアント側でDate.now()を呼ばない)ため、
// サーバーが吐いた静的HTMLとクライアントの初回レンダーが常に一致し、
// hydration mismatch が起きない。検索クローラ向けにも「開催まであとN日」の
// 文言が静的HTMLに載る(鮮度シグナル)。
//
// マウント後(=hydration後)にuseEffectでクライアント時刻から再計算し、
// ビルド時点と閲覧時点で日付をまたいでいた場合の値を上書きする。加えて、
// タブを開きっぱなしで日付をまたぐケースに備え、次のJST 0:00に自動で
// 再計算するタイマーを仕込む(アンマウント時にclearTimeout)。
export default function EventCountdownBadge({
  date,
  initialDays,
}: {
  date: string;
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);

  useEffect(() => {
    setDays(daysUntilEventJst(date));

    let timer: ReturnType<typeof setTimeout>;
    function scheduleNextRecalc() {
      const nowMs = Date.now();
      const nextMidnightJstMs = startOfTodayJstMs(nowMs) + DAY_MS;
      timer = setTimeout(() => {
        setDays(daysUntilEventJst(date));
        scheduleNextRecalc();
      }, nextMidnightJstMs - nowMs + 500);
    }
    scheduleNextRecalc();

    return () => clearTimeout(timer);
  }, [date]);

  // 開催済み(負数)は表示しない。呼び出し側で status !== "completed" を担保する。
  if (days < 0) return null;

  return (
    <div className="event-countdown">
      {days === 0 ? "本日開催" : `開催まであと ${days} 日`}
    </div>
  );
}

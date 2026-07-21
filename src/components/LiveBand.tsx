import type { LiveBandInfo } from "@/lib/liveBand";

// イベント接近時のみ表示するライブ帯(mnews-homepage-instructions.md §1)。
// 日数計算はサーバー側(page.tsx)でJST基準・SSR/ISR確定済みのLiveBandInfoを
// 受け取って表示するだけで、クライアント時刻には一切依存しない。
// 「速報」「LIVE」「リアルタイム」「即日反映」の文言は使わない。
export default function LiveBand({ info, rankingsUpdatedToday }: { info: LiveBandInfo; rankingsUpdatedToday: boolean }) {
  const showPulse = info.state === "PRE" || info.state === "DAY";

  let headline: string;
  let subline: string | null;
  let ctaLabel: string;
  let ctaHref: string;

  if (info.state === "PRE") {
    headline = `${info.eventName} あと${info.daysUntil}日`;
    subline = "全対戦カード・戦績比較はこちら";
    ctaLabel = "対戦カード";
    ctaHref = `/events/${info.slug}`;
  } else if (info.state === "DAY") {
    headline = `${info.eventName} 本日開催`;
    subline = "対戦カード・選手戦績はこちら";
    ctaLabel = "対戦カード";
    ctaHref = `/events/${info.slug}`;
  } else {
    headline = `${info.eventName} 結果まとめ公開`;
    // AIランキングはRIZIN専用のため、告知はorg==="rizin"のときのみ出す。
    // 団体不明(org未設定)の場合も非RIZIN側に倒し、告知は出さない。
    subline =
      info.org === "rizin"
        ? rankingsUpdatedToday
          ? "AIランキング本日更新"
          : "AIランキングは本日中に更新"
        : null;
    ctaLabel = "結果を見る";
    ctaHref = `/results/${info.slug}`;
  }

  return (
    <a href={ctaHref} className="live-band">
      <div className="live-band-text">
        {showPulse && <span className="live-band-dot" aria-hidden="true" />}
        <span className="live-band-headline">{headline}</span>
        {subline && <span className="live-band-sub">{subline}</span>}
      </div>
      <span className="live-band-cta">{ctaLabel} →</span>
    </a>
  );
}

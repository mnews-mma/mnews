import { SOURCES, SourceKey } from "./sources";
import { findFighterSlugByName } from "./fighters";
import { SITE_URL, ogImagePath } from "./ogShared";
import { findVenue } from "./venues";

// ─────────────────────────────────────────────
// SportsEvent 構造化データの共通ビルダー(Search Console推奨項目対応)。
// トップ / /events/* / /results/* すべてここを通して出力する。
// 会場住所は src/lib/venues.ts の会場マスタ(findVenue)から注入する。
// ─────────────────────────────────────────────

export interface SportsEventLdInput {
  name: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // "14:00"
  venue?: string;
  org: SourceKey;
  path: string; // 例: /events/deep-132-impact
  status: "upcoming" | "live" | "completed";
  fighters: string[]; // 出場全選手名
  description: string;
  imageUrl: string; // OGP画像(絶対URL)
  ticketUrl?: string; // upcomingのみ offers として出力
  soldOut?: boolean;
}

export function buildSportsEventLd(input: SportsEventLdInput): object {
  const src = SOURCES[input.org];
  // 会場マスタ(エイリアス正規化込み)で引く。ヒットしなければ location 自体を
  // 出力しない — 誤った住所を混ぜるより「location省略」の方がGoogle的にも良い。
  const venue = findVenue(input.venue);

  // 重複選手を除去して Person 配列に。選手ページがある選手は url 付き
  const performer = Array.from(new Set(input.fighters))
    .filter((n) => n && n !== "未定")
    .map((name) => {
      const slug = findFighterSlugByName(name);
      return {
        "@type": "Person",
        name,
        ...(slug ? { url: `${SITE_URL}/fighters/${slug}` } : {}),
      };
    });

  const startDate = `${input.date}T${input.startTime ?? "14:00"}:00+09:00`;

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: input.name,
    description: input.description,
    startDate,
    // schema.org の eventStatus に「終了」は存在しないため、完了は
    // endDate が過去であることで判別できる出力にする(EventScheduledを維持)
    endDate: `${input.date}T23:00:00+09:00`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(venue
      ? {
          location: {
            "@type": "Place",
            name: venue.name,
            ...(venue.address ? { address: venue.address } : {}),
          },
        }
      : {}),
    organizer: { "@type": "Organization", name: src.label, url: src.url },
    performer,
    competitor: performer,
    image: [input.imageUrl],
    url: `${SITE_URL}${input.path}`,
    ...(input.status !== "completed" && input.ticketUrl
      ? {
          offers: {
            "@type": "Offer",
            url: input.ticketUrl,
            availability: input.soldOut
              ? "https://schema.org/SoldOut"
              : "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

// MEvent(開催情報)用: OGP画像は対戦カード一覧画像を使う
export function eventOgImageUrl(slug: string, hasBouts: boolean): string {
  return hasBouts
    ? `${SITE_URL}${ogImagePath(`/api/og/event-card/${slug}`)}`
    : `${SITE_URL}/og-image.png`;
}

import { SOURCES, SourceKey } from "./sources";
import { findFighterSlugByName } from "./fighters";
import { SITE_URL, ogImagePath } from "./ogShared";

// ─────────────────────────────────────────────
// SportsEvent 構造化データの共通ビルダー(Search Console推奨項目対応)。
// トップ / /events/* / /results/* すべてここを通して出力する。
// ─────────────────────────────────────────────

interface PostalAddress {
  "@type": "PostalAddress";
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
  addressCountry: "JP";
}

// 主要会場の住所マスタ。会場名の部分一致で引く(「東京・ニューピアホール」等の
// 表記ゆれを吸収)。未登録会場は address を出力しない(誤った住所を出さない)。
const VENUE_ADDRESSES: { key: string; address: PostalAddress }[] = [
  {
    key: "ニューピアホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "海岸1-11-1 ニューピア竹芝ノースタワー1F",
      addressLocality: "港区",
      addressRegion: "東京都",
      postalCode: "105-0022",
      addressCountry: "JP",
    },
  },
  {
    key: "後楽園ホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "後楽1-3-61",
      addressLocality: "文京区",
      addressRegion: "東京都",
      postalCode: "112-0004",
      addressCountry: "JP",
    },
  },
  {
    key: "広島グリーンアリーナ",
    address: {
      "@type": "PostalAddress",
      streetAddress: "基町4-1",
      addressLocality: "広島市中区",
      addressRegion: "広島県",
      postalCode: "730-0011",
      addressCountry: "JP",
    },
  },
  {
    key: "アクロス福岡",
    address: {
      "@type": "PostalAddress",
      streetAddress: "天神1-1-1",
      addressLocality: "福岡市中央区",
      addressRegion: "福岡県",
      postalCode: "810-0001",
      addressCountry: "JP",
    },
  },
  {
    key: "京セラドーム大阪",
    address: {
      "@type": "PostalAddress",
      streetAddress: "千代崎3-中2-1",
      addressLocality: "大阪市西区",
      addressRegion: "大阪府",
      postalCode: "550-0023",
      addressCountry: "JP",
    },
  },
  {
    key: "TOYOTA ARENA TOKYO",
    // 番地は変動情報のため区レベルまで(誤情報を出さない方針)
    address: {
      "@type": "PostalAddress",
      addressLocality: "江東区",
      addressRegion: "東京都",
      addressCountry: "JP",
    },
  },
  {
    key: "さいたまスーパーアリーナ",
    address: {
      "@type": "PostalAddress",
      streetAddress: "新都心8",
      addressLocality: "さいたま市中央区",
      addressRegion: "埼玉県",
      postalCode: "330-9111",
      addressCountry: "JP",
    },
  },
  {
    key: "有明アリーナ",
    address: {
      "@type": "PostalAddress",
      streetAddress: "有明1-11-1",
      addressLocality: "江東区",
      addressRegion: "東京都",
      addressCountry: "JP",
    },
  },
  {
    key: "東京ドーム",
    address: {
      "@type": "PostalAddress",
      streetAddress: "後楽1-3-61",
      addressLocality: "文京区",
      addressRegion: "東京都",
      postalCode: "112-0004",
      addressCountry: "JP",
    },
  },
];

export function lookupVenueAddress(venue: string | undefined): PostalAddress | null {
  if (!venue) return null;
  const hit = VENUE_ADDRESSES.find((v) => venue.includes(v.key));
  return hit ? hit.address : null;
}

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
  const address = lookupVenueAddress(input.venue);

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
    location: {
      "@type": "Place",
      name: input.venue ?? "",
      ...(address ? { address } : {}),
    },
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

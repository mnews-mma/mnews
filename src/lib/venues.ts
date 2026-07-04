// 会場マスタ。Event構造化データ(location.address)の出典として使う。
// name は events.ts / eventResults.ts の venue フィールドの表記と完全一致させる
// (表記ゆれがある場合はこちらのnameを正規化キーとして参照する)。
// 住所が確認できない会場は address を持たせず、name のみ登録する
// （不明な住所を推測で埋めない）。

export interface PostalAddress {
  "@type": "PostalAddress";
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
  addressCountry: "JP";
}

export interface Venue {
  id: string;
  name: string;
  address?: PostalAddress;
}

export const VENUES: Venue[] = [
  {
    id: "new-pier-hall",
    name: "ニューピアホール",
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
    id: "korakuen-hall",
    name: "後楽園ホール",
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
    id: "hiroshima-green-arena",
    name: "広島グリーンアリーナ",
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
    id: "across-fukuoka",
    name: "アクロス福岡",
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
    id: "kyocera-dome-osaka",
    name: "京セラドーム大阪",
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
    id: "toyota-arena-tokyo",
    name: "TOYOTA ARENA TOKYO",
    address: {
      "@type": "PostalAddress",
      streetAddress: "青海1-3-1",
      addressLocality: "江東区",
      addressRegion: "東京都",
      postalCode: "135-0064",
      addressCountry: "JP",
    },
  },
  {
    id: "saitama-super-arena",
    name: "さいたまスーパーアリーナ",
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
    id: "ariake-arena",
    name: "有明アリーナ",
    address: {
      "@type": "PostalAddress",
      streetAddress: "有明1-11-1",
      addressLocality: "江東区",
      addressRegion: "東京都",
      addressCountry: "JP",
    },
  },
  {
    id: "tokyo-dome",
    name: "東京ドーム",
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
    id: "ebisu-garden-room",
    name: "恵比寿ガーデンルーム",
    address: {
      "@type": "PostalAddress",
      streetAddress: "恵比寿4-20-3",
      addressLocality: "渋谷区",
      addressRegion: "東京都",
      postalCode: "150-0013",
      addressCountry: "JP",
    },
  },
  {
    id: "glion-arena-kobe",
    name: "GLION ARENA KOBE",
    address: {
      "@type": "PostalAddress",
      streetAddress: "新港町2-1",
      addressLocality: "神戸市中央区",
      addressRegion: "兵庫県",
      postalCode: "650-0041",
      addressCountry: "JP",
    },
  },
  {
    id: "gorilla-hall-osaka",
    name: "GORILLA HALL OSAKA",
    address: {
      "@type": "PostalAddress",
      streetAddress: "泉1-1-82",
      addressLocality: "大阪市住之江区",
      addressRegion: "大阪府",
      postalCode: "559-0023",
      addressCountry: "JP",
    },
  },
  {
    id: "ig-arena-nagoya",
    name: "IGアリーナ（名古屋）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "名城1-2-22",
      addressLocality: "名古屋市北区",
      addressRegion: "愛知県",
      postalCode: "462-0846",
      addressCountry: "JP",
    },
  },
  {
    id: "kddi-ishin-hall",
    name: "KDDI維新ホール（山口）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "小郡令和1-1-1",
      addressLocality: "山口市",
      addressRegion: "山口県",
      postalCode: "754-0041",
      addressCountry: "JP",
    },
  },
  {
    id: "anabuki-arena-kagawa",
    name: "あなぶきアリーナ香川",
    address: {
      "@type": "PostalAddress",
      streetAddress: "サンポート",
      addressLocality: "高松市",
      addressRegion: "香川県",
      postalCode: "760-0019",
      addressCountry: "JP",
    },
  },
  {
    id: "actcity-hamamatsu-exhibition-hall",
    name: "アクトシティ浜松展示イベントホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "板屋町111-1",
      addressLocality: "浜松市中央区",
      addressRegion: "静岡県",
      postalCode: "430-0928",
      addressCountry: "JP",
    },
  },
  {
    id: "community-plaza-hirano",
    name: "コミュニティプラザ平野（大阪）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "長吉出戸5-3-58",
      addressLocality: "大阪市平野区",
      addressRegion: "大阪府",
      postalCode: "547-0011",
      addressCountry: "JP",
    },
  },
  {
    id: "xebio-arena-sendai",
    name: "ゼビオアリーナ仙台",
    address: {
      "@type": "PostalAddress",
      streetAddress: "あすと長町1-4-10",
      addressLocality: "仙台市太白区",
      addressRegion: "宮城県",
      postalCode: "982-0007",
      addressCountry: "JP",
    },
  },
  {
    id: "marine-messe-fukuoka-a",
    name: "マリンメッセ福岡A館",
    address: {
      "@type": "PostalAddress",
      streetAddress: "沖浜町7-1",
      addressLocality: "福岡市博多区",
      addressRegion: "福岡県",
      postalCode: "812-0031",
      addressCountry: "JP",
    },
  },
  {
    id: "music-town-otoichiba",
    name: "ミュージックタウン音市場（沖縄）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "上地1-1-1 3F",
      addressLocality: "沖縄市",
      addressRegion: "沖縄県",
      postalCode: "904-0031",
      addressCountry: "JP",
    },
  },
  {
    id: "kariya-aioi-hall",
    name: "刈谷市産業振興センター あいおいホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "相生町1-1-6",
      addressLocality: "刈谷市",
      addressRegion: "愛知県",
      postalCode: "448-0027",
      addressCountry: "JP",
    },
  },
  {
    id: "sumiyoshi-ward-center-hall",
    // eventResults.ts では表記ゆれ2種（「大阪・住吉区民センター大ホール」
    // 「錦秀会 住吉区民センター大ホール（大阪）」）が同一施設を指すため、
    // どちらの表記からも引けるようVENUE_ALIASESで吸収する。
    name: "住吉区民センター大ホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "南住吉3-15-56",
      addressLocality: "大阪市住吉区",
      addressRegion: "大阪府",
      postalCode: "558-0041",
      addressCountry: "JP",
    },
  },
  {
    id: "shinagawa-intercity-hall",
    name: "東京・品川インターシティホール",
    address: {
      "@type": "PostalAddress",
      streetAddress: "港南2-15-4 品川インターシティホール棟1F",
      addressLocality: "港区",
      addressRegion: "東京都",
      postalCode: "108-0075",
      addressCountry: "JP",
    },
  },
  {
    id: "tachikawa-stage-garden",
    name: "東京・立川ステージガーデン",
    address: {
      "@type": "PostalAddress",
      streetAddress: "緑町3-3 N1",
      addressLocality: "立川市",
      addressRegion: "東京都",
      postalCode: "190-0014",
      addressCountry: "JP",
    },
  },
  {
    id: "yokohama-buntai",
    name: "横浜BUNTAI",
    address: {
      "@type": "PostalAddress",
      streetAddress: "不老町2-7-1",
      addressLocality: "横浜市中区",
      addressRegion: "神奈川県",
      postalCode: "231-0032",
      addressCountry: "JP",
    },
  },
  {
    id: "makomanai-sekisui-heim-ice-arena",
    name: "真駒内セキスイハイムアイスアリーナ",
    address: {
      "@type": "PostalAddress",
      streetAddress: "真駒内公園1-1",
      addressLocality: "札幌市南区",
      addressRegion: "北海道",
      postalCode: "005-0017",
      addressCountry: "JP",
    },
  },
  {
    id: "yokohama-budokan",
    name: "神奈川・横浜武道館",
    address: {
      "@type": "PostalAddress",
      streetAddress: "翁町2-9-10",
      addressLocality: "横浜市中区",
      addressRegion: "神奈川県",
      postalCode: "231-0028",
      addressCountry: "JP",
    },
  },
  {
    id: "takamatsu-symbol-tower-exhibition",
    name: "高松シンボルタワー展示場",
    address: {
      "@type": "PostalAddress",
      streetAddress: "サンポート2-1（ホール棟）",
      addressLocality: "高松市",
      addressRegion: "香川県",
      postalCode: "760-0019",
      addressCountry: "JP",
    },
  },
];

// events.ts / eventResults.ts の表記ゆれ（同一施設の別名）を正式名に寄せる。
// 「不明な会場に推測住所を入れる」のではなく、既に登録済みの同一施設への
// 別表記を吸収するためのものなので、方針違反ではない。
const VENUE_ALIASES: Record<string, string> = {
  "東京・ニューピアホール": "ニューピアホール",
  "福岡・アクロス福岡イベントホール": "アクロス福岡",
  "大阪・住吉区民センター大ホール": "住吉区民センター大ホール",
  "錦秀会 住吉区民センター大ホール（大阪）": "住吉区民センター大ホール",
};

export function findVenue(venueName: string | undefined): Venue | null {
  if (!venueName) return null;
  const normalized = VENUE_ALIASES[venueName] ?? venueName;
  return VENUES.find((v) => v.name === normalized) ?? null;
}

import { SourceKey } from "./sources";

export type EventStatus = "upcoming" | "live" | "completed";

export interface BoutResult {
  winner: string | null; // null=引き分け/NC/中止
  method: string;
  round?: string;
}

export interface Bout {
  weightClass: string;
  rule?: string; // 省略時 "RIZINルール MMA 5分3R"
  fighterA: string;
  fighterB: string;
  isTitleMatch?: boolean;
  result?: BoutResult; // upcoming/liveでは undefined
  cancelled?: boolean;
  note?: string;
}

export interface MEvent {
  slug: string;
  org: SourceKey;
  status: EventStatus;
  eventName: string;
  date: string; // YYYY-MM-DD
  openTime?: string; // "12:00"
  startTime?: string; // "14:00"
  venue?: string;
  broadcast?: string[];
  sourceUrl?: string;
  // メインイベント先頭・オープニング末尾の順で格納
  bouts: Bout[];
}

export const EVENTS: MEvent[] = [
  {
    slug: "rizin-landmark-15",
    org: "rizin",
    status: "upcoming",
    eventName: "abc presents RIZIN LANDMARK 15 in HIROSHIMA",
    date: "2026-07-18",
    openTime: "12:00",
    startTime: "14:00",
    venue: "広島グリーンアリーナ",
    broadcast: ["RIZIN LIVE（U-NEXT PPV）", "フジテレビ（地上波・一部試合）"],
    sourceUrl: "https://jp.rizinff.com/_ct/17841138",
    bouts: [
      {
        weightClass: "バンタム級",
        fighterA: "ダニー・サバテロ",
        fighterB: "鹿志村仁之介",
        isTitleMatch: true,
        note: "RIZINバンタム級タイトルマッチ",
      },
      {
        weightClass: "フェザー級",
        fighterA: "カルシャガ・ダウトベック",
        fighterB: "萩原京平",
      },
      {
        weightClass: "バンタム級",
        fighterA: "太田忍",
        fighterB: "イリスベク・ティレノフ",
      },
      {
        weightClass: "ライト級",
        fighterA: "ジョニー・ケース",
        fighterB: "天弥",
      },
      {
        weightClass: "フライ級",
        fighterA: "ヒロヤ",
        fighterB: "山本アーセン",
      },
      {
        weightClass: "フライ級",
        fighterA: "篠塚辰樹",
        fighterB: "イ・ジェフン",
      },
      {
        weightClass: "女子アトム級",
        fighterA: "パク・シウ",
        fighterB: "須田萌里",
      },
      {
        weightClass: "女子アトム級",
        fighterA: "大島沙緒里",
        fighterB: "イ・イェジ",
      },
      {
        weightClass: "スーパーライト級（64.0kg契約）",
        fighterA: "昇侍",
        fighterB: "梅野源治",
      },
      {
        weightClass: "フェザー級",
        fighterA: "鈴木博昭",
        fighterB: "宮川日向",
      },
      {
        weightClass: "ウェルター級（77.0kg契約）",
        fighterA: "佐々木信治",
        fighterB: "林RICE陽太",
      },
      {
        weightClass: "スーパーバンタム級（54.5kg契約）",
        rule: "キックボクシング",
        fighterA: "芝宏二郎",
        fighterB: "遥心",
      },
      // OPENING FIGHTS
      {
        weightClass: "ライト級（71.0kg契約）",
        fighterA: "シヴァエフ",
        fighterB: "ベンジャミン",
        note: "オープニングファイト",
      },
      {
        weightClass: "女子アトム級",
        fighterA: "HIME",
        fighterB: "平田彩音",
        note: "オープニングファイト",
      },
      {
        weightClass: "バンタム級",
        fighterA: "神田T800周一",
        fighterB: "長野将大",
        note: "オープニングファイト",
      },
      {
        weightClass: "フライ級（57.0kg契約）",
        fighterA: "田中仁",
        fighterB: "健太朗",
        rule: "アマチュアMMAルール",
        note: "オープニングファイト",
      },
    ],
  },
  {
    slug: "rizin-54",
    org: "rizin",
    status: "upcoming",
    eventName: "RIZIN.54",
    date: "2026-08-11",
    openTime: "12:00",
    startTime: "14:00",
    venue: "TOYOTA ARENA TOKYO",
    broadcast: ["RIZIN LIVE（U-NEXT PPV）", "フジテレビ（地上波・一部試合）"],
    sourceUrl: "https://jp.rizinff.com/_ct/17846026",
    bouts: [
      {
        weightClass: "フェザー級",
        fighterA: "クレベル・コイケ",
        fighterB: "秋元強真",
      },
      {
        weightClass: "バンタム級",
        fighterA: "佐藤将光",
        fighterB: "パッチー・ミックス",
      },
      {
        weightClass: "フェザー級",
        fighterA: "摩嶋一整",
        fighterB: "武田光司",
      },
      {
        weightClass: "バンタム級",
        fighterA: "後藤丈治",
        fighterB: "アジズベク・テミロフ",
      },
      {
        weightClass: "フライ級",
        fighterA: "伊藤裕樹",
        fighterB: "アリベク・ガジャマトフ",
      },
      {
        weightClass: "フライ級",
        fighterA: "平本丈",
        fighterB: "ジョリー",
      },
      {
        weightClass: "女子アトム級",
        fighterA: "ケイト・ロータス",
        fighterB: "NOEL",
      },
      {
        weightClass: "フェザー級",
        fighterA: "水野新太",
        fighterB: "リー・カイウェン",
      },
      {
        weightClass: "ウェルター級（69.0kg契約）",
        fighterA: "直樹",
        fighterB: "細川一颯",
      },
    ],
  },
];

export function getEvent(slug: string): MEvent | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

export function getUpcomingEvents(): MEvent[] {
  return EVENTS.filter((e) => e.status === "upcoming" || e.status === "live").sort(
    (a, b) => (a.date < b.date ? -1 : 1)
  );
}

/** 指定した選手名が含まれる未来のイベントと試合カードを返す */
export function findNextFight(
  fighterName: string
): { event: MEvent; bout: Bout } | null {
  for (const event of getUpcomingEvents()) {
    const bout = event.bouts.find(
      (b) =>
        !b.cancelled &&
        (b.fighterA === fighterName || b.fighterB === fighterName)
    );
    if (bout) return { event, bout };
  }
  return null;
}

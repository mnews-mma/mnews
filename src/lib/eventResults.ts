import { SourceKey } from "./sources";

export interface FightResult {
  weightClass: string;
  fighterA: string;
  fighterB: string;
  winner: string | null; // null の場合は引き分け・中止など
  method: string;
  round?: string;
}

export interface EventResult {
  slug: string;
  org: SourceKey;
  eventName: string;
  date: string; // YYYY-MM-DD
  venue?: string;
  sourceUrl?: string;
  fights: FightResult[];
}

export const EVENT_RESULTS: EventResult[] = [
  {
    slug: "pancrase-363",
    org: "pancrase",
    eventName: "PANCRASE 363",
    date: "2026-06-28",
    venue: "東京・ニューピアホール",
    sourceUrl: "https://www.pancrase.co.jp/data/result/2026/0628.html",
    fights: [
      {
        weightClass: "フェザー級暫定王座決定戦",
        fighterA: "オタベク・ラジャボフ",
        fighterB: "木下尚祐",
        winner: "オタベク・ラジャボフ",
        method: "三角絞め",
        round: "3R 2:45",
      },
      {
        weightClass: "ライト級",
        fighterA: "粕谷優介",
        fighterB: "神谷大智",
        winner: "神谷大智",
        method: "TKO（グラウンドパンチ）",
        round: "2R 3:39",
      },
      {
        weightClass: "フライ級",
        fighterA: "谷村泰嘉",
        fighterB: "眞藤源太",
        winner: "眞藤源太",
        method: "ニンジャチョーク",
        round: "3R 4:25",
      },
      {
        weightClass: "ストロー級",
        fighterA: "氏原快聖",
        fighterB: "寺岡拓永",
        winner: null,
        method: "判定（0-0）— ドロー",
        round: "3R 5:00",
      },
      {
        weightClass: "フェザー級",
        fighterA: "亀井晨佑",
        fighterB: "畠山佑介",
        winner: "畠山佑介",
        method: "TKO（グラウンドパンチ）",
        round: "3R 3:50",
      },
      {
        weightClass: "ウェルター級",
        fighterA: "武者光太郎",
        fighterB: "萱沼哲平",
        winner: "武者光太郎",
        method: "TKO（グラウンドパンチ）",
        round: "2R 2:50",
      },
      {
        weightClass: "ライト級",
        fighterA: "下山楓人",
        fighterB: "宮本樹",
        winner: "宮本樹",
        method: "TKO（グラウンドパンチ）",
        round: "2R 4:13",
      },
      {
        weightClass: "バンタム級",
        fighterA: "筑紫淳平",
        fighterB: "鈴木優太郎",
        winner: "筑紫淳平",
        method: "裸絞め",
        round: "1R 1:12",
      },
      {
        weightClass: "バンタム級",
        fighterA: "増田蓮央",
        fighterB: "村社大河",
        winner: "増田蓮央",
        method: "フロントチョーク",
        round: "1R 2:36",
      },
      {
        weightClass: "バンタム級",
        fighterA: "抜井祥輝",
        fighterB: "近藤優馬",
        winner: "近藤優馬",
        method: "判定（0-3）",
        round: "3R 5:00",
      },
      {
        weightClass: "フライ級",
        fighterA: "小野智也",
        fighterB: "前川慧",
        winner: null,
        method: "試合中止（前川 計量失格）",
      },
    ],
  },
  {
    slug: "shooto-torao-2026",
    org: "shooto",
    eventName: "Lemino修斗TORAO",
    date: "2026-06-28",
    venue: "福岡・アクロス福岡イベントホール",
    sourceUrl: "https://j-shooto.com/2026/06/28/post-50832/",
    fights: [
      {
        weightClass: "フェザー級（-65.8kg）",
        fighterA: "TOMA",
        fighterB: "田中半蔵",
        winner: "TOMA",
        method: "TKO",
        round: "2R 1:09",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "野瀬翔平",
        fighterB: "青柳洸志",
        winner: "野瀬翔平",
        method: "肩固め",
        round: "1R 3:19",
      },
      {
        weightClass: "フライ級（-56.7kg）",
        fighterA: "上田将年",
        fighterB: "打威致",
        winner: "打威致",
        method: "TKO",
        round: "1R 3:51",
      },
      {
        weightClass: "フェザー級（-65.8kg）",
        fighterA: "ナイン・ダイネッシュ",
        fighterB: "久保村佳照",
        winner: "ナイン・ダイネッシュ",
        method: "TKO",
        round: "1R 1:13",
      },
      {
        weightClass: "ストロー級（52.2kg）",
        fighterA: "緑真作",
        fighterB: "梅木勇徳",
        winner: "梅木勇徳",
        method: "判定（0-3）",
      },
      {
        weightClass: "フェザー級（-65.8kg）",
        fighterA: "本松要",
        fighterB: "柿原翔太",
        winner: "柿原翔太",
        method: "KO",
        round: "2R 2:08",
      },
      {
        weightClass: "フェザー級（-65.8kg）",
        fighterA: "山田龍馬",
        fighterB: "深町巧",
        winner: "深町巧",
        method: "裸絞め",
        round: "2R 2:02",
      },
      {
        weightClass: "フライ級（-56.7kg）",
        fighterA: "高宮稜",
        fighterB: "竹本葵天",
        winner: null,
        method: "判定（1-0）— ドロー",
      },
      {
        weightClass: "ストロー級（52.2kg）",
        fighterA: "新誠",
        fighterB: "佐野光輝",
        winner: "佐野光輝",
        method: "三角絞め",
        round: "1R 2:19",
      },
      {
        weightClass: "ストロー級（52.2kg）",
        fighterA: "和氣輝央",
        fighterB: "高井裕翔",
        winner: "高井裕翔",
        method: "KO",
        round: "1R 0:28",
      },
    ],
  },
];

export function getEventResult(slug: string): EventResult | undefined {
  return EVENT_RESULTS.find((e) => e.slug === slug);
}

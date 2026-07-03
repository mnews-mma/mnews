import { SourceKey } from "./sources";

export type EventStatus = "upcoming" | "live" | "completed";

export interface BoutResult {
  winner: string | null; // null=引き分け/NC/中止
  method: string;
  round?: string;
}

export interface Bout {
  weightClass: string;
  rule?: string; // 省略時はMMAルール。"キックボクシング"等で上書き
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
  affiliateUrl?: string; // U-NEXTアフィリエイト等（将来用）
  ticketNote?: string; // チケット情報（完売・当日券なし等）
  sourceUrl?: string;
  // 同日同会場など関連大会のslug
  relatedEventSlugs?: string[];
  // メインイベント先頭・オープニング末尾の順で格納
  bouts: Bout[];
}

// ─────────────────────────────────────────────
// 体重区分マッピング（団体別に保持）
// weightClass フィールドへの表記ルール:
//   該当する名称クラスがある場合 → "クラス名（X.Xkg）"
//   対応クラスがない（キャッチウェイト等） → "X.Xkg契約"
// ─────────────────────────────────────────────

/** RIZIN MMA 体重区分（RIZIN公式値） */
export const RIZIN_WEIGHT_KG: Record<string, number> = {
  "女子アトム級": 47.6,
  "女子フライ級": 49.0,
  "フライ級": 57.0,
  "バンタム級": 61.0,
  "フェザー級": 66.0,
  "ライト級": 71.0,
  "ウェルター級": 77.1,
  "ミドル級": 85.0,
  "ライトヘビー級": 93.0,
  "ヘビー級": 120.0,
};

/** DEEP MMA 体重区分 */
export const DEEP_WEIGHT_KG: Record<string, number> = {
  "DEEPストロー級": 52.2,
  "DEEPフライ級": 56.7,
  "DEEPバンタム級": 61.2,
  "DEEPフェザー級": 65.8,
  "DEEPライト級": 70.3,
  "DEEPウェルター級": 77.1,
  "DEEPミドル級": 83.9,
  "DEEPスーパーヘビー級": 120.2,
};

/** DEEP JEWELS 体重区分 */
export const DEEP_JEWELS_WEIGHT_KG: Record<string, number> = {
  "DEEPJEWELSミクロ級": 46.0,
  "DEEPJEWELSストロー級": 48.0,
  "DEEPJEWELSバンタム級": 54.0,
  "DEEPJEWELSフライ級": 57.0,
  "DEEPJEWELSフェザー級": 62.0,
};

/** PANCRASE / 修斗 体重区分 */
export const PANCRASE_SHOOTO_WEIGHT_KG: Record<string, number> = {
  "ストロー級": 52.2,
  "フライ級": 56.7,
  "バンタム級": 61.2,
  "フェザー級": 65.8,
  "ライト級": 70.3,
  "ウェルター級": 77.1,
  "ミドル級": 83.9,
};

// ─────────────────────────────────────────────

export const EVENTS: MEvent[] = [
  {
    slug: "rizin-landmark-15",
    org: "rizin",
    status: "upcoming",
    eventName: "RIZIN LANDMARK 15 in HIROSHIMA",
    date: "2026-07-18",
    openTime: "12:00",
    startTime: "14:00",
    venue: "広島グリーンアリーナ",
    broadcast: ["RIZIN LIVE（U-NEXT PPV）", "フジテレビ（地上波・一部試合）"],
    sourceUrl: "https://jp.rizinff.com/_ct/17841138",
    bouts: [
      {
        weightClass: "バンタム級（61.0kg）",
        fighterA: "ダニー・サバテロ",
        fighterB: "鹿志村仁之介",
        isTitleMatch: true,
        note: "RIZINバンタム級タイトルマッチ",
      },
      {
        weightClass: "フェザー級（66.0kg）",
        fighterA: "カルシャガ・ダウトベック",
        fighterB: "萩原京平",
      },
      {
        weightClass: "バンタム級（61.0kg）",
        fighterA: "太田忍",
        fighterB: "イリスベク・ティレノフ",
      },
      {
        weightClass: "ライト級（71.0kg）",
        fighterA: "ジョニー・ケース",
        fighterB: "天弥",
      },
      {
        weightClass: "フライ級（57.0kg）",
        fighterA: "ヒロヤ",
        fighterB: "山本アーセン",
      },
      {
        weightClass: "フライ級（57.0kg）",
        fighterA: "篠塚辰樹",
        fighterB: "イ・ジェフン",
      },
      {
        weightClass: "女子アトム級（47.6kg）",
        fighterA: "パク・シウ",
        fighterB: "須田萌里",
      },
      {
        weightClass: "女子アトム級（47.6kg）",
        fighterA: "大島沙緒里",
        fighterB: "イ・イェジ",
      },
      {
        weightClass: "64.0kg契約",
        fighterA: "昇侍",
        fighterB: "梅野源治",
      },
      {
        weightClass: "フェザー級（66.0kg）",
        fighterA: "鈴木博昭",
        fighterB: "宮川日向",
      },
      {
        weightClass: "77.0kg契約",
        fighterA: "佐々木信治",
        fighterB: "林RICE陽太",
      },
      {
        weightClass: "54.5kg契約",
        rule: "キックボクシング",
        fighterA: "芝宏二郎",
        fighterB: "遥心",
      },
      {
        weightClass: "71.0kg契約",
        fighterA: "シヴァエフ",
        fighterB: "ベンジャミン",
        note: "オープニングファイト",
      },
      {
        weightClass: "女子アトム級（47.6kg）",
        fighterA: "HIME",
        fighterB: "平田彩音",
        note: "オープニングファイト",
      },
      {
        weightClass: "バンタム級（61.0kg）",
        fighterA: "神田T800周一",
        fighterB: "長野将大",
        note: "オープニングファイト",
      },
      {
        weightClass: "57.0kg契約",
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
        weightClass: "フェザー級（66.0kg）",
        fighterA: "クレベル・コイケ",
        fighterB: "秋元強真",
      },
      {
        weightClass: "バンタム級（61.0kg）",
        fighterA: "佐藤将光",
        fighterB: "パッチー・ミックス",
      },
      {
        weightClass: "フェザー級（66.0kg）",
        fighterA: "摩嶋一整",
        fighterB: "武田光司",
      },
      {
        weightClass: "バンタム級（61.0kg）",
        fighterA: "後藤丈治",
        fighterB: "アジズベク・テミロフ",
      },
      {
        weightClass: "フライ級（57.0kg）",
        fighterA: "伊藤裕樹",
        fighterB: "アリベク・ガジャマトフ",
      },
      {
        weightClass: "フライ級（57.0kg）",
        fighterA: "平本丈",
        fighterB: "ジョリー",
      },
      {
        weightClass: "女子アトム級（47.6kg）",
        fighterA: "ケイト・ロータス",
        fighterB: "NOEL",
      },
      {
        weightClass: "フェザー級（66.0kg）",
        fighterA: "水野新太",
        fighterB: "リー・カイウェン",
      },
      {
        weightClass: "69.0kg契約",
        fighterA: "直樹",
        fighterB: "細川一颯",
      },
    ],
  },
  {
    slug: "lemino-shooto-7",
    org: "shooto",
    status: "upcoming",
    eventName: "Lemino修斗.7",
    date: "2026-07-13",
    openTime: "17:30",
    startTime: "18:00",
    venue: "後楽園ホール",
    broadcast: ["Lemino"],
    sourceUrl: "https://j-shooto.com/2026/06/11/post-48459/",
    bouts: [
      // カード変更: 藤田大和 負傷欠場 → 高岡宏気が緊急代役（フライ級→バンタム級 61.2kgに変更）
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "宇野薫",
        fighterB: "児山佳宏",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "高岡宏気",
        fighterB: "マーウィン・キランテ",
        note: "藤田大和負傷欠場→高岡宏気が緊急代役（フライ級→バンタム級61.2kgに変更）",
      },
      {
        weightClass: "フライ級（56.7kg）",
        rule: "+1ポンドOK",
        fighterA: "シモンスズキ",
        fighterB: "シンバートル・バットエルデネ",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        rule: "+1ポンドOK",
        fighterA: "藤田ムネノリ",
        fighterB: "ジョン・オルニド",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "下間英史",
        fighterB: "山本敦章",
      },
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "松村海青",
        fighterB: "井上理久",
      },
      {
        weightClass: "フライ級（56.7kg）",
        fighterA: "饒平名知靖",
        fighterB: "村泉空",
      },
      {
        weightClass: "フライ級（56.7kg）",
        fighterA: "玉城悠",
        fighterB: "三浦颯太",
      },
      {
        weightClass: "ライト級（70.3kg）",
        fighterA: "モリシマン",
        fighterB: "手島響",
      },
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "松田拳哉",
        fighterB: "佐藤大知",
        rule: "トライアウト",
        note: "オープニングファイト",
      },
    ],
  },
  {
    slug: "pancrase-364",
    org: "pancrase",
    status: "upcoming",
    eventName: "PANCRASE 364",
    date: "2026-07-26",
    openTime: "12:15",
    startTime: "12:30",
    venue: "ニューピアホール",
    broadcast: ["U-NEXT（国内独占）", "UFC FIGHT PASS（海外）"],
    affiliateUrl: "", // U-NEXTアフィリエイトURL（実装予定）
    sourceUrl: "https://www.pancrase.co.jp/tour/2026/pancrase364/index.html",
    bouts: [
      {
        weightClass: "ストロー級（52.2kg）",
        fighterA: "佐々木瞬真",
        fighterB: "船田電池",
        isTitleMatch: false,
        note: "ストロー級次期挑戦者決定戦",
      },
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "カリベク・アルジクル ウール",
        fighterB: "三宅輝砂",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "髙城光弘",
        fighterB: "佐藤ゆうじ",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "前田浩平",
        fighterB: "小原統哉",
      },
      {
        weightClass: "ライト級（70.3kg）",
        fighterA: "藤村健悟",
        fighterB: "佐藤力斗",
      },
      // プレリミナリー
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "小野瑛大",
        fighterB: "山田浩平",
        note: "プレリミナリー",
      },
      {
        weightClass: "フライ級（56.7kg）",
        fighterA: "米泉乾太",
        fighterB: "細川勇哉",
        note: "プレリミナリー",
      },
      {
        weightClass: "ストロー級（52.2kg）",
        fighterA: "山口秀斗",
        fighterB: "猿魔",
        note: "プレリミナリー",
      },
    ],
  },
  {
    slug: "deep-132-impact",
    org: "deep",
    status: "upcoming",
    eventName: "DEEP 132 IMPACT",
    date: "2026-07-05",
    openTime: "13:30",
    startTime: "14:00",
    venue: "ニューピアホール",
    broadcast: ["U-NEXT（13:55配信開始）", "DEEP/DEEP JEWELSメンバーシップ"],
    ticketNote: "全席完売・当日券の販売はありません",
    sourceUrl: "https://www.deep2001.com/deep-132-impact/",
    bouts: [
      {
        weightClass: "DEEPライト級（70.3kg）",
        fighterA: "相本宗輝",
        fighterB: "山田聖真",
        note: "メインイベント",
      },
      {
        // 猿寿健太のコンディション不良によりフライ級から58kg以下の契約体重に変更
        weightClass: "58.0kg契約",
        fighterA: "猿寿健太",
        fighterB: "火の鳥",
        note: "セミファイナル",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "五明宏人",
        fighterB: "太田将吾",
      },
      {
        weightClass: "DEEPライト級（70.3kg）",
        fighterA: "神田コウヤ",
        fighterB: "ケンシロウ",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "河村泰博",
        fighterB: "山本有人",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "鈴木大晟",
        fighterB: "高橋正親",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "マサト・ナカムラ",
        fighterB: "斎藤璃貴",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "松井優磨",
        fighterB: "石原射",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "石坂空志",
        fighterB: "矢野武蔵",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "武利侑都",
        fighterB: "横内三旺",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        rule: "アマチュアSルール",
        fighterA: "秋元優志",
        fighterB: "荒井夕翔",
        note: "オープニングファイト",
      },
      {
        // 特別枠: 引退エキシビション（相手は斎藤裕/石渡伸太郎/上田将勝の複数対戦）
        weightClass: "エキシビション",
        rule: "グラップリングルール 2分3R",
        fighterA: "越智晴雄",
        fighterB: "斎藤裕・石渡伸太郎・上田将勝",
        note: "引退エキシビションマッチ",
      },
    ],
  },
  {
    slug: "deep-tokyo-impact-2026-4th",
    org: "deep",
    status: "upcoming",
    eventName: "DEEP TOKYO IMPACT 2026 4th ROUND",
    date: "2026-09-06",
    venue: "ニューピアホール",
    sourceUrl: "https://www.deep2001.com/deep-tokyo-impact-2026-4th-round/",
    relatedEventSlugs: ["deep-jewels-54"],
    bouts: [
      {
        weightClass: "59.0kg契約",
        fighterA: "窪田泰斗",
        fighterB: "飴山聖也",
        note: "メイン",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "木下カラテ",
        fighterB: "杉野亜蓮",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "関鉄矢",
        fighterB: "狩野優",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "橋本優大",
        fighterB: "須田雄律",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "唐沢タツヤ",
        fighterB: "杉野光星",
      },
      {
        weightClass: "DEEPストロー級（52.2kg）",
        fighterA: "豪瑠",
        fighterB: "高橋俊哉",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "黒岡裕真",
        fighterB: "坂本岳",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "安永吏成",
        fighterB: "平井聡一朗",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "ダイヤ",
        fighterB: "ヴィニシウス",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "藤井連",
        fighterB: "権藤悠太郎",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "山口コウタ",
        fighterB: "佐藤修斗",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "小笠原孝成",
        fighterB: "尚太郎",
      },
      // オープニングファイト（アマチュアSルール）
      {
        weightClass: "DEEPフライ級（56.7kg）",
        rule: "アマチュアSルール",
        fighterA: "岸翔大",
        fighterB: "サカテロ",
        note: "オープニングファイト",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        rule: "アマチュアSルール",
        fighterA: "サンシャイン",
        fighterB: "上田遥斗",
        note: "オープニングファイト",
      },
    ],
  },
  {
    slug: "deep-jewels-54",
    org: "deep",
    status: "upcoming",
    eventName: "DEEP JEWELS 54",
    date: "2026-09-06",
    venue: "ニューピアホール",
    sourceUrl: "https://www.deep2001.com/deep-jewels-54/",
    relatedEventSlugs: ["deep-tokyo-impact-2026-4th"],
    bouts: [
      {
        weightClass: "49.0kg契約",
        fighterA: "彩綺",
        fighterB: "竹林愛留",
      },
      {
        weightClass: "54.0kg契約",
        fighterA: "ののか",
        fighterB: "重田ほのか",
      },
      {
        weightClass: "DEEPJEWELSバンタム級（54.0kg）",
        fighterA: "百湖",
        fighterB: "キューティ",
      },
      {
        weightClass: "49.0kg契約",
        fighterA: "海咲イルカ",
        fighterB: "月井隼南",
      },
      {
        weightClass: "DEEPJEWELSストロー級（48.0kg）",
        fighterA: "桐生祐子",
        fighterB: "横瀬友愛",
      },
      {
        weightClass: "DEEPJEWELSミクロ級（46.0kg）",
        fighterA: "大井すず",
        fighterB: "知名眞陽菜",
      },
      {
        weightClass: "DEEPJEWELSストロー級（48.0kg）",
        fighterA: "アラミ",
        fighterB: "堀内美沙紀",
      },
      {
        weightClass: "49.0kg契約",
        fighterA: "サラ",
        fighterB: "渡邊花美",
      },
      {
        weightClass: "50.0kg契約",
        fighterA: "横瀬美久",
        fighterB: "Marin",
      },
      {
        weightClass: "DEEPJEWELSストロー級（48.0kg）",
        fighterA: "堀井かりん",
        fighterB: "JUICY",
      },
      // アマチュアSルール
      {
        weightClass: "50.0kg契約",
        rule: "アマチュアSルール",
        fighterA: "あきぴ",
        fighterB: "セアリ",
        note: "オープニングファイト",
      },
      {
        weightClass: "50.0kg契約",
        rule: "アマチュアSルール",
        fighterA: "横江明日香",
        fighterB: "谷山心優",
        note: "オープニングファイト",
      },
      {
        weightClass: "50.0kg契約",
        rule: "アマチュアSルール",
        fighterA: "和智美音",
        fighterB: "山内梨緒",
        note: "オープニングファイト",
      },
    ],
  },
  {
    slug: "shooto-2026-vol5",
    org: "shooto",
    status: "upcoming",
    eventName: "PROFESSIONAL SHOOTO 2026 Vol.5",
    date: "2026-07-20",
    openTime: "17:00",
    startTime: "17:30",
    venue: "後楽園ホール",
    sourceUrl: "https://www.shooto-mma.com/schedule/?id=254",
    bouts: [
      {
        weightClass: "女子スーパーアトム級（48.0kg）",
        fighterA: "渡辺彩華",
        fighterB: "高本千代",
        isTitleMatch: true,
        note: "修斗世界女子スーパーアトム級タイトルマッチ 5分5R",
      },
      {
        weightClass: "ミドル級（83.9kg）",
        fighterA: "岩﨑大河",
        fighterB: "荒井勇二",
        note: "5分5R",
      },
      {
        weightClass: "フライ級（56.7kg）",
        fighterA: "関口祐冬",
        fighterB: "中池武寛",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "チョウ・スソン",
        fighterB: "ジェイク・ムラタ",
      },
      {
        weightClass: "女子アトム級（46.0kg）",
        fighterA: "中村未来",
        fighterB: "嶋屋澪",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "武田勇輝",
        fighterB: "上杉隼哉",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "松下祐介",
        fighterB: "伊集龍皇",
      },
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "澤江優侍",
        fighterB: "塩沼諒太",
      },
      {
        weightClass: "バンタム級（61.2kg）",
        fighterA: "人見礼王",
        fighterB: "ライダーHIRO",
      },
      {
        weightClass: "フェザー級（65.8kg）",
        fighterA: "田中永遠",
        fighterB: "加藤岡善",
      },
    ],
  },
  {
    slug: "deep-fight-challenge-2026-2nd",
    org: "deep",
    status: "upcoming",
    eventName: "DEEP FIGHT CHALLENGE 2026 2nd ROUND",
    date: "2026-07-24",
    openTime: "19:00",
    startTime: "19:30",
    venue: "恵比寿ガーデンルーム",
    sourceUrl: "https://www.deep2001.com/deep-fight-challenge-2026-2nd-round/",
    bouts: [
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "坂野周平",
        fighterB: "井上セナ",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "マイティ・saw",
        fighterB: "中尾響",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "朝比奈龍希",
        fighterB: "川口海翔",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "今野蓮弥",
        fighterB: "今井風快",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        rule: "アマチュアSルール",
        fighterA: "琥",
        fighterB: "田中悠翔",
        note: "オープニングファイト",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        rule: "アマチュアSルール",
        fighterA: "大越充悟",
        fighterB: "佐々木琢磨",
        note: "オープニングファイト",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        rule: "アマチュアSルール",
        fighterA: "福嶋司",
        fighterB: "国分獅斗",
        note: "オープニングファイト",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        rule: "アマチュアSルール",
        fighterA: "森谷風真",
        fighterB: "齋藤未来",
        note: "オープニングファイト",
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
  // 選手DBとイベントデータで全角/半角スペースの有無が揺れることがあるため正規化して比較する
  const norm = (s: string) => s.replace(/[\s　]/g, "");
  const normName = norm(fighterName);
  for (const event of getUpcomingEvents()) {
    const bout = event.bouts.find(
      (b) =>
        !b.cancelled &&
        (norm(b.fighterA) === normName || norm(b.fighterB) === normName)
    );
    if (bout) return { event, bout };
  }
  return null;
}

/** 指定した2選手の組み合わせが未来のイベントで対戦カードとして組まれていれば返す（順不同） */
export function findMatchupEvent(
  nameA: string,
  nameB: string
): { event: MEvent; bout: Bout } | null {
  // 選手DBとイベントデータで全角/半角スペースの有無が揺れることがあるため正規化して比較する
  const norm = (s: string) => s.replace(/[\s　]/g, "");
  const normA = norm(nameA);
  const normB = norm(nameB);
  for (const event of getUpcomingEvents()) {
    const bout = event.bouts.find((b) => {
      if (b.cancelled) return false;
      const bA = norm(b.fighterA);
      const bB = norm(b.fighterB);
      return (bA === normA && bB === normB) || (bA === normB && bB === normA);
    });
    if (bout) return { event, bout };
  }
  return null;
}

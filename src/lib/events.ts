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
  // 引退エキシビ等の特別マッチ。試合番号を持たないため、詳細ページでは
  // 主催掲載に合わせメインイベントの直上に表示する(末尾送りにしない)。
  isExhibition?: boolean;
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
  ticketUrl?: string; // チケット販売URL（構造化データのoffersに出力、任意）
  scheduleNote?: string; // 開場・開始時刻が「予定」の場合などの注記
  // 参戦予定（対戦相手未定）の選手。RIZINの定番パターンで、対戦カード確定後は
  // bouts に移して本リストから外す運用（汎用構造。特定大会専用ではない）
  expectedFighters?: string[];
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
    slug: "pancrase-365",
    org: "pancrase",
    status: "upcoming",
    eventName: "PANCRASE 365",
    date: "2026-09-06",
    venue: "立川ステージガーデン",
    sourceUrl: "https://www.pancrase.co.jp/tour/2026/pancrase365/index.html",
    bouts: [],
  },
  {
    slug: "cho-rizin-5",
    org: "rizin",
    status: "upcoming",
    eventName: "超RIZIN.5 浪速の超復活祭り",
    date: "2026-09-10",
    openTime: "15:00",
    startTime: "17:00",
    scheduleNote: "開場・開演時間は予定です（変更の可能性あり）",
    venue: "京セラドーム大阪",
    broadcast: ["未定（決定次第更新）"],
    sourceUrl: "https://jp.rizinff.com/_ct/17834937",
    // カード追加発表が続く大会。参戦予定→対戦カード確定時は bouts へ移動する
    expectedFighters: ["朝倉未来", "平本蓮", "斎藤裕", "鈴木千裕", "YA-MAN"],
    bouts: [
      {
        weightClass: "49.0kg契約",
        rule: "RIZIN MMAルール 5分3R",
        fighterA: "RENA",
        fighterB: "ナターシャ・クジュティナ",
      },
    ],
  },
  {
    // DEEP 132(2026-07-05)は開催済み → EVENT_RESULTS(deep-132-impact)へ移動。
    slug: "deep-133-impact",
    org: "deep",
    status: "upcoming",
    eventName: "DEEP 133 IMPACT",
    date: "2026-09-13",
    openTime: "17:30",
    startTime: "18:00",
    venue: "後楽園ホール",
    broadcast: ["U-NEXT（配信予定）", "DEEP/DEEP JEWELSメンバーシップ"],
    sourceUrl: "https://www.deep2001.com/deep-133-impact/",
    bouts: [
      {
        weightClass: "DEEPメガトン級",
        fighterA: "大成",
        fighterB: "シビサイ頌真",
        isTitleMatch: true,
        note: "DEEPメガトン級タイトルマッチ（メインイベント）",
      },
      {
        weightClass: "DEEPストロー級（52.2kg）",
        fighterA: "北方大地",
        fighterB: "新井丈",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "海飛",
        fighterB: "三井俊希",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "白川ダーク陸斗",
        fighterB: "瀧澤謙太",
      },
      {
        weightClass: "DEEPライト級（70.3kg）",
        fighterA: "北岡悟",
        fighterB: "山崎弥十朗",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "中村大介",
        fighterB: "椿飛鳥",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "雅駿介",
        fighterB: "中務太陽",
      },
      {
        weightClass: "DEEPメガトン級",
        fighterA: "誠悟",
        fighterB: "MAX吉田",
      },
      {
        weightClass: "DEEPフェザー級（65.8kg）",
        fighterA: "鬼山班猫",
        fighterB: "奥村アイル",
      },
      {
        weightClass: "DEEPフライ級（56.7kg）",
        fighterA: "松岡疾人",
        fighterB: "仁井田右楽",
      },
      {
        weightClass: "DEEPバンタム級（61.2kg）",
        fighterA: "寉岡樹記",
        fighterB: "高尾凌生",
        note: "オープニングファイト",
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
        weightClass: "女子スーパーアトム級（50.0kg）",
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
        weightClass: "女子アトム級（47.6kg）",
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

/**
 * 対戦カード確定（bout）を最優先、無ければ「参戦予定（相手未定）」を返す。
 * 対戦相手が決まり bouts に追加されると自動的に bout 側へ切り替わる。
 */
export function findNextAppearance(
  fighterName: string
):
  | { kind: "bout"; event: MEvent; bout: Bout }
  | { kind: "expected"; event: MEvent }
  | null {
  const withBout = findNextFight(fighterName);
  if (withBout) return { kind: "bout", ...withBout };
  const norm = (s: string) => s.replace(/[\s　]/g, "");
  const normName = norm(fighterName);
  for (const event of getUpcomingEvents()) {
    if (event.expectedFighters?.some((n) => norm(n) === normName)) {
      return { kind: "expected", event };
    }
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

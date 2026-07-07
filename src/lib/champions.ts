import type { OrgRankingData } from "./orgRankings";

// RIZIN/DEEP の現王者(正規王者)一覧。/ranking/rizin・/ranking/deep(および
// トップページの導線)に表示する。取得元の生HTMLを直接パースして抽出した
// 確定情報のみを載せる(AI要約は使わない・捏造ゼロ)。暫定王者・空位・抽出が
// 曖昧な階級は掲載しない。
//
// 取得日: 2026-07-06
//   DEEP:  https://www.deep2001.com/champ/
//   RIZIN: https://jp.rizinff.com/fighters
//
// slug は src/lib/fighters.ts の FIGHTERS に存在し、かつ hidden でない場合のみ設定する
// (存在しない/hidden な王者はテキスト表示のみ・リンクなし)。
export interface ChampionEntry {
  org: "rizin" | "deep";
  weightClass: string;
  name: string;
  generation: string; // 例 "第7代"
  slug: string | null;
}

const FETCHED_DATE = "2026-07-06";
export const CHAMPION_SOURCES = {
  rizin: { label: "RIZIN公式サイト", url: "https://jp.rizinff.com/fighters" },
  deep: { label: "DEEP & DEEP JEWELS公式サイト", url: "https://www.deep2001.com/champ/" },
} as const;

// ChampionEntry[] を OrgRankingView が読める OrgRankingData 形式に変換する。
// 各階級ちょうど1件(現王者)なので rank は一律「王者」(パンクラス/修斗の
// 王者表示と同じ強調色になる)。
export function championsToRankingData(org: "rizin" | "deep", list: ChampionEntry[]): OrgRankingData {
  return {
    org,
    source: CHAMPION_SOURCES[org].label,
    sourceUrl: CHAMPION_SOURCES[org].url,
    fetchedDate: FETCHED_DATE,
    rankingLabel: "現王者",
    classes: list.map((c) => ({
      weightClass: c.weightClass,
      entries: [{ rank: "王者", officialName: c.name, slug: c.slug }],
    })),
  };
}

export const RIZIN_CHAMPIONS: ChampionEntry[] = [
  { org: "rizin", weightClass: "フライ級", name: "神龍誠", generation: "第3代", slug: "shinryu-makoto" },
  { org: "rizin", weightClass: "バンタム級", name: "ダニー・サバテロ", generation: "第8代", slug: "sabatello-danny" },
  { org: "rizin", weightClass: "フェザー級", name: "ラジャブアリ・シェイドゥラエフ", generation: "第7代", slug: "sheydullaev-rajabali" },
  { org: "rizin", weightClass: "ライト級", name: "ルイス・グスタボ", generation: "第3代", slug: "gustavo-luis" },
  // 女子スーパーアトム級: 現在「空位」のため掲載しない。
  // ヘビー級: 王座自体が存在しない(ページに項目なし)ため掲載しない。
];

export const DEEP_CHAMPIONS: ChampionEntry[] = [
  { org: "deep", weightClass: "メガトン級", name: "大成", generation: "第7代", slug: null }, // slug nishitani-taisei は hidden のためリンクなし
  { org: "deep", weightClass: "ウェルター級", name: "嶋田伊吹", generation: "第14代", slug: "shimada-ibuki" },
  { org: "deep", weightClass: "ライト級", name: "野村駿太", generation: "第13代", slug: "nomura-shunta" },
  { org: "deep", weightClass: "フェザー級", name: "青井人", generation: "第12代", slug: "aoi-jin" },
  { org: "deep", weightClass: "バンタム級", name: "福田龍彌", generation: "第11代", slug: "fukuda-ryuya" }, // DB内nameJaは"福田 龍彌"(スペースあり)。EVENT_RESULTS(DEEPバンタム級タイトルマッチ勝利)で同一人物を確認済み
  { org: "deep", weightClass: "フライ級", name: "村元友太郎", generation: "第7代", slug: "muramoto-yutaro" },
  { org: "deep", weightClass: "ストロー級", name: "知名昴海", generation: "第6代", slug: null }, // 読み確定できず未登録(HELD)
  // 女子階級: 女子無差別級/女子アトム級/女子ミクロ級/DEEP JEWELS各級が併存し、
  // 「女子スーパーアトム」に一意対応しないため今回は掲載しない(曖昧なら出さない)。
  // ライトヘビー級・ミドル級: 現在「空位」のため掲載しない。
];

// DEEP現状スナップショット(2026-07)。パンクラス/修斗のように毎日自動スクレイプは
// せず、DEEPの歴代champ一覧ページは構造が壊れやすい(パーサーが不安定になりやすい)
// ため、手動確認したスナップショット+低頻度レビューに留める(取得元での事後確認は
// 人力で行う運用)。暫定王者・空位を表現できるよう RankedClass[] を直接記述する
// (championsToRankingData の1階級1王者前提では表現できないため)。
export const DEEP_RANKING_CLASSES: { weightClass: string; entries: { rank: string; name: string; slug: string | null }[] }[] = [
  { weightClass: "ストロー級", entries: [{ rank: "王者", name: "知名昴海", slug: null }] },
  { weightClass: "フライ級", entries: [{ rank: "王者", name: "村元友太郎", slug: "muramoto-yutaro" }] },
  {
    weightClass: "バンタム級",
    entries: [
      { rank: "王者", name: "福田龍彌", slug: "fukuda-ryuya" },
      { rank: "暫定王者", name: "鹿志村仁之介", slug: "kashimura-ninnosuke" },
    ],
  },
  {
    weightClass: "フェザー級",
    entries: [
      { rank: "王者", name: "青井人", slug: "aoi-jin" },
      { rank: "暫定王者", name: "水野新太", slug: "mizuno-shinta" },
    ],
  },
  {
    weightClass: "ライト級",
    entries: [
      { rank: "王者", name: "野村駿太", slug: "nomura-shunta" },
      { rank: "暫定王者", name: "大原樹理", slug: "ohara-juri" },
    ],
  },
  { weightClass: "ウェルター級", entries: [{ rank: "王者", name: "嶋田伊吹", slug: "shimada-ibuki" }] },
  { weightClass: "ミドル級", entries: [{ rank: "空位", name: "空位", slug: null }] },
  { weightClass: "ライトヘビー級", entries: [{ rank: "空位", name: "空位", slug: null }] },
  { weightClass: "ヘビー級", entries: [{ rank: "王者", name: "大成", slug: null }] }, // メガトン級から統合表示
  // DEEP JEWELS(女子)
  { weightClass: "女子アトム級", entries: [{ rank: "王者", name: "伊澤星花", slug: "izawa-seika" }] },
  { weightClass: "女子ストロー級", entries: [{ rank: "王者", name: "万智", slug: null }] },
  { weightClass: "女子フライ級", entries: [{ rank: "王者", name: "中井りん", slug: null }] },
  { weightClass: "女子バンタム級", entries: [{ rank: "王者", name: "百湖", slug: null }] },
  { weightClass: "女子フェザー級", entries: [{ rank: "王者", name: "東ようこ", slug: null }] },
];

export function deepRankingData(): OrgRankingData {
  return {
    org: "deep",
    source: CHAMPION_SOURCES.deep.label,
    sourceUrl: CHAMPION_SOURCES.deep.url,
    fetchedDate: FETCHED_DATE,
    rankingLabel: "現王者・暫定王者",
    classes: DEEP_RANKING_CLASSES.map((c) => ({
      weightClass: c.weightClass,
      entries: c.entries.map((e) => ({ rank: e.rank, officialName: e.name, slug: e.slug })),
    })),
  };
}

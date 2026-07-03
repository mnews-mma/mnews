import { SourceKey } from "./sources";

export interface Article {
  id: string;
  source: SourceKey;
  title: string;
  summary?: string;
  origin: string;
  url: string;
  publishedAt: string; // ISO timestamp（媒体側の公開日時）
  // Mニュースのアーカイブ処理が初めてこの記事を検知した時刻（ISO）。
  // data/archive.json に初回追記されたときに刻まれる。BREAKINGの失効判定に使う。
  firstSeenAt?: string;
  breaking?: boolean;
  isNew?: boolean;
}

// Seed data reproducing mnews.html. In production this is populated by the
// RSS/scraping collectors described in mnews-spec.md and stored in the DB.
export const ARTICLES: Article[] = [
  {
    id: "a1",
    source: "ufc",
    title:
      "平良達郎、UFC 327でジョシュア・ヴァンに3Rリアネイキッドチョークで勝利。UFC王座挑戦が現実味を帯びる",
    summary:
      "26歳の沖縄出身ファイターがまたしても世界を圧倒した。第2ラウンドにテイクダウンを奪い、バックポジションを制圧。3Rに入ると完璧なチョークで相手をタップさせた。試合後、平良は「次はチャンピオンだ」と宣言。",
    origin: "UFC.com / ゴング格闘技",
    url: "https://jp.ufc.com",
    publishedAt: minutesAgo(32),
    breaking: true,
  },
  {
    id: "a2",
    source: "rizin",
    title: "RIZIN LANDMARK 13 全試合結果 — 日本人選手5名勝利",
    origin: "RIZIN公式",
    url: "https://rizin-ff.com",
    publishedAt: hoursAgo(2),
  },
  {
    id: "a3",
    source: "one",
    title: "伊澤星花 ONE FC女子アトム級19連続防衛成功「まだまだ強くなれる」",
    origin: "MMAPLANET",
    url: "https://mmaplanet.jp",
    publishedAt: hoursAgo(3),
  },
  {
    id: "a4",
    source: "shooto",
    title: "修斗世界フライ級タイトルマッチ — 次期挑戦者が確定",
    origin: "修斗公式",
    url: "https://shooto.co.jp",
    publishedAt: hoursAgo(5),
  },
  {
    id: "a5",
    source: "ufc",
    title:
      "UFC 328 日本開催の可能性？榊原CEO「さいたまスーパーアリーナでUFC、夢じゃない」",
    summary:
      "RIZIN代表の榊原信行CEOが独占インタビューでUFCとの関係性について言及。日本でのUFC本格開催に向けた水面下の交渉が進んでいることを示唆した。実現すれば日本MMA史上最大のイベントとなる可能性がある。",
    origin: "ゴング格闘技",
    url: "https://gonkaku.jp",
    publishedAt: hoursAgo(1),
    isNew: true,
  },
  {
    id: "a6",
    source: "rizin",
    title: "RIZIN.53 対戦カード第1弾発表 — 堀口恭司が復帰戦",
    origin: "RIZIN公式",
    url: "https://rizin-ff.com",
    publishedAt: hoursAgo(2),
  },
  {
    id: "a7",
    source: "deep",
    title: "DEEP 131 全試合カード決定 — 注目の無敗同士の対決",
    summary: "DEEP東京大会の全カードが出揃った。フェザー級でともに無敗の若手有望株が激突する。",
    origin: "DEEP公式",
    url: "https://deep2001.com",
    publishedAt: hoursAgo(4),
  },
  {
    id: "a8",
    source: "ufc",
    title: "中村倫也、UFC次戦でバンタム級ランカーと対戦決定",
    summary:
      "レスリングU-23世界王者の中村倫也が6月のUFC大会でトップ15選手と対戦。キャリア最大の試練に挑む。",
    origin: "MMAFighting / MMAPLANET",
    url: "https://mmaplanet.jp",
    publishedAt: hoursAgo(5),
  },
  {
    id: "a9",
    source: "shooto",
    title: "「Lemino × 修斗」vol.6 開催決定 — 4大会連続のストリーミング配信",
    origin: "修斗公式",
    url: "https://shooto.co.jp",
    publishedAt: hoursAgo(6),
  },
  {
    id: "a10",
    source: "one",
    title: "ONE SAMURAI 1 追加カード — 日本人選手6名参戦に",
    origin: "ONE Championship公式",
    url: "https://www.onefc.com",
    publishedAt: hoursAgo(8),
  },
  {
    id: "a11",
    source: "rizin",
    title: "SASUKE、PFLからRIZIN電撃移籍か — 関係者が明かす",
    origin: "ファイトスポーツ",
    url: "https://rizin-ff.com",
    publishedAt: hoursAgo(10),
  },
  {
    id: "a12",
    source: "deep",
    title: "若手注目株・松岡嵩志 DEEPフライ級タイトル挑戦権獲得",
    origin: "DEEP公式",
    url: "https://deep2001.com",
    publishedAt: hoursAgo(11),
  },
  {
    id: "a13",
    source: "rizin",
    title: "RIZIN.53 堀口恭司 vs 朝倉海 再戦濃厚 — 関係者が証言",
    origin: "RIZIN公式",
    url: "https://rizin-ff.com",
    publishedAt: hoursAgo(12),
  },
  {
    id: "a14",
    source: "ufc",
    title: "UFCフライ級ランキング更新 — 平良達郎が3位に浮上",
    origin: "UFC.com",
    url: "https://jp.ufc.com",
    publishedAt: hoursAgo(14),
  },
  {
    id: "a15",
    source: "shooto",
    title: "修斗2026年下半期スケジュール全公開",
    origin: "修斗公式",
    url: "https://shooto.co.jp",
    publishedAt: hoursAgo(15),
  },
  {
    id: "a16",
    source: "deep",
    title: "DEEP女子部門が拡大 — 新設4階級の詳細発表",
    origin: "DEEP公式",
    url: "https://deep2001.com",
    publishedAt: hoursAgo(18),
  },
];

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export function isRecent(iso: string, hours = 3): boolean {
  return Date.now() - new Date(iso).getTime() < hours * 3_600_000;
}

export function relativeTimeJa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  return `${day}日前`;
}

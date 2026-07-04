import type { SourceKey } from "./sources";
import type { Article } from "./articles";

// ─────────────────────────────────────────────────────────────
// 統一フィードの分類・速報(flash)判定。サイト表示とX投稿で同一ロジックを
// 共有するための単一モジュール(判定の二重実装を禁止する)。
// ・kind      … 出典区分(official/media)。source から純関数で導出。
// ・newsType  … 記事種別。タイトルからキーワード分類(保存値ではなく導出値)。
// ・isFlash   … 速報判定。種別 + 検知から24h + override で決まる導出値。
//   旧BREAKING(検知失効8h/公開24hカットオフ/スコアリング)はこのモジュールが
//   置き換える。時間ベースの減衰ロジックは持たない(24h降格のみ)。
// ─────────────────────────────────────────────────────────────

export type Kind = "official" | "media";

export type NewsType =
  | "result" // 試合結果(決着)
  | "card_announcement" // 対戦カード正式発表 / メイン変更
  | "card_change" // 欠場・負傷によるカード変更
  | "weigh_in" // 計量結果
  | "retirement_transfer" // 引退・移籍(契約ベース)
  | "announcement_minor" // 軽微告知(ポスター/前売券/煽り動画等)
  | "article"; // 上記以外(インタビュー・コラム等)。デフォルト

// 管理画面(P4)から手動設定する速報オーバーライド。P3時点では常に "none"。
export type FlashOverride = "none" | "force" | "suppress";

const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);

export function articleKind(source: SourceKey): Kind {
  return OFFICIAL_ORGS.has(source) ? "official" : "media";
}

// 速報対象の種別(この5種のみが flash 候補)。
const FLASH_TYPES = new Set<NewsType>([
  "result",
  "card_announcement",
  "card_change",
  "weigh_in",
  "retirement_transfer",
]);

export function isFlashType(t: NewsType): boolean {
  return FLASH_TYPES.has(t);
}

// X投稿の【速報】プレフィックス判定。サイト表示の速報判定(種別ベース)と
// 同一の基準を共有するためのヘルパー(判定の二重実装を禁止する)。
export function flashPrefixForType(newsType: NewsType): string {
  return isFlashType(newsType) ? "【速報】" : "";
}

// タイトル→種別のキーワード分類。判定は先勝ち(specificな種別を先に置く)。
// 保存先が無いRSSライブ記事のため、種別はここで都度導出する。
const TYPE_RULES: { type: NewsType; keywords: string[] }[] = [
  { type: "weigh_in", keywords: ["計量"] },
  {
    type: "card_change",
    keywords: ["欠場", "負傷欠場", "カード変更", "対戦カード変更", "変更カード", "中止カード", "カード中止", "試合中止", "代替出場", "対戦相手変更"],
  },
  {
    type: "result",
    keywords: [
      "試合結果", "全試合結果", "大会結果", "KO勝", "TKO勝", "一本勝", "判定勝", "判定で", "下し", "破り", "破って", "制し", "撃破", "秒殺", "優勝", "王座奪取", "新王者", "王座防衛", "防衛成功", "勝利", "敗北", "返り討ち",
    ],
  },
  {
    type: "card_announcement",
    keywords: ["カード決定", "対戦決定", "対戦カード決定", "カード発表", "対戦カード発表", "追加カード", "追加対戦カード", "対戦相手決定", "出場決定", "参戦決定", "参戦発表", "メイン決定", "メインイベント決定", "タイトルマッチ決定", "王座決定戦", "調印", "対戦が決定", "実現"],
  },
  {
    type: "retirement_transfer",
    keywords: ["引退", "現役引退", "移籍", "契約解除", "電撃移籍", "再契約", "電撃契約", "契約合意", "FA宣言"],
  },
  {
    type: "announcement_minor",
    keywords: [
      "ポスター", "ビジュアル", "壁紙", "前売", "チケット", "観覧募集", "見所", "見どころ", "煽り", "予告動画", "PV公開", "グッズ", "物販", "放送", "配信スケジュール", "テレビ", "TV", "放送日", "スケジュール", "キャンペーン", "公開練習", "合同練習", "記者会見", "会見", "囲み取材", "セミナー", "アワード", "表彰", "殿堂", "握手会", "サイン会", "ファンイベント", "試合順", "カウントダウン",
    ],
  },
];

export function classifyNewsType(title: string): NewsType {
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some((kw) => title.includes(kw))) return rule.type;
  }
  return "article";
}

const FLASH_WINDOW_MS = 24 * 60 * 60 * 1000;

// 速報判定(導出値):
//   is_flash = kind == 'official' AND newsType ∈ FLASH_TYPES
//              AND (now - detectedAt) < 24h AND flashOverride != 'suppress'
//   ・suppress → 常に非速報
//   ・force    → 常に速報(種別・出典・24h降格の対象外。メディア発速報の手動対応用)
//   ・none     → 上記式どおり(公式のみ / 24hで自動的に通常カードへ降格)
// 速報を公式に限定する理由: 提携メディア記事は出典がviaで一次発表ではないため。
// メディア発でも速報にしたいケースは flash_override=force(P4の管理UI)で対応する。
export function isFlash(opts: {
  kind: Kind;
  newsType: NewsType;
  detectedAt?: string; // firstSeenAt(検知時刻)。無ければ publishedAt を代替。
  flashOverride?: FlashOverride;
  now?: number;
}): boolean {
  const { kind, newsType, detectedAt, flashOverride = "none", now = Date.now() } = opts;
  if (flashOverride === "suppress") return false;
  if (flashOverride === "force") return true;
  if (kind !== "official") return false;
  if (!isFlashType(newsType)) return false;
  if (!detectedAt) return false;
  const detected = new Date(detectedAt).getTime();
  if (isNaN(detected)) return false;
  return now - detected < FLASH_WINDOW_MS;
}

// フィード表示用に kind / newsType / flash を確定させた記事。
export interface FeedArticle extends Article {
  kind: Kind;
  newsType: NewsType;
  flash: boolean;
}

// サーバ側(force-dynamic)で記事を分類・速報判定し、公開時刻(publishedAt)降順で並べる。
// 速報の24h判定のみ検知時刻(firstSeenAt。無ければpublishedAt)を使う。
export function toFeedArticles(articles: Article[], now = Date.now()): FeedArticle[] {
  return articles
    .map((a) => {
      const newsType = a.newsType ?? classifyNewsType(a.title);
      const detectedAt = a.firstSeenAt ?? a.publishedAt;
      const kind = a.kind ?? articleKind(a.source);
      return {
        ...a,
        kind,
        newsType,
        flash: isFlash({ kind, newsType, detectedAt, flashOverride: a.flashOverride, now }),
      };
    })
    // 表示・並び順は公開時刻(publishedAt)基準。検知時刻(firstSeenAt)は
    // 速報の24h降格判定にのみ使う(昨日公開の記事が検知2h前で「2時間前」と
    // 表示される不具合を避けるため)。
    .sort((x, y) => new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime());
}

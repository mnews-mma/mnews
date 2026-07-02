import type { Article } from "./articles";
import { SourceKey } from "./sources";
import { FIGHTERS } from "./fighters";

const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);

// DB登録済み選手名（日本語・英語）セット — タイトルへの言及でスコア加算
const FIGHTER_NAMES = new Set<string>(FIGHTERS.flatMap((f) => [f.nameJa, f.nameEn].filter(Boolean)));

// ニュースバリューが高いキーワード（+1点ずつ）。試合速報・カード決定を最優先。
const IMPACT_KEYWORDS = [
  "電撃",
  "緊急",
  "速報",
  "カード決定",
  "カード発表",
  "追加カード",
  "対戦決定",
  "対戦相手",
  "激突",
  "対決",
  "王座",
  "王者",
  "防衛",
  "引退",
  "契約",
  "復帰",
  "初優勝",
  "KO",
  "TKO",
  "一本",
  "新王者",
  "タイトル",
  "参戦",
  "出場決定",
  "出場が決定",
  "撃破",
  "下し",
  "制し",
  "勝利",
  "敗北",
  "勝ち",
  "負け",
  "引き分け",
  "次期挑戦者",
  "挑戦",
  "移籍",
  "契約解除",
];

// ニュースバリューが低いキーワード（-2点ずつ）。
const LOW_VALUE_KEYWORDS = [
  "合同練習",
  "公開練習",
  "LOT",
  "抽選",
  "観覧募集",
  "試合順",
  "配信",
  "チケット",
  "計量",
  "囲み取材",
  "記者会見",
  "結果まとめ",
  "キャンペーン",
  "Fight＆Life",
  "Fight&Life",
  "テレビ",
  "TV放送",
  "放送日",
  "スケジュール",
  "セミナー",
  "グッズ",
  "物販",
  "ベストバウト",
  "ファンイベント",
  "握手会",
  "サイン会",
  "殿堂",
  "表彰",
  "アワード",
];

function impactScore(a: Article): number {
  let score = 0;
  if (OFFICIAL_ORGS.has(a.source)) score += 3;
  for (const kw of IMPACT_KEYWORDS) {
    if (a.title.includes(kw)) score += 1;
  }
  for (const kw of LOW_VALUE_KEYWORDS) {
    if (a.title.includes(kw)) score -= 2;
  }
  // DB登録済み選手名がタイトルに含まれる場合 +2
  for (const name of FIGHTER_NAMES) {
    if (name.length >= 2 && a.title.includes(name)) {
      score += 2;
      break; // 1記事につき1回のみ
    }
  }
  return score;
}

// 前日に取得した記事一覧（公開日時降順）から、インパクト順に上位N件を選ぶ。
// スコアが同じ場合は元の並び（新しい順）を保つ。
export function selectTopNews(articles: Article[], count = 3): Article[] {
  return articles
    .map((a, index) => ({ a, index, score: impactScore(a) }))
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : x.index - y.index))
    .slice(0, count)
    .map((x) => x.a);
}

// BREAKING表示判定。以下を全て満たす場合のみ表示:
// ・48時間以内の記事（date-only取得ソースの UTC解釈ズレを吸収）
// ・除外KWなし（チケット/グッズ/受賞/ボーナス等）
// ・スコアが閾値(4)以上（公式org+3 + IMPACT_KW1つ+1 = 4 が最低ライン）
const BREAKING_THRESHOLD = 4;

// BREAKING から除外するキーワード（いずれかを含む場合は対象外）
const BREAKING_EXCLUDED = [
  "チケット",
  "グッズ",
  "物販",
  "LOT",
  "抽選",
  "ファンイベント",
  "握手会",
  "サイン会",
  "アワード",
  "表彰",
  "ベストバウト",
  "試合順",
  "計量",
  "公開練習",
  "合同練習",
  "セミナー",
  "受賞",
  "ボーナス",
  "スペシャルボーナス",
  "配信",
  "テレビ",
  "放送",
  "スケジュール",
];

function breakingScore(a: Article): number {
  const ageHours = (Date.now() - new Date(a.publishedAt).getTime()) / (60 * 60 * 1000);
  if (ageHours > 48) return -Infinity; // 48時間超は対象外
  // 除外キーワードチェック
  if (BREAKING_EXCLUDED.some((kw) => a.title.includes(kw))) return -Infinity;
  return impactScore(a);
}

// 公式・ニュース問わず全記事から BREAKING 条件を満たす最上位1件を返す。
export function selectBreaking(articles: Article[]): Article | null {
  const ranked = articles
    .map((a, index) => ({ a, index, score: breakingScore(a) }))
    .filter((x) => x.score > -Infinity && x.score >= BREAKING_THRESHOLD)
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : x.index - y.index));
  return ranked.length > 0 ? ranked[0].a : null;
}

// デバッグ用: 各記事の BREAKING 判定内訳を返す。
export interface BreakingDiag {
  title: string;
  source: string;
  publishedAt: string;
  ageHours: number;
  impact: number;
  excluded: string[];
  breakingScore: number; // -Infinity は数値化不可のため -999 で表現
  passesThreshold: boolean;
}
export function diagnoseBreaking(articles: Article[]): {
  threshold: number;
  selected: string | null;
  articles: BreakingDiag[];
} {
  const diags = articles.map((a) => {
    const ageHours = (Date.now() - new Date(a.publishedAt).getTime()) / (60 * 60 * 1000);
    const excluded = BREAKING_EXCLUDED.filter((kw) => a.title.includes(kw));
    const impact = impactScore(a);
    const bs = breakingScore(a);
    return {
      title: a.title,
      source: a.source,
      publishedAt: a.publishedAt,
      ageHours: Math.round(ageHours * 10) / 10,
      impact,
      excluded,
      breakingScore: bs === -Infinity ? -999 : bs,
      passesThreshold: bs > -Infinity && bs >= BREAKING_THRESHOLD,
    };
  });
  diags.sort((x, y) => y.breakingScore - x.breakingScore);
  const sel = selectBreaking(articles);
  return { threshold: BREAKING_THRESHOLD, selected: sel ? sel.title : null, articles: diags };
}


const HASHTAG_RULES: { tag: string; org: SourceKey; keywords: string[] }[] = [
  { tag: "#RIZIN", org: "rizin", keywords: ["RIZIN", "ライジン"] },
  { tag: "#DEEP", org: "deep", keywords: ["DEEP"] },
  { tag: "#パンクラス", org: "pancrase", keywords: ["パンクラス", "PANCRASE"] },
  { tag: "#修斗", org: "shooto", keywords: ["修斗", "SHOOTO"] },
];

// ニュース内容から関連する団体ハッシュタグを自動判定する。
// #MMA は常に先頭、団体タグは最大2つまで（合計3つ以内）。
export function buildHashtags(articles: Article[]): string[] {
  const tags: string[] = ["#MMA"];
  for (const rule of HASHTAG_RULES) {
    if (tags.length >= 3) break;
    const matched = articles.some(
      (a) => a.source === rule.org || rule.keywords.some((kw) => a.title.includes(kw))
    );
    if (matched) tags.push(rule.tag);
  }
  return tags;
}

export interface TweetDigest {
  hook: string;
  topNews: Article[];
  hashtags: string[];
  text: string;
}

// X投稿フォーマット:
// 🥊 {フック文}
//
// 📰 昨日のMMAニュースまとめ
//
// ・{ニュース1}
// ・{ニュース2}
// ・{ニュース3}
//
// 全件はこちら→ https://www.mnews.jp/
//
// #MMA #RIZIN #DEEP
export function buildTweetDigest(articles: Article[], count = 3): TweetDigest {
  const topNews = selectTopNews(articles, count);
  const hashtags = buildHashtags(topNews);
  const hook = "昨日のMMAニュースまとめ";

  if (topNews.length === 0) {
    return {
      hook,
      topNews: [],
      hashtags: ["#MMA"],
      text: [
        `🥊 ${hook}`,
        "",
        "昨日は新着ニュースがありませんでした",
        "",
        "全件はこちら→ https://mnews.jp",
        "",
        "#MMA",
      ].join("\n"),
    };
  }

  const lines = topNews.map((a) => `・${a.title}`);

  const text = [
    `🥊 ${hook}`,
    "",
    ...lines,
    "",
    "全件はこちら→ https://mnews.jp",
    "",
    hashtags.join(" "),
  ].join("\n");

  return { hook, topNews, hashtags, text };
}

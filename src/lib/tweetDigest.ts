import type { Article } from "./articles";
import { SourceKey } from "./sources";

const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);

// ニュースバリューが高いキーワード（+1点ずつ）。試合速報・カード決定を最優先。
const IMPACT_KEYWORDS = [
  "電撃",
  "緊急",
  "速報",
  "カード決定",
  "対戦相手",
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
];

// ニュースバリューが低いキーワード（-2点ずつ）。合同練習・キャンペーン・
// TV番組・結果まとめ記事はわざわざ目立たせる必要がないため減点する。
const LOW_VALUE_KEYWORDS = [
  "合同練習",
  "公開練習",
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

// BREAKING表示用。インパクトスコアに加え鮮度を強く重視する：
// 6時間以内はボーナス、12時間超は減点、24時間超は対象外にする。
function breakingScore(a: Article): number {
  const ageHours = (Date.now() - new Date(a.publishedAt).getTime()) / (60 * 60 * 1000);
  if (ageHours > 24) return -Infinity;
  let score = impactScore(a);
  if (ageHours <= 6) score += 3;
  else if (ageHours > 12) score -= 4;
  return score;
}

// 公式・ニュース問わず全記事から、鮮度を重視したインパクト最上位の1件を選ぶ。
// 24時間以上前の記事は対象外（古いニュースをBREAKING扱いしない）。
export function selectBreaking(articles: Article[]): Article | null {
  const ranked = articles
    .map((a, index) => ({ a, index, score: breakingScore(a) }))
    .filter((x) => x.score > -Infinity)
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : x.index - y.index));
  return ranked.length > 0 ? ranked[0].a : null;
}


const HASHTAG_RULES: { tag: string; org: SourceKey; keywords: string[] }[] = [
  { tag: "#RIZIN", org: "rizin", keywords: ["RIZIN", "ライジン"] },
  { tag: "#DEEP", org: "deep", keywords: ["DEEP"] },
  { tag: "#パンクラス", org: "pancrase", keywords: ["パンクラス", "PANCRASE"] },
  { tag: "#修斗", org: "shooto", keywords: ["修斗", "SHOOTO"] },
];

// ニュース内容（source・タイトル）から関連する団体ハッシュタグを自動判定する。
// #MMA は常に先頭に付ける。
export function buildHashtags(articles: Article[]): string[] {
  const tags: string[] = ["#MMA"];
  for (const rule of HASHTAG_RULES) {
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

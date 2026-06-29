import type { Article } from "./articles";
import { SourceKey } from "./sources";

const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);

// 見出しに含まれていると「インパクトが大きい」と判断する語。
// 王座戦・電撃発表・引退など、読者の関心を強く引きやすいニュースを優先する。
const IMPACT_KEYWORDS = [
  "電撃",
  "緊急",
  "速報",
  "決定",
  "発表",
  "王座",
  "王者",
  "防衛",
  "引退",
  "契約",
  "復帰",
  "初優勝",
  "勝利",
  "敗れ",
  "KO",
  "TKO",
  "一本",
  "新王者",
  "タイトル",
];

function impactScore(a: Article): number {
  let score = 0;
  if (OFFICIAL_ORGS.has(a.source)) score += 3;
  for (const kw of IMPACT_KEYWORDS) {
    if (a.title.includes(kw)) score += 1;
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
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
// {フック文}
//
// 昨日のMMAニュースまとめ
//
// ・{ニュース1}
// ・{ニュース2}
// ・{ニュース3}
//
// 全件はこちら→ https://www.mnews.jp/
//
// #MMA #RIZIN #DEEP
export function buildTweetDigest(articles: Article[]): TweetDigest {
  const topNews = selectTopNews(articles, 3);
  const hashtags = buildHashtags(topNews);

  if (topNews.length === 0) {
    return {
      hook: "昨日は新着ニュースがありませんでした",
      topNews,
      hashtags: ["#MMA"],
      text: [
        "昨日は新着ニュースがありませんでした",
        "",
        "全件はこちら→ https://www.mnews.jp/",
        "",
        "#MMA",
      ].join("\n"),
    };
  }

  const hook = truncate(topNews[0].title, 80);
  const lines = topNews.map((a) => `・${truncate(a.title, 60)}`);

  const text = [
    hook,
    "",
    "昨日のMMAニュースまとめ",
    "",
    ...lines,
    "",
    "全件はこちら→ https://www.mnews.jp/",
    "",
    hashtags.join(" "),
  ].join("\n");

  return { hook, topNews, hashtags, text };
}

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

// 特に速報性が高いキーワード（追加で +2）。試合カード決定・王座・引退移籍など、
// 「大会名だけの告知」より明確にニュース価値が高いものを押し上げる。
// 公式ソース（org+3）だけの単なる大会名告知に埋もれないようにするための重み。
const HIGH_IMPACT_KEYWORDS = [
  "電撃",
  "緊急",
  "速報",
  "カード決定",
  "対戦決定",
  "激突",
  "王座",
  "王者",
  "新王者",
  "タイトルマッチ",
  "防衛",
  "引退",
  "移籍",
  "参戦",
  "欠場",
  "KO",
  "TKO",
  "一本",
  "撃破",
  "契約解除",
];

function impactScore(a: Article): number {
  let score = 0;
  if (OFFICIAL_ORGS.has(a.source)) score += 3;
  for (const kw of IMPACT_KEYWORDS) {
    if (a.title.includes(kw)) score += 1;
  }
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (a.title.includes(kw)) score += 2;
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
// ・検知（取り込み）から8時間以内（失効起点は公開時刻ではなく検知時刻。
//   深夜に出たニュースが朝の閲覧ピーク前に失効する問題への対策。空になりにくく、
//   かつ半日以上前の古いものは残さない中間値として8hを採用）
// ・公開時刻から24時間以内（古いニュースを深夜バッチで拾った場合の誤BREAKING防止）
// ・除外KWなし（チケット/グッズ/受賞/ボーナス等）
// ・スコアが閾値(4)以上（公式org+3 + IMPACT_KW1つ+1 = 4 が最低ライン）
const BREAKING_THRESHOLD = 4;
// 検知からの失効時間（重要度にかかわらずこの時間で表示を外す）
const BREAKING_DETECTION_EXPIRY_HOURS = 8;
// 公開時刻からの上限（これを超えた古いニュースは検知時刻にかかわらずBREAKING対象外）
const BREAKING_MAX_PUBLISH_AGE_HOURS = 24;

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
  "お知らせ",     // 「追加・変更・中止カードのお知らせ」等の事務連絡
  "変更カード",
  "中止カード",
  "追加カードのお知らせ",
];

// 検知時刻（firstSeenAt）を起点に失効を判定する。firstSeenAt が無い記事
// （アーカイブ未登録＝ごく最近初検知）は publishedAt を代替に使う。
function breakingScore(a: Article): number {
  const now = Date.now();
  const detectionMs = new Date(a.firstSeenAt ?? a.publishedAt).getTime();
  const publishMs = new Date(a.publishedAt).getTime();
  const detectionAgeHours = (now - detectionMs) / (60 * 60 * 1000);
  const publishAgeHours = (now - publishMs) / (60 * 60 * 1000);

  // 検知から4時間で失効
  if (detectionAgeHours > BREAKING_DETECTION_EXPIRY_HOURS) return -Infinity;
  // 公開から24時間超は対象外（深夜バッチで古い記事を拾った場合の誤BREAKING防止）
  if (publishAgeHours > BREAKING_MAX_PUBLISH_AGE_HOURS) return -Infinity;
  // 除外キーワードチェック
  if (BREAKING_EXCLUDED.some((kw) => a.title.includes(kw))) return -Infinity;
  return impactScore(a);
}

// フォールバックの下限スコア。閾値(4)に届く記事が無くても、
// これ以上のスコアがあれば最上位を BREAKING として表示する。
// （公式org+3 だけ、または選手名+2 だけでも拾える水準）
const BREAKING_FLOOR = 2;

// 公式・ニュース問わず全記事から、除外KWなし・48h以内の中で
// スコア最上位の1件を BREAKING として返す。
// 閾値(4)以上を最優先。無ければ下限(2)以上の最上位をフォールバック表示する。
export function selectBreaking(articles: Article[]): Article | null {
  const ranked = articles
    .map((a, index) => ({ a, index, score: breakingScore(a) }))
    .filter((x) => x.score > -Infinity)
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : x.index - y.index));
  if (ranked.length === 0) return null;
  // 閾値以上があればそれを、無ければ下限以上をフォールバック
  const primary = ranked.find((x) => x.score >= BREAKING_THRESHOLD);
  const selected = primary ?? ranked.find((x) => x.score >= BREAKING_FLOOR);
  if (!selected) return null;

  // 判定ログ: 検知時刻と失効予定時刻を出す
  const a = selected.a;
  const detection = new Date(a.firstSeenAt ?? a.publishedAt);
  const expiry = new Date(detection.getTime() + BREAKING_DETECTION_EXPIRY_HOURS * 60 * 60 * 1000);
  const usedFallback = !primary;
  console.log(
    `[BREAKING] "${a.title.slice(0, 40)}" score=${selected.score}` +
      `${usedFallback ? "(fallback)" : ""} published=${a.publishedAt}` +
      ` detected=${detection.toISOString()} expiresAt=${expiry.toISOString()}`
  );
  return a;
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

// ───────────────────────────────────────────────
// 単一ニュース向けの短いX投稿文（【ラベル】+ 要約1文 + リンク + ハッシュタグ）。
// 全体を全角100文字以内目安にし、タイトルをそのまま貼らず要約する。
// ───────────────────────────────────────────────

// 全角換算の文字数（半角=0.5, 全角=1）。X投稿の見た目の長さの目安に使う。
export function fullWidthLength(s: string): number {
  let len = 0;
  for (const ch of s) {
    len += ch.charCodeAt(0) <= 0xff ? 0.5 : 1;
  }
  return len;
}

// 結果系（試合が決着した）キーワード。含まれれば【結果】ラベル。
const RESULT_LABEL_KEYWORDS = [
  "KO勝", "TKO勝", "一本勝", "判定勝", "撃破", "下し", "破り", "破って",
  "制し", "優勝", "王座奪取", "新王者", "防衛成功", "一本で", "秒殺",
];
// 速報系（今後の予定・動向）キーワード。含まれれば【速報】ラベル。
const BREAKING_LABEL_KEYWORDS = [
  "速報", "電撃", "緊急", "決定", "参戦", "欠場", "移籍", "引退",
  "対戦", "決戦", "タイトルマッチ", "挑戦", "調印", "契約",
];

// 投稿の先頭に付けるラベルを判定（該当時のみ。結果を速報より優先）。
export function pickPostLabel(title: string): string | null {
  if (RESULT_LABEL_KEYWORDS.some((k) => title.includes(k))) return "結果";
  if (BREAKING_LABEL_KEYWORDS.some((k) => title.includes(k))) return "速報";
  return null;
}

// ニュースタイトルを1文に要約する。固有名詞（選手名・大会名）は残し、
// 先頭の媒体/大会ラベル【…】と末尾の日付・会場（＝以降）などの冗長部を削る。
export function summarizeTitle(title: string, maxLen = 55): string {
  let s = title.trim();
  // 先頭の【媒体/大会】ラベルを除去（ラベル/ハッシュタグで別途表現するため）
  s = s.replace(/^【[^】]*】\s*/, "");
  // 末尾の「＝日付・会場」等の付帯情報を除去。
  // 全角＝の後ろに日付(〜月〜日)が続く場合のみ削る（本文中の半角=「A=B」等は残す）。
  s = s.replace(/\s*＝[^＝]*\d+月\d+日.*$/, "");
  // 空白正規化
  s = s.replace(/\s+/g, " ").trim();

  if (fullWidthLength(s) <= maxLen) return s;

  // まだ長い → 文境界で切る。強い区切り(。！？)を優先、無ければ読点(、)。
  const strong = ["。", "！", "!", "？", "?"];
  let cut = -1;
  for (let i = 0; i < s.length; i++) {
    if (strong.includes(s[i]) && fullWidthLength(s.slice(0, i + 1)) <= maxLen) cut = i + 1;
  }
  if (cut === -1) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "、" && fullWidthLength(s.slice(0, i)) <= maxLen) cut = i;
    }
  }
  if (cut > 0) {
    return s.slice(0, cut).replace(/[、。]$/, "").trim();
  }
  // 区切りが無い → 文字数で切って末尾に…
  let acc = "";
  for (const ch of s) {
    if (fullWidthLength(acc + ch) > maxLen - 1) break;
    acc += ch;
  }
  return acc.trim() + "…";
}

// 単一ニュース向けのハッシュタグ（#MMA + 団体タグ最大1個 = 合計2個まで）。
export function buildHashtagsForOne(a: Article): string[] {
  const tags: string[] = ["#MMA"];
  for (const rule of HASHTAG_RULES) {
    if (tags.length >= 2) break;
    if (a.source === rule.org || rule.keywords.some((kw) => a.title.includes(kw))) {
      tags.push(rule.tag);
    }
  }
  return tags;
}

const POST_LINK = "https://mnews.jp";

// 単一ニュースのX投稿文を生成する。
// フォーマット: 【ラベル】要約1文 / リンク / ハッシュタグ（全角100字以内目安）
export function buildNewsPost(a: Article): string {
  const label = pickPostLabel(a.title);
  const summary = summarizeTitle(a.title);
  const head = label ? `【${label}】${summary}` : summary;
  const hashtags = buildHashtagsForOne(a).join(" ");
  return [head, POST_LINK, hashtags].join("\n");
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

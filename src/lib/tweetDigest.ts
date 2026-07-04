import type { Article } from "./articles";
import { SOURCES, SourceKey } from "./sources";
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

// ───────────────────────────────────────────────
// 朝の「昨日のまとめ」用トピック生成。
// ルール: 1項目=1トピック(全角35字以内)・最大4件・低価値ニュース除外・
// 同一大会の複数結果は「代表1件+ほか全試合結果」に圧縮。
// ───────────────────────────────────────────────

// まとめから除外する低価値トピック(事務連絡・販促・画像系)
const DIGEST_EXCLUDED = [
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
  "お知らせ",
  "変更カード",
  "中止カード",
  "追加カードのお知らせ",
  "ポスター",
  "ビジュアル",
  "壁紙",
  "見所",
  "見どころ",
  "前売",
  "完売",
  "発売",
  "ライセンス", // ライセンス保持者一覧等の事務情報
  "Fight＆Life", // 雑誌記事の抜粋インタビュー
  "Fight&Life",
];

export interface DigestTopic {
  tag: string; // 表示用の団体/大会タグ(例: NEXUS, RIZIN)。画像の行頭チップに使う
  org: SourceKey; // 配色用(公式団体色、なければ金)
  text: string; // 要約済みトピック(全角35字以内・タグは含まない)
  score: number;
}

// タイトル先頭の【…】または本文から大会/団体タグを検出し、
// 「NEXUS MANIA2026#02」→「NEXUS」のように基幹名へ正規化する
export function detectEventTag(title: string, source: SourceKey): string {
  const m = title.match(/^【([^】]+)】/);
  let raw = m ? m[1] : "";
  if (!raw) {
    // ラベルなし: 公式ソースなら団体名
    if (SOURCES[source]?.type === "official") return SOURCES[source].label;
    return "";
  }
  const full = raw;
  raw = raw.split(/[\s#＃]/)[0]; // 「NEXUS MANIA2026#02」→「NEXUS」
  raw = raw.replace(/[0-9.．]+$/, ""); // 「Beatdown14」→「Beatdown」「PFL2026」→「PFL」
  // 「SUPER RIZIN05」→「SUPER」のような誤検出を防ぐ: 正規化トークンに
  // 団体名が含まれない場合、ラベル全体から既知の団体名を優先して拾う
  const KNOWN = ["RIZIN", "DEEP", "PANCRASE", "パンクラス", "修斗", "SHOOTO", "UFC", "PFL", "NEXUS", "ONE"];
  if (!KNOWN.some((k) => raw.toUpperCase().includes(k) || raw.includes(k))) {
    const hit = KNOWN.find((k) => full.toUpperCase().includes(k) || full.includes(k));
    if (hit) return hit === "SHOOTO" ? "修斗" : hit === "パンクラス" ? "PANCRASE" : hit;
  }
  return raw;
}

// タグから配色用のorgを推定(公式4団体はブランド色、それ以外は金=other扱い)
function tagToOrg(tag: string, source: SourceKey): SourceKey {
  const t = tag.toUpperCase();
  if (t.includes("RIZIN")) return "rizin";
  if (t.includes("DEEP")) return "deep";
  if (t.includes("PANCRASE") || tag.includes("パンクラス")) return "pancrase";
  if (tag.includes("修斗") || t.includes("SHOOTO")) return "shooto";
  if (t.includes("UFC")) return "ufc";
  if (SOURCES[source]?.type === "official") return source;
  return "other";
}

// 削っても意味が変わりにくい修飾表現(文字数が超過している間だけ順に削る)
const MODIFIER_PATTERNS: RegExp[] = [
  /[“”"『』]/g,
  /(約)?\d+年ぶり(の|に)?/,
  /\d+(連勝|連敗)中の/,
  /(注目|期待|話題|人気|衝撃|驚異)の(新人・?|一戦・?|新鋭・?)?/,
  /ついに|いよいよ|なんと|まさかの/,
  /現在/,
];

// トピックを全角maxLen以内へ「要約し直す」。機械的な末尾切りは最終手段。
// 優先順: 引用句の除去 → 修飾語の除去 → 読点単位の切り詰め(固有名詞を含む
// 先頭節を必ず残す) → 助詞境界での切り詰め → 末尾…
export function condenseTopic(title: string, maxLen = 35): string {
  let s = title.trim();
  s = s.replace(/^【[^】]*】\s*/, "");
  s = s.replace(/\s*[＝=][^＝=]*\d+月\d+日.*$/, "");
  s = s.replace(/\s+/g, " ").trim();
  if (fullWidthLength(s) <= maxLen) return s;

  // 1) 末尾方向の「…と語った/宣言」等のコメント引用を落とす(先頭12字は保護)
  const quoteCut = s.replace(/(.{12,}?)[「『].*$/, "$1").replace(/[と、。\s]+$/, "");
  if (quoteCut.length < s.length) s = quoteCut;
  if (fullWidthLength(s) <= maxLen) return s;

  // 2) 修飾語を1つずつ削る
  for (const re of MODIFIER_PATTERNS) {
    if (fullWidthLength(s) <= maxLen) break;
    s = s.replace(re, "").replace(/\s+/g, " ").trim();
  }
  if (fullWidthLength(s) <= maxLen) return s;

  // 3) 文(。)単位で先頭から収まるところまで(文の途中で名前が切れるのを防ぐ)
  const sentences = s.split("。").filter(Boolean);
  if (sentences.length > 1 && fullWidthLength(sentences[0]) <= maxLen) {
    let accS = sentences[0];
    for (let i = 1; i < sentences.length; i++) {
      const next = accS + "。" + sentences[i];
      if (fullWidthLength(next) > maxLen) break;
      accS = next;
    }
    return accS.replace(/[、。]$/, "");
  }
  s = sentences[0] ?? s;
  if (fullWidthLength(s) <= maxLen) return s;

  // 4) 読点単位で先頭から収まるところまで(最低1節は残す)
  const clauses = s.split("、");
  let acc = clauses[0];
  for (let i = 1; i < clauses.length; i++) {
    const next = acc + "、" + clauses[i];
    if (fullWidthLength(next) > maxLen) break;
    acc = next;
  }
  s = acc.replace(/[、。]$/, "");
  if (fullWidthLength(s) <= maxLen) return s;

  // 4) 助詞境界で切る(名詞で終わるため要約らしく読める)
  const particles = /[がでにをはへも](?=[^がでにをはへも])/g;
  let cut = -1;
  let match: RegExpExecArray | null;
  while ((match = particles.exec(s)) !== null) {
    if (fullWidthLength(s.slice(0, match.index)) <= maxLen) cut = match.index;
    else break;
  }
  if (cut > 8) return s.slice(0, cut);

  // 5) 最終手段: 末尾…
  let out = "";
  for (const ch of s) {
    if (fullWidthLength(out + ch) > maxLen - 1) break;
    out += ch;
  }
  return out.trim() + "…";
}

// 試合結果系のトピックか(クラスタ圧縮時の「ほか全試合結果」判定用)
function isResultTopic(title: string): boolean {
  return /新王者|王者に|王座奪取|勝ち|勝利|TKO|KO|沈め|極め|一本|判定|下し|破り|全試合結果|試合結果/.test(title);
}

export function buildDigestTopics(articles: Article[], max = 4): DigestTopic[] {
  // 1) 低価値トピックを除外
  const filtered = articles.filter(
    (a) => !DIGEST_EXCLUDED.some((kw) => a.title.includes(kw))
  );

  // 2) 大会/団体タグでクラスタリング(タグなしは単独クラスタ)
  const clusters = new Map<string, Article[]>();
  filtered.forEach((a, i) => {
    const tag = detectEventTag(a.title, a.source);
    const key = tag || `__solo_${i}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(a);
  });

  // 3) クラスタごとに代表1件へ圧縮してトピック化
  const topics: DigestTopic[] = [];
  for (const [key, group] of clusters) {
    const scored = group
      .map((a) => ({ a, score: impactScore(a) }))
      .sort((x, y) => y.score - x.score);
    const rep = scored[0];
    const tag = key.startsWith("__solo_")
      ? detectEventTag(rep.a.title, rep.a.source)
      : key;
    let text: string;
    if (group.length >= 2) {
      // 同一大会の複数ニュース: 代表を短めに要約し「ほか◯◯」を付ける
      const suffix = group.some((a) => isResultTopic(a.title))
        ? "、ほか全試合結果"
        : `、ほか${group.length - 1}件`;
      text = condenseTopic(rep.a.title, 35 - fullWidthLength(suffix)) + suffix;
    } else {
      text = condenseTopic(rep.a.title, 35);
    }
    topics.push({
      tag,
      org: tagToOrg(tag, rep.a.source),
      text,
      score: rep.score + (group.length >= 2 ? 1 : 0), // まとまりは僅かに加点
    });
  }

  // 4) 重要度順に最大max件
  return topics.sort((x, y) => y.score - x.score).slice(0, max);
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

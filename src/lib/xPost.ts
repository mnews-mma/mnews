import type { Article } from "./articles";
import { flashPrefixForType, type NewsType } from "./newsClassify";
import {
  buildHashtagsForOne,
  pickPostLabel,
  summarizeTitle,
  buildDigestTopics,
  condenseTopic,
  fullWidthLength,
} from "./tweetDigest";
import { normalizeVsSlugs } from "./vsPairing";

// ─────────────────────────────────────────────
// X投稿の組み立て設定（リンク戦略・上限）。
// 外部リンクによるリーチ低下対策として、デフォルトは
// 「本文=テキスト+画像のみ / リンクはセルフリプライ」の2段階方式。
// ─────────────────────────────────────────────

export type LinkPlacement = "reply" | "inline" | "none";

export interface XPostConfig {
  // 投稿タイプごとのリンク位置
  linkPlacement: {
    breaking: LinkPlacement; // 速報系: 画像のみ(リンクなし)
    curation: LinkPlacement; // キュレーション系: リプライにリンク
    digest: LinkPlacement; // 朝のまとめ: リプライにリンク
    countdown: LinkPlacement; // 大会前日: リプライにリンク
    result: LinkPlacement; // 試合結果速報: 画像のみ
    matchup: LinkPlacement; // 管理画面①対戦カード文脈: リプライにリンク
  };
  // 1日の自動ポスト上限(本文のみカウント、リプライは含まない)。
  // 枠が厳しい場合はここで絞り、優先度(速報>カウントダウン>キュレーション)で間引く
  dailyPostLimit: number;
}

export const X_POST_CONFIG: XPostConfig = {
  linkPlacement: {
    breaking: "none",
    curation: "reply",
    digest: "reply",
    countdown: "reply",
    result: "none",
    matchup: "reply",
  },
  dailyPostLimit: 8,
};

export interface BuiltPost {
  text: string; // 1ポスト目(本文)
  replyText?: string; // 2ポスト目(セルフリプライ)。undefinedならリプライなし
  method: LinkPlacement; // 効果測定用に方式を記録する
}

const SITE_LINK = "https://mnews.jp";

// リンク位置設定に従って本文/リプライへ振り分ける共通処理
function applyLinkPlacement(
  body: string,
  hashtags: string,
  link: string,
  placement: LinkPlacement,
  replyLabel = "詳細はこちら👇"
): BuiltPost {
  if (placement === "inline") {
    return { text: [body, link, hashtags].join("\n"), method: "inline" };
  }
  if (placement === "reply") {
    return {
      text: [body, hashtags].join("\n"),
      replyText: `${replyLabel}\n${link}`,
      method: "reply",
    };
  }
  return { text: [body, hashtags].join("\n"), method: "none" };
}

// 単一ニュースの投稿(キュレーション/速報)。速報系はラベル判定で自動分岐。
export function buildSingleNewsPost(a: Article): BuiltPost {
  const label = pickPostLabel(a.title);
  const summary = summarizeTitle(a.title);
  const body = label ? `【${label}】${summary}` : summary;
  const hashtags = buildHashtagsForOne(a).join(" ");
  const type = label === "速報" || label === "結果" ? "breaking" : "curation";
  return applyLinkPlacement(body, hashtags, a.url, X_POST_CONFIG.linkPlacement[type]);
}

// ─────────────────────────────────────────────
// 朝の「昨日のまとめ」ポスト(壁文字解消版)。
// 本文は最重要1件+件数のみ、詳細はまとめカード画像(1200×675)に載せる。
// ─────────────────────────────────────────────

export interface DigestPost extends BuiltPost {
  imageUrl: string; // まとめカード画像(/api/og/digest?date=...)
  itemCount: number;
  isSingle: boolean; // まとめ対象が1件の日は通常ポスト形式
}

function formatMD(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function buildDigestPost(articles: Article[], dateStr: string): DigestPost | null {
  if (articles.length === 0) return null;
  const imageUrl = `/api/og/digest?date=${dateStr}`;

  // 1件だけの日はダイジェスト形式にせず通常ポスト
  if (articles.length === 1) {
    const single = buildSingleNewsPost(articles[0]);
    return { ...single, imageUrl, itemCount: 1, isSingle: true };
  }

  // 要約済みトピック(1項目=1トピック・低価値除外・同一大会圧縮)。
  const topics = buildDigestTopics(articles, 4);
  if (topics.length === 0) return null;
  const top = topics[0];

  // ハッシュタグ: #MMA + 関連団体1個まで
  const orgTag = { rizin: "#RIZIN", deep: "#DEEP", pancrase: "#パンクラス", shooto: "#修斗" }[
    top.org as string
  ];
  const hashtags = orgTag ? `#MMA ${orgTag}` : "#MMA";

  // 本文に全トピックを【団体タグ】付きの箇条書きで列挙し、本文だけで完結させる
  // (旧「ほか◯件は画像で👇」は、リード内の「ほか◯件」と二重になり
  //  日本語が壊れる+添付画像への誘導文が不自然だったため廃止。
  //  画像は引き続き全トピック掲載の補強として添付する)。
  // 1行の長さ(タグ込み)はトピック数に応じて配分し、全体を全角138字以内に収める。
  const perLine = topics.length >= 4 ? 27 : topics.length === 3 ? 31 : 36;
  const toLine = (t: (typeof topics)[number]) => {
    const prefix = t.tag ? `【${t.tag}】` : "";
    return `・${prefix}${condenseTopic(t.text, perLine - fullWidthLength(prefix))}`;
  };
  let lines = topics.map(toLine);
  let body = [`🥊 昨日のMMAニュースまとめ(${formatMD(dateStr)})`, ...lines].join("\n");
  // 万一収まらない場合は末尾トピックから削る(最低2行は残す)
  while (fullWidthLength(body) + fullWidthLength(hashtags) > 138 && lines.length > 2) {
    lines = lines.slice(0, -1);
    body = [`🥊 昨日のMMAニュースまとめ(${formatMD(dateStr)})`, ...lines].join("\n");
  }

  // 全件への誘導はセルフリプライで行う。リンクには日付ベースのキャッシュバスタ
  // (?d=YYYY-MM-DD)を付ける。Xは投稿リンクのURL単位でOGPをキャッシュするため、
  // 毎回同じ https://mnews.jp を貼るとホームOGPを更新してもXが古いカードを
  // 出し続ける。日付でURLを日替わりにすることで、Xに毎回新規URLとして再取得させ、
  // 現行のホームOGP(新デザイン)を確実に表示させる。?d はNext側では未使用の
  // クエリなので表示・挙動には影響しない。
  const digestLink = `${SITE_LINK}/?d=${dateStr}`;
  const built = applyLinkPlacement(
    body,
    hashtags,
    digestLink,
    X_POST_CONFIG.linkPlacement.digest,
    "全件はこちら👇"
  );
  return { ...built, imageUrl, itemCount: articles.length, isSingle: false };
}

// ─────────────────────────────────────────────
// 大会前日カウントダウンポスト(前日20:00想定)。
// 対戦カード一覧は画像(/api/og/event-card/[slug])に載せる。
// ─────────────────────────────────────────────

export interface CountdownPost extends BuiltPost {
  imageUrl: string;
}

// ─────────────────────────────────────────────
// 試合結果速報ポスト(結果カード画像を添付する前提。リンクなし)。
// 文面テンプレートはイベントごとに調整可能: org→ハッシュタグの対応で自動生成。
// ─────────────────────────────────────────────

const ORG_HASHTAG: Record<string, string> = {
  rizin: "#RIZIN",
  deep: "#DEEP",
  pancrase: "#パンクラス",
  shooto: "#修斗",
};

// 大会名から「団体_大会名」形式の大会タグを生成する(#無し・生トークン)。
// @メンションとハッシュタグの両方でこの1トークンを共用する。開催地サフィックス
// (" in HIROSHIMA"等)は落とし、先頭の英字org部分とそれ以降の大会名部分
// (空白・記号を除去)をアンダースコアで連結する
// (例: RIZIN LANDMARK 15 in HIROSHIMA → RIZIN_LANDMARK15、PANCRASE 364 →
// PANCRASE_364、RIZIN.54 → RIZIN_54)。
// 先頭が英字でない大会名(例:「超RIZIN.5」)は区切り位置を判定できないため、
// 従来どおり全体を1トークンに詰めた値をそのまま返す(アンダースコア無し)。
export function eventTag(eventName: string): string {
  let n = eventName.trim().replace(/\s+in\s+.+$/i, "");
  // 号数の後に日本語の副題が続く場合は号数まで(例: 超RIZIN.5 浪速の超復活祭り → 超RIZIN.5)
  n = n.replace(/([0-9])[\s　]+[぀-ヿ一-鿿].*$/, "$1");
  const m = n.match(/^([A-Za-z]+)(.*)$/);
  if (m) {
    const org = m[1].toUpperCase();
    const rest = m[2].replace(/[^A-Za-z0-9぀-ヿ一-鿿]/g, "").toUpperCase();
    return rest ? `${org}_${rest}` : org;
  }
  return n.replace(/[^A-Za-z0-9぀-ヿ一-鿿]/g, "");
}

// findRankLabelInDivision由来のラベルは"王者"か"{数字}位"のいずれか。
// 「AI RIZINランキング」は数字順位にのみ前置し、王者には付けない
// (「AI RIZINランキング王者」は不自然なため)。
function isNumericRankLabel(rank: string): boolean {
  return /^\d+位$/.test(rank);
}

// winner/loserの表示名に、あれば「AI RIZINランキング」順位ラベルを差し込む。
// - 王者ラベルは枕詞なしの「王者」のみ(「AI RIZINランキング」を付けない)。
// - 「AI RIZINランキング」は文中で最初に登場する(=winner側優先の)数字順位
//   ラベルにだけ1回前置する。2人目以降の数字順位ラベルは「{順位}」のみ。
// - 未ランク(rank未指定/null)は枕詞なし・名前のみ。
function withRankPrefix(
  winner: string,
  loser: string,
  winnerRank?: string | null,
  loserRank?: string | null
): { winner: string; loser: string } {
  if (!winnerRank && !loserRank) return { winner, loser };
  const winnerIsNumeric = !!winnerRank && isNumericRankLabel(winnerRank);
  const loserIsNumeric = !!loserRank && isNumericRankLabel(loserRank);
  // 文中で先に登場するのは常にwinner側(引き分け時もfighterA側)なので、
  // winnerが数字順位ならそちらへ、そうでなければ(未ランク/王者)loser側の
  // 数字順位へ前置する。
  const winnerLabel = winnerIsNumeric ? `AI RIZINランキング${winnerRank}` : winnerRank ?? "";
  const loserLabel = !winnerIsNumeric && loserIsNumeric ? `AI RIZINランキング${loserRank}` : loserRank ?? "";
  return { winner: `${winnerLabel}${winner}`, loser: `${loserLabel}${loser}` };
}

export function buildResultPost(opts: {
  org: string;
  winner: string;
  loser: string;
  method: string;
  isDraw?: boolean;
  // その試合の階級におけるAI RIZINランキング順位ラベル("王者"/"◯位")。
  // 未ランクはnull(順位を捏造しない)。省略時は両者未ランク扱い。
  winnerRank?: string | null;
  loserRank?: string | null;
  // 大会名(あれば #DEEP132 のような大会ハッシュタグを付ける)
  eventName?: string;
  // ライブ結果入力から登録される試合結果は news_type=result 固定。
  // 【速報】プレフィックスはサイト表示と共有の判定関数から導出する。
  newsType?: NewsType;
}): BuiltPost {
  const orgTag = ORG_HASHTAG[opts.org] ?? "";
  const tag = opts.eventName ? eventTag(opts.eventName) : "";
  // ハッシュタグは「団体+大会タグ(#団体_大会名)」。#MMA(ビッグワード)は付けない
  const evHashtag = tag ? `#${tag}` : "";
  const hashtags = [orgTag, evHashtag !== orgTag ? evHashtag : ""].filter(Boolean).join(" ");
  const prefix = flashPrefixForType(opts.newsType ?? "result");
  const { winner, loser } = withRankPrefix(opts.winner, opts.loser, opts.winnerRank, opts.loserRank);
  const body = opts.isDraw
    ? `${prefix}${winner} vs ${loser}は${opts.method || "引き分け"}`
    : `${prefix}${winner}が${loser}に${opts.method}勝ち`;
  return applyLinkPlacement(body, hashtags, SITE_LINK, X_POST_CONFIG.linkPlacement.result);
}

// フォーマット(指定どおり):
//   🔥 いよいよ明日開催
//   {大会名}
//   {M/D} {開始}〜 @{会場}
//   視聴: {配信}
//
//   ※大会終了まで本ポストを固定します。
// 「大会終了まで固定」は運用上、投稿後に手動でXの固定ポストに設定すること
// （固定ポスト自体はX APIの投稿とは別操作のため自動化しない）。
export function buildCountdownPost(event: {
  slug: string;
  eventName: string;
  date: string;
  startTime?: string;
  venue?: string;
  broadcast?: string[];
}): CountdownPost {
  const lines = [
    `🔥 いよいよ明日開催`,
    event.eventName,
    `${formatMD(event.date)} ${event.startTime ? `${event.startTime}〜` : ""}${event.venue ? ` @${event.venue}` : ""}`,
  ];
  if (event.broadcast?.[0]) lines.push(`視聴: ${event.broadcast[0]}`);
  lines.push("");
  lines.push("※大会終了まで本ポストを固定します。");
  const body = lines.join("\n");
  const hashtags = "#MMA";
  const link = `${SITE_LINK}/events/${event.slug}`;
  const built = applyLinkPlacement(body, hashtags, link, X_POST_CONFIG.linkPlacement.countdown, "対戦カード・詳細はこちら👇");
  return { ...built, imageUrl: `/api/og/event-card/${event.slug}` };
}

// ─────────────────────────────────────────────
// 大会前日 計量結果まとめ投稿(手動入力データから整形)。
// フォーマット:
//   ⚖️ 計量結果まとめ
//   {大会名}（{計量日}計量）
//
//   ✅ 全選手パス          ※全員パス時のみ
//   {A} vs {B}
//   ...
//
//   ❌ 計量失敗            ※失敗者がいる場合のみ
//   {選手}（+{超過}kg）
// ─────────────────────────────────────────────

export interface WeighInBoutInput {
  fighterA: string;
  fighterB: string;
  resultA: "pass" | "fail";
  resultB: "pass" | "fail";
  weightA?: string; // 任意表示(超過幅など)
  weightB?: string;
}

export function buildWeighInPost(opts: {
  eventName: string;
  weighInDate: string; // YYYY-MM-DD
  bouts: WeighInBoutInput[];
}): BuiltPost {
  const d = new Date(opts.weighInDate);
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

  const failedEntries: string[] = [];
  const passLines: string[] = [];
  for (const b of opts.bouts) {
    const allPass = b.resultA === "pass" && b.resultB === "pass";
    if (allPass) {
      passLines.push(`${b.fighterA} vs ${b.fighterB}`);
    } else {
      // 計量失敗の選手には、パスした対戦相手名を併記する(「誰との対戦の計量か」
      // が本文だけで分かるようにするため)。両者失敗の場合は相手も失敗のため
      // 併記しない(超過幅のみ表示)。
      if (b.resultA === "fail") {
        const parts = [b.resultB === "pass" ? `VS${b.fighterB}✅` : "", b.weightA ?? ""].filter(Boolean);
        failedEntries.push(`${b.fighterA}${parts.length ? `（${parts.join("・")}）` : ""}`);
      }
      if (b.resultB === "fail") {
        const parts = [b.resultA === "pass" ? `VS${b.fighterA}✅` : "", b.weightB ?? ""].filter(Boolean);
        failedEntries.push(`${b.fighterB}${parts.length ? `（${parts.join("・")}）` : ""}`);
      }
    }
  }

  const lines = ["⚖️ 計量結果まとめ", `${opts.eventName}（${dateLabel}計量）`, ""];

  if (failedEntries.length === 0) {
    lines.push("✅ 全選手パス");
    lines.push(...opts.bouts.map((b) => `${b.fighterA} vs ${b.fighterB}`));
  } else {
    if (passLines.length > 0) {
      lines.push("✅ パス");
      lines.push(...passLines);
      lines.push("");
    }
    lines.push("❌ 計量失敗");
    lines.push(...failedEntries);
  }

  const body = lines.join("\n");
  return { text: body, method: "none" };
}

// ─────────────────────────────────────────────
// 管理画面(投稿ドラフト タブ①): 対戦カード文脈ポスト。
// 大手メディアが「対戦決定」と速報した直後に差し込む"参照"用。速報ではないため
// 戦績データの多少のラグは許容(fighterRecords.jsonのバッチ結果をそのまま使う)。
// nodata選手はタブ側の選択肢自体から除外する運用のため、wins/losses/ko/subは
// 必須(オプショナルにしない)。フィニッシュ率＝(KO+一本)÷勝利数×100
// (calcFighterRatesと同じ式。分母は総試合数ではなく勝利数)。
// ─────────────────────────────────────────────
export interface MatchupFighterInput {
  nameJa: string;
  slug: string;
  wins: number;
  losses: number;
  ko: number;
  sub: number; // 一本
}

function finishRatePercent(f: MatchupFighterInput): number | null {
  return f.wins > 0 ? Math.round(((f.ko + f.sub) / f.wins) * 100) : null;
}

export function buildMatchupContextPost(opts: {
  fighterA: MatchupFighterInput;
  fighterB: MatchupFighterInput;
  eventName?: string;
  weightClass?: string;
}): BuiltPost {
  const evPart = opts.eventName ? `（${opts.eventName}）` : "";
  const wcPart = opts.weightClass ? `/${opts.weightClass}` : "";
  const title = `【対戦決定】${opts.fighterA.nameJa} vs ${opts.fighterB.nameJa}${evPart}${wcPart}`;
  const line = (f: MatchupFighterInput) => {
    const fr = finishRatePercent(f);
    const frLabel = fr !== null ? `${fr}%` : "—";
    return `・${f.nameJa}：戦績${f.wins}勝${f.losses}敗（KO${f.ko}、一本${f.sub}、フィニッシュ率${frLabel}）`;
  };
  const body = [title, line(opts.fighterA), line(opts.fighterB)].join("\n");
  const norm = normalizeVsSlugs(opts.fighterA.slug, opts.fighterB.slug);
  const vsUrl = `${SITE_LINK}/vs/${norm.a}/${norm.b}`;
  return applyLinkPlacement(body, "", vsUrl, X_POST_CONFIG.linkPlacement.matchup, "対戦カード比較はこちら👇");
}

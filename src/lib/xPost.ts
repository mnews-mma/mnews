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
    matchup: LinkPlacement; // 管理画面①対戦カード文脈: 単一ツイート本文末尾にリンク(2026-07-20〜、buildMatchupContextPost側で直接組み立てるため実際には未参照)
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
    matchup: "inline",
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
// 必須(オプショナルにしない)。
//
// 2026-07-20リフォーマット: 単一ツイート化(セルフリプライ廃止)。カードは
// 本文末尾の/vs URLをX側のOGPアンフルで出す(画像直貼りはしない、/dreamと
// 同方式)。戦績詳細2行はカード画像に全部載っていて本文では冗長なため削除。
//
// 2026-07-20追い変更(1回目): 当初は🟥/🟦の並びを/vsの辞書順正規化に無条件で
// 合わせ、コーナー(赤/青)選択を本文側では表現不能にしていた。/vs・
// /api/og/vsに?red={slug}(赤コーナー指定、未指定時は辞書順先がデフォルト)を
// 追加したことでこの制約が外れたため、呼び出し側(opts.fighterA)が選んだ赤を
// そのまま尊重するよう戻した。選んだ赤が辞書順先(=デフォルト)と一致する
// 場合は?red=を省略しクリーンURLのまま、逆の場合のみ?red={選んだ赤のslug}
// を付与して/vs側のカードを追従させる(この?red=ロジック自体は本改訂でも
// 不変)。
//
// 2026-07-20追い変更(2回目・本文ブラッシュアップ): 🟥/🟦・区切り線・複数行の
// コーナー装飾を撤去し、ヘッダー1行(【対戦決定】A vs B（階級）)に戻した。
// 本文からコーナー表現そのものが消えるため、本文とカードの色不一致問題は
// 構造ごと解消する(カードの赤/青は引き続き?red=が制御し、swapの役割は
// 不変)。代わりに、カード画像に載っていないmnews独自の付加価値データを
// 「フック行」として最大1行だけ添える(優先順: ①同一階級の両者AIランク
// ②3連勝以上 ③共通の対戦相手。いずれも呼び出し側が事前に解決した値のみを
// 受け取り、xPost.ts側でデータ取得は一切行わない=zero-fabrication)。
// ─────────────────────────────────────────────
export interface MatchupFighterInput {
  nameJa: string;
  slug: string;
  wins: number;
  losses: number;
  ko: number;
  sub: number; // 一本
}

// X(Twitter)の重み付き文字数(全角=2、半角=1)。URLはt.co短縮により実際の
// 文字数によらず常に23として数える(公式仕様)。
function weightedCharLength(s: string): number {
  let len = 0;
  for (const ch of s) len += ch.charCodeAt(0) <= 0xff ? 1 : 2;
  return len;
}
const X_URL_WEIGHT = 23;
const X_MAX_WEIGHT = 280;

// 本文中のURL部分だけ実文字数ではなく固定23として数える(URL以外は実文字数で
// 重み付け計算する)。本文中に同じURLが複数回現れない前提(buildMatchupContextPost
// は必ず1回のみ挿入する)。
function weightedTweetLength(text: string, url: string): number {
  if (!text.includes(url)) return weightedCharLength(text);
  const placeholder = "x".repeat(X_URL_WEIGHT);
  return weightedCharLength(text.split(url).join(placeholder));
}

// 優先順①同一階級AIランク②3連勝以上③共通の対戦相手。該当なければ行ごと
// 省略(埋め草禁止)。各フック候補はopts側で事前に解決済みの値のみを受け取り、
// ここでは優先順位判定とフォーマットのみ行う。
function pickHookLine(opts: {
  rankHook?: { labelA: string; labelB: string };
  streakHook?: { name: string; count: number };
  commonOpponentsHook?: { names: string[] };
}): string | undefined {
  if (opts.rankHook) return `📊 AIランク: ${opts.rankHook.labelA} vs ${opts.rankHook.labelB}`;
  if (opts.streakHook && opts.streakHook.count >= 3) return `🔥 ${opts.streakHook.name} ${opts.streakHook.count}連勝中`;
  if (opts.commonOpponentsHook && opts.commonOpponentsHook.names.length > 0) {
    const { names } = opts.commonOpponentsHook;
    const label = names.length === 1 ? names[0] : `${names.length}人`;
    return `🤝 共通の対戦相手: ${label}`;
  }
  return undefined;
}

export function buildMatchupContextPost(opts: {
  fighterA: MatchupFighterInput; // 管理画面で「赤」に置いた選手(タブ①のswapで入れ替え可能)
  fighterB: MatchupFighterInput; // 「青」
  eventName?: string;
  weightClass?: string;
  // データフック候補(zero-fabrication: 呼び出し側が実データから事前に
  // 解決できた場合のみ渡す。憶測・埋め草は渡さない)。
  rankHook?: { labelA: string; labelB: string };
  streakHook?: { name: string; count: number };
  commonOpponentsHook?: { names: string[] };
}): BuiltPost {
  const redFighter = opts.fighterA;
  const blueFighter = opts.fighterB;
  const norm = normalizeVsSlugs(redFighter.slug, blueFighter.slug);
  const redParam = norm.a !== redFighter.slug ? `?red=${redFighter.slug}` : "";
  const vsUrl = `${SITE_LINK}/vs/${norm.a}/${norm.b}${redParam}`;

  const hookLine = pickHookLine(opts);
  const wc = opts.weightClass?.trim();
  const ev = opts.eventName?.trim();
  // Xのタグは`.`「・」空白の直後で切れるため、大会名から除去して正規化する
  // (例: 「超RIZIN.5」→「#超RIZIN5」)。
  const evTag = ev ? ev.replace(/[.\s　・]/g, "") : "";

  function assemble(includeHook: boolean, includeWeightClass: boolean): string {
    const wcPart = includeWeightClass && wc ? `（${wc}）` : "";
    const lines: string[] = [`【対戦決定】${redFighter.nameJa} vs ${blueFighter.nameJa}${wcPart}`];
    if (includeHook && hookLine) {
      lines.push("");
      lines.push(hookLine);
    }
    lines.push("");
    lines.push("詳細データで比較👇");
    lines.push(vsUrl);
    if (evTag) {
      lines.push("");
      lines.push(`#${evTag}`);
    }
    return lines.join("\n");
  }

  // 文字数ガード(X上限280、weighted): 超過時はフック行→⚖️階級の順に
  // 自動で落とす。ヘッダー・選手名・URLは死守(この2つ以外は削らない)。
  let includeHook = true;
  let includeWeightClass = true;
  let text = assemble(includeHook, includeWeightClass);
  if (weightedTweetLength(text, vsUrl) > X_MAX_WEIGHT && includeHook) {
    includeHook = false;
    text = assemble(includeHook, includeWeightClass);
  }
  if (weightedTweetLength(text, vsUrl) > X_MAX_WEIGHT && includeWeightClass) {
    includeWeightClass = false;
    text = assemble(includeHook, includeWeightClass);
  }

  return { text, method: "inline" };
}

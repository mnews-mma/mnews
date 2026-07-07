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

  // 全件への誘導はセルフリプライで行う
  const built = applyLinkPlacement(
    body,
    hashtags,
    SITE_LINK,
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

// 大会名からXハッシュタグを生成する。
// 「DEEP 132 IMPACT」のような「団体名+号数」型は #DEEP132 に短縮し、
// それ以外は開催地サフィックス(" in HIROSHIMA"等)を落として記号を除いた
// 連結形にする(例: RIZIN LANDMARK 15 in HIROSHIMA → #RIZINLANDMARK15)。
export function eventHashtag(eventName: string): string {
  let n = eventName.trim().replace(/\s+in\s+.+$/i, "");
  // 号数の後に日本語の副題が続く場合は号数まで(例: 超RIZIN.5 浪速の超復活祭り → 超RIZIN.5)
  n = n.replace(/([0-9])[\s　]+[぀-ヿ一-鿿].*$/, "$1");
  const m = n.match(/^([A-Za-z]+)[\s.]+(\d+)/);
  if (m) return `#${m[1].toUpperCase()}${m[2]}`;
  const compact = n.replace(/[^A-Za-z0-9぀-ヿ一-鿿]/g, "");
  return compact ? `#${compact}` : "";
}

export function buildResultPost(opts: {
  org: string;
  winner: string;
  loser: string;
  method: string;
  isDraw?: boolean;
  // 大会名(あれば #DEEP132 のような大会ハッシュタグを付ける)
  eventName?: string;
  // ライブ結果入力から登録される試合結果は news_type=result 固定。
  // 【速報】プレフィックスはサイト表示と共有の判定関数から導出する。
  newsType?: NewsType;
}): BuiltPost {
  const orgTag = ORG_HASHTAG[opts.org] ?? "";
  const evTag = opts.eventName ? eventHashtag(opts.eventName) : "";
  // ハッシュタグは「団体+大会名」。#MMA(ビッグワード)は付けない
  const hashtags = [orgTag, evTag !== orgTag ? evTag : ""].filter(Boolean).join(" ");
  const prefix = flashPrefixForType(opts.newsType ?? "result");
  const body = opts.isDraw
    ? `${prefix}${opts.winner} vs ${opts.loser}は${opts.method || "引き分け"}`
    : `${prefix}${opts.winner}が${opts.loser}に${opts.method}勝ち`;
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
      if (b.resultA === "fail") {
        failedEntries.push(`${b.fighterA}${b.weightA ? `（${b.weightA}）` : ""}`);
      }
      if (b.resultB === "fail") {
        failedEntries.push(`${b.fighterB}${b.weightB ? `（${b.weightB}）` : ""}`);
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
// ─────────────────────────────────────────────
export interface MatchupFighterInput {
  nameJa: string;
  slug: string | null; // 未登録選手はnull(プレーンテキストのみ・URLもメンションも付けない)
  wins?: number;
  losses?: number;
  draws?: number;
}

export function buildMatchupContextPost(opts: {
  fighterA: MatchupFighterInput;
  fighterB: MatchupFighterInput;
  eventName?: string;
}): BuiltPost {
  const recordLine = (f: MatchupFighterInput) => {
    if (f.wins === undefined || f.losses === undefined) return `${f.nameJa}`;
    const draws = f.draws ? `${f.draws}分` : "";
    return `${f.nameJa}：戦績${f.wins}勝${f.losses}敗${draws}`;
  };
  const title = opts.eventName ? `【対戦決定】${opts.fighterA.nameJa} vs ${opts.fighterB.nameJa}（${opts.eventName}）` : `【対戦決定】${opts.fighterA.nameJa} vs ${opts.fighterB.nameJa}`;
  const lines = [title, recordLine(opts.fighterA), recordLine(opts.fighterB)];
  const urls = [opts.fighterA.slug, opts.fighterB.slug]
    .filter((s): s is string => !!s)
    .map((s) => `${SITE_LINK}/fighters/${s}`);
  if (urls.length > 0) lines.push(`詳細 ${urls.join(" ")}`);
  return { text: lines.join("\n"), method: "none" };
}

// ─────────────────────────────────────────────
// 管理画面(投稿ドラフト タブ③): 試合結果ポスト(手入力・自動戦績なし)。
// 戦績の出典(Wikipedia日次バッチ)は試合直後に未更新のことが多いため、
// W-L等の数値は絶対に自動挿入しない。載せたい場合のみ呼び出し側が手入力した
// 文字列(manualRecord)をそのまま末尾に付ける(空なら何も付けない)。
// ─────────────────────────────────────────────
export function buildManualResultPost(opts: {
  winnerName: string;
  winnerSlug: string | null;
  loserName: string;
  method: string; // 例: "KO(2R 1:09)" のように呼び出し側で整形済みの文字列
  manualRecord?: string; // 例: "12勝3敗"。空/未入力なら本文に出さない
}): BuiltPost {
  const body = `【結果】${opts.winnerName}が${opts.loserName}に${opts.method}で勝利。`;
  const recordSuffix = opts.manualRecord?.trim() ? `（${opts.winnerName}${opts.manualRecord.trim()}）` : "";
  const url = opts.winnerSlug ? `${SITE_LINK}/fighters/${opts.winnerSlug}` : "";
  const lines = [body + recordSuffix];
  if (url) lines.push(url);
  return { text: lines.join("\n"), method: "none" };
}

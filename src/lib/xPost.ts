import type { Article } from "./articles";
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

  // 要約済みトピック(1項目=1トピック・35字以内・低価値除外・同一大会圧縮)。
  const topics = buildDigestTopics(articles, 4);
  if (topics.length === 0) return null;
  const top = topics[0];

  // ハッシュタグ: #MMA + 関連団体1個まで
  const orgTag = { rizin: "#RIZIN", deep: "#DEEP", pancrase: "#パンクラス", shooto: "#修斗" }[
    top.org as string
  ];
  const hashtags = orgTag ? `#MMA ${orgTag}` : "#MMA";

  // 最重要トピック1件(タグ込みで全角40字以内)
  let lead = top.tag ? `【${top.tag}】${top.text}` : top.text;
  if (fullWidthLength(lead) > 40) {
    lead = top.tag
      ? `【${top.tag}】${condenseTopic(top.text, 40 - fullWidthLength(`【${top.tag}】`))}`
      : condenseTopic(top.text, 40);
  }

  // 「ほかN件」は生記事数ではなく、画像に載る残りトピック数と一致させる
  // (以前、記事数とのズレで誤解を招いた反省を踏まえた仕様)
  const otherTopics = topics.length - 1;
  const lines = [`🥊 昨日のMMAニュースまとめ(${formatMD(dateStr)})`, lead];
  if (otherTopics > 0) lines.push(`ほか${otherTopics}件は画像で👇`);
  const body = lines.join("\n");

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

export function buildResultPost(opts: {
  org: string;
  winner: string;
  loser: string;
  method: string;
  isDraw?: boolean;
}): BuiltPost {
  const orgTag = ORG_HASHTAG[opts.org] ?? "";
  const hashtags = [orgTag, "#MMA"].filter(Boolean).join(" ");
  const body = opts.isDraw
    ? `【速報】${opts.winner} vs ${opts.loser}は${opts.method || "引き分け"}`
    : `【速報】${opts.winner}が${opts.loser}に${opts.method}勝ち`;
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

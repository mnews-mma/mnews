import { TwitterApi } from "twitter-api-v2";

// ─────────────────────────────────────────────
// X (旧Twitter) 自動投稿の共通クライアント。
//
// 安全装置: X_POST_ENABLED が "true" でない限り、実際には投稿せず
// 内容をログ出力するだけの dry-run で動作する。本番有効化は
// 疎通確認が済んでから明示的に env を切り替えて行う。
//
// 認証は OAuth 1.0a User Context（consumer key/secret + access
// token/secret の署名）。Bearer Token は読み取り専用APIのために
// 保持しているだけで、投稿には使わない。
// ─────────────────────────────────────────────

export function isXPostEnabled(): boolean {
  return process.env.X_POST_ENABLED === "true";
}

function getClient(): TwitterApi {
  const appKey = process.env.X_API_KEY;
  const appSecret = process.env.X_API_KEY_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("X API credentials are not fully set");
  }
  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

export interface XPostResult {
  ok: boolean;
  dryRun: boolean;
  tweetId?: string;
  // 失敗時の診断情報。キー・トークン等の秘密情報は含めない。
  error?: { status?: number; message: string; rateLimited?: boolean; paymentRequired?: boolean };
}

interface PostTweetInput {
  text: string;
  replyToId?: string; // 指定時はこのtweetへのリプライとして投稿
  imageUrl?: string; // 指定時は画像を取得してメディア添付（絶対URL）
}

// 画像URL(自サイトの/api/og/*等)を取得してBufferにする
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status} ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function summarizeError(err: unknown): XPostResult["error"] {
  // twitter-api-v2 のエラーは code/data にステータス等を持つ。
  // 秘密情報（Authorizationヘッダ等）を含めないようメッセージのみ抽出する。
  const anyErr = err as { code?: number; message?: string; data?: unknown };
  const status = typeof anyErr?.code === "number" ? anyErr.code : undefined;
  return {
    status,
    message: anyErr?.message ?? String(err),
    rateLimited: status === 429,
    paymentRequired: status === 402,
  };
}

// 単発ポスト(画像添付・リプライ指定に対応)。dry-run時は実際には送信しない。
export async function postTweet(input: PostTweetInput): Promise<XPostResult> {
  const dryRun = !isXPostEnabled();

  if (dryRun) {
    console.log(
      `[x-client][dry-run] postTweet text="${input.text.slice(0, 80)}"` +
        `${input.replyToId ? ` replyTo=${input.replyToId}` : ""}` +
        `${input.imageUrl ? ` image=${input.imageUrl}` : ""}`
    );
    return { ok: true, dryRun: true, tweetId: "dryrun-" + Date.now() };
  }

  try {
    const client = getClient();
    let mediaId: string | undefined;
    if (input.imageUrl) {
      const buffer = await fetchImageBuffer(input.imageUrl);
      mediaId = await client.v1.uploadMedia(buffer, { mimeType: "image/png" });
    }
    const res = await client.v2.tweet({
      text: input.text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
      ...(input.replyToId ? { reply: { in_reply_to_tweet_id: input.replyToId } } : {}),
    });
    console.log(`[x-client] posted id=${res.data.id}`);
    return { ok: true, dryRun: false, tweetId: res.data.id };
  } catch (err) {
    const error = summarizeError(err);
    console.error(`[x-client] postTweet failed: status=${error?.status} message=${error?.message}`);
    return { ok: false, dryRun: false, error };
  }
}

export interface ThreadResult {
  ok: boolean;
  dryRun: boolean;
  mainResult: XPostResult;
  replyResult?: XPostResult;
}

// 本文投稿→成功したそのtweetへセルフリプライ、の2段階投稿。
// レート制限緩和のため投稿間に短いディレイを入れる。
export async function postThread(opts: {
  text: string;
  replyText?: string;
  imageUrl?: string;
  replyDelayMs?: number;
}): Promise<ThreadResult> {
  const mainResult = await postTweet({ text: opts.text, imageUrl: opts.imageUrl });
  if (!mainResult.ok || !opts.replyText) {
    return { ok: mainResult.ok, dryRun: mainResult.dryRun, mainResult };
  }

  if (opts.replyDelayMs) {
    await new Promise((r) => setTimeout(r, opts.replyDelayMs));
  }

  const replyResult = await postTweet({
    text: opts.replyText,
    replyToId: mainResult.tweetId,
  });
  return { ok: mainResult.ok && replyResult.ok, dryRun: mainResult.dryRun, mainResult, replyResult };
}

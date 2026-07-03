import { fetchRawArticles } from "@/lib/feeds/aggregate";
import { buildTweetDigest } from "@/lib/tweetDigest";
import { SOURCES } from "@/lib/sources";
import type { Article } from "@/lib/articles";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(articles: Article[], tweetText: string): string {
  if (articles.length === 0) {
    return "<p>過去24時間の新着記事はありませんでした。</p>";
  }
  const rows = articles
    .map((a) => {
      const label = SOURCES[a.source]?.label ?? a.source;
      const color = SOURCES[a.source]?.color ?? "#777";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;">
            <span style="font-family:monospace;font-size:11px;color:${color};border:1px solid ${color};padding:2px 6px;">${escapeHtml(label)}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <a href="${a.url}" style="color:#0a0a0a;text-decoration:none;font-weight:600;">${escapeHtml(a.title)}</a>
            <div style="font-size:11px;color:#999;margin-top:2px;">via ${escapeHtml(a.origin)}</div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:640px;">
      <h2 style="font-size:16px;">Mニュース 朝刊ダイジェスト（過去24時間・${articles.length}件）</h2>

      <h3 style="font-size:13px;">X投稿用テキスト（自動生成）</h3>
      <pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;background:#fff7e6;padding:12px;border-radius:4px;border:1px solid #f0d9a0;">${escapeHtml(tweetText)}</pre>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:24px;">${rows}</table>

      <p style="margin-top:16px;"><a href="https://www.mnews.jp">Mニュースで全件見る →</a></p>
    </div>`;
}

export interface DigestSendResult {
  ok: boolean;
  count: number;
  // 診断用: 送信元・送信先(伏せ字)・Resendの応答(メッセージID or エラー本文)
  from: string;
  toMasked: string;
  messageId?: string;
  error?: string;
  subject?: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

// 朝刊ダイジェストのメールを送信し、Resendの応答を含む結果を返す。
// cron と 管理画面のテスト送信の両方から使う。subjectPrefix でテスト送信を区別できる。
export async function sendDigestEmail(opts?: { subjectPrefix?: string }): Promise<DigestSendResult> {
  const { articles } = await fetchRawArticles();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles
    .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const { text: tweetText } = buildTweetDigest(recent);
  const html = buildHtml(recent, tweetText);

  const toEmail = process.env.DIGEST_TO_EMAIL;
  const fromEmail = process.env.DIGEST_FROM_EMAIL ?? "Mニュース <onboarding@resend.dev>";
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey || !toEmail) {
    return {
      ok: false,
      count: recent.length,
      from: fromEmail,
      toMasked: toEmail ? maskEmail(toEmail) : "(未設定)",
      error: "RESEND_API_KEY または DIGEST_TO_EMAIL が未設定",
    };
  }

  const subject = `${opts?.subjectPrefix ?? ""}Mニュース 朝刊ダイジェスト（${recent.length}件）`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html, text: tweetText }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`[digest-email] 送信失敗 status=${res.status} body=${bodyText}`);
    return {
      ok: false,
      count: recent.length,
      from: fromEmail,
      toMasked: maskEmail(toEmail),
      error: `status ${res.status}: ${bodyText}`,
      subject,
    };
  }

  let messageId: string | undefined;
  try {
    messageId = JSON.parse(bodyText).id;
  } catch {
    /* ignore */
  }
  console.log(`[digest-email] 送信成功 id=${messageId} to=${maskEmail(toEmail)} from=${fromEmail} count=${recent.length}`);
  return {
    ok: true,
    count: recent.length,
    from: fromEmail,
    toMasked: maskEmail(toEmail),
    messageId,
    subject,
  };
}

import { fetchRawArticles } from "@/lib/feeds/aggregate";
import { SOURCES } from "@/lib/sources";
import type { Article } from "@/lib/articles";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 朝刊メール: 過去24時間の全ニュースをテキスト一覧で届ける。
// X投稿の下書きは自動生成しない(どこまでロジックを詰めても選定は絞れない
// ため、管理画面 /admin/x-preview で人間が選んで変換する運用)。
// 画像も添付しない。
const PICKER_URL = "https://www.mnews.jp/admin/x-preview";

function buildHtml(articles: Article[]): string {
  if (articles.length === 0) {
    return "<p>過去24時間の新着記事はありませんでした。</p>";
  }
  const rows = articles
    .map((a) => {
      const label = SOURCES[a.source]?.label ?? a.source;
      const color = SOURCES[a.source]?.color ?? "#777";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;">
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
      <h2 style="font-size:16px;">Mニュース 朝刊（過去24時間・${articles.length}件）</h2>

      <a href="${PICKER_URL}" style="display:inline-block;background:#e8002d;color:#fff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none;margin:8px 0 16px;">
        X投稿を作成する（記事を選んで変換）→
      </a>
      <div style="font-size:11px;color:#999;margin-bottom:16px;">
        ※管理画面のため認証済みの端末で開いてください
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>

      <p style="margin-top:16px;"><a href="https://www.mnews.jp">Mニュースで全件見る →</a></p>
    </div>`;
}

// プレーンテキスト版(メールクライアントのフォールバック)
function buildText(articles: Article[]): string {
  if (articles.length === 0) return "過去24時間の新着記事はありませんでした。";
  const lines = articles.map((a) => {
    const label = SOURCES[a.source]?.label ?? a.source;
    return `[${label}] ${a.title}\n${a.url}`;
  });
  return [`Mニュース 朝刊（過去24時間・${articles.length}件）`, "", ...lines, "", `X投稿の作成: ${PICKER_URL}`].join("\n");
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

// 朝刊メールを送信し、Resendの応答を含む結果を返す。
// cron と 管理画面のテスト送信の両方から使う。subjectPrefix でテスト送信を区別できる。
export async function sendDigestEmail(opts?: { subjectPrefix?: string }): Promise<DigestSendResult> {
  const { articles } = await fetchRawArticles();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles
    .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const html = buildHtml(recent);
  const text = buildText(recent);

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

  const subject = `${opts?.subjectPrefix ?? ""}Mニュース 朝刊（${recent.length}件）`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html, text }),
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

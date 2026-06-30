import { NextResponse } from "next/server";
import { fetchRawArticles } from "@/lib/feeds/aggregate";
import { buildTweetDigest } from "@/lib/tweetDigest";
import { SOURCES } from "@/lib/sources";
import type { Article } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { articles } = await fetchRawArticles();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = articles.filter((a) => new Date(a.publishedAt).getTime() >= cutoff);
    recent.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const { text: tweetText } = buildTweetDigest(recent);
    const html = buildHtml(recent, tweetText);

    const toEmail = process.env.DIGEST_TO_EMAIL;
    const fromEmail = process.env.DIGEST_FROM_EMAIL ?? "Mニュース <onboarding@resend.dev>";
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey || !toEmail) {
      return NextResponse.json({ ok: false, error: "RESEND_API_KEY or DIGEST_TO_EMAIL not set" }, { status: 500 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `Mニュース 朝刊ダイジェスト（${recent.length}件）`,
        html,
        text: tweetText,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ ok: false, error: errText }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: recent.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

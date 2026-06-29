// 毎朝8:00（JST）に GitHub Actions から実行。過去24時間に取得した記事
// （公式発表・ニュース問わず全件）のタイトルとURLをメールでまとめて送る。
// そこから手動で3〜5本選んで投稿する運用を想定している。
//
// 実行: npx tsx scripts/daily-digest.ts
import { fetchRawArticles } from "../src/lib/feeds/aggregate";
import { SOURCES } from "../src/lib/sources";
import type { Article } from "../src/lib/articles";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DIGEST_TO = process.env.DIGEST_TO_EMAIL;
const DIGEST_FROM = process.env.DIGEST_FROM_EMAIL ?? "Mニュース <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// X投稿用にそのままコピペできるテキスト。ヘッダー／フッターで挟んだ
// 「【昨日のMMAニュースピックアップ🥊】」形式の投稿1本分を組み立てる。
function buildCopyText(articles: Article[]): string {
  const list =
    articles.length === 0
      ? "過去24時間の新着記事はありませんでした。"
      : articles
          .map((a) => {
            // "other"（二次メディア）の記事はタイトル自体に【RIZIN】等が
            // 既に付いていることが多いので、二重にラベルを付けない。
            if (a.source === "other" || /^【[^】]+】/.test(a.title)) {
              return `${a.title}\n${a.url}`;
            }
            const label = SOURCES[a.source]?.label ?? a.source;
            return `【${label}】${a.title}\n${a.url}`;
          })
          .join("\n\n");

  return [
    "【昨日のMMAニュースピックアップ🥊】",
    "",
    list,
    "",
    "Mニュースで全件見る",
    "https://www.mnews.jp/",
  ].join("\n");
}

function buildHtml(articles: Article[], copyText: string): string {
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
            <span style="font-family:monospace;font-size:11px;color:${color};border:1px solid ${color};padding:2px 6px;">${escapeHtml(
              label
            )}</span>
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
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>

      <h3 style="font-size:13px;margin-top:24px;">コピペ用（タイトル＋リンク）</h3>
      <pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;background:#f5f3ef;padding:12px;border-radius:4px;user-select:all;">${escapeHtml(
        copyText
      )}</pre>

      <p style="margin-top:16px;"><a href="https://www.mnews.jp">Mニュースで全件見る →</a></p>
    </div>`;
}

async function sendEmail(html: string, text: string, count: number) {
  if (!RESEND_API_KEY || !DIGEST_TO) {
    console.log("RESEND_API_KEY または DIGEST_TO_EMAIL が未設定のため送信をスキップしました。");
    console.log(text);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: [DIGEST_TO],
      subject: `Mニュース 朝刊ダイジェスト（${count}件）`,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${res.status} ${errText}`);
  }
  console.log("送信完了。");
}

async function main() {
  const { articles } = await fetchRawArticles();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles.filter((a) => new Date(a.publishedAt).getTime() >= cutoff);
  recent.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  console.log(`過去24時間の記事: ${recent.length}件`);
  const copyText = buildCopyText(recent);
  const html = buildHtml(recent, copyText);
  await sendEmail(html, copyText, recent.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

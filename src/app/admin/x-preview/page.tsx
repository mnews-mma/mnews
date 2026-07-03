import type { Article } from "@/lib/articles";
import { getUpcomingEvents } from "@/lib/events";
import { buildDigestPost, buildCountdownPost, X_POST_CONFIG } from "@/lib/xPost";
import { ogImagePath } from "@/lib/ogShared";

export const dynamic = "force-dynamic";

const ARCHIVE_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";

async function fetchArchive(): Promise<Article[]> {
  try {
    const res = await fetch(ARCHIVE_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function jstDateStr(offsetDays: number): string {
  const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

function articlesForDay(all: Article[], dateStr: string): Article[] {
  const start = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  const end = start + 86400_000;
  return all.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return t >= start && t < end;
  });
}

function PostBlock({ title, text, replyText, imageUrl, method }: {
  title: string;
  text: string;
  replyText?: string;
  imageUrl?: string;
  method: string;
}) {
  return (
    <div style={{ marginBottom: 32, border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {title}
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
          リンク方式: {method}
        </span>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", userSelect: "all" }}>
        {text}
      </pre>
      {replyText && (
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 12, background: "var(--s2)", padding: 10, border: "1px dashed var(--border)", marginTop: 8, userSelect: "all" }}>
          ↳ セルフリプライ: {replyText}
        </pre>
      )}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="card" style={{ width: "100%", maxWidth: 600, marginTop: 12, border: "1px solid var(--border)", display: "block" }} />
      )}
    </div>
  );
}

export default async function XPreviewPage() {
  const all = await fetchArchive();

  // 直近3日分のまとめポストサンプル(実ポストはしない)
  const digests = [1, 2, 3].map((offset) => {
    const dateStr = jstDateStr(offset);
    const dayArticles = articlesForDay(all, dateStr);
    return { dateStr, post: buildDigestPost(dayArticles, dateStr) };
  });

  // 直近のupcomingイベントのカウントダウンポスト下書き
  const nextEvent = getUpcomingEvents()[0] ?? null;
  const countdown = nextEvent ? buildCountdownPost(nextEvent) : null;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Xポスト プレビュー
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>
        実ポストはしません(X APIキー未設定)。デフォルトのリンク方式: 本文にリンクを入れず
        セルフリプライにぶら下げる2段階投稿。1日上限 {X_POST_CONFIG.dailyPostLimit} 本文ポスト。
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "16px 0" }}>
        朝の「昨日のまとめ」(直近3日分サンプル)
      </h2>
      {digests.map(({ dateStr, post }) =>
        post ? (
          <PostBlock
            key={dateStr}
            title={`${dateStr}分 (${post.itemCount}件${post.isSingle ? "・通常ポスト形式" : ""})`}
            text={post.text}
            replyText={post.replyText}
            imageUrl={post.isSingle ? undefined : ogImagePath(post.imageUrl)}
            method={post.method}
          />
        ) : (
          <div key={dateStr} style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            {dateStr}: 該当ニュースなし(この日はポストを生成しない)
          </div>
        )
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 16px" }}>
        大会前日カウントダウン(下書き例: 直近イベント)
      </h2>
      {countdown && nextEvent ? (
        <PostBlock
          title={`${nextEvent.eventName}(前日20:00投稿想定)`}
          text={countdown.text}
          replyText={countdown.replyText}
          imageUrl={ogImagePath(countdown.imageUrl)}
          method={countdown.method}
        />
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>upcomingイベントなし</div>
      )}
    </div>
  );
}

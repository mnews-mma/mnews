import type { Article } from "@/lib/articles";
import { getUpcomingEvents } from "@/lib/events";
import { buildDigestPost, buildCountdownPost } from "@/lib/xPost";
import { ogImagePath } from "@/lib/ogShared";
import CopyButton from "@/components/CopyButton";

// このページが唯一の「X投稿下書き」ワークフロー。ここに表示される内容は
// すべて純粋な下書き生成(buildDigestPost/buildCountdownPost)のみで、
// X APIへの投稿試行は一切行わない。実投稿(X_POST_ENABLED=true)を
// 有効化するまでは、常にこのページで内容を確認→コピー→手動ポストする運用。
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>① 1通目(本文)</span>
        <CopyButton text={text} label="①をコピー" />
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: 0 }}>
        {text}
      </pre>

      {replyText && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 4px" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>② 2通目(①へのセルフリプライ)</span>
            <CopyButton text={replyText} label="②をコピー" />
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 12, background: "var(--s2)", padding: 10, border: "1px dashed var(--border)", margin: 0 }}>
            {replyText}
          </pre>
        </>
      )}

      {imageUrl && (
        <>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 4px" }}>
            ①に添付する画像(長押し/右クリックで保存)
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="card" style={{ width: "100%", maxWidth: 600, border: "1px solid var(--border)", display: "block" }} />
        </>
      )}
    </div>
  );
}

export default async function XPreviewPage() {
  const all = await fetchArchive();

  // 今朝分の「昨日のまとめ」下書きのみを出力(複数件は出さない)
  const dateStr = jstDateStr(1);
  const digest = { dateStr, post: buildDigestPost(articlesForDay(all, dateStr), dateStr) };

  // 直近のupcomingイベントのカウントダウンポスト下書き
  const nextEvent = getUpcomingEvents()[0] ?? null;
  const countdown = nextEvent ? buildCountdownPost(nextEvent) : null;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        X投稿 下書き
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        当面はX API課金の判断待ちのため、全ての投稿を「ここで内容を確認→①②の順にコピー→
        画像を保存→手動でXに投稿」する運用にしています。このページはX
        APIへの投稿を一切試みません(純粋な下書き生成のみ)。
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "16px 0" }}>
        朝の「昨日のまとめ」(今朝分)
      </h2>
      {digest.post ? (
        <PostBlock
          title={`${digest.dateStr}分 (${digest.post.itemCount}件${digest.post.isSingle ? "・通常ポスト形式" : ""})`}
          text={digest.post.text}
          replyText={digest.post.replyText}
          imageUrl={digest.post.isSingle ? undefined : ogImagePath(digest.post.imageUrl)}
          method={digest.post.method}
        />
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          {digest.dateStr}: 該当ニュースなし(この日はポストを生成しない)
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 16px" }}>
        大会前日カウントダウン(直近イベント)
      </h2>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        本番は前日20:00頃を目安に、このページを開いてコピー→手動投稿してください
        (自動投稿は行いません)。投稿後は<strong>Xの「固定ポストに設定」を手動で行い</strong>、
        大会終了後に固定を解除してください(固定操作はAPIでは行えません)。
      </p>
      {countdown && nextEvent ? (
        <PostBlock
          title={`${nextEvent.eventName}（開催: ${nextEvent.date}）`}
          text={countdown.text}
          replyText={countdown.replyText}
          imageUrl={ogImagePath(countdown.imageUrl)}
          method={countdown.method}
        />
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>upcomingイベントなし</div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 16px" }}>
        試合結果速報
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        大会当日は <a href="/admin/live" style={{ color: "var(--accent)" }}>ライブ結果入力</a> から
        試合ごとに結果カード+投稿文を生成できます(同じく手動コピー運用)。
      </p>
    </div>
  );
}

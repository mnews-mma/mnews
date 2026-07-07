import { getUpcomingEvents } from "@/lib/events";
import { buildCountdownPost } from "@/lib/xPost";
import { fetchRawArticles } from "@/lib/feeds/aggregate";
import { detectEventTag, digestScore } from "@/lib/tweetDigest";
import { relativeTimeJa } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { ogImagePath } from "@/lib/ogShared";
import CopyButton from "@/components/CopyButton";
import DigestPicker from "@/components/DigestPicker";
import type { PickerArticle } from "@/components/DigestPicker";
import AdminBackLink from "@/components/AdminBackLink";

// このページが唯一の「X投稿下書き」ワークフロー。
// 朝まとめ: 過去24時間の全ニュースを一覧表示→手動で選択→X投稿文に変換
// (テキストのみ・画像なし。選手名をプレーンテキストに載せて検索/エゴサに
//  引っかける方針)。自動選定は「候補」のプリセレクトにだけ使う。
// X APIへの投稿は一切行わない(コピー→手動ポスト運用)。
export const dynamic = "force-dynamic";

// 投稿行の【タグ】からハッシュタグを推定
function tagToHashtag(tag: string): string {
  const t = tag.toUpperCase();
  if (t.includes("RIZIN")) return "#RIZIN";
  if (t.includes("DEEP")) return "#DEEP";
  if (t.includes("PANCRASE") || tag.includes("パンクラス")) return "#パンクラス";
  if (tag.includes("修斗") || t.includes("SHOOTO")) return "#修斗";
  return "";
}

function jstDateStr(offsetDays: number): string {
  const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
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
  // 過去24時間の全ニュース(8:00メールと同じ範囲・ライブ取得)
  const { articles } = await fetchRawArticles();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles
    .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // 候補(初期チェック): digestScore>=1 の上位4件
  const suggestedIds = new Set(
    recent
      .map((a) => ({ a, ds: digestScore(a) }))
      .filter((x) => x.ds >= 1)
      .sort((x, y) => y.ds - x.ds)
      .slice(0, 4)
      .map((x) => x.a.id)
  );

  const pickerArticles: PickerArticle[] = recent.map((a) => {
    const s = SOURCES[a.source];
    const official = s?.type === "official";
    const tag = detectEventTag(a.title, a.source);
    return {
      id: a.id,
      title: a.title,
      url: a.url,
      origin: a.origin,
      label: official ? `${s.label}公式` : "メディア",
      color: official ? s.color : "#999999",
      tag,
      orgHashtag: tagToHashtag(tag),
      timeJa: relativeTimeJa(a.publishedAt),
      suggested: suggestedIds.has(a.id),
    };
  });

  const d = new Date(`${jstDateStr(1)}T00:00:00+09:00`);
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

  // 直近のupcomingイベントのカウントダウンポスト下書き
  const nextEvent = getUpcomingEvents()[0] ?? null;
  const countdown = nextEvent ? buildCountdownPost(nextEvent) : null;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 720 }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        X投稿 下書き
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        全ての投稿を「ここで内容を確認→コピー→手動でXに投稿」する運用です。
        このページはX APIへの投稿を一切試みません(純粋な下書き生成のみ)。
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "16px 0 4px" }}>
        朝まとめ(過去24時間・{recent.length}件から手動選択)
      </h2>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.7 }}>
        載せるニュースにチェック→下の投稿文をコピー。画像は添付しない
        (選手名をテキストで載せて検索・エゴサに引っかける方針)。
        「候補」は自動スコアの参考表示で、最終判断は手動。
      </p>
      <DigestPicker articles={pickerArticles} dateLabel={dateLabel} />

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "32px 0 16px" }}>
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

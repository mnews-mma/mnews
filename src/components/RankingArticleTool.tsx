"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import AdminBackLink from "@/components/AdminBackLink";
import { SITE_URL } from "@/lib/seo";
import {
  generateArticleCode,
  generateRankingAnnounceText,
  generateRankingAnnounceReplyText,
} from "@/lib/articleGenerator";
import type { OriginalArticle, RankingDivisionSnapshot } from "@/lib/originalArticles";

const input: React.CSSProperties = { padding: "8px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 };
const field: React.CSSProperties = { marginBottom: 14 };
const chip: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};

function OutputCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: "var(--mono)",
          fontSize: 12,
          background: "var(--s2)",
          padding: 12,
          border: "1px solid var(--border)",
          margin: "0 0 10px",
          maxHeight: 400,
          overflow: "auto",
        }}
      >
        {text}
      </pre>
      <CopyButton text={text} label="コピー" />
    </div>
  );
}

// 階級1件分の編集フォーム。サーバー側(page.tsx)がresolveDivisionRankingView
// 経由で取得した王者+上位5位を初期値として渡す(zero-fabrication: 表示中の
// ランキングと必ず一致する値がデフォルト)。手編集はサイト表示とズレる恐れが
// あるため、閲覧確認のうえ最小限に留める運用を前提とする。
function DivisionEditor({
  snapshot,
  enabled,
  onToggle,
  onChange,
}: {
  snapshot: RankingDivisionSnapshot;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onChange: (s: RankingDivisionSnapshot) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: enabled ? 10 : 0 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        {snapshot.divisionLabel}
      </label>
      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <label style={label}>王者</label>
            <input
              type="text"
              value={snapshot.champion}
              onChange={(e) => onChange({ ...snapshot, champion: e.target.value })}
              style={input}
            />
          </div>
          {snapshot.top5.map((name, i) => (
            <div key={i}>
              <label style={label}>{i + 1}位</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const top5 = [...snapshot.top5];
                  top5[i] = e.target.value;
                  onChange({ ...snapshot, top5 });
                }}
                style={input}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RankingArticleTool({ initialSnapshots }: { initialSnapshots: RankingDivisionSnapshot[] }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [publishedAtTime, setPublishedAtTime] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialSnapshots.map((s) => [s.divisionSlug, true]))
  );
  const [snapshots, setSnapshots] = useState<Record<string, RankingDivisionSnapshot>>(
    () => Object.fromEntries(initialSnapshots.map((s) => [s.divisionSlug, s]))
  );
  const [output, setOutput] = useState<{ code: string; post: string; reply: string } | null>(null);

  const canGenerate = title.trim() && slug.trim() && eventSlug.trim() && publishedAt.trim() && publishedAtTime.trim();

  const selectedSnapshots = useMemo(
    () => initialSnapshots.filter((s) => enabled[s.divisionSlug]).map((s) => snapshots[s.divisionSlug]),
    [initialSnapshots, enabled, snapshots]
  );

  function generate() {
    if (!canGenerate) return;
    const article: OriginalArticle = {
      slug: slug.trim(),
      title: title.trim(),
      eventSlug: eventSlug.trim(),
      publishedAt: publishedAt.trim(),
      publishedAtTime: publishedAtTime.trim(),
      fights: [],
      body: bodyText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      rankingSnapshots: selectedSnapshots,
    };
    setOutput({
      code: generateArticleCode(article),
      post: generateRankingAnnounceText(article),
      reply: generateRankingAnnounceReplyText(article, SITE_URL),
    });
  }

  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 720, margin: "0 auto" }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        ランキング変動記事作成
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        AI RIZINランキング更新の告知記事(originalArticles.ts追記用)とX告知文を生成します。
        自動公開・自動git書き込みはしません(常にコピー→手動でコミット・投稿)。
      </p>

      <div style={field}>
        <label style={label}>タイトル</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: AI RIZINランキング更新: RIZIN.55の結果を反映" style={input} />
      </div>
      <div style={field}>
        <label style={label}>slug</label>
        <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="例: ai-rizin-rankings-update-rizin55" style={input} />
      </div>
      <div style={field}>
        <label style={label}>紐づく大会slug(eventSlug)</label>
        <input type="text" value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} placeholder="例: rizin-55" style={input} />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>公開日(YYYY-MM-DD)</label>
          <input type="text" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} placeholder="2026-07-21" style={input} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>公開時刻(JST HH:MM・必須)</label>
          <input type="text" value={publishedAtTime} onChange={(e) => setPublishedAtTime(e.target.value)} placeholder="21:00" style={input} />
        </div>
      </div>
      <div style={field}>
        <label style={label}>本文(改行区切りで段落)</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={6}
          placeholder={"○月○日に開催された…の全MMA試合結果を反映し、AI RIZINランキングを更新しました。\n…"}
          style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        階級別スナップショット(表示中のランキングから自動補完・必要なら編集)
      </h2>
      {initialSnapshots.map((s) => (
        <DivisionEditor
          key={s.divisionSlug}
          snapshot={snapshots[s.divisionSlug]}
          enabled={enabled[s.divisionSlug]}
          onToggle={(v) => setEnabled((prev) => ({ ...prev, [s.divisionSlug]: v }))}
          onChange={(next) => setSnapshots((prev) => ({ ...prev, [s.divisionSlug]: next }))}
        />
      ))}

      <button onClick={generate} disabled={!canGenerate} style={{ ...chip, marginTop: 10, marginBottom: 20, opacity: canGenerate ? 1 : 0.5 }}>
        生成
      </button>

      {output && (
        <>
          <OutputCard title="originalArticles.ts に追記するコード" text={output.code} />
          <OutputCard title="X告知文(本文)" text={output.post} />
          <OutputCard title="X告知文(セルフリプライ: リンク+免責)" text={output.reply} />
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { condenseTopic, fullWidthLength } from "@/lib/tweetDigest";
import CopyButton from "@/components/CopyButton";

// 朝まとめの手動選択ワークフロー:
// 過去24時間の全ニュースをテキスト一覧で表示 → 手動でチェック →
// 選んだ記事だけをX投稿文(テキストのみ・画像なし)に変換する。
// 自動選定(digestScore)は「候補」のプリセレクトにだけ使い、最終判断は人間。
export interface PickerArticle {
  id: string;
  title: string;
  url: string;
  origin: string; // via表記(メディア名/公式名)
  label: string; // バッジ表示(団体名 or メディア)
  color: string; // バッジ色
  tag: string; // 投稿行の【タグ】(大会/団体。空なら無し)
  orgHashtag: string; // "#RIZIN"等。該当なしは""
  timeJa: string; // "3時間前"
  suggested: boolean; // digestScore上位=候補(初期チェック)
}

const X_LIMIT = 138; // 全角換算の安全上限(280半角=140全角からマージン)

export default function DigestPicker({
  articles,
  dateLabel,
}: {
  articles: PickerArticle[];
  dateLabel: string; // "7/4"
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(articles.filter((a) => a.suggested).map((a) => a.id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { text, count } = useMemo(() => {
    const chosen = articles.filter((a) => selected.has(a.id));
    if (chosen.length === 0) return { text: "", count: 0 };
    const n = chosen.length;
    const perLine = n >= 4 ? 27 : n === 3 ? 31 : 36;
    const lines = chosen.map((a) => {
      const prefix = a.tag ? `【${a.tag}】` : "";
      return `・${prefix}${condenseTopic(a.title, perLine - fullWidthLength(prefix))}`;
    });
    const orgTag = chosen.find((a) => a.orgHashtag)?.orgHashtag;
    const hashtags = orgTag ? `#MMA ${orgTag}` : "#MMA";
    const body = [`🥊 昨日のMMAニュースまとめ(${dateLabel})`, ...lines, hashtags].join("\n");
    return { text: body, count: fullWidthLength(body) };
  }, [articles, selected, dateLabel]);

  const replyText = "全件はこちら👇\nhttps://mnews.jp";
  const over = count > X_LIMIT;

  return (
    <div>
      {/* 記事一覧(全件・チェックで選択) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {articles.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>過去24時間の記事がありません。</p>
        )}
        {articles.map((a) => {
          const on = selected.has(a.id);
          return (
            <label
              key={a.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8,
                background: on ? "rgba(232,0,45,0.04)" : "var(--s1)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(a.id)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1.5px 7px",
                      borderRadius: 4,
                      background: a.color,
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.label}
                  </span>
                  {a.suggested && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>候補</span>
                  )}
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {a.timeJa}
                  </span>
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.5, display: "block" }}>{a.title}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>via {a.origin}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* 生成されたX投稿(テキストのみ・画像なし) */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            X投稿文({selected.size}件選択)
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                marginLeft: 8,
                color: over ? "var(--accent)" : "var(--muted)",
                fontWeight: over ? 700 : 400,
              }}
            >
              全角換算 {count}/{X_LIMIT}
              {over ? " 超過! 選択を減らしてください" : ""}
            </span>
          </span>
          <CopyButton text={text} label="①本文をコピー" />
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: "var(--s2)",
            padding: 12,
            border: "1px solid var(--border)",
            margin: 0,
            minHeight: 60,
          }}
        >
          {text || "(記事を選択すると投稿文が生成されます)"}
        </pre>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 4px" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>② 2通目(①へのセルフリプライ)</span>
          <CopyButton text={replyText} label="②をコピー" />
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--mono)",
            fontSize: 12,
            background: "var(--s2)",
            padding: 10,
            border: "1px dashed var(--border)",
            margin: 0,
          }}
        >
          {replyText}
        </pre>
      </div>
    </div>
  );
}

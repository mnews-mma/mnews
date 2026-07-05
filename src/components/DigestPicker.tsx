"use client";

import { useMemo, useState } from "react";
import { condenseTopic, fullWidthLength } from "@/lib/tweetDigest";
import CopyButton from "@/components/CopyButton";

// 朝まとめの手動選択ワークフロー:
// 過去24時間の全ニュースをテキスト一覧で表示 → 手動でチェック →
// 選んだ記事だけをX投稿文(テキストのみ・画像なし)に変換する。
// 自動選定(digestScore)は「候補」のプリセレクトにだけ使い、最終判断は人間。
// Xプレミアム前提のため文字数上限は設けない(カウンタは参考表示のみ)。
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

// 1行の要約枠(全角)。全文そのまま掲載は長すぎるため、ここまでは原文を
// 活かして収める(文字数制限由来の強い圧縮はしない)。
const LINE_MAX = 50;

export default function DigestPicker({
  articles,
  dateLabel,
}: {
  articles: PickerArticle[];
  dateLabel: string; // "7/4"
}) {
  // 選択は「順序付き」で保持する(投稿の行順=この順序)。チェックした順に
  // 末尾へ追加され、↑↓で自由に入れ替えられる。
  const [order, setOrder] = useState<string[]>(() =>
    articles.filter((a) => a.suggested).map((a) => a.id)
  );

  function toggle(id: string) {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const chosen = useMemo(
    () =>
      order
        .map((id) => articles.find((a) => a.id === id))
        .filter((a): a is PickerArticle => !!a),
    [order, articles]
  );

  const { text, count } = useMemo(() => {
    if (chosen.length === 0) return { text: "", count: 0 };
    const lines = chosen.map((a) => {
      const prefix = a.tag ? `【${a.tag}】` : "";
      return `・${prefix}${condenseTopic(a.title, LINE_MAX - fullWidthLength(prefix))}`;
    });
    // ハッシュタグ: 選択記事の団体タグを重複排除で最大3つ(#MMAは付けない)
    const tags = [...new Set(chosen.map((a) => a.orgHashtag).filter(Boolean))].slice(0, 3);
    const parts = [`🥊 昨日のMMAニュースまとめ(${dateLabel})`, ...lines];
    if (tags.length > 0) parts.push(tags.join(" "));
    const body = parts.join("\n");
    return { text: body, count: Math.ceil(fullWidthLength(body)) };
  }, [chosen, dateLabel]);

  const replyText = "全件はこちら👇\nhttps://mnews.jp";

  return (
    <div>
      {/* 記事一覧(全件・チェックで選択) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {articles.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>過去24時間の記事がありません。</p>
        )}
        {articles.map((a) => {
          const on = order.includes(a.id);
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

      {/* 投稿順の並び替え(選択済みのみ) */}
      {chosen.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            投稿順(↑↓で入れ替え)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {chosen.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", width: 16 }}>
                  {i + 1}.
                </span>
                <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.tag ? `【${a.tag}】` : ""}
                  {a.title}
                </span>
                <button
                  onClick={() => move(a.id, -1)}
                  disabled={i === 0}
                  style={{ border: "1px solid var(--border)", background: "var(--s1)", borderRadius: 6, padding: "2px 9px", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1, fontSize: 13 }}
                  aria-label="上へ"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(a.id, 1)}
                  disabled={i === chosen.length - 1}
                  style={{ border: "1px solid var(--border)", background: "var(--s1)", borderRadius: 6, padding: "2px 9px", cursor: i === chosen.length - 1 ? "default" : "pointer", opacity: i === chosen.length - 1 ? 0.35 : 1, fontSize: 13 }}
                  aria-label="下へ"
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 生成されたX投稿(テキストのみ・画像なし) */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            X投稿文({chosen.length}件選択)
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, marginLeft: 8, color: "var(--muted)" }}>
              全角換算 {count}(プレミアム前提・上限なし)
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

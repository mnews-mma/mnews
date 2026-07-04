"use client";

import { useState } from "react";

function ResultBox({ result }: { result: unknown }) {
  if (result === null) return null;
  return (
    <pre
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--s2)",
        fontSize: 12,
        fontFamily: "var(--mono)",
        whiteSpace: "pre-wrap",
      }}
    >
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

// X APIキーの疎通確認専用ページ(技術テスト)。コンテンツの下書き確認は
// /admin/x-preview で行う(こちらはAPIへの投稿を実際に試みる唯一の画面)。
// X_POST_ENABLEDがfalse/未設定の間は常にdry-runで、実投稿はされない。
export default function XTestPage() {
  const [loading, setLoading] = useState(false);
  const [postResult, setPostResult] = useState<unknown>(null);

  async function handleSend() {
    setLoading(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/admin/x-test-post", { method: "POST" });
      setPostResult(await res.json());
    } catch (e) {
      setPostResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        X API 疎通確認(技術テスト)
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        X_POST_ENABLED が true でない限り、実際には投稿されません(dry-run)。
        認証情報が正しく通るか・APIの応答(402課金エラー等)を確認するための
        技術テストです。コンテンツの下書き確認は{" "}
        <a href="/admin/x-preview" style={{ color: "var(--accent)" }}>
          X投稿 下書きページ
        </a>{" "}
        をご利用ください。
      </p>

      <button
        onClick={handleSend}
        disabled={loading}
        style={{
          fontSize: 15,
          fontWeight: 700,
          padding: "12px 24px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#999" : "var(--accent)",
          color: "#fff",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "実行中…" : "疎通テストを実行"}
      </button>
      <ResultBox result={postResult} />
    </div>
  );
}

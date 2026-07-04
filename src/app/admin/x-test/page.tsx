"use client";

import { useState } from "react";

export default function XTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/x-test-post", { method: "POST" });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        X投稿 疎通確認
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        X_POST_ENABLED が true でない限り、実際には投稿されません(dry-run)。
        ログに内容が出力され、この画面にも結果が表示されます。
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
        {loading ? "実行中…" : "テスト投稿を実行(dry-run)"}
      </button>

      {result !== null && (
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
      )}
    </div>
  );
}

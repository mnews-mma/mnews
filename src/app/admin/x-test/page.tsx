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

export default function XTestPage() {
  const [loading, setLoading] = useState<"post" | "countdown" | null>(null);
  const [postResult, setPostResult] = useState<unknown>(null);
  const [countdownResult, setCountdownResult] = useState<unknown>(null);

  async function handleSend() {
    setLoading("post");
    setPostResult(null);
    try {
      const res = await fetch("/api/admin/x-test-post", { method: "POST" });
      setPostResult(await res.json());
    } catch (e) {
      setPostResult({ error: String(e) });
    } finally {
      setLoading(null);
    }
  }

  async function handleCountdown() {
    setLoading("countdown");
    setCountdownResult(null);
    try {
      const res = await fetch("/api/admin/countdown-test", { method: "POST" });
      setCountdownResult(await res.json());
    } catch (e) {
      setCountdownResult({ error: String(e) });
    } finally {
      setLoading(null);
    }
  }

  const btnStyle = (active: boolean) => ({
    fontSize: 15,
    fontWeight: 700,
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    background: active ? "#999" : "var(--accent)",
    color: "#fff",
    cursor: active ? "default" : "pointer",
  });

  return (
    <div style={{ padding: "40px 24px", maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        X投稿 疎通確認
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        X_POST_ENABLED が true でない限り、実際には投稿されません(dry-run)。
        ログに内容が出力され、この画面にも結果が表示されます。
      </p>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>単発テスト投稿</h2>
      <button onClick={handleSend} disabled={loading !== null} style={btnStyle(loading === "post")}>
        {loading === "post" ? "実行中…" : "テスト投稿を実行"}
      </button>
      <ResultBox result={postResult} />

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: "32px 0 8px" }}>
        カウントダウン投稿(直近のupcomingイベントでテスト)
      </h2>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        本番cron(/api/cron/countdown-post)は「明日開催」のイベントのみ対象・
        投稿済みフラグで二重投稿を防止します。このボタンは直近イベントで
        文面・画像をその場で確認するためのものです。
      </p>
      <button onClick={handleCountdown} disabled={loading !== null} style={btnStyle(loading === "countdown")}>
        {loading === "countdown" ? "実行中…" : "カウントダウン投稿を実行"}
      </button>
      <ResultBox result={countdownResult} />
    </div>
  );
}

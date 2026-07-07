"use client";

import { useState } from "react";
import AdminBackLink from "@/components/AdminBackLink";

interface SendResult {
  ok: boolean;
  count?: number;
  from?: string;
  toMasked?: string;
  messageId?: string;
  error?: string;
  subject?: string;
}

export default function EmailTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-test-email", { method: "POST" });
      setResult(await res.json());
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: 560 }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        メール送信テスト
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
        朝刊ダイジェストと同じ内容のテストメール（件名に「[テスト]」付き）を今すぐ送信し、
        Resend の応答を表示します。届かない場合は下の結果でメッセージIDやエラーを確認できます。
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
        {loading ? "送信中…" : "テストメールを送信"}
      </button>

      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${result.ok ? "#16a34a" : "#dc2626"}`,
            background: result.ok ? "#f0fdf4" : "#fef2f2",
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 700, color: result.ok ? "#16a34a" : "#dc2626", marginBottom: 8 }}>
            {result.ok ? "✓ 送信成功（Resendが受理）" : "✗ 送信失敗"}
          </div>
          {result.from && <div>送信元: {result.from}</div>}
          {result.toMasked && <div>送信先: {result.toMasked}</div>}
          {typeof result.count === "number" && <div>本文の記事数: {result.count}件</div>}
          {result.messageId && <div>メッセージID: {result.messageId}</div>}
          {result.error && (
            <div style={{ color: "#dc2626", marginTop: 4, wordBreak: "break-all" }}>
              エラー: {result.error}
            </div>
          )}
          {result.ok && (
            <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
              ※ Resendが受理しても、送信元が onboarding@resend.dev の場合は
              受信側で迷惑メール入り/拒否されることがあります。届かない場合は独自ドメイン認証を推奨。
            </div>
          )}
        </div>
      )}
    </div>
  );
}

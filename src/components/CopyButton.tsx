"use client";

import { useState } from "react";

// ワンタップで本文をクリップボードにコピーするボタン。
// X投稿は全て「下書き生成→手動コピペ投稿」運用のため、コピーのしやすさが重要。
export default function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード権限が無い環境向けフォールバック案内
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleCopy}
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "4px 12px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: copied ? "#16a34a" : "var(--s1)",
          color: copied ? "#fff" : "var(--text)",
          cursor: "pointer",
        }}
      >
        {copied ? "✓ コピーしました" : label}
      </button>
      {failed && (
        <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          失敗。本文を選択して手動コピーしてください
        </span>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";

// ワンタップで本文をクリップボードにコピーするボタン。
// X投稿は全て「下書き生成→手動コピペ投稿」運用のため、コピーのしやすさが重要。
export default function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
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
  );
}

"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

export default function RegisterClient() {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRegister() {
    setBusy(true);
    setError(null);
    setFileContent(null);
    try {
      const optionsRes = await fetch("/api/passkey/register/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error("登録を開始できませんでした");

      const attestation = await startRegistration({ optionsJSON: await optionsRes.json() });

      const verifyRes = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, response: attestation }),
      });
      if (!verifyRes.ok) throw new Error("登録を確認できませんでした");

      const result = (await verifyRes.json()) as { fileContent: string };
      setFileContent(result.fileContent);
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      setError(cancelled ? "キャンセルしました" : "登録できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!fileContent) return;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
        端末の名前（任意・後から見分けるためのメモ）
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例: iPhone"
          style={{
            padding: "10px 12px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
      </label>

      <button
        type="button"
        onClick={handleRegister}
        disabled={busy}
        style={{
          padding: "14px 20px",
          fontSize: "16px",
          fontWeight: 700,
          fontFamily: "var(--os)",
          borderRadius: "10px",
          border: "none",
          background: busy ? "#999" : "#111",
          color: "#fff",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "処理中..." : "この端末のパスキーを登録"}
      </button>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: "14px", color: "#c00" }}>
          {error}
        </p>
      )}

      {fileContent && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7 }}>
            登録できました。下の内容を <code>data/adminPasskeys.json</code> に保存して
            デプロイすると、パスキーでログインできるようになります。
          </p>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              alignSelf: "flex-start",
              padding: "8px 14px",
              fontSize: "14px",
              borderRadius: "8px",
              border: "1px solid #111",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {copied ? "コピーしました" : "コードをコピー"}
          </button>
          <pre
            style={{
              margin: 0,
              padding: "12px",
              fontSize: "12px",
              background: "#f5f5f5",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {fileContent}
          </pre>
        </div>
      )}
    </div>
  );
}

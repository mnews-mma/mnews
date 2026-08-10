"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

// 失敗理由は画面上でも細かく出し分けない（管理画面の存在・登録状況を
// 推測させないため）。ユーザー自身の操作キャンセルだけは区別する。
const GENERIC_ERROR = "ログインできませんでした";

export default function LoginClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/passkey/login/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error(GENERIC_ERROR);

      const assertion = await startAuthentication({ optionsJSON: await optionsRes.json() });

      const verifyRes = await fetch("/api/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) throw new Error(GENERIC_ERROR);

      window.location.href = "/admin";
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      setError(cancelled ? "キャンセルしました" : GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button
        type="button"
        onClick={handleLogin}
        disabled={busy}
        style={{
          padding: "16px 20px",
          fontSize: "17px",
          fontWeight: 700,
          fontFamily: "var(--os)",
          borderRadius: "12px",
          border: "none",
          background: busy ? "#999" : "#111",
          color: "#fff",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "確認中..." : "パスキーでログイン"}
      </button>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: "14px", color: "#c00" }}>
          {error}
        </p>
      )}
    </div>
  );
}

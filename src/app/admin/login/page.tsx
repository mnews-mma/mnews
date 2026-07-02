"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }
      if (res.status === 429) {
        setError("試行回数が多すぎます。しばらく待ってから再度お試しください。");
      } else {
        setError("トークンが正しくありません。");
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#131210",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "#1c1a17",
          borderRadius: "12px",
          padding: "32px 24px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--os)",
            fontSize: "20px",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "6px",
          }}
        >
          Mニュース管理画面
        </div>
        <div style={{ fontSize: "13px", color: "#8A8478", marginBottom: "24px" }}>
          アクセストークンを入力してください
        </div>
        <input
          type="password"
          inputMode="text"
          autoComplete="off"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ACCESS TOKEN"
          style={{
            width: "100%",
            fontSize: "16px",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #3a3632",
            background: "#0f0e0c",
            color: "#fff",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <div style={{ fontSize: "13px", color: "#e8002d", marginBottom: "16px" }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || token.length === 0}
          style={{
            width: "100%",
            fontSize: "15px",
            fontWeight: 700,
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: loading || token.length === 0 ? "#5a231f" : "#e8002d",
            color: "#fff",
            cursor: loading || token.length === 0 ? "default" : "pointer",
          }}
        >
          {loading ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

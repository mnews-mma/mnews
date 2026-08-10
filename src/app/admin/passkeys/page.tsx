import Link from "next/link";
import { getStoredPasskeys } from "@/lib/adminPasskeys";
import RegisterClient from "./RegisterClient";

export const metadata = {
  title: "パスキー登録 | Mニュース",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminPasskeysPage() {
  const passkeys = getStoredPasskeys();

  return (
    <div style={{ padding: "40px 24px", maxWidth: "560px" }}>
      <h1
        style={{
          fontFamily: "var(--os)",
          fontSize: "22px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        パスキー登録
      </h1>
      <p style={{ fontSize: "14px", lineHeight: 1.8, color: "#444", marginBottom: "28px" }}>
        Face ID / Touch ID で管理画面に入れるようにします。Macで登録すれば
        iCloudキーチェーン経由でiPhoneにも同期されるため、登録は原則1回だけで
        両方から使えます。ログインは{" "}
        <Link href="/mn-login" style={{ textDecoration: "underline" }}>
          /mn-login
        </Link>{" "}
        から行います（ブックマーク推奨）。
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "10px" }}>
          登録済み（{passkeys.length}件）
        </h2>
        {passkeys.length === 0 ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
            まだありません。現在はトークン付きURLのみでログインできます。
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", lineHeight: 1.9 }}>
            {passkeys.map((p) => (
              <li key={p.id}>
                {p.label}（{p.addedAt} 登録）
              </li>
            ))}
          </ul>
        )}
      </section>

      <RegisterClient />
    </div>
  );
}

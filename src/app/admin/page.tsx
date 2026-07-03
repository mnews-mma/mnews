import Link from "next/link";

export const metadata = {
  title: "管理画面 | Mニュース",
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: "/admin/tweet-digest", label: "X投稿用テキスト確認" },
  { href: "/admin/email-test", label: "メール送信テスト" },
  { href: "/admin/breaking", label: "BREAKING診断" },
];

export default function AdminHomePage() {
  return (
    <div style={{ padding: "40px 24px", maxWidth: "480px" }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: "22px", fontWeight: 700, marginBottom: "24px" }}>
        管理画面
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              display: "block",
              padding: "14px 16px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

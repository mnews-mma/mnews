import Link from "next/link";
import { fetchScheduleDiff } from "./_lib/scheduleDiffIssue";

export const metadata = {
  title: "管理画面 | Mニュース",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin/x-preview", label: "📝 Xニュースまとめ投稿" },
  { href: "/admin/drafts", label: "🥊 X対戦カード決定投稿" },
  { href: "/admin/live", label: "🔴 X結果速報投稿" },
  { href: "/admin/weigh-in", label: "⚖️ X計量結果まとめ投稿" },
  { href: "/admin/ranking-article", label: "📊 ランキング変動記事作成" },
  { href: "/admin/schedule-diff", label: "📅 大会日程 差分チェック" },
  { href: "/admin/email-test", label: "メール送信テスト" },
  { href: "/admin/x-test", label: "🧪 X API 疎通確認(技術テスト)" },
  { href: "/admin/passkeys", label: "🔑 パスキー登録(ログイン用)" },
];

export default async function AdminHomePage() {
  // 差分件数バッジ用。取得失敗時はバッジを出さない(このページ全体を
  // 落とすほどのことではないため、静かにフォールバックする)。
  const scheduleDiff = await fetchScheduleDiff();
  const scheduleDiffCount = scheduleDiff.status === "diff" ? scheduleDiff.data.diffCount : null;

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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 16px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            <span>{l.label}</span>
            {l.href === "/admin/schedule-diff" && scheduleDiffCount !== null && scheduleDiffCount > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#991b1b",
                  background: "#fef2f2",
                  border: "1px solid #dc2626",
                  borderRadius: "999px",
                  padding: "2px 8px",
                }}
              >
                {scheduleDiffCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

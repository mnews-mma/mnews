import Link from "next/link";

// /admin配下の各ツールページ共通の「管理画面トップへ戻る」導線。
// 各ページ側のコンテナpaddingに任せるため、自身はmargin-bottomのみ持つ。
export default function AdminBackLink() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Link href="/admin" style={{ fontSize: 13, color: "var(--muted)" }}>
        ← 管理画面トップへ戻る
      </Link>
    </div>
  );
}

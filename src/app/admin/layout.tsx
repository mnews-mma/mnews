import type { Metadata } from "next";

// /admin 配下の全ページに noindex, nofollow を適用（クローラー対策）。
// アクセス制御自体は middleware（未認証404偽装）が担う。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

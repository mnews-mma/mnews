import type { Metadata } from "next";
import LoginClient from "./LoginClient";

// パスキーのログイン入口。
//
// 管理画面の存在を隠す方針に合わせ、どこからもリンクせず noindex にする。
// ただし本リポジトリは公開されているため、このパスは秘密ではない（ソースを
// 読めば分かる）。実際の防御はパスキーそのものが担う: 端末内の秘密鍵が
// 無ければ、このページに到達できても認証は通らない。

export const metadata: Metadata = {
  title: "ログイン",
  robots: { index: false, follow: false },
};

export default function MnLoginPage() {
  return (
    <div style={{ padding: "48px 24px", maxWidth: "360px", margin: "0 auto" }}>
      <h1
        style={{
          fontFamily: "var(--os)",
          fontSize: "20px",
          fontWeight: 700,
          marginBottom: "24px",
        }}
      >
        ログイン
      </h1>
      <LoginClient />
    </div>
  );
}

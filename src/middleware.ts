import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionValue,
  isValidSession,
  isValidToken,
} from "@/lib/adminAuth";

// 認証境界の方針:
//   [保護] /admin/*（管理画面）と /api/admin/*（管理系API）のみ。
//   [公開] それ以外すべて。一般ユーザーが使う機能は /admin 配下に置かない:
//          - X投稿用カード作成ツール → /tools/fighter-card
//          - OG/シェア画像生成API    → /api/og/*
//
// 隠蔽方針（一般ユーザーから管理画面の存在自体を見せない）:
//   - 未認証アクセスはログイン画面ではなく 404 を返す（存在を匂わせない）
//   - ログインフォームは廃止。運用者は ?token=<ADMIN_TOKEN> 付きURLを
//     ブックマークしておき、アクセス時に middleware がCookieを発行して
//     クエリを消したURLへリダイレクトする（以後30日はCookieで認証）
//   - 管理系APIも未認証は素の404（内部情報を含めない）

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // ブックマーク用: ?token=<ADMIN_TOKEN> が正しければCookieを発行し、
  // トークンをURLから除去してリダイレクト（履歴・共有でのトークン露出を最小化）
  const queryToken = req.nextUrl.searchParams.get("token");
  if (queryToken !== null) {
    if (isValidToken(queryToken)) {
      const url = req.nextUrl.clone();
      url.searchParams.delete("token");
      const res = NextResponse.redirect(url);
      res.cookies.set(ADMIN_SESSION_COOKIE, await computeSessionValue(), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: ADMIN_SESSION_MAX_AGE,
      });
      return res;
    }
    // 不正トークンも404（正誤のフィードバックを与えない）
    return rewriteTo404(req);
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await isValidSession(cookie)) {
    return NextResponse.next();
  }

  // 未認証: APIは素の404 JSON、ページは404ページに偽装
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return rewriteTo404(req);
}

function rewriteTo404(req: NextRequest) {
  // 存在しないパスへ rewrite することで Next.js 標準の404ページ(HTTP 404)を返す
  return NextResponse.rewrite(new URL("/__mn404", req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

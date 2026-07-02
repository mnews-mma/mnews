import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidSession } from "@/lib/adminAuth";

// /admin/* 配下（ページ・APIエンドポイントとも）を丸ごと保護する。
// ログイン画面/ログインAPI自体は除外しないと入口を塞いでしまうため許可リストにする。
const PUBLIC_PATHS = new Set(["/admin/login"]);
const PUBLIC_API_PATHS = new Set(["/api/admin/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const authed = await isValidSession(cookie);

  if (!authed) {
    // API（結果送信など）は未認証なら問答無用で401。画面だけ守ってAPIが
    // 素通しになるのが一番危険なので、ページ/APIとも同じチェックを通す。
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

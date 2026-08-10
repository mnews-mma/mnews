import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  computeSessionValue,
  isValidSession,
  isValidToken,
} from "@/lib/adminAuth";

// 認証境界の方針:
//   [保護] /admin/*（管理画面）と /api/admin/*（管理系API）のみ。
//   [公開] それ以外すべて。一般ユーザーが使う機能は /admin 配下に置かない:
//          - X投稿用カード作成ツール → /dream(旧/tools/fighter-cardは
//            2026-07-17に統合・廃止し/dreamへ308リダイレクト)
//          - OG/シェア画像生成API    → /api/og/*
//
// 隠蔽方針（一般ユーザーから管理画面の存在自体を見せない）:
//   - 未認証アクセスはログイン画面ではなく 404 を返す（存在を匂わせない）
//   - ログインフォームは廃止。運用者は ?token=<ADMIN_TOKEN> 付きURLを
//     ブックマークしておき、アクセス時に middleware がCookieを発行して
//     クエリを消したURLへリダイレクトする（以後30日はCookieで認証）
//   - 管理系APIも未認証は素の404（内部情報を含めない）
//
// ログイン手段は2つあり、どちらも同じセッションCookieを発行する:
//   1. パスキー（通常運用） … /mn-login → /api/passkey/login/*
//   2. ?token=<ADMIN_TOKEN>  … パスキーが使えない時の緊急用
// このmiddlewareはCookieの検証だけを担い、パスキーの検証には関与しない。

// /admin, /api/admin はCookieによって内容が変わる認証ページのため、
// VercelのCDN/ブラウザに一切キャッシュさせない。これを怠ると「未認証者が
// 見た404が全員にキャッシュ配信される」「Aさんの200がBさんにも配信される」
// といった重大な事故につながる（実際に発生した不具合）。
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return res;
}

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
      res.cookies.set(
        ADMIN_SESSION_COOKIE,
        await computeSessionValue(),
        ADMIN_SESSION_COOKIE_OPTIONS
      );
      return noStore(res);
    }
    // 不正トークンも404（正誤のフィードバックを与えない）
    return rewriteTo404(req);
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (cookie && (await isValidSession(cookie))) {
    // スライディングセッション: アクセスのたびに有効期限を30日先へ引き直す。
    // 使い続けている限り再ログインは発生しない（放置30日で切れる挙動は維持）。
    const res = NextResponse.next();
    res.cookies.set(ADMIN_SESSION_COOKIE, cookie, ADMIN_SESSION_COOKIE_OPTIONS);
    return noStore(res);
  }

  // 未認証: APIは素の404 JSON、ページは404ページに偽装
  if (pathname.startsWith("/api/admin")) {
    return noStore(NextResponse.json({ error: "not found" }, { status: 404 }));
  }
  return rewriteTo404(req);
}

function rewriteTo404(req: NextRequest) {
  // 存在しないパスへ rewrite することで Next.js 標準の404ページ(HTTP 404)を返す
  return noStore(NextResponse.rewrite(new URL("/__mn404", req.url)));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

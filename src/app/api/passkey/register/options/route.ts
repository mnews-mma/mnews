import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { ADMIN_SESSION_COOKIE, isValidSession } from "@/lib/adminAuth";
import { RP_NAME, getStoredPasskeys, resolveRp } from "@/lib/adminPasskeys";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_OPTIONS,
  createChallengeCookie,
} from "@/lib/passkeyChallenge";

// パスキーの新規登録（開始）。既にログイン済みであることを必須にする。
// このルートは /api/admin/* 配下ではないため middleware の保護が効かない。
// セッション判定を各ハンドラで自前に行う必要がある点に注意。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function POST(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value))) {
    return notFound();
  }

  const rp = resolveRp(req.headers.get("origin"));
  if (!rp) return notFound();

  try {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rp.rpID,
      // 管理者は1人のみの運用のため、ユーザー識別子は固定値でよい
      userID: new TextEncoder().encode("mnews-admin"),
      userName: "mnews-admin",
      userDisplayName: "Mニュース管理者",
      attestationType: "none",
      // 同じ端末で二重に登録させない
      excludeCredentials: getStoredPasskeys().map((p) => ({
        id: p.id,
        transports: p.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        // 端末に保存され、iCloudキーチェーン等で同期されるパスキーにする
        residentKey: "required",
        userVerification: "required",
      },
    });

    const res = NextResponse.json(options);
    res.cookies.set(
      CHALLENGE_COOKIE,
      await createChallengeCookie(options.challenge, "register"),
      CHALLENGE_COOKIE_OPTIONS
    );
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    return notFound();
  }
}

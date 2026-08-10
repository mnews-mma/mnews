import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  computeSessionValue,
} from "@/lib/adminAuth";
import { fromBase64Url, getStoredPasskeys, resolveRp } from "@/lib/adminPasskeys";
import { CHALLENGE_COOKIE, readChallengeCookie } from "@/lib/passkeyChallenge";

// パスキーの署名を検証し、成功したら既存のセッションCookieを発行する。
// 発行するCookieはトークンURL方式とまったく同じものなので、middleware側の
// 認証判定（isValidSession）には一切手を入れていない。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function POST(req: NextRequest) {
  const rp = resolveRp(req.headers.get("origin"));
  if (!rp) return notFound();

  const expectedChallenge = await readChallengeCookie(
    req.cookies.get(CHALLENGE_COOKIE)?.value,
    "login"
  );
  if (!expectedChallenge) return notFound();

  let body: AuthenticationResponseJSON;
  try {
    body = (await req.json()) as AuthenticationResponseJSON;
  } catch {
    return notFound();
  }

  const passkey = getStoredPasskeys().find((p) => p.id === body.id);
  if (!passkey) return notFound();

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: {
        id: passkey.id,
        publicKey: fromBase64Url(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) return notFound();

    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      ADMIN_SESSION_COOKIE,
      await computeSessionValue(),
      ADMIN_SESSION_COOKIE_OPTIONS
    );
    // 使い終わったチャレンジは即座に無効化する（1回限りの値のため）
    res.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    return notFound();
  }
}

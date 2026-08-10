import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { getStoredPasskeys, resolveRp } from "@/lib/adminPasskeys";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_OPTIONS,
  createChallengeCookie,
} from "@/lib/passkeyChallenge";

// パスキーのログイン開始。未認証で叩かれる前提の唯一のエンドポイントなので、
// 失敗理由は一切返さず素の404で揃える（/admin の隠蔽方針と同じ扱い）。
//
// 注意: このルートは /api/admin/* 配下に置けない。middlewareが未認証の
// /api/admin/* を404にするため、そこに置くとログイン自体ができなくなる。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function POST(req: NextRequest) {
  const rp = resolveRp(req.headers.get("origin"));
  if (!rp) return notFound();

  const passkeys = getStoredPasskeys();
  if (passkeys.length === 0) return notFound();

  try {
    const options = await generateAuthenticationOptions({
      rpID: rp.rpID,
      allowCredentials: passkeys.map((p) => ({
        id: p.id,
        transports: p.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      // 生体認証・PINによる本人確認を必須にする（端末を拾っただけでは入れない）
      userVerification: "required",
    });

    const res = NextResponse.json(options);
    res.cookies.set(
      CHALLENGE_COOKIE,
      await createChallengeCookie(options.challenge, "login"),
      CHALLENGE_COOKIE_OPTIONS
    );
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    // ADMIN_TOKEN未設定などで署名できない場合もここに落ちる
    return notFound();
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { ADMIN_SESSION_COOKIE, isValidSession } from "@/lib/adminAuth";
import {
  type StoredPasskey,
  getStoredPasskeys,
  resolveRp,
  toBase64Url,
} from "@/lib/adminPasskeys";
import { CHALLENGE_COOKIE, readChallengeCookie } from "@/lib/passkeyChallenge";
import { toJstDateStr } from "@/lib/eventCountdown";

// パスキー登録の検証。Vercelの実行時ファイルシステムは書き込み不可のため、
// ここでは data/adminPasskeys.json を更新せず、コミットすべきJSONを返す。
// 登録は原則1回だけ（iCloudキーチェーンで他のApple端末に同期されるため）。

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

  const expectedChallenge = await readChallengeCookie(
    req.cookies.get(CHALLENGE_COOKIE)?.value,
    "register"
  );
  if (!expectedChallenge) return notFound();

  let payload: { label?: unknown; response?: unknown };
  try {
    payload = (await req.json()) as { label?: unknown; response?: unknown };
  } catch {
    return notFound();
  }

  const label =
    typeof payload.label === "string" && payload.label.trim().length > 0
      ? payload.label.trim().slice(0, 40)
      : "登録端末";

  try {
    const verification = await verifyRegistrationResponse({
      response: payload.response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });

    const credential = verification.registrationInfo?.credential;
    if (!verification.verified || !credential) return notFound();

    const entry: StoredPasskey = {
      id: credential.id,
      publicKey: toBase64Url(credential.publicKey),
      // 実行時に更新保存できないため0で固定する（詳細は adminPasskeys.ts）
      counter: 0,
      transports: credential.transports,
      label,
      addedAt: toJstDateStr(),
    };

    const res = NextResponse.json({
      ok: true,
      entry,
      // そのまま data/adminPasskeys.json に貼れる完成形
      fileContent: JSON.stringify([...getStoredPasskeys(), entry], null, 2),
    });
    res.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    return notFound();
  }
}

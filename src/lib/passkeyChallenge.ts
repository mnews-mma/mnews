import { signPayload, verifyPayloadSignature } from "./adminAuth";

// WebAuthnのチャレンジ（1回限りの乱数）を、サーバー側の書き込み可能な
// ストレージ無しで保持するための署名付きCookie。
//
// 値の形式: <purpose>.<challenge>.<expiresAt>.<HMAC署名>
// challengeはBase64URL（[A-Za-z0-9_-]のみ）なので "." を区切りに使える。
//
// 署名により改竄を防ぎ、expiresAtで有効期間を絞る。ログイン用と登録用は
// purposeで分離し、片方のチャレンジをもう片方に流用できないようにする。

export const CHALLENGE_COOKIE = "mn_pk_challenge";

/** チャレンジの有効期間。認証操作を終える時間として十分かつ短い値 */
const CHALLENGE_MAX_AGE_SEC = 5 * 60;

export type ChallengePurpose = "login" | "register";

export const CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: CHALLENGE_MAX_AGE_SEC,
} as const;

export async function createChallengeCookie(
  challenge: string,
  purpose: ChallengePurpose,
  now: number = Date.now()
): Promise<string> {
  const body = `${purpose}.${challenge}.${now + CHALLENGE_MAX_AGE_SEC * 1000}`;
  return `${body}.${await signPayload(body)}`;
}

/**
 * Cookieからチャレンジを取り出す。purposeの不一致・期限切れ・署名不正は
 * すべて null を返す（呼び出し側は区別せず404で応答する）。
 */
export async function readChallengeCookie(
  cookieValue: string | undefined | null,
  purpose: ChallengePurpose,
  now: number = Date.now()
): Promise<string | null> {
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 4) return null;
  const [cookiePurpose, challenge, expiresAtRaw, signature] = parts;

  if (cookiePurpose !== purpose) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || now > expiresAt) return null;

  const body = `${cookiePurpose}.${challenge}.${expiresAtRaw}`;
  if (!(await verifyPayloadSignature(body, signature))) return null;

  return challenge;
}

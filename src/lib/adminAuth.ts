// /admin/* 保護用の認証ユーティリティ。Edge/Node どちらのランタイムからも
// 呼べるよう Web Crypto (SubtleCrypto) のみを使う（node:crypto は使わない）。

export const ADMIN_SESSION_COOKIE = "mn_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30日

// セッションCookieの値は ADMIN_TOKEN を鍵にした固定文字列のHMACで、
// トークンそのものをCookieに載せない（漏洩時の直接悪用を避ける）。
const SESSION_PAYLOAD = "mnews-admin-session-v1";

function getAdminToken(): string {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16) {
    throw new Error("ADMIN_TOKEN is not set or too short");
  }
  return token;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 定数時間比較（タイミング攻撃対策）。
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** ログイン成功時にCookieへ格納するセッション値を生成する */
export async function computeSessionValue(): Promise<string> {
  return hmacSha256Hex(getAdminToken(), SESSION_PAYLOAD);
}

/** Cookieの値が現在のADMIN_TOKENに対して有効なセッション値か検証する */
export async function isValidSession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;
  try {
    const expected = await computeSessionValue();
    return timingSafeEqual(cookieValue, expected);
  } catch {
    return false;
  }
}

/** ログインフォームで入力されたトークンが ADMIN_TOKEN と一致するか検証する */
export function isValidToken(input: string | undefined | null): boolean {
  if (!input) return false;
  try {
    return timingSafeEqual(input, getAdminToken());
  } catch {
    return false;
  }
}

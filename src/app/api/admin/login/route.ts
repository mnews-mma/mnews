import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  computeSessionValue,
  isValidToken,
} from "@/lib/adminAuth";

// 簡易的な総当たり対策。Vercelのサーバーレス関数はウォームインスタンス間で
// メモリを共有しないため厳密ではないが、同一インスタンスへの連続攻撃は防げる。
// 外部ストア(Upstash等)導入はコストが発生するため今回は使わない。
const FAIL_WINDOW_MS = 5 * 60 * 1000; // 5分
const FAIL_LIMIT = 5;
const failMap = new Map<string, { count: number; firstAt: number }>();

function getClientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isBlocked(key: string): boolean {
  const entry = failMap.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > FAIL_WINDOW_MS) {
    failMap.delete(key);
    return false;
  }
  return entry.count >= FAIL_LIMIT;
}

function recordFailure(key: string): void {
  const entry = failMap.get(key);
  if (!entry || Date.now() - entry.firstAt > FAIL_WINDOW_MS) {
    failMap.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count++;
  }
}

function clearFailures(key: string): void {
  failMap.delete(key);
}

export async function POST(req: NextRequest) {
  const key = getClientKey(req);

  if (isBlocked(key)) {
    return NextResponse.json(
      { ok: false, error: "too_many_attempts" },
      { status: 429 }
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (!isValidToken(body.token)) {
    recordFailure(key);
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  clearFailures(key);
  const sessionValue = await computeSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return res;
}

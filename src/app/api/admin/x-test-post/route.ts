import { NextResponse } from "next/server";
import { postThread, isXPostEnabled } from "@/lib/xClient";

// middleware で /api/admin/* は認証必須。ここは認証済みリクエストのみ届く。
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const result = await postThread({
    text: "【テスト】Mニュース X自動ポスト疎通確認",
    replyText: "https://mnews.jp",
    replyDelayMs: 1000,
  });
  return NextResponse.json({ enabled: isXPostEnabled(), ...result });
}

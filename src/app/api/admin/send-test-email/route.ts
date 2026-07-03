import { NextResponse } from "next/server";
import { sendDigestEmail } from "@/lib/digestEmail";

// middleware で /api/admin/* は認証必須。ここは認証済みリクエストのみ届く。
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await sendDigestEmail({ subjectPrefix: "[テスト] " });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

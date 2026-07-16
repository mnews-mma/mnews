import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { RANKINGS_CACHE_TAG } from "@/lib/mnewsRatingData";
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "@/lib/mnewsRating/divisions";

// P0-C(2026-07-17): data/rankings.json更新後のオンデマンド再検証。
// 意図的に /api/admin/* の外に置いている(middleware.tsの管理画面認証
// 境界=Cookie/ブックマークURLフローには一切触れない。Kainaの明示判断で
// この1エンドポイントだけ専用の別トークンを持つ方式にした)。
// REVALIDATE_TOKEN は ADMIN_TOKEN とは別の専用シークレット
// (Vercelの環境変数に別途設定が必要。デプロイスクリプト等の自動実行から
// Authorization: Bearer <REVALIDATE_TOKEN> で呼ぶことを想定)。
//
// 通常デプロイ(vercel deploy --prod)はURLに埋め込まれたcommit SHAが変わる
// ため次回アクセスで自動的に最新を取る一方、「mainにマージしただけで
// 新規デプロイをしていない」データ更新時は最大1時間キャッシュが残る
// (mnewsRatingData.tsのコメント参照)。このエンドポイントはその1時間を
// 待たずに即時パージするためのもの。
export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.REVALIDATE_TOKEN;
  if (!token || token.length < 16) return false; // 未設定時は誰も通さない
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!bearer) return false;
  return timingSafeEqual(bearer, token);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    revalidateTag(RANKINGS_CACHE_TAG);
    revalidatePath("/rankings");
    revalidatePath("/"); // トップページのフェザー級トップ5ウィジェット
    for (const division of PUBLISHED_DIVISIONS) {
      revalidatePath(`/rankings/${DIVISION_SLUG[division]}`);
    }
    return NextResponse.json({
      ok: true,
      revalidatedTag: RANKINGS_CACHE_TAG,
      revalidatedPaths: ["/rankings", "/", ...PUBLISHED_DIVISIONS.map((d) => `/rankings/${DIVISION_SLUG[d]}`)],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

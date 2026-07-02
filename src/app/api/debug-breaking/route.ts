import { NextResponse } from "next/server";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { diagnoseBreaking } from "@/lib/tweetDigest";

export const dynamic = "force-dynamic";

// BREAKING判定のデバッグ用。実際に取得できている記事と各スコア内訳を返す。
// 調査完了後は削除してよい一時エンドポイント。
export async function GET() {
  const result = await fetchAllArticles().catch(() => null);
  const articles = result?.articles ?? [];
  const diag = diagnoseBreaking(articles);
  return NextResponse.json({
    now: new Date().toISOString(),
    totalArticles: articles.length,
    fetchedSources: result?.fetchedSources ?? 0,
    totalSources: result?.totalSources ?? 0,
    ...diag,
  });
}

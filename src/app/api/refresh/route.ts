import { NextResponse } from "next/server";
import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { fetchLatestOfficialVideos } from "@/lib/feeds/youtube";

export const dynamic = "force-dynamic";

// 外部の無料Cronサービス（cron-job.org等）から1分おきに叩いてもらう想定の
// エンドポイント。fetchAllArticles()/fetchLatestOfficialVideos() を実行する
// ことで、ホームページが使う Next.js の fetch キャッシュ（30分/30分）を常に
// 温め直し、実際の訪問者が古いキャッシュを引いて待たされるのを防ぐ。
export async function GET() {
  const start = Date.now();
  const [articlesResult, videos] = await Promise.all([
    fetchAllArticles().catch(() => null),
    fetchLatestOfficialVideos().catch(() => []),
  ]);

  return NextResponse.json({
    ok: true,
    articles: articlesResult?.articles.length ?? 0,
    fetchedSources: articlesResult?.fetchedSources ?? 0,
    totalSources: articlesResult?.totalSources ?? 0,
    videos: videos.length,
    tookMs: Date.now() - start,
  });
}

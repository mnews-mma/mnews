import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/events";
import { buildCountdownPost } from "@/lib/xPost";
import { postThread, isXPostEnabled } from "@/lib/xClient";
import { getJsonFile, putJsonFile } from "@/lib/githubContent";
import { SITE_URL, ogImagePath } from "@/lib/ogShared";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FLAG_PATH = "data/postedCountdowns.json";

// 「明日(JST暦日)」の日付文字列(YYYY-MM-DD)
function tomorrowJst(): string {
  return new Date(Date.now() + 9 * 3600_000 + 86400_000).toISOString().slice(0, 10);
}

// 大会前日カウントダウン自動投稿。毎日定時にVercel Cronから叩かれ、
// 「明日開催」のイベントがあれば1件だけ投稿する。
// 二重投稿防止: リポジトリ内 data/postedCountdowns.json に投稿済みslugを
// 記録し、GitHub Contents API経由で読み書きする(GITHUB_REPO_TOKEN必須)。
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const targetDate = tomorrowJst();
  const event = getUpcomingEvents().find((e) => e.date === targetDate);
  if (!event) {
    return NextResponse.json({ ok: true, skipped: "no-event-tomorrow", targetDate });
  }

  // 冪等性チェック(dry-run中はフラグを見ない＝何度でも安全にテスト可能)
  if (isXPostEnabled()) {
    const flagFile = await getJsonFile<string[]>(FLAG_PATH);
    if (flagFile === null) {
      // GITHUB_REPO_TOKEN未設定: 二重投稿防止ができないため安全側で投稿を見送る
      return NextResponse.json(
        { ok: false, error: "GITHUB_REPO_TOKEN not set; refusing to post without idempotency guard" },
        { status: 500 }
      );
    }
    const posted = flagFile.data ?? [];
    if (posted.includes(event.slug)) {
      return NextResponse.json({ ok: true, skipped: "already-posted", slug: event.slug });
    }
  }

  const post = buildCountdownPost(event);
  const imageUrl = `${SITE_URL}${ogImagePath(post.imageUrl)}`;
  const result = await postThread({
    text: post.text,
    replyText: post.replyText,
    imageUrl,
    replyDelayMs: 1000,
  });

  // 実投稿が成功した場合のみフラグを記録(dry-runは記録しない)
  if (result.ok && !result.dryRun) {
    const flagFile = await getJsonFile<string[]>(FLAG_PATH);
    const posted = flagFile?.data ?? [];
    await putJsonFile(
      FLAG_PATH,
      [...posted, event.slug],
      flagFile?.sha,
      `chore: mark countdown posted for ${event.slug} [skip ci]`
    );
  }

  return NextResponse.json({ ok: result.ok, dryRun: result.dryRun, slug: event.slug, result });
}

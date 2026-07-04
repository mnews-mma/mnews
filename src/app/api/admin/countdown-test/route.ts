import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/events";
import { buildCountdownPost } from "@/lib/xPost";
import { postThread, isXPostEnabled } from "@/lib/xClient";
import { getJsonFile } from "@/lib/githubContent";
import { SITE_URL, ogImagePath } from "@/lib/ogShared";

// middleware で /api/admin/* は認証必須。
// cron本番ルート(/api/cron/countdown-post)と違い、こちらは「明日開催」に
// 縛られず直近のupcomingイベント1件でその場でテストできる(dry-run前提)。
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const event = getUpcomingEvents()[0];
  if (!event) {
    return NextResponse.json({ ok: false, error: "no upcoming event" }, { status: 404 });
  }

  const flagFile = isXPostEnabled() ? await getJsonFile<string[]>("data/postedCountdowns.json") : null;
  const alreadyPosted = flagFile?.data?.includes(event.slug) ?? false;

  const post = buildCountdownPost(event);
  const imageUrl = `${SITE_URL}${ogImagePath(post.imageUrl)}`;

  if (isXPostEnabled() && alreadyPosted) {
    return NextResponse.json({
      ok: true,
      skipped: "already-posted (投稿済みフラグにより実際には送信しません)",
      slug: event.slug,
      preview: { text: post.text, replyText: post.replyText, imageUrl },
    });
  }

  const result = await postThread({
    text: post.text,
    replyText: post.replyText,
    imageUrl,
    replyDelayMs: 1000,
  });
  return NextResponse.json({ ok: result.ok, dryRun: result.dryRun, slug: event.slug, result });
}

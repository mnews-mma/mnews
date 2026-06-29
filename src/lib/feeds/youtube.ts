import { SourceKey } from "../sources";

const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 120; // /api/refresh を1分おきに叩く想定で短縮

export interface SocialPost {
  org: SourceKey;
  orgLabel: string;
  videoId: string;
  title: string;
  url: string;
  thumbnail: string;
  publishedAt: string;
}

// YouTubeはチャンネルRSSが認証不要で公開されているため、これを利用する。
// （X/Twitterは公式API（要・有料プラン）が無いと最新投稿を安定取得できない
// ため、今回はYouTubeのみ自動取得し、Xはプロフィールへのリンクのみとする）
const CHANNELS: { org: SourceKey; orgLabel: string; channelId: string }[] = [
  { org: "rizin", orgLabel: "RIZIN", channelId: "UCZZ0UGjWsRdM8_5bsqtxYaQ" },
  { org: "deep", orgLabel: "DEEP", channelId: "UCrzcqokfdjCm0JiqzYJZxeA" },
  { org: "pancrase", orgLabel: "パンクラス", channelId: "UC2ENxhP3eiSmkLUa3aax7AA" },
  { org: "shooto", orgLabel: "修斗", channelId: "UCeU0BOmDWDFCqi9qSCt-Sog" },
];

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MNewsBot/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function firstEntry(xml: string): { videoId: string; title: string; published: string } | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;
  const entry = entryMatch[1];
  const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
  const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
  const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
  if (!videoId || !title || !published) return null;
  return { videoId, title, published };
}

async function fetchLatestVideo(
  org: SourceKey,
  orgLabel: string,
  channelId: string
): Promise<SocialPost | null> {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!xml) return null;
  const entry = firstEntry(xml);
  if (!entry) return null;
  return {
    org,
    orgLabel,
    videoId: entry.videoId,
    title: entry.title,
    url: `https://www.youtube.com/watch?v=${entry.videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
    publishedAt: new Date(entry.published).toISOString(),
  };
}

export async function fetchLatestOfficialVideos(): Promise<SocialPost[]> {
  // CHANNELS の並び（RIZIN→DEEP→パンクラス→修斗）を保つため、更新日時では
  // 並び替えない。Promise.allSettled の結果は入力順に対応するのでそのまま使う。
  const results = await Promise.allSettled(
    CHANNELS.map((c) => fetchLatestVideo(c.org, c.orgLabel, c.channelId))
  );
  const posts: SocialPost[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) posts.push(r.value);
  }
  return posts;
}

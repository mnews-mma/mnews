import type { Article } from "./articles";

// data/archive.json（30分ごとにGitHub Actionsが新着URLを追記）から、
// 記事URL → 初回検知時刻(firstSeenAt) のマップを作る。
// BREAKINGの失効起点を「公開時刻」ではなく「Mニュースが検知した時刻」に
// するために使う。archive/page.tsx と同じ raw GitHub URL を参照する。
const ARCHIVE_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";

export async function fetchFirstSeenMap(): Promise<Map<string, string>> {
  try {
    const res = await fetch(ARCHIVE_URL, { next: { revalidate: 300 } });
    if (!res.ok) return new Map();
    const articles: Article[] = await res.json();
    const map = new Map<string, string>();
    for (const a of articles) {
      if (a.firstSeenAt && !map.has(a.url)) {
        map.set(a.url, a.firstSeenAt);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

// 記事一覧に firstSeenAt を付与する（アーカイブに未登録＝ごく最近初検知の
// 記事は publishedAt を検知時刻の代替にする）。
export function enrichFirstSeen(
  articles: Article[],
  firstSeenMap: Map<string, string>
): Article[] {
  return articles.map((a) => ({
    ...a,
    firstSeenAt: a.firstSeenAt ?? firstSeenMap.get(a.url),
  }));
}

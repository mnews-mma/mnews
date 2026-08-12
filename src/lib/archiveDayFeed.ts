import type { Article } from "./articles";

const ARCHIVE_JSON_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";

// archive.json全件を取得する。5分キャッシュ(下のfetchArticlesForJstDayの
// 唯一の呼び出し元だった/api/og/digestルートの既存revalidate値を踏襲)。
async function fetchArchivedArticles(): Promise<Article[]> {
  const res = await fetch(ARCHIVE_JSON_URL, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return await res.json();
}

// 指定日(JST暦日)の記事だけを抽出する。publishedAtがJSTの
// [dateStr 0:00, dateStr翌日 0:00) に入るものが対象。+09:00アンカーで
// タイムゾーン非依存にする考え方はeventCountdown.tsと同じ。
export function filterArticlesForJstDay(articles: Article[], dateStr: string): Article[] {
  const dayStart = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return articles.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return t >= dayStart && t < dayEnd;
  });
}

// 指定日(JST暦日)のarchive.json記事を取得する。/api/og/digestと
// /archive/[date]ページが同じ日境界判定を共有するための唯一の実装
// (二重実装しない)。
export async function fetchArticlesForJstDay(dateStr: string): Promise<Article[]> {
  const all = await fetchArchivedArticles();
  return filterArticlesForJstDay(all, dateStr);
}

import { Article } from "../articles";
import { SourceKey } from "../sources";
import { parseRss, parseAtom, RawItem } from "./xml";
import { classifyOrg } from "./classify";

const REVALIDATE_SECONDS = 1800; // 30 min, per mnews-spec.md auto-update interval
const SUMMARY_MAX = 100; // 著作権対応: 100文字以内サマリーのみ

const FETCH_TIMEOUT_MS = 8000;

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

function toIso(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function toArticle(
  item: RawItem,
  source: SourceKey,
  origin: string,
  idPrefix: string,
  index: number
): Article | null {
  if (!item.title || !item.link) return null;
  return {
    id: `${idPrefix}-${index}`,
    source,
    title: item.title,
    summary: item.description ? truncate(item.description, SUMMARY_MAX) : undefined,
    origin,
    url: item.link,
    publishedAt: toIso(item.date),
  };
}

async function fetchOfficialFeed(
  url: string,
  format: "rss" | "atom",
  source: SourceKey,
  origin: string,
  idPrefix: string
): Promise<Article[]> {
  const xml = await fetchText(url);
  if (!xml) return [];
  const items = format === "rss" ? parseRss(xml) : parseAtom(xml);
  return items
    .map((it, i) => toArticle(it, source, origin, idPrefix, i))
    .filter((a): a is Article => a !== null);
}

async function fetchMediaFeed(
  url: string,
  format: "rss" | "atom",
  origin: string,
  idPrefix: string
): Promise<Article[]> {
  const xml = await fetchText(url);
  if (!xml) return [];
  const items = format === "rss" ? parseRss(xml) : parseAtom(xml);
  const out: Article[] = [];
  items.forEach((it, i) => {
    const org = classifyOrg(it.title) ?? "other";
    const a = toArticle(it, org, origin, idPrefix, i);
    if (a) out.push(a);
  });
  return out;
}

async function fetchEfightMma(): Promise<Article[]> {
  const html = await fetchText("https://efight.jp/genre?tag=mma");
  if (!html) return [];
  const matches = Array.from(
    html.matchAll(/<a href="(https:\/\/efight\.jp\/news-(\d{8})_\d+)"[^>]*><h5[^>]*>([^<]+)<\/h5>/g)
  );
  const out: Article[] = [];
  matches.forEach(([, url, dateStr, rawTitle], i) => {
    const title = rawTitle.replace(/\s+/g, " ").trim();
    const org = classifyOrg(title) ?? "other";
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    out.push({
      id: `efight-${i}`,
      source: org,
      title,
      origin: "イーファイト",
      url,
      publishedAt: toIso(`${y}-${m}-${d}`),
    });
  });
  return out;
}

export interface FeedResult {
  articles: Article[];
  fetchedSources: number;
  totalSources: number;
}

export async function fetchAllArticles(): Promise<FeedResult> {
  const tasks: Promise<Article[]>[] = [
    fetchOfficialFeed("https://fc.rizinff.com/blogs/news.atom", "atom", "rizin", "RIZIN公式", "rizin"),
    fetchOfficialFeed("https://www.deep2001.com/feed", "rss", "deep", "DEEP公式", "deep"),
    fetchOfficialFeed(
      "http://blog.livedoor.jp/pancrasenews/atom.xml",
      "atom",
      "pancrase",
      "パンクラス公式",
      "pancrase"
    ),
    fetchMediaFeed("https://gonkaku.jp/feed", "rss", "ゴング格闘技", "gonkaku"),
    fetchMediaFeed("https://mmaplanet.jp/feed", "rss", "MMAPLANET", "mmaplanet"),
    fetchEfightMma(),
  ];

  const results = await Promise.allSettled(tasks);
  const articles: Article[] = [];
  let fetchedSources = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) {
      fetchedSources++;
      articles.push(...r.value);
    }
  }

  // De-duplicate by URL (per spec: 重複記事の排除）
  const seen = new Set<string>();
  const deduped = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { articles: deduped, fetchedSources, totalSources: tasks.length };
}

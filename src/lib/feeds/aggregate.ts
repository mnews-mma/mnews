import { Article } from "../articles";
import { SourceKey } from "../sources";
import { parseRss, parseAtom, RawItem } from "./xml";
import { isMmaRelevant } from "./classify";

// 外部Cron（/api/refresh を1分おきに叩く想定）でキャッシュを温め続けるため、
// 2分に短縮。実際の更新頻度は外部Cronの呼び出し間隔に依存する。
const REVALIDATE_SECONDS = 120;
const SUMMARY_MAX = 100; // 著作権対応: 100文字以内サマリーのみ
const MAX_AGE_DAYS = 7; // 直近1週間のみ掲載
const MAX_PER_BUCKET = 24; // 画面が長くなり過ぎないための上限

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

// 公式サイト/公式フィードから直接取得した記事専用。「公式発表」欄に表示される。
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

// 二次メディアの記事専用。公式発信ではないため常に "other"（ニュース・
// バッジ無し）として扱い、MMAに無関係な記事はここで除外する。
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
    if (!isMmaRelevant(it.title)) return;
    const a = toArticle(it, "other", origin, idPrefix, i);
    if (a) out.push(a);
  });
  return out;
}

// パンクラス公式サイトのリリース一覧（公式ブログは2023年で更新停止していた
// ため、こちらの月別お知らせページを使う）。"<h3>6月</h3><ul><li>06.28：
// <a href="...">タイトル</a></li>...</ul>" という構造で、新しい月から降順
// に並ぶ（年表記は無いので、月が前のループより大きくなったタイミングで
// 年をひとつ遡る）。
async function fetchPancraseReleases(): Promise<Article[]> {
  const html = await fetchText("https://www.pancrase.co.jp/rls/index.html");
  if (!html) return [];

  const out: Article[] = [];
  let year = new Date().getFullYear();
  let prevMonth = 13; // 1月始まりループの初回に年を遡らせないための番兵

  const monthBlocks = Array.from(html.matchAll(/<h3>(\d{1,2})月<\/h3>\s*<ul>([\s\S]*?)<\/ul>/g));
  let i = 0;
  for (const [, monthStr, listHtml] of monthBlocks) {
    const month = Number(monthStr);
    if (month > prevMonth) year -= 1;
    prevMonth = month;

    const items = Array.from(listHtml.matchAll(/<li>(\d{2})\.(\d{2})[：:]<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g));
    for (const [, , dd, href, rawTitle] of items) {
      let url: string;
      try {
        url = new URL(href, "https://www.pancrase.co.jp/rls/index.html").toString();
      } catch {
        continue;
      }
      out.push({
        id: `pancrase-${i++}`,
        source: "pancrase",
        title: rawTitle.trim(),
        origin: "パンクラス公式",
        url,
        publishedAt: toIso(`${year}-${String(month).padStart(2, "0")}-${dd}`),
      });
    }
  }

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
    if (!isMmaRelevant(title)) return;
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    out.push({
      id: `efight-${i}`,
      source: "other",
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

// 取得したそのままの記事一覧（重複除去のみ）。ホームページ表示用の期間/件数
// 制限はかけない。アーカイブ用スクリプトなどでも再利用するため公開する。
export async function fetchRawArticles(): Promise<FeedResult> {
  const tasks: Promise<Article[]>[] = [
    fetchOfficialFeed("https://fc.rizinff.com/blogs/news.atom", "atom", "rizin", "RIZIN公式", "rizin"),
    fetchOfficialFeed("https://www.deep2001.com/feed", "rss", "deep", "DEEP公式", "deep"),
    fetchOfficialFeed("https://j-shooto.com/category/professional/feed/", "rss", "shooto", "日本修斗協会公式", "shooto"),
    fetchPancraseReleases(),
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

export async function fetchAllArticles(): Promise<FeedResult> {
  const { articles, fetchedSources, totalSources } = await fetchRawArticles();

  // 直近1週間のみ掲載（画面が長くなり過ぎないようにする）
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const recent = articles.filter((a) => new Date(a.publishedAt).getTime() >= cutoff);

  // バケツ（公式発表 / ニュース）ごとに上限を適用
  const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);
  const official = recent.filter((a) => OFFICIAL_ORGS.has(a.source)).slice(0, MAX_PER_BUCKET);
  const news = recent.filter((a) => !OFFICIAL_ORGS.has(a.source)).slice(0, MAX_PER_BUCKET);
  const limited = [...official, ...news].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return { articles: limited, fetchedSources, totalSources };
}

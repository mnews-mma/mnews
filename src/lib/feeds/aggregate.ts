import { Article } from "../articles";
import { SourceKey } from "../sources";
import { parseRss, parseAtom, RawItem } from "./xml";
import { isMmaRelevant } from "./classify";

// 外部Cron（/api/refresh を1分おきに叩く想定）でキャッシュを温め続けるため、
// 2分に短縮。実際の更新頻度は外部Cronの呼び出し間隔に依存する。
const REVALIDATE_SECONDS = 120;
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

// Shift_JIS（ORICON等）で配信されるページ用。fetch().text()はUTF-8前提で
// 文字化けするため、バイト列を明示的にデコードする。
async function fetchTextSjis(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MNewsBot/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder("shift_jis").decode(buf);
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
    // 著作権対応: 本文・要約は一切保存しない。見出し＋元記事URLのみ格納する
    // （読売見出し事件を踏まえ、表示側でも軽微なリライトを行う運用）。
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

// ORICON「格闘技」タグ一覧からRIZIN関連記事のみを抽出する。
// 規約上「リンクは自由／本文・画像の複製は禁止」のため、見出し＋元記事URLの
// みを保存する（本文lead文は一切読み取らない）。見出しはデッドコピーを
// 避けるため軽微にリライトする（読売見出し事件を踏まえた運用）。
const RIZIN_KEYWORDS = [
  "RIZIN",
  "ライジン",
  "朝倉未来",
  "朝倉海",
  "平本蓮",
  "鈴木千裕",
  "堀口恭司",
  "YA-MAN",
  "萩原京平",
  "ヒロヤ",
  "斎藤裕",
  "クレベル",
  "秋元強真",
];

// 見出しの軽微なリライト。デッドコピー回避のため、記号や助詞レベルで
// 元記事と完全一致しないよう最低限の言い換えを行う。
function rewriteOriconTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/^【RIZIN】\s*/, "");
  // 元記事の常套句をmnews側の言い回しに置換
  t = t.replace(/という。?$/, "とのこと");
  t = t.replace(/明かした/, "語った");
  t = t.replace(/コメントした/, "話した");
  return `【RIZIN】${t}`;
}

async function fetchOriconRizin(): Promise<Article[]> {
  const html = await fetchTextSjis("https://www.oricon.co.jp/news/tag/id/kakutougi/");
  if (!html) return [];

  // <article ...><a href="/news/2465194/">...<h2 class="title">見出し</h2>
  //   ...<time class="date" datetime="2026-07-03 20:20">
  const cards = Array.from(
    html.matchAll(
      /<a href="(\/news\/\d+\/)"><div class="inner">[\s\S]*?<h2 class="title">([\s\S]*?)<\/h2>[\s\S]*?<time class="date" datetime="([^"]+)"/g
    )
  );

  const out: Article[] = [];
  cards.forEach(([, path, rawTitleHtml, datetime], i) => {
    const rawTitle = rawTitleHtml.replace(/<[^>]+>/g, "").trim();
    if (!rawTitle) return;
    // ボクシング等の非RIZIN格闘技は除外
    if (!RIZIN_KEYWORDS.some((kw) => rawTitle.includes(kw))) return;

    out.push({
      id: `oricon-${i}`,
      source: "other",
      title: rewriteOriconTitle(rawTitle),
      origin: "ORICON",
      url: `https://www.oricon.co.jp${path}`,
      publishedAt: toIso(datetime.replace(" ", "T")),
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
    fetchOriconRizin(),
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

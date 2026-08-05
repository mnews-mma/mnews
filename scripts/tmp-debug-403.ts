// 一時調査スクリプト。Actions上でのみ意味を持つ(ローカルは再現しないため)。
// 最終PRには残さない。
const DEFAULT_UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function check(label: string, url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`[${label}] status=${res.status} len=${text.length} snippet=${JSON.stringify(text.slice(0, 200))}`);
  } catch (err) {
    console.log(`[${label}] ERROR: ${String(err)}`);
  }
}

async function main() {
  const apiUrl = "https://j-shooto.com/wp-json/wp/v2/posts?per_page=5&_fields=id,date,link,title";
  const homeUrl = "https://j-shooto.com/";

  await check("robots.txt", "https://j-shooto.com/robots.txt", { "User-Agent": DEFAULT_UA });
  await check("api+defaultUA", apiUrl, { "User-Agent": DEFAULT_UA });
  await check("api+browserUA", apiUrl, { "User-Agent": BROWSER_UA });
  await check("api+browserUA+accept", apiUrl, {
    "User-Agent": BROWSER_UA,
    Accept: "application/json",
    "Accept-Language": "ja,en;q=0.9",
  });
  await check("home+defaultUA", homeUrl, { "User-Agent": DEFAULT_UA });
  await check("home+browserUA", homeUrl, { "User-Agent": BROWSER_UA });

  const scheduleRes = await fetch("https://www.shooto-mma.com/schedule/", { headers: { "User-Agent": DEFAULT_UA } });
  const scheduleText = await scheduleRes.text();
  const hasLemino = /Lemino\s*修斗/i.test(scheduleText);
  console.log(`[shooto-mma schedule] status=${scheduleRes.status} len=${scheduleText.length} hasLeminoMention=${hasLemino}`);
  if (hasLemino) {
    const idx = scheduleText.search(/Lemino\s*修斗/i);
    console.log(`[shooto-mma schedule] context=${JSON.stringify(scheduleText.slice(Math.max(0, idx - 200), idx + 200))}`);
  }

  // ラウンド2: wp-json以外の経路でLemino修斗の投稿一覧を発見できないか
  const homeRes = await fetch(homeUrl, { headers: { "User-Agent": DEFAULT_UA } });
  const homeText = await homeRes.text();
  console.log(`[home content] hasLeminoMention=${/Lemino\s*修斗/i.test(homeText)}`);
  const hrefs = [...homeText.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const catLinks = hrefs.filter((h) => /\/category\//i.test(h));
  console.log(`[home links] categoryLinks(sample)=${JSON.stringify([...new Set(catLinks)].slice(0, 10))}`);
  const postLinks = hrefs.filter((h) => /^https:\/\/j-shooto\.com\/\d{4}\//.test(h));
  console.log(`[home links] postLinks(sample)=${JSON.stringify([...new Set(postLinks)].slice(0, 10))}`);

  await check("wp-sitemap.xml", "https://j-shooto.com/wp-sitemap.xml", { "User-Agent": DEFAULT_UA });
  await check("wp-sitemap-posts-post-1.xml", "https://j-shooto.com/wp-sitemap-posts-post-1.xml", { "User-Agent": DEFAULT_UA });

  const searchUrl = `https://j-shooto.com/?s=${encodeURIComponent("Lemino修斗")}`;
  const searchRes = await fetch(searchUrl, { headers: { "User-Agent": DEFAULT_UA } });
  const searchText = await searchRes.text();
  console.log(
    `[search] status=${searchRes.status} len=${searchText.length} hasLeminoMention=${/Lemino\s*修斗/i.test(searchText)}`
  );
  // 検索結果一覧のHTML構造を実測するため、記事リンク(post-\d+/またはslug/)を
  // 含む<a>タグの前後300文字を、最初の5件だけダンプする。
  const articleAnchors = [
    ...searchText.matchAll(/<a[^>]+href="(https:\/\/j-shooto\.com\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>/g),
  ];
  console.log(`[search] articleAnchorCount=${articleAnchors.length}`);
  const seenUrls = new Set<string>();
  let dumped = 0;
  for (const m of articleAnchors) {
    if (seenUrls.has(m[1])) continue;
    seenUrls.add(m[1]);
    if (dumped >= 6) break;
    dumped++;
    const start = Math.max(0, m.index! - 100);
    console.log(`[search] anchor#${dumped} url=${m[1]}`);
    console.log(`[search] anchor#${dumped} context=${JSON.stringify(searchText.slice(start, m.index! + 500))}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

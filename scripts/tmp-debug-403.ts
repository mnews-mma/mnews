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
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

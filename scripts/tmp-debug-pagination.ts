// 一時調査スクリプト(指示書⑤の②)。最終PRには残さない。
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const RESULT_RE = /<a href="([^"]+)"<dt>\d{4}年\d{1,2}月\d{1,2}日<\/dt>\s*<dd>([^<]+)<br>/g;

async function fetchAndCount(label: string, url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await res.text();
  const matches = [...text.matchAll(RESULT_RE)];
  const uniqueLinks = new Set(matches.map((m) => m[1]));
  const totalMatch = text.match(/検索結果\s*[:：]\s*(\d+)\s*件/);
  console.log(
    `[${label}] status=${res.status} len=${text.length} rawMatches=${matches.length} uniqueLinks=${uniqueLinks.size} declaredTotal=${totalMatch ? totalMatch[1] : "不明"}`
  );
  return { text, uniqueLinks };
}

async function main() {
  const q = encodeURIComponent("Lemino修斗");
  const page1 = await fetchAndCount("page1(paramなし)", `https://j-shooto.com/?s=${q}`);
  const paged2 = await fetchAndCount("paged=2", `https://j-shooto.com/?s=${q}&paged=2`);
  const perPage50 = await fetchAndCount("posts_per_page=50", `https://j-shooto.com/?s=${q}&posts_per_page=50`);

  const onlyInPage2 = [...paged2.uniqueLinks].filter((l) => !page1.uniqueLinks.has(l));
  console.log(`[diff] paged=2に含まれpage1に無いリンク数=${onlyInPage2.length}`);
  console.log(`[diff] paged=2内容=page1内容と同一か=${paged2.text === page1.text}`);

  // 検索結果内の最も古い日付(=これより古い大会は現行実装では取りこぼす可能性)
  const dateMatches = [...page1.text.matchAll(/<dt>(\d{4})年(\d{1,2})月(\d{1,2})日<\/dt>/g)];
  const dates = dateMatches.map((m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  console.log(`[page1] 出現日付件数=${dates.length} 最新=${dates[0]} 最古=${dates[dates.length - 1]}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

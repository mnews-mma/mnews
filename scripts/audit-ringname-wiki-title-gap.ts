// captain-africa(キャプテン☆アフリカ → 本名記事「出花崇太郎」)と同じサブタイプ、
// すなわち「mnewsの登録名がリングネームで、ja-wikiの本名記事に到達できていない」
// 選手が他に何名いるかを数える読み取り専用スクリプト。
//
// 母集団: 指示書W(PR #337)でC(記事なし・同名別人疑い含む)に分類された164名
//         (out/wiki-coverage-C.csv)。
//
// 判定方法(すべてMediaWiki APIの生wikitextのみを根拠にする。レンダリング版は見ない):
//   1. 登録名(nameJa)を全文検索(list=search, insource)し、候補記事を集める
//   2. 候補記事のwikitextを取得し、次の両方を満たすものを「本名記事」とみなす
//      - リングネーム/別名として登録名が書かれている
//        (statsbox/recordboxの nickname= / 本文の「リングネームは〜」等)
//      - プロMMA戦績表がある({{Fight-cont}} を含む)
//   3. 記事タイトル自体が登録名と一致するものは対象外(それはWの分類Aに当たる)
//
// 実行: npx tsx scripts/audit-ringname-wiki-title-gap.ts
// 出力: out/ringname-wiki-title-gap.md
import fs from "fs";
import path from "path";

const UA = "MNewsBot/1.0 (https://www.mnews.jp; contact: mnews-mma)";
const API = "https://ja.wikipedia.org/w/api.php";
const CSV = path.join(process.cwd(), "out", "wiki-coverage-C.csv");
const OUT = path.join(process.cwd(), "out", "ringname-wiki-title-gap.md");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?${qs}`, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
    await sleep(500 * (attempt + 1));
  }
  return null;
}

// 空白・中黒・☆等の装飾を落とした比較用キー(resolveFighter.tsのnormと同じ考え方)。
const norm = (s: string) => s.replace(/[\s　・☆★"'"'"“”]/g, "");

async function searchCandidates(name: string): Promise<string[]> {
  const json = await api({
    action: "query",
    list: "search",
    srsearch: `insource:"${name}"`,
    srnamespace: "0",
    srlimit: "8",
  });
  return (json?.query?.search ?? []).map((s: { title: string }) => s.title);
}

// タイトル最大50件ぶんのwikitextをまとめて取得する(レート制限回避)。
async function fetchWikitexts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const json = await api({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });
    for (const p of json?.query?.pages ?? []) {
      const text = p?.revisions?.[0]?.slots?.main?.content;
      if (text) out.set(p.title, text);
    }
    await sleep(200);
  }
  return out;
}

// 「この記事のリングネーム/別名が登録名である」ことをwikitext上で確認する。
function declaresRingName(wikitext: string, name: string): boolean {
  const key = norm(name);
  for (const line of wikitext.split("\n")) {
    if (!line.includes(name)) continue;
    // statsbox/recordboxのnickname=、本文の「リングネームは〜」「別名〜」
    const m = line.match(/^\s*\|?\s*(nickname|nickname2|リングネーム|別名)\s*=\s*(.+)$/);
    if (m && norm(m[2]).includes(key)) return true;
    if (/(リングネーム|別名|通称|旧名|改名)/.test(line)) return true;
  }
  return false;
}

async function main() {
  const rows = fs
    .readFileSync(CSV, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(","))
    .map(([slug, nameJa, reason]) => ({ slug, nameJa, reason }));

  const hits: Array<{ slug: string; nameJa: string; title: string }> = [];
  // 緩め判定(上限値): リングネーム宣言の有無を問わず、「別タイトルのMMA戦績表つき記事が
  // 登録名に言及している」だけで拾う。strict判定が取りこぼしていないかの当たり判定。
  const loose: Array<{ slug: string; nameJa: string; title: string }> = [];
  const noCandidate: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const candidates = (await searchCandidates(r.nameJa)).filter((t) => norm(t) !== norm(r.nameJa));
    await sleep(150);
    if (candidates.length === 0) {
      noCandidate.push(r.slug);
      if ((i + 1) % 20 === 0) console.log(`  ...${i + 1}/${rows.length}`);
      continue;
    }
    const texts = await fetchWikitexts(candidates);
    let found: string | null = null;
    let looseFound: string | null = null;
    for (const [title, wikitext] of texts) {
      if (!wikitext.includes("{{Fight-cont") && !wikitext.includes("{{fight-cont")) continue;
      if (!wikitext.includes(r.nameJa)) continue;
      if (!looseFound) looseFound = title;
      if (!declaresRingName(wikitext, r.nameJa)) continue;
      found = title;
      break;
    }
    if (looseFound) loose.push({ slug: r.slug, nameJa: r.nameJa, title: looseFound });
    if (found) {
      hits.push({ slug: r.slug, nameJa: r.nameJa, title: found });
      console.log(`  HIT ${r.slug} (${r.nameJa}) -> ${found}`);
    }
    if ((i + 1) % 20 === 0) console.log(`  ...${i + 1}/${rows.length}`);
  }

  const lines: string[] = [];
  lines.push("# リングネーム登録により本名記事に到達できていない選手の件数調査");
  lines.push("");
  lines.push(`- 母集団: 指示書W の C分類 ${rows.length}名(out/wiki-coverage-C.csv)`);
  lines.push(`- 判定: ja-wiki全文検索で見つかった別タイトル記事が、(a) 登録名をリングネーム/別名として明記し、(b) {{Fight-cont}}のプロMMA戦績表を持つ`);
  lines.push(`- 該当(strict): **${hits.length}名**`);
  lines.push(`- 上限値(loose: リングネーム宣言を問わず、MMA戦績表つきの別タイトル記事が登録名に言及): ${loose.length}名`);
  lines.push(`- 検索候補ゼロ(そもそも記事が存在しないと見られる): ${noCandidate.length}名`);
  lines.push("");
  lines.push("## strict該当");
  lines.push("");
  lines.push("| slug | mnews登録名 | ja-wiki記事タイトル |");
  lines.push("|---|---|---|");
  for (const h of hits) lines.push(`| ${h.slug} | ${h.nameJa} | ${h.title} |`);
  lines.push("");
  lines.push("## loose該当(strictを含む)");
  lines.push("");
  lines.push("実測するとlooseの大半は「他選手の戦績表に対戦相手として名前が出ているだけ」で、");
  lines.push("本人の記事ではない(例: 椿飛鳥 → 中村大介 (プロレスラー) の戦績表)。");
  lines.push("したがってlooseは候補リストではなく、strictの取りこぼし有無を測るための上限値として扱う。");
  lines.push("");
  lines.push("| slug | mnews登録名 | 言及していた記事 |");
  lines.push("|---|---|---|");
  for (const h of loose) lines.push(`| ${h.slug} | ${h.nameJa} | ${h.title} |`);
  lines.push("");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(`\n該当 ${hits.length}名 / 母集団 ${rows.length}名 -> ${OUT}`);
}

main();

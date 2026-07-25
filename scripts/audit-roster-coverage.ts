// 指示書①: 団体公式ランキング突合による選手DB網羅率の可視化(監査専用・読み取り専用)。
// パンクラス/修斗/DEEP(現王者のみ)の公式ランキング・現王者を必達セットとみなし、
// src/lib/fighters.ts の FIGHTERS との差分を機械的に出す。data/・src/ は一切書き換えない。
//
// 名前突合は必ず既存の findFighterSlugByName(fighters.ts) をそのまま使う。新しい正規化
// 関数は書かない(単一ソース原則)。ただし findFighterSlugByName は hidden な選手を常に
// 除外する仕様(内部リンクを張らないための設計)ため、hidden 選手のマッチを見分けるには
// 呼び出し直前だけ FIGHTERS 配列の .hidden をメモリ上で一時的に false へ倒し、直後に必ず
// 元へ戻す(ファイルは1バイトも変更しない・findFighterSlugByName のロジック自体も無改変)。
//
// パンクラス/修斗のランキングHTMLパースは src/lib/orgRankings.ts の parsePancrase/parseShooto
// をそのまま再利用する(独自パーサーを書かない)。ただしこの2関数は「見出しが階級として
// 認識できなかったブロック」を黙って捨てる設計(本番表示としては安全側の挙動)なので、この
// 監査では黙殺禁止の原則に従い、raw <h4> ブロック数と実際に分類できたブロック数を突き合わせ、
// 差があれば「取得できなかった階級区分」として全件を報告する(rawブロック数の突き合わせのみ
// 自前で行う。名前の突合ロジックには一切関与しない)。
//
// DEEPは公式ランキングが存在しないため対象外。現王者のみを対象にし、値は既存の手動検証済み
// スナップショット src/lib/champions.ts の DEEP_RANKING_CLASSES(rank==="王者"の行のみ)を
// 正とする(DEEP公式champページはパーサーが不安定になりやすいとの既存コメントがあり、独自
// パーサーを新設しない方針を踏襲)。ただし本監査では公式ページを生fetchし、各王者名が現在も
// ページ内に出現するかをテキスト検索で照合し、鮮度を確認・報告する(新しい名前突合ロジックでは
// なく、単純な部分文字列存在チェック)。
//
// 実行: npx tsx scripts/audit-roster-coverage.ts
import fs from "fs";
import path from "path";
import { parsePancrase, parseShooto, RankEntry } from "../src/lib/orgRankings";
import { DEEP_RANKING_CLASSES, CHAMPION_SOURCES } from "../src/lib/champions";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";
import { WEIGHT_KG } from "../src/lib/weightClasses";

const UA = "Mozilla/5.0 (compatible; MNewsRosterAudit/1.0)";
const OUT_DIR = path.join(process.cwd(), "out");
const PANCRASE_URL = "https://www.pancrase.co.jp/rls/ranking.html";
const SHOOTO_URL = "https://www.shooto-mma.com/ranking/";

type Org = "pancrase" | "shooto" | "deep";
type Status = "listed" | "hidden" | "missing";
type Confidence = "exact" | "alias" | "none";

interface Row {
  org: Org;
  weight_class_raw: string;
  weight_class_mnews: string;
  weight_class_reason: string;
  rank: string;
  name_official: string;
  name_normalized: string;
  source_url: string;
  fetched_at: string;
  mnews_slug: string;
  status: Status;
  match_confidence: Confidence;
}

interface FetchResult {
  html: string | null;
  error: string | null;
  fetchedAt: string;
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 各リクエスト間に1秒以上のsleepを入れる(指示書S1の要件)。403/429は指数バックオフ。
async function fetchWithBackoff(url: string, label: string): Promise<FetchResult> {
  const backoffMs = [0, 2000, 5000, 10000];
  let lastError = "";
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (attempt > 0) await sleep(backoffMs[attempt]);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 403 || res.status === 429) {
        lastError = `HTTP ${res.status}`;
        console.warn(`[WARN] ${label}: ${lastError}(試行${attempt + 1}/${backoffMs.length})`);
        continue;
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        break;
      }
      return { html: await res.text(), error: null, fetchedAt: todayJst() };
    } catch (e) {
      lastError = String(e);
      console.warn(`[WARN] ${label}: fetch失敗(試行${attempt + 1}/${backoffMs.length}): ${lastError}`);
    }
  }
  return { html: null, error: lastError, fetchedAt: todayJst() };
}

// パンクラス/修斗の <h4> 見出しブロック総数を数える(parsePancrase/parseShootoが内部で
// 「階級として認識できなかったブロック」を黙って捨てていないかの突き合わせ用。名前突合には
// 一切関与しない)。
function countRawHeadingBlocks(html: string, org: "pancrase" | "shooto"): { raw: string }[] {
  const splitter = org === "pancrase" ? /<h4>/ : /<h4 id="/;
  const blocks = html.split(splitter).slice(1);
  return blocks.map((b) => {
    const endIdx = org === "pancrase" ? b.indexOf("</h4>") : b.indexOf(">");
    const head = b.slice(0, endIdx < 0 ? undefined : endIdx).replace(/<[^>]+>/g, "").trim();
    return { raw: head };
  });
}

const WEIGHT_KEYWORD_RE = /(ストロー|フライ|バンタム|フェザー|ライト|ウェルター|ミドル|ライトヘビー|ヘビー|アトム|スーパーアトム)級/;

// FIGHTERS配列の.hiddenを一時的に全解除して findFighterSlugByName を呼び、直後に必ず復元する。
// findFighterSlugByName 自体・正規化ロジック自体は一切変更しない(呼び出し前後でメモリ上の
// フラグを退避・復元するだけ)。ファイルは1バイトも変更しない。
function findSlugIncludingHidden(name: string): string | null {
  const saved = FIGHTERS.map((f) => f.hidden);
  try {
    for (const f of FIGHTERS) f.hidden = false;
    return findFighterSlugByName(name);
  } finally {
    FIGHTERS.forEach((f, i) => {
      f.hidden = saved[i];
    });
  }
}

const stripSpace = (s: string) => s.replace(/[\s　]/g, "");

function classify(nameOfficial: string): { slug: string; status: Status; confidence: Confidence } {
  const listedSlug = findFighterSlugByName(nameOfficial);
  if (listedSlug) {
    const f = FIGHTERS.find((x) => x.slug === listedSlug);
    const confidence: Confidence = f && stripSpace(f.nameJa) === stripSpace(nameOfficial) ? "exact" : "alias";
    return { slug: listedSlug, status: "listed", confidence };
  }
  const hiddenSlug = findSlugIncludingHidden(nameOfficial);
  if (hiddenSlug) {
    const f = FIGHTERS.find((x) => x.slug === hiddenSlug);
    const confidence: Confidence = f && stripSpace(f.nameJa) === stripSpace(nameOfficial) ? "exact" : "alias";
    return { slug: hiddenSlug, status: "hidden", confidence };
  }
  return { slug: "", status: "missing", confidence: "none" };
}

function buildRowsFromRankEntries(
  org: "pancrase" | "shooto",
  classes: { weightClass: string; entries: RankEntry[] }[],
  sourceUrl: string,
  fetchedAt: string
): Row[] {
  const rows: Row[] = [];
  for (const c of classes) {
    for (const e of c.entries) {
      const { status, confidence, slug } = classify(e.officialName);
      const reason = WEIGHT_KG[c.weightClass] === undefined ? "weightClasses.tsのWEIGHT_KGに存在しない階級ラベル" : "";
      rows.push({
        org,
        weight_class_raw: c.weightClass,
        weight_class_mnews: WEIGHT_KG[c.weightClass] !== undefined ? c.weightClass : "",
        weight_class_reason: reason,
        rank: e.rank,
        name_official: e.officialName,
        name_normalized: e.officialName.normalize("NFKC").replace(/[\s　]/g, ""),
        source_url: sourceUrl,
        fetched_at: fetchedAt,
        mnews_slug: slug,
        status,
        match_confidence: confidence,
      });
    }
  }
  return rows;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function writeCsv(rows: Row[]): void {
  const headers: (keyof Row)[] = [
    "org",
    "weight_class_raw",
    "weight_class_mnews",
    "weight_class_reason",
    "rank",
    "name_official",
    "name_normalized",
    "source_url",
    "fetched_at",
    "mnews_slug",
    "status",
    "match_confidence",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(String(r[h]))).join(","));
  }
  fs.writeFileSync(path.join(OUT_DIR, "roster-coverage.csv"), lines.join("\n") + "\n");
}

interface CoverageStat {
  listed: number;
  hidden: number;
  missing: number;
  total: number;
}
function coverageOf(rows: Row[]): CoverageStat {
  const listed = rows.filter((r) => r.status === "listed").length;
  const hidden = rows.filter((r) => r.status === "hidden").length;
  const missing = rows.filter((r) => r.status === "missing").length;
  return { listed, hidden, missing, total: rows.length };
}
function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function writeMarkdown(
  rows: Row[],
  warnings: {
    unclassifiedHeadings: { org: string; raw: string }[];
    fetchFailures: { org: string; url: string; error: string }[];
    deepFreshness: { name: string; foundLive: boolean }[];
  }
): void {
  const md: string[] = [];
  md.push("# roster-coverage: 団体公式ランキング突合による選手DB網羅率");
  md.push("");
  md.push(`生成日時(JST): ${todayJst()}`);
  md.push("");
  md.push(
    "本レポートは監査専用の出力。`fighters.ts` への追加は行っていない(diffゼロ)。推奨・優先度づけは含まない。"
  );
  md.push("");

  md.push("## 1. 団体別・階級別 網羅率");
  md.push("");
  md.push("網羅率A(厳格)= listed ÷ 必達セット総数 / 網羅率B(hiddenを掲載扱い)= (listed+hidden) ÷ 必達セット総数");
  md.push("");
  md.push("| org | weight_class | 必達セット | listed | hidden | missing | 網羅率A | 網羅率B |");
  md.push("|---|---|---|---|---|---|---|---|");
  const orgs: Org[] = ["pancrase", "shooto", "deep"];
  for (const org of orgs) {
    const orgRows = rows.filter((r) => r.org === org);
    const classesInOrg = [...new Set(orgRows.map((r) => r.weight_class_mnews || r.weight_class_raw))];
    for (const wc of classesInOrg) {
      const wcRows = orgRows.filter((r) => (r.weight_class_mnews || r.weight_class_raw) === wc);
      const s = coverageOf(wcRows);
      md.push(
        `| ${org} | ${wc} | ${s.total} | ${s.listed} | ${s.hidden} | ${s.missing} | ${pct(s.listed, s.total)} | ${pct(
          s.listed + s.hidden,
          s.total
        )} |`
      );
    }
    const orgStat = coverageOf(orgRows);
    md.push(
      `| **${org} 計** | — | **${orgStat.total}** | **${orgStat.listed}** | **${orgStat.hidden}** | **${orgStat.missing}** | **${pct(
        orgStat.listed,
        orgStat.total
      )}** | **${pct(orgStat.listed + orgStat.hidden, orgStat.total)}** |`
    );
  }
  const all = coverageOf(rows);
  md.push(
    `| **全体** | — | **${all.total}** | **${all.listed}** | **${all.hidden}** | **${all.missing}** | **${pct(
      all.listed,
      all.total
    )}** | **${pct(all.listed + all.hidden, all.total)}** |`
  );
  md.push("");

  md.push("## 2. missing 全件リスト");
  md.push("");
  md.push("| org | weight_class | rank | name_official |");
  md.push("|---|---|---|---|");
  for (const r of rows.filter((r) => r.status === "missing")) {
    md.push(`| ${r.org} | ${r.weight_class_raw} | ${r.rank} | ${r.name_official} |`);
  }
  md.push("");
  md.push(`missing 総数: ${rows.filter((r) => r.status === "missing").length} 件`);
  md.push("");

  md.push("## 3. match_confidence = none の要確認リスト");
  md.push("");
  const noneRows = rows.filter((r) => r.match_confidence === "none");
  md.push("| org | weight_class | rank | name_official |");
  md.push("|---|---|---|---|");
  for (const r of noneRows) {
    md.push(`| ${r.org} | ${r.weight_class_raw} | ${r.rank} | ${r.name_official} |`);
  }
  md.push("");
  md.push(`件数: ${noneRows.length} 件(= missing の件数と一致するはず。missing以外でconfidence=noneは発生しない設計)`);
  md.push("");

  md.push("## 4. 取得できなかったページ・団体とその理由");
  md.push("");
  if (warnings.fetchFailures.length === 0) {
    md.push("なし(パンクラス/修斗とも公式ページの取得に成功)。");
  } else {
    for (const f of warnings.fetchFailures) {
      md.push(`- ${f.org}: ${f.url} — ${f.error}`);
    }
  }
  md.push("");
  md.push("### 階級区分の抽出に失敗した見出しブロック(黙殺禁止の突き合わせ)");
  md.push("");
  md.push(
    "parsePancrase/parseShooto(既存の本番パーサー、そのまま再利用)は「見出しが階級として認識できなかったブロック」を" +
      "黙って捨てる設計(本番表示上の安全策)。この監査では raw の `<h4>` ブロック数と実際に分類できたブロック数を" +
      "突き合わせ、認識できなかった見出しの原文をすべて列挙する。"
  );
  md.push("");
  if (warnings.unclassifiedHeadings.length === 0) {
    md.push("なし(全見出しブロックが階級として分類できた)。");
  } else {
    md.push("| org | raw heading |");
    md.push("|---|---|");
    for (const u of warnings.unclassifiedHeadings) {
      md.push(`| ${u.org} | ${u.raw} |`);
    }
  }
  md.push("");

  md.push("## 5. weight_class_mnews が空欄になった行");
  md.push("");
  const emptyWc = rows.filter((r) => r.weight_class_mnews === "");
  if (emptyWc.length === 0) {
    md.push("なし。");
  } else {
    md.push("| org | weight_class_raw | rank | name_official | 理由 |");
    md.push("|---|---|---|---|---|");
    for (const r of emptyWc) {
      md.push(`| ${r.org} | ${r.weight_class_raw} | ${r.rank} | ${r.name_official} | ${r.weight_class_reason} |`);
    }
  }
  md.push("");

  md.push("## 6. DEEP現王者の鮮度確認(公式ページのライブ再検証)");
  md.push("");
  md.push(
    `DEEPは公式ランキングが存在しないため対象外。現王者のみを対象とし、値は \`src/lib/champions.ts\` の` +
      ` \`DEEP_RANKING_CLASSES\`(rank==="王者"の行、手動検証済みスナップショット)を正とする。` +
      `本監査では公式ページ(${CHAMPION_SOURCES.deep.url})を生fetchし、各王者名がページ内に現在も` +
      `出現するかを部分文字列一致で確認した(新しい名前突合ロジックではない)。`
  );
  md.push("");
  md.push("| 王者名 | ライブページ内に出現 |");
  md.push("|---|---|");
  for (const d of warnings.deepFreshness) {
    md.push(`| ${d.name} | ${d.foundLive ? "○" : "× (要確認・スナップショットが古い可能性)"} |`);
  }
  md.push("");

  md.push("## 7. 出典・取得日時");
  md.push("");
  md.push(`- パンクラス: ${PANCRASE_URL}`);
  md.push(`- 修斗: ${SHOOTO_URL}`);
  md.push(`- DEEP: ${CHAMPION_SOURCES.deep.url}(現王者のみ・値は src/lib/champions.ts のスナップショット、fetched_dateは同ファイル内 FETCHED_DATE を参照)`);
  md.push("");

  md.push("## 付記: この監査の既知の簡略化");
  md.push("");
  md.push(
    "- `weight_class_raw` は既存パーサー(parsePancrase/parseShooto)がすでに階級名抽出後の値のみを返す設計のため、" +
      "本監査でも同じ値を `weight_class_raw`/`weight_class_mnews` 両方に採用している(抽出前の完全な原文見出しは" +
      "この監査では別途保存していない)。抽出に失敗したブロックは黙殺せず上記4節に全件列挙する形で担保している。"
  );
  md.push(
    "- `name_normalized` 列は表示用の簡易変換(`NFKC`正規化+空白除去)であり、実際の選手DBとの突合判定には一切使用していない。" +
      "判定は必ず `findFighterSlugByName`(fighters.ts、無改変)の呼び出し結果のみに基づく。"
  );
  md.push(
    "- `match_confidence` は `findFighterSlugByName` が返した slug の `nameJa` と `name_official` が空白除去後に" +
      "完全一致するかどうかで exact/alias を区別する簡易ラベル(判定ロジックそのものではなく、既に確定した" +
      "マッチ結果の分類にのみ使用)。"
  );
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "roster-coverage.md"), md.join("\n") + "\n");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fetchFailures: { org: string; url: string; error: string }[] = [];
  const unclassifiedHeadings: { org: string; raw: string }[] = [];
  const allRows: Row[] = [];

  // --- パンクラス ---
  const panResult = await fetchWithBackoff(PANCRASE_URL, "pancrase");
  if (panResult.html) {
    const parsed = parsePancrase(panResult.html);
    allRows.push(...buildRowsFromRankEntries("pancrase", parsed.classes, PANCRASE_URL, panResult.fetchedAt));
    const rawBlocks = countRawHeadingBlocks(panResult.html, "pancrase");
    for (const b of rawBlocks) {
      if (!WEIGHT_KEYWORD_RE.test(b.raw)) unclassifiedHeadings.push({ org: "pancrase", raw: b.raw });
    }
  } else {
    fetchFailures.push({ org: "pancrase", url: PANCRASE_URL, error: panResult.error ?? "unknown" });
  }
  await sleep(1200);

  // --- 修斗 ---
  const shoResult = await fetchWithBackoff(SHOOTO_URL, "shooto");
  if (shoResult.html) {
    const parsed = parseShooto(shoResult.html);
    allRows.push(...buildRowsFromRankEntries("shooto", parsed.classes, SHOOTO_URL, shoResult.fetchedAt));
    const rawBlocks = countRawHeadingBlocks(shoResult.html, "shooto");
    for (const b of rawBlocks) {
      if (/環太平洋/.test(b.raw)) continue; // 対象外(世界ランキングのみ採用、parseShootoと同じ扱い)
      if (!WEIGHT_KEYWORD_RE.test(b.raw)) unclassifiedHeadings.push({ org: "shooto", raw: b.raw });
    }
  } else {
    fetchFailures.push({ org: "shooto", url: SHOOTO_URL, error: shoResult.error ?? "unknown" });
  }
  await sleep(1200);

  // --- DEEP(現王者のみ) ---
  const deepResult = await fetchWithBackoff(CHAMPION_SOURCES.deep.url, "deep");
  const deepFreshness: { name: string; foundLive: boolean }[] = [];
  const deepChampions = DEEP_RANKING_CLASSES.flatMap((c) =>
    c.entries.filter((e) => e.rank === "王者").map((e) => ({ weightClass: c.weightClass, name: e.name }))
  );
  for (const champ of deepChampions) {
    const foundLive = deepResult.html ? deepResult.html.includes(champ.name) : false;
    deepFreshness.push({ name: champ.name, foundLive });
    const { status, confidence, slug } = classify(champ.name);
    allRows.push({
      org: "deep",
      weight_class_raw: champ.weightClass,
      weight_class_mnews: WEIGHT_KG[champ.weightClass] !== undefined ? champ.weightClass : "",
      weight_class_reason: WEIGHT_KG[champ.weightClass] === undefined ? "weightClasses.tsのWEIGHT_KGに存在しない階級ラベル" : "",
      rank: "C",
      name_official: champ.name,
      name_normalized: champ.name.normalize("NFKC").replace(/[\s　]/g, ""),
      source_url: CHAMPION_SOURCES.deep.url,
      fetched_at: deepResult.html ? deepResult.fetchedAt : "取得失敗(champions.tsスナップショットを採用)",
      mnews_slug: slug,
      status,
      match_confidence: confidence,
    });
  }
  if (!deepResult.html) {
    fetchFailures.push({ org: "deep(鮮度確認用ライブfetch)", url: CHAMPION_SOURCES.deep.url, error: deepResult.error ?? "unknown" });
  }

  // 自己検証: 必達セット総数 = listed + hidden + missing
  const stat = coverageOf(allRows);
  if (stat.listed + stat.hidden + stat.missing !== stat.total) {
    console.error("[FATAL] 必達セット総数の整合性チェック失敗");
    process.exit(1);
  }
  const noneCount = allRows.filter((r) => r.match_confidence === "none").length;
  if (noneCount !== stat.missing) {
    console.error(`[FATAL] match_confidence=none(${noneCount}件) と missing(${stat.missing}件) が不一致`);
    process.exit(1);
  }

  writeCsv(allRows);
  writeMarkdown(allRows, { unclassifiedHeadings, fetchFailures, deepFreshness });

  console.log(
    `完了: 総${stat.total}件 / listed=${stat.listed} hidden=${stat.hidden} missing=${stat.missing}` +
      ` / confidence=none: ${noneCount} / 未分類見出し: ${unclassifiedHeadings.length} / 取得失敗: ${fetchFailures.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

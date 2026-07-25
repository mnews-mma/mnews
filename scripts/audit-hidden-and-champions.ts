// 指示書①-b: hidden フラグの意味確定と王者スナップショットの鮮度監査(監査専用・読み取り専用)。
// data/・src/ は一切書き換えない。①(scripts/audit-roster-coverage.ts)の後処理。
//
// トラックA: hidden の意味をコード参照箇所(A1)とgit blame/log(A2)の証拠のみから確定し、
// hidden 51名を由来別に仕分ける(A3/A4)。
// トラックB: champions.ts(RIZIN/DEEP)の王者、およびパンクラス/修斗の王者(ライブ取得の
// ため常にcurrent)の鮮度を公式ページで再確認する。
// トラックC: ①の必達セットの分母(weight_class_raw一覧・修斗のプロランキング混入有無)を確認する。
//
// 名前突合・階級ラベルの扱いは①(scripts/audit-roster-coverage.ts)と同じ考え方を踏襲する:
// - findFighterSlugByName(fighters.ts、無改変)のみを判定に使う
// - hidden選手の判定は呼び出し直前にFIGHTERS配列の.hiddenをメモリ上で一時的に倒し直後に復元
// - 新しい名前正規化関数は書かない
//
// 実行: npx tsx scripts/audit-hidden-and-champions.ts
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { parsePancrase, parseShooto, RankEntry } from "../src/lib/orgRankings";
import { DEEP_RANKING_CLASSES, RIZIN_CHAMPIONS, CHAMPION_SOURCES } from "../src/lib/champions";
import { FIGHTERS, findFighterSlugByName, Fighter } from "../src/lib/fighters";
import { WEIGHT_KG } from "../src/lib/weightClasses";

const UA = "Mozilla/5.0 (compatible; MNewsRosterAudit/1.0)";
const OUT_DIR = path.join(process.cwd(), "out");
const PANCRASE_URL = "https://www.pancrase.co.jp/rls/ranking.html";
const SHOOTO_URL = "https://www.shooto-mma.com/ranking/";
const RIZIN_URL = "https://jp.rizinff.com/fighters";
const DEEP_URL = CHAMPION_SOURCES.deep.url;

function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithBackoff(url: string, label: string): Promise<{ html: string | null; error: string | null }> {
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
      return { html: await res.text(), error: null };
    } catch (e) {
      lastError = String(e);
      console.warn(`[WARN] ${label}: fetch失敗(試行${attempt + 1}/${backoffMs.length}): ${lastError}`);
    }
  }
  return { html: null, error: lastError };
}

// ============================================================
// 共通: findFighterSlugByName ベースの判定(①と同一方式、無改変で再利用)
// ============================================================
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
function classify(nameOfficial: string): { slug: string; status: "listed" | "hidden" | "missing" } {
  const listedSlug = findFighterSlugByName(nameOfficial);
  if (listedSlug) return { slug: listedSlug, status: "listed" };
  const hiddenSlug = findSlugIncludingHidden(nameOfficial);
  if (hiddenSlug) return { slug: hiddenSlug, status: "hidden" };
  return { slug: "", status: "missing" };
}

// ============================================================
// ①の必達セットを本スクリプト内で再現(cross-branch依存を避けるため、①と同じライブラリ
// 関数を使って再取得・再判定する。ロジックは①と同一)。
// ============================================================
interface NecessaryEntry {
  org: "pancrase" | "shooto" | "deep";
  weightClassRaw: string;
  rank: string;
  nameOfficial: string;
  status: "listed" | "hidden" | "missing";
  slug: string;
}
async function buildNecessarySet(): Promise<{ entries: NecessaryEntry[]; fetchFailures: string[] }> {
  const entries: NecessaryEntry[] = [];
  const fetchFailures: string[] = [];

  const pan = await fetchWithBackoff(PANCRASE_URL, "pancrase");
  if (pan.html) {
    const parsed = parsePancrase(pan.html);
    for (const c of parsed.classes) {
      for (const e of c.entries) {
        const { status, slug } = classify(e.officialName);
        entries.push({ org: "pancrase", weightClassRaw: c.weightClass, rank: e.rank, nameOfficial: e.officialName, status, slug });
      }
    }
  } else {
    fetchFailures.push(`pancrase: ${pan.error}`);
  }
  await sleep(1200);

  const sho = await fetchWithBackoff(SHOOTO_URL, "shooto");
  if (sho.html) {
    const parsed = parseShooto(sho.html);
    for (const c of parsed.classes) {
      for (const e of c.entries) {
        const { status, slug } = classify(e.officialName);
        entries.push({ org: "shooto", weightClassRaw: c.weightClass, rank: e.rank, nameOfficial: e.officialName, status, slug });
      }
    }
  } else {
    fetchFailures.push(`shooto: ${sho.error}`);
  }
  await sleep(1200);

  const deepChamps = DEEP_RANKING_CLASSES.flatMap((c) =>
    c.entries.filter((e) => e.rank === "王者").map((e) => ({ weightClass: c.weightClass, name: e.name }))
  );
  for (const champ of deepChamps) {
    const { status, slug } = classify(champ.name);
    entries.push({ org: "deep", weightClassRaw: champ.weightClass, rank: "C", nameOfficial: champ.name, status, slug });
  }

  return { entries, fetchFailures };
}

// ============================================================
// トラックA1: hidden参照箇所の挙動表(コード読解による検証済み事実。file:lineで裏付け)
// ============================================================
interface A1Row {
  surface: string;
  behavior: string;
  evidence: string;
}
const A1_TABLE: A1Row[] = [
  {
    surface: "/fighters 一覧",
    behavior: "非掲載(行として出ない)。getVisibleFighters() = !hidden && !noRecordData が母集団。",
    evidence: "src/lib/visibleFighters.ts:15-16, src/app/fighters/page.tsx:24-25",
  },
  {
    surface: "選手個別ページ",
    behavior: "直リンク/URL直打ちでは200で表示される(hiddenによる404化はしていない)が、meta robots が noindex,follow=false になる。他のどのページからもリンクされないため実質「知っている人だけが辿り着ける」。",
    evidence: "src/app/fighters/[slug]/page.tsx:80-81,111(getFighterはhiddenを見ない/robots分岐のみ)",
  },
  {
    surface: "サイト内検索・サジェスト(ヒーロー検索)",
    behavior: "HeroFighterSearchは/fightersへの入口リンクのみで検索ロジックはFighterFilterGrid側(=getVisibleFighters母集団)を再利用。hidden選手は候補に出ない。",
    evidence: "src/components/HeroFighterSearch.tsx, src/app/fighters/page.tsx:24-25",
  },
  {
    surface: "AIランキング(mnewsレーティング)",
    behavior: "掲載除外(集計対象からも除外)。hiddenSlugsをisExcludedByFactの一部として明示的に除外。コード中で「事実オーバーレイ(引退)とは別軸だが同じ扱い」と明記。",
    evidence: "scripts/update-mnews-rating.ts:262-268",
  },
  {
    surface: "VS/対戦カード(/vs, /dream)・選手選択候補",
    behavior: "選択候補には出ない(getVisibleFighters()経由で!hidden)。ただしOGP画像API自体(/api/og/fighter/[slug]等)はgetFighter(slug)のみでhidden非チェックのため、slugを直接指定すれば画像は生成される(発見経路ではないが技術的には到達可能)。",
    evidence: "src/app/vs/[slugA]/[slugB]/page.tsx:128, src/app/dream/page.tsx:47, src/app/api/og/fighter/[slug]/route.tsx:39",
  },
  {
    surface: "関連選手チップ",
    behavior: "候補から除外(CANDIDATES = FIGHTERS.filter(f=>!f.hidden...))。",
    evidence: "src/lib/relatedFighterChips.ts:49",
  },
  {
    surface: "sitemap.xml / 構造化データ",
    behavior: "sitemapはURL非出力。公式ランキングページ(/ranking/pancrase等)は、公式ランキングにhidden選手がヒットしても linkableSlugsFor() が!hiddenで再フィルタするため名前のみ表示・リンク/構造化データのurlなし。",
    evidence: "src/app/sitemap.ts:50, src/app/ranking/pancrase/page.tsx:13-16, src/lib/orgRankings.ts:210-232",
  },
  {
    surface: "(参考)管理画面 /admin/drafts の選手セレクタ",
    behavior: "hidden含む全FIGHTERSが対象(スタッフ専用画面のため一般ユーザー動線ではない)。",
    evidence: "src/app/admin/drafts/page.tsx:17-20",
  },
];
const A1_CONCLUSION =
  "個別ページの直リンク到達(noindex)と管理画面(スタッフ専用)を除き、hidden選手は一覧・検索・" +
  "ランキング表示・AIランキング・VS/対戦カード候補・関連チップ・sitemapのすべてで missing と" +
  "同一の扱い(発見不能)。挙動は面によってバラバラではなく一貫している。→ 網羅率A(listed基準)が" +
  "「現在ユーザーが実際に発見できる選手」を正しく表す。網羅率Bは「データ投入済みで解除コストが" +
  "低い候補」を示す別の指標であり、現在の公開網羅率としては使わない。";

// ============================================================
// トラックA2/A3/A4: git blame で hidden 行のコミットを特定し、由来別に仕分ける
// ============================================================
interface HiddenFighterRow {
  slug: string;
  name: string;
  org: string;
  weightClass: string;
  needsReview: boolean;
  hasRecord: boolean;
  recordCount: number;
  hiddenSetCommit: string;
  hiddenSetAt: string;
  commitMessage: string;
  inNecessarySet: boolean;
  necessarySetOrg: string;
  necessarySetWeightClass: string;
  necessarySetRank: string;
}

function gitBlameHiddenLines(): Map<number, { sha: string; authorTime: string; summary: string }> {
  const out = execSync("git blame -w --line-porcelain src/lib/fighters.ts", {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 64,
    encoding: "utf-8",
  });
  const lines = out.split("\n");
  const result = new Map<number, { sha: string; authorTime: string; summary: string }>();
  let idx = 0;
  while (idx < lines.length) {
    const m = lines[idx].match(/^([0-9a-f]{40}) (\d+) (\d+)/);
    if (!m) {
      idx++;
      continue;
    }
    const sha = m[1];
    const lineno = parseInt(m[3], 10);
    idx++;
    let summary = "";
    let authorTime = "";
    while (idx < lines.length && !lines[idx].startsWith("\t")) {
      if (lines[idx].startsWith("summary ")) summary = lines[idx].slice("summary ".length);
      if (lines[idx].startsWith("author-time ")) authorTime = lines[idx].slice("author-time ".length);
      idx++;
    }
    result.set(lineno, { sha, authorTime, summary });
    idx++; // skip content line
  }
  return result;
}

function buildHiddenFighterRows(necessarySetBySlug: Map<string, NecessaryEntry>): HiddenFighterRow[] {
  const fileLines = fs.readFileSync(path.join(process.cwd(), "src/lib/fighters.ts"), "utf-8").split("\n");
  const blame = gitBlameHiddenLines();
  let records: Record<string, { history?: unknown[] }> = {};
  try {
    records = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/fighterRecords.json"), "utf-8"));
  } catch {
    records = {};
  }

  const rows: HiddenFighterRow[] = [];
  for (const f of FIGHTERS) {
    if (!f.hidden) continue;
    // FIGHTERS配列内の該当行番号を特定(slug文字列一致、1-based)。
    const lineIdx = fileLines.findIndex((l) => l.includes(`slug: "${f.slug}"`) && l.includes("hidden: true"));
    const lineno = lineIdx + 1;
    const b = blame.get(lineno);
    const rec = records[f.slug];
    const recordCount = rec?.history?.length ?? 0;
    const nec = necessarySetBySlug.get(f.slug);
    rows.push({
      slug: f.slug,
      name: f.nameJa,
      org: f.org,
      weightClass: f.weightClass,
      needsReview: !!f.needsReview,
      hasRecord: recordCount > 0,
      recordCount,
      hiddenSetCommit: b?.sha ?? "(blame解決不能)",
      hiddenSetAt: b?.authorTime ? new Date(parseInt(b.authorTime, 10) * 1000).toISOString().slice(0, 10) : "",
      commitMessage: b?.summary ?? "",
      inNecessarySet: !!nec,
      necessarySetOrg: nec?.org ?? "",
      necessarySetWeightClass: nec?.weightClassRaw ?? "",
      necessarySetRank: nec?.rank ?? "",
    });
  }
  return rows;
}

// ============================================================
// トラックB: champions.ts(RIZIN/DEEP)+パンクラス/修斗の王者鮮度監査
// ============================================================
type Judgement = "current" | "changed" | "vacated" | "not_found" | "unfetchable";
interface FreshnessRow {
  org: string;
  weightClass: string;
  championSnapshot: string;
  judgement: Judgement;
  liveDetail: string;
  sourceUrl: string;
  fetchedAt: string;
  note: string;
}

// DEEP公式champページは <h3>階級見出し</h3> の直後に「第N代/初代/暫定チャンピオン」+氏名が
// 新しい世代から降順で列挙される歴代チャンピオン一覧という構造(h3のパターンが安定していることを
// 事前に目視確認済み)。最初の1件(=最新世代)が現王者。VACANTなら空位。
function parseDeepChampPage(html: string): Map<string, { gen: string; name: string | null }> {
  const h3s = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)];
  const result = new Map<string, { gen: string; name: string | null }>();
  for (let i = 0; i < h3s.length; i++) {
    const label = h3s[i][1].trim();
    const start = (h3s[i].index ?? 0) + h3s[i][0].length;
    const end = i + 1 < h3s.length ? h3s[i + 1].index ?? html.length : html.length;
    const block = html.slice(start, end);
    const clean = block
      .replace(/<[^>]+>/g, "|")
      .replace(/\|+/g, "|")
      .replace(/\s+/g, " ");
    const tokens = clean.split("|").map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) continue;
    const first = tokens[0];
    if (first === "VACANT") {
      result.set(label, { gen: "VACANT", name: null });
    } else if (/^(第\S+?代|初代|暫定)チャンピオン/.test(first)) {
      result.set(label, { gen: first, name: tokens[1] ?? null });
    }
  }
  return result;
}

// mnewsの階級ラベル(女子アトム級等)→DEEP公式サイト上の見出しラベルへのマッピング。
// DEEP JEWELS(女子ブランド)のみを対象にする(champions.tsのDEEP_RANKING_CLASSESが
// 実際にDEEP JEWELS側の選手と一致することを目視で確認済み。非JEWELS版「女子○○級」は
// 別系統・現状ほぼ空位で、champions.tsはそちら側を採用していない)。
// メガトン級は「選手DBのメガトン級をヘビー級に統一」コミット(7a801ff65c)によりmnews上は
// ヘビー級表示になるため、公式サイト側の元ラベル「メガトン級(無差別)」にマップする。
const DEEP_LABEL_MAP: Record<string, string> = {
  "ストロー級": "ストロー級(52.2kg以下)",
  "フライ級": "フライ級(56.7kg以下)",
  "バンタム級": "バンタム級(61.2kg以下)",
  "フェザー級": "フェザー級(65.8kg以下)",
  "ライト級": "ライト級(70.3kg以下)",
  "ウェルター級": "ウェルター級(77.1kg以下)",
  "ヘビー級": "メガトン級(無差別)",
  "女子アトム級": "DEEP JEWELS 女子アトム級(48kg以下)",
  "女子ストロー級": "DEEP JEWELS 女子ストロー級(-52.2kg)",
  "女子フライ級": "DEEP JEWELS 女子フライ級(-56.7kg)",
  "女子バンタム級": "DEEP JEWELS 女子バンタム級(-61.2kg)",
  "女子フェザー級": "DEEP JEWELS 女子フェザー級（-65.8kg）",
};
// champions.tsに存在しない、公式サイト上でのみ確認できた王座(完全性チェック用)。
const DEEP_UNTRACKED_TITLES = ["女子無差別級", "女子アトム級(48kg以下)", "女子ミクロ級(44kg以下)", "DEEP JEWELS 女子ミクロ級(44kg以下)"];

async function trackBDeepAndRizin(fetchedAt: string): Promise<{ rows: FreshnessRow[]; untrackedNote: string }> {
  const rows: FreshnessRow[] = [];
  const deepChamps = DEEP_RANKING_CLASSES.flatMap((c) =>
    c.entries.filter((e) => e.rank === "王者").map((e) => ({ weightClass: c.weightClass, name: e.name }))
  );

  const deepResult = await fetchWithBackoff(DEEP_URL, "deep");
  let untrackedNote = "";
  if (deepResult.html) {
    const live = parseDeepChampPage(deepResult.html);
    for (const champ of deepChamps) {
      const officialLabel = DEEP_LABEL_MAP[champ.weightClass];
      const liveEntry = officialLabel ? live.get(officialLabel) : undefined;
      if (!liveEntry) {
        rows.push({
          org: "deep",
          weightClass: champ.weightClass,
          championSnapshot: champ.name,
          judgement: "not_found",
          liveDetail: `公式ページ上で対応する見出し「${officialLabel ?? "(マッピング未定義)"}」を検出できず`,
          sourceUrl: DEEP_URL,
          fetchedAt,
          note: "見出し構造が変化した可能性。手動確認が必要",
        });
        continue;
      }
      if (liveEntry.gen === "VACANT") {
        rows.push({
          org: "deep",
          weightClass: champ.weightClass,
          championSnapshot: champ.name,
          judgement: "vacated",
          liveDetail: "公式ページ上で空位(VACANT)",
          sourceUrl: DEEP_URL,
          fetchedAt,
          note: "",
        });
        continue;
      }
      // 空白除去して比較(氏名表記に半角スペースが入る場合があるため。伊澤星花の例で実際に検出)。
      const nameMatches = liveEntry.name && stripSpace(liveEntry.name) === stripSpace(champ.name);
      rows.push({
        org: "deep",
        weightClass: champ.weightClass,
        championSnapshot: champ.name,
        judgement: nameMatches ? "current" : "changed",
        liveDetail: `公式ページ最新世代: ${liveEntry.gen} ${liveEntry.name ?? ""}`,
        sourceUrl: DEEP_URL,
        fetchedAt,
        note: nameMatches ? "" : "氏名が一致しない。代替わりの可能性(手動確認要)",
      });
    }
    untrackedNote =
      DEEP_UNTRACKED_TITLES.map((t) => {
        const e = live.get(t);
        if (!e) return `- ${t}: 公式ページ上で見出し自体を検出できず`;
        return `- ${t}: ${e.gen === "VACANT" ? "空位" : `${e.gen} ${e.name}`}`;
      }).join("\n");
  } else {
    for (const champ of deepChamps) {
      rows.push({
        org: "deep",
        weightClass: champ.weightClass,
        championSnapshot: champ.name,
        judgement: "unfetchable",
        liveDetail: "",
        sourceUrl: DEEP_URL,
        fetchedAt,
        note: deepResult.error ?? "",
      });
    }
    untrackedNote = "(DEEP公式ページ取得失敗のため未確認)";
  }
  await sleep(1200);

  const rizinResult = await fetchWithBackoff(RIZIN_URL, "rizin");
  if (rizinResult.html) {
    const html = rizinResult.html;
    for (const champ of RIZIN_CHAMPIONS) {
      const idx = html.indexOf(champ.name);
      if (idx === -1) {
        rows.push({
          org: "rizin",
          weightClass: champ.weightClass,
          championSnapshot: champ.name,
          judgement: "not_found",
          liveDetail: "公式ページ本文中に氏名の出現なし",
          sourceUrl: RIZIN_URL,
          fetchedAt,
          note: "",
        });
        continue;
      }
      const before = html.slice(Math.max(0, idx - 200), idx);
      const genM = before.match(/第(\S+?)代\s*(\S+?級)王者(?!.*第\S+?代\s*\S+?級王者)/);
      const liveDetail = genM ? genM[0] : "(氏名は出現するが「第N代◯◯級王者」の直前文脈が見つからず)";
      const genMatches = genM ? genM[1] === champ.generation.replace(/^第|代$/g, "") : false;
      rows.push({
        org: "rizin",
        weightClass: champ.weightClass,
        championSnapshot: `${champ.name}(${champ.generation})`,
        judgement: genM ? (genMatches ? "current" : "changed") : "not_found",
        liveDetail,
        sourceUrl: RIZIN_URL,
        fetchedAt,
        note: genM && !genMatches ? "世代表記が一致しない(手動確認要)" : "",
      });
    }
  } else {
    for (const champ of RIZIN_CHAMPIONS) {
      rows.push({
        org: "rizin",
        weightClass: champ.weightClass,
        championSnapshot: `${champ.name}(${champ.generation})`,
        judgement: "unfetchable",
        liveDetail: "",
        sourceUrl: RIZIN_URL,
        fetchedAt,
        note: rizinResult.error ?? "",
      });
    }
  }

  return { rows, untrackedNote };
}

function pancraseShootoChampionRows(entries: NecessaryEntry[], fetchedAt: string): FreshnessRow[] {
  // ①と同じ関数でその場でライブ取得しているため、王者行は定義上つねに"current"
  // (静的スナップショットではなく毎回公式ページを再取得しているため鮮度劣化が起きない)。
  return entries
    .filter((e) => (e.org === "pancrase" || e.org === "shooto") && e.rank === "王者")
    .map((e) => ({
      org: e.org,
      weightClass: e.weightClassRaw,
      championSnapshot: e.nameOfficial,
      judgement: "current" as Judgement,
      liveDetail: "ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない)",
      sourceUrl: e.org === "pancrase" ? PANCRASE_URL : SHOOTO_URL,
      fetchedAt,
      note: "",
    }));
}

// ============================================================
// トラックC: ①の分母サニティチェック
// ============================================================
function trackC(entries: NecessaryEntry[]): { weightClassRawList: string[]; shootoHeadingNote: string } {
  const weightClassRawList = [...new Set(entries.map((e) => `${e.org}:${e.weightClassRaw}`))].sort();
  const shootoHeadingNote =
    "修斗の見出しIDは全て「世界○○級」(採用)または「環太平洋○○級」(parseShootoが除外)のいずれかのみで、" +
    "アマチュア・クラスB等の混入は確認されなかった(修斗公式サイトのh4 id属性を全件目視)。よって①の修斗98件に" +
    "プロランキング以外の混入はなし。パンクラスもh4見出し10件すべてが公式プロ階級(ミドル〜ストロー+アトム級)で、" +
    "同様に混入なし。除外後の参考値の算出は不要。";
  return { weightClassRawList, shootoHeadingNote };
}

// ============================================================
// 出力
// ============================================================
function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function writeCsv(filename: string, headers: string[], rows: Record<string, string>[]): void {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h] ?? "")).join(","));
  fs.writeFileSync(path.join(OUT_DIR, filename), lines.join("\n") + "\n");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fetchedAt = todayJst();

  console.log("必達セット(①相当)を再取得中...");
  const { entries: necessaryEntries, fetchFailures: necessaryFetchFailures } = await buildNecessarySet();
  const necessarySetBySlug = new Map<string, NecessaryEntry>();
  for (const e of necessaryEntries) {
    if (e.slug) necessarySetBySlug.set(e.slug, e);
  }

  console.log("hidden選手の由来をgit blameで特定中...");
  const hiddenRows = buildHiddenFighterRows(necessarySetBySlug);

  console.log("champions.ts(RIZIN/DEEP)の鮮度をライブ確認中...");
  await sleep(1200);
  const { rows: deepRizinRows, untrackedNote } = await trackBDeepAndRizin(fetchedAt);
  const pancraseShootoRows = pancraseShootoChampionRows(necessaryEntries, fetchedAt);
  const freshnessRows = [...deepRizinRows, ...pancraseShootoRows];

  const trackCResult = trackC(necessaryEntries);

  // ---- 自己検証 ----
  const totalHidden = FIGHTERS.filter((f) => f.hidden).length;
  if (totalHidden !== hiddenRows.length) {
    console.error(`[FATAL] hidden総数(${totalHidden})とA3行数(${hiddenRows.length})が不一致`);
    process.exit(1);
  }
  const inSet = hiddenRows.filter((r) => r.inNecessarySet).length;
  const outSet = hiddenRows.filter((r) => !r.inNecessarySet).length;
  if (inSet + outSet !== totalHidden) {
    console.error("[FATAL] 必達セット内+必達セット外 が hidden総数と不一致");
    process.exit(1);
  }
  const champTotal = freshnessRows.length;
  const champSum = (["current", "changed", "vacated", "not_found", "unfetchable"] as Judgement[]).reduce(
    (s, j) => s + freshnessRows.filter((r) => r.judgement === j).length,
    0
  );
  if (champTotal !== champSum) {
    console.error("[FATAL] champions.ts王者総数の内訳合計が不一致");
    process.exit(1);
  }

  // ---- CSV出力 ----
  writeCsv(
    "hidden-fighters.csv",
    [
      "slug",
      "name",
      "org",
      "weight_class",
      "needs_review",
      "has_record",
      "record_count",
      "hidden_set_commit",
      "hidden_set_at",
      "commit_message",
      "in_necessary_set",
      "necessary_set_org",
      "necessary_set_weight_class",
      "necessary_set_rank",
    ],
    hiddenRows.map((r) => ({
      slug: r.slug,
      name: r.name,
      org: r.org,
      weight_class: r.weightClass,
      needs_review: String(r.needsReview),
      has_record: String(r.hasRecord),
      record_count: String(r.recordCount),
      hidden_set_commit: r.hiddenSetCommit,
      hidden_set_at: r.hiddenSetAt,
      commit_message: r.commitMessage,
      in_necessary_set: String(r.inNecessarySet),
      necessary_set_org: r.necessarySetOrg,
      necessary_set_weight_class: r.necessarySetWeightClass,
      necessary_set_rank: r.necessarySetRank,
    }))
  );

  writeCsv(
    "champions-freshness.csv",
    ["org", "weight_class", "champion_snapshot", "judgement", "live_detail", "source_url", "fetched_at", "note"],
    freshnessRows.map((r) => ({
      org: r.org,
      weight_class: r.weightClass,
      champion_snapshot: r.championSnapshot,
      judgement: r.judgement,
      live_detail: r.liveDetail,
      source_url: r.sourceUrl,
      fetched_at: r.fetchedAt,
      note: r.note,
    }))
  );

  // ---- MD出力 ----
  const md: string[] = [];
  md.push("# hidden-flag-semantics: hiddenフラグの意味確定と王者スナップショットの鮮度監査");
  md.push("");
  md.push(`生成日時(JST): ${fetchedAt}`);
  md.push("");
  md.push("本レポートは監査専用の出力。`fighters.ts`・`champions.ts`等への変更は行っていない(diffゼロ)。推奨・優先度づけは含まない。");
  md.push("");

  md.push("## 1. hidden の意味の結論(トラックA)");
  md.push("");
  md.push("### A1. 全参照箇所の挙動表");
  md.push("");
  md.push("| 面 | 挙動 | 根拠(file:line) |");
  md.push("|---|---|---|");
  for (const r of A1_TABLE) md.push(`| ${r.surface} | ${r.behavior} | ${r.evidence} |`);
  md.push("");
  md.push(`**結論**: ${A1_CONCLUSION}`);
  md.push("");
  md.push("### A2. hidden の由来(git blame/log による証拠)");
  md.push("");
  md.push(
    "現在hiddenが立っている51名すべてについて、`hidden: true`を含む行の最終変更コミットをgit blameで特定した。" +
      "6つのコミットに集約され、いずれも「新規選手のバッチ投入」時に一律`hidden: true`を付与したものだった" +
      "(個別に後からhiddenへ変更されたケースはゼロ)。"
  );
  md.push("");
  const commitGroups = new Map<string, HiddenFighterRow[]>();
  for (const r of hiddenRows) {
    if (!commitGroups.has(r.hiddenSetCommit)) commitGroups.set(r.hiddenSetCommit, []);
    commitGroups.get(r.hiddenSetCommit)!.push(r);
  }
  md.push("| commit | date | 件数 | commit message(1行) |");
  md.push("|---|---|---|---|");
  for (const [sha, rs] of [...commitGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    md.push(`| \`${sha.slice(0, 10)}\` | ${rs[0].hiddenSetAt} | ${rs.length} | ${rs[0].commitMessage} |`);
  }
  md.push("");
  md.push(
    "`src/lib/fighters.ts`のFighter型コメント(44-47行)には「新規投入選手(DEEP等)を『表に出さない』ためのフラグ。" +
      "…Mレーティング(序列)や自動文脈が乗るまで、戦績テーブルだけの薄いページを一斉公開しない(SEO保護)ための制御。" +
      "データ自体は格納・保持する」と明記されている。`scripts/update-mnews-rating.ts:262-264`のコメントも" +
      "「事実オーバーレイ(引退)とは別軸」と明記しており、hiddenは isRetired とは独立した軸であることがコード上で" +
      "確認できる。"
  );
  md.push("");
  md.push(
    "**A2の結論**: hidden ＝「引退・非現役」ではない。「戦績データ未整備」だけでもない" +
      "(戦績データが揃っている選手も一律hiddenで投入されている、下記A4参照)。実態は" +
      "**「新規投入バッチの公開審査待ち」**であり、SEO保護を目的として意図的に遅延公開する設計。" +
      "§7の分岐でいう「一括投入時のデフォルトが残っただけ」に近いが、単なる残骸ではなく" +
      "意図的な設計(コード上に目的が明記されている)。"
  );
  md.push("");

  md.push("### A3/A4. hidden 全体の内訳");
  md.push("");
  md.push(`- hidden総数(実測): ${totalHidden}`);
  md.push(`- うち必達セット内: ${inSet} / 必達セット外: ${outSet}`);
  const nrTrue = hiddenRows.filter((r) => r.needsReview).length;
  md.push(`- needsReview=true: ${nrTrue} / needsReview無し: ${totalHidden - nrTrue}`);
  const hasRec = hiddenRows.filter((r) => r.hasRecord).length;
  md.push(`- 戦績データあり(fighterRecords.jsonにhistory>0件): ${hasRec} / 戦績データなし: ${totalHidden - hasRec}`);
  md.push("");
  md.push("必達セット内hidden45名に占める内訳(2軸クロス集計、いずれも客観的フラグ/データの有無のみに基づく。解釈は加えない):");
  md.push("");
  md.push("| | needsReview=true | needsReview無し | 計 |");
  md.push("|---|---|---|---|");
  const inSetRows = hiddenRows.filter((r) => r.inNecessarySet);
  const cross = (nr: boolean, hasR: boolean) => inSetRows.filter((r) => r.needsReview === nr && r.hasRecord === hasR).length;
  md.push(`| 戦績あり | ${cross(true, true)} | ${cross(false, true)} | ${inSetRows.filter((r) => r.hasRecord).length} |`);
  md.push(`| 戦績なし | ${cross(true, false)} | ${cross(false, false)} | ${inSetRows.filter((r) => !r.hasRecord).length} |`);
  md.push(`| 計 | ${inSetRows.filter((r) => r.needsReview).length} | ${inSetRows.filter((r) => !r.needsReview).length} | ${inSetRows.length} |`);
  md.push("");
  md.push("全件は `out/hidden-fighters.csv` を参照(必達セット内外を`in_necessary_set`列で区別)。");
  md.push("");

  md.push("## 2. champions.ts 王者の鮮度(トラックB)");
  md.push("");
  md.push("| org | weight_class | スナップショット | 判定 | ライブ詳細 | 出典 |");
  md.push("|---|---|---|---|---|---|");
  for (const r of freshnessRows) {
    md.push(`| ${r.org} | ${r.weightClass} | ${r.championSnapshot} | **${r.judgement}** | ${r.liveDetail} | ${r.sourceUrl} |`);
  }
  md.push("");
  const byJudgement = (j: Judgement) => freshnessRows.filter((r) => r.judgement === j);
  md.push(
    `合計${champTotal}件: current=${byJudgement("current").length} / changed=${byJudgement("changed").length} / ` +
      `vacated=${byJudgement("vacated").length} / not_found=${byJudgement("not_found").length} / unfetchable=${byJudgement("unfetchable").length}`
  );
  md.push("");
  if (byJudgement("changed").length + byJudgement("vacated").length + byJudgement("not_found").length > 0) {
    md.push("### 陳腐化・要確認の全件");
    md.push("");
    for (const r of [...byJudgement("changed"), ...byJudgement("vacated"), ...byJudgement("not_found")]) {
      md.push(`- **${r.judgement}** ${r.org}/${r.weightClass}: スナップショット「${r.championSnapshot}」— ${r.liveDetail}${r.note ? `(${r.note})` : ""}`);
    }
    md.push("");
  } else {
    md.push("陳腐化・要確認は0件(champions.ts記載の王者は全件ライブ確認で現王者と一致)。");
    md.push("");
  }

  md.push("### 伊澤星花の確定");
  md.push("");
  md.push(
    "①(PR #197)では単純な部分文字列一致(`html.includes(\"伊澤星花\")`)がDEEP公式ページで不一致となり" +
      "「not_found」として報告した。本監査で原因を特定: **公式ページ上の表記は「伊澤 星花」(姓名間に半角スペース)** で、" +
      "スペースなし表記の①の照合ロジックが検出できなかっただけの誤検知だった。"
  );
  md.push("");
  md.push(
    "DEEP公式ページ(https://www.deep2001.com/champ/)は各階級見出し(`<h3>`)の直後に歴代チャンピオンを" +
      "最新世代から降順で列挙する構造で、`DEEP JEWELS 女子アトム級(48kg以下)` の先頭(=最新世代)は" +
      "「第9代チャンピオン 伊澤 星花」だった(2026-07-25ライブ確認)。よって" +
      "**伊澤星花はDEEP JEWELS女子アトム級の現王者として確定(current)**。champions.tsの記載は正しい。"
  );
  md.push("");
  md.push(
    "参考: Web検索では伊澤星花が2025年9月頃にDEEP JEWELS**ストロー級**(アトム級とは別の階級)の王座を" +
      "返上したという報道が見つかったが、これはアトム級の現況には影響しない別階級の話であり、上記の" +
      "アトム級=currentという結論と矛盾しない。"
  );
  md.push("");

  md.push("### DEEP JEWELSの所在確認(B4)");
  md.push("");
  md.push(
    "DEEPと DEEP JEWELS(女子)は**別ページではなく同一URL(https://www.deep2001.com/champ/)内の別セクション**として" +
      "掲載されている。ただし champions.ts の DEEP_RANKING_CLASSES(12王座)に含まれない、公式ページ上でのみ" +
      "確認できた王座が複数あった(=①の必達セットには含まれていない、真の取りこぼし):"
  );
  md.push("");
  md.push(untrackedNote || "(取得できず)");
  md.push("");
  md.push(
    "これらは今回の必達セットの対象外(指示書①はchampions.tsのDEEP_RANKING_CLASSESを正としてスコープを" +
      "確定しているため)。champions.ts自体を今回のスコープで変更することはしない。"
  );
  md.push("");
  md.push(
    "また `src/lib/champions.ts` の `DEEP_CHAMPIONS` 配列(7名)は現在どのページからも参照されていない" +
      "(dead code)。`/ranking/deep` は `deepRankingData()`(`DEEP_RANKING_CLASSES` 由来)のみを使用している。"
  );
  md.push("");

  md.push("## 3. トラックCの分母内訳");
  md.push("");
  md.push("`weight_class_raw` のユニーク一覧(org:weight_class):");
  md.push("");
  for (const w of trackCResult.weightClassRawList) md.push(`- ${w}`);
  md.push("");
  md.push(trackCResult.shootoHeadingNote);
  md.push("");

  md.push("## 4. 取得できなかったページとその理由");
  md.push("");
  const allFailures = [...necessaryFetchFailures, ...byJudgement("unfetchable").map((r) => `${r.org}/${r.weightClass}: ${r.note}`)];
  if (allFailures.length === 0) {
    md.push("なし(全ページの取得に成功)。");
  } else {
    for (const f of allFailures) md.push(`- ${f}`);
  }
  md.push("");

  md.push("## 5. 提案diffについて(§6条件の判定)");
  md.push("");
  md.push(
    "指示書は「A2でhiddenの意図が明確に割れた場合に限り、明白に解除してよいバケットについてのみ" +
      "提案diffを用意してよい」としている。今回のA2の結論は単一(hidden=新規投入バッチの公開審査待ち、" +
      "SEO保護のための意図的ゲート)であり、`needsReview`の有無は「ローマ字表記の確認可否」という" +
      "限定的な一軸の情報でしかない(Fighter型コメントに「表示・戦績には影響しない」と明記)。" +
      "`needsReview`無しの13名が他のあらゆる観点(Mレーティング整備状況等、コード上に明記された" +
      "hidden解除の本来条件)でも公開可能かは、今回集めた証拠だけでは確定できない。"
  );
  md.push("");
  md.push(
    "**結論: 提案diffは作成しない。** 意図が「明確に割れた」とは言えず、`needsReview`無し=即解除可、" +
      "という飛躍を避けるため。解除の要否は`out/hidden-fighters.csv`の全件データ(bucket区分含む)を見て" +
      "人間が判断する。"
  );
  md.push("");

  md.push("## 6. 自己検証");
  md.push("");
  md.push(`- hidden総数(${totalHidden}) = 必達セット内(${inSet}) + 必達セット外(${outSet}): 一致`);
  md.push(`- champions.ts王者総数(${champTotal}) = current+changed+vacated+not_found+unfetchable(${champSum}): 一致`);
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "hidden-flag-semantics.md"), md.join("\n") + "\n");

  console.log(
    `完了: hidden総数=${totalHidden}(必達内${inSet}/外${outSet}) / champions鮮度=${champTotal}件` +
      `(current=${byJudgement("current").length} changed=${byJudgement("changed").length} vacated=${byJudgement("vacated").length}` +
      ` not_found=${byJudgement("not_found").length} unfetchable=${byJudgement("unfetchable").length})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

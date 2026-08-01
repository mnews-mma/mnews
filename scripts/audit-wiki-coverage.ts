/**
 * 指示書W: 全登録選手のja.wikipedia記事 悉皆調査
 *
 * 読み取り専用。src/・data/ には一切書き込まない
 * (src/lib/fighters.ts の FIGHTERS と data/fighterRecords.json を読むだけ)。
 *
 * 【レート制限回避】個別ページ(action=parse&page=X)を1件ずつ叩かない。
 * すべて action=query の titles=(パイプ区切り最大50件)バッチ、または
 * list=categorymembers のバッチで取得する。
 *
 * 【名寄せ】fighters.ts の private 正規化ヘルパー(stripDecorativeNickname/
 * toKatakana/toHiragana/normNameForMatch)をそのまま逐語コピーして使う
 * (findFighterSlugByNameと同じ正規化基準。新しい基準を作らない)。
 *
 * 実行: npx tsx scripts/audit-wiki-coverage.ts
 */
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";

const OUT_DIR = path.join(process.cwd(), "out");
const UA = "MNewsBot/1.0 (https://www.mnews.jp; contact: mnews-mma)";
const API = "https://ja.wikipedia.org/w/api.php";

// ============================================================
// fighters.ts の private 正規化ヘルパーの逐語コピー(findFighterSlugByNameと同一)
// ============================================================
function stripDecorativeNickname(s: string): string {
  return s
    .replace(/["“”][^"“”]*["“”]/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .trim();
}
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function normNameForMatch(s: string): string {
  return s.replace(/[\s　]/g, "");
}
function buildCandidates(name: string): Set<string> {
  const candidates = new Set<string>();
  const cleaned = stripDecorativeNickname(name);
  for (const raw of [name, cleaned]) {
    const n = normNameForMatch(raw);
    if (!n) continue;
    candidates.add(n);
    candidates.add(toKatakana(n));
    candidates.add(toHiragana(n));
  }
  return candidates;
}

// ============================================================
// 汎用ユーティリティ
// ============================================================
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

async function apiGet(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params }).toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// ============================================================
// Phase 1/2: titles= バッチでの存在確認(リダイレクト解決込み)
// ============================================================
interface TitleCheckResult {
  requested: string;
  exists: boolean;
  resolvedTitle: string | null;
  redirectedFrom: string | null;
  missing: boolean;
  invalid: boolean;
}

async function checkTitlesBatch(titles: string[]): Promise<Map<string, TitleCheckResult>> {
  const out = new Map<string, TitleCheckResult>();
  const batches = chunk([...new Set(titles)], 50);
  for (const batch of batches) {
    const json = await apiGet({
      action: "query",
      titles: batch.join("|"),
      redirects: "1",
      prop: "info",
    });
    const q = json?.query ?? {};
    // normalized: 入力表記 -> 正規化後表記
    const normMap = new Map<string, string>();
    for (const n of q.normalized ?? []) normMap.set(n.from, n.to);
    // redirects: 正規化後表記 -> リダイレクト先
    const redirMap = new Map<string, string>();
    for (const r of q.redirects ?? []) redirMap.set(r.from, r.to);
    // pages: 最終解決後のタイトルごとの実在情報
    const pageByTitle = new Map<string, any>();
    for (const p of q.pages ?? []) pageByTitle.set(p.title, p);

    for (const raw of batch) {
      const normalized = normMap.get(raw) ?? raw;
      const redirected = redirMap.get(normalized);
      const finalTitle = redirected ?? normalized;
      const page = pageByTitle.get(finalTitle);
      out.set(raw, {
        requested: raw,
        exists: !!page && !page.missing && !page.invalid,
        resolvedTitle: page && !page.missing && !page.invalid ? finalTitle : null,
        redirectedFrom: redirected ? normalized : null,
        missing: !page || !!page.missing,
        invalid: !!page?.invalid,
      });
    }
    await sleep(250);
  }
  return out;
}

// ============================================================
// Phase 3: 内容確認(wikitext本文をバッチ取得。個別ページ叩きではなくtitles=バッチ)
// ============================================================
interface ContentInfo {
  title: string;
  wikitext: string | null;
}
async function fetchContentBatch(titles: string[]): Promise<Map<string, ContentInfo>> {
  const out = new Map<string, ContentInfo>();
  // wikitext本文をまとめて取るため titles バッチを控えめ(20件)にする
  const batches = chunk([...new Set(titles)], 20);
  for (const batch of batches) {
    const json = await apiGet({
      action: "query",
      titles: batch.join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    });
    const q = json?.query ?? {};
    for (const p of q.pages ?? []) {
      const wikitext = p.revisions?.[0]?.slots?.main?.content ?? null;
      out.set(p.title, { title: p.title, wikitext });
    }
    await sleep(300);
  }
  return out;
}

const FIGHTER_CONTENT_RE = /総合格闘家|総合格闘技選手|MMA選手|キックボクサー|prizefighter|mixed martial art/i;
const FIGHTER_CATEGORY_RE = /\[\[Category:[^\]]*(格闘家|総合格闘技|キックボクシング選手)[^\]]*\]\]/;
const RECORDBOX_RE = /\{\{MMA record start\}\}|\{\{MMA[- ]?recordbox/i;

function looksLikeFighterArticle(wikitext: string): boolean {
  return FIGHTER_CONTENT_RE.test(wikitext) || FIGHTER_CATEGORY_RE.test(wikitext);
}
function hasRecordbox(wikitext: string): boolean {
  return RECORDBOX_RE.test(wikitext);
}

// ============================================================
// Phase 4: categorymembers バッチ(C判定選手の検出漏れ疑いチェック用)
// ============================================================
async function fetchCategoryMembers(category: string): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  for (let page = 0; page < 40; page++) {
    const params: Record<string, string> = {
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmlimit: "500",
      cmnamespace: "0",
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const json = await apiGet(params);
    const members = json?.query?.categorymembers ?? [];
    for (const m of members) titles.push(m.title);
    cmcontinue = json?.continue?.cmcontinue;
    if (!cmcontinue) break;
    await sleep(250);
  }
  return titles;
}

// ============================================================
// メイン処理
// ============================================================
async function main() {
  const recordsPath = path.join(process.cwd(), "data", "fighterRecords.json");
  const records: Record<string, { live?: boolean; noRecordData?: boolean }> = JSON.parse(
    fs.readFileSync(recordsPath, "utf8")
  );

  // デバッグ用: --limit=N で先頭N件だけを対象にする(本番実行時は指定しない)
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
  const FIGHTERS_TARGET = LIMIT ? FIGHTERS.slice(0, LIMIT) : FIGHTERS;

  const listed = FIGHTERS_TARGET.filter((f) => !f.hidden);
  const hidden = FIGHTERS_TARGET.filter((f) => f.hidden);
  console.log(`W1: FIGHTERS総数=${FIGHTERS_TARGET.length} (listed=${listed.length} / hidden=${hidden.length})`);

  // --- Round 1: 既定タイトル(wikiTitleJa ?? nameJaのスペース除去) ---
  const primaryTitle = (f: Fighter) => f.wikiTitleJa ?? f.nameJa.replace(/[\s　]/g, "");
  const round1Titles = FIGHTERS_TARGET.map(primaryTitle);
  console.log(`Round1: 既定タイトル ${new Set(round1Titles).size}件(重複除く)をバッチ照会中...`);
  const round1 = await checkTitlesBatch(round1Titles);

  // --- Round 2 候補生成: 全選手分(Round1が別人記事に化けているケースの保険として、
  //     Round1が存在した選手についても代替候補を用意しておく) ---
  const round2Candidates = new Map<string, string[]>(); // slug -> candidate titles
  for (const f of FIGHTERS_TARGET) {
    const cands = new Set<string>();
    const cleaned = normNameForMatch(stripDecorativeNickname(f.nameJa));
    if (cleaned && cleaned !== primaryTitle(f)) cands.add(cleaned);
    for (const a of f.aliases ?? []) cands.add(normNameForMatch(a));
    cands.add(`${normNameForMatch(f.nameJa)} (格闘家)`);
    cands.add(`${normNameForMatch(f.nameJa)} (総合格闘家)`);
    round2Candidates.set(f.slug, [...cands].filter(Boolean));
  }
  const round2AllTitles = [...round2Candidates.values()].flat();
  console.log(`Round2: 代替候補 ${new Set(round2AllTitles).size}件をバッチ照会中...`);
  const round2 = await checkTitlesBatch(round2AllTitles);

  // --- 選手ごとの候補列(Round1優先、Round2は代替候補の並び順)を作る ---
  interface Candidate {
    hitTitle: string;
    resolvedTitle: string;
    round: 1 | 2;
    viaAlias: boolean;
    viaDisambig: boolean;
  }
  const candidateListBySlug = new Map<string, Candidate[]>();
  for (const f of FIGHTERS_TARGET) {
    const list: Candidate[] = [];
    const r1 = round1.get(primaryTitle(f));
    if (r1?.exists) {
      list.push({ hitTitle: primaryTitle(f), resolvedTitle: r1.resolvedTitle!, round: 1, viaAlias: false, viaDisambig: false });
    }
    for (const c of round2Candidates.get(f.slug) ?? []) {
      const r2 = round2.get(c);
      if (r2?.exists) {
        list.push({
          hitTitle: c,
          resolvedTitle: r2.resolvedTitle!,
          round: 2,
          viaAlias: (f.aliases ?? []).some((a) => normNameForMatch(a) === c),
          viaDisambig: /\(格闘家\)|\(総合格闘家\)$/.test(c),
        });
      }
    }
    candidateListBySlug.set(f.slug, list);
  }
  const totalCandidateHits = [...candidateListBySlug.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `候補あり選手: ${[...candidateListBySlug.values()].filter((l) => l.length > 0).length}件 / 候補総数(延べ): ${totalCandidateHits}件`
  );

  // --- Phase 3: 全候補記事の内容確認(格闘家記事か・recordbox有無)を先にまとめて取得 ---
  const allResolvedTitles = [...new Set([...candidateListBySlug.values()].flat().map((c) => c.resolvedTitle))];
  console.log(`内容確認バッチ取得中(${allResolvedTitles.length}記事)...`);
  const content = await fetchContentBatch(allResolvedTitles);

  // --- 選手ごとに、候補を順に内容確認して最初に「格闘家記事」と確認できたものを採用する ---
  interface FighterHit {
    fighter: Fighter;
    hitTitle: string;
    resolvedTitle: string;
    round: 1 | 2;
    viaAlias: boolean;
    viaDisambig: boolean;
  }
  const hits: FighterHit[] = [];
  const misses: Fighter[] = [];
  const rejectedCandidates: { fighter: Fighter; hitTitle: string; resolvedTitle: string }[] = [];
  for (const f of FIGHTERS_TARGET) {
    const list = candidateListBySlug.get(f.slug) ?? [];
    let found: FighterHit | null = null;
    for (const c of list) {
      const wikitext = content.get(c.resolvedTitle)?.wikitext ?? null;
      if (wikitext && looksLikeFighterArticle(wikitext)) {
        found = { fighter: f, ...c };
        break;
      }
      rejectedCandidates.push({ fighter: f, hitTitle: c.hitTitle, resolvedTitle: c.resolvedTitle });
    }
    if (found) hits.push(found);
    else misses.push(f);
  }
  console.log(`ヒット(内容確認済み): ${hits.length}件 / 未ヒット: ${misses.length}件`);

  type Bucket = "A" | "B" | "C";
  interface ClassRow {
    slug: string;
    nameJa: string;
    resolvedTitle: string | null;
    bucket: Bucket;
    reason: string;
    note: string;
  }
  const classRows: ClassRow[] = [];

  // hits は既に内容確認(looksLikeFighterArticle)を通過済みの候補のみ。
  for (const h of hits) {
    const c = content.get(h.resolvedTitle);
    const wikitext = c!.wikitext!;
    const rec = records[h.fighter.slug];
    const used = !!rec && rec.live === true && !rec.noRecordData;
    const boxPresent = hasRecordbox(wikitext);

    if (used && boxPresent) {
      classRows.push({
        slug: h.fighter.slug,
        nameJa: h.fighter.nameJa,
        resolvedTitle: h.resolvedTitle,
        bucket: "A",
        reason: "使用中",
        note: `round${h.round}`,
      });
      continue;
    }

    // B: 記事はあるが未使用。原因分類。
    let reason: string;
    if (!rec) reason = "バッチ未実行";
    else if (!boxPresent) reason = "recordbox無し";
    else if (h.viaDisambig) reason = "曖昧さ回避付き";
    else if (h.viaAlias) reason = "引用符付きニックネーム入り";
    else if (h.round === 2) reason = "タイトル不一致";
    else reason = "その他";

    classRows.push({
      slug: h.fighter.slug,
      nameJa: h.fighter.nameJa,
      resolvedTitle: h.resolvedTitle,
      bucket: "B",
      reason,
      note: `round${h.round}${h.viaAlias ? " viaAlias" : ""}${h.viaDisambig ? " viaDisambig" : ""} live=${rec?.live} noRecordData=${rec?.noRecordData}`,
    });
  }

  for (const f of misses) {
    const tried = rejectedCandidates.filter((r) => r.fighter.slug === f.slug);
    if (tried.length > 0) {
      // タイトル候補は見つかったが、内容確認で格闘家記事と確認できず却下(同名別人の疑い)。
      classRows.push({
        slug: f.slug,
        nameJa: f.nameJa,
        resolvedTitle: null,
        bucket: "C",
        reason: "同名別人疑い(内容未確認・全候補却下)",
        note: tried.map((t) => `hitTitle="${t.hitTitle}"->resolvedTitle="${t.resolvedTitle}"`).join("; "),
      });
    } else {
      classRows.push({ slug: f.slug, nameJa: f.nameJa, resolvedTitle: null, bucket: "C", reason: "未検出", note: "" });
    }
  }

  const aRows = classRows.filter((r) => r.bucket === "A");
  const bRows = classRows.filter((r) => r.bucket === "B");
  const cRows = classRows.filter((r) => r.bucket === "C");
  console.log(`\n分類結果: A=${aRows.length} / B=${bRows.length} / C=${cRows.length} (total=${classRows.length})`);

  // --- W4: Cのうち検出漏れ疑いをcategorymembersで補強チェック ---
  const CATEGORIES = [
    "Category:日本の総合格闘家",
    "Category:日本の女子総合格闘家",
    "Category:総合格闘家",
  ];
  console.log(`\nW4: categorymembers補強チェック中(${CATEGORIES.join(", ")})...`);
  const categoryTitleSet = new Set<string>();
  for (const cat of CATEGORIES) {
    const members = await fetchCategoryMembers(cat);
    console.log(`  ${cat}: ${members.length}件`);
    for (const m of members) categoryTitleSet.add(m);
  }
  const categoryNormSet = new Set([...categoryTitleSet].map((t) => normNameForMatch(t)));
  // カテゴリ内タイトルの候補集合(かな/カナ変換込み)も構築し、Cリストの選手名と突合する
  const categoryCandidateIndex = new Map<string, string>(); // normalized candidate -> original title
  for (const t of categoryTitleSet) {
    for (const c of buildCandidates(t)) {
      if (!categoryCandidateIndex.has(c)) categoryCandidateIndex.set(c, t);
    }
  }

  const suspectedMissed: { slug: string; nameJa: string; categoryTitle: string }[] = [];
  for (const row of cRows) {
    const f = FIGHTERS_TARGET.find((ff) => ff.slug === row.slug)!;
    const cands = new Set<string>([...buildCandidates(f.nameJa), ...(f.aliases ?? []).flatMap((a) => [...buildCandidates(a)])]);
    for (const c of cands) {
      const hitTitle = categoryCandidateIndex.get(c);
      if (hitTitle) {
        suspectedMissed.push({ slug: f.slug, nameJa: f.nameJa, categoryTitle: hitTitle });
        break;
      }
    }
  }
  console.log(`W4: 検出漏れ疑い ${suspectedMissed.length}件`);

  // ============================================================
  // 出力
  // ============================================================
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // B一覧CSV
  const bCsvLines = ["slug,nameJa,wikiTitle,reason,note"];
  for (const r of bRows) {
    bCsvLines.push(
      [r.slug, r.nameJa, r.resolvedTitle ?? "", r.reason, r.note].map(csvEscape).join(",")
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "wiki-coverage-B.csv"), bCsvLines.join("\n") + "\n");

  // C一覧CSV(同名別人疑いも含む・未検出理由付き)
  const cCsvLines = ["slug,nameJa,reason,note"];
  for (const r of cRows) {
    cCsvLines.push([r.slug, r.nameJa, r.reason, r.note].map(csvEscape).join(","));
  }
  fs.writeFileSync(path.join(OUT_DIR, "wiki-coverage-C.csv"), cCsvLines.join("\n") + "\n");

  // W4 検出漏れ疑いCSV
  const w4CsvLines = ["slug,nameJa,categoryTitle"];
  for (const r of suspectedMissed) {
    w4CsvLines.push([r.slug, r.nameJa, r.categoryTitle].map(csvEscape).join(","));
  }
  fs.writeFileSync(path.join(OUT_DIR, "wiki-coverage-W4-suspected-missed.csv"), w4CsvLines.join("\n") + "\n");

  // A一覧CSV(参考)
  const aCsvLines = ["slug,nameJa,wikiTitle"];
  for (const r of aRows) {
    aCsvLines.push([r.slug, r.nameJa, r.resolvedTitle ?? ""].map(csvEscape).join(","));
  }
  fs.writeFileSync(path.join(OUT_DIR, "wiki-coverage-A.csv"), aCsvLines.join("\n") + "\n");

  // サマリーMarkdown
  const md: string[] = [];
  md.push("# 指示書W: 全登録選手のja.wikipedia記事 悉皆調査");
  md.push("");
  md.push(`## W1: 対象母集団`);
  md.push(`- FIGHTERS総数: ${FIGHTERS_TARGET.length}件(listed=${listed.length} / hidden=${hidden.length})`);
  md.push("");
  md.push(`## W2: 分類結果`);
  md.push(`- A(記事あり・使用中): ${aRows.length}件`);
  md.push(`- B(記事あり・未使用): ${bRows.length}件`);
  md.push(`- C(記事なし・同名別人疑い含む): ${cRows.length}件`);
  md.push("");
  const bReasonCount = new Map<string, number>();
  for (const r of bRows) bReasonCount.set(r.reason, (bReasonCount.get(r.reason) ?? 0) + 1);
  md.push(`## W3: B(記事あり・未使用)の原因分類内訳`);
  for (const [reason, count] of bReasonCount) md.push(`- ${reason}: ${count}件`);
  md.push("");
  md.push(`停止条件(B>50件)判定: ${bRows.length > 50 ? "★該当・停止" : "非該当・続行可"}`);
  md.push("");
  md.push(`## W4: Cのうち検出漏れ疑い`);
  md.push(`- categorymembers突合による検出漏れ疑い: ${suspectedMissed.length}件`);
  md.push(`停止条件(20件超)判定: ${suspectedMissed.length > 20 ? "★該当・停止" : "非該当"}`);
  md.push("");
  md.push("詳細はCSV参照: out/wiki-coverage-{A,B,C,W4-suspected-missed}.csv");
  fs.writeFileSync(path.join(OUT_DIR, "wiki-coverage-summary.md"), md.join("\n") + "\n");

  console.log("\n完了。out/wiki-coverage-summary.md および各CSVを出力しました。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

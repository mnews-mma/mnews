// 指示a): DEEP全237大会の生HTMLで「第N試合」の番号が無い見出し
// (メインイベント/セミファイナル/コ・メインイベント等)を持つ大会を洗い出す。
// read-only: data/deepRecords.jsonは再生成せず、DEEP公式サイトから都度fetchして
// 生HTML側の見出し構造だけを調べる(このファイルは一時調査用、build-deep-records.ts
// やdeepScraper.tsは一切変更しない)。
//
// scopeToResultsSection()・NON_RESULT_SECTION_MARKERSはsrc/lib/mnewsRating/
// deepScraper.tsの非exportロジックをread-only調査のためにここへ複製したもの
// (#372マージ待ちのためdeepScraper.ts自体には手を入れない)。
import * as fs from "fs";
import * as path from "path";
import { stripTags } from "../src/lib/mnewsRating/deepScraper";

interface DeepRecordsEvent {
  eventName: string;
  date: string;
  sourceUrl: string;
  bouts: { fighterAName: string | null; fighterBName: string | null; headingText: string }[];
}

const UA = "Mozilla/5.0 (compatible; mnews-audit/1.0)";
const FETCH_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

const NON_RESULT_SECTION_MARKERS = ["【計量結果】", "計量結果", "前日計量", "計量の模様", "計量の様子", "【大会概要】", "PAST EVENT", "CONTACT"];

function scopeToResultsSection(bodyClean: string): string {
  const startIdx = bodyClean.indexOf("【試合結果】");
  if (startIdx === -1) return bodyClean;
  let endIdx = bodyClean.length;
  for (const marker of NON_RESULT_SECTION_MARKERS) {
    const idx = bodyClean.indexOf(marker, startIdx);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return bodyClean.slice(startIdx, endIdx);
}

// 見出しラベル候補(表記ゆれ含む)。「第N試合」の直後に連結して現れる場合は
// 番号付きとみなし対象外(DEEP JEWELS 31方式)。単独で現れる場合のみ「番号なし
// メインイベント系見出し」の候補として扱う。
const HEADINGLESS_LABEL_RE = /(コ・?メインイベント|セミファイナル|セミファイル|メインイベント)/g;
const NUMBERED_HEADING_RE = /第\s*\d+試合/g;

interface Finding {
  eventName: string;
  date: string;
  sourceUrl: string;
  label: string;
  snippet: string;
  matchedInExtracted: boolean;
}

// 選手名候補の抽出(厳密な選手名抽出が目的ではなく、抽出済みbout一覧との
// 突合用ヒント)。mark+名前(ジム)型(F1/F2/Group2/Group4)と、N.名前(ジム)VS
// 名前(ジム)型(Group1)の両方に対応する。「(」「（」の直前までの文字列を拾い、
// 先頭のmark記号・通し番号(「9.」等)・「VS」を除去する。
function extractNearbyNames(snippet: string): string[] {
  const names: string[] = [];
  const re = /([^\n|()（）]{1,24})[(（]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet))) {
    let raw = m[1];
    raw = raw.replace(/^[\s/／]*[○●〇◯△▲×⚪⚫]?[\s/／]*/, "");
    raw = raw.replace(/^\d+[.．]\s*/, "");
    raw = raw.replace(/^VS\s*/i, "");
    raw = raw.trim();
    if (raw.length >= 2) names.push(raw);
  }
  return names;
}

// nameが抽出済みbout側のfighterA/BNameと(前後の空白・記号ズレを許容して)
// 実質同一と言えるかを緩めに判定する。厳密一致だけだと表記ゆれ(引用符・
// スペース混入等)で本来抽出済みの試合を誤って「欠落」と分類してしまうため。
function looksSameFighter(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

// 取得済み生HTMLのローカルキャッシュ(read-only調査・後続のb)修正作業で同じ237大会を
// 何度も再走する前提のため、公式サイトへの再取得を避けられるようにする)。
// out/配下は.gitignoreで除外済みのためリポジトリには含まれない(ローカル専用)。
const CACHE_DIR = path.join(__dirname, "..", "out", "deep-html-cache");

function cacheFileFor(ev: DeepRecordsEvent): string {
  const slug = ev.sourceUrl.replace(/\/$/, "").split("/").pop() || ev.eventName;
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${ev.date}_${safeSlug}.html`);
}

async function fetchHtmlCached(ev: DeepRecordsEvent): Promise<string> {
  const cachePath = cacheFileFor(ev);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, "utf-8");
  }
  await sleep(1200);
  const html = await fetchHtml(ev.sourceUrl);
  fs.writeFileSync(cachePath, html);
  return html;
}

async function main() {
  const dataPath = path.join(__dirname, "..", "data", "deepRecords.json");
  const events: DeepRecordsEvent[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log(`対象: ${events.length}大会`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`HTMLキャッシュ先: ${CACHE_DIR}`);

  const findings: Finding[] = [];
  const eventsWithHeadinglessLabel: string[] = [];
  const errors: { eventName: string; url: string; error: string }[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const cachePath = cacheFileFor(ev);
    const cached = fs.existsSync(cachePath);
    process.stderr.write(`[${i + 1}/${events.length}] ${ev.eventName} (${ev.date})${cached ? " (cache)" : ""}\n`);
    let html: string;
    try {
      html = await fetchHtmlCached(ev);
    } catch (err) {
      errors.push({ eventName: ev.eventName, url: ev.sourceUrl, error: String(err) });
      continue;
    }
    const clean = stripTags(html);
    const scoped = scopeToResultsSection(clean);

    let hasHeadingless = false;
    let m: RegExpExecArray | null;
    HEADINGLESS_LABEL_RE.lastIndex = 0;
    while ((m = HEADINGLESS_LABEL_RE.exec(scoped))) {
      const label = m[0];
      const idx = m.index;
      // 直前30文字以内に「第N試合」が無ければ「番号なし」とみなす。
      const before = scoped.slice(Math.max(0, idx - 30), idx);
      NUMBERED_HEADING_RE.lastIndex = 0;
      const isNumbered = NUMBERED_HEADING_RE.test(before) && /第\s*\d+試合\s*$/.test(before);
      if (isNumbered) continue;

      const snippet = scoped.slice(idx, idx + 200);
      const names = extractNearbyNames(snippet);
      const matchedInExtracted = names.some((n) =>
        ev.bouts.some((b) => looksSameFighter(b.fighterAName || "", n) || looksSameFighter(b.fighterBName || "", n))
      );

      hasHeadingless = true;
      findings.push({
        eventName: ev.eventName,
        date: ev.date,
        sourceUrl: ev.sourceUrl,
        label,
        snippet,
        matchedInExtracted,
      });
    }
    if (hasHeadingless) eventsWithHeadinglessLabel.push(ev.eventName);
  }

  const droppedFindingsRaw = findings.filter((f) => !f.matchedInExtracted);
  // 同一大会・同一見出しラベル(メインイベント/セミファイナル等)が、結果ブロックと
  // プレビュー/選手プロフィールブロックの両方に現れ、同じ試合を二重に検出する
  // ケースがある(実例: DEEP JEWELS 44のメインイベント、結果ブロック+プレビュー
  // ブロックの2箇所で「パク·シユン vs 伊澤星花」が言及)。(大会, ラベル)単位で
  // 重複排除し、bout件数の水増しを防ぐ(先に見つかった1件を代表として残す)。
  const seenEventLabel = new Set<string>();
  const droppedFindings = droppedFindingsRaw.filter((f) => {
    const key = `${f.eventName}::${f.label}`;
    if (seenEventLabel.has(key)) return false;
    seenEventLabel.add(key);
    return true;
  });
  const droppedEvents = new Set(droppedFindings.map((f) => f.eventName));

  console.log(`\n=== 集計 ===`);
  console.log(`番号なしメインイベント系見出しを持つ大会: ${eventsWithHeadinglessLabel.length}件`);
  console.log(`うち、対応するboutが抽出結果に無い(欠落確定)大会: ${droppedEvents.size}件`);
  console.log(`欠落確定bout件数(大会×見出しラベル単位で重複排除済み): ${droppedFindings.length}件`);
  console.log(`(重複排除前の生ヒット数: ${droppedFindingsRaw.length}件)`);
  console.log(`fetch失敗: ${errors.length}件`);

  const outDir = path.join(__dirname, "..", "out");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "deep-headingless-mainevent-audit.md");
  const lines: string[] = [];
  lines.push("# DEEP全237大会: 「第N試合」番号なしメインイベント系見出し監査(read-only、指示a)");
  lines.push("");
  lines.push(`対象大会数: ${events.length}`);
  lines.push(`番号なしメインイベント系見出しを持つ大会: ${eventsWithHeadinglessLabel.length}件`);
  lines.push(`うち欠落確定(対応boutが抽出結果に無い)大会: ${droppedEvents.size}件`);
  lines.push(`欠落確定bout件数(大会×見出しラベル単位で重複排除済み): ${droppedFindings.length}件(重複排除前: ${droppedFindingsRaw.length}件)`);
  lines.push(`fetch失敗: ${errors.length}件`);
  lines.push("");
  lines.push("## 欠落確定一覧");
  lines.push("");
  lines.push("| 大会 | 日付 | 見出し | スニペット |");
  lines.push("|---|---|---|---|");
  for (const f of droppedFindings) {
    lines.push(`| ${f.eventName} | ${f.date} | ${f.label} | ${f.snippet.slice(0, 120).replace(/\|/g, "/")} |`);
  }
  lines.push("");
  lines.push("## 番号なし見出しはあるが抽出済み(誤検知or別経路で救済されているケース)");
  lines.push("");
  const matchedFindings = findings.filter((f) => f.matchedInExtracted);
  lines.push("| 大会 | 日付 | 見出し | スニペット |");
  lines.push("|---|---|---|---|");
  for (const f of matchedFindings) {
    lines.push(`| ${f.eventName} | ${f.date} | ${f.label} | ${f.snippet.slice(0, 120).replace(/\|/g, "/")} |`);
  }
  if (errors.length > 0) {
    lines.push("");
    lines.push("## fetch失敗");
    lines.push("");
    for (const e of errors) lines.push(`- ${e.eventName} (${e.url}): ${e.error}`);
  }
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  console.log(`\nレポート: ${reportPath}`);

  const jsonPath = path.join(outDir, "deep-headingless-mainevent-audit.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ findings, errors }, null, 2) + "\n");
  console.log(`JSON: ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

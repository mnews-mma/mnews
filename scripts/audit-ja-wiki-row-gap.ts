/**
 * src/lib/feeds/wikipedia.ts の日本語版パーサ(parseJaFightHistory)が
 * 戦績表の行を取りこぼしていないかの悉皆監査。
 *
 * 読み取り専用。src/・data/ には一切書き込まない。修正もしない。
 *
 * 対象: data/fighterRecords.json に history を持つ全選手(history.length > 0)。
 * 各選手の ja.wikipedia 記事(wikiTitleJa ?? nameJaのスペース除去)を取得し、
 * 3つの数値を比較する:
 *   - sectionRowCount: 記事の「総合格闘技」節(アマチュア節除去後)にある
 *     {{Fight-cont|...}} 行の生カウント(= 記事本文の戦績表行数)
 *   - parserKeptNow: parseJaFightHistory() が実際に返す件数(= 現在の
 *     wikipedia.tsパーサが「有効な1試合」として採用した件数)
 *   - dbHistoryLen: data/fighterRecords.json に格納済みのhistory件数
 *     (parserKeptNowに加えて、未来日付除去・RECORD_OVERRIDESが乗った後の値)
 *
 * sectionRowCount - parserKeptNow が「パーサの行取りこぼし」、
 * parserKeptNow - dbHistoryLen は将来日付フィルタ/手動補正による差分
 * (パーサのバグではない)。両方を出し、原因の切り分けができるようにする。
 *
 * 実行: npx tsx scripts/audit-ja-wiki-row-gap.ts
 */
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { parseJaFightHistory } from "../src/lib/feeds/wikipedia";

const OUT_DIR = path.join(process.cwd(), "out");
const UA = "MNewsBot/1.0 (https://www.mnews.jp; contact: mnews-mma)";
const API = "https://ja.wikipedia.org/w/api.php";
const REQUEST_INTERVAL_MS = 700;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
function csvEscape(v: string | number | boolean): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function fetchWikitext(title: string): Promise<string | null> {
  const url = `${API}?action=parse&page=${encodeURIComponent(
    title
  )}&redirects=true&prop=wikitext&format=json&formatversion=2`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      return json?.parse?.wikitext ?? null;
    } catch (e) {
      if (attempt === 2) return null;
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

// ============================================================
// wikipedia.ts の private ロジックの逐語コピー(行数カウント専用・読み取り専用)。
// 本体は一切変更しない。ここでのコピーは監査のためだけに使う。
// ============================================================
const INVISIBLE_CONTROL_CHARS = /[​-‏‪-‮⁦-⁩﻿]/g;
function stripInvisible(s: string): string {
  return s.replace(INVISIBLE_CONTROL_CHARS, "");
}

function stripHeadingAmateurSections(text: string): string {
  const amateurHeadingRe = /={2,4}[^=\n]*アマチュア[^=\n]*={2,4}/g;
  const allHeadingsRe = /={2,4}[^=\n]+={2,4}/g;
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = amateurHeadingRe.exec(text))) {
    result += text.slice(cursor, m.index);
    allHeadingsRe.lastIndex = m.index + m[0].length;
    const next = allHeadingsRe.exec(text);
    cursor = next ? next.index : text.length;
    amateurHeadingRe.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}
function stripBoldAmateurPseudoSections(text: string): string {
  const boldHeadingRe = /'''[^'\n]*アマチュア[^'\n]*'''/g;
  const fightEndRe = /\{\{Fight-end\}\}/g;
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = boldHeadingRe.exec(text))) {
    if (m.index < cursor) continue;
    result += text.slice(cursor, m.index);
    fightEndRe.lastIndex = m.index + m[0].length;
    const next = fightEndRe.exec(text);
    cursor = next ? next.index + next[0].length : text.length;
    boldHeadingRe.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}
function stripAmateurSections(text: string): string {
  return stripBoldAmateurPseudoSections(stripHeadingAmateurSections(text));
}

function findMmaSections(wikitext: string): string[] {
  // extractMmaSection() は「最初に{{Fight-cont}}を含む節」だけを返して停止する。
  // ここでは「総合格闘技を含みアマチュアを含まない見出し」に該当する節を
  // *すべて* 集めて返す(複数節に分割されているケースの検出用)。
  const headingRe = /={2,4}(?![^=\n]*アマチュア)[^=\n]*総合格闘技[^=\n]*={2,4}/g;
  const allHeadingsRe = /={2,4}[^=\n]+={2,4}/g;
  const sections: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(wikitext))) {
    const afterStart = m.index + m[0].length;
    allHeadingsRe.lastIndex = afterStart;
    const next = allHeadingsRe.exec(wikitext);
    const section = wikitext.slice(afterStart, next ? next.index : undefined);
    sections.push(stripAmateurSections(section));
  }
  return sections;
}

function splitTemplateParams(content: string): string[] {
  const parts: string[] = [];
  let bracketDepth = 0;
  let braceDepth = 0;
  let current = "";
  for (let i = 0; i < content.length; i++) {
    const ch2 = content.slice(i, i + 2);
    if (ch2 === "[[") {
      bracketDepth++;
      current += ch2;
      i++;
      continue;
    }
    if (ch2 === "]]") {
      bracketDepth--;
      current += ch2;
      i++;
      continue;
    }
    if (ch2 === "{{") {
      braceDepth++;
      current += ch2;
      i++;
      continue;
    }
    if (ch2 === "}}") {
      braceDepth--;
      current += ch2;
      i++;
      continue;
    }
    if (content[i] === "|" && bracketDepth === 0 && braceDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += content[i];
  }
  parts.push(current);
  return parts;
}

function extractFightContBlocks(scope: string): string[] {
  const marker = "{{Fight-cont|";
  const blocks: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = scope.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 1;
    let i = start + 2;
    while (i < scope.length && depth > 0) {
      if (scope.startsWith("{{", i)) {
        depth++;
        i += 2;
      } else if (scope.startsWith("}}", i)) {
        depth--;
        i += 2;
      } else {
        i++;
      }
    }
    blocks.push(scope.slice(start + marker.length, i - 2));
    searchFrom = i;
  }
  return blocks;
}

function cleanWikiMarkup(s: string): string {
  return stripInvisible(s)
    .replace(/\{\{small\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{small\|?\}\}/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{仮リンク\|([^|{}]+)\|[^{}]*\}\}/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/^align=center\|/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NC_KEYWORD_RE = /無効試合|ノーコンテスト|no contest|\bnc\b/i;
const CANCELLED_NOT_NC_RE = /試合中止|不成立/;
function jaResult(marker: string, methodText: string): "win" | "loss" | "draw" | "nc" | null {
  const m = stripInvisible(marker).trim();
  if (m === "○" || m === "〇") return "win";
  if (m === "×" || m === "✕" || m === "✗") return "loss";
  if (m === "△") return "draw";
  const isDashMarker = m === "－" || m === "-" || m === "―" || m === "ー";
  const cleanMethod = stripInvisible(methodText);
  if (isDashMarker && CANCELLED_NOT_NC_RE.test(cleanMethod)) return null;
  if (isDashMarker && NC_KEYWORD_RE.test(cleanMethod)) return "nc";
  return null;
}
function parseJaDate(raw: string): string {
  const m = cleanWikiMarkup(raw).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type DropReason =
  | "parts<5"
  | "marker-blank-future" // 空欄マーカー=未開催の予定戦。仕様通りの除外であり取りこぼしではない
  | "marker-unrecognized" // 空欄以外の未知マーカー(記号違い等)。要調査
  | "opponent-empty"
  | "date-empty";

interface DroppedRow {
  reason: DropReason;
  markerRaw: string;
  opponentRaw: string;
  eventRaw: string;
  dateRaw: string;
  hasRefFootnote: boolean;
  hasImageOrFlagIcon: boolean;
}

function analyzeSectionBlocks(sectionScope: string): { total: number; dropped: DroppedRow[] } {
  const blocks = extractFightContBlocks(sectionScope);
  const dropped: DroppedRow[] = [];
  for (const rawContent of blocks) {
    const hasRefFootnote = /<ref[^>]*>/i.test(rawContent);
    const hasImageOrFlagIcon = /\{\{flagicon|\{\{他言語版|\[\[ファイル:|\[\[File:/i.test(rawContent);
    const content = stripInvisible(
      rawContent.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    );
    const parts = splitTemplateParams(content).map((p) => p.trim());
    if (parts.length < 5) {
      dropped.push({
        reason: "parts<5",
        markerRaw: parts[0] ?? "",
        opponentRaw: parts[1] ?? "",
        eventRaw: parts[3] ?? "",
        dateRaw: parts[4] ?? "",
        hasRefFootnote,
        hasImageOrFlagIcon,
      });
      continue;
    }
    const result = jaResult(parts[0], parts[2]);
    if (!result) {
      dropped.push({
        reason: stripInvisible(parts[0]).trim() === "" ? "marker-blank-future" : "marker-unrecognized",
        markerRaw: parts[0],
        opponentRaw: parts[1],
        eventRaw: parts[3],
        dateRaw: parts[4],
        hasRefFootnote,
        hasImageOrFlagIcon,
      });
      continue;
    }
    const opponent = cleanWikiMarkup(parts[1]);
    const date = parseJaDate(parts[4]);
    if (!opponent) {
      dropped.push({
        reason: "opponent-empty",
        markerRaw: parts[0],
        opponentRaw: parts[1],
        eventRaw: parts[3],
        dateRaw: parts[4],
        hasRefFootnote,
        hasImageOrFlagIcon,
      });
      continue;
    }
    if (!date) {
      dropped.push({
        reason: "date-empty",
        markerRaw: parts[0],
        opponentRaw: parts[1],
        eventRaw: parts[3],
        dateRaw: parts[4],
        hasRefFootnote,
        hasImageOrFlagIcon,
      });
      continue;
    }
  }
  return { total: blocks.length, dropped };
}

// ============================================================
// メイン処理
// ============================================================
interface Row {
  slug: string;
  nameJa: string;
  jaTitle: string;
  articleFound: boolean;
  qualifyingSections: number;
  sectionRowCount: number; // 採用された節(最初にFight-contを含む節)の生行数
  otherSectionsRowCount: number; // それ以外の「総合格闘技」節に埋もれている行数(複数表分割の疑い)
  parserKeptNow: number; // 現在のparseJaFightHistory()が返す件数
  dbHistoryLen: number; // data/fighterRecords.json のhistory件数
  parserDropCount: number; // sectionRowCount - parserKeptNow (真のパーサ取りこぼし)
  pipelineDiff: number; // parserKeptNow - dbHistoryLen (将来日付除去/補正。パーサのバグではない)
  dropReasons: string; // 取りこぼし行の理由内訳
  note: string;
}

async function main() {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "fighterRecords.json"), "utf8");
  const fighterRecords: Record<string, { history: any[] }> = JSON.parse(raw);
  const fighterBySlug = new Map<string, Fighter>(FIGHTERS.map((f) => [f.slug, f]));

  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  let targets = Object.entries(fighterRecords).filter(([, v]) => (v.history?.length ?? 0) > 0);
  if (slugArg) targets = targets.filter(([slug]) => slug === slugArg);
  if (limitArg) targets = targets.slice(0, Number(limitArg));
  console.log(`[audit] history>0 の選手: ${targets.length}人`);

  const rows: Row[] = [];
  const droppedRowsAll: Array<{ slug: string; nameJa: string } & DroppedRow> = [];
  let checked = 0;
  let notFoundOnJa = 0;

  for (const [slug, entry] of targets) {
    checked++;
    const fighter = fighterBySlug.get(slug);
    if (!fighter) {
      rows.push({
        slug,
        nameJa: slug,
        jaTitle: "",
        articleFound: false,
        qualifyingSections: 0,
        sectionRowCount: 0,
        otherSectionsRowCount: 0,
        parserKeptNow: 0,
        dbHistoryLen: entry.history.length,
        parserDropCount: 0,
        pipelineDiff: 0,
        dropReasons: "",
        note: "FIGHTERSに見つからずスキップ",
      });
      continue;
    }
    const jaTitle = fighter.wikiTitleJa ?? fighter.nameJa.replace(/\s/g, "");
    const wikitext = await fetchWikitext(jaTitle);
    await sleep(REQUEST_INTERVAL_MS);

    if (!wikitext) {
      notFoundOnJa++;
      rows.push({
        slug,
        nameJa: fighter.nameJa,
        jaTitle,
        articleFound: false,
        qualifyingSections: 0,
        sectionRowCount: 0,
        otherSectionsRowCount: 0,
        parserKeptNow: 0,
        dbHistoryLen: entry.history.length,
        parserDropCount: 0,
        pipelineDiff: 0,
        dropReasons: "",
        note: "ja.wikipedia記事が取得できず(en版由来の可能性、または記事名不一致)",
      });
      continue;
    }

    const sections = findMmaSections(wikitext);
    const sectionAnalyses = sections.map((s) => analyzeSectionBlocks(s));
    // extractMmaSection()と同じ選び方: 最初に{{Fight-cont}}を含む節を採用
    const usedIdx = sectionAnalyses.findIndex((a) => a.total > 0);
    const used = usedIdx === -1 ? null : sectionAnalyses[usedIdx];
    const sectionRowCount = used ? used.total : 0;
    const otherSectionsRowCount = sectionAnalyses
      .filter((_, i) => i !== usedIdx)
      .reduce((sum, a) => sum + a.total, 0);

    const parserKeptNow = parseJaFightHistory(wikitext).length;
    const dbHistoryLen = entry.history.length;
    const parserDropCount = sectionRowCount - parserKeptNow;
    const pipelineDiff = parserKeptNow - dbHistoryLen;

    if (used && parserDropCount > 0) {
      for (const d of used.dropped) {
        droppedRowsAll.push({ slug, nameJa: fighter.nameJa, ...d });
      }
    }

    const dropReasonCounts: Record<string, number> = {};
    if (used) {
      for (const d of used.dropped) {
        dropReasonCounts[d.reason] = (dropReasonCounts[d.reason] ?? 0) + 1;
      }
    }
    const dropReasons = Object.entries(dropReasonCounts)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");

    let note = "";
    if (sections.length === 0) note = "「総合格闘技」節が見つからず(en版由来の可能性)";
    else if (!used) note = "節はあるがFight-cont行が0件";
    else if (sectionAnalyses.filter((a) => a.total > 0).length > 1)
      note = `複数節にFight-cont行が分散(採用節=1件目、他節に${otherSectionsRowCount}行埋没)`;

    rows.push({
      slug,
      nameJa: fighter.nameJa,
      jaTitle,
      articleFound: true,
      qualifyingSections: sections.length,
      sectionRowCount,
      otherSectionsRowCount,
      parserKeptNow,
      dbHistoryLen,
      parserDropCount,
      pipelineDiff,
      dropReasons,
      note,
    });

    if (checked % 25 === 0) {
      console.log(`[audit] ${checked}/${targets.length} 件処理済み`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ---- CSV: 全選手 ----
  const csvHeader = [
    "slug",
    "nameJa",
    "jaTitle",
    "articleFound",
    "qualifyingSections",
    "sectionRowCount",
    "otherSectionsRowCount",
    "parserKeptNow",
    "dbHistoryLen",
    "parserDropCount",
    "pipelineDiff",
    "dropReasons",
    "note",
  ];
  const csvLines = [csvHeader.join(",")];
  for (const r of rows) {
    csvLines.push(
      [
        r.slug,
        r.nameJa,
        r.jaTitle,
        r.articleFound,
        r.qualifyingSections,
        r.sectionRowCount,
        r.otherSectionsRowCount,
        r.parserKeptNow,
        r.dbHistoryLen,
        r.parserDropCount,
        r.pipelineDiff,
        r.dropReasons,
        r.note,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "ja-wiki-row-gap-audit.csv"), csvLines.join("\n") + "\n");

  // ---- CSV: 取りこぼし行の詳細 ----
  const droppedHeader = [
    "slug",
    "nameJa",
    "reason",
    "markerRaw",
    "opponentRaw",
    "eventRaw",
    "dateRaw",
    "hasRefFootnote",
    "hasImageOrFlagIcon",
  ];
  const droppedLines = [droppedHeader.join(",")];
  for (const d of droppedRowsAll) {
    droppedLines.push(
      [
        d.slug,
        d.nameJa,
        d.reason,
        d.markerRaw,
        d.opponentRaw,
        d.eventRaw,
        d.dateRaw,
        d.hasRefFootnote,
        d.hasImageOrFlagIcon,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "ja-wiki-row-gap-dropped-rows.csv"), droppedLines.join("\n") + "\n");

  // ---- サマリレポート ----
  // ja.wikipediaに実際に戦績表({{Fight-cont}}節)がある選手だけを比較対象にする。
  // sectionRowCount===0 は「ja記事に該当節が無い(en.wikipedia由来など)」ことを意味し、
  // これをdbHistoryLenと突き合わせると常に大きな負の差(記事側に節が無いだけ)が出て
  // 実際のパーサ問題と無関係なノイズになるため、headline集計からは除外する。
  const jaSourced = rows.filter((r) => r.articleFound && r.sectionRowCount > 0);
  const outOfJaScope = rows.filter((r) => !r.articleFound || r.sectionRowCount === 0);
  const withParserDrop = jaSourced.filter((r) => r.parserDropCount > 0);
  const totalParserDropRows = withParserDrop.reduce((s, r) => s + r.parserDropCount, 0);
  const withArticleVsDbGap = jaSourced.filter((r) => r.sectionRowCount !== r.dbHistoryLen);
  const totalArticleVsDbGapRows = withArticleVsDbGap.reduce(
    (s, r) => s + (r.sectionRowCount - r.dbHistoryLen),
    0
  );
  const multiSectionFighters = jaSourced.filter((r) => r.otherSectionsRowCount > 0);

  const reasonTally: Record<string, number> = {};
  for (const d of droppedRowsAll) reasonTally[d.reason] = (reasonTally[d.reason] ?? 0) + 1;
  const withFootnote = droppedRowsAll.filter((d) => d.hasRefFootnote).length;
  const withImageFlag = droppedRowsAll.filter((d) => d.hasImageOrFlagIcon).length;
  // marker-blank-future(空欄マーカー=未開催の予定戦)は仕様通りの除外であり取りこぼしではない。
  // それ以外の理由だけを「真の異常」として別集計する。
  const genuineAnomalyRows = droppedRowsAll.filter((d) => d.reason !== "marker-blank-future");
  const genuineAnomalySlugs = new Set(genuineAnomalyRows.map((d) => d.slug));
  const totalArticleVsDbGapRowsPositiveOnly = withArticleVsDbGap
    .filter((r) => r.sectionRowCount - r.dbHistoryLen > 0)
    .reduce((s, r) => s + (r.sectionRowCount - r.dbHistoryLen), 0);

  const summary = `# ja.wikipedia戦績表 行取りこぼし監査

読み取り専用調査。\`src/lib/feeds/wikipedia.ts\` の \`parseJaFightHistory\` が
ja.wikipedia記事の戦績表(\`{{Fight-cont}}\`テーブル)の行を取りこぼしていないかを、
\`data/fighterRecords.json\` に history を持つ全選手で確認した。修正は行っていない。

## 集計(必須3項目)

比較対象は「ja.wikipediaに実際に戦績表({{Fight-cont}}節)がある選手」のみ
(${jaSourced.length}人。en.wikipedia由来など該当節が無い選手${outOfJaScope.length}人は対象外 — 後述)。

- **総選手数(ja.wikipediaに戦績表がある選手)**: ${jaSourced.length}人
  (参考: history>0の全選手は${targets.length}人)
- **記事本文の行数とhistoryの行数に差があった選手数**: ${withArticleVsDbGap.length}人
- **総欠落行数(記事の戦績表行数 > dbのhistory行数の選手だけを合算。正味の欠落行のみ)**: ${totalArticleVsDbGapRowsPositiveOnly}行
  (参考: 符号付き合計は${totalArticleVsDbGapRows}行。db側の方が多い選手=将来戦の反映漏れ等が相殺している)

## 内訳(原因切り分け)

上記の「差」は2種類の異なる原因が混ざっているため、切り分けた:

- **パーサの取りこぼし** (sectionRowCount − parserKeptNow > 0の選手): ${withParserDrop.length}人 / 合計${totalParserDropRows}行
  — \`parseJaFightHistory()\`自体が「有効な1試合」と認識できず捨てている行。これが本来の意味での「取りこぼし」。
  - うち \`marker-blank-future\`(空欄マーカー=未開催の予定戦。仕様通りの除外で取りこぼしではない): ${reasonTally["marker-blank-future"] ?? 0}行
  - **真の異常(空欄未開催を除いた実質的な取りこぼし)**: ${genuineAnomalySlugs.size}人 / ${genuineAnomalyRows.length}行
- **パイプライン由来の差**(parserKeptNow − dbHistoryLen ≠ 0の選手、パーサのバグではない):
  未来日付フィルタ(\`scripts/update-fighter-records.ts\`)・\`RECORD_OVERRIDES\`(既知の個別補正)による増減。
- **「総合格闘技」節がFight-cont行を含む形で複数に分割されている選手**: ${multiSectionFighters.length}人
  (\`extractMmaSection\`は最初に該当した節しか見ないため、後続の節の試合が丸ごと欠落する可能性がある)

## ja.wikipedia対象外(${outOfJaScope.length}人。集計から除外)

en.wikipedia由来で戦績を組み立てている選手、またはja記事はあるが「総合格闘技」節にFight-cont行が
無い選手。これらは記事側に比較対象となる戦績表そのものが無いため、上記の集計には含めていない
(含めるとdb側の行数がそのまま「欠落」としてカウントされてしまい、実際のパーサ問題と無関係な
ノイズになる)。

- ja記事自体が見つからない: ${notFoundOnJa}人
- ja記事はあるが「総合格闘技」節/Fight-cont行が無い: ${outOfJaScope.length - notFoundOnJa}人

## 取りこぼし行(パーサレベル)の理由内訳

${Object.entries(reasonTally)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `- ${k}: ${v}行`)
  .join("\n")}

- うち \`<ref>\`脚注付き行: ${withFootnote}行
- うち 画像/国旗アイコン(\`{{flagicon}}\`等)混入行: ${withImageFlag}行

## 上位: パーサ取りこぼし行数が多い選手

${withParserDrop
  .sort((a, b) => b.parserDropCount - a.parserDropCount)
  .slice(0, 20)
  .map((r) => `- ${r.nameJa}(${r.slug}): 節内${r.sectionRowCount}行 → パーサ採用${r.parserKeptNow}行 (取りこぼし${r.parserDropCount}行) ${r.dropReasons}`)
  .join("\n")}

## 上位: 記事行数とdbのhistory行数の差が大きい選手(全原因込み)

${withArticleVsDbGap
  .sort((a, b) => Math.abs(b.sectionRowCount - b.dbHistoryLen) - Math.abs(a.sectionRowCount - a.dbHistoryLen))
  .slice(0, 20)
  .map(
    (r) =>
      `- ${r.nameJa}(${r.slug}): 記事${r.sectionRowCount}行 / db history${r.dbHistoryLen}行 (差${r.sectionRowCount - r.dbHistoryLen}) [パーサ採用${r.parserKeptNow}] ${r.note}`
  )
  .join("\n")}

## 出力ファイル

- \`out/ja-wiki-row-gap-audit.csv\`: 選手ごとの全指標
- \`out/ja-wiki-row-gap-dropped-rows.csv\`: パーサが取りこぼした行1件ごとの生データ(marker/opponent/event/date)

## 既知の留意点

- 比較対象は「ja.wikipedia記事」限定(指示どおり)。en.wikipedia由来で戦績を組み立てている選手は対象外(\`articleFound=false\`または\`sectionRowCount=0\`でnoteに記載)。
- \`sectionRowCount\`は「採用された節(最初にFight-contを含む節)」の生行数。アマチュア節は既存ロジック通り除去済み(意図的な除外であり取りこぼしではない)。
- \`dbHistoryLen\`との差には、パーサ由来ではない差分(未来日付フィルタ・RECORD_OVERRIDES)が混ざる。真のパーサバグは上記「パーサの取りこぼし」の${withParserDrop.length}人/${totalParserDropRows}行を見ること。
`;

  fs.writeFileSync(path.join(OUT_DIR, "ja-wiki-row-gap-summary.md"), summary);

  console.log("\n=== 完了 ===");
  console.log(`総選手数(history>0): ${targets.length}`);
  console.log(`うちja.wikipediaに戦績表がある選手: ${jaSourced.length}`);
  console.log(`記事vsdb差があった選手数: ${withArticleVsDbGap.length}`);
  console.log(`総欠落行数(正味・正の差分のみ): ${totalArticleVsDbGapRowsPositiveOnly}`);
  console.log(`(参考)真のパーサ取りこぼし: ${withParserDrop.length}人 / ${totalParserDropRows}行`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

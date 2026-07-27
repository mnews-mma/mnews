// DEEP結果アーカイブ 遡り深度調査(監査専用・読み取り専用)。
// data/・src/ は一切書き換えない。指示書②(PR #201・scripts/audit-deep-event-roster.ts)・
// ②-b(PR #203)の3段構成(アーカイブ一覧→個別結果ページ→本文正規表現抽出)をそのまま再利用する。
// 変更点は「直近12ヶ月フィルタを外して最古まで遡る」ことのみ。新しい正規表現・新しい
// アーカイブ辿り方は実装しない。名前照合は必ずfindFighterSlugByName経由のみ。
//
// 事前調査で確認済み: https://www.deep2001.com/result/ はページネーション・無限スクロール
// 一切なしの単一静的ページで、2002年(DEEPフューチャーキングトーナメント2002)まで全件が
// 1ページにリストされている(curl取得と実ブラウザでのスクロール後DOM取得で件数が一致)。
// そのため②のS1(アーカイブ一覧取得)はコード変更不要で、候補件数の上限(MAX_EVENTS_CANDIDATE)
// のみ実測値を超えないよう十分大きくした上で、万一想定外にページネーションが存在した場合の
// 防御として/page/リンクの検出チェックを追加する(検出したら停止条件として報告し処理を打ち切る、
// 新しいアーカイブ辿り方は実装しない)。
//
// 遡るほどDEEP公式サイトの本文フォーマットが古い形式(例: 「▼第N試合 階級 時間|勝者(ジム)|決着方法|敗者(ジム)」
// のように勝敗記号+選手名+ジムの並びと決着方法の位置が現行フォーマットと異なる)に変わることを
// 事前確認済み。この差異を吸収する新しい正規表現は書かない。既存のBOUT_REで抽出できない場合は
// 「抽出失敗」として来歴(第N試合見出し数・勝敗記号の有無)ごと全件列挙し、黙って0件成功扱いにしない。
//
// 実行: npx tsx scripts/audit-deep-archive-depth.ts
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";

const UA = "Mozilla/5.0 (compatible; MNewsArchiveDepthAudit/1.0)";
const OUT_DIR = path.join(process.cwd(), "out");
const CACHE_DIR = path.join(os.tmpdir(), "mnews-deep-archive-depth-cache");
const RESULT_ARCHIVE_URL = "https://www.deep2001.com/result/";
// 事前のcurl調査(2026-07-27時点)でユニークリンク数は287〜308件だった。想定外の増加を検知する
// ための安全弁であり、実データを黙って切り捨てる意図の上限ではない(超過時は打ち切らず警告のみ)。
const CANDIDATE_SAFETY_WARN = 500;

function todayJst(): Date {
  return new Date(Date.now() + 9 * 3600_000);
}
function todayJstStr(): string {
  return todayJst().toISOString().slice(0, 10);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// キャッシュ付きfetch(②と同一実装)
// ============================================================
function cacheKeyFor(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex");
}
async function fetchCached(url: string, label: string): Promise<{ html: string | null; error: string | null; fromCache: boolean }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `${cacheKeyFor(url)}.html`);
  if (fs.existsSync(cacheFile)) {
    return { html: fs.readFileSync(cacheFile, "utf-8"), error: null, fromCache: true };
  }
  const backoffMs = [0, 2000, 5000, 10000];
  let lastError = "";
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (attempt > 0) await sleep(backoffMs[attempt]);
    await sleep(1200);
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
      const html = await res.text();
      fs.writeFileSync(cacheFile, html);
      return { html, error: null, fromCache: false };
    } catch (e) {
      lastError = String(e);
      console.warn(`[WARN] ${label}: fetch失敗(試行${attempt + 1}/${backoffMs.length}): ${lastError}`);
    }
  }
  return { html: null, error: lastError, fromCache: false };
}

function stripTags(html: string): string {
  let clean = html.replace(/<[^>]+>/g, "|");
  clean = clean.replace(/\|+/g, "|");
  clean = clean.replace(/\s+/g, " ");
  return clean;
}

// ============================================================
// S1: /result/ アーカイブからイベント一覧を発見する(②と同一実装。12ヶ月フィルタなし)
// ============================================================
interface ArchiveLink {
  title: string;
  url: string;
}
function extractArchiveLinks(html: string): ArchiveLink[] {
  const linkRe = /<a[^>]+href="(https:\/\/www\.deep2001\.com\/[^"]+\/)"[^>]*>\s*([^<]{5,150})\s*<\/a>/g;
  const navTitles = new Set(["SCHEDULE", "RESULT", "CHAMPION", "FIGHTER", "PAST EVENT", "CONTACT", "ALL RESULT", "ALL NEWS >>"]);
  const seen = new Set<string>();
  const links: ArchiveLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const url = m[1];
    const title = m[2].trim();
    if (navTitles.has(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title, url });
  }
  return links;
}
// 防御: 想定外にページネーションが存在しないか(/page/N/ リンクの有無)を確認する。
// 見つかった場合は新しいアーカイブ辿り方の実装が必要と判断し、処理を打ち切って報告する
// (指示書の停止条件「アーカイブの辿り方に新規実装が必要と判断した場合」に該当)。
function detectPagination(html: string): string[] {
  const re = /href="(https:\/\/www\.deep2001\.com\/result\/page\/\d+\/?[^"]*)"/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1]);
  return [...found];
}

// ============================================================
// ブランド分類(②と同一。DEEP公式の名乗りに従う。旧イベント名(フューチャーキングトーナメント等)は
// otherに分類され、下記「ブランド分類が既知パターンに一致しなかったイベント」として黙らず列挙する)
// ============================================================
type Brand =
  | "DEEP IMPACT"
  | "DEEP JEWELS"
  | "DEEP TOKYO IMPACT"
  | "DEEP OSAKA IMPACT"
  | "DEEP NAGOYA IMPACT"
  | "DEEP HAMAMATSU IMPACT"
  | "DEEP FIGHT CHALLENGE"
  | "other";
function classifyBrand(title: string): { brand: Brand; excludedNonMma: boolean; excludeReason: string } {
  const t = title.toUpperCase();
  if (/KICK/.test(t)) return { brand: "other", excludedNonMma: true, excludeReason: "立ち技(KICK)イベントのためMMA対象外" };
  if (/^DEEP\s+JEWELS/.test(t)) return { brand: "DEEP JEWELS", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+TOKYO\s+IMPACT/.test(t)) return { brand: "DEEP TOKYO IMPACT", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+OSAKA\s+IMPACT/.test(t)) return { brand: "DEEP OSAKA IMPACT", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+NAGOYA\s+IMPACT/.test(t)) return { brand: "DEEP NAGOYA IMPACT", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+HAMAMATSU\s+IMPACT/.test(t)) return { brand: "DEEP HAMAMATSU IMPACT", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+FIGHT\s+CHALLENGE/.test(t)) return { brand: "DEEP FIGHT CHALLENGE", excludedNonMma: false, excludeReason: "" };
  if (/^DEEP\s+\d+\s+IMPACT/.test(t)) return { brand: "DEEP IMPACT", excludedNonMma: false, excludeReason: "" };
  return { brand: "other", excludedNonMma: false, excludeReason: "" };
}

// ページ本文から開催日(YYYY年M月D日)を抽出する(②と同一正規表現。新しい日付形式は追加しない)。
function extractEventDate(bodyClean: string): string | null {
  const m = bodyClean.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
// 現行正規表現で日付が抽出できなかった場合の診断用(集計には一切使わない・報告専用)。
// 「パースできない日付は捨てずにrawのまま列挙する」ための最小限の生テキスト抜粋であり、
// これ自体を新しい日付パーサーとして計算に組み込むことはしない。
function extractRawDateSnippet(bodyClean: string): string | null {
  const m = bodyClean.match(/.{0,15}(平成|令和|昭和)\d{1,2}年\d{1,2}月\d{1,2}日.{0,10}/);
  if (m) return m[0].trim();
  const m2 = bodyClean.match(/.{0,15}\d{4}[./]\d{1,2}[./]\d{1,2}.{0,10}/);
  if (m2) return m2[0].trim();
  return null;
}

// ============================================================
// S2: 結果ページから出場者を抽出する(②のBOUT_REをそのまま再利用。新規正規表現は追加しない)
// ============================================================
const BOUT_RE =
  /第(\d+)試合\s*\|?\s*([^|]+?)\|\s*([●○〇△])\s*([^|(（]+)[(（]([^)）]*)[)）]\|\s*([●○〇△])\s*([^|(（]+)[(（]([^)）]*)[)）]\|\s*([^|]+)/g;

interface RawBout {
  boutIndexOnPage: number;
  boutLabel: string;
  weightClassRaw: string;
  fighterARaw: string;
  fighterAGym: string;
  fighterAMark: string;
  fighterBRaw: string;
  fighterBGym: string;
  fighterBMark: string;
  method: string;
}
function extractBouts(bodyClean: string): RawBout[] {
  const bouts: RawBout[] = [];
  let m: RegExpExecArray | null;
  BOUT_RE.lastIndex = 0;
  let idx = 0;
  while ((m = BOUT_RE.exec(bodyClean))) {
    idx++;
    bouts.push({
      boutIndexOnPage: idx,
      boutLabel: `第${m[1]}試合`,
      weightClassRaw: m[2].trim(),
      fighterAMark: m[3],
      fighterARaw: m[4].trim(),
      fighterAGym: m[5].trim(),
      fighterBMark: m[6],
      fighterBRaw: m[7].trim(),
      fighterBGym: m[8].trim(),
      method: m[9].trim(),
    });
  }
  return bouts;
}

const BOUT_HEADER_RE = /第(\d+)試合/g;
const MARK_RE = /[●○〇△]/;
type ContentState = "result" | "partial_result" | "card_only" | "undetermined";
function classifyContentState(bodyClean: string, resolvedBoutCount: number): { state: ContentState; headerCount: number } {
  const headerMatches = bodyClean.match(BOUT_HEADER_RE);
  const headerCount = headerMatches ? new Set(headerMatches).size : 0;
  if (headerCount === 0) return { state: "undetermined", headerCount: 0 };
  if (resolvedBoutCount === 0) return { state: "card_only", headerCount };
  if (resolvedBoutCount >= headerCount) return { state: "result", headerCount };
  return { state: "partial_result", headerCount };
}
type HeldState = "held" | "unheld" | "date_unknown";
function classifyHeld(eventDate: string, fetchedAt: string): HeldState {
  if (!eventDate) return "date_unknown";
  return eventDate < fetchedAt ? "held" : "unheld";
}

// ============================================================
// S3: fighters.ts と突合(findFighterSlugByNameのみ使用。①-bと同じhidden一時解除方式)
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
type Status = "listed" | "hidden" | "missing";
function classify(nameRaw: string): { slug: string; status: Status } {
  const listedSlug = findFighterSlugByName(nameRaw);
  if (listedSlug) return { slug: listedSlug, status: "listed" };
  const hiddenSlug = findSlugIncludingHidden(nameRaw);
  if (hiddenSlug) return { slug: hiddenSlug, status: "hidden" };
  return { slug: "", status: "missing" };
}

function markToResult(mark: string): "win" | "loss" | "draw" | "unknown" {
  if (mark === "○" || mark === "〇") return "win";
  if (mark === "●") return "loss";
  if (mark === "△") return "draw";
  return "unknown";
}

// ============================================================
// メイン処理
// ============================================================
interface EventRow {
  eventId: string;
  eventName: string;
  brand: Brand;
  eventDate: string; // YYYY-MM-DD、不明なら空
  year: string; // eventDateの年、不明なら空
  resultUrl: string;
  fetchedAt: string;
  heldState: HeldState;
  contentState: ContentState;
  headerBoutCount: number;
  boutCount: number;
  parseOutcome: "ok" | "old_format_suspected" | "no_marks_found" | "unfetchable" | "future_unheld";
  parseNote: string;
  rawDateSnippet: string; // 日付が現行正規表現で取れなかった場合の生テキスト抜粋(診断専用)
}
interface ParticipantRow {
  eventId: string;
  brand: Brand;
  eventDate: string;
  year: string;
  nameRaw: string;
  nameNormalized: string;
  mnewsSlug: string;
  status: Status;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fetchedAt = todayJstStr();

  console.log(`DEEP公式 /result/ アーカイブを取得中(キャッシュ: ${CACHE_DIR})...`);
  const archiveResult = await fetchCached(RESULT_ARCHIVE_URL, "deep-result-archive");
  if (!archiveResult.html) {
    console.error(`[FATAL] /result/ アーカイブの取得に失敗: ${archiveResult.error}`);
    process.exit(1);
  }

  const paginationLinks = detectPagination(archiveResult.html);
  if (paginationLinks.length > 0) {
    console.error(
      `[STOP] /result/ にページネーションリンクを検出した(${paginationLinks.length}件)。` +
        "事前調査時点(2026-07-27)には存在しなかった構造変化であり、これを辿るには新規実装が必要となるため" +
        "指示書の停止条件に該当する。処理を打ち切る。"
    );
    fs.writeFileSync(
      path.join(OUT_DIR, "deep-archive-depth.md"),
      `# deep-archive-depth: 停止\n\n` +
        `/result/ にページネーションリンクを検出したため、事前確認済みの「単一ページで全件网羅」という前提が崩れた。\n` +
        `新しいアーカイブ辿り方の実装が必要と判断し、指示書の停止条件により処理を打ち切った。\n\n` +
        `検出リンク:\n${paginationLinks.map((l) => `- ${l}`).join("\n")}\n`
    );
    process.exit(1);
  }

  const allLinks = extractArchiveLinks(archiveResult.html);
  console.log(`アーカイブから${allLinks.length}件のリンクを検出(期間制限なし・全件処理)。`);
  if (allLinks.length > CANDIDATE_SAFETY_WARN) {
    console.warn(`[WARN] リンク数が安全弁(${CANDIDATE_SAFETY_WARN})を超過。想定外の増加(処理は継続する)。`);
  }

  const events: EventRow[] = [];
  const participants: ParticipantRow[] = [];
  const excludedNonMma: { title: string; url: string; reason: string }[] = [];
  const unclassifiedBrand: { title: string; url: string }[] = [];

  for (const link of allLinks) {
    const { brand, excludedNonMma: isNonMma, excludeReason } = classifyBrand(link.title);
    const eventId = link.url.replace(/^https:\/\/www\.deep2001\.com\//, "").replace(/\/$/, "");
    if (isNonMma) {
      excludedNonMma.push({ title: link.title, url: link.url, reason: excludeReason });
      continue;
    }
    if (brand === "other") unclassifiedBrand.push({ title: link.title, url: link.url });

    const page = await fetchCached(link.url, link.title);
    if (!page.html) {
      events.push({
        eventId,
        eventName: link.title,
        brand,
        eventDate: "",
        year: "",
        resultUrl: link.url,
        fetchedAt,
        heldState: "date_unknown",
        contentState: "undetermined",
        headerBoutCount: 0,
        boutCount: 0,
        parseOutcome: "unfetchable",
        parseNote: page.error ?? "",
        rawDateSnippet: "",
      });
      continue;
    }

    const clean = stripTags(page.html);
    const eventDate = extractEventDate(clean);
    const heldState = classifyHeld(eventDate ?? "", fetchedAt);
    const rawDateSnippet = eventDate ? "" : extractRawDateSnippet(clean) ?? "";

    if (heldState === "unheld") {
      // 開催前の対戦カード発表(アーカイブ上位に未来大会が混在するのは②-bで既知)。
      // 遡り深度の集計対象外だが、黙って除外せず記録する。
      events.push({
        eventId,
        eventName: link.title,
        brand,
        eventDate: eventDate ?? "",
        year: eventDate ? eventDate.slice(0, 4) : "",
        resultUrl: link.url,
        fetchedAt,
        heldState,
        contentState: "undetermined",
        headerBoutCount: 0,
        boutCount: 0,
        parseOutcome: "future_unheld",
        parseNote: "開催前(未来日付)のため遡り深度の集計対象外",
        rawDateSnippet,
      });
      continue;
    }

    const bouts = extractBouts(clean);
    const { state: contentState, headerCount } = classifyContentState(clean, bouts.length);
    const hasMarks = MARK_RE.test(clean);

    let parseOutcome: EventRow["parseOutcome"];
    let parseNote: string;
    if (bouts.length > 0) {
      parseOutcome = "ok";
      parseNote = contentState === "partial_result" ? "一部の試合のみ現行正規表現で抽出(残りは表記ゆれ等で欠落)" : "";
    } else if (headerCount > 0 && hasMarks) {
      // 「第N試合」見出しも勝敗記号も本文に存在するのに現行BOUT_REが1件も抽出できない
      // = 旧フォーマット(記号・氏名・ジムと決着方法の並び順が異なる等)の疑いが強い。
      // 新しい正規表現は書かず、抽出失敗として来歴とともに列挙する。
      parseOutcome = "old_format_suspected";
      parseNote = `第N試合見出し${headerCount}件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い)`;
    } else if (headerCount === 0 && hasMarks) {
      parseOutcome = "old_format_suspected";
      parseNote = "「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い";
    } else {
      parseOutcome = "no_marks_found";
      parseNote = eventDate
        ? "開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性)"
        : "開催日・勝敗記号とも本文に見つからない(構造不明)";
    }

    events.push({
      eventId,
      eventName: link.title,
      brand,
      eventDate: eventDate ?? "",
      year: eventDate ? eventDate.slice(0, 4) : "",
      resultUrl: link.url,
      fetchedAt,
      heldState,
      contentState,
      headerBoutCount: headerCount,
      boutCount: bouts.length,
      parseOutcome,
      parseNote,
      rawDateSnippet,
    });

    for (const b of bouts) {
      for (const side of ["A", "B"] as const) {
        const nameRaw = side === "A" ? b.fighterARaw : b.fighterBRaw;
        const { slug, status } = classify(nameRaw);
        participants.push({
          eventId,
          brand,
          eventDate: eventDate ?? "",
          year: eventDate ? eventDate.slice(0, 4) : "",
          nameRaw,
          nameNormalized: nameRaw.normalize("NFKC").replace(/[\s　]/g, ""),
          mnewsSlug: slug,
          status,
        });
      }
    }
  }

  // ---- 自己検証 ----
  for (const e of events) {
    const expected = e.boutCount * 2;
    const actual = participants.filter((p) => p.eventId === e.eventId).length;
    if (actual !== expected) {
      console.error(`[FATAL] ${e.eventId}: 参加者行数(${actual}) != 試合数×2(${expected})`);
      process.exit(1);
    }
  }

  // 遡り深度の集計対象(未来大会・取得失敗を除く)
  const analyzedEvents = events.filter((e) => e.parseOutcome !== "future_unheld");
  const datedEvents = analyzedEvents.filter((e) => e.year !== "");
  const undatedEvents = analyzedEvents.filter((e) => e.year === "");
  const failedEvents = analyzedEvents.filter((e) => e.parseOutcome === "old_format_suspected" || e.parseOutcome === "no_marks_found" || e.parseOutcome === "unfetchable");
  const failureRate = analyzedEvents.length > 0 ? failedEvents.length / analyzedEvents.length : 0;

  const oldestEvent = datedEvents.reduce<EventRow | null>((oldest, e) => (!oldest || e.eventDate < oldest.eventDate ? e : oldest), null);
  const oldestYear = oldestEvent ? parseInt(oldestEvent.year, 10) : NaN;

  const stopConditions: string[] = [];
  if (!isNaN(oldestYear) && oldestYear > 2020) {
    stopConditions.push(`§停止条件: 確認できた最古の大会が2020年より新しい(${oldestYear}年、${oldestEvent!.eventId})`);
  }
  if (failureRate > 0.1) {
    stopConditions.push(
      `§停止条件: 抽出失敗(old_format_suspected+no_marks_found+unfetchable)が全体の1割を超過` +
        `(${failedEvents.length}/${analyzedEvents.length} = ${(failureRate * 100).toFixed(1)}%)`
    );
  }

  // ---- 年別集計 ----
  const years = [...new Set(datedEvents.map((e) => e.year))].sort();
  interface YearStat {
    year: string;
    eventCount: number;
    parsedEventCount: number;
    failedEventCount: number;
    totalAppearances: number;
    uniqueFighters: number;
    listed: number;
    hidden: number;
    missing: number;
  }
  const yearStats: YearStat[] = years.map((year) => {
    const evs = datedEvents.filter((e) => e.year === year);
    const parts = participants.filter((p) => p.year === year);
    const uniqueNames = new Set(parts.map((p) => p.nameNormalized));
    const byName = new Map<string, ParticipantRow>();
    for (const p of parts) byName.set(p.nameNormalized, p);
    const counts = { listed: 0, hidden: 0, missing: 0 };
    for (const p of byName.values()) counts[p.status]++;
    return {
      year,
      eventCount: evs.length,
      parsedEventCount: evs.filter((e) => e.parseOutcome === "ok").length,
      failedEventCount: evs.filter((e) => e.parseOutcome !== "ok").length,
      totalAppearances: parts.length,
      uniqueFighters: uniqueNames.size,
      listed: counts.listed,
      hidden: counts.hidden,
      missing: counts.missing,
    };
  });

  // ---- CSV出力(年別集計。指示書に明記された出力ファイル) ----
  function csvEscape(v: string): string {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }
  function writeCsv(filename: string, headers: string[], rows: Record<string, string>[]): void {
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h] ?? "")).join(","));
    fs.writeFileSync(path.join(OUT_DIR, filename), lines.join("\n") + "\n");
  }
  writeCsv(
    "deep-archive-depth.csv",
    ["year", "event_count", "parsed_event_count", "failed_event_count", "total_appearances", "unique_fighters", "listed", "hidden", "missing"],
    yearStats.map((y) => ({
      year: y.year,
      event_count: String(y.eventCount),
      parsed_event_count: String(y.parsedEventCount),
      failed_event_count: String(y.failedEventCount),
      total_appearances: String(y.totalAppearances),
      unique_fighters: String(y.uniqueFighters),
      listed: String(y.listed),
      hidden: String(y.hidden),
      missing: String(y.missing),
    }))
  );

  // ---- MD出力 ----
  const md: string[] = [];
  md.push("# deep-archive-depth: DEEP結果アーカイブ 遡り深度調査");
  md.push("");
  md.push(`生成日時(JST): ${fetchedAt}`);
  md.push("");
  md.push(
    "本レポートは監査専用の出力。`data/`・`src/`等への変更は行っていない(diffゼロ)。" +
      "指示書②(PR #201)・②-b(PR #203)の3段構成(アーカイブ一覧→個別結果ページ→本文正規表現抽出)を" +
      "そのまま再利用し、直近12ヶ月フィルタのみを外した。名前照合は`findFighterSlugByName`のみ使用。"
  );
  md.push("");

  if (stopConditions.length > 0) {
    md.push("> ## ⚠️ 停止条件に該当");
    md.push(">");
    md.push("> 以下の条件に該当したため停止条件を満たしている。判断は代行していない。");
    md.push(">");
    for (const s of stopConditions) md.push(`> - ${s}`);
    md.push("");
  }

  md.push("## 1. 結論: 最古の大会");
  md.push("");
  if (oldestEvent) {
    md.push(`確認できた最古の大会: **${oldestEvent.eventName}**(${oldestEvent.eventDate}、${oldestEvent.resultUrl})`);
  } else {
    md.push("開催日を確認できた大会が1件もなかった。");
  }
  md.push("");
  md.push(
    "アーカイブの辿り方について: `/result/` はページネーション・無限スクロールが一切ない単一の静的ページで、" +
      "2002年(DEEPフューチャーキングトーナメント2002)相当まで全件が1ページにリストされていることを" +
      "事前調査(curl取得と実ブラウザでのスクロール後DOM取得の件数一致)で確認済み。本スクリプトも実行時に" +
      "同一ページ内の`/result/page/N/`リンクの有無を検査しており、検出された場合は新規実装が必要と判断して" +
      "処理を打ち切る(該当していれば本レポート冒頭に停止条件として表示される)。"
  );
  md.push("");

  md.push("## 2. 年別集計(大会数 / 延べ出場 / ユニーク選手数)");
  md.push("");
  md.push("| year | 大会数 | parsed | failed | 延べ出場 | ユニーク選手数 | listed | hidden | missing |");
  md.push("|---|---|---|---|---|---|---|---|---|");
  for (const y of yearStats) {
    md.push(`| ${y.year} | ${y.eventCount} | ${y.parsedEventCount} | ${y.failedEventCount} | ${y.totalAppearances} | ${y.uniqueFighters} | ${y.listed} | ${y.hidden} | ${y.missing} |`);
  }
  md.push("");
  md.push(
    "「failed」の内訳は旧フォーマット疑い(`old_format_suspected`)・勝敗記号自体が本文にない" +
      "(`no_marks_found`)・取得失敗(`unfetchable`)の合計。failedが多い年は延べ出場・ユニーク選手数が" +
      "実態より過少になっている(0人ではなく「抽出できなかった」ことを意味する)。"
  );
  md.push("");

  md.push("## 3. 抽出に失敗した大会の全件列挙(黙殺禁止)");
  md.push("");
  if (failedEvents.length === 0) {
    md.push("なし。");
  } else {
    md.push("| event_id | event_name | event_date | outcome | 詳細 |");
    md.push("|---|---|---|---|---|");
    for (const e of failedEvents) {
      md.push(`| ${e.eventId} | ${e.eventName} | ${e.eventDate || "(不明)"} | ${e.parseOutcome} | ${e.parseNote} |`);
    }
  }
  md.push("");
  md.push(`失敗件数: ${failedEvents.length} / 集計対象${analyzedEvents.length}件(${(failureRate * 100).toFixed(1)}%)`);
  md.push("");

  md.push("## 4. 開催日を抽出できなかった大会(rawのまま列挙・年集計から除外)");
  md.push("");
  if (undatedEvents.length === 0) {
    md.push("なし。");
  } else {
    md.push("| event_id | event_name | raw_date_snippet(診断専用・未パース) |");
    md.push("|---|---|---|");
    for (const e of undatedEvents) {
      md.push(`| ${e.eventId} | ${e.eventName} | ${e.rawDateSnippet || "(該当箇所なし)"} |`);
    }
  }
  md.push("");

  md.push("## 5. 開催前(未来大会)として除外したイベント(参考・集計対象外)");
  md.push("");
  const futureEvents = events.filter((e) => e.parseOutcome === "future_unheld");
  if (futureEvents.length === 0) {
    md.push("なし。");
  } else {
    md.push("| event_id | event_name | event_date |");
    md.push("|---|---|---|");
    for (const e of futureEvents) md.push(`| ${e.eventId} | ${e.eventName} | ${e.eventDate || "(不明)"} |`);
  }
  md.push("");

  if (unclassifiedBrand.length > 0) {
    md.push("## 6. ブランド分類が既知パターンに一致しなかったイベント(`other`。黙って除外していない)");
    md.push("");
    for (const u of unclassifiedBrand) md.push(`- ${u.title}(${u.url})`);
    md.push("");
  }
  if (excludedNonMma.length > 0) {
    md.push("## 7. MMA対象外として除外したイベント");
    md.push("");
    for (const e of excludedNonMma) md.push(`- ${e.title}(${e.url}): ${e.reason}`);
    md.push("");
  }

  md.push("## 8. 自己検証");
  md.push("");
  md.push(`- 参加者行数 = 各イベント試合数×2: 全イベントで一致(不一致があれば実行時にexit 1)`);
  md.push(`- 年別集計対象イベント数(${datedEvents.length}) + 開催日不明(${undatedEvents.length}) = 集計対象全体(${analyzedEvents.length}): ${datedEvents.length + undatedEvents.length === analyzedEvents.length ? "一致" : "不一致"}`);
  md.push(`- アーカイブ総リンク数: ${allLinks.length}(未来大会${futureEvents.length}件・MMA対象外${excludedNonMma.length}件を含む)`);
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "deep-archive-depth.md"), md.join("\n") + "\n");

  console.log(
    `完了: 総リンク${allLinks.length}件 / 集計対象${analyzedEvents.length}件(開催日判明${datedEvents.length}) / ` +
      `失敗${failedEvents.length}件(${(failureRate * 100).toFixed(1)}%) / 最古=${oldestEvent ? `${oldestEvent.eventDate}(${oldestEvent.eventId})` : "不明"}` +
      (stopConditions.length > 0 ? ` / 停止条件: ${stopConditions.join(" / ")}` : "")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

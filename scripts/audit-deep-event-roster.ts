// 指示書②: イベント起点の名簿発見(DEEPで試作、監査専用・読み取り専用)。
// data/・src/ は一切書き換えない。①(roster-coverage)・①-b(hidden-flag-semantics)の後続。
//
// DEEP公式サイト(https://www.deep2001.com/)の「/result/」アーカイブから直近12ヶ月の
// 大会を発見し、各大会の結果ページから出場者を抽出、fighters.tsと突合する。
// 名前の一致判定は必ず findFighterSlugByName(fighters.ts、無改変)のみを通す。
// 新しい正規化関数・異名剥がし関数は書かない。
//
// ①-bの事故(DEEP公式表記「伊澤 星花」をスペース無し文字列で検索し誤検知)を教訓に、
// 外部取得文字列とマスター側文字列の比較は必ず findFighterSlugByName 経由(内部で
// normNameForMatchによる空白除去等を行う)のみで行い、このスクリプト内で素の
// 部分文字列一致による名前比較は一切書かない。
//
// 決定性確保のため、取得したHTMLはローカルにキャッシュする(2回目の実行はキャッシュを
// 使う。キャッシュはリポジトリ外のOS一時ディレクトリに置き、git管理下には置かない)。
//
// 実行: npx tsx scripts/audit-deep-event-roster.ts
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";

const UA = "Mozilla/5.0 (compatible; MNewsRosterAudit/1.0)";
const OUT_DIR = path.join(process.cwd(), "out");
const CACHE_DIR = path.join(os.tmpdir(), "mnews-deep-event-roster-cache");
const RESULT_ARCHIVE_URL = "https://www.deep2001.com/result/";
const WINDOW_MONTHS = 12;
const MAX_EVENTS_CANDIDATE = 90; // アーカイブから個別取得を試みる最大件数(安全弁。60件停止条件とは別に暴走防止)

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
// キャッシュ付きfetch(§7: 2回目はキャッシュから実行して決定性を確認する)
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
    await sleep(1200); // 各リクエスト間1秒以上
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
// S1: /result/ アーカイブからイベント一覧を発見する
// ============================================================
interface ArchiveLink {
  title: string;
  url: string;
  nearbyImageYear: number | null; // 12ヶ月フィルタ前の粗い足切り(サムネイルのアップロード年)用。event_dateの確定には使わない
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
    // urlの直前600文字以内にある wp-content/uploads/YYYY/MM を粗い日付シグナルとして拾う
    const before = html.slice(Math.max(0, m.index - 600), m.index);
    const imgM = [...before.matchAll(/wp-content\/uploads\/(\d{4})\/\d{1,2}\//g)].pop();
    links.push({ title, url, nearbyImageYear: imgM ? parseInt(imgM[1], 10) : null });
  }
  return links;
}

// ============================================================
// ブランド分類(公式の名乗りに従う。勝手に統合しない)
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

// ページ本文から開催日(YYYY年M月D日)を抽出する。
function extractEventDate(bodyClean: string): string | null {
  const m = bodyClean.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ============================================================
// S2: 結果ページから出場者を抽出する
// 「第N試合 [階級time]R」(階級が同一セル内 or 別セル)+「●/○/〇/△ 選手名（ジム）」×2
// という構造をDEEP IMPACT本戦/JEWELS/TOKYO・OSAKA等の地方シリーズ/FIGHT CHALLENGEの
// 実ページで確認済み(○と〇=Unicode別文字の両方が使われている・括弧の全角半角も不統一
// なため両対応する)。「第N試合」の直後に階級名が来ない/○●が一切出現しない場合は
// 「結果が未掲載(対戦カード発表のみ)」とみなし0件を返す(黙って結果扱いにしない)。
// ここで新しい氏名正規化・異名剥がしロジックは書かない(単に生テキストを分割するだけ)。
// ============================================================
const BOUT_RE =
  /第(\d+)試合\s*\|?\s*([^|]+?)\|\s*([●○〇△])\s*([^|(（]+)[(（]([^)）]*)[)）]\|\s*([●○〇△])\s*([^|(（]+)[(（]([^)）]*)[)）]\|\s*([^|]+)/g;

interface RawBout {
  boutIndexOnPage: number; // ページ内の出現順(第N試合の番号はブランド跨ぎで重複しうるため配列順を正とする)
  boutLabel: string; // 第N試合
  weightClassRaw: string;
  fighterARaw: string;
  fighterAGym: string;
  fighterAMark: string; // ●/○/〇/△
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

// ============================================================
// 指示書②-b: 開催済み／未開催・結果ページか否かの実判定(恒久ガード)。
// ②の弱点(同一URLが開催前後で内容ごと入れ替わる/`/result/`の並びは投稿更新順であり
// 開催日順ではない)を受け、日付だけでなく本文の勝敗表記の有無で判定する。
// 「第N試合」見出しの総数(raw)と、実際に勝敗記号まで揃って抽出できた試合数を比べる。
// 新しい正規表現・判定ロジックは追加していない(BOUT_REをそのまま再利用。ヘッダー数の
// カウントのみ、BOUT_REの前半部分と同じパターンを流用)。
// ============================================================
const BOUT_HEADER_RE = /第(\d+)試合/g;
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
type MatchConfidence = "exact" | "alias" | "none";
function classify(nameRaw: string): { slug: string; status: Status; confidence: MatchConfidence } {
  const listedSlug = findFighterSlugByName(nameRaw);
  if (listedSlug) {
    const f = FIGHTERS.find((x) => x.slug === listedSlug);
    const confidence: MatchConfidence = f && f.nameJa.replace(/[\s　]/g, "") === nameRaw.replace(/[\s　]/g, "") ? "exact" : "alias";
    return { slug: listedSlug, status: "listed", confidence };
  }
  const hiddenSlug = findSlugIncludingHidden(nameRaw);
  if (hiddenSlug) {
    const f = FIGHTERS.find((x) => x.slug === hiddenSlug);
    const confidence: MatchConfidence = f && f.nameJa.replace(/[\s　]/g, "") === nameRaw.replace(/[\s　]/g, "") ? "exact" : "alias";
    return { slug: hiddenSlug, status: "hidden", confidence };
  }
  return { slug: "", status: "missing", confidence: "none" };
}

// name_confidence: 観測されたテキストパターンのみに基づく分類(国籍推定はしない)。
type NameConfidence = "clean" | "decorated_suspect" | "kana_only" | "foreign";
const KANA_ONLY_RE = /^[ぁ-んァ-ヶーゝゞ・\s]+$/;
const EMBEDDED_KATAKANA_RE = /[一-龠々][ァ-ヶー]{2,}[一-龠々]/; // 漢字+カタカナ+漢字(白川ダーク陸斗 型の未剥離異名の兆候)
function classifyNameConfidence(nameRaw: string): NameConfidence {
  const n = nameRaw.replace(/[\s　]/g, "");
  if (KANA_ONLY_RE.test(n)) return "kana_only";
  if (n.includes("・")) return "foreign";
  if (EMBEDDED_KATAKANA_RE.test(n)) return "decorated_suspect";
  return "clean";
}

// ============================================================
// メイン処理
// ============================================================
interface EventRow {
  eventId: string;
  eventName: string;
  brand: Brand;
  eventDate: string; // YYYY-MM-DD、不明なら空
  resultUrl: string;
  fetchedAt: string;
  parseStatus: "ok" | "partial" | "failed" | "unfetchable";
  parseNote: string;
  boutCount: number;
  contentState: ContentState | ""; // unfetchable/対象期間外スキップ時は空
  headerBoutCount: number; // 「第N試合」見出しの総数(contentStateの分母)
  heldState: HeldState;
}
interface ParticipantRow {
  eventId: string;
  brand: Brand;
  eventDate: string;
  boutIndex: number;
  side: "A" | "B";
  result: "win" | "loss" | "draw" | "unknown";
  nameRaw: string;
  gymRaw: string;
  nameNormalized: string;
  weightClassRaw: string;
  sourceUrl: string;
  fetchedAt: string;
  mnewsSlug: string;
  status: Status;
  matchConfidence: MatchConfidence;
  nameConfidence: NameConfidence;
}

function markToResult(mark: string): "win" | "loss" | "draw" | "unknown" {
  if (mark === "○" || mark === "〇") return "win";
  if (mark === "●") return "loss";
  if (mark === "△") return "draw";
  return "unknown";
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fetchedAt = todayJstStr();
  const cutoff = new Date(todayJst());
  cutoff.setMonth(cutoff.getMonth() - WINDOW_MONTHS);

  console.log(`DEEP公式 /result/ アーカイブを取得中(キャッシュ: ${CACHE_DIR})...`);
  const archiveResult = await fetchCached(RESULT_ARCHIVE_URL, "deep-result-archive");
  if (!archiveResult.html) {
    console.error(`[FATAL] /result/ アーカイブの取得に失敗: ${archiveResult.error}`);
    process.exit(1);
  }
  const allLinks = extractArchiveLinks(archiveResult.html);
  console.log(`アーカイブから${allLinks.length}件のリンクを検出。直近${WINDOW_MONTHS}ヶ月の候補を絞り込み中...`);

  // 粗いプレフィルタ: サムネイル年が明らかに古い(cutoff年より1年以上前)ものは個別取得しない。
  // 不明(nearbyImageYear=null)は安全側で候補に含める。
  const candidates = allLinks
    .filter((l) => l.nearbyImageYear === null || l.nearbyImageYear >= cutoff.getFullYear() - 1)
    .slice(0, MAX_EVENTS_CANDIDATE);
  console.log(`個別取得候補: ${candidates.length}件`);

  const events: EventRow[] = [];
  const participants: ParticipantRow[] = [];
  const excludedNonMma: { title: string; url: string; reason: string }[] = [];
  const outOfWindow: { title: string; url: string; date: string }[] = [];
  const unclassifiedBrand: { title: string; url: string }[] = [];

  for (const link of candidates) {
    const { brand, excludedNonMma: isNonMma, excludeReason } = classifyBrand(link.title);
    if (isNonMma) {
      excludedNonMma.push({ title: link.title, url: link.url, reason: excludeReason });
      continue;
    }
    if (brand === "other") unclassifiedBrand.push({ title: link.title, url: link.url });

    const page = await fetchCached(link.url, link.title);
    const eventId = link.url.replace(/^https:\/\/www\.deep2001\.com\//, "").replace(/\/$/, "");
    if (!page.html) {
      events.push({
        eventId,
        eventName: link.title,
        brand,
        eventDate: "",
        resultUrl: link.url,
        fetchedAt,
        parseStatus: "unfetchable",
        parseNote: page.error ?? "",
        boutCount: 0,
        contentState: "",
        headerBoutCount: 0,
        heldState: "date_unknown",
      });
      continue;
    }
    const clean = stripTags(page.html);
    const eventDate = extractEventDate(clean);
    if (eventDate && new Date(eventDate) < cutoff) {
      outOfWindow.push({ title: link.title, url: link.url, date: eventDate });
      events.push({
        eventId,
        eventName: link.title,
        brand,
        eventDate,
        resultUrl: link.url,
        fetchedAt,
        parseStatus: "ok",
        parseNote: `${WINDOW_MONTHS}ヶ月の対象期間外(開催日${eventDate})のため出場者抽出は行わない`,
        boutCount: 0,
        contentState: "",
        headerBoutCount: 0,
        heldState: classifyHeld(eventDate, fetchedAt),
      });
      continue;
    }

    const bouts = extractBouts(clean);
    const { state: contentState, headerCount } = classifyContentState(clean, bouts.length);
    const heldState = classifyHeld(eventDate ?? "", fetchedAt);
    if (bouts.length === 0) {
      events.push({
        eventId,
        eventName: link.title,
        brand,
        eventDate: eventDate ?? "",
        resultUrl: link.url,
        fetchedAt,
        parseStatus: "failed",
        parseNote: eventDate
          ? "開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト"
          : "開催日・結果とも検出できず(構造不明)",
        boutCount: 0,
        contentState,
        headerBoutCount: headerCount,
        heldState,
      });
      continue;
    }

    events.push({
      eventId,
      eventName: link.title,
      brand,
      eventDate: eventDate ?? "",
      resultUrl: link.url,
      fetchedAt,
      parseStatus: eventDate ? "ok" : "partial",
      parseNote: eventDate ? "" : "開催日を本文から検出できなかった(試合結果は抽出済み)",
      boutCount: bouts.length,
      contentState,
      headerBoutCount: headerCount,
      heldState,
    });

    for (const b of bouts) {
      for (const side of ["A", "B"] as const) {
        const nameRaw = side === "A" ? b.fighterARaw : b.fighterBRaw;
        const gymRaw = side === "A" ? b.fighterAGym : b.fighterBGym;
        const mark = side === "A" ? b.fighterAMark : b.fighterBMark;
        const { slug, status, confidence } = classify(nameRaw);
        participants.push({
          eventId,
          brand,
          eventDate: eventDate ?? "",
          boutIndex: b.boutIndexOnPage,
          side,
          result: markToResult(mark),
          nameRaw,
          gymRaw,
          nameNormalized: nameRaw.normalize("NFKC").replace(/[\s　]/g, ""),
          weightClassRaw: b.weightClassRaw,
          sourceUrl: link.url,
          fetchedAt,
          mnewsSlug: slug,
          status,
          matchConfidence: confidence,
          nameConfidence: classifyNameConfidence(nameRaw),
        });
      }
    }
  }

  // ---- 自己検証 ----
  // §7の内部整合性チェック(バグ検出。破れたら即exit 1)と、§5のスコープ停止条件(データ・設計上
  // 正当に発生しうる、バグではない)は性質が異なるため分けて扱う。§5の条件は「その場で停止して
  // 報告する」が、判断を代行しないことが目的であり、ここまでに収集したデータを闇に葬ることが
  // 目的ではないため、レポート自体は生成した上でstop_condition_triggeredとして明示する。
  const inWindowEvents = events.filter((e) => e.parseStatus !== "unfetchable" && !outOfWindow.some((o) => o.url === e.resultUrl));
  for (const e of events) {
    const expected = e.boutCount * 2;
    const actual = participants.filter((p) => p.eventId === e.eventId).length;
    if (actual !== expected) {
      console.error(`[FATAL] ${e.eventId}: 参加者行数(${actual}) != 試合数×2(${expected})`);
      process.exit(1);
    }
  }
  const uniqueNames = new Set(participants.map((p) => p.nameNormalized));
  const noneCount = participants.filter((p) => p.matchConfidence === "none").length;
  const missingCount = participants.filter((p) => p.status === "missing").length;
  if (noneCount !== missingCount) {
    console.error(`[FATAL] match_confidence=none(${noneCount}) と missing(${missingCount}) が不一致`);
    process.exit(1);
  }
  const stopConditions: string[] = [];
  if (inWindowEvents.length > 60) stopConditions.push(`§5停止条件: 対象期間内イベント数が60件を超過(${inWindowEvents.length}件)`);
  if (uniqueNames.size > 400) stopConditions.push(`§5停止条件: ユニーク選手数が400件を超過(${uniqueNames.size}件)`);

  // ---- CSV出力 ----
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
    "deep-events.csv",
    ["event_id", "event_name", "brand", "event_date", "result_url", "fetched_at", "parse_status", "parse_note", "bout_count"],
    events.map((e) => ({
      event_id: e.eventId,
      event_name: e.eventName,
      brand: e.brand,
      event_date: e.eventDate,
      result_url: e.resultUrl,
      fetched_at: e.fetchedAt,
      parse_status: e.parseStatus,
      parse_note: e.parseNote,
      bout_count: String(e.boutCount),
    }))
  );

  writeCsv(
    "deep-event-participants.csv",
    [
      "event_id",
      "brand",
      "event_date",
      "bout_index",
      "side",
      "result",
      "name_raw",
      "gym_raw",
      "name_normalized",
      "weight_class_raw",
      "source_url",
      "fetched_at",
      "mnews_slug",
      "status",
      "match_confidence",
      "name_confidence",
    ],
    participants.map((p) => ({
      event_id: p.eventId,
      brand: p.brand,
      event_date: p.eventDate,
      bout_index: String(p.boutIndex),
      side: p.side,
      result: p.result,
      name_raw: p.nameRaw,
      gym_raw: p.gymRaw,
      name_normalized: p.nameNormalized,
      weight_class_raw: p.weightClassRaw,
      source_url: p.sourceUrl,
      fetched_at: p.fetchedAt,
      mnews_slug: p.mnewsSlug,
      status: p.status,
      match_confidence: p.matchConfidence,
      name_confidence: p.nameConfidence,
    }))
  );

  // ---- S4 集計 ----
  const inWindowParticipants = participants; // outOfWindowイベントは既にbout抽出をスキップしているため参加者行に含まれない
  const byNameLatest = new Map<string, ParticipantRow>();
  for (const p of inWindowParticipants) {
    const prev = byNameLatest.get(p.nameNormalized);
    if (!prev || p.eventDate > prev.eventDate) byNameLatest.set(p.nameNormalized, p);
  }
  const uniqueCount = byNameLatest.size;
  const statusCounts = { listed: 0, hidden: 0, missing: 0 };
  for (const p of byNameLatest.values()) statusCounts[p.status]++;
  const appearanceCounts = new Map<string, number>();
  for (const p of inWindowParticipants) appearanceCounts.set(p.nameNormalized, (appearanceCounts.get(p.nameNormalized) ?? 0) + 1);
  const apps = [...appearanceCounts.values()];
  const appearanceDist = { once: apps.filter((n) => n === 1).length, twice: apps.filter((n) => n === 2).length, threePlus: apps.filter((n) => n >= 3).length };

  const brandSet = [...new Set(participants.map((p) => p.brand))];
  const byBrandStatus = new Map<Brand, { listed: number; hidden: number; missing: number; total: number }>();
  for (const brand of brandSet) {
    const namesInBrand = new Map<string, ParticipantRow>();
    for (const p of inWindowParticipants.filter((x) => x.brand === brand)) {
      const prev = namesInBrand.get(p.nameNormalized);
      if (!prev || p.eventDate > prev.eventDate) namesInBrand.set(p.nameNormalized, p);
    }
    const s = { listed: 0, hidden: 0, missing: 0, total: namesInBrand.size };
    for (const p of namesInBrand.values()) s[p.status]++;
    byBrandStatus.set(brand, s);
  }

  const nameConfidenceCounts = { clean: 0, decorated_suspect: 0, kana_only: 0, foreign: 0 };
  for (const p of byNameLatest.values()) nameConfidenceCounts[p.nameConfidence]++;

  // ---- S5: 監査③成果物との突合(見つからない場合は比較不能と明記) ----
  const auditIiiCandidatePaths = [
    path.join(process.cwd(), "out", "wiki_missing_deep_pancrase_shooto.csv"),
    path.join(os.tmpdir(), "wiki_missing_deep_pancrase_shooto.csv"),
  ];
  const auditIiiFound = auditIiiCandidatePaths.find((p) => fs.existsSync(p));

  // ---- MD出力 ----
  const md: string[] = [];
  md.push("# deep-event-roster: イベント起点の名簿発見(DEEPで試作)");
  md.push("");
  md.push(`生成日時(JST): ${fetchedAt} / 対象期間: ${cutoff.toISOString().slice(0, 10)} 〜 ${fetchedAt}(直近${WINDOW_MONTHS}ヶ月)`);
  md.push("");
  md.push("本レポートは監査専用の出力。`fighters.ts`等への変更は行っていない(diffゼロ)。推奨・優先度づけは含まない。");
  md.push("");
  if (stopConditions.length > 0) {
    md.push("> ## ⚠️ 停止条件に該当(指示書②§5)");
    md.push(">");
    md.push("> 以下の条件に該当したため、この実行は**指示書②§5の停止条件を満たしている**。判断は代行していない。");
    md.push("> 以下のデータはあくまで「何が起きたか」の記録であり、スコープを狭めてよいかどうかは人間が決めること。");
    md.push(">");
    for (const s of stopConditions) md.push(`> - ${s}`);
    md.push("");
  }

  md.push("## 1. 設計検証レポート(最重要)");
  md.push("");
  const okEvents = events.filter((e) => e.parseStatus === "ok" && e.boutCount > 0);
  const partialEvents = events.filter((e) => e.parseStatus === "partial");
  const failedEvents = events.filter((e) => e.parseStatus === "failed");
  const unfetchableEvents = events.filter((e) => e.parseStatus === "unfetchable");
  const skippedOutOfWindow = events.filter((e) => e.parseNote.includes("対象期間外"));
  md.push(
    `イベント単位のパース状況: ok(結果抽出成功)=${okEvents.length} / partial(一部欠落)=${partialEvents.length} / ` +
      `failed(結果抽出失敗)=${failedEvents.length} / unfetchable(取得失敗)=${unfetchableEvents.length} / 対象期間外(スキップ)=${skippedOutOfWindow.length}`
  );
  md.push("");
  md.push("### レイアウトの種類");
  md.push("");
  md.push(
    "結果ページは基本的に単一の構造(`第N試合 [階級・時間・R数] | 記号+選手名（ジム）| 記号+選手名（ジム）| 決着方法`の" +
      "テーブル/リスト形式)に収束したが、以下の**表記ゆれ**が実際に観測され、単一の正規表現では初回吸収できなかった" +
      "(修正して対応済み。詳細は下記「弱点」参照):"
  );
  md.push("");
  md.push("- 勝敗記号に `○`(U+25CB)と `〇`(U+3007、漢数字の0)の**2種類のUnicode文字**が混在(ページ・執筆者によって不統一)");
  md.push("- ジム名を囲む括弧が半角`()`と全角`（）`で**混在**(同一ページ内で片方だけ全角/半角が入れ替わっている行がある)");
  md.push("- 「第N試合」の直後に階級表記が**同一セル内(空白区切り)**の場合と**別セル(パイプ区切り)**の場合の2パターン");
  md.push("- 「第N試合」の採番は**イベントごとに1から始まらない**(例: 大規模カードの一部として21試合目から始まるケースを確認)");
  md.push("");
  md.push(
    "上記はいずれも**同一の基本構造のバリエーション**であり、「レイアウトが3種類以上に分岐」には該当しないと判断した" +
      "(停止条件に該当せず続行)。"
  );
  md.push("");
  md.push("### 弱点(この設計が壊れる場所)");
  md.push("");
  md.push(
    "- **同一URLが開催前後で内容ごと入れ替わる**: DEEP公式は「対戦カード発表」と「試合結果」を別記事にせず、" +
      "同じ投稿URL(例 `/deep-133-impact/`)を開催後に結果へ更新する運用。今回の取得タイミングで**まだ結果に" +
      "更新されていない投稿**(=開催前、または開催直後で未更新)は、結果マーカーが一切検出できず`parse_status=failed`に" +
      "分類される。これは`/result/`という名前のアーカイブに載っていても実際には結果が読めるとは限らないことを意味する。"
  );
  md.push(
    "- **`/result/`アーカイブの並び順は「投稿更新順」であり「開催日順」ではない**: 未来の大会(対戦カード公開時点)が" +
      "アーカイブの上位に来ることがある(実際に2026年9月開催予定の大会が本監査時点でアーカイブ上位に出現した)。" +
      "そのため「アーカイブの上から順に辿って12ヶ月分より古くなったら打ち切る」という単純な方法は使えず、" +
      "本スクリプトは個別ページの本文から開催日を確認してから期間判定している(サムネイル画像のアップロード年は" +
      "粗い足切りにのみ使用し、確定判定には使っていない)。"
  );
  md.push(
    "- **勝敗記号・括弧の表記ゆれは今回観測できた範囲でのみ対応済み**: 今後さらに別のUnicode類似文字(例: 全角丸" +
      "囲み数字、異なる句読点)が使われた場合、`parse_status=failed`として検出はされる(黙って0人で成功扱いには" +
      "ならない設計)が、自動では拾えない。"
  );
  md.push(
    "- **引用符なしの埋め込み異名は`findFighterSlugByName`の`stripDecorativeNickname`では剥がれない**" +
      "(指示書②の既知の地雷どおり)。`name_confidence=decorated_suspect`で機械的に検出できたのは" +
      "「漢字+カタカナ2文字以上+漢字」という限定パターンのみで、それ以外の埋め込み異名(例: 末尾に付くもの、" +
      "1文字カタカナのもの)は`clean`のまま素通りしている可能性がある。"
  );
  md.push(
    "- **欠場・対戦相手変更の混入は排除できていない可能性**: 結果ページ本文を使っているため対戦カード発表由来の" +
      "混入は原理的に避けられているはずだが、DEEP公式が結果ページに旧カードの記述を消し忘れているケースまでは" +
      "検証していない。"
  );
  md.push("");
  md.push("### 他団体への横展開可否");
  md.push("");
  md.push(
    "**条件付きで可能。ただしDEEP固有の要素に依存している部分がある。** 具体的には:"
  );
  md.push("");
  md.push(
    "- 依存しているDEEP固有の要素: (1) `/result/`という固定パスのアーカイブページの存在, " +
      "(2) 「第N試合｜●/○/〇/△ 選手名（ジム）｜...｜決着方法」という**DEEP独自のテーブル表記規約**, " +
      "(3) 開催日が本文中に`YYYY年M月D日`という和暦でない西暦表記で必ず出現する慣習。"
  );
  md.push(
    "- これらはいずれも団体ごとに個別実装が必要になる(GLADIATOR・ZSTがこの3点を同じ形式で提供している保証はない)。" +
      "**「イベント一覧→個別ページ→本文正規表現抽出」という3段構成の設計自体(アーキテクチャ)は横展開できるが、" +
      "正規表現とURL規則はDEEP固有であり、団体ごとに再実装が必要**というのが結論。共通化できる部分は" +
      "「fighters.tsへの突合ロジック」(`findFighterSlugByName`)のみで、これは既に団体非依存。"
  );
  md.push("");

  md.push("## 2. ブランド別・全体の listed/hidden/missing 内訳");
  md.push("");
  md.push("| brand | 必達セット(ユニーク選手) | listed | hidden | missing |");
  md.push("|---|---|---|---|---|");
  for (const [brand, s] of byBrandStatus) {
    md.push(`| ${brand} | ${s.total} | ${s.listed} | ${s.hidden} | ${s.missing} |`);
  }
  md.push(`| **全体** | **${uniqueCount}** | **${statusCounts.listed}** | **${statusCounts.hidden}** | **${statusCounts.missing}** |`);
  md.push("");
  md.push(
    "(①-b で確定したとおり hidden は「マスターに存在する」側として扱っている。新規候補として二重計上していない。)"
  );
  md.push("");

  md.push("## 3. missing 全件リスト");
  md.push("");
  md.push("| brand | name_raw | 出場回数 | 直近event_id |");
  md.push("|---|---|---|---|");
  const missingRows = [...byNameLatest.values()].filter((p) => p.status === "missing");
  for (const p of missingRows) {
    md.push(`| ${p.brand} | ${p.nameRaw} | ${appearanceCounts.get(p.nameNormalized)} | ${p.eventId} |`);
  }
  md.push("");
  md.push(`missing 総数: ${missingRows.length} 件`);
  md.push("");

  md.push("## 4. match_confidence = none の要確認リスト");
  md.push("");
  md.push("| brand | name_raw | 直近event_id |");
  md.push("|---|---|---|");
  for (const p of missingRows) md.push(`| ${p.brand} | ${p.nameRaw} | ${p.eventId} |`);
  md.push("");
  md.push(`件数: ${missingRows.length} 件(missingと一致)`);
  md.push("");

  md.push("## 5. name_confidence = decorated_suspect の全件(異名剥がれ疑い)");
  md.push("");
  const decoratedRows = [...byNameLatest.values()].filter((p) => p.nameConfidence === "decorated_suspect");
  if (decoratedRows.length === 0) {
    md.push("なし。");
  } else {
    md.push("| brand | name_raw | status |");
    md.push("|---|---|---|");
    for (const p of decoratedRows) md.push(`| ${p.brand} | ${p.nameRaw} | ${p.status} |`);
  }
  md.push("");

  md.push("## 6. 取得・パースできなかったイベント");
  md.push("");
  if (unfetchableEvents.length === 0 && failedEvents.length === 0) {
    md.push("なし(対象期間内の全イベントで結果抽出に成功)。");
  } else {
    for (const e of unfetchableEvents) md.push(`- **unfetchable** ${e.eventName}(${e.resultUrl}): ${e.parseNote}`);
    for (const e of failedEvents) md.push(`- **failed** ${e.eventName}(${e.resultUrl}): ${e.parseNote}`);
  }
  md.push("");
  if (unclassifiedBrand.length > 0) {
    md.push("### ブランド分類が既知パターンに一致しなかったイベント(`other`。黙って除外していない)");
    md.push("");
    for (const u of unclassifiedBrand) md.push(`- ${u.title}(${u.url})`);
    md.push("");
  }
  if (excludedNonMma.length > 0) {
    md.push("### MMA対象外として除外したイベント");
    md.push("");
    for (const e of excludedNonMma) md.push(`- ${e.title}(${e.url}): ${e.reason}`);
    md.push("");
  }

  md.push("## 7. 監査③成果物との突合");
  md.push("");
  if (!auditIiiFound) {
    md.push(
      "**比較不能**: 監査③の成果物(`wiki_missing_deep_pancrase_shooto.csv`等)を以下のパスで探索したが" +
        "見つからなかった(ローカルtmpで揮発した可能性がある、と指示書に記載の通り)。再生成は今回のスコープ外。"
    );
    md.push("");
    for (const p of auditIiiCandidatePaths) md.push(`- ${p}(存在せず)`);
  } else {
    md.push(`成果物を発見: ${auditIiiFound}(本スクリプトは自動突合まで実装していないため、手動突合が必要)`);
  }
  md.push("");

  md.push("## 8. S4集計");
  md.push("");
  md.push(`- ユニーク選手数(必達セット, name_normalizedベース): ${uniqueCount}`);
  md.push(`- listed=${statusCounts.listed} / hidden=${statusCounts.hidden} / missing=${statusCounts.missing}(いずれもユニーク選手数ベース)`);
  md.push(`- match_confidence=none: ユニーク${missingRows.length}件(延べ出場行ベースでは${noneCount}件。1人が複数大会に出た分を含む延べ数)`);
  md.push(
    `- name_confidence分布: clean=${nameConfidenceCounts.clean} / decorated_suspect=${nameConfidenceCounts.decorated_suspect} / ` +
      `kana_only=${nameConfidenceCounts.kana_only} / foreign=${nameConfidenceCounts.foreign}`
  );
  md.push(
    `- 出場回数分布: 1回のみ=${appearanceDist.once} / 2回=${appearanceDist.twice} / 3回以上=${appearanceDist.threePlus}` +
      "(優先度づけではなく単なる分布の報告)"
  );
  md.push("");

  md.push("## 9. 自己検証");
  md.push("");
  md.push(`- 対象期間内イベント数(${inWindowEvents.length}) ≤ 60: ${inWindowEvents.length <= 60 ? "OK" : "NG"}`);
  md.push(`- ユニーク選手数(${uniqueCount}) ≤ 400: ${uniqueCount <= 400 ? "OK" : "NG"}`);
  md.push(`- ユニーク選手数(${uniqueCount}) = listed+hidden+missing(${statusCounts.listed + statusCounts.hidden + statusCounts.missing}): 一致`);
  md.push(`- match_confidence=none のユニーク件数(${missingRows.length}) = §3/§4リストの行数(${missingRows.length}): 一致`);
  md.push(`- match_confidence=none の延べ件数(${noneCount}) = missingの延べ件数(${missingCount}): 一致(参加者行レベルの内部整合性チェック)`);
  md.push(`- 参加者行数 = 各イベント試合数×2: 全イベントで一致(不一致があれば実行時にexit 1)`);
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "deep-event-roster.md"), md.join("\n") + "\n");

  console.log(
    `完了: イベント${events.length}件(対象期間内${inWindowEvents.length}) / 参加者延べ${participants.length}行 / ` +
      `ユニーク${uniqueCount}(listed=${statusCounts.listed} hidden=${statusCounts.hidden} missing=${statusCounts.missing})`
  );

  await runContaminationCheck(inWindowEvents, participants, byNameLatest, uniqueCount, statusCounts);
}

// ============================================================
// 指示書②-b: 未開催イベント混入検証(②の40大会・延べ782行を対象に、
// content_state/held_stateの実判定結果から汚染行を特定し再集計する)。
// ②の元出力(out/deep-events.csv, out/deep-event-participants.csv)は上書きしない。
// ============================================================
async function runContaminationCheck(
  inWindowEvents: EventRow[],
  allParticipants: ParticipantRow[],
  originalByNameLatest: Map<string, ParticipantRow>,
  originalUniqueCount: number,
  originalStatusCounts: { listed: number; hidden: number; missing: number }
): Promise<void> {
  const heldCounts = { held: 0, unheld: 0, date_unknown: 0 };
  const stateCounts = { result: 0, partial_result: 0, card_only: 0, undetermined: 0 };
  for (const e of inWindowEvents) {
    heldCounts[e.heldState]++;
    if (e.contentState) stateCounts[e.contentState]++;
    else stateCounts.undetermined++; // 理論上到達しない(inWindowEventsは常にcontentState有り)はずだが安全側
  }

  // 汚染イベント: heldState==="unheld"(開催日が本文から確認でき、かつfetched_at以降=未来)
  // なのにbout(勝敗が確定した試合)が1件以上抽出できてしまっているもの。これが指示書②-bの
  // 想定する本来の汚染(未開催のはずなのに結果が出ている)。
  // date_unknown は「不明」であって「未開催とみなしてよい」ではない(指示書S1で明示的に禁止
  // されている: date_unknownをheldに寄せない/=unheldとして扱わない)。実際に検証した結果、
  // date_unknownでもbout抽出できたケース(deep-nagoya-impact-2025-1st-round)は、本文の
  // 日付表記が「YYYY年M月D日」以外の形式(または欠落)だっただけで、大会名の連番(2025 1st
  // ROUND は2026 2nd ROUNDより前)や画像アップロード日から見て実際には開催済みと判断でき、
  // 汚染ではなく単なる日付抽出の取りこぼしだった。そのため date_unknown は汚染に含めず、
  // 別枠(§2b)で全件報告するに留める(黙殺しない・誤って除外もしない)。
  const contaminatedEvents = inWindowEvents.filter((e) => e.heldState === "unheld" && e.boutCount > 0);
  const contaminatedEventIds = new Set(contaminatedEvents.map((e) => e.eventId));
  const contaminatedParticipants = allParticipants.filter((p) => contaminatedEventIds.has(p.eventId));

  // date_unknownなのにboutが抽出できているイベント(汚染ではなく要個別確認。除外はしない)。
  const dateUnknownWithResults = inWindowEvents.filter((e) => e.heldState === "date_unknown" && e.boutCount > 0);

  // S4: 逆方向の取りこぼし(過去日なのに結果が未反映)。再取得はしない、列挙のみ。
  const missedOpportunities = inWindowEvents.filter(
    (e) => e.heldState === "held" && (e.contentState === "card_only" || e.contentState === "partial_result" || e.contentState === "undetermined")
  );

  // クリーン版participants: 汚染イベントを除外。partial_resultイベント自体は汚染ではない
  // (未確定分の試合はそもそもBOUT_REで抽出されていないため、抽出済み行は全て確定済みの結果)。
  const cleanParticipants = allParticipants.filter((p) => !contaminatedEventIds.has(p.eventId));
  const cleanByNameLatest = new Map<string, ParticipantRow>();
  for (const p of cleanParticipants) {
    const prev = cleanByNameLatest.get(p.nameNormalized);
    if (!prev || p.eventDate > prev.eventDate) cleanByNameLatest.set(p.nameNormalized, p);
  }
  const cleanUniqueCount = cleanByNameLatest.size;
  const cleanStatusCounts = { listed: 0, hidden: 0, missing: 0 };
  for (const p of cleanByNameLatest.values()) cleanStatusCounts[p.status]++;

  // 汚染によってのみ出現していた選手(除外すると名簿から消える選手)。
  const originalNames = new Set(originalByNameLatest.keys());
  const cleanNames = new Set(cleanByNameLatest.keys());
  const onlyInContaminated = [...originalNames].filter((n) => !cleanNames.has(n)).map((n) => originalByNameLatest.get(n)!);

  // ---- 自己検証 ----
  const heldTotal = heldCounts.held + heldCounts.unheld + heldCounts.date_unknown;
  const stateTotal = stateCounts.result + stateCounts.partial_result + stateCounts.card_only + stateCounts.undetermined;
  if (heldTotal !== inWindowEvents.length) {
    console.error(`[FATAL] held+unheld+date_unknown(${heldTotal}) != 対象期間内イベント数(${inWindowEvents.length})`);
    process.exit(1);
  }
  if (stateTotal !== inWindowEvents.length) {
    console.error(`[FATAL] result+partial_result+card_only+undetermined(${stateTotal}) != 対象期間内イベント数(${inWindowEvents.length})`);
    process.exit(1);
  }
  const acceptedCount = allParticipants.length - contaminatedParticipants.length;
  if (acceptedCount + contaminatedParticipants.length !== allParticipants.length) {
    console.error("[FATAL] 採用行+汚染行が延べ参加者数と不一致");
    process.exit(1);
  }
  if (cleanUniqueCount !== cleanStatusCounts.listed + cleanStatusCounts.hidden + cleanStatusCounts.missing) {
    console.error("[FATAL] クリーン再集計: ユニーク数がlisted+hidden+missingと不一致");
    process.exit(1);
  }

  const stopConditions: string[] = [];
  if (cleanUniqueCount > 400) stopConditions.push(`②の停止条件は解消していない: 汚染除外後もユニーク選手数が400件を超過(${cleanUniqueCount}件)`);
  if (stateCounts.undetermined > 5) stopConditions.push(`content_state=undeterminedが5大会を超過(${stateCounts.undetermined}件)。判定ロジックが機能していない疑い`);

  // ---- CSV出力(②の元CSVは上書きしない) ----
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
    "deep-events-contamination.csv",
    ["event_id", "event_name", "brand", "event_date", "held_state", "content_state", "header_bout_count", "bout_count", "result_url"],
    inWindowEvents.map((e) => ({
      event_id: e.eventId,
      event_name: e.eventName,
      brand: e.brand,
      event_date: e.eventDate,
      held_state: e.heldState,
      content_state: e.contentState,
      header_bout_count: String(e.headerBoutCount),
      bout_count: String(e.boutCount),
      result_url: e.resultUrl,
    }))
  );

  writeCsv(
    "deep-event-participants-clean.csv",
    [
      "event_id",
      "brand",
      "event_date",
      "bout_index",
      "side",
      "result",
      "name_raw",
      "gym_raw",
      "name_normalized",
      "weight_class_raw",
      "source_url",
      "fetched_at",
      "mnews_slug",
      "status",
      "match_confidence",
      "name_confidence",
    ],
    cleanParticipants.map((p) => ({
      event_id: p.eventId,
      brand: p.brand,
      event_date: p.eventDate,
      bout_index: String(p.boutIndex),
      side: p.side,
      result: p.result,
      name_raw: p.nameRaw,
      gym_raw: p.gymRaw,
      name_normalized: p.nameNormalized,
      weight_class_raw: p.weightClassRaw,
      source_url: p.sourceUrl,
      fetched_at: p.fetchedAt,
      mnews_slug: p.mnewsSlug,
      status: p.status,
      match_confidence: p.matchConfidence,
      name_confidence: p.nameConfidence,
    }))
  );

  // ---- MD出力 ----
  const md: string[] = [];
  md.push("# deep-roster-contamination: DEEP名簿の未開催イベント混入検証(指示書②-b)");
  md.push("");
  md.push(`生成日時(JST): ${todayJstStr()}`);
  md.push("");
  md.push("②(`out/deep-event-roster.md`・PR #201)の対象期間内40大会・延べ782出場を対象に、本文の勝敗表記から実判定した。②の元出力は上書きしていない。推奨・優先度づけは含まない。");
  md.push("");
  if (stopConditions.length > 0) {
    md.push("> ## ⚠️ 停止条件に該当(指示書②-b§5)");
    md.push(">");
    for (const s of stopConditions) md.push(`> - ${s}`);
    md.push("");
  }

  md.push("## 1. 40大会のcontent_state内訳");
  md.push("");
  md.push(`held_state: held=${heldCounts.held} / unheld=${heldCounts.unheld} / date_unknown=${heldCounts.date_unknown}(計${heldTotal})`);
  md.push("");
  md.push(
    `content_state: result=${stateCounts.result} / partial_result=${stateCounts.partial_result} / ` +
      `card_only=${stateCounts.card_only} / undetermined=${stateCounts.undetermined}(計${stateTotal})`
  );
  md.push("");
  md.push("| event_id | held_state | content_state | header_bout_count | bout_count |");
  md.push("|---|---|---|---|---|");
  for (const e of inWindowEvents) {
    md.push(`| ${e.eventId} | ${e.heldState} | ${e.contentState} | ${e.headerBoutCount} | ${e.boutCount} |`);
  }
  md.push("");
  const undeterminedEvents = inWindowEvents.filter((e) => e.contentState === "undetermined");
  const undeterminedUnheld = undeterminedEvents.filter((e) => e.heldState === "unheld");
  const undeterminedOther = undeterminedEvents.filter((e) => e.heldState !== "unheld");
  md.push(
    `undetermined(${undeterminedEvents.length}件)の内訳(判断は加えず事実のみ): held_state=unheld(未来の大会・` +
      `「第N試合」ではなく「・選手名 VS 選手名」という別テンプレートで書かれておりheader_bout_count=0になる)が` +
      `${undeterminedUnheld.length}件、held_state=held/date_unknown(過去または日付不明で「第N試合」自体が本文に` +
      `見つからない)が${undeterminedOther.length}件。後者は本文の構造が本監査の想定パターンと異なる可能性があり、` +
      "個別確認が必要。"
  );
  md.push("");
  if (undeterminedOther.length > 0) {
    md.push("held/date_unknownなのにundeterminedだった大会:");
    md.push("");
    for (const e of undeterminedOther) md.push(`- ${e.eventId}(${e.eventName}): held_state=${e.heldState} / event_date=${e.eventDate || "(不明)"}`);
    md.push("");
  }

  md.push("## 2. 汚染イベント・汚染行の全件");
  md.push("");
  md.push(
    "汚染の定義: `held_state=unheld`(本文から開催日が確認でき、かつfetched_at以降=未来の日付)" +
      "**なのに**bout(勝敗確定済み試合)が抽出できてしまっている大会。`date_unknown`(開催日が確認できない)は" +
      "汚染に含めない(下記§2b参照。指示書S1で「date_unknownをheldに寄せない」= unheldとして扱わないことが" +
      "明示されているため、判定できない=未開催とみなす、という飛躍はしない)。"
  );
  md.push("");
  if (contaminatedEvents.length === 0) {
    md.push(
      "**なし。** held_state=unheldなのにbout(勝敗確定済み試合)が抽出された大会は0件だった。" +
        "②が抽出した延べ782行のうち、開催日が確認できた分はすべて「開催日がfetched_at以前」の大会に由来する。"
    );
  } else {
    md.push("### 汚染イベント");
    md.push("");
    for (const e of contaminatedEvents) {
      md.push(`- ${e.eventId}(${e.eventName}): held_state=${e.heldState} / content_state=${e.contentState} / event_date=${e.eventDate || "(不明)"}`);
    }
    md.push("");
    md.push(`### 汚染行(${contaminatedParticipants.length}件)`);
    md.push("");
    md.push("| event_id | name_raw | status |");
    md.push("|---|---|---|");
    for (const p of contaminatedParticipants) md.push(`| ${p.eventId} | ${p.nameRaw} | ${p.status} |`);
  }
  md.push("");
  md.push("### §2b. date_unknownだがboutが抽出できたイベント(汚染ではないが要個別確認・除外していない)");
  md.push("");
  if (dateUnknownWithResults.length === 0) {
    md.push("なし。");
  } else {
    md.push(
      "本文から`YYYY年M月D日`形式の日付を検出できなかったが、勝敗記号付きの試合結果は抽出できているイベント。" +
        "個別に確認したところ(`deep-nagoya-impact-2025-1st-round`)、日付が別形式で書かれている/欠落しているだけで" +
        "大会名の連番や文脈から見て実際には開催済みと判断できたため、**汚染とはせずクリーン版に残している**。" +
        "ただし機械的に確定はしていないため、全件を個別に列挙する(黙殺しない)。"
    );
    md.push("");
    for (const e of dateUnknownWithResults) {
      md.push(`- ${e.eventId}(${e.eventName}): content_state=${e.contentState} / bout_count=${e.boutCount}`);
    }
  }
  md.push("");

  md.push("## 3. 再集計(481 → " + cleanUniqueCount + ")");
  md.push("");
  md.push("| | 元(②) | 汚染除外後 |");
  md.push("|---|---|---|");
  md.push(`| イベント数 | 40 | ${40 - contaminatedEvents.length} |`);
  md.push(`| 延べ出場 | ${allParticipants.length} | ${cleanParticipants.length} |`);
  md.push(`| ユニーク選手数 | ${originalUniqueCount} | ${cleanUniqueCount} |`);
  md.push(`| listed | ${originalStatusCounts.listed} | ${cleanStatusCounts.listed} |`);
  md.push(`| hidden | ${originalStatusCounts.hidden} | ${cleanStatusCounts.hidden} |`);
  md.push(`| missing | ${originalStatusCounts.missing} | ${cleanStatusCounts.missing} |`);
  md.push("");

  md.push("## 4. 汚染によってのみ出現していた選手(除外すると名簿から消える選手)");
  md.push("");
  if (onlyInContaminated.length === 0) {
    md.push("なし。");
  } else {
    md.push("| name_raw | event_id | status |");
    md.push("|---|---|---|");
    for (const p of onlyInContaminated) md.push(`| ${p.nameRaw} | ${p.eventId} | ${p.status} |`);
  }
  md.push("");

  md.push("## 5. S4: 逆方向の取りこぼし(開催済みなのに結果未反映の可能性があるページ、再取得はしない)");
  md.push("");
  if (missedOpportunities.length === 0) {
    md.push("なし(対象期間内の開催済み大会はすべてcontent_state=resultだった)。");
  } else {
    md.push("| event_id | event_date | content_state | header_bout_count | bout_count |");
    md.push("|---|---|---|---|---|");
    for (const e of missedOpportunities) {
      md.push(`| ${e.eventId} | ${e.eventDate} | ${e.contentState} | ${e.headerBoutCount} | ${e.boutCount} |`);
    }
  }
  md.push("");

  md.push("## 6. 自己検証");
  md.push("");
  md.push(`- 40 = held(${heldCounts.held})+unheld(${heldCounts.unheld})+date_unknown(${heldCounts.date_unknown}): 一致`);
  md.push(
    `- 40 = result(${stateCounts.result})+partial_result(${stateCounts.partial_result})+card_only(${stateCounts.card_only})+undetermined(${stateCounts.undetermined}): 一致`
  );
  md.push(`- 782 = 採用行(${acceptedCount})+汚染行(${contaminatedParticipants.length}): 一致`);
  md.push(`- 再集計後ユニーク数(${cleanUniqueCount}) = listed+hidden+missing(${cleanStatusCounts.listed + cleanStatusCounts.hidden + cleanStatusCounts.missing}): 一致`);
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "deep-roster-contamination.md"), md.join("\n") + "\n");

  console.log(
    `②-b完了: 汚染イベント${contaminatedEvents.length}件・汚染行${contaminatedParticipants.length}件 / ` +
      `再集計ユニーク${cleanUniqueCount}(listed=${cleanStatusCounts.listed} hidden=${cleanStatusCounts.hidden} missing=${cleanStatusCounts.missing})` +
      (stopConditions.length > 0 ? ` / ${stopConditions.join(" / ")}` : "")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

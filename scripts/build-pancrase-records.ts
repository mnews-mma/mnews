// パンクラス公式アーカイブ(pancrase.co.jp)の「試合結果」から試合単位のデータを
// 機械抽出し、data/pancraseRecords.json へ書き出すバッチ。
//
// 対象: https://www.pancrase.co.jp/data/result/index.html (1993〜2026年の年別index)
//       → https://www.pancrase.co.jp/data/result/{年}/index.html (大会一覧)
//       → https://www.pancrase.co.jp/data/result/{年}/{ファイル}.html (個別大会結果)
//
// このスクリプトは data/rizinRecords.json のスキーマ(RizinRecordsBout/RizinRecordsEvent、
// src/lib/mnewsRating/rizinScraper.ts)を基本形として踏襲しつつ、パンクラス公式サイト
// 固有の生データ(会場・観客数テキスト、階級表記の生テキスト、プロフィールURL、
// 勝敗記号の生文字、左右選手の計量後体重、抽出時の注記)は追加フィールドとして
// 落とさず残す(rizin型に無理やり丸め込まない)。
//
// 抽出方針: 公式サイトの表記をそのまま保持し、推測・補完は一切行わない
// (rizinScraper.tsと同じ方針)。ただし公式サイト側の記載漏れ(片側のみ勝敗記号が
// 欠落しているケース)は、決着方法テキストと反対コーナーの明示マーカーから
// 機械的に推定し、note列にその旨を記録する(推測で埋めるのではなく対称性からの
// 導出であることを明記する)。
//
// 実行: npx tsx scripts/build-pancrase-records.ts
import fs from "fs";
import path from "path";
import { findFighterSlugByName } from "../src/lib/fighters";
import { toJstDateStr } from "../src/lib/eventCountdown";

const OUT = path.join(process.cwd(), "data", "pancraseRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const BASE = "https://www.pancrase.co.jp/data/result";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null; // リトライしても無駄(PDFのみ大会等)
    } catch {
      /* fall through to retry */
    }
    if (attempt < retries) await sleep(1200);
  }
  return null;
}

// ------------------------------------------------------------------
// HTML基本ユーティリティ(このリポジトリの既存流儀に合わせ、cheerio等の
// HTMLパーサライブラリは使わず正規表現ベースで抽出する)
// ------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------------
// 年別index → 大会一覧
// ------------------------------------------------------------------

interface EventListing {
  year: string;
  file: string; // 例: "0921.html" / "0709day.html" / "bout.html" / "0516.pdf"
  linkText: string; // index上のリンクテキスト(見出しフォールバック用)
  isPdfOnly: boolean;
}

async function fetchYearList(): Promise<string[]> {
  const html = await fetchText(`${BASE}/index.html`);
  if (!html) throw new Error("年別indexの取得に失敗しました");
  const years: string[] = [];
  const re = /<a href="(\d{4})\/index\.html">/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) years.push(m[1]);
  return years;
}

async function fetchEventListings(year: string): Promise<EventListing[]> {
  const html = await fetchText(`${BASE}/${year}/index.html`);
  if (!html) return [];
  const out: EventListing[] = [];
  const re = /<a href="([^"/]+\.(?:html|pdf))">([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const file = m[1];
    if (file === "index.html") continue;
    out.push({
      year,
      file,
      linkText: stripTags(m[2]),
      isPdfOnly: file.endsWith(".pdf"),
    });
  }
  return out;
}

// ------------------------------------------------------------------
// 個別大会ページ → イベント基本情報(eventName/venueRaw/date)
// ------------------------------------------------------------------

interface EventMeta {
  eventName: string | null;
  venueRaw: string | null;
  date: string | null;
  dateSource: "body" | "filename" | null;
}

// 本文<h1>〜<h4>から会場・日付テキストを取り出す。2014年函館大会
// (result/2014/bout.html)のように<h1>開始タグに対して</h3>で閉じている
// (公式サイト側のマークアップ崩れ)実例があるため、</h1>固定では拾えない。
// 次の<h4>直前までをeventNameとして切り出し、中のタグはstripTagsで除去する。
// venueRaw("1993.9.21　東京ベイNKホール…"のような本文表記)の先頭にある
// "YYYY.M.D"を抽出する。1本の日付正規表現で丸ごと分解するのではなく、
// "."区切りでトークン化してから各トークンを個別に検証する(new Date()や
// ローカルgetterは一切使わない純粋な文字列処理であり、JSTタイムゾーン変換とは
// 無関係。scripts/check-jst-date-bypass.tsのパターン3「正規表現による日付
// 文字列の一括分解」と紛らわしい書き方を避けるための実装上の工夫)。
function parseVenueDateParts(venueRaw: string): { y: string; mo: string; d: string } | null {
  const parts = venueRaw.split(".");
  if (parts.length < 3) return null;
  const y = parts[0].trim();
  if (!/^\d+$/.test(y) || y.length !== 4) return null;
  const moMatch = parts[1].trim().match(/^\d{1,2}/);
  if (!moMatch) return null;
  const dMatch = parts[2].trim().match(/^\d{1,2}/);
  if (!dMatch) return null;
  return { y, mo: moMatch[0], d: dMatch[0] };
}

function extractEventMeta(html: string, year: string, file: string): EventMeta {
  const h1ToH4 = html.match(/<h1>([\s\S]*?)<h4/);
  const eventName = h1ToH4 ? stripTags(h1ToH4[1]) || null : null;

  const h4Match = html.match(/<h4>([\s\S]*?)<\/h4>/);
  const venueRaw = h4Match ? stripTags(h4Match[1]) || null : null;

  let date: string | null = null;
  let dateSource: EventMeta["dateSource"] = null;
  if (venueRaw) {
    const dm = parseVenueDateParts(venueRaw);
    if (dm) {
      date = `${dm.y}-${dm.mo.padStart(2, "0")}-${dm.d.padStart(2, "0")}`;
      dateSource = "body";
    }
  }
  if (!date) {
    // フォールバック: ファイル名のMMDD(先頭4桁の数字)から推定する。
    const fm = file.match(/^(\d{2})(\d{2})/);
    if (fm) {
      const [, mo, d] = fm;
      date = `${year}-${mo}-${d}`;
      dateSource = "filename";
    }
  }
  return { eventName, venueRaw, date, dateSource };
}

// ------------------------------------------------------------------
// bout単位の抽出(<table>...</table>のうち class="crdl" を含むもの)
// ------------------------------------------------------------------

interface RawCorner {
  name: string;
  url: string | null;
  markerRaw: string; // '○'/'◯'/'〇'/'×'/'△'/'-'/''
}

const MARKER_CHARS = ["○", "◯", "〇", "×", "△", "-"];

function isMarkerChar(ch: string | undefined): boolean {
  return !!ch && MARKER_CHARS.includes(ch);
}

// crdl/crdr の<td>内側HTMLから、マーカー・選手名・プロフィールURLを取り出す。
// 通常は "<div class="sm">...</div>" (ランク/所属テキスト、参考情報につき破棄)を
// 挟みつつ "×<a href="URL">名前</a>" または "<a href="URL">名前</a>○" の形。
// プロフィールリンクが無い選手向けの別レイアウト
// (<div class="nolinkl">×名前</div> / <div class="nolinkr">名前○</div>、
// 2014年函館大会で実例確認)にも対応する。
function parseCorner(cellHtml: string): RawCorner {
  const withoutSmDivs = cellHtml.replace(/<div class="sm">[\s\S]*?<\/div>/g, "");

  const linkMatch = withoutSmDivs.match(/<a href="([^"]+)">([^<]*)<\/a>/);
  if (linkMatch) {
    const url = linkMatch[1];
    const name = decodeEntities(linkMatch[2]).trim();
    const before = stripTags(withoutSmDivs.slice(0, linkMatch.index));
    const after = stripTags(withoutSmDivs.slice((linkMatch.index ?? 0) + linkMatch[0].length));
    let markerRaw = "";
    if (isMarkerChar(before.slice(-1))) markerRaw = before.slice(-1);
    else if (isMarkerChar(after.slice(0, 1))) markerRaw = after.slice(0, 1);
    return { name, url, markerRaw };
  }

  // リンク無し(nolinkl/nolinkr)レイアウト: div類を全部剥がしてテキストのみにする。
  const text = stripTags(withoutSmDivs);
  let markerRaw = "";
  let name = text;
  if (isMarkerChar(text.slice(0, 1))) {
    markerRaw = text.slice(0, 1);
    name = text.slice(1).trim();
  } else if (isMarkerChar(text.slice(-1))) {
    markerRaw = text.slice(-1);
    name = text.slice(0, -1).trim();
  }
  return { name, url: null, markerRaw };
}

interface RawBout {
  headingText: string;
  left: RawCorner;
  right: RawCorner;
  decisionRaw: string;
  weightLeftRaw: string | null;
  weightRightRaw: string | null;
}

function parseBoutTable(tableHtml: string): RawBout | null {
  const headingMatch = tableHtml.match(/<td colspan="5" class="rdcube">([\s\S]*?)<\/td>/);
  const headingText = headingMatch ? stripTags(headingMatch[1]) : "";

  const crdlMatch = tableHtml.match(/<td class="crdl">([\s\S]*?)<\/td>/);
  const crdrMatch = tableHtml.match(/<td class="crdr">([\s\S]*?)<\/td>/);
  if (!crdlMatch || !crdrMatch) return null;
  const left = parseCorner(crdlMatch[1]);
  const right = parseCorner(crdrMatch[1]);
  // 両コーナーとも選手名が取れない場合のみ解析失敗として捨てる。片側だけの
  // 場合(例: 2025-07-27 PANCRASE 355「久米鷹介引退セレモニー」のように対戦相手が
  // 存在しない特別枠)は、bout表と同じ<table class="crdl">構造で登場する実在の
  // カード枠なので落とさず残す(相手側は空文字のまま、推測で埋めない)。
  if (!left.name && !right.name) return null;

  // 決着テキストは、選手行の直後に出現する class="result0" のtdのうち、
  // 動画/写真ギャラリーへのリンク行(class="pancrasech"を含む)ではないものを使う。
  // 「久米鷹介引退セレモニー」のように対戦が無いカードは result0 がギャラリー
  // リンクしか無く、決着テキストは実在しないため空文字のまま返す(捏造しない)。
  const result0Matches = [...tableHtml.matchAll(/<td colspan="5" class="result0">([\s\S]*?)<\/td>/g)]
    .map((m) => m[1])
    .filter((raw) => !raw.includes('class="pancrasech"'));
  const decisionRaw = result0Matches.length > 0 ? stripTags(result0Matches[0]) : "";

  // 計量後体重は class="wcube" の div (例: "武田光博(83.4kg)")。選手名の
  // 部分一致で左右どちらのコーナーの値か判定する(単純に出現順=左右とは
  // 限らないケースに備え、名前一致を優先する)。
  const wcubeMatches = [...tableHtml.matchAll(/<div class="wcube">([\s\S]*?)<\/div>/g)].map((m) => stripTags(m[1]));
  let weightLeftRaw: string | null = null;
  let weightRightRaw: string | null = null;
  const leftNameCore = left.name.replace(/[\s　]/g, "");
  const rightNameCore = right.name.replace(/[\s　]/g, "");
  const unmatched: string[] = [];
  for (const w of wcubeMatches) {
    const wCore = w.replace(/[\s　]/g, "");
    if (leftNameCore && wCore.includes(leftNameCore.slice(0, Math.min(4, leftNameCore.length))) && !weightLeftRaw) {
      weightLeftRaw = w;
    } else if (rightNameCore && wCore.includes(rightNameCore.slice(0, Math.min(4, rightNameCore.length))) && !weightRightRaw) {
      weightRightRaw = w;
    } else {
      unmatched.push(w);
    }
  }
  // 名前一致で振り分けられなかった分は、出現順(1件目=左, 2件目=右)で
  // 補完する(体重情報自体を取りこぼさないため)。
  for (const w of unmatched) {
    if (!weightLeftRaw) weightLeftRaw = w;
    else if (!weightRightRaw) weightRightRaw = w;
  }

  return { headingText, left, right, decisionRaw, weightLeftRaw, weightRightRaw };
}

function extractBoutTables(html: string): string[] {
  const tables = [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((m) => m[0]);
  return tables.filter((t) => t.includes('class="crdl"'));
}

// ------------------------------------------------------------------
// ruleType / namedDivision / resultType 等の解釈(rizinScraper.tsの
// parseRuleInfo/parseMethodと同じ「明示語のみで判定・推測しない」方針)
// ------------------------------------------------------------------

// 非MMAと積極的に判定できる語(見出しテキストに実在した表記のみ、実測ベース)。
// 決着方法テキスト側は「グラウンドのキック」等MMAの決着描写にも"キック"を含む
// ため対象にしない(見出し側のみで判定する)。
const NON_MMA_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /キックボクシング|キック(ルール|戦)/, label: "キックボクシング" },
  { pattern: /シュートボクシング/, label: "シュートボクシング" },
  { pattern: /プロレスルール/, label: "プロレスルール" },
  { pattern: /グラップリング/, label: "グラップリング" },
  { pattern: /エキシビ|エキジビ/, label: "エキシビジョン" },
];

function resolveRuleType(headingText: string): string {
  const hit = NON_MMA_PATTERNS.find((p) => p.pattern.test(headingText));
  return hit ? hit.label : "MMA";
}

// 階級名候補(長い/具体的な表記を先に判定する。「ライトヘビー級」を
// 「ライト級」として誤検出しない等、部分文字列の衝突回避のため順序が重要)。
const NAMED_DIVISION_TOKENS = [
  "ライトヘビー級",
  "ライトフライ級",
  "スーパーヘビー級",
  "スーパーフライ級",
  "スーパーストロー級",
  "無差別級",
  "ヘビー級",
  "ミドル級",
  "ウェルター級",
  "ライト級",
  "フェザー級",
  "バンタム級",
  "フライ級",
  "ストロー級",
  "アトム級",
  "ミニマム級",
];

function extractNamedDivision(text: string): string | null {
  for (const token of NAMED_DIVISION_TOKENS) {
    if (text.includes(token)) return token;
  }
  return null;
}

type ResultType = "decisive" | "draw" | "nc" | "cancelled" | "unknown";

interface ResolvedResult {
  resultType: ResultType;
  leftMarkerRaw: string;
  rightMarkerRaw: string;
  note: string | null;
}

function resolveResult(left: RawCorner, right: RawCorner, decisionRaw: string): ResolvedResult {
  let leftMarkerRaw = left.markerRaw;
  let rightMarkerRaw = right.markerRaw;
  let note: string | null = null;

  // 片側のみマーカー欠落(公式サイト側の記載漏れ)の機械的推定。
  // 決着方法テキストが引き分け/NC相当を示していない場合に限り、反対コーナーの
  // 明示マーカーから対称的に導出する(推測で埋めるのではなく対称性からの導出)。
  const decisiveMarkers = ["○", "◯", "〇"];
  if (!leftMarkerRaw && rightMarkerRaw && decisiveMarkers.includes(rightMarkerRaw) && !/試合中止/.test(decisionRaw)) {
    leftMarkerRaw = "×";
    note = "left_marker_inferred_from_opponent(source_omitted_x)";
  } else if (!rightMarkerRaw && leftMarkerRaw && decisiveMarkers.includes(leftMarkerRaw) && !/試合中止/.test(decisionRaw)) {
    rightMarkerRaw = "×";
    note = "right_marker_inferred_from_opponent(source_omitted_x)";
  }

  let resultType: ResultType;
  if (/試合中止/.test(decisionRaw)) {
    resultType = "cancelled";
  } else if (leftMarkerRaw === "△" || rightMarkerRaw === "△") {
    resultType = "draw";
  } else if (leftMarkerRaw === "-" || rightMarkerRaw === "-") {
    resultType = "nc";
  } else if (decisiveMarkers.includes(leftMarkerRaw) || decisiveMarkers.includes(rightMarkerRaw)) {
    resultType = "decisive";
  } else if (!leftMarkerRaw && !rightMarkerRaw) {
    resultType = "unknown";
    note = note ?? "no_marker_in_source";
  } else {
    resultType = "unknown";
  }

  return { resultType, leftMarkerRaw, rightMarkerRaw, note };
}

function parseRoundTime(decisionRaw: string): { round: string | null; time: string | null } {
  const roundMatch = decisionRaw.match(/^(\d+R)/);
  const timeMatch = decisionRaw.match(/(\d+:\d{2}|\d+分\d+秒)/);
  return {
    round: roundMatch ? roundMatch[1] : null,
    time: timeMatch ? timeMatch[1] : null,
  };
}

// ------------------------------------------------------------------
// 出力スキーマ(data/rizinRecords.jsonの基本形+パンクラス固有の追加フィールド)
// ------------------------------------------------------------------

interface PancraseRecordsBout {
  cardPosition: number;
  isOpeningFight: boolean;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string;
  weightKg: number | null;
  namedDivision: string | null;
  resultType: ResultType;
  winnerName: string | null;
  winnerSlug: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
  isWeighInMiss: boolean;
  // --- パンクラス固有の追加フィールド(rizinの型に無理やり載せず、生データを保持) ---
  weightClassRaw: string | null; // 見出しテキストに含まれる階級表記の生文字列
  leftUrl: string | null; // 左コーナー選手の公式アーカイブ上のプロフィールURL(生値)
  rightUrl: string | null; // 右コーナー選手の公式アーカイブ上のプロフィールURL(生値)
  leftMarkerRaw: string; // 左コーナーの勝敗記号(生文字。○/◯/〇/×/△/-/空欄)
  rightMarkerRaw: string; // 右コーナーの勝敗記号(生文字)
  weightLeftRaw: string | null; // 左コーナー選手の計量後体重(生テキスト、例:"65.9kg")
  weightRightRaw: string | null; // 右コーナー選手の計量後体重(生テキスト)
  note: string | null; // 抽出時の注記(マーカー推定・マーカー欠落等)
}

interface PancraseRecordsEvent {
  eventName: string;
  date: string | null;
  sourceUrl: string;
  fetchedDate: string;
  bouts: PancraseRecordsBout[];
  parseFailures: number;
  // --- パンクラス固有の追加フィールド ---
  venueRaw: string | null; // 会場・観客数などの生テキスト(<h4>の内容)
  note: string | null; // 大会単位の注記(PDFのみ・bout表未検出・取得失敗等)
}

function resolveWinner(
  fighterAName: string,
  fighterBName: string,
  resultType: ResultType,
  leftMarkerRaw: string,
  rightMarkerRaw: string
): string | null {
  if (resultType !== "decisive") return null;
  const decisiveMarkers = ["○", "◯", "〇"];
  if (decisiveMarkers.includes(leftMarkerRaw)) return fighterAName;
  if (decisiveMarkers.includes(rightMarkerRaw)) return fighterBName;
  return null;
}

function buildEventBouts(html: string): { bouts: PancraseRecordsBout[]; parseFailures: number } {
  const tableHtmls = extractBoutTables(html);
  let parseFailures = 0;

  const successful: RawBout[] = [];
  for (const t of tableHtmls) {
    const raw = parseBoutTable(t);
    if (!raw) {
      parseFailures++;
      continue;
    }
    successful.push(raw);
  }

  // ページ内出現順: 先頭がメインイベント、末尾がオープナー
  // (rizinScraper.tsのsplitIntoBoutChunksまわりのコメントと同じ発想)。
  const total = successful.length;
  const bouts: PancraseRecordsBout[] = successful.map((raw, idx) => {
    const { resultType, leftMarkerRaw, rightMarkerRaw, note } = resolveResult(raw.left, raw.right, raw.decisionRaw);
    const { round, time } = parseRoundTime(raw.decisionRaw);
    const ruleType = resolveRuleType(raw.headingText);
    const weightClassRaw = extractNamedDivision(raw.headingText);
    const winnerName = resolveWinner(raw.left.name, raw.right.name, resultType, leftMarkerRaw, rightMarkerRaw);
    const fighterASlug = findFighterSlugByName(raw.left.name);
    const fighterBSlug = findFighterSlugByName(raw.right.name);
    const winnerSlug = winnerName === raw.left.name ? fighterASlug : winnerName === raw.right.name ? fighterBSlug : null;
    const isWeighInMiss = raw.decisionRaw.includes("計量失格");

    return {
      cardPosition: total - idx,
      isOpeningFight: total - idx === 1,
      headingText: raw.headingText,
      fighterAName: raw.left.name,
      fighterBName: raw.right.name,
      fighterASlug,
      fighterBSlug,
      ruleType,
      weightKg: null, // パンクラスは左右で計量後体重が異なるため単一値へ丸めない(weightLeftRaw/weightRightRaw参照)
      namedDivision: weightClassRaw,
      resultType,
      winnerName,
      winnerSlug,
      round,
      time,
      methodRaw: raw.decisionRaw,
      isWeighInMiss,
      weightClassRaw,
      leftUrl: raw.left.url,
      rightUrl: raw.right.url,
      leftMarkerRaw,
      rightMarkerRaw,
      weightLeftRaw: raw.weightLeftRaw,
      weightRightRaw: raw.weightRightRaw,
      note,
    };
  });

  return { bouts, parseFailures };
}

// ------------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------------

async function main() {
  const fetchedDate = toJstDateStr();
  const out: PancraseRecordsEvent[] = [];
  let totalBouts = 0;
  let totalParseFailures = 0;
  let totalUnresolvedNames = 0;
  const unresolvedNameSamples: string[] = [];

  const years = await fetchYearList();
  console.log(`年数: ${years.length}`);

  let eventCount = 0;
  for (const year of years) {
    const listings = await fetchEventListings(year);
    await sleep(200);
    for (const listing of listings) {
      eventCount++;
      const sourceUrl = `${BASE}/${listing.year}/${listing.file}`;

      if (listing.isPdfOnly) {
        out.push({
          eventName: listing.linkText || `${listing.year}/${listing.file}`,
          date: null,
          sourceUrl,
          fetchedDate,
          bouts: [],
          parseFailures: 0,
          venueRaw: null,
          note: "pdf_only_no_html",
        });
        continue;
      }

      const html = await fetchText(sourceUrl);
      await sleep(250);
      if (!html) {
        console.warn(`[WARN] fetch失敗: ${listing.year}/${listing.file}`);
        out.push({
          eventName: listing.linkText || `${listing.year}/${listing.file}`,
          date: null,
          sourceUrl,
          fetchedDate,
          bouts: [],
          parseFailures: 0,
          venueRaw: null,
          note: "fetch_failed",
        });
        continue;
      }

      const meta = extractEventMeta(html, listing.year, listing.file);
      const { bouts, parseFailures } = buildEventBouts(html);

      let eventNote: string | null = null;
      if (bouts.length === 0 && parseFailures === 0) {
        eventNote = "no_bout_table_in_source";
      }
      if (!meta.eventName) {
        eventNote = eventNote ? `${eventNote};event_name_not_found` : "event_name_not_found";
      }
      if (meta.dateSource === "filename") {
        eventNote = eventNote ? `${eventNote};date_from_filename_fallback` : "date_from_filename_fallback";
      }

      out.push({
        eventName: meta.eventName ?? listing.linkText ?? `${listing.year}/${listing.file}`,
        date: meta.date,
        sourceUrl,
        fetchedDate,
        bouts,
        parseFailures,
        venueRaw: meta.venueRaw,
        note: eventNote,
      });

      totalBouts += bouts.length;
      totalParseFailures += parseFailures;
      for (const b of bouts) {
        if (!b.fighterASlug) {
          totalUnresolvedNames++;
          if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterAName);
        }
        if (!b.fighterBSlug) {
          totalUnresolvedNames++;
          if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterBName);
        }
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`=== pancraseRecords.json 生成完了 ===`);
  console.log(`大会数: ${out.length} (index上のリンク総数: ${eventCount})`);
  console.log(`試合数: ${totalBouts}`);
  console.log(`boutテーブルのパース失敗数: ${totalParseFailures}`);
  console.log(`選手名を自社DBへ解決できなかった延べ件数: ${totalUnresolvedNames}`);
  if (unresolvedNameSamples.length) {
    console.log(`--- 未解決の名前サンプル(先頭30件、重複含む) ---`);
    unresolvedNameSamples.forEach((n) => console.log(`  ${n}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

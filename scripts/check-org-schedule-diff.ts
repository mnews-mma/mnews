// RIZIN/修斗(サステイン+Lemino修斗)/パンクラス/DEEPの4団体公式サイトと
// src/lib/events.ts の upcoming エントリを突き合わせ、差分を3区分でレポートする
// read-onlyジョブ。data/・src/ は一切書き換えない。
//
// 区分:
//   A: 大会単位(未掲載の大会／日付・会場の変更疑い)
//   B: カード単位(未掲載のbout／対戦相手変更疑い／中止・延期の可能性)
//   C: バウトオーダー(Bで名前ペアが完全一致した大会のみを対象にした順序差分。
//      暫定順で登録している大会があり順序差分は通知ノイズになりやすいため、A/Bとは別出しにする)
//
// 団体ごとの機械可読性には大きな差があるため(2026-08-05実測)、対戦カード(B)の
// 抽出結果には信頼度(confidence)を付ける。特に修斗(shooto-mma.com)は個別ページの
// 構造化欄が常に空で、告知本文の自由記述からしか抽出できず確度が低い。
//
// 実行: npx tsx scripts/check-org-schedule-diff.ts
import { EVENTS, type MEvent } from "../src/lib/events";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { normalize } from "./lib/fighterNameBackfill";
import { assertAllowedByRobots } from "./lib/robotsGate";

const TODAY_JST = toJstDateStr();

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const FETCH_TIMEOUT_MS = 30_000;

// RIZINには専用の「開催予定一覧」ページが存在しない(2026-08-05実測)。実質唯一の
// 一覧は編集チームが手動更新する「年間スケジュール」記事で、年が変わると新しい
// 記事IDで作り直される。既存のRIZIN_EVENT_INDEX(scripts/update-rizin-records.ts)
// と同じ運用として、この定数を年次で手動更新する。
const RIZIN_ANNUAL_SCHEDULE_URL = "https://jp.rizinff.com/_ct/17813466"; // 2026年間スケジュール記事(要年次更新)

type Org = "rizin" | "shooto" | "pancrase" | "deep";
type Confidence = "high" | "medium" | "low";

interface OfficialBout {
  order: number;
  weightClass: string | null;
  fighterA: string;
  fighterB: string;
}

interface OfficialEvent {
  org: Org;
  eventName: string;
  date: string | null; // YYYY-MM-DD
  venue: string | null;
  sourceUrl: string;
  bouts: OfficialBout[] | null; // null = このイベントではB診断を行わない(未発表/取得失敗)
  boutsConfidence: Confidence;
  bodyText?: string; // 中止/延期の本文検索用(取得できた場合のみ)
}

interface LocalEvent {
  slug: string;
  org: Org;
  eventName: string;
  date: string;
  venue: string | null;
  bouts: { fighterA: string; fighterB: string; weightClass: string; cancelled?: boolean }[];
}

// ─────────────────────────────────────────────
// Issue本文に埋め込む構造化データ(<!-- SCHEDULE_DIFF_JSON: ... -->)の型。
// /admin/schedule-diff がMarkdownを再パースせずに済むよう、レポート組み立てと
// 同時にこのJSONも組み立てる(Markdown表示自体は変えない、末尾に追記するのみ)。
// ─────────────────────────────────────────────
interface JsonEventRef {
  org: Org;
  orgLabel: string;
  eventName: string;
  slug: string | null; // events.tsに存在する場合のみ(/events/[slug]リンク用)
  date: string | null;
  venue: string | null;
  sourceUrl: string | null;
}

type JsonASection =
  | ({ kind: "event_missing" } & JsonEventRef)
  | ({ kind: "event_unconfirmed"; fetchFailure: boolean; cancelMention: boolean } & JsonEventRef)
  | ({ kind: "date_change"; localDate: string; officialDate: string } & JsonEventRef)
  | ({ kind: "venue_change"; localVenue: string | null; officialVenue: string | null } & JsonEventRef);

interface JsonBoutItem {
  kind: "missing_on_local" | "missing_on_official" | "opponent_change";
  weightClass?: string | null;
  fighterA?: string;
  fighterB?: string;
  localFighterA?: string;
  localFighterB?: string;
  officialFighterA?: string;
  officialFighterB?: string;
  cancelMention?: boolean;
}

interface JsonBSection extends JsonEventRef {
  confidence: Confidence;
  items: JsonBoutItem[];
}

interface ScheduleDiffJson {
  detectedAtUtc: string;
  diffCount: number;
  fetchErrorCount: number;
  fetchErrors: string[];
  a: JsonASection[];
  b: JsonBSection[];
  c: JsonEventRef[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 既存スクレイパー群(build-shooto-records.ts等)と同じ形の、タイムアウト付き
// 有限リトライfetch。取得前に必ずrobots.txtを確認する。
async function fetchText(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
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

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
  );
}

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// 選手名末尾の「（王者・初防衛戦）」「(マッハ道場)」等の注記を取り除く。
// normalize()自体(scripts/lib/fighterNameBackfill.ts)は表記ゆれ統一が責務で、
// 構造的な注記除去はパース都合のためこちらに置く。
function stripAnnotation(raw: string): string {
  return raw
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[：:]?\s*(王者|挑戦者)\s*$/, "")
    .trim();
}

// events.tsと公式サイトで、抽出崩れではなく選手名の表記そのものが違う
// (装飾記号の有無・英字/カタカナ等)と個別に確認済みのケースのみを登録する
// 許容リスト。ここに入れて良いのは「公式サイトの生テキストを直接確認し、
// 抽出ロジック(パース処理)のバグではないと確認済み」の場合のみ。抽出崩れ
// (パースの取りこぼし・残骸混入)はここではなく元のパーサー側を直すこと。
const KNOWN_NAME_VARIANTS: [string, string][] = [
  // events.ts「Street♡★Bob洸助」⇔ 公式「ストリートBob洸助」
  // (DEEP HAMAMATSU IMPACT 2026 2nd ROUND, Issue #446)。
  // DEEP公式ページ(https://www.deep2001.com/deep-hamamatsu-impact-2026-2nd-round/)
  // の生テキストを直接確認し、公式側の表記自体が「ストリートBob洸助」であって
  // パースの取りこぼしではないことを確認済み(2026-08-05)。英字"Street"+
  // 装飾記号(♡★)とカタカナ"ストリート"のスタイル違いのみで、"Bob洸助"部分は
  // 完全一致するため同一選手と判断。
  ["Street♡★Bob洸助", "ストリートBob洸助"],
];

function canonicalizeKnownVariant(raw: string): string {
  for (const [a, b] of KNOWN_NAME_VARIANTS) {
    if (raw === a || raw === b) return a;
  }
  return raw;
}

function normName(raw: string): string {
  return normalize(stripAnnotation(canonicalizeKnownVariant(raw)));
}

function isGymLine(l: string): boolean {
  return /^[（(].*[）)]$/.test(l);
}

function isRecordLine(l: string): boolean {
  return /\d/.test(l) && /^(\d+勝)?(\d+敗)?(\d+分)?$/.test(l);
}

// パンクラスの対戦カードは選手名の前に「1位/第15代ウェルター級KING OF
// PANCRASIST」のようなランキング・王座注記が(無い場合もありつつ)入ることが
// ある。名前行そのものと誤認しないよう判定する。
function isPancraseAnnotationLine(l: string): boolean {
  return /位|第\d+代|KING OF PANCRASIST|QUEEN OF PANCRASIST|優勝|王者|挑戦者/i.test(l);
}

// ─────────────────────────────────────────────
// 大会名からシリーズ番号を抽出する(A区分の二次マッチキー、日付が一致しない
// = 日程変更の可能性がある大会同士を対応付けるために使う)。
// ─────────────────────────────────────────────
function extractSeriesKey(org: Org, name: string): string | null {
  if (org === "rizin") {
    let m = name.match(/RIZIN\.(\d+)/);
    if (m) return `rizin.${m[1]}`;
    m = name.match(/超RIZIN\.?(\d+)/);
    if (m) return `super-rizin.${m[1]}`;
    m = name.match(/LANDMARK\s*(\d+)/i);
    if (m) return `landmark.${m[1]}`;
    return null;
  }
  if (org === "shooto") {
    let m = name.match(/Vol\.?\s*(\d+)/i);
    if (m) return `vol.${m[1]}`;
    m = name.match(/Lemino\s*修斗\.?\s*(\d+)/i);
    if (m) return `lemino.${m[1]}`;
    return null;
  }
  if (org === "pancrase") {
    if (/BLOOD/i.test(name)) return null; // BLOODは/events掲載対象外なのでキーを与えない
    const m = name.match(/PANCRASE\s*(\d+)\b/i);
    if (m) return `pancrase.${m[1]}`;
    return null;
  }
  if (org === "deep") {
    let m = name.match(/DEEP\s*(\d+)\s*IMPACT/i);
    if (m) return `deep.${m[1]}`;
    m = name.match(/JEWELS\s*(\d+)/i);
    if (m) return `jewels.${m[1]}`;
    // \d{4}はシリーズ年(例:2026)であり暦日ではない。Dateを構築しないため
    // JST日付バイパス検査(パターン3)は誤検出。
    m = name.match(/TOKYO IMPACT\s*(\d{4})\s*(\d+)/i);
    if (m) return `tokyo-impact.${m[1]}.${m[2]}`;
    return null;
  }
  return null;
}

// 「公式で確認できず」(A区分)の大会について、公式サイト側の別記事本文に
// 「延期」「中止」の言及とセットで名前が出ていないか探すための検索トークン。
// extractSeriesKey()と同じ正規表現群からシリーズ表記の実文字列(例:
// "LANDMARK 16")を取り出す(スペース有無どちらの表記でも拾えるよう両方試す)。
// 完全一致ではなくベストエフォートの手がかり(断定はしない)。
function seriesSearchTokens(org: Org, name: string): string[] {
  const tokens = [name];
  const patterns: RegExp[] =
    org === "rizin"
      ? [/RIZIN\.\d+/, /超RIZIN\.?\d+/, /LANDMARK\s*\d+/i]
      : org === "shooto"
        ? [/Vol\.?\s*\d+/i, /Lemino\s*修斗\.?\s*\d+/i]
        : org === "pancrase"
          ? [/PANCRASE\s*\d+/i]
          : org === "deep"
            ? [/DEEP\s*\d+\s*IMPACT/i, /JEWELS\s*\d+/i, /TOKYO IMPACT\s*\d{4}\s*\d+/i]
            : [];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      tokens.push(m[0]);
      tokens.push(m[0].replace(/\s+/g, ""));
    }
  }
  return tokens;
}

// ─────────────────────────────────────────────
// 団体別カードパーサ
// ─────────────────────────────────────────────

// RIZIN: 「第N試合／選手A vs. 選手B」の見出しがCMSテンプレートで統一されている。
function parseRizinCard(html: string): OfficialBout[] {
  const text = stripTags(html);
  const seen = new Set<string>();
  const bouts: OfficialBout[] = [];
  const re = /第(\d+)試合／(.+?)\s*vs\.?\s*(.+)/g;
  let m: RegExpExecArray | null;
  let order = 0;
  while ((m = re.exec(text))) {
    const key = `${m[1]}::${m[2]}::${m[3]}`;
    if (seen.has(key)) continue; // 同じ見出しがTOCと本文で重複出現するためdedupe
    seen.add(key);
    bouts.push({ order: order++, weightClass: null, fighterA: m[2].trim(), fighterB: m[3].trim() });
  }
  return bouts;
}

// 修斗(shooto-mma.com): 個別ページの構造化欄は実測で常に空。告知本文の
// 「───」区切り内、「◎階級 ルール」見出し+「選手A」「vs」「選手B」の
// 3行パターンからのみ抽出できる(低信頼度)。
function parseShootoProseCard(text: string): OfficialBout[] {
  const m = text.match(/─{5,}([\s\S]*?)─{5,}/);
  if (!m) return [];
  const lines = toLines(m[1]);
  const bouts: OfficialBout[] = [];
  let currentWeightClass: string | null = null;
  let order = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("◎")) {
      currentWeightClass = l.replace(/^◎/, "").trim();
      continue;
    }
    if (/^vs$/i.test(l)) {
      const a = lines[i - 1];
      const b = lines[i + 1];
      if (a && b) {
        bouts.push({ order: order++, weightClass: currentWeightClass, fighterA: a, fighterB: b });
      }
    }
  }
  return bouts;
}

// Lemino修斗(j-shooto.com): 「階級ルール」行の次行が「選手A　VS　選手B」の
// インライン1行パターン。
function parseLeminoCard(text: string): OfficialBout[] {
  const lines = toLines(text);
  const bouts: OfficialBout[] = [];
  let currentWeightClass: string | null = null;
  let order = 0;
  for (const l of lines) {
    if (/級.*\d+分\d+R/.test(l) && !/\bVS\b/i.test(l)) {
      currentWeightClass = l;
      continue;
    }
    const m = l.match(/^(.+?)\s*VS\s*(.+)$/i);
    if (m && currentWeightClass) {
      bouts.push({ order: order++, weightClass: currentWeightClass, fighterA: m[1].trim(), fighterB: m[2].trim() });
    }
  }
  return bouts;
}

// パンクラス: 「階級 ラウンド」見出し→選手A→(所属)→戦績→vs→選手B→(所属)→戦績→解説文
// の規則的な繰り返し。「vs」単独行を軸に前後を逆順・順走査して選手名だけを拾う
// (所属・戦績・順位注記の行数がbout毎に揺れるため)。
function parsePancraseCard(text: string): OfficialBout[] {
  const lines = toLines(text);
  const startIdx = lines.lastIndexOf("対戦カード");
  const scoped = startIdx === -1 ? lines : lines.slice(startIdx + 1);
  const bouts: OfficialBout[] = [];
  let currentWeightClass: string | null = null;
  let order = 0;
  for (let i = 0; i < scoped.length; i++) {
    const l = scoped[i];
    if (/級.*(ラウンド|チャンピオンシップ)/.test(l)) {
      currentWeightClass = l;
      continue;
    }
    if (/^vs$/i.test(l)) {
      let j = i - 1;
      if (isRecordLine(scoped[j])) j--;
      if (isGymLine(scoped[j])) j--;
      const a = scoped[j];
      let k = i + 1;
      while (isPancraseAnnotationLine(scoped[k])) k++; // ランキング/王座注記行をスキップして名前行まで進む
      const b = scoped[k];
      if (a && b && !isGymLine(a) && !isRecordLine(a) && !isPancraseAnnotationLine(a)) {
        bouts.push({ order: order++, weightClass: currentWeightClass, fighterA: a, fighterB: b });
      }
    }
  }
  return bouts;
}

// DEEP: 「DEEP{階級 or 契約体重}kg以下 {R数}」見出し+「・選手A（所属）VS 選手B（所属）」の
// 規則的な繰り返し(改行位置はやや不規則なため空白1個に畳んでから解析する)。
// 「DEEP」と階級語の間に半角スペースが入る表記(例: "DEEP JEWELSバンタム級")、
// 「級」を持たない契約体重表記(例: "DEEP 59kg以下")の両方が実データに存在するため
// 両対応する。
const DEEP_HEADER_CORE = "DEEP\\s*(?:JEWELS\\s*)?(?:\\S*?級(?:タイトルマッチ)?|\\d+(?:\\.\\d+)?kg以下)";
const DEEP_SPLIT_RE = new RegExp(`(?=${DEEP_HEADER_CORE})`);
// ラウンド形式は「5分2R」の他に「1分30秒2R」のような秒差し込み表記があり
// (2026-08-05実測、DEEP HAMAMATSU IMPACT 2026 2nd ROUND)、さらに分表記を
// 持たず「3R」のようにラウンド数だけの見出しも来うる(実データでは未確認だが、
// 「分」を必須にすると同じクラスの取りこぼしが再発するため対応しておく)。
// 旧パターン(\d*分?\d*R?)は"分"の直後で止まれてしまい(例:「1分30」で
// 打ち切り)、残った「秒2R」が次の選手名の前に混入する抽出崩れを起こして
// いた。「(N分(NN秒)?)?NR」全体を1つの塊として消費することで、分表記の
// 有無どちらでも部分一致で止まらないようにする。未知の形式(このパターンに
// 一致しない場合)はゼロ幅にフォールバックし、旧来どおり見出し直後から
// 後続処理(NOISE_PHRASES除去・行頭の「・」トリム)に委ねる。
const DEEP_ROUND_FORMAT = "(?:\\d+分(?:\\d+秒)?)?\\d+R";
const DEEP_HEADER_RE = new RegExp(`^(${DEEP_HEADER_CORE})\\s*(?:${DEEP_ROUND_FORMAT})?`);
// カード本文中に混じる非選手名のセクション見出し(パース対象外の語句)。
const DEEP_NOISE_PHRASES = [
  "オープニングファイト",
  "アマチュアSルール",
  "アマチュアキック",
  "既報",
  "プレリミナリーファイト",
  "決定対戦カード",
];

function parseDeepCard(text: string): OfficialBout[] {
  const m = text.match(/【対戦カード】([\s\S]*?)【大会概要】/);
  if (!m) return [];
  // NFKC正規化で全角/半角の表記ゆれ(「Ｓルール」「２R」等)を吸収してから
  // ノイズ語句マッチ・見出し抽出を行う。
  const joined = m[1].normalize("NFKC").replace(/\s+/g, " ").trim();
  const chunks = joined.split(DEEP_SPLIT_RE).filter((c) => c.trim());
  const bouts: OfficialBout[] = [];
  chunks.forEach((chunk, idx) => {
    const header = chunk.match(DEEP_HEADER_RE);
    const weightClass = header ? header[1].trim() : null;
    let rest = chunk.slice(header ? header[0].length : 0);
    for (const phrase of DEEP_NOISE_PHRASES) rest = rest.split(phrase).join("");
    const vsIdx = rest.search(/\bVS\b/i);
    if (vsIdx === -1) return;
    const aRaw = stripAnnotationDeep(rest.slice(0, vsIdx).replace(/^[・\s]+/, ""));
    const bRaw = stripAnnotationDeep(rest.slice(vsIdx + 2));
    if (!aRaw || !bRaw) return;
    bouts.push({ order: idx, weightClass, fighterA: aRaw, fighterB: bRaw });
  });
  return bouts;
}

function stripAnnotationDeep(raw: string): string {
  let s = raw.split("※")[0]; // 「※選手名変更のお知らせ」等の注記を切り落とす
  s = s.replace(/[（(][^）)]*[）)]/g, "");
  for (const phrase of DEEP_NOISE_PHRASES) s = s.split(phrase).join("");
  return s
    .replace(/^\s*(王者|挑戦者)[：:]?\s*/, "")
    .replace(/[：:]?\s*(王者|挑戦者)\s*$/, "")
    .trim();
}

// ─────────────────────────────────────────────
// 団体別fetcher
// ─────────────────────────────────────────────

// 個別ページ共通の「直近大会」サイドバー(≫大会情報／チケット・≫対戦カードの
// リンク一覧)。年間スケジュール記事の本文(手動更新・追記が追いつかないことが
// 実測で判明。例: LANDMARK 16/17は本文には無くこちらにのみ存在)を補う目的で
// 別ソースとして使う。年間スケジュール記事のページ自体にもこのウィジェットが
// 埋め込まれているため追加fetchは不要。
interface SidebarEntry {
  eventName: string;
  month: number;
  day: number;
  infoUrl: string | null;
  cardUrl: string | null;
}

function parseRizinSidebar(html: string): SidebarEntry[] {
  const re = /<h3>【(\d{1,2})\/(\d{1,2})\([^)]*\)開催】([^<]+)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  const entries: SidebarEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, month, day, name, linksBlock] = m;
    const infoMatch = linksBlock.match(/<a href="([^"]+)"[^>]*>≫\s*大会情報／チケット<\/a>/);
    const cardMatch = linksBlock.match(/<a href="([^"]+)"[^>]*>≫\s*対戦カード<\/a>/);
    entries.push({
      eventName: name.trim(),
      month: Number(month),
      day: Number(day),
      infoUrl: infoMatch ? new URL(infoMatch[1], "https://jp.rizinff.com").toString() : null,
      cardUrl: cardMatch ? new URL(cardMatch[1], "https://jp.rizinff.com").toString() : null,
    });
  }
  return entries;
}

async function fetchRizinOfficialEvents(): Promise<OfficialEvent[]> {
  const html = await fetchText(RIZIN_ANNUAL_SCHEDULE_URL);
  const text = stripTags(html);
  const events: OfficialEvent[] = [];
  const seriesKeysFound = new Set<string>();
  const blocks = text.split(/(?=【\d{1,2}月】)/).filter((b) => b.startsWith("【"));
  for (const block of blocks) {
    const nameMatch = block.match(/【\d{1,2}月】(.+)/);
    if (!nameMatch) continue;
    const eventName = nameMatch[1].trim();
    // 抽出した年/月/日はJST基準で書かれた公式サイト本文の文字列をpadStartで
    // 連結するだけで、Date()を構築しない(以降はYYYY-MM-DD文字列同士の
    // ===/>=比較のみ。JST日付バイパス検査(パターン3)は誤検出)。
    const dateMatch = block.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (!dateMatch) continue; // 開催済み(試合結果一覧のみ)は日付ブロックが無く自然に除外される
    const [, y, mo, d] = dateMatch;
    const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const venueMatch = block.match(/会場\s*\n?\s*([^\n]+)/);
    const venue = venueMatch ? venueMatch[1].trim() : null;

    // 既知の大会(events.ts側にsourceUrlがある)ならそのURLを再取得してカードを
    // 見る。新規発見大会はカードURL自体が未知のためbouts=null(A診断のみ)。
    const local = EVENTS.find(
      (e) => e.org === "rizin" && e.status === "upcoming" && e.date === date && !!e.sourceUrl
    );
    let bouts: OfficialBout[] | null = null;
    let bodyText: string | undefined;
    // sourceUrlが年間スケジュール記事自身(カード未確定でプレースホルダとして
    // 暫定登録されているケース、例: rizin-omisoka-2026)の場合はカード取得を
    // 試みない。このページを対戦カードとしてパースすると、同じページ内に
    // 埋め込まれた他大会の「試合結果一覧」プレビューまで拾ってしまう。
    if (local?.sourceUrl && local.sourceUrl !== RIZIN_ANNUAL_SCHEDULE_URL) {
      try {
        const cardHtml = await fetchText(local.sourceUrl);
        bodyText = stripTags(cardHtml);
        bouts = parseRizinCard(cardHtml);
        if (bouts.length === 0) bouts = null; // カード未発表(A診断のみに留める)
      } catch (err) {
        process.stderr.write(`[rizin] カード取得失敗(${local.sourceUrl}): ${String(err)}\n`);
      }
    }
    events.push({
      org: "rizin",
      eventName,
      date,
      venue,
      sourceUrl: local?.sourceUrl ?? RIZIN_ANNUAL_SCHEDULE_URL,
      bouts,
      boutsConfidence: "high",
      bodyText,
    });
    const key = extractSeriesKey("rizin", eventName);
    if (key) seriesKeysFound.add(key);
  }

  // 記事本文になくサイドバーにのみ存在する大会(本文更新が追いついていない
  // 新規発表分)を追加で拾う。年は記事本文が無いため今日(JST)基準で補完する
  // (月がJSTの現在月より小さければ年またぎとみなし翌年とする)。
  const [todayY, todayM] = TODAY_JST.split("-").map(Number);
  for (const entry of parseRizinSidebar(html)) {
    const key = extractSeriesKey("rizin", entry.eventName);
    if (key && seriesKeysFound.has(key)) continue; // 本文側で既に拾い済み
    const year = entry.month < todayM ? todayY + 1 : todayY;
    const date = `${year}-${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`;
    let venue: string | null = null;
    let bouts: OfficialBout[] | null = null;
    let bodyText: string | undefined;
    if (entry.infoUrl) {
      try {
        const infoHtml = await fetchText(entry.infoUrl);
        bodyText = stripTags(infoHtml);
        // ページ冒頭の目次(見出し名だけが並ぶ「会場」「アクセス」…のリスト)を
        // 本文と誤認しないよう、最後にマッチした「会場」を実内容として採用する
        // (目次は本文より前に出現するため)。
        const venueMatches = [...bodyText.matchAll(/会場\s*\n+\s*([^\n]+)/g)];
        venue = venueMatches.length > 0 ? venueMatches[venueMatches.length - 1][1].trim() : null;
      } catch (err) {
        process.stderr.write(`[rizin] サイドバー大会情報取得失敗(${entry.infoUrl}): ${String(err)}\n`);
      }
    }
    if (entry.cardUrl) {
      try {
        const cardHtml = await fetchText(entry.cardUrl);
        bouts = parseRizinCard(cardHtml);
        if (bouts.length === 0) bouts = null;
      } catch (err) {
        process.stderr.write(`[rizin] サイドバー対戦カード取得失敗(${entry.cardUrl}): ${String(err)}\n`);
      }
    }
    events.push({
      org: "rizin",
      eventName: entry.eventName,
      date,
      venue,
      sourceUrl: entry.infoUrl ?? entry.cardUrl ?? RIZIN_ANNUAL_SCHEDULE_URL,
      bouts,
      boutsConfidence: "high",
      bodyText,
    });
    if (key) seriesKeysFound.add(key);
  }

  return events;
}

async function fetchShootoOfficialEvents(): Promise<OfficialEvent[]> {
  const html = await fetchText("https://www.shooto-mma.com/schedule/");
  const re =
    /<span class="result-list-day">([\d-]+)<\/span>[\s\S]{0,80}?<a href="\.\/\?id=(\d+)">(?:<span class="result-list-subtitle">([^<]*)<\/span>)?<span class="result-list-title">([^<]*)<\/span>/g;
  const events: OfficialEvent[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, date, id, subtitle, title] = m;
    if (subtitle?.trim() !== "プロフェッショナル修斗公式戦") continue; // サステイン本興行のみ対象
    const detailUrl = `https://www.shooto-mma.com/schedule/?id=${id}`;
    let venue: string | null = null;
    let bouts: OfficialBout[] | null = null;
    let bodyText: string | undefined;
    try {
      const detailHtml = await fetchText(detailUrl);
      bodyText = stripTags(detailHtml);
      // \d{4}年...日は「会場」欄を探すためのアンカー(目印)であり、日付自体は
      // キャプチャ・使用しない(venueMatch[1]は会場名のみ)。Dateを構築しない
      // ためJST日付バイパス検査(パターン3)は誤検出。
      const venueMatch = bodyText.match(/開催日\s*\n\s*\d{4}年\d{1,2}月\d{1,2}日[^\n]*\n\s*会場\s*\n\s*([^\n]+)/);
      venue = venueMatch ? venueMatch[1].trim() : null;
      bouts = parseShootoProseCard(bodyText);
      if (bouts.length === 0) bouts = null; // カード未発表または抽出失敗(A診断のみに留める)
    } catch (err) {
      process.stderr.write(`[shooto] 個別ページ取得失敗(${detailUrl}): ${String(err)}\n`);
    }
    events.push({
      org: "shooto",
      eventName: title.trim(),
      date,
      venue,
      sourceUrl: detailUrl,
      bouts,
      boutsConfidence: "low",
      bodyText,
    });
  }
  return events;
}

// j-shooto.com個別記事(検索結果アンカーの遷移先)の一覧発見に使う。検索結果
// ページの実HTMLは`<a href="URL"<dt>YYYY年MM月DD日</dt>\n<dd>タイトル<br>...`
// という(閉じ`>`が欠落した)壊れたマークアップだが、2026-08-05実測でXSERVER側
// からも安定して返る形なのでそのまま正規表現でパースする。
const LEMINO_SEARCH_RESULT_RE =
  /<a href="([^"]+)"<dt>\d{4}年\d{1,2}月\d{1,2}日<\/dt>\s*<dd>([^<]+)<br>/g;

// fetchLeminoShootoOfficialEvents内の個別記事取得失敗(fetchText例外)は関数内で
// catchして続行するため、main()側のresult.length===0判定にも例外にも乗らず、
// 異常が握りつぶされる穴になっていた(2026-08-05指摘)。main()から参照して
// fetchAnomalyCountに合算するための一時バッファ(1回の実行=1プロセスなので
// モジュールスコープの可変状態で問題ない)。
const auxFetchAnomalies: string[] = [];

async function fetchLeminoShootoOfficialEvents(): Promise<OfficialEvent[]> {
  // カテゴリで絞ると取りこぼす(実測: 開催告知は category=16 「開催情報」だが、
  // 対戦カード発表は同じ大会でも category=287 のような別カテゴリに乗ることがあり、
  // 大会ごとに一貫しない)。カテゴリ絞り込みはせず、直近の投稿をタイトルの
  // 正規表現(Lemino修斗を含むか)だけで判定する。
  //
  // 2026-08-05判明: https://j-shooto.com/wp-json/ 配下はXSERVER側の設定により
  // GitHub Actions等データセンターIPからのアクセスが403で拒否される(User-Agentを
  // 変えても回避不可、Actions上で実測確認済み)。一方で同サイトの通常ページ
  // (この検索結果ページを含む)は同じIPから200が返ることを実測済みのため、
  // 投稿一覧の発見はWordPress標準検索(`?s=`)のHTML結果から行う。
  //
  // ページングは不要(2026-08-05実測、Actions上で確認): `?s=Lemino修斗`は
  // パラメータ無しで該当57件全件(2025-07-19〜2026-08-05)を1ページで返す
  // (`検索結果 : 57件`の表示件数とHTML内の実マッチ数が一致)。`&paged=2`は
  // 404(2ページ目が存在しない=そもそも1ページに収まっている)、
  // `&posts_per_page=50`を付けても件数は変化しない(テーマ側がこのパラメータを
  // 無視しており、既定で全件表示という挙動そのもの)。
  const searchUrl = `https://j-shooto.com/?s=${encodeURIComponent("Lemino修斗")}`;
  const html = await fetchText(searchUrl);
  const posts: { link: string; title: string }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = LEMINO_SEARCH_RESULT_RE.exec(html))) {
    posts.push({ link: sm[1], title: decodeEntities(sm[2]).trim() });
  }

  // 同一大会について複数回(対戦カード①②等)投稿されるため、抽出したシリーズ番号で
  // グルーピングしてbout一覧を合算(和集合)する。
  const groups = new Map<string, { link: string; title: string }[]>();
  for (const p of posts) {
    const title = p.title;
    if (!/Lemino\s*修斗/i.test(title)) continue;
    const seriesMatch = title.match(/Lemino\s*修斗\.?\s*(\d+)/i);
    const key = seriesMatch ? `lemino.${seriesMatch[1]}` : `untitled::${p.link}`;
    const list = groups.get(key) ?? [];
    list.push({ link: p.link, title });
    groups.set(key, list);
  }

  const events: OfficialEvent[] = [];
  for (const [key, posts_] of groups) {
    let date: string | null = null;
    let venue: string | null = null;
    let eventName = posts_[0].title;
    const boutMap = new Map<string, OfficialBout>();
    let order = 0;
    let bodyTextCombined = "";
    for (const p of posts_) {
      try {
        const html = await fetchText(p.link);
        const text = stripTags(html);
        bodyTextCombined += `\n${text}`;
        const nameMatch = text.match(/［大会名］\s*\n?([\s\S]*?)［日時］/);
        if (nameMatch) eventName = nameMatch[1].replace(/\s+/g, "").trim() || eventName;
        // 抽出した年/月/日はJST基準で書かれた公式サイト本文の文字列をpadStartで
        // 連結するだけで、Date()を構築しない(JST日付バイパス検査(パターン3)は
        // 誤検出)。
        const dateMatch = text.match(/［日時］\s*\n?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
        if (dateMatch && !date) {
          date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
        }
        const venueMatch = text.match(/［会場］\s*\n?\s*([^\n［]+)/);
        if (venueMatch && !venue) venue = venueMatch[1].trim();
        for (const b of parseLeminoCard(text)) {
          const dedupeKey = `${normName(b.fighterA)}::${normName(b.fighterB)}`;
          if (!boutMap.has(dedupeKey)) boutMap.set(dedupeKey, { ...b, order: order++ });
        }
      } catch (err) {
        const msg = `[lemino-shooto] 記事取得失敗(${p.link}): ${String(err)}`;
        process.stderr.write(`${msg}\n`);
        auxFetchAnomalies.push(msg); // main()側でfetchAnomalyCountに合算する(2026-08-05指摘)
      }
    }
    events.push({
      org: "shooto",
      eventName,
      date,
      venue,
      sourceUrl: posts_[0].link, // 最新(検索結果順=配列先頭が新しい)の投稿を代表URLとする
      bouts: boutMap.size > 0 ? [...boutMap.values()] : null,
      boutsConfidence: "medium",
      bodyText: bodyTextCombined,
    });
    void key;
  }
  return events;
}

async function fetchPancraseOfficialEvents(): Promise<OfficialEvent[]> {
  const year = new Date().toISOString().slice(0, 4); // UTC基準でも年境界のずれは実害が小さいため簡易に現在年を使う
  const url = `https://www.pancrase.co.jp/rls/${year}/schedule.html`;
  const html = await fetchText(url);
  // 曜日カッコの後ろの区切りが半角/全角スペースいずれの表記もある(実測、
  // PANCRASE367/368は半角、他は全角)ため両対応する。
  const re = /<h3>\s*([\s\S]+?)\s*<\/h3>\s*<p>\s*(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?[\s　]+([\s\S]+?)\s*<\/p>/g;
  const events: OfficialEvent[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, rawName, mo, d] = m;
    const eventName = decodeEntities(rawName).trim();
    if (/BLOOD/i.test(eventName)) continue; // /events掲載対象外
    const date = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const numMatch = eventName.match(/PANCRASE\s*(\d+)/i);
    let venue: string | null = null;
    let bouts: OfficialBout[] | null = null;
    let bodyText: string | undefined;
    let sourceUrl = url;
    if (numMatch) {
      sourceUrl = `https://www.pancrase.co.jp/tour/${year}/pancrase${numMatch[1]}/index.html`;
      try {
        const detailHtml = await fetchText(sourceUrl);
        bodyText = stripTags(detailHtml);
        const venueMatch = bodyText.match(/会\s*場：\s*\n?\s*([^\n]+)/);
        venue = venueMatch ? venueMatch[1].trim() : null;
        bouts = parsePancraseCard(bodyText);
        if (bouts.length === 0) bouts = null;
      } catch (err) {
        process.stderr.write(`[pancrase] 個別ページ取得失敗(${sourceUrl}): ${String(err)}\n`);
      }
    }
    events.push({ org: "pancrase", eventName, date, venue, sourceUrl, bouts, boutsConfidence: "high", bodyText });
  }
  return events;
}

// CLAUDE.mdの掲載ルール文面は「DEEP本体+TOKYO IMPACT+JEWELS」のみだが、
// 実際のevents.tsには2026-08-05時点でDEEP OSAKA/HAMAMATSU IMPACT等の
// 都市シリーズも上記と同列で登録されている(実測、文面と実運用が乖離)。
// このスクリプトは実際の登録内容との差分検知が目的のため、実運用に合わせて
// 「DEEP + 何らかの語 + IMPACT」全般とJEWELSを対象にする(DEEP Fight
// Challenge・DEEP☆FUTUREはIMPACTを含まないため元々対象外)。
function isRegisteredDeepEvent(name: string): boolean {
  return /^DEEP\s+\S.*IMPACT/i.test(name) || /^DEEP JEWELS/i.test(name);
}

async function fetchDeepOfficialEvents(): Promise<OfficialEvent[]> {
  const html = await fetchText("https://www.deep2001.com/future/");
  const re = /<div class="resultBox">\s*<a href="([^"]+)">[\s\S]*?<br>\s*([^\t\n<]+?)\s*<\/a>/g;
  const candidates: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const title = decodeEntities(m[2]).trim();
    if (isRegisteredDeepEvent(title)) candidates.push({ url: m[1], title });
  }

  const events: OfficialEvent[] = [];
  for (const c of candidates) {
    try {
      const detailHtml = await fetchText(c.url);
      const text = stripTags(detailHtml);
      // 抽出した年/月/日はJST基準で書かれた公式サイト本文の文字列をpadStartで
      // 連結するだけで、Date()を構築しない(JST日付バイパス検査(パターン3)は
      // 誤検出)。
      const dateMatch = text.match(/●日時：\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : null;
      const venueMatch = text.match(/●会場：\s*([^\n●]+)/);
      const venue = venueMatch ? venueMatch[1].trim() : null;
      let bouts: OfficialBout[] | null = parseDeepCard(text);
      if (bouts.length === 0) bouts = null;
      events.push({
        org: "deep",
        eventName: c.title,
        date,
        venue,
        sourceUrl: c.url,
        bouts,
        boutsConfidence: "medium",
        bodyText: text,
      });
    } catch (err) {
      process.stderr.write(`[deep] 個別ページ取得失敗(${c.url}): ${String(err)}\n`);
    }
  }
  return events;
}

// ─────────────────────────────────────────────
// events.ts側の読み込み(read-only)
// ─────────────────────────────────────────────
function loadLocalEvents(org: Org): LocalEvent[] {
  return EVENTS.filter((e): e is MEvent => e.org === org && e.status === "upcoming").map((e) => ({
    slug: e.slug,
    org,
    eventName: e.eventName,
    date: e.date,
    venue: e.venue ?? null,
    bouts: e.bouts.map((b) => ({
      fighterA: b.fighterA,
      fighterB: b.fighterB,
      weightClass: b.weightClass,
      cancelled: b.cancelled,
    })),
  }));
}

// ─────────────────────────────────────────────
// A: 大会単位マッチング+diff
// ─────────────────────────────────────────────
interface MatchedPair {
  official: OfficialEvent;
  local: LocalEvent;
}

function matchEvents(
  org: Org,
  officialList: OfficialEvent[],
  localList: LocalEvent[]
): { matched: MatchedPair[]; onlyOfficial: OfficialEvent[]; onlyLocal: LocalEvent[] } {
  const usedOfficial = new Set<OfficialEvent>();
  const usedLocalIdx = new Set<number>();
  const matched: MatchedPair[] = [];

  for (const o of officialList) {
    if (!o.date) continue;
    const li = localList.findIndex((l, idx) => !usedLocalIdx.has(idx) && l.date === o.date);
    if (li !== -1) {
      matched.push({ official: o, local: localList[li] });
      usedLocalIdx.add(li);
      usedOfficial.add(o);
    }
  }
  for (const o of officialList) {
    if (usedOfficial.has(o)) continue;
    const ok = extractSeriesKey(org, o.eventName);
    if (!ok) continue;
    const li = localList.findIndex((l, idx) => !usedLocalIdx.has(idx) && extractSeriesKey(org, l.eventName) === ok);
    if (li !== -1) {
      matched.push({ official: o, local: localList[li] });
      usedLocalIdx.add(li);
      usedOfficial.add(o);
    }
  }

  return {
    matched,
    onlyOfficial: officialList.filter((o) => !usedOfficial.has(o)),
    onlyLocal: localList.filter((_, idx) => !usedLocalIdx.has(idx)),
  };
}

function venueRoughlyMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // 片方不明なら不一致とはしない
  const na = a.replace(/[（(].*?[）)]/g, "").trim();
  const nb = b.replace(/[（(].*?[）)]/g, "").trim();
  return na.includes(nb) || nb.includes(na);
}

// ─────────────────────────────────────────────
// B: カード単位diff
// ─────────────────────────────────────────────
interface BoutDiffResult {
  missingOnLocal: OfficialBout[]; // 公式にあってevents.tsに無い
  missingOnOfficial: { fighterA: string; fighterB: string; weightClass: string; cancelled?: boolean }[]; // events.tsにあって公式で確認できない
  opponentChangeSuspect: { local: { fighterA: string; fighterB: string }; official: OfficialBout }[];
}

function diffBouts(local: LocalEvent, official: OfficialBout[]): BoutDiffResult {
  const officialPairs = official.map((b) => ({
    bout: b,
    key: [normName(b.fighterA), normName(b.fighterB)].sort().join("::"),
    names: [normName(b.fighterA), normName(b.fighterB)],
  }));
  const localPairs = local.bouts
    .filter((b) => !b.cancelled)
    .map((b) => ({
      bout: b,
      key: [normName(b.fighterA), normName(b.fighterB)].sort().join("::"),
      names: [normName(b.fighterA), normName(b.fighterB)],
    }));

  const localKeys = new Set(localPairs.map((p) => p.key));
  const officialKeys = new Set(officialPairs.map((p) => p.key));

  const missingOnLocal = officialPairs.filter((p) => !localKeys.has(p.key)).map((p) => p.bout);
  const missingOnOfficialRaw = localPairs.filter((p) => !officialKeys.has(p.key));

  const opponentChangeSuspect: BoutDiffResult["opponentChangeSuspect"] = [];
  const trueMissingOnOfficial: BoutDiffResult["missingOnOfficial"] = [];
  const consumedOfficial = new Set<OfficialBout>();

  for (const lp of missingOnOfficialRaw) {
    // 片方の選手名だけ一致する公式側の未消化ペアがあれば「対戦相手変更疑い」として1件にまとめる
    const partial = officialPairs.find(
      (op) =>
        !consumedOfficial.has(op.bout) &&
        !localKeys.has(op.key) &&
        (op.names[0] === lp.names[0] || op.names[0] === lp.names[1] || op.names[1] === lp.names[0] || op.names[1] === lp.names[1])
    );
    if (partial) {
      consumedOfficial.add(partial.bout);
      opponentChangeSuspect.push({ local: { fighterA: lp.bout.fighterA, fighterB: lp.bout.fighterB }, official: partial.bout });
    } else {
      trueMissingOnOfficial.push(lp.bout);
    }
  }

  return {
    missingOnLocal: missingOnLocal.filter((b) => !consumedOfficial.has(b)),
    missingOnOfficial: trueMissingOnOfficial,
    opponentChangeSuspect,
  };
}

// ─────────────────────────────────────────────
// C: バウトオーダーdiff(Bで名前ペアが完全一致した大会のみ対象)
// ─────────────────────────────────────────────
function diffOrder(local: LocalEvent, official: OfficialBout[]): boolean {
  const localActive = local.bouts.filter((b) => !b.cancelled);
  if (localActive.length !== official.length || localActive.length === 0) return false;
  const localSeq = localActive.map((b) => [normName(b.fighterA), normName(b.fighterB)].sort().join("::"));
  const officialSeq = official.map((b) => [normName(b.fighterA), normName(b.fighterB)].sort().join("::"));
  const localSet = new Set(localSeq);
  const officialSet = new Set(officialSeq);
  if (localSet.size !== officialSet.size || [...localSet].some((k) => !officialSet.has(k))) return false; // 完全一致でなければC対象外
  return localSeq.join("|") !== officialSeq.join("|");
}

// ─────────────────────────────────────────────
// レポート組み立て
// ─────────────────────────────────────────────
const ORG_LABEL: Record<Org, string> = { rizin: "RIZIN", shooto: "修斗", pancrase: "パンクラス", deep: "DEEP" };

async function main() {
  const orgFetchers: { org: Org; label: string; run: () => Promise<OfficialEvent[]> }[] = [
    { org: "rizin", label: "RIZIN", run: fetchRizinOfficialEvents },
    { org: "shooto", label: "修斗(サステイン)", run: fetchShootoOfficialEvents },
    { org: "shooto", label: "Lemino修斗", run: fetchLeminoShootoOfficialEvents },
    { org: "pancrase", label: "パンクラス", run: fetchPancraseOfficialEvents },
    { org: "deep", label: "DEEP", run: fetchDeepOfficialEvents },
  ];

  const officialByOrg: Record<Org, OfficialEvent[]> = { rizin: [], shooto: [], pancrase: [], deep: [] };
  const fetchErrors: string[] = [];
  // 例外を投げずに0件を返す(=公式サイトのHTML構造変更でパースが静かに空振りする)
  // 経路があるため、例外catchだけでなく0件そのものも異常としてカウントする。
  // このカウンタが1以上ならワークフロー側でIssue化する(差分0件でも異常は握り
  // つぶさない)。
  let fetchAnomalyCount = 0;
  // ある団体に複数fetcherがあり(例: 修斗=サステイン+Lemino修斗)、片方だけが
  // 失敗した場合でもofficialByOrg[org]は他方の取得分で非空になる。この状態で
  // onlyLocal(events.tsにあるが突合できなかった大会)を一律「公式で確認できず」
  // と報告すると、取得失敗が原因の欠落を「公式に無い」と誤読させてしまう
  // (2026-08-05指摘)。団体単位でこのフラグを見て文言を出し分ける。
  const orgHadFetchFailure = new Set<Org>();

  for (const f of orgFetchers) {
    try {
      const result = await f.run();
      // fetcher自体は例外を投げず0件にもならないが、内部で個別記事の取得に
      // 部分的に失敗しているケース(例: fetchLeminoShootoOfficialEvents内の
      // 記事別fetchText失敗)をauxFetchAnomaliesから回収する(2026-08-05指摘)。
      if (auxFetchAnomalies.length > 0) {
        fetchErrors.push(...auxFetchAnomalies);
        fetchAnomalyCount += auxFetchAnomalies.length;
        orgHadFetchFailure.add(f.org);
        auxFetchAnomalies.length = 0;
      }
      if (result.length === 0) {
        const msg = `[${f.label}] 取得0件(パース失敗の疑い、異常としてカウント)`;
        process.stderr.write(`${msg}\n`);
        fetchErrors.push(msg);
        fetchAnomalyCount++;
        orgHadFetchFailure.add(f.org);
      }
      // 過去大会・日付未確定の投稿(告知記事の再送/配信情報更新等)は「未掲載」
      // 誤検知の原因になるため、ここで一律に今日(JST)以降のものだけへ絞る。
      const upcomingOnly = result.filter((e) => e.date !== null && e.date >= TODAY_JST);
      const dropped = result.length - upcomingOnly.length;
      if (dropped > 0) {
        process.stderr.write(`[${f.label}] 過去/日付不明のため${dropped}件を除外\n`);
      }
      officialByOrg[f.org].push(...upcomingOnly);
      process.stderr.write(`[${f.label}] ${upcomingOnly.length}件取得\n`);
    } catch (err) {
      const msg = `[${f.label}] 取得失敗、この団体をスキップして続行: ${String(err)}`;
      process.stderr.write(`${msg}\n`);
      fetchErrors.push(msg);
      fetchAnomalyCount++;
      orgHadFetchFailure.add(f.org);
      if (auxFetchAnomalies.length > 0) {
        fetchErrors.push(...auxFetchAnomalies);
        fetchAnomalyCount += auxFetchAnomalies.length;
        auxFetchAnomalies.length = 0;
      }
    }
  }

  const sectionsA: string[] = [];
  const sectionsBHigh: string[] = [];
  const sectionsBLow: string[] = [];
  const sectionsC: string[] = [];
  let diffCount = 0;

  const jsonA: JsonASection[] = [];
  const jsonB: JsonBSection[] = [];
  const jsonC: JsonEventRef[] = [];

  for (const org of ["rizin", "shooto", "pancrase", "deep"] as Org[]) {
    const localList = loadLocalEvents(org);
    const officialList = officialByOrg[org];
    if (officialList.length === 0) continue;
    const { matched, onlyOfficial, onlyLocal } = matchEvents(org, officialList, localList);

    const aLines: string[] = [];
    for (const o of onlyOfficial) {
      aLines.push(`- **未掲載**: ${o.eventName}(${o.date ?? "日付不明"}, ${o.venue ?? "会場不明"}) — ${o.sourceUrl}`);
      diffCount++;
      jsonA.push({
        kind: "event_missing",
        org,
        orgLabel: ORG_LABEL[org],
        eventName: o.eventName,
        slug: null,
        date: o.date,
        venue: o.venue,
        sourceUrl: o.sourceUrl,
      });
    }
    // 「公式で確認できず」の大会が、公式の他記事(このorgで取得できた全ページ)で
    // 「延期」「中止」と一緒に言及されていないか確認する。単なる取得漏れとの
    // 誤通知を避けるため、全件を通知対象にはせず、この言及がある場合だけ
    // diffCountに加える(受入条件「必須3」)。
    const combinedBodyText = officialList.map((e) => e.bodyText ?? "").join("\n");
    const hasCancelKeyword = combinedBodyText.includes("延期") || combinedBodyText.includes("中止");
    for (const l of onlyLocal) {
      const hasCancelMention =
        hasCancelKeyword && seriesSearchTokens(org, l.eventName).some((t) => combinedBodyText.includes(t));
      // この団体で今回いずれかのfetcherが失敗している場合、「公式で確認できず」
      // (=公式サイトを見た上で見つからなかった、と読める表現)は誤りになる
      // (取得できていないだけの可能性が高い)。文言を明確に取得失敗由来と分ける
      // (2026-08-05指摘、受入条件「A区分のノイズ」対応)。
      const label = orgHadFetchFailure.has(org) ? "取得失敗のため未確認" : "公式で確認できず";
      const note = hasCancelMention
        ? "公式の他記事に「延期」または「中止」の言及あり、要確認"
        : orgHadFetchFailure.has(org)
          ? "この団体は今回取得元の一部でエラーが発生しており、公式に無いと断定できない"
          : "延期/名称変更/取得漏れの可能性、断定はしない";
      aLines.push(`- ${label}: ${l.eventName}(${l.date}, events.ts: \`${l.slug}\`) — ${note}`);
      if (hasCancelMention) diffCount++;
      jsonA.push({
        kind: "event_unconfirmed",
        org,
        orgLabel: ORG_LABEL[org],
        eventName: l.eventName,
        slug: l.slug,
        date: l.date,
        venue: l.venue,
        sourceUrl: null,
        fetchFailure: orgHadFetchFailure.has(org),
        cancelMention: hasCancelMention,
      });
    }
    for (const { official, local } of matched) {
      if (official.date && official.date !== local.date) {
        aLines.push(`- **変更疑い(日付)**: ${local.eventName}(\`${local.slug}\`) events.ts=${local.date} ⇔ 公式=${official.date}`);
        diffCount++;
        jsonA.push({
          kind: "date_change",
          org,
          orgLabel: ORG_LABEL[org],
          eventName: local.eventName,
          slug: local.slug,
          date: local.date,
          venue: local.venue,
          sourceUrl: official.sourceUrl,
          localDate: local.date,
          officialDate: official.date,
        });
      }
      if (!venueRoughlyMatches(official.venue, local.venue)) {
        aLines.push(`- **変更疑い(会場)**: ${local.eventName}(\`${local.slug}\`) events.ts=${local.venue ?? "未設定"} ⇔ 公式=${official.venue ?? "不明"}`);
        diffCount++;
        jsonA.push({
          kind: "venue_change",
          org,
          orgLabel: ORG_LABEL[org],
          eventName: local.eventName,
          slug: local.slug,
          date: local.date,
          venue: local.venue,
          sourceUrl: official.sourceUrl,
          localVenue: local.venue,
          officialVenue: official.venue,
        });
      }
    }
    if (aLines.length > 0) sectionsA.push(`### ${ORG_LABEL[org]}\n${aLines.join("\n")}`);

    const bLinesByConfidence: Record<Confidence, string[]> = { high: [], medium: [], low: [] };
    const cLines: string[] = [];
    for (const { official, local } of matched) {
      if (!official.bouts) continue;
      const diff = diffBouts(local, official.bouts);
      const lines: string[] = [];
      const jsonItems: JsonBoutItem[] = [];
      for (const b of diff.missingOnLocal) {
        lines.push(`- **未掲載**: ${local.eventName}(\`${local.slug}\`) ${b.weightClass ?? ""} ${b.fighterA} vs ${b.fighterB}`);
        diffCount++;
        jsonItems.push({ kind: "missing_on_local", weightClass: b.weightClass, fighterA: b.fighterA, fighterB: b.fighterB });
      }
      for (const b of diff.missingOnOfficial) {
        const isCancelMention =
          !!official.bodyText &&
          (official.bodyText.includes("延期") || official.bodyText.includes("中止")) &&
          (official.bodyText.includes(b.fighterA) || official.bodyText.includes(b.fighterB));
        const cancelHint = isCancelMention ? "(本文に「延期」または「中止」の言及あり、要確認)" : "";
        lines.push(`- 公式カードで確認できず: ${local.eventName}(\`${local.slug}\`) ${b.weightClass} ${b.fighterA} vs ${b.fighterB} ${cancelHint}`);
        if (isCancelMention) diffCount++; // 中止/延期の可能性は単独でもIssue化対象(受入条件「必須3」)
        jsonItems.push({
          kind: "missing_on_official",
          weightClass: b.weightClass,
          fighterA: b.fighterA,
          fighterB: b.fighterB,
          cancelMention: isCancelMention,
        });
      }
      for (const c of diff.opponentChangeSuspect) {
        lines.push(
          `- **対戦相手変更疑い**: ${local.eventName}(\`${local.slug}\`) events.ts「${c.local.fighterA} vs ${c.local.fighterB}」⇔ 公式「${c.official.fighterA} vs ${c.official.fighterB}」`
        );
        diffCount++;
        jsonItems.push({
          kind: "opponent_change",
          localFighterA: c.local.fighterA,
          localFighterB: c.local.fighterB,
          officialFighterA: c.official.fighterA,
          officialFighterB: c.official.fighterB,
        });
      }
      if (lines.length > 0) {
        bLinesByConfidence[official.boutsConfidence].push(`**${local.eventName}** (\`${local.slug}\`, ${official.sourceUrl})\n${lines.join("\n")}`);
        jsonB.push({
          org,
          orgLabel: ORG_LABEL[org],
          eventName: local.eventName,
          slug: local.slug,
          date: local.date,
          venue: local.venue,
          sourceUrl: official.sourceUrl,
          confidence: official.boutsConfidence,
          items: jsonItems,
        });
      }

      if (diffOrder(local, official.bouts)) {
        cLines.push(`- ${local.eventName}(\`${local.slug}\`): 対戦カードの並び順が公式と異なる(対戦相手ペア自体は一致)`);
        jsonC.push({
          org,
          orgLabel: ORG_LABEL[org],
          eventName: local.eventName,
          slug: local.slug,
          date: local.date,
          venue: local.venue,
          sourceUrl: official.sourceUrl,
        });
      }
    }
    if (bLinesByConfidence.high.length + bLinesByConfidence.medium.length > 0) {
      sectionsBHigh.push(`### ${ORG_LABEL[org]}\n${[...bLinesByConfidence.high, ...bLinesByConfidence.medium].join("\n\n")}`);
    }
    if (bLinesByConfidence.low.length > 0) {
      sectionsBLow.push(`### ${ORG_LABEL[org]}\n${bLinesByConfidence.low.join("\n\n")}`);
    }
    if (cLines.length > 0) sectionsC.push(`### ${ORG_LABEL[org]}\n${cLines.join("\n")}`);
  }

  const detectedAtUtc = new Date().toISOString();

  const parts: string[] = [];
  parts.push("# 団体別開催予定 差分レポート");
  parts.push(`検出日時(UTC): ${detectedAtUtc}`);
  if (fetchErrors.length > 0) {
    parts.push(`\n## 取得エラー(該当団体はスキップして続行)\n${fetchErrors.map((e) => `- ${e}`).join("\n")}`);
  }
  parts.push(`\n## A: 大会単位\n${sectionsA.length > 0 ? sectionsA.join("\n\n") : "差分なし"}`);
  parts.push(`\n## B: カード単位(高/中信頼度)\n${sectionsBHigh.length > 0 ? sectionsBHigh.join("\n\n") : "差分なし"}`);
  parts.push(
    `\n## B: カード単位 — 参考情報(修斗/shooto-mma.com、確度低)\n本文の自由記述からの推定のため誤検知の可能性がある。参考情報として扱うこと。\n\n${
      sectionsBLow.length > 0 ? sectionsBLow.join("\n\n") : "差分なし"
    }`
  );
  parts.push(`\n## C: バウトオーダー(対戦相手ペアは一致、順序のみ差分。暫定順で登録している大会があるため参考情報)\n${sectionsC.length > 0 ? sectionsC.join("\n\n") : "差分なし"}`);

  // /admin/schedule-diff がMarkdownを再パースせずに済むよう、同じ内容を構造化
  // データとして本文末尾にHTMLコメントで埋め込む(GitHub上のMarkdown表示には
  // 影響しない)。ワークフロー側(check-org-schedule-diff.yml)がこの文字列を
  // そのままIssue本文の先頭部分として使い、末尾に別途フッターを追記する。
  const jsonPayload: ScheduleDiffJson = {
    detectedAtUtc,
    diffCount,
    fetchErrorCount: fetchAnomalyCount,
    fetchErrors,
    a: jsonA,
    b: jsonB,
    c: jsonC,
  };
  parts.push(`\n<!-- SCHEDULE_DIFF_JSON: ${JSON.stringify(jsonPayload)} -->`);

  const report = parts.join("\n");
  console.log(report);
  console.log(`\nDIFF_COUNT=${diffCount}`);
  console.log(`FETCH_ERROR_COUNT=${fetchAnomalyCount}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import("fs");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

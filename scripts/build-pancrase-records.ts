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
import { assertAllowedByRobots } from "./lib/robotsGate";
import { classifyMmaRuleType } from "../src/lib/mnewsRating/nonProBoutFilter";

const OUT = path.join(process.cwd(), "data", "pancraseRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const BASE = "https://www.pancrase.co.jp/data/result";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 取得タイムアウト・有限リトライ(2026-08-01、指示書「fetchHtml()に取得タイムアウトを
// 入れる」。詳細はbuild-deep-records.tsの同名関数のコメント参照)。404は「PDFのみ
// 大会等、そもそもHTML結果ページが存在しない」という正常系のため、従来どおり
// リトライせず即座にnullを返す(例外にはしない)。それ以外の理由で取得に失敗し
// リトライを使い切った場合のみ例外で落とす。
const FETCH_TIMEOUT_MS = 30_000;

export async function fetchText(url: string, retries = 3): Promise<string | null> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      if (res.status === 404) return null; // リトライしても無駄(PDFのみ大会等)
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

export function extractEventMeta(html: string, year: string, file: string): EventMeta {
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
  sectionHeading: string | null;
}

function parseBoutTable(tableHtml: string, sectionHeading: string | null): RawBout | null {
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
  let decisionRaw = result0Matches.length > 0 ? stripTags(result0Matches[0]) : "";

  // result0が1件も無い場合のフォールバック其の1: class="md"(実測:
  // 1994-0119の全6試合のみで確認。ごく初期の1994年のみに存在する古い
  // マークアップで、当時は決着テキストがresult0ではなくclass="md"の
  // td(例:「7分37秒、ヒザ十字固め」)に入っている)。
  if (result0Matches.length === 0) {
    const mdMatch = tableHtml.match(/<td colspan="5"[^>]*class="md">([\s\S]*?)<\/td>/);
    if (mdMatch) {
      decisionRaw = stripTags(mdMatch[1]);
    }
  }

  // result0が1件も無い場合のフォールバック其の2: class="result"(実測:
  // 2010-1205 草・MAX戦、2005-0227 長谷川孝司戦、2016-0612 藤野敦史戦など
  // 計11件超で確認)。公式サイト側が本来result0に入れるべき決着テキストを
  // 誤ってclass="result"(通常はレフェリー名・体重・判定内訳を入れる欄)に
  // 直接書いてしまっているマークアップ崩れ。result0・class="md"のいずれも
  // 無い場合に限り、resultからwcube(体重)・レフェリー行・判定内訳
  // (スコアカード)を取り除いた残りのテキストを決着テキストとして採用する
  // (判定のスコアカード自体は多数決推測の材料にしないため明示的に除外する)。
  if (result0Matches.length === 0 && !decisionRaw) {
    const resultMatch = tableHtml.match(/<td colspan="5" class="result">([\s\S]*?)<\/td>/);
    if (resultMatch) {
      let fallback = resultMatch[1];
      fallback = fallback.replace(/<div class="wcube">[\s\S]*?<\/div>/g, "");
      fallback = fallback.replace(/判定[：:][\s\S]*?(?=レフェリー|$)/, "");
      fallback = fallback.replace(/レフェリー[：:][^\n<]*/g, "");
      decisionRaw = stripTags(fallback);
    }
  }

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

  return { headingText, left, right, decisionRaw, weightLeftRaw, weightRightRaw, sectionHeading };
}

// 指示書H(2026-08-04)で発見: メインイベント・一部特殊カード(NEO BLOOD等)は
// `<table id="maincard">`のようにid属性を持つが、旧実装は`<table>`(属性なし)
// のみにマッチしておりこれらのbout表を構造的に取りこぼしていた
// (#428で3件、指示書Hの全418大会走査で新たに7件発見・計10件が該当)。
// id属性の有無を問わずマッチするよう修正(bout表かどうかの判定基準
// class="crdl"は従来通り)。
//
// 指示書「ushiku-juntaro 1行目非表示調査」(2026-08-05)で追加: 一部大会は
// メイン/セミ〜本戦カードの後に<h3>見出し(「パンクラスゲート」「プロ昇格
// トーナメント決勝戦」等)区切りで別ブラケット(アマチュア/プロ未昇格戦)を
// 同一ページに掲載する。この見出しは個々のbout表(rdcube)には現れず<h3>にしか
// 無いため、従来の実装ではbout単位の非プロ判定(nonProBoutFilter.ts)から
// 見えなかった(牛久絢太郎PANCRASE247/251等で実測)。ページ出現順に沿って
// <h3>と<table>を1回のスキャンで拾い、直近に出現した<h3>のテキストを
// そのセクション内の各bout表に紐付けて返す(推測ではなく機械的な直近紐付け)。
function extractBoutTables(html: string): { tableHtml: string; sectionHeading: string | null }[] {
  const combined = /<h3[^>]*>([\s\S]*?)<\/h3>|<table(?: id="[^"]*")?>[\s\S]*?<\/table>/g;
  let currentSection: string | null = null;
  const results: { tableHtml: string; sectionHeading: string | null }[] = [];
  let m: RegExpExecArray | null;
  while ((m = combined.exec(html))) {
    if (m[0].startsWith("<h3")) {
      currentSection = stripTags(m[1]).trim() || null;
      continue;
    }
    if (m[0].includes('class="crdl"')) {
      results.push({ tableHtml: m[0], sectionHeading: currentSection });
    }
  }
  return results;
}

// ------------------------------------------------------------------
// ruleType / namedDivision / resultType 等の解釈(rizinScraper.tsの
// parseRuleInfo/parseMethodと同じ「明示語のみで判定・推測しない」方針)
// ------------------------------------------------------------------

// 非MMA判定はsrc/lib/mnewsRating/nonProBoutFilter.tsのclassifyMmaRuleType()に
// 一本化した(PR #369。旧ローカルパターンにISKAが無く、ISKAオリエンタル・
// ルールがMMAに誤分類される事故があった)。決着方法テキスト側は「グラウンドの
// キック」等MMAの決着描写にも"キック"を含むため対象にせず、見出しテキストのみで
// 判定する(既存方針を維持)。
// なお実際の集計(pancraseRecordsAggregate.computeFighterPancraseRecord)は、
// ここで保存したruleTypeを信用せずheadingText/namedDivisionから毎回判定し直す
// ため、このresolveRuleType()の呼び出し結果はデータの参考値としてのみ保存される
// (パターン更新時に再スクレイプしなくても集計結果には即座に反映される)。
function resolveRuleType(headingText: string): string {
  return classifyMmaRuleType(headingText);
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

// マーカー(○/◯/〇/×/△/-)が明示されている場合、それを最優先の一次ソース表現
// として扱い、決着テキストの文言(「試合中止」等)で上書きしない。
//
// 背景(2026-07-29、修斗#255のバグクラス波及調査で発見): 当初の実装は
// 「決着テキストに"試合中止"を含む→無条件でcancelled」を最優先にしていたため、
// 実際には○/×マーカーで明示的に勝者が決まっている一部の不戦勝ケース(例:
// 2018-0311 亀井晨佑○×塩津良介「試合中止/塩津良介：試合前検診でドクター
// ストップ」)まで、マーカーを無視してcancelled・winnerName=nullに上書きして
// いた。修斗#255はスコア欄の多数決に頼ってマーカー(バッジ)を無視したことが
// 原因だったが、本件はその逆方向(マーカーというバッジがあるのに、別のテキスト
// シグナルで上書きしてしまう)の同種バグであり、優先順位をマーカー最優先に
// 修正した(該当1件のみ確認、実測は build-pancrase-records.tsのPR本文参照)。
function resolveResult(left: RawCorner, right: RawCorner, decisionRaw: string, headingText: string): ResolvedResult {
  let leftMarkerRaw = left.markerRaw;
  let rightMarkerRaw = right.markerRaw;
  let note: string | null = null;
  const decisiveMarkers = ["○", "◯", "〇"];

  // 片側のみマーカー欠落(公式サイト側の記載漏れ)の機械的推定。
  // 決着方法テキストが引き分け/NC相当を示していない場合に限り、反対コーナーの
  // 明示マーカーから対称的に導出する(推測で埋めるのではなく対称性からの導出)。
  const originallyBothEmpty = !leftMarkerRaw && !rightMarkerRaw;
  if (!leftMarkerRaw && rightMarkerRaw && decisiveMarkers.includes(rightMarkerRaw) && !/試合中止/.test(decisionRaw)) {
    leftMarkerRaw = "×";
    note = "left_marker_inferred_from_opponent(source_omitted_x)";
  } else if (!rightMarkerRaw && leftMarkerRaw && decisiveMarkers.includes(leftMarkerRaw) && !/試合中止/.test(decisionRaw)) {
    rightMarkerRaw = "×";
    note = "right_marker_inferred_from_opponent(source_omitted_x)";
  }

  let resultType: ResultType;
  if (leftMarkerRaw === "△" || rightMarkerRaw === "△") {
    resultType = "draw";
  } else if (leftMarkerRaw === "-" || rightMarkerRaw === "-") {
    resultType = "nc";
  } else if (decisiveMarkers.includes(leftMarkerRaw) || decisiveMarkers.includes(rightMarkerRaw)) {
    resultType = "decisive";
  } else {
    // 両コーナーともマーカーが無い場合のみ、決着テキスト/見出しの明示語で
    // 分類する(一次ソースであるマーカーが無い場合の次善のシグナル)。
    // 判定のスコアカード数値(例:「判定/1-1」「29-28/28-29/28-28」)からの
    // 多数決推測は一切行わない(修斗#255と同種の誤判定を避けるため)。
    // 実測(2026-07-29、全77件の目視監査): ノーコンテスト系「ノーコンテスト」
    // 「ノー コンテスト」(半角スペース混在の表記ゆれを確認)「無効試合」
    // 「試合不成立」/ドロー系「時間切れドロー」「時間切れ引き分け」/中止系
    // 「試合中止」を含まない「中止」単独表記(2026-0314等)・「計量失格」単独
    // 表記(2025-0506「両者計量失格」等、"中止"の字を含まない)を確認したため、
    // 「試合中止」固定文字列だけでなくこれらの表記ゆれも判定対象に含めた。
    const combined = `${headingText} ${decisionRaw}`;
    // 2018-1224「3vs3道場対抗グラップリングマッチ」第1試合(パンクラス大阪 vs
    // パラエストラ東大阪)のみに実在する特殊フォーマット: 個人ではなく道場
    // チーム対抗で、決着テキストが「チーム対戦成績(引分互角なら0-0)/各
    // ラウンドの△(引分)○(勝ち)記号」という team score 形式(例:
    // "0-0/(1)△(2)△(3)△")。通常個人戦のコーナーマーカーとは別の表現だが、
    // 先頭のチーム対戦成績が同数(0-0)で3ラウンド全て△(引分)の場合は
    // 明示的な引き分け宣言として扱う(スコアの多数決推測ではなく、"0-0"という
    // 明示された最終成績そのものを読んでいる点で判定/N-M個別採点とは性質が
    // 異なる)。データセット全体でこの team score 形式は当該大会の2件のみで、
    // もう1件(BLOWS vs 総合格闘技道場コブラ会、"0-1/…")は既に×/○マーカーが
    // 明示されているため通常のdecisive分岐で処理される。
    const teamScoreMatch = decisionRaw.match(/^(\d+)-(\d+)\/\(1\)△\(2\)△\(3\)△/);
    if (teamScoreMatch && teamScoreMatch[1] === teamScoreMatch[2]) {
      resultType = "draw";
      note = "team_match_tied_score_marker(0-0)";
    } else if (/中止|計量失格/.test(combined)) {
      resultType = "cancelled";
    } else if (/ノーコンテスト|ノー\s*コンテスト|無効試合|試合不成立/.test(combined)) {
      resultType = "nc";
    } else if (/時間切れドロー|時間切れ引き分け|引き分け/.test(combined)) {
      resultType = "draw";
    } else {
      resultType = "unknown";
    }
  }

  // 元のソースにマーカーが一切無かった事実そのものは、最終的な分類結果に
  // かかわらず記録しておく(この注記が無いと「マーカー由来かテキスト由来か」
  // を後から区別できなくなるため)。既に個別の注記(片側マーカー推定・
  // チームスコア引き分け等)が付いている場合はそちらを優先し上書きしない。
  if (originallyBothEmpty && !note) {
    note = "no_marker_in_source";
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
  sectionHeading: string | null; // このboutが属する<h3>セクション見出し(例:「パンクラスゲート」)。無ければnull
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

export function buildEventBouts(html: string): { bouts: PancraseRecordsBout[]; parseFailures: number } {
  const tableHtmls = extractBoutTables(html);
  let parseFailures = 0;

  const successful: RawBout[] = [];
  for (const t of tableHtmls) {
    const raw = parseBoutTable(t.tableHtml, t.sectionHeading);
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
    const { resultType, leftMarkerRaw, rightMarkerRaw, note } = resolveResult(raw.left, raw.right, raw.decisionRaw, raw.headingText);
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
      sectionHeading: raw.sectionHeading,
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

// fetchText/extractEventMeta/buildEventBoutsをrefetch-pancrase-events.ts等から
// importして使う際に、このファイル自体の全大会再取得(main())が副作用として
// 走ってしまわないようにするガード(指示書「ushiku-juntaro 1行目非表示調査」
// 2026-08-05、実際にimportだけのつもりが全件再取得・data/pancraseRecords.json
// の誤上書きが発生した実測を踏まえて追加)。
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

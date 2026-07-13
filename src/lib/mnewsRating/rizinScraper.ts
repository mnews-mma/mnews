// jp.rizinff.com(RIZIN公式サイト)の「試合結果一覧」ページから試合単位のデータを
// 機械抽出する純関数群(I/O・fetchは持たない。scripts/update-rizin-records.tsが
// 呼び出す)。2018年以降のRIZIN公式サイトのテンプレート("h2見出し＋raw-htmlの
// <span>(WIN/LOSE/-)…</span>"形式)に対応する。RIZIN.1(2016-04、旧テンプレート)
// のみ形式が異なり1大会限りのため、rizinRecordOverrides.ts側で個別に確定値を
// 持たせる(このパーサーの対象外)。
//
// 抽出方針: 公式サイトの表記をそのまま保持し、推測・補完は一切行わない。
// 解決できない項目(選手名寄せ・階級名など)はnullのまま返し、呼び出し側で
// 「欠落」として集計・報告する。

export interface RizinRawBout {
  headingText: string; // h2見出しの生テキスト(例:「第12試合／秋元強真 vs. パッチー・ミックス」)
  ruleLineRaw: string; // 例:「フェザー級タイトルマッチ RIZIN MMAルール：5分 3R（66.0kg）」
  fighterAName: string;
  fighterBName: string;
  markerA: "WIN" | "LOSE" | "NC" | null; // （-）はNC扱い。マーカー自体が無ければnull(引き分け等)
  markerB: "WIN" | "LOSE" | "NC" | null;
  methodRaw: string; // 例:「2R 0分37秒 TKO（レフェリーストップ：グラウンドでのキック）」
  detailUrl: string | null; // 「≫ 試合結果詳細」リンク(参考情報、必須ではない)
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 1大会の結果ページHTML全体を、bout単位のチャンク(次のh2見出しの直前まで)に分割する。
// 「content-body-custom-bottom」(全ページ共通の「年間スケジュール」等の定型
// ウィジェット)は本文中に複数回、記事セクションの合間にも挟まる形で出現し
// (末尾だけとは限らない)、単純な最初の出現位置での打ち切りは本文を途中で
// 切り捨ててしまうため使わない。この定型ウィジェット自体は<h2 class=
// "article-heading">を含まないため、article-heading出現位置だけで素直に
// チャンク分割すれば、ウィジェットの中身は自然に各チャンクの末尾(次の
// article-headingの直前)に紛れ込むだけで、bout情報の抽出(parseBoutChunk)には
// 影響しない。
// 一部の大会(例: 超RIZIN/RIZIN.38)では、複数の試合が1つの<h2>の下に
// <h3 class="article-subheading">見出しでまとめられている(アンダーカードの
// 「まとめ枠」)。この<h3>は「第N試合／A vs. B」のような通常の見出しテキストで、
// フォーマットB(2016〜2017年)の<h3>(勝敗結果行そのもの。"[Win] ..."で始まる)
// とは意味が異なる。後者と区別するため、"["で始まらないものだけを見出しの
// 区切りとして扱う(見た目のクラス名が同じでも用途が違う既知の落とし穴)。
const SUBHEADING_TITLE_RE = /<h3 class="article-subheading"[^>]*>([\s\S]*?)<\/h3>/g;

function splitByH2(html: string): string[] {
  const headingRe = /<h2 class="article-heading"[^>]*>[\s\S]*?<\/h2>/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html))) starts.push(m.index);
  if (starts.length === 0) return [html];
  const chunks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    chunks.push(html.slice(start, end));
  }
  return chunks;
}

// h2チャンク1つの中に、試合見出しとして使われている<h3>(先頭が"["でない=
// フォーマットBの勝敗結果行ではない)が複数あれば、それぞれを独立したチャンクに
// 展開する。1つ以下ならそのまま返す(通常のケース。無駄な分割をしない)。
function expandNestedH3Bouts(chunk: string): string[] {
  const matches = [...chunk.matchAll(SUBHEADING_TITLE_RE)].filter((m) => !stripTags(m[1]).trim().startsWith("["));
  if (matches.length <= 1) return [chunk];
  const starts = matches.map((m) => m.index!);
  const out: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : chunk.length;
    out.push(chunk.slice(start, end));
  }
  return out;
}

// 1大会の結果ページHTML全体を、bout単位のチャンクに分割する。まず<h2
// class="article-heading">(次の見出しの直前まで)で分割し、その中に複数試合が
// まとめられている場合(上記expandNestedH3Bouts参照)はさらに展開する。
// 「content-body-custom-bottom」(全ページ共通の「年間スケジュール」等の定型
// ウィジェット)は本文中に複数回、記事セクションの合間にも挟まる形で出現し
// (末尾だけとは限らない)、単純な最初の出現位置での打ち切りは本文を途中で
// 切り捨ててしまうため使わない。この定型ウィジェット自体は<h2 class=
// "article-heading">を含まないため、article-heading出現位置だけで素直に
// チャンク分割すれば、ウィジェットの中身は自然に各チャンクの末尾(次の
// article-headingの直前)に紛れ込むだけで、bout情報の抽出(parseBoutChunk)には
// 影響しない。
export function splitIntoBoutChunks(html: string): string[] {
  return splitByH2(html).flatMap(expandNestedH3Bouts);
}

function parseMarker(raw: string | undefined): "WIN" | "LOSE" | "NC" | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes("WIN")) return "WIN";
  if (u.includes("LOSE")) return "LOSE";
  if (raw.includes("-")) return "NC"; // （-）はNC(ノーコンテスト裁定)を意味する
  return null;
}

function extractDetailUrl(chunk: string): string | null {
  const detailMatch = chunk.match(/<a href="([^"]*_ct\/\d+[^"]*)">\s*≫?\s*試合結果詳細/);
  return detailMatch ? detailMatch[1] : null;
}

// フォーマットA: 2018年以降の標準テンプレート。
// <div class="raw-html"><p style="text-align:center;">ルール情報<br>
// <span style="font-weight:bold">（WIN）<a>A</a> vs. <a>B</a>（LOSE）</span><br>決着方式</p>…</div>
function parseBoutChunkFormatA(chunk: string, headingText: string): RizinRawBout | null {
  const rawHtmlMatch = chunk.match(/<div class="raw-html">([\s\S]*?)<\/div>/);
  if (!rawHtmlMatch) return null;
  const rawHtml = rawHtmlMatch[1];

  const pMatch = rawHtml.match(/<p style="text-align:center;">([\s\S]*?)<\/p>/);
  if (!pMatch) return null;
  const pContent = pMatch[1];

  const spanMatch = pContent.match(/<span style="font-weight:bold">([\s\S]*?)<\/span>/);
  if (!spanMatch) return null;
  const spanContent = spanMatch[1];

  const preSpan = stripTags(pContent.slice(0, pContent.indexOf(spanMatch[0])));
  const postSpan = stripTags(pContent.slice(pContent.indexOf(spanMatch[0]) + spanMatch[0].length));

  const anchorMatches = [...spanContent.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
  if (anchorMatches.length !== 2) return null;
  const [matchA, matchB] = anchorMatches;
  const fighterAName = matchA[1].trim();
  const fighterBName = matchB[1].trim();

  const beforeA = spanContent.slice(0, matchA.index);
  const afterB = spanContent.slice((matchB.index ?? 0) + matchB[0].length);

  return {
    headingText,
    ruleLineRaw: preSpan,
    fighterAName,
    fighterBName,
    markerA: parseMarker(beforeA),
    markerB: parseMarker(afterB),
    methodRaw: postSpan,
    detailUrl: extractDetailUrl(chunk),
  };
}

// フォーマットB: 2016〜2017年頃の旧テンプレート。選手名はリンクされておらず
// プレーンテキスト、勝敗は半角角括弧[Win]/[Lose]表記、決着方式は選手名の間の
// 全角括弧内に埋め込まれる。
// <p>［ルール情報］</p><h3 class="article-subheading">[Win] A （ 決着方式 ） B [Lose]</h3>
function parseBoutChunkFormatB(chunk: string, headingText: string): RizinRawBout | null {
  const ruleMatch = chunk.match(/<p>［([\s\S]*?)］<\/p>/);
  const ruleLineRaw = ruleMatch ? stripTags(ruleMatch[1]) : "";

  const h3Match = chunk.match(/<h3 class="article-subheading"[^>]*>([\s\S]*?)<\/h3>/);
  if (!h3Match) return null;
  const h3Text = stripTags(h3Match[1]);

  const m = h3Text.match(/^\[(\w+)\]\s*(.+?)\s*（([\s\S]*?)）\s*(.+?)\s*\[(\w+)\]/);
  if (!m) return null;
  const [, markerARaw, fighterAName, methodRaw, fighterBName, markerBRaw] = m;

  return {
    headingText,
    ruleLineRaw,
    fighterAName: fighterAName.trim(),
    fighterBName: fighterBName.trim(),
    markerA: parseMarker(markerARaw),
    markerB: parseMarker(markerBRaw),
    methodRaw: methodRaw.trim(),
    detailUrl: extractDetailUrl(chunk),
  };
}

// フォーマットC: 2017年頃(RIZIN.7等)の過渡期テンプレート。<span>で囲まず、
// 太字指定の<p>自体に(Win)/(Lose)(半角括弧・大文字小文字混在)と選手名の
// <a>リンクが直接入っている。ルール情報(体重等)の行が無いことが多い
// (捏造ゼロの原則により、無ければ空文字のまま返す)。
// <div class="raw-html"><p style="text-align:center; font-weight: bold">(Win)<a>A</a> vs. <a>B</a>(Lose)<br>決着方式</p>…</div>
function parseBoutChunkFormatC(chunk: string, headingText: string): RizinRawBout | null {
  const rawHtmlMatch = chunk.match(/<div class="raw-html">([\s\S]*?)<\/div>/);
  if (!rawHtmlMatch) return null;
  const rawHtml = rawHtmlMatch[1];

  const pMatch = rawHtml.match(/<p style="text-align:center; font-weight: bold">([\s\S]*?)<\/p>/);
  if (!pMatch) return null;
  const pContent = pMatch[1];

  const anchorMatches = [...pContent.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
  if (anchorMatches.length !== 2) return null;
  const [matchA, matchB] = anchorMatches;
  const fighterAName = matchA[1].trim();
  const fighterBName = matchB[1].trim();

  const beforeA = pContent.slice(0, matchA.index);
  const afterB = stripTags(pContent.slice((matchB.index ?? 0) + matchB[0].length));
  // afterBは「(Lose)<br>決着方式」のように、勝敗マーカーの直後に決着方式が続く。
  const markerMatch = afterB.match(/^\(?(\w+)\)?/);
  const methodRaw = markerMatch ? afterB.slice(markerMatch[0].length).trim() : afterB.trim();

  return {
    headingText,
    ruleLineRaw: "", // このフォーマットには体重・ルール行が存在しない(捏造せず空のまま)
    fighterAName,
    fighterBName,
    markerA: parseMarker(beforeA),
    markerB: parseMarker(markerMatch ? markerMatch[1] : undefined),
    methodRaw,
    detailUrl: extractDetailUrl(chunk),
  };
}

// フォーマットD: 2017年頃(RIZIN.6等)の別の過渡期テンプレート。フォーマットCと
// 同じ太字<p>ラッパーだが、選手名がリンクされておらずプレーンテキストで、
// 半角括弧のマーカーが名前に直接くっついている(空白無し)。ルール情報は
// 別の<div class="raw-html">に分かれていることが多いため、chunk全体から
// ［…］パターンで探す(フォーマットBと同じ探し方)。
// <div class="raw-html"><p>［ルール情報］</p></div>
// <div class="raw-html"><p style="text-align:center; font-weight: bold">(Lose)A<br> (決着方式) <br>B(Win)</p></div>
function parseBoutChunkFormatD(chunk: string, headingText: string): RizinRawBout | null {
  const pMatch = chunk.match(/<p style="text-align:center; font-weight: bold">([\s\S]*?)<\/p>/);
  if (!pMatch) return null;
  const pContent = stripTags(pMatch[1]);

  // 勝敗マーカー(Win)/(Lose)は両者とも省略されることがある(引き分け・
  // ノーコンテストで明示マーカーが無いケース。金太郎型と同じくmarkerを
  // 必須にしない)。
  const m = pContent.match(/^(?:\((\w+)\))?\s*(.+?)\s*\(([\s\S]*?)\)\s*(.+?)\s*(?:\((\w+)\))?$/);
  if (!m) return null;
  const [, markerARaw, fighterAName, methodRaw, fighterBName, markerBRaw] = m;
  if (!fighterAName.trim() || !fighterBName.trim()) return null;

  const ruleMatch = chunk.match(/<p style="text-align:center;">\s*［([\s\S]*?)］\s*<\/p>/);
  const ruleLineRaw = ruleMatch ? stripTags(ruleMatch[1]) : "";

  return {
    headingText,
    ruleLineRaw,
    fighterAName: fighterAName.trim(),
    fighterBName: fighterBName.trim(),
    markerA: parseMarker(markerARaw),
    markerB: parseMarker(markerBRaw),
    methodRaw: methodRaw.trim(),
    detailUrl: extractDetailUrl(chunk),
  };
}

// 1試合ぶんのチャンクHTMLをパースする。フォーマットA(2018年以降)→
// B(2016〜2017年、<h3>形式)→C(2017年頃、太字<p>+リンク形式)→
// D(2017年頃、太字<p>+プレーンテキスト形式)の順に試す。どれにも一致しなければ
// null(呼び出し側でパース失敗として集計する。推測での穴埋めはしない)。
export function parseBoutChunk(chunk: string): RizinRawBout | null {
  // 通常はh2見出しがチャンクの先頭にあるが、expandNestedH3Boutsで展開された
  // サブチャンクはh3見出しから始まる(h2は無い)。h2が無ければh3を見出しとして使う。
  const headingMatch =
    chunk.match(/<h2 class="article-heading"[^>]*>([\s\S]*?)<\/h2>/) ??
    chunk.match(/<h3 class="article-subheading"[^>]*>([\s\S]*?)<\/h3>/);
  const headingText = headingMatch ? stripTags(headingMatch[1]) : "";

  return (
    parseBoutChunkFormatA(chunk, headingText) ??
    parseBoutChunkFormatB(chunk, headingText) ??
    parseBoutChunkFormatC(chunk, headingText) ??
    parseBoutChunkFormatD(chunk, headingText)
  );
}

// headingTextから「第N試合」のカード番号を抽出する(参考情報。実際のカード順は
// ページ内の出現順=main event→openerで決まるため、番号が無い見出し(タイトル戦
// 表記のみ等)でも支障はない)。
export function extractCardNumber(headingText: string): number | null {
  const m = headingText.match(/第(\d+)試合/);
  return m ? Number(m[1]) : null;
}

// ruleLineRawから: ルール種別・契約体重(kg)・階級名(明示されている場合)を抽出する。
export interface ParsedRuleInfo {
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "グラップリング" | "その他";
  weightKg: number | null;
  namedDivision: string | null; // 例:「フェザー級」「バンタム級」。明示が無ければnull
}

const NAMED_DIVISION_RE = /(フライ級|バンタム級|フェザー級|ライト級|ウェルター級|ミドル級|ライトヘビー級|ヘビー級|ストロー級|アトム級)/;

export function parseRuleInfo(ruleLineRaw: string): ParsedRuleInfo {
  let ruleType: ParsedRuleInfo["ruleType"] = "その他";
  if (/MMA/i.test(ruleLineRaw)) ruleType = "MMA";
  else if (/キックボクシング/.test(ruleLineRaw)) ruleType = "キックボクシング";
  else if (/シュートボクシング/.test(ruleLineRaw)) ruleType = "シュートボクシング";
  else if (/グラップリング/.test(ruleLineRaw)) ruleType = "グラップリング";

  const weightMatch = ruleLineRaw.match(/(\d+(?:\.\d+)?)\s*kg/);
  const weightKg = weightMatch ? Number(weightMatch[1]) : null;

  const namedMatch = ruleLineRaw.match(NAMED_DIVISION_RE);
  const namedDivision = namedMatch ? namedMatch[1] : null;

  return { ruleType, weightKg, namedDivision };
}

// methodRawから: 決着結果の分類(win/loss/draw/nc)・ラウンド・タイム・手法を抽出する。
export interface ParsedMethod {
  resultType: "decisive" | "draw" | "nc" | "cancelled" | "unknown";
  round: string | null;
  time: string | null;
  technique: string | null;
  isWeighInMiss: boolean; // 「体重超過」の明示
}

export function parseMethod(methodRaw: string, markerA: RizinRawBout["markerA"]): ParsedMethod {
  if (markerA === "NC" || /ノーコンテスト/.test(methodRaw)) {
    return {
      resultType: "nc",
      round: null,
      time: null,
      technique: methodRaw,
      isWeighInMiss: /体重超過/.test(methodRaw),
    };
  }
  if (/ドロー/.test(methodRaw)) {
    return { resultType: "draw", round: null, time: null, technique: methodRaw, isWeighInMiss: false };
  }
  if (/中止|キャンセル/.test(methodRaw)) {
    return { resultType: "cancelled", round: null, time: null, technique: methodRaw, isWeighInMiss: false };
  }
  // 例:「2R 0分37秒 TKO（レフェリーストップ：グラウンドでのキック）」
  //     「5分3R終了 判定3-0」
  const roundMatch = methodRaw.match(/^(\d+R)/);
  const timeMatch = methodRaw.match(/(\d+分\d+秒)/);
  if (!roundMatch && !timeMatch && !markerA) {
    return { resultType: "unknown", round: null, time: null, technique: methodRaw, isWeighInMiss: false };
  }
  return {
    resultType: "decisive",
    round: roundMatch ? roundMatch[1] : null,
    time: timeMatch ? timeMatch[1] : null,
    technique: methodRaw,
    isWeighInMiss: false,
  };
}

// data/rizinRecords.json の出力形式(scripts/update-rizin-records.tsが書き出す)。
// rizinRecordsAggregate.ts等、生成物を読む側と型を共有するためここに置く。
export interface RizinRecordsBout {
  cardPosition: number; // ページ内の出現順(1=オープナー〜N=メインイベント)
  isOpeningFight: boolean;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string; // "MMA" | "キックボクシング" | "シュートボクシング" | "グラップリング" | "その他"
  weightKg: number | null;
  namedDivision: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  winnerName: string | null;
  winnerSlug: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
  isWeighInMiss: boolean;
}

export interface RizinRecordsEvent {
  eventName: string;
  date: string;
  sourceUrl: string;
  fetchedDate: string;
  bouts: RizinRecordsBout[];
  parseFailures: number;
}

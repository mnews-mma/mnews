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
  // 貪欲マッチ: 1チャンク内に複数のraw-html divがあるケース(例: RIZIN.21の
  // YouTube動画埋め込み用div→結果本体のdivの順)で、非貪欲マッチだと1つ目の
  // divの内側の入れ子</div>で打ち切られ結果本体に届かなかった(PR #239で特定)。
  // チャンク境界(次のh2見出し直前)までの範囲でしか動かないため、貪欲化しても
  // 他チャンクへ食い込むことはない。
  const rawHtmlMatch = chunk.match(/<div class="raw-html">([\s\S]*)<\/div>/);
  if (!rawHtmlMatch) return null;
  const rawHtml = rawHtmlMatch[1];

  const pMatch = rawHtml.match(/<p style="text-align:center;">([\s\S]*?)<\/p>/);
  if (!pMatch) return null;
  const pContent = pMatch[1];

  // font-weight:bold(スペースなし)とfont-weight: bold(スペースあり)の両方を
  // 許容する(RIZIN.10で後者の表記が使われていたためPR #239で特定)。
  const spanMatch = pContent.match(/<span style="font-weight:\s*bold">([\s\S]*?)<\/span>/);
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
// プレーンテキスト、勝敗は角括弧[Win]/[Lose]表記(半角・全角［Win］／［Lose］の
// 両方が実在。RIZIN.5は全角、PR #239で特定)、決着方式は選手名の間の
// 全角括弧内に埋め込まれる。
// <p>［ルール情報］</p><h3 class="article-subheading">[Win] A （ 決着方式 ） B [Lose]</h3>
function parseBoutChunkFormatB(chunk: string, headingText: string): RizinRawBout | null {
  const ruleMatch = chunk.match(/<p>［([\s\S]*?)］<\/p>/);
  const ruleLineRaw = ruleMatch ? stripTags(ruleMatch[1]) : "";

  const h3Match = chunk.match(/<h3 class="article-subheading"[^>]*>([\s\S]*?)<\/h3>/);
  if (!h3Match) return null;
  const h3Text = stripTags(h3Match[1]);

  // 半角[Win]/[Lose]と全角［Win］／［Lose］の両方を許容する(RIZIN.5で
  // 全角表記が使われていたためPR #239で特定)。
  const m = h3Text.match(/^[\[［](\w+)[\]］]\s*(.+?)\s*（([\s\S]*?)）\s*(.+?)\s*[\[［](\w+)[\]］]/);
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
//
// 判定方向(2026-07-28、PR #250で反転): 従来は"MMA"という文字列を含むかどうかで
// MMAを判定していたが、RIZIN公式の実際のルール表記には"MMA"という文字列を
// 含まないMMA戦が多数ある(「RIZINトーナメントルール」「ユニファイドルール」
// (Unified Rules of MMAの正式名称)等。PR #246の悉皆監査で「その他」44件中
// 21件がこのパターンで実際はMMAだったと判明。同種の取りこぼしを起こすのは
// これで4回目)。RIZINはMMA団体で非MMAが例外のため、判定を反転し、
// **非MMAと積極的に判定できる語を名指しし、それ以外はMMAとして扱う**方向にした。
// 名指しする語のリスト(NON_MMA_RULE_PATTERNS)は、PR #246で「正しく非MMA」と
// 確認された23件の実際の原文表記から抽出したものであり、推測で追加した語は無い。
//
// ルール行テキスト自体が無い(空文字)場合は、MMAとも非MMAとも決めつけずunknown
// (判定不能)を返す(#240から変更なし。捏造ゼロの原則)。
//
// "その他"はparseRuleInfoからは生成しなくなった(反転後は非MMA語に一致しない
// 非空テキストは全てMMAとして扱われるため)。値としては引き続き有効で、手動
// 書き起こし(rizinRecordOverrides.ts)側が明示的に「非MMAだが具体的な分類語を
// 割り当てたくない」と判断した場合にのみ使う想定(現状そのような使用例は無い)。
export interface ParsedRuleInfo {
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "グラップリング" | "ベアナックル" | "スタンディングバウト" | "エキシビジョン" | "MIXルール" | "チャレンジルール" | "その他" | "unknown";
  weightKg: number | null;
  namedDivision: string | null; // 例:「フェザー級」「バンタム級」。明示が無ければnull
}

// 非MMAと積極的に判定できる語のパターン。PR #246の実測(44件悉皆監査)で確認済みの
// 表記のみを列挙している(推測で追加した語は無い):
// - キックボクシング: 「RIZINキックボクシグルール」(誤字表記も実在)・「RIZIN
//   Kickboxingルール」(英語表記)・「IISKAユニファイドルール」(ISKAはキック
//   ボクシング系サンクショニングボディ。"ユニファイドルール"という文字列を
//   含むが、ISKAが前置される場合は非MMAと判定する必要があるためキックボクシング
//   パターンで先に捕捉する)
// - シュートボクシング: 既存キーワードのまま
// - グラップリング: 既存キーワードに加え「柔術」(「柔術エキシビジョン
//   イリミネーションマッチ」)も対象
// - ベアナックル: 「ベアナックルルール」(グローブ無しの別競技)
// - スタンディングバウト: 「RIZINスタンディングバウト(特別)ルール」(寝技無しの
//   立ち技のみ特別ルール。9件確認)
// - エキシビジョン: 「柔術エキシビジョン」「スペシャルエキシビジョン」(フロイド・
//   メイウェザー vs. 那須川天心のボクシングエキシビジョン等、確認できた2件は
//   いずれも非MMA)
// - MIXルール: 那須川天心の異種格闘技クロスオーバー戦で使われる表記。PR #246で
//   人間判断が必要と報告した既存試合(那須川天心 vs 才賀紀左衛門)の分類を
//   今回変更しない(現状維持)ためのキーワード
// - チャレンジルール: 同じくPR #246で人間判断が必要と報告した既存試合(あい vs
//   川村虹花)の分類を今回変更しない(現状維持)ためのキーワード
export const NON_MMA_RULE_PATTERNS: { pattern: RegExp; label: Exclude<ParsedRuleInfo["ruleType"], "MMA" | "その他" | "unknown"> }[] = [
  // 「キックボクシ」で止め、末尾の「ング」を必須にしない(「RIZINキックボクシグ
  // ルール」という誤字表記が実在するため。PR #250実装時にこの誤字により
  // 憂也×田中STRIKE雄基戦(RIZIN.16)がMMAへ誤分類される事故を実装中に発見・修正)。
  { pattern: /キックボクシ|Kickboxing|ISKA/i, label: "キックボクシング" },
  { pattern: /シュートボクシング/, label: "シュートボクシング" },
  { pattern: /グラップリング|柔術/, label: "グラップリング" },
  { pattern: /ベアナックル/, label: "ベアナックル" },
  { pattern: /スタンディングバウト/, label: "スタンディングバウト" },
  { pattern: /エキシビジョン/, label: "エキシビジョン" },
  { pattern: /MIXルール/i, label: "MIXルール" },
  // 「RIZIN チャレンジ ルール」のように「チャレンジ」と「ルール」の間に全角/半角
  // スペースが入る表記が実在するため(あい×川村虹花戦、RIZIN平成最後のやれんのか！
  // 2018-12-31)、間の空白の有無を許容する。空白無しを前提にした初回実装では
  // この表記を拾えず、意図せずMMAへ分類される事故を実装中に発見・修正した。
  { pattern: /チャレンジ\s*ルール/, label: "チャレンジルール" },
];

// applyRizinRecordsToHistory()の除外判定(rizinRecordsOverride.ts)と共有する、
// 「確定的に非MMA」なruleTypeラベルの集合(判定を1箇所に集約するため。PR #250)。
// NON_MMA_RULE_PATTERNSのlabel全てに加え、手動書き起こし側が明示的に使う
// 可能性のある"その他"を含む。"MMA"・"unknown"、および手動書き起こし側が
// 使う"女子MMA"のような値はここに含まれないため、除外対象にならない。
export const NON_MMA_RULE_TYPE_LABELS = new Set<string>([...NON_MMA_RULE_PATTERNS.map((p) => p.label), "その他"]);

const NAMED_DIVISION_RE = /(フライ級|バンタム級|フェザー級|ライト級|ウェルター級|ミドル級|ライトヘビー級|ヘビー級|ストロー級|アトム級)/;

export function parseRuleInfo(ruleLineRaw: string): ParsedRuleInfo {
  let ruleType: ParsedRuleInfo["ruleType"];
  if (ruleLineRaw.trim() === "") {
    // ルール行テキスト自体が無い場合はMMAとも非MMAとも決めつけない(#240から変更なし)。
    ruleType = "unknown";
  } else if (/MMA/i.test(ruleLineRaw)) {
    // "MMA"という文字列が明示されている場合は常にMMA(旧ロジックと同じ最優先判定)。
    // 「RIZIN MMAチャレンジルール」(RIZIN.33、三浦孝太×YUSHI)のように、非MMA語
    // (「チャレンジルール」)と"MMA"の両方を含む表記が実在するため、この明示的な
    // "MMA"の有無チェックを非MMA語チェックより先に行う(実装中に発見。反転前は
    // このケースが正しくMMAと判定できていたため、反転後も同じ結果を保つ必要が
    // あった)。
    ruleType = "MMA";
  } else {
    const nonMma = NON_MMA_RULE_PATTERNS.find((p) => p.pattern.test(ruleLineRaw));
    // 非MMA語に一致せず、かつ空でもない場合はMMAとして扱う(反転後のデフォルト。
    // RIZINはMMA団体で非MMAが例外であるため)。
    ruleType = nonMma ? nonMma.label : "MMA";
  }

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

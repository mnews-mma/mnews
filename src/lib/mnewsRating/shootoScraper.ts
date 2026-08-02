// shooto-mma.com(修斗公式サイト)の「試合結果」ページから試合単位のデータを
// 機械抽出する純関数群(I/O・fetchは持たない。scripts/build-shooto-records.tsが
// 呼び出す)。data/rizinRecords.json/rizinScraper.tsの設計を踏襲するが、
// **ランキング集計パイプラインには一切接続しない**(このファイルはdata/
// shootoRecords.jsonを生成するscripts/build-shooto-records.ts専用の入力であり、
// src/配下の表示・集計コードからimportされてはならない)。
//
// 抽出方針: 公式サイトの表記をそのまま保持し、推測・補完は一切行わない。
// 解決できない項目(選手名寄せ・階級名・勝者など)はnullのまま返し、呼び出し側で
// 「欠落」として集計・報告する。

export interface ShootoRawFighter {
  shootoId: number;
  name: string;
  gym: string | null;
  isDimmed: boolean; // center-blockのstyleにopacity:0.3を含む(=敗者を示す装飾)
  weighInKg: number | null; // 「計量結果 : 49.8 Kg」からの実測値(選手ごと別々)
}

export interface ShootoRawBout {
  boutId: number; // matchmake-box data-id
  headingText: string; // matchmake-title の生テキスト(カード位置ラベル・カード番号・タイトル戦名・階級・ラウンド形式を含む)
  cardNumber: number | null; // 「第N試合」から抽出した番号(無ければnull)
  strapTitle: string | null; // タイトルマッチ名など、「第N試合」より前(または<strong>内)の文言
  namedDivision: string | null; // matchmake-title内1つ目の<p>(階級表記)
  roundFormat: string | null; // matchmake-title内2つ目の<p>(例:「5分5R」)
  fighterA: ShootoRawFighter;
  fighterB: ShootoRawFighter;
  resultTypeClass: string | null; // 例: "ko" | "tko" | "submision" | "ud" | "f" | "nm" | "technical-ud" | "technical-draw"
  resultTypeText: string | null; // 例: "TS" | "判定 2-1" | "反則失格" | "不戦" | "テクニカルドロー"
  resultMethodText: string | null; // <div class="result-method">の中身(例:「リアネイキッドチョーク」)。無ければnull
  resultRound: string | null; // 例 "3R"
  resultTime: string | null; // 例 "02:41"
  udScoreText: string | null; // <span class="ud-score">の中身(通常は空。旧テンプレートでのみ判定スコアが入る)
  noteRaw: string | null; // <div class="note">のテキスト(改行は\nに正規化)。無ければnull
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/[\s　]+/g, " ").trim();

// ── 1. 大会id発見 ──────────────────────────────────────────────────────

// 「/result/」一覧ページからリンク済みの大会id集合を抽出する(href="./?id=N"形式)。
export function extractLinkedEventIds(indexHtml: string): number[] {
  const ids = new Set<number>();
  const re = /href="\.\/\?id=(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexHtml))) ids.add(Number(m[1]));
  return [...ids].sort((a, b) => a - b);
}

// 欠番id集合(min〜maxの間でリンクされていないid)を計算する。
export function computeMissingIds(linkedIds: number[]): number[] {
  if (linkedIds.length === 0) return [];
  const min = Math.min(...linkedIds);
  const max = Math.max(...linkedIds);
  const linkedSet = new Set(linkedIds);
  const missing: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!linkedSet.has(i)) missing.push(i);
  }
  return missing;
}

// 「テスト」「test」を含むタイトルは管理用ページとして除外する(大文字小文字を
// 無視。id=296「前田テスト」に加え、id=277「test」・id=278「test02」のような
// 英字表記の管理用ページも除外する)。
const TEST_TITLE_RE = /テスト|test/i;

// result-dayが実在しうる日付か(YYYY-MM-DD形式かつ年が現実的な範囲内)。
// 「0000-00-00」「1912-01-01」「1913-01-01」のような管理用プレースホルダーを
// 除外する目的の緩いガードであり、実在イベントを誤って弾かないことを最優先する。
// 修斗の団体創設は1989年のため1989年を下限とする(2016年を下限にした初回実装では
// VTJ 1st〜7th・BORDER等の2012〜2015年の実在大会〈id=16,17,18,21-26,31,33等〉を
// 誤って除外する事故があり、実装中に発見・修正した)。
//
// 注意: この判定は「今日」を一切参照しない純粋な文字列形式チェック(スクレイピング
// してきた既存の暦日文字列が壊れていないかの確認のみ、Dateオブジェクトへの変換や
// タイムゾーン換算は行わない)。check-jst-date-bypass.tsの検出対象(JST日付計算の
// 唯一の実装=eventCountdown.tsを迂回する「今」の計算)とは性質が異なるため、
// eventCountdown.ts側のヘルパーは使わず、桁数チェックのみで実装する。
const ALL_DIGITS_RE = /^\d+$/;

export function isPlausibleEventDate(day: string): boolean {
  const parts = day.split("-");
  if (parts.length !== 3) return false;
  const [yearPart, monthPart, dayPart] = parts;
  if (yearPart.length !== 4 || monthPart.length !== 2 || dayPart.length !== 2) return false;
  if (!ALL_DIGITS_RE.test(yearPart) || !ALL_DIGITS_RE.test(monthPart) || !ALL_DIGITS_RE.test(dayPart)) return false;
  const year = Number(yearPart);
  const EARLIEST_PLAUSIBLE_YEAR = 1989;
  return year >= EARLIEST_PLAUSIBLE_YEAR;
}

function extractResultDay(html: string): string {
  const dayMatch = html.match(/<span class="result-day">([^<]*)<\/span>/);
  return dayMatch ? dayMatch[1].trim() : "";
}

function extractResultTitleText(html: string): string {
  const titleMatch = html.match(/<span class="result-title">([^<]*)<\/span>/);
  const title = titleMatch ? titleMatch[1].trim() : "";
  if (title) return title;
  // 一部のページ(例: id=96「Supported by ONE Championship」表記の大会)は
  // result-titleが空で、実際の大会名がresult-presentsに入っている(捏造ではなく
  // 別テンプレート variantの実在パターン。実測で確認済み)。
  const presentsMatch = html.match(/<span class="result-presents">([^<]*)<\/span>/);
  return presentsMatch ? presentsMatch[1].trim() : "";
}

// 欠番ページが「リンク欠落だが実在する大会」かどうかを判定する(欠番探索専用の
// 厳しめの判定。実際のbout件数を持つことまで要求する)。
// - result-dayが実在しうる日付である
// - 実際のbout(matchmake-box data-id)を1件以上持つ
// - タイトルに「テスト」「test」を含まない
export function isRealMissingEvent(html: string): boolean {
  const day = extractResultDay(html);
  if (!isPlausibleEventDate(day)) return false;

  const boutIds = [...html.matchAll(/class="matchmake-box[^"]*"\s+data-id="(\d+)"/g)];
  if (boutIds.length === 0) return false;

  const title = extractResultTitleText(html);
  if (TEST_TITLE_RE.test(title)) return false;

  return true;
}

// ── 2. 大会ページ メタ情報 ────────────────────────────────────────────

export interface ShootoEventMeta {
  eventName: string;
  date: string; // YYYY-MM-DD (result-dayの表記をそのまま使う)
  venue: string | null;
}

// linked(/result/一覧にリンクされている)idに対する判定はこちらを使う。
// isRealMissingEventと異なり、bout件数0件のページ(例: id=66「BORDER-season10
// 「The2nd」」、実在するがマッチメイクデータが空)も有効な大会として扱う――
// サイト自身が一覧に掲載している時点で「実在する大会」であることは確定しており、
// bout件数0はそのまま(空の)bouts配列として出力すればよい(除外は指示書の
// 対象外。除外するとPR#247で確定した「226件」という大会数の再現が崩れる)。
export function parseEventMeta(html: string): ShootoEventMeta | null {
  const date = extractResultDay(html);
  if (!isPlausibleEventDate(date)) return null;

  const eventName = extractResultTitleText(html);
  if (!eventName) return null;
  if (TEST_TITLE_RE.test(eventName)) return null;

  // 会場: <table class="table table-bg table-eventInfo">内の「会場」行から取る。
  // <a>リンクで囲まれている場合(例: id=251)があるため、tdの中身全体を取ってから
  // タグを除去する。既知の「(なし)」的な空文字はnullとして扱う。
  const venueMatch = html.match(/<tr><th>会場<\/th><td>([\s\S]*?)<\/td><\/tr>/);
  const venueRaw = venueMatch ? stripTags(venueMatch[1]) : "";
  const venue = venueRaw ? venueRaw : null;

  return { eventName, date, venue };
}

// ── 3. bout単位への分割 ────────────────────────────────────────────────

// 1大会ページのHTML全体を、bout単位のチャンク(matchmake-box全体)に分割する。
// 終端は<!--matchmake-box-->コメントで明示されているため、これを区切りに使う
// (この区切り自体は本文中に他の用途で出現しないためシンプルな文字列検索で安全)。
export function splitIntoBoutBoxes(html: string): Array<{ boutId: number; chunk: string }> {
  const re = /<div class="matchmake-box h_js" data-id="(\d+)">([\s\S]*?)<!--matchmake-box-->/g;
  const out: Array<{ boutId: number; chunk: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ boutId: Number(m[1]), chunk: m[2] });
  }
  return out;
}

// ── 4. bout単体のパース ────────────────────────────────────────────────

const POSITION_LABEL_RE = /(メインイベント|セミファイナル|オープニングファイト|大将戦|副将戦|次鋒戦|先鋒戦)/g;

function parseTitleBlock(chunk: string): {
  headingText: string;
  cardNumber: number | null;
  strapTitle: string | null;
  namedDivision: string | null;
  roundFormat: string | null;
} {
  const titleMatch = chunk.match(/<div class="matchmake-title">([\s\S]*?)<\/div>/);
  const titleInner = titleMatch ? titleMatch[1] : "";

  const headingText = stripTags(titleInner);

  const cardNumMatch = headingText.match(/第(\d+)試合/);
  const cardNumber = cardNumMatch ? Number(cardNumMatch[1]) : null;

  // <p>タグは階級・ラウンド形式(通常は先頭2つ)。それより前がタイトル文言(strap)部分。
  const preP = titleInner.split(/<p>/)[0];
  const pTags = [...titleInner.matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1].trim()).filter((s) => s !== "");
  // <p>タグが1つしか無いケースが2種類ある(捏造を避けるため、どちらか判別してから割り当てる):
  //   - 純粋なラウンド形式のみ(例:「5分3R」。階級表記が無い) → roundFormatとして扱う
  //   - 階級とラウンドが1つの<p>にまとまっている旧テンプレート(例:「フライ級 5回戦」)
  //     → そのままnamedDivisionとして扱う(分割すると推測補完になるため、原文のまま残す)
  const ROUND_ONLY_RE = /^\d+分\d+R$/;
  let namedDivision: string | null;
  let roundFormat: string | null;
  if (pTags.length >= 2) {
    namedDivision = pTags[0];
    roundFormat = pTags[1];
  } else if (pTags.length === 1) {
    if (ROUND_ONLY_RE.test(pTags[0])) {
      namedDivision = null;
      roundFormat = pTags[0];
    } else {
      namedDivision = pTags[0];
      roundFormat = null;
    }
  } else {
    namedDivision = null;
    roundFormat = null;
  }

  // strapTitle: <strong>内のテキストがあればそれを優先(2016年頃の旧テンプレートで
  // 「第N試合」の後にタイトル文言が<strong>で続くケースがある)。無ければ
  // 「第N試合」より前のプレーンテキストから、カード位置ラベルを除いた残りを使う。
  let strapTitle: string | null = null;
  const strongMatch = preP.match(/<strong[^>]*>([\s\S]*?)<\/strong>/);
  if (strongMatch) {
    const s = stripTags(strongMatch[1]);
    strapTitle = s || null;
  } else {
    const beforeCardNum = stripTags(preP).split(/第\d+試合/)[0];
    const cleaned = beforeCardNum.replace(POSITION_LABEL_RE, " ").replace(/[\s　]+/g, " ").trim();
    strapTitle = cleaned || null;
  }

  return { headingText, cardNumber, strapTitle, namedDivision, roundFormat };
}

function parseFighterBlock(chunk: string, marker: "A" | "B", index: 0 | 1): ShootoRawFighter | null {
  const re = /<div class="matchmake col-xs-6 col-md-6 fighter fighter-mdl" data-id="(\d+)">([\s\S]*?)<div class="weight-test">([\s\S]*?)<\/div>\s*<\/div>/g;
  const matches = [...chunk.matchAll(re)];
  const m = matches[index];
  if (!m) return null;

  const shootoId = Number(m[1]);
  const middle = m[2];
  const weightTestInner = m[3];

  const centerBlockMatch = middle.match(/<div class="center-block" style="([^"]*)"/);
  const style = centerBlockMatch ? centerBlockMatch[1] : "";
  const isDimmed = /opacity\s*:\s*0\.3/.test(style);

  const nameMatch = middle.match(/<span class="fighter-name">([^<]*)<\/span>/);
  const name = nameMatch ? nameMatch[1].replace(/[\s　]+/g, " ").trim() : "";

  const gymMatch = middle.match(/<span class="gym-name">([^<]*)<\/span>/);
  const gym = gymMatch ? gymMatch[1].trim() || null : null;

  const weighInMatch = weightTestInner.match(/([\d.]+)\s*Kg/i);
  const weighInKg = weighInMatch ? Number(weighInMatch[1]) : null;

  return { shootoId, name, gym, isDimmed, weighInKg };
}

export function parseBoutBox(boutId: number, chunk: string): ShootoRawBout | null {
  const title = parseTitleBlock(chunk);
  const fighterA = parseFighterBlock(chunk, "A", 0);
  const fighterB = parseFighterBlock(chunk, "B", 1);
  if (!fighterA || !fighterB) return null; // 選手情報が2名分取れないチャンクはパース失敗として扱う

  // 通常テンプレート: <span class="result-type"><span class="CLASS">TEXT</span></span>
  let resultTypeMatch = chunk.match(/<span class="result-type"><span class="([^"]*)">([^<]*)<\/span>/);
  // 旧テンプレート(例: event id=264): result-typeが空で、決着クラスが兄弟の
  // <span>として直接置かれる(<span class="draw">ドロー</span><span
  // class="result-type"></span><span class="ud-score">判定 0 - 0</span>)。
  // 既知のクラス語彙のみを対象にする(無関係なspanを誤って拾わないため)。
  if (!resultTypeMatch) {
    resultTypeMatch = chunk.match(/<span class="(ko|tko|submision|ud|f|nm|technical-ud|technical-draw|draw|nc)">([^<]*)<\/span>/);
  }
  // さらに別の旧テンプレート(2026-07-29、レビュー指摘の再監査で発見。14件):
  // <div class="getresult">自体が存在せず、<div><span class="nocontest">
  // ノーコンテスト</span><div class="note">...</div></div>という最小構造のみ
  // (result-type・ud-score・opacityによる判定材料が一切無い)。230大会全bout
  // (2,145件)を対象にresult-type/nocontest/該当無しの3パターンで全数を確認済み
  // (getresultあり2,130件+nocontestのみ14件+どちらも無し1件〈id=80、実際に
  // 結果データが無いFORCE 09〉=2,145件で過不足なし)。
  if (!resultTypeMatch) {
    resultTypeMatch = chunk.match(/<span class="(nocontest)">([^<]*)<\/span>/);
  }
  const resultTypeClass = resultTypeMatch ? resultTypeMatch[1] : null;
  const resultTypeText = resultTypeMatch ? resultTypeMatch[2].trim() : null;

  const resultMethodMatch = chunk.match(/<div class="result-method">([^<]*)<\/div>/);
  const resultMethodText = resultMethodMatch ? resultMethodMatch[1].trim() || null : null;

  const resultRoundMatch = chunk.match(/<span class="result-round"><b>(\d+)<\/b>R<\/span>/);
  const resultRound = resultRoundMatch ? `${resultRoundMatch[1]}R` : null;

  const resultTimeMatch = chunk.match(/<span class="result-time">([^<]*)<\/span>/);
  const resultTime = resultTimeMatch ? resultTimeMatch[1].trim() || null : null;

  // ud-score: 通常は空だが、上記の旧テンプレートでは判定スコア(例:「判定 0 - 0」)を
  // 持つことがある。result-typeテキストに数字が無い場合の補助的なスコア源として使う。
  const udScoreMatch = chunk.match(/<span class="ud-score">([^<]*)<\/span>/);
  const udScoreText = udScoreMatch ? udScoreMatch[1].trim() || null : null;

  // note: <br />を改行に変換してからタグを除去する(タグ除去を先にやると改行も
  // 空白扱いで潰れてしまい、ジャッジ採点を1行ずつ読む処理が壊れるため、
  // 「改行変換→タグ除去→行ごとに整形」の順を守る)。
  const noteMatch = chunk.match(/<div class="note"[^>]*>([\s\S]*?)<\/div>/);
  let noteRaw: string | null = null;
  if (noteMatch) {
    const withBreaks = noteMatch[1].replace(/<br\s*\/?>/g, "\n");
    const noTags = withBreaks.replace(/<[^>]+>/g, "");
    const lines = noTags
      .split("\n")
      .map((l) => l.replace(/[\s　]+/g, " ").trim())
      .filter((l) => l !== "");
    noteRaw = lines.length > 0 ? lines.join("\n") : null;
  }

  return {
    boutId,
    headingText: title.headingText,
    cardNumber: title.cardNumber,
    strapTitle: title.strapTitle,
    namedDivision: title.namedDivision,
    roundFormat: title.roundFormat,
    fighterA,
    fighterB,
    resultTypeClass,
    resultTypeText,
    resultMethodText,
    resultRound,
    resultTime,
    udScoreText,
    noteRaw,
  };
}

// ── 5. 勝敗判定(3段フォールバック) ────────────────────────────────────

export type ShootoOutcome = {
  winner: "A" | "B" | null;
  resultType: "decisive" | "draw" | "nc" | "cancelled" | "unknown";
};

// note本文中の各ジャッジ採点行から、判定の多数決を取る。
// 「片岡 誠人19-19（1R 10-9／2R 9-10）」のような行から、判定名の直後の
// 集計スコア(丸括弧の外側、最初に現れる「N-M」)を1judgeぶんの票として使う。
// 丸括弧内のラウンドごとの内訳(例:「1R 10-9」)は対象外(行内で最初にマッチする
// 「N-M」パターンが必ず丸括弧より前の集計スコアになるため、素直な最左マッチでよい)。
function judgeMajority(noteRaw: string): "A" | "B" | "tie" | null {
  const lines = noteRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const tallies: Array<[number, number]> = [];
  for (const line of lines) {
    // ［レフェリー］［ジャッジ］等のラベル行、および「＊」「※」で始まる注記行
    // (例:「＊青：緑が優勢ポイント1-2 によりトーナメント決勝に進出」)はスキップする。
    // 注記行にも「N-M」形式の数字が偶然含まれることがあり(上記の「1-2」は
    // トーナメント勝ち点であってジャッジ採点ではない)、これを実装当初は
    // ジャッジ票として誤集計しており、オラクルCSVとの照合で発見・修正した。
    if (/^[［＊※]/.test(line)) continue;
    // 「N-M」の直後に丸括弧+ラウンド内訳(例:「（1R 10-9／2R 9-10）」)が続く行
    // のみを1judgeぶんの集計スコアとして扱う。ジャッジ採点行は必ずこの
    // ラウンド内訳を伴う(このファイル中で確認した全実例で一致)。
    //
    // 経緯(2026-08-02、指示書R-7で発見): ［＊※で始まらない注記文
    // (例:「優勢ポイント1-2で飯田選手がトーナメント準決勝進出」、たてお×SASUKE
    // 2016-07-17の実例。トーナメント勝ち上がりに関する注記で、飯田選手という
    // 本bout の当事者ではない選手名を含む=別カードの注記が誤って紐付いている
    // 疑いがある)も「N-M」形式の数字を偶然含み、上記スキップに掛からず
    // ジャッジ票として誤集計され、決着の勝者を逆転させる事故があった。
    // ラウンド内訳の有無で本物のジャッジ採点行と区別する。
    const m = line.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*[（(]\s*\d+R/);
    if (m) tallies.push([Number(m[1]), Number(m[2])]);
  }
  if (tallies.length === 0) return null;
  let favorsA = 0;
  let favorsB = 0;
  for (const [a, b] of tallies) {
    if (a > b) favorsA++;
    else if (a < b) favorsB++;
  }
  // 過半数(tallies.length中、favorsA/Bが半数超)を取った側のみ決着とする。
  // 同点(a===b)のジャッジは favorsA/favorsB どちらにも数えないため、
  // 「3人中1人だけが支持し残り2人が同点」は favorsA=1,favorsB=0 のように
  // 一見「相対的に多い」ように見えるが、決着に必要な過半数(3人中2人)に
  // 達していないため引き分け(majority draw)として扱う。
  //
  // 経緯(2026-08-02、指示書R-7で発見): 単純な相対比較(favorsA>favorsB
  // だけで決着とする)を使っていたため、上記のような「majority draw」を
  // 決着勝ちと誤判定していた(実例5件、亮我×山口峻・高岡宏気×3名・
  // 青井太一×たてお)。いずれも修斗公式サイト側は明示的な「draw」バッジを
  // 出しており、resultTypeClass側の最優先判定(このファイル上部のコメント
  // 参照)で救われるケースとは別に、バッジが無くノート欄の採点表記のみで
  // 判定するケースでこのバグが露見していた。
  //
  // 過去に一度「過半数が必要」ルールに変更してオラクルCSV(PR#247)との
  // 不一致が増えたため単純な相対比較に戻した、という経緯が上部にあったが、
  // オラクルCSV自身がこの同じ単純多数決バグを持っていることは上部の
  // resultTypeClass="draw"優先化の際に既に判明している(オラクルと
  // 一致すること自体がmajority drawケースでの正しさの根拠にならない)。
  // 実例5件を公式サイトの表示(draw バッジ)で個別に裏取りした上で、
  // 過半数ルールへ再度修正する。
  const majority = Math.floor(tallies.length / 2) + 1;
  if (favorsA >= majority) return "A";
  if (favorsB >= majority) return "B";
  return "tie";
}

// ノートに実質的な理由(ノーコンテスト・欠場等)が書かれているケースは、
// オラクルCSV(PR#247の参考実装)で一律NO_CONTEST相当として扱われている
// (id=131/bout=3441「欠場した為、試合中止に」、id=79/bout=2884「感染性胃腸炎の為
// 欠場」等で確認済み)。ノートに理由が無く見出しだけが「中止」を示すケース
// (id=251/bout=4538「※中止※」、ノート自体が存在しない)はオラクル側で
// UNRESOLVED相当になる(見出しだけでは実際の理由が分からないため)。
// このため「ノートに理由がある→nc」「見出しにしか無い→cancelled」で分ける。
const NC_NOTE_KEYWORDS = ["ノーコンテスト", "無効試合", "勝敗なし", "欠場", "試合中止", "試合不成立"];
const CANCELLED_HEADING_KEYWORDS = ["中止", "欠場", "試合不成立"];
const DRAW_KEYWORDS = ["引き分け"];

// eventNameはデフォルト空文字(既存呼び出し元との後方互換のため省略可能)。
// 背景(2026-08-01、指示書Zの調査で発見): 大会自体が中止された場合、公式サイトは
// イベント名(見出しページのタイトル)側にのみ「【中止】」と付け、各bout単位の
// headingText(「第N試合 ○○級 5分2R」等)には中止の痕跡が一切残らない
// (試合が実施されていないため当然、個々のカードの見出しには理由が書かれない)。
// CANCELLED_HEADING_KEYWORDSはbout単位のheadingTextしか見ていないため、
// このケース(大会単位の中止)を検出できずunknownに落ちていた
// (実測: 全データセット中「【中止】」を含むeventNameは1件のみ、
// PROFESSIONAL SHOOTO 2020 Supported by ONE Championship・該当7bout全件)。
export function resolveOutcome(raw: ShootoRawBout, eventName: string = ""): ShootoOutcome {
  // 最優先: draw/technical-draw クラスは常にdraw。opacity/score/noteの判定を
  // 経由しない。
  //
  // 「draw」クラス(<span class="draw">ドロー</span>、result-typeの外側の
  // 兄弟spanとして現れる。旧テンプレートの一部ページで確認、全230大会走査で
  // 52件)は、ページ自身が明示的に描画している確定済みの結果バッジであり、
  // 最優先で扱う。
  //
  // 経緯(2026-07-29、レビュー指摘により修正): 実装当初はこのバッジを「判定
  // スコアや採点データを持たない場合の汎用プレースホルダー」と誤って解釈し、
  // ノート欄のジャッジ採点多数決やオラクルCSV(PR#247参考実装)の判定を優先する
  // 実装にしていた。しかし52件全件を目視・再検証した結果、「draw」バッジは
  // ページ側が正しく算出した確定結果であり、誤っていたのはこちら側の単純な
  // 相対多数決(favorsA>favorsBだけで決着とする実装)だったと判明した。実際の
  // MMA/ボクシングの採点慣習(例: 3人中1人だけが支持し残り2人がタイなら
  // 「majority draw」であって決着ではない)に照らしても「draw」バッジ側が正しい。
  // オラクルCSV自身も同じ単純多数決ロジックを使っており同じ誤りを持っていたため、
  // 「オラクルと一致する」ことは「draw」バッジのケースでは正しさの根拠にならない
  // (オラクルとの照合だけでは検出できない一致した誤り)。
  if (raw.resultTypeClass === "technical-draw" || raw.resultTypeClass === "draw") {
    return { winner: null, resultType: "draw" };
  }

  // 同じく最優先: 「nocontest」クラス(<span class="nocontest">ノーコンテスト
  // </span>、getresult div自体が存在しない最小構造のページでのみ確認。14件)は
  // 明示的なノーコンテスト確定表示であり、ノート欄のキーワード有無に関わらず
  // 常にnc・winner=nullとする。opacity/scoreの判定材料自体がこの構造には存在
  // しない(該当bout chunkにはresult-type/ud-score/center-block opacityの
  // いずれも意味のある値を持たない)。
  if (raw.resultTypeClass === "nocontest") {
    return { winner: null, resultType: "nc" };
  }

  // 1. スコア判定: result-typeテキスト内の「N-M」(例:「判定 2-1」)。
  //    オラクルCSVのresolution_reason「score X-Y (overrides opacity if needed)」の
  //    文言どおり、opacityより先に見る(実データでopacityとスコアが競合する
  //    ケース〈例: event id=191 bout=4069〉があり、スコアを正とするのが
  //    オラクルとの照合で正しいと判明した。実装当初はopacityを先に見ていたが、
  //    このケースで逆方向の勝者を出す事故があり、照合により修正した)。
  //
  // 注意: ud-scoreテキスト(通常は空だが、旧テンプレートの一部ページでのみ
  // 「判定 N - M」のような値を持つ)は判定材料に使わない。この値がノート欄の
  // ジャッジ採点(実際の生データ)と一致しないケースが複数あり(例: event id=1
  // bout=985はud-score「1-0」を持つがノート自体が存在せず検証しようがない、
  // event id=203 bout=4132はud-scoreが空同然の「 - 」で意味を持たない)、
  // 出所や意味が不明確なためオラクルとも整合しなかった(捏造ゼロ原則: 意味が
  // 確認できない数値を判定に使わない)。生データとしてはShootoRawBout.udScoreText
  // に保持する。
  const scoreMatch = raw.resultTypeText ? raw.resultTypeText.match(/(\d+)\s*-\s*(\d+)/) : null;
  let winner: "A" | "B" | null = null;
  let resolvedByScore = false;
  let scoreTie = false;
  if (scoreMatch) {
    const a = Number(scoreMatch[1]);
    const b = Number(scoreMatch[2]);
    if (a === b) {
      // 両者とも同数(例:「判定0-0」「判定1-1」)は、票が足りていてもいなくても
      // どちらの側にも過半数が無い点は変わらないため常にtie。
      scoreTie = true;
      resolvedByScore = true;
    } else if (a >= 2 || b >= 2) {
      // 3人ジャッジ制の過半数(2票)に達している場合のみ決着とする。
      winner = a > b ? "A" : "B";
      resolvedByScore = true;
    }
    // else: 「判定1-0」のように一方が1票、他方が0票のケースは、この表記だけでは
    // 残り(通常1〜2票)が同点(隠れたtie)かどうか分からず、過半数判定ができない。
    // 経緯(2026-08-02、指示書R-7で発見): この「判定N-M」自体が修斗公式サイト側の
    // 表示で、実際には below の judgeMajority() と同じ「同点票を無視した単純比較」
    // で作られている(実例: 亮我×山口峻 2022-08-21はノート欄の生ジャッジ採点が
    // 19-19/18-20/19-19〈2人同点・1人だけ亮我を支持〉なのに、このresultTypeTextは
    // 「判定0-1」〈亮我1票〉となっており、隠れた2つの同点票の情報が失われている)。
    // resolvedByScoreをfalseのままにしてopacity→ノート欄の実採点(judgeMajority)
    // にフォールバックすることで、隠れた同点票を考慮した正しい過半数判定に委ねる。
  }

  // 2. opacity(dimmed)判定: スコアで解決しなかった場合のみ。片方だけが
  //    opacity:0.3ならそちらが敗者。
  if (!resolvedByScore && raw.fighterA.isDimmed !== raw.fighterB.isDimmed) {
    winner = raw.fighterA.isDimmed ? "B" : "A";
  }

  // 3. ノート欄のキーワード・多数決判定(1・2で解決しなかった場合のみ)。
  let notedNc = false;
  let notedDraw = false;
  if (winner === null && !scoreTie && raw.noteRaw) {
    if (NC_NOTE_KEYWORDS.some((k) => raw.noteRaw!.includes(k))) {
      notedNc = true;
    } else {
      const maj = judgeMajority(raw.noteRaw);
      if (maj === "A" || maj === "B") winner = maj;
      else if (maj === "tie") scoreTie = true;
      else if (DRAW_KEYWORDS.some((k) => raw.noteRaw!.includes(k))) notedDraw = true;
    }
  }

  // resultTypeの決定(捏造ゼロ原則: 明示的な語がある場合のみ分類する)。
  let resultType: ShootoOutcome["resultType"];
  if (scoreTie || notedDraw) {
    resultType = "draw";
    winner = null;
  } else if (winner !== null) {
    resultType = "decisive";
  } else if (notedNc) {
    resultType = "nc";
  } else if (CANCELLED_HEADING_KEYWORDS.some((k) => raw.headingText.includes(k) || eventName.includes(k))) {
    resultType = "cancelled";
  } else {
    resultType = "unknown";
  }

  return { winner, resultType };
}

// data/shootoRecords.json の出力形式(scripts/build-shooto-records.tsが書き出す)。
// RizinRecordsBout/RizinRecordsEvent(rizinScraper.ts)と同じ形(大会単位・bout配列)
// をベースに、修斗固有のフィールドを追加している。
export interface ShootoRecordsBout {
  cardPosition: number;
  isOpeningFight: boolean;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string; // 修斗ページに明示のルール種別表記が無いため常に"unknown"(捏造しない)
  weightKg: number | null; // 常にnull(下記fighterA/BWeighInKg参照。単一値への丸め込みをしない)
  namedDivision: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  winnerName: string | null;
  winnerSlug: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
  isWeighInMiss: boolean;
  // 修斗固有の追加フィールド
  fighterAShootoId: number;
  fighterBShootoId: number;
  fighterAGym: string | null;
  fighterBGym: string | null;
  fighterAWeighInKg: number | null;
  fighterBWeighInKg: number | null;
  noteRaw: string | null;
  strapTitle: string | null;
}

export interface ShootoRecordsEvent {
  eventName: string;
  date: string;
  sourceUrl: string;
  fetchedDate: string;
  bouts: ShootoRecordsBout[];
  parseFailures: number;
  // 修斗固有の追加フィールド
  venue: string | null;
  shootoEventId: number;
}

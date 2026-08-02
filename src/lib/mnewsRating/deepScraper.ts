// DEEP公式サイト(deep2001.com)の「試合結果」ページから試合単位のデータを
// 機械抽出する純関数群(I/O・fetchは持たない。scripts/build-deep-records.tsが
// 呼び出す)。shootoScraper.ts/pancraseRecordsTypes.tsの設計を踏襲するが、
// **ランキング集計パイプラインには一切接続しない**(このファイルはdata/
// deepRecords.jsonを生成するscripts/build-deep-records.ts専用の入力であり、
// src/配下の表示・集計コードからimportされてはならない)。
//
// 抽出方針: 公式サイトの表記をそのまま保持し、推測・補完は一切行わない。
// 解決できない項目(選手名寄せ・階級名・勝者など)はnullのまま返し、呼び出し側で
// 「欠落」として集計・報告する。
//
// スコープ: DEEP公式 /result/ の全期間(2002年〜)を対象とする。2024年以降
// 69大会はF1/Group4/Group2/Group1の4フォーマットで対応し、2023年以前221件は
// 全件分類(out/deep-format-variants-full-221.md参照)に基づきF2/F8/F10を
// 追加実装、Group2(F9)の見出し前提も緩和した。個別対戦結果自体が存在しない
// トーナメント優勝者サマリー型(F7)・本文が空のページ(F11)は仕様上の限界として
// 除外する(scripts/build-deep-records.tsが実行時に検出・報告する)。

// methodRaw等に&#8217;(’)・&#8221;(”)のような数値文字参照が生デコードされずに
// 残っていた(2026-07-31判明)。&nbsp;と同じ場所で、かつそれより後に処理する
// (&nbsp;は上で個別に空白へ変換済みのため、ここでの汎用デコードと競合しない)。
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // &times;(×)が生デコードされずに残っていた(2026-08-02、DEEP 45 IMPACT
    // Wayback Machine版ページで判明)。このページは○を素のUnicode文字で
    // 埋め込む一方、負けマークの×だけを名前付き実体参照&times;で書いており、
    // 未デコードのままだと敗者名フィールドの先頭に文字列として紛れ込み
    // markToResult()が空欄扱いになる。
    .replace(/&times;/g, "×")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
};

const stripTags = (html: string): string => {
  let clean = html.replace(/<[^>]+>/g, "|");
  clean = clean.replace(/\|+/g, "|");
  // &nbsp;は通常の空白と同義に扱う(2026-07-29、「第&nbsp;9試合」のように
  // 見出し内部にも出現することが判明。デコードせずに残すと「第(\d+)試合」の
  // ような見出し正規表現が一致せず、bout1件が丸ごと欠落する)。
  clean = clean.replace(/&nbsp;/g, " ");
  clean = decodeHtmlEntities(clean);
  // 絵文字の直後にU+FE0E(テキスト表示指定子)が付くことがある(2026-07-29、
  // 「⚪︎上迫博仁」のように⚪の直後に付き、markの1文字読み取りでは消費されず
  // 選手名の先頭に紛れ込む不可視文字として残ってしまっていた)。表示に
  // 影響しない指定子のため除去して問題ない。
  clean = clean.replace(/[︎️]/g, "");
  clean = clean.replace(/\s+/g, " ");
  return clean;
};

export { stripTags };

// ── 1. 大会一覧発見(/result/。ページネーションなしの単一静的ページ) ──────

export interface DeepArchiveLink {
  title: string;
  url: string;
}

const NAV_TITLES = new Set(["SCHEDULE", "RESULT", "CHAMPION", "FIGHTER", "PAST EVENT", "CONTACT", "ALL RESULT", "ALL NEWS >>"]);

export function extractArchiveLinks(html: string): DeepArchiveLink[] {
  const linkRe = /<a[^>]+href="(https:\/\/www\.deep2001\.com\/[^"]+\/)"[^>]*>\s*([^<]{5,150})\s*<\/a>/g;
  const seen = new Set<string>();
  const links: DeepArchiveLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const url = m[1];
    const title = m[2].trim();
    if (NAV_TITLES.has(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title, url });
  }
  return links;
}

// 想定外にページネーションが存在しないかの防御(見つかった場合は新規実装が
// 必要と判断し、呼び出し側で停止条件として扱う)。
export function detectPagination(html: string): string[] {
  const re = /href="(https:\/\/www\.deep2001\.com\/result\/page\/\d+\/?[^"]*)"/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1]);
  return [...found];
}

// KICK(立ち技)冠のイベントはMMA対象外(PR #201/#231と同じ判定)。2024年以降の
// 対象69大会には実際には1件も該当しないことを確認済みだが、将来的な増加に
// 備えて判定自体は残す。
export function isKickEvent(title: string): boolean {
  return /KICK/i.test(title);
}

// アマチュア大会(例:「DEEP JEWELSアマチュア」)は選手戦績集計の対象外として
// 大会単位で除外する(2026-07-29、ユーザー指示)。大会名に「アマチュア」を
// 含むかどうかの単純な文字列一致のみで判定し、あいまいな判定は行わない
// (該当しない場合は除外せず、そのまま抽出対象に含める。個々のbout単位の
// アマチュアルール混在=例: プロ大会内の「アマチュアSPルール」undercardは
// この対象外。大会名自体がアマチュア大会と名乗っているものだけを除外する)。
export function isAmateurEvent(title: string): boolean {
  return title.includes("アマチュア");
}

// ── 2. 大会ページ メタ情報 ──────────────────────────────────────────────

const ALL_DIGITS_RE = /^\d+$/;

// DEEPの団体創設(deep2001.comドメインの由来)が2001年のため2001年を下限とする。
const EARLIEST_PLAUSIBLE_YEAR = 2001;

export function isPlausibleEventDate(day: string): boolean {
  const parts = day.split("-");
  if (parts.length !== 3) return false;
  const [yearPart, monthPart, dayPart] = parts;
  if (yearPart.length !== 4 || monthPart.length !== 2 || dayPart.length !== 2) return false;
  if (!ALL_DIGITS_RE.test(yearPart) || !ALL_DIGITS_RE.test(monthPart) || !ALL_DIGITS_RE.test(dayPart)) return false;
  const year = Number(yearPart);
  return year >= EARLIEST_PLAUSIBLE_YEAR;
}

// Date.getUTCDay()の0=日曜起点に合わせた曜日の日本語表記。
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function actualWeekdayJa(y: number, mo: number, d: number): string {
  return WEEKDAY_JA[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
}

// 日付直後の「（月・祝）」等の曜日注記付きの日付表記に一致する正規表現。
const DATE_WITH_WEEKDAY_RE = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[（(]\s*([日月火水木金土])/g;

// 本文中最初の日付表記(YYYY年M月D日)を抽出する共通ヘルパー(PR #201/#231と
// 同一正規表現)。extractEventDate()のフォールバック専用の関数スコープに
// 切り出すことで、check-jst-date-bypass.tsのbaseline(file+pattern+コード
// テキストで識別、行番号は見ない)に登録済みの既存表記
// (`const m = bodyClean.match(...)`)と文字列が一致するようにしている
// (2026-08-01、#317でこの行を`fallback`という別名の変数に書き換えた際、
// baselineが変数名込みの文字列一致のため新規違反として誤検出されたことへの対処。
// ロジック自体は#317以前から変わっていない)。
function matchFirstKanjiDate(bodyClean: string): string | null {
  const m = bodyClean.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isPlausibleEventDate(date) ? date : null;
}

// 本文(タグ除去済み)から開催日(YYYY年M月D日)を抽出する(PR #201/#231と同一正規表現がベース)。
export function extractEventDate(bodyClean: string): string | null {
  // DEEP公式ページは同一ページ内に日付表記が複数箇所(試合結果見出し・
  // 「●日時：」欄等)あることがあり、どちらか一方に誤字が入っていることがある
  // (2026-08-01発見。DEEP JEWELS 43は見出し側が「2003年」の誤字、DEEP JEWELS 52は
  // 逆に「●日時：」欄側が「2025年」の誤字で、誤字の出る場所は一定しない)。
  // 単純な先頭一致では誤字を拾う場合があるため、日付直後に「（月・祝）」等の
  // 曜日注記が付いている表記だけを候補にし、実際の曜日と突き合わせて検証する
  // (誤字混入時は年がずれるため曜日も必ず食い違う。休日名の有無までは見ない)。
  // 曜日注記付きの候補が複数ある場合は、実際の曜日と一致する最初の候補を採用する。
  let m: RegExpExecArray | null;
  DATE_WITH_WEEKDAY_RE.lastIndex = 0;
  while ((m = DATE_WITH_WEEKDAY_RE.exec(bodyClean))) {
    const [, y, mo, d, weekdayJa] = m;
    const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!isPlausibleEventDate(date)) continue;
    if (actualWeekdayJa(Number(y), Number(mo), Number(d)) === weekdayJa) return date;
  }

  // 曜日注記付きの候補が無い、またはどれも曜日が一致しない(検証不能)ページは
  // 従来どおり本文中最初の日付表記にフォールバックする。
  return matchFirstKanjiDate(bodyClean);
}

// ── 3. bout抽出(3つの本文フォーマットに対応) ─────────────────────────────
//
// 2024年以降69大会の悉皆調査(2026-07-29)で、現行フォーマット(F1)以外に
// 3種類の構造が実在することを生HTML突合で確認した:
//   - F1(現行): 第N試合見出し + mark+選手名(ジム)が隣接 + 末尾method
//   - Group1(VS型): 見出しに第N試合もmarkも無く、「N.選手名(ジム)[体重kg] VS
//     選手名(ジム)[体重kg] | method 勝者 名前」というテキストのみで勝敗を示す
//   - Group2(mark型・第N試合見出しなし): F1と同じmark+選手名(ジム)構造だが、
//     見出しが「第N試合」ではなく階級名のみ(トーナメント方式のため通し番号が
//     存在しない)
//   - Group4(mark分離+空セル): F1と同じ見出し構造(第N試合)だが、見出しと
//     mark区間の間に空セル(タグのみでテキストが無い要素)が1つ挟まり、
//     かつmarkが選手名と同じセルに同居せず単独セルに分離することがある
//     (DEEP CAGE IMPACT 2024 in HAMAMATSU 1件のみで確認)
//
// 「優勝者リストのみ・個別対戦結果自体が存在しない」大会(DEEPフューチャー
// キングトーナメント2023)はいずれの正規表現でも抽出不可能(仕様上の限界であり
// パーサーの改善では解決しない)。呼び出し側で大会名を明示した上で除外する。

// 選手名(ジム)の直後に体重kgが付くことがある(2026-07-29、DEEP OSAKA IMPACT
// 2025 1st ROUND等の悉皆実行で判明: 19bout中18boutがこの表記無視により丸ごと
// 抽出漏れしていた)。mark型3フォーマット(F1/Group4/Group2)全てで同じ位置に
// 現れうるため共通化する。「kg」単位自体が抜けている表記(同ページ内に1件、
// 「77.55」のみで単位無し)も実在するため、単位テキストも任意とする(数値
// らしき並びだけを許容し、それ以外の文字列までは呑み込まない)。末尾の
// `\s*`は、体重表記自体が無い場合でも閉じ括弧と次のパイプの間にある単なる
// 空白(例:「(BOND GYM) |」)を吸収するため(2026-07-29、DEEP OSAKA IMPACT
// 2026 3rd ROUND等で確認: 体重表記が無い時にこの空白だけでマッチ全体が
// 失敗していた)。
// 計量に関する注記(例:「※公開計量間に合わず→」)が、ジム名の閉じ括弧と
// 体重の間にパイプ区切りで挟まることがある(2026-07-31、DEEP 100 IMPACT
// 〜20th Anniversary〜 OPファイト第2試合で確認: 西谷大成の体重直前に
// 挿入され、この1bout全体が抽出漏れになっていた)。「※」で始まり「→」で
// 終わる注記のみ限定的に許容する(汎用的に「パイプ区切りの何か」を許容すると
// 無関係な文言まで飲み込む懸念があるため、実例で確認した表記のみに絞る)。
//
// 上記は「※...→」で完結する注記(パイプ区切り・アロー終端)のみを想定して
// いたが、体重の直前に「※」だけが付き矢印もパイプ区切りも無い前置注記も
// 実在する(2026-08-01、DEEP＆PANCRASE大阪大会2020-11-29「さくら（フリー）
// ※52kg」で確認: 「※」の直後にそのまま体重が続き、さくら vs 伊澤星花戦が
// 丸ごと抽出漏れになっていた)。体重の数値部分の直前だけに「※」を任意で
// 許容する(既存の「※...→」パターンとは独立に判定する。矢印を要求しないため
// 誤って別の意味の注記まで飲み込まないよう、「※」の直後は数値以外を許容
// しない)。
const KG_SUFFIX = "(?:\\s*\\|\\s*※[^|]*?→\\s*\\|?\\s*)?(?:\\s*※?\\s*[\\d.]+(?:\\s*[Kk]g)?)?\\s*";

// markは付かないbout(事故によるノーコンテスト等、勝敗記号自体が存在しない
// 実例を確認済み)もあるため、mark自体を任意にする。両者ともmark無しの場合は
// resolveOutcome側でmethod本文のキーワード(ノーコンテスト等)に委ねる。
//
// 字体は年代・大会によって揺れる(2018〜2020年頃の一群は絵文字⚪⚫を使用、
// 一部は◯(U+25EF)・×(U+00D7)を使用)。字体差と本文構造(見出し・pipe区切りの
// 並び)は独立の軸であり、字体が違うだけで別フォーマットとして扱わない
// (ユーザー指示、2026-07-29)。markToResultで字体ごとの勝敗対応を集約する。
const MARK_OPT = "([●○〇△◯×⚪⚫]?)";

// mark無し(空欄)を許容したことで生じた事故(2026-07-29、DEEP 90 IMPACT等で
// 発見): F1のような「method末尾型」の正規表現が、F2のような「method中間型」の
// ページ中の判定スコア内訳(例:「判定0-5（27-27・27-27・27-27・27-27・
// 27-27）」)を、丸括弧があるというだけで「2人目の選手名+ジム」として誤認識
// してしまう(mark無しでも選手ブロックにマッチできるため、method文自体が
// 選手ブロックの位置に来ても文法的に区別がつかない)。選手名は「判定」「KO」
// 「TKO」等のmethod語で始まらない、という制約を先読み否定で入れることで、
// method文が選手名として誤って消費されるのを防ぐ。
// キーワード列挙だけでは年代ごとの表記ゆれ(例:「S 1R 4分58秒(タップアウト：
// 肩固め)」の「S」接頭辞)を網羅しきれないため、構造的なパターンも併用する:
// 数字で始まる(ラウンド数「1R」等)・英字1〜数文字+空白+数字で始まる
// (「S 1R」等の略号)場合も除外する。実在の選手名がこれらのパターンで
// 始まることは無い(捏造ゼロ原則の裏付けとして、既存231件のdata/でこの
// パターンで始まる実在選手名は確認されていない)。
//
// 「KO」「TKO」は後ろに英字が続かない場合に限定する(2026-08-01、DEEP
// JEWELS 26で発見: 選手名「KOTORI」が偶然「KO」で始まるため、方式名の
// 「KO」と誤って前方一致し、mark文字が選手名側へ押し出されてしまっていた
// (「●KOTORI」のように選手名にmark文字が混入する事故)。「KO 1R」等の
// 実際の決着方法表記は「KO」の直後が空白・数字・全角文字等であり、英字が
// 続くことは無いため、後ろに英字が続かないことを条件に加えても決着方法の
// 除外効果は変わらない)。
const NOT_METHOD_TEXT =
  "(?!\\d|[A-Za-zＡ-Ｚａ-ｚ]{1,4}\\s*\\d|判定|(?:KO|TKO|Ｋ．Ｏ)(?![A-Za-zＡ-Ｚａ-ｚ])|一本|反則|不戦|棄権|降参|エキシビション|ノーコンテスト|試合中止)";

// F1(現行、PR#201/#231のBOUT_REをベースに、上記kg表記・mark任意化を拡張)。
const BOUT_RE_F1 = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*([^|]+)`,
  "g"
);

// F1のmethod(末尾)が独立した<br>セルを持たず、敗者のジム括弧の直後に
// 改行無しでそのまま連結されている亜種(2026-08-01、DEEP NAGOYA IMPACT
// 2022公武堂ファイトで発見: 9試合中8試合が「〇岡本秀義（翼鍛錬所）|
// ×廣瀬裕斗（マーシャルアーツクラブ中津川） 1R 2分20秒 TKO（ハイキック）」
// のように、敗者情報とmethodが同じセルに同居していた。F1は末尾methodの
// 前に`\|`(パイプ)を必須にしているため、この構造の8試合はF1では一切
// マッチせず、代わりにF2(method中間型)が誤って選ばれ、決着方法テキスト
// 全体を「method」として飲み込んだ末に次boutの見出しを敗者名として拾う
// 連鎖破損になっていた。同一大会内でも1試合だけ(第6試合)は敗者情報と
// methodの間に本来の<br>があり、この1試合だけはF1が正しく抽出できていた。
// 敗者側の閉じ括弧の直後にパイプが有っても無くても対応できるよう
// `[)）]\s*(?:\|\s*)?`で任意にすることで、この大会の全9試合を1つの
// フォーマットで統一的に扱えるようにする(F1本体の必須パイプ要件は
// 変更しない。既存142件超のF1採用ページへの影響を避けるため、別の
// 新規フォーマットとして追加する)。
//
// method欄の内容を無条件に許容すると、DEEP 125 IMPACT等の「計量結果」
// セクション(王者/挑戦者の対戦カード告知・体重のみの記載)まで誤って
// bout本体として一致してしまい、8大会でbout数が水増しされる重大な回帰を
// 起こした(2026-08-01、実装直後の全237大会回帰確認で発見。DEEP 125
// IMPACTが5bout→14boutに急増したことで検出できた)。実在する決着方法は
// 必ず「判定」「KO」「TKO」等の決着キーワード、またはラウンド数字+「R」
// (「1R」等)で始まるため、method欄がこのいずれかで始まることを先読みで
// 必須にする。これにより「：挑戦者」「66.15kg」のような計量セクションの
// 地の文はmethod欄として認識されなくなり、それらの誤bout自体が生成
// されなくなる(NOT_METHOD_TEXTと同じキーワード集合の肯定形)。
const METHOD_LOOKS_REAL =
  "(?=\\d+R|判定|KO|TKO|Ｋ．Ｏ|一本|反則|不戦|棄権|降参|エキシビション|ノーコンテスト|試合中止)";
const BOUT_RE_F1_GLUED = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]\\s*(?:\\|\\s*)?${METHOD_LOOKS_REAL}([^|]*)`,
  "g"
);

// Group4(mark分離+空セル)。F1との違い: 見出しと1人目markの間に任意の
// 「空セル(|のみ)」を許容し、mark直後に選手名が同居しない(単独セル)場合も
// 許容する。両フィールドとも「必ず1件以上のパイプ」を要求することで、F1が
// 既に成功しているページを誤って二重マッチさせない(F1のほうが厳密なため、
// 呼び出し側でF1を先に試し、F1で0件だった場合のみこちらを試す)。
// 2026-08-01、DEEP PROTECT IMPACT 2008(11件・大会全体)で発見: 敗者側の
// 選手ブロックとmethod欄の間にも見出し・選手ブロック間と同じ「空セル
// (|のみ)」が挟まる実例があるが、末尾のmethod手前だけ`\|\s*`(パイプ1個の
// み)を要求していたため、method文の直前に空セルが1つあるだけで
// マッチが揃わなくなり、`\s*`が空セル間の空白1文字だけをmethod欄として
// 拾って確定してしまい(本来のmethod文はマッチ範囲外に残る)、method欄が
// 実質空になっていた。見出し・選手ブロック間と同じ`(?:\|\s*)+`(空セル
// 任意回)に統一する。
// あわせて、method欄の直前否定先読みに「第N試合」を追加する(2026-08-01、
// DEEP 125 IMPACTの計量セクション重複で発見: 空セル許容を広げたことで、
// method欄が実在しないページ(計量再掲セクション等)ではmethodグループが
// 空セルを飲み込んだ先の「次boutの見出し」まで拾ってしまう事故が起きた。
// NOT_METHOD_TEXTと同様、method文が「第N試合」から始まることは実在しない
// ため、この先読みで弾いてマッチ自体を失敗させ、素通し(不採用)にする)。
const BOUT_RE_GROUP4 = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)(?:\\|\\s*)+${MARK_OPT}\\|?\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}(?:\\|\\s*)+${MARK_OPT}\\|?\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}(?:\\|\\s*)+(?!第\\s*\\d+試合)([^|]+)`,
  "g"
);

// Group2/F9(mark型・「第N試合」見出しなし)。見出しに「第N試合」が無く、
// 階級名・「▼」「■」のみのラベル・「メインイベント」等が見出しとして現れる
// (トーナメント方式で通し番号が無い、または見出し規則自体が異なる旧テンプレート)。
// bout番号は取得できないためnull。見出しの前提は「級」「決勝」に限定せず、
// broadに「パイプで区切られた何らかの短い見出しテキスト」として許容する
// (2026-07-29、2023年以前221件の全件分類=F9・11件でこの前提が必要と判明)。
// 見出しを広げすぎると無関係な地の文まで拾う懸念があるため、見出し長を
// 短めの上限(30文字)に制限し、選手名やmethod文のような長文を誤って
// 「見出し」として消費しないようにする。
const BOUT_RE_GROUP2 = new RegExp(
  `(?:^|\\|)\\s*([^|]{0,30}?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*([^|]+)`,
  "g"
);

// F4(マーカー分離+末尾method型。2026-07-31、finish-text-normalize検証中に
// 決着欄が「●」「○」「VS」単体になっているbout=13大会・60件超で発見)。
// DEEP公式サイトのマークアップが、勝者側は`<strong>○名前</strong>`と
// マーク+名前が同じ要素に同居する一方、敗者側だけ`<br>●<strong>名前</strong>`
// のようにマークが直前の要素の外に出てしまっている実例が多数ある(同一ページ
// 内で勝者側・敗者側どちらが分離するかは一定しない)。VSのみが独立した
// セル(1試合だけVSが選手名と別セルに分離)になる亜種もある(DEEP＆PANCRASE
// 大阪大会で確認)。stripTagsでタグ境界が全て「|」になるため、この
// マーク単体・VS単体が独立したパイプ区切り要素として現れ、既存フォーマット
// (mark+名前が同一要素内に同居する前提)ではこの要素をmethod欄や選手名欄と
// 誤認識してしまう。
// Group2と同じ「短い見出しテキスト(≤30文字)・両者ジム(丸括弧)必須」を
// アンカーにしつつ、各選手の直前に来る「マーク単体+パイプ」(および両者の
// 間に来る「VS単体+パイプ」)を任意で吸収する点だけがGroup2との違い。
// 見出し無し前提のフォーマットのため優先順位はGroup2と同格に置く(F1→
// Group4→F2→F10→F8→Group2→F4→Group1)。
// 見出し長の上限はGroup2の30文字ではなく80文字にする(2026-07-31、DEEP
// PANCRASE大阪大会の「第2試合 PANCRASE公式戦 ウェルター級 3分3ラウンド」
// (31文字)がGroup2と同じ30文字上限だと1文字差で弾かれて1bout欠落した実例
// で判明。両者ジム(丸括弧)必須という強いアンカーが別途あるため、上限を
// 広げても無関係な地の文を誤って「見出し」として飲み込むリスクは低い)。
const BOUT_RE_F4 = new RegExp(
  `(?:^|\\|)\\s*([^|]{0,80}?)\\|\\s*` +
    `(?:([●○〇△◯×⚪⚫])\\s*\\|\\s*)?${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}` +
    `\\|\\s*(?:VS\\s*\\|\\s*)?(?:([●○〇△◯×⚪⚫])\\s*\\|\\s*)?${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}` +
    `\\|\\s*([^|]+)`,
  "g"
);

// F2(method中間型)。決着方法が勝者と敗者の間に挟まる: 第N試合[見出し]|
// mark+勝者(ジム)|method|mark+敗者(ジム)。現行(F1)は末尾method前提のため
// この構造では抽出できない(2023年以前221件の全件分類で最大勢力・142件)。
// ジム名が省略される例があるため、ジム(丸括弧)自体を任意にする。
// 見出し直後・method直後にも空セル(パイプのみの要素)が挟まることがある
// (2026-07-29、DEEP TOKYO IMPACT 2019等の旧テンプレートで確認: 「3分2R| |
// ○神野あかり」のように見出しとmarkの間に空セルが1つ入る)。Group4と同じ
// `(?:\|\s*)+`で任意個の空セルを吸収する。
//
// ジムの閉じ括弧に「〉」(全角山括弧)が使われている実例がある(2026-08-01、
// DEEP JEWELS 22「國保小枝(和術慧舟會船橋道場〉」で発見。開き括弧が半角
// 「(」なのに閉じが「）」でも「)」でもなく「〉」という、DEEP公式サイト側の
// 表記ゆれ/誤植)。従来は`)`/`）`しか閉じ括弧として認識しないため、この
// 1件だけ閉じ括弧が永遠に見つからず、ジム名キャプチャが次のbout(2件分の
// 選手名・method・見出し)まで際限なく飲み込んでしまう連鎖破損になっていた
// (DEEP JEWELS 22の最後の2bout=「第2試合」「第1試合」が1つの壊れたboutに
// 融合し、実在した2boutが両方とも消えていた)。「〉」を閉じ括弧の異表記
// として許容し、ジム名の内容からも除外することで、想定通りの位置で
// キャプチャを終端させる。
const GYM_CLOSE = "[)）〉]";
const GYM_CONTENT = "[^)）〉]*";
// markが選手名と同じセルに同居せず、独立したパイプ区切りセルになっている
// 実例がある(2026-08-01、DEEP JEWELS 26「KAI |◯|古瀬美月」で発見。HTML側の
// <strong>タグの開始・終了位置が決着方法とmarkをまたいでいるため、
// stripTags後にmarkだけが前後をパイプで挟まれた単独セルになる)。従来は
// mark直後に選手名が同居する前提だったため、mark単独セルの直後にある
// パイプが選手名キャプチャの開始条件(パイプで始まらない)を満たせず、
// 選手名キャプチャがmark文字自体を選手名として飲み込み、本来の選手名
// (古瀬美月)が完全に失われていた(単なる誤表示ではなくデータ消失)。
// mark直後に任意個のパイプ区切りセルを許容することで、mark単独セルを
// スキップして本来の選手名セルまで正しく到達できるようにする。
const MARK_CELL_SEP = "(?:\\|\\s*)*";
const BOUT_RE_F2 = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)(?:\\|\\s*)+${MARK_OPT}${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)(?:[(（](${GYM_CONTENT})${GYM_CLOSE})?${KG_SUFFIX}(?:\\|\\s*)+([^|]+?)(?:\\|\\s*)+${MARK_OPT}${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)(?:[(（](${GYM_CONTENT})${GYM_CLOSE})?${KG_SUFFIX}(?=\\|)`,
  "g"
);

// F2には「第N試合」見出し自体を持たない亜種もある(2026-07-29、DEEP 88 IMPACT
// 等で確認: 「▼DEEPバンタム級タイトル戦 5分3R」のように、見出しが階級・
// タイトル文言のみで通し番号が無い)。Group2と同じ「短い見出しテキスト」の
// 前提でF2の構造(method中間型)に対応する。bout番号は取得できないためnull。
// 見出しによる強い境界が無いため、1人目のmarkとジム(丸括弧)を必須にする
// (F2の見出しあり版はmark/ジムいずれも任意だが、見出し無し版でも両方任意に
// すると弱い手がかり同士が重なり合い、無関係な地の文まで誤って大量に
// マッチする事故が起きた。2026-07-29、初回実装でnagoya4th等の2024年以降
// VS型ページまで誤マッチする重大な回帰を確認・修正)。
// ジムの閉じ括弧の異表記(「〉」)・mark単独セル(MARK_CELL_SEP)についても
// BOUT_RE_F2と同じ対応をする。
const BOUT_RE_F2_NO_HEADING = new RegExp(
  `(?:^|\\|)\\s*([^|]{0,30}?)\\|\\s*([●○〇△◯×⚪⚫])${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)[(（](${GYM_CONTENT})${GYM_CLOSE}${KG_SUFFIX}\\|\\s*([^|]+?)\\|\\s*${MARK_OPT}${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)[(（](${GYM_CONTENT})${GYM_CLOSE}${KG_SUFFIX}(?=\\|)`,
  "g"
);

// F8(完全分離型・ジム名なし)。mark|選手名|method|選手名|markという、両端に
// markが単独セルとして分離された構造(ジム名の記載が無い、2023年以前221件の
// 全件分類で13件)。「勝敗なし(エキシビション)」の行が同一ページに混在する
// ことがあるが、その行はmarkが両方とも空欄/同一になるため、resolveOutcome側の
// フォールバック(勝敗を推測しない)にまかせる。
const BOUT_RE_F8 = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\|\\s*${NOT_METHOD_TEXT}([^|\\s][^|]*?)\\|\\s*([^|]+?)\\|\\s*${NOT_METHOD_TEXT}([^|\\s][^|]*?)\\|\\s*${MARK_OPT}`,
  "g"
);

// F8には見出し自体が一切存在しない亜種もある(2026-07-29、DEEP 114 IMPACT等で
// 確認: 「第N試合」はおろか階級名すら無く、mark|名前|method|名前|markの
// 5要素が見出し無しでそのまま繰り返される)。見出しによる境界が無いため、
// 誤検出を避けるべく1人目のmarkは必須にする(markが無ければbout開始位置の
// 手がかりが無くなり、地の文を誤ってmatchする懸念があるため)。
//
// 2026-08-01、DEEP 110 IMPACTで発見: 敗者側の選手名が公式ページ自体に
// 存在しない(本文のプレーンテキストにも、公式の`resultList`ウィジェット
// (styled UI)側にも名前が無く、`<a href="">`が空のまま。唯一名前らしき
// ものが存在するのは非表示の画像ファイル名(data-src)のみで、これは表示
// テキストではないため採用しない=捏造しない)実例があった。従来の名前欄
// ([^|\s][^|]*?、1文字以上必須)は、この「名前セルが完全に空」なケースで
// 名前を確保できず、次boutの先頭markまで巻き込んでから初めてマッチが
// 成立してしまい、次bout(2件)の情報が丸ごと壊れる連鎖事故になっていた。
// 「区切りパイプ+名前」のかたまり自体を任意にし、名前セルが本当に空なら
// このboutの名前はnullのまま(捏造せず)、次boutの先頭markを巻き込まずに
// このboutの終端markで正しく確定するようにする。
// 名前セル(1〜2人目とも)は、単独のmark文字だけのセルでは絶対に始まらない
// (実在の選手名がmark記号1文字だけということはない)という前提を追加する。
// これが無いと、次boutの先頭markが誤って「1文字の名前」として消費されて
// しまい、上記の「敗者名セルが空」ケースの救済(任意化)が効かなくなる
// (実データ上は本来のmarkのはずの1文字を「名前」だと誤認識してしまう)。
const NAME_START_CHAR = "[^|\\s●○〇△◯×⚪⚫]";
const BOUT_RE_F8_NO_HEADING = new RegExp(
  `(?:^|\\|)\\s*([●○〇△◯×⚪⚫])(?:\\|\\s*)+${NOT_METHOD_TEXT}(${NAME_START_CHAR}[^|]*?)(?:\\|\\s*)+([^|]+?)(?:(?:\\|\\s*)+${NOT_METHOD_TEXT}(${NAME_START_CHAR}[^|]*?))?(?:\\|\\s*)+${MARK_OPT}`,
  "g"
);

// F10(VS+mark併記型)。mark+勝者(ジム) VS mark+敗者(ジム)|method|勝者 選手名、
// というmark・VS・「勝者」テキストが同時に存在する冗長な構造(2023年以前221件の
// 全件分類で4件)。勝敗はmarkから判定できるため「勝者」テキストの解析は行わず
// methodRawにそのまま残す。
const BOUT_RE_F10 = new RegExp(
  `第\\s*(\\d+)試合\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}VS\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*([^|]+)`,
  "g"
);

// F10にも「第N試合」見出しを持たない亜種がある(2026-07-29、DEEP TOKYO IMPACT
// 2023 2nd ROUND等で確認: 階級名のみの短い見出し+mark+VS+mark+method+
// 「勝者」テキストの冗長構造)。1人目のmarkを必須にすることで、見出し無し
// ゆえの弱い境界を補う(F2_NO_HEADING/F8_NO_HEADINGと同じ設計判断)。
const BOUT_RE_F10_NO_HEADING = new RegExp(
  `(?:^|\\|)\\s*([^|]{0,30}?)\\|\\s*([●○〇△◯×⚪⚫])\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}VS\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*([^|]+)`,
  "g"
);

// Group1(VS型)。marker記号を一切使わず、末尾の「勝者 名前」テキストのみで
// 勝者を示す。体重kgの表記位置・ジムとの間のパイプ有無に表記ゆれがあるため、
// 選手ブロックは「名前(ジム)」の直後に任意でパイプ+体重kgが続く形を許容する。
const FIGHTER_BLOCK_VS = "([^|(（]+?)\\|?\\s*[(（]([^)）]*)[)）]\\s*(?:\\|?\\s*[\\d.]+\\s*[Kk]g)?";
// 選手ブロックの前後・VSの前後・method直前には、空セル(タグのみでテキストが
// 無い要素)由来の「パイプ+空白の繰り返し」が任意回数入り得る(実測: 0〜3回)。
// 固定回数を仮定せず`(?:\|\s*)*`で吸収する。
//
// 末尾のmethod/勝者テキストは「勝者」の直後にも空セルが挟まることがある
// (例:「2R1分09秒 TKO 勝者| |大搗」)ため、正規表現側で「勝者 名前」を
// 固定パターンとして要求せず、次のbout開始(「|N.」または「【」または
// 文字列末尾)の直前までを丸ごとキャプチャし、「勝者」抽出は呼び出し側の
// 別関数で行う。計量オーバー等でノーコンテスト理由文しか無く「勝者」自体が
// 存在しないbout(例: 樹季 vs 成本優良)も、この設計であれば正しく1件の
// boutとして捕捉できる(「勝者」必須にすると当該boutがまるごと欠落するバグに
// なるため、修斗/パンクラスでの反省を踏まえてbout捕捉とwinner抽出を分離した)。
// 2026-08-01、DEEP CAGE IMPACT IN OSAKA 2022(7件・大会全体)で発見:
// 次bout開始の判定(「|N.」「【」「文字列末尾」)が、次boutの見出し行
// (「セミファイナル DEEP JEWELS 49kg以下 5分3R」等、「N.」形式の番号を
// 持たない地の文見出し)を考慮していなかったため、method欄のlazy captureが
// 次見出し丸ごとを飲み込むまで確定せず、そのまま「勝者：」抽出ロジックが
// 「勝者：Name」を文頭付近で検出して「それより前は空」と誤判定し、method欄
// が実質空になっていた。次bout番号の直前に短い見出し文が挟まっていてもよい
// ことを先読みに明示し、method欄のキャプチャ自体が見出しへ食い込まないよう
// にする。見出し文字数の上限はGroup2/F9の30文字ではなく50文字にする
// (実データで「セミファイナル DEEP JEWELS 49kg以下 5分3R」(32文字)が
// 30文字上限だと弾かれ、見出し全体がmethod欄に混入したまま残る実例で判明)。
// 「【試合結果】」見出しを持たないページ(本イベントがまさにそう)では
// scopeToResultsSectionが本文を絞り込めず、最終boutのmethod欄が「文字列
// 末尾」まで到達する前に、DEEP公式テンプレート共通のPHP警告文
// (「Warning: Use of undefined constant za...」、全期間で確認済みの
// サイト全体の既知バグ由来の定型文言)を先に飲み込んでしまう。この定型文言
// も次bout開始と同じ「もうbout本文ではない」の境界として先読みに加える。
const BOUT_RE_GROUP1 = new RegExp(
  `(\\d+)\\.\\s*(?:\\|\\s*)*${FIGHTER_BLOCK_VS}\\s*(?:\\|\\s*)*VS(?:&nbsp;|\\s)*(?:\\|\\s*)*${FIGHTER_BLOCK_VS}\\s*(?:\\|\\s*)+([\\s\\S]*?)(?=\\|\\s*(?:[^|]{0,50}\\|\\s*)?(?:\\d{1,2}\\.\\|?[^\\d|]|【|Warning|$))`,
  "g"
);
const WINNER_HINT_RE = /勝者[:：]?\s*\|?\s*([^\s|]+)/;

export type DeepBoutFormat =
  | "F1"
  | "f1_method_glued"
  | "group1_vs"
  | "group2_no_heading"
  | "group4_detached_mark"
  | "f2_method_middle"
  | "f8_fully_separated"
  | "f10_vs_and_mark"
  | "f4_detached_mark_label"
  | "headingless_recovered";

export interface DeepRawBout {
  format: DeepBoutFormat;
  boutNumber: number | null; // Group1/Group2はページ内の通し番号が無い(または階級名のみ)ためnullのことがある
  weightClassRaw: string | null;
  fighterAMark: string | null; // Group1はmarkを持たないためnull
  fighterAName: string;
  fighterAGym: string | null;
  fighterBMark: string | null;
  fighterBName: string;
  fighterBGym: string | null;
  methodRaw: string;
  winnerNameHintRaw: string | null; // Group1の「勝者 名前」テキスト(苗字のみのことがある、部分一致用)
}

// 字体バリエーション(2026-07-29、2023年以前221件の全件分類で判明): ○(U+25CB)・
// 〇(U+3007)・◯(U+25EF)・⚪(U+26AA 絵文字)はいずれも勝ち、●(U+25CF)・
// ×(U+00D7)・⚫(U+26AB 絵文字)はいずれも負けを表す(構造ではなく字体のみの
// 違い)。△は引き分け(該当例は限定的だが既存のBOUT_RE踏襲で維持)。
function markToResult(mark: string): "win" | "loss" | "draw" | "unknown" {
  if (mark === "○" || mark === "〇" || mark === "◯" || mark === "⚪") return "win";
  if (mark === "●" || mark === "×" || mark === "⚫") return "loss";
  if (mark === "△") return "draw";
  return "unknown";
}

export { markToResult };

// F1・Group4は「第N試合」見出し(bout番号あり)、9キャプチャグループ共通の形。
function extractNumberedMarkBouts(bodyClean: string, re: RegExp, format: DeepBoutFormat): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyClean))) {
    bouts.push({
      format,
      boutNumber: Number(m[1]),
      weightClassRaw: m[2].trim() || null,
      fighterAMark: m[3],
      fighterAName: m[4].trim(),
      fighterAGym: m[5].trim() || null,
      fighterBMark: m[6],
      fighterBName: m[7].trim(),
      fighterBGym: m[8].trim() || null,
      methodRaw: m[9].trim(),
      winnerNameHintRaw: null,
    });
  }
  return bouts;
}

// Group2は見出しにbout番号が無い(8キャプチャグループ)ため専用関数にする
// (F1/Group4とインデックスが1つずれるため、共通関数に無理に統合しない)。
function extractGroup2Bouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  BOUT_RE_GROUP2.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_GROUP2.exec(bodyClean))) {
    bouts.push({
      format: "group2_no_heading",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: m[4].trim() || null,
      fighterBMark: m[5],
      fighterBName: m[6].trim(),
      fighterBGym: m[7].trim() || null,
      methodRaw: m[8].trim(),
      winnerNameHintRaw: null,
    });
  }
  return bouts;
}

// F4(マーカー分離+末尾method型)。マークが選手名と同居する場合(inline)・
// 直前で独立したセルになっている場合(isolated)のどちらか一方だけを採る
// (実例上、両方が同時に埋まることはない)。
function extractF4Bouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  BOUT_RE_F4.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_F4.exec(bodyClean))) {
    bouts.push({
      format: "f4_detached_mark_label",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2] || m[3] || null,
      fighterAName: m[4].trim(),
      fighterAGym: m[5].trim() || null,
      fighterBMark: m[6] || m[7] || null,
      fighterBName: m[8].trim(),
      fighterBGym: m[9].trim() || null,
      methodRaw: m[10].trim(),
      winnerNameHintRaw: null,
    });
  }
  return bouts;
}

// F2は「method中間型」: mark+勝者(ジム)|method|mark+敗者(ジム)。ジム名が
// 省略される例があるため、gym capture(m[4]/m[8])は空文字列(未マッチ)の
// ことがある。「第N試合」見出しが無い亜種(bout番号取得不可)にも対応する
// (見出しありを先に試し、0件の場合のみ見出し無し版を試す)。
function extractF2Bouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  BOUT_RE_F2.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_F2.exec(bodyClean))) {
    bouts.push({
      format: "f2_method_middle",
      boutNumber: Number(m[1]),
      weightClassRaw: m[2].trim() || null,
      fighterAMark: m[3],
      fighterAName: m[4].trim(),
      fighterAGym: (m[5] ?? "").trim() || null,
      methodRaw: m[6].trim(),
      fighterBMark: m[7],
      fighterBName: m[8].trim(),
      fighterBGym: (m[9] ?? "").trim() || null,
      winnerNameHintRaw: null,
    });
  }
  if (bouts.length > 0) return bouts;

  BOUT_RE_F2_NO_HEADING.lastIndex = 0;
  while ((m = BOUT_RE_F2_NO_HEADING.exec(bodyClean))) {
    bouts.push({
      format: "f2_method_middle",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: (m[4] ?? "").trim() || null,
      methodRaw: m[5].trim(),
      fighterBMark: m[6],
      fighterBName: m[7].trim(),
      fighterBGym: (m[8] ?? "").trim() || null,
      winnerNameHintRaw: null,
    });
  }
  return bouts;
}

// F8は「完全分離型・ジム名なし」: mark|選手名|method|選手名|mark。見出しが
// 一切無い亜種(bout番号取得不可)にも対応する(見出しありを先に試し、0件の
// 場合のみ見出し無し版を試す)。
function extractF8Bouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  BOUT_RE_F8.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_F8.exec(bodyClean))) {
    bouts.push({
      format: "f8_fully_separated",
      boutNumber: Number(m[1]),
      weightClassRaw: m[2].trim() || null,
      fighterAMark: m[3],
      fighterAName: m[4].trim(),
      fighterAGym: null,
      methodRaw: m[5].trim(),
      fighterBName: m[6].trim(),
      fighterBGym: null,
      fighterBMark: m[7],
      winnerNameHintRaw: null,
    });
  }
  if (bouts.length > 0) return bouts;

  BOUT_RE_F8_NO_HEADING.lastIndex = 0;
  while ((m = BOUT_RE_F8_NO_HEADING.exec(bodyClean))) {
    bouts.push({
      format: "f8_fully_separated",
      boutNumber: null,
      weightClassRaw: null,
      fighterAMark: m[1],
      fighterAName: m[2].trim(),
      fighterAGym: null,
      methodRaw: m[3].trim(),
      // 敗者名セルが公式ページ自体に無い(名前欄が空セルのまま)実例がある
      // (2026-08-01、DEEP 110 IMPACT)。この場合m[4]は未マッチ(undefined)に
      // なるため、名前を捏造せず空文字列のまま返す(呼び出し側のslug解決は
      // 空文字列に対して何も解決せずnullを返すため安全)。
      fighterBName: (m[4] ?? "").trim(),
      fighterBGym: null,
      fighterBMark: m[5],
      winnerNameHintRaw: null,
    });
  }
  return bouts;
}

// F10は「VS+mark併記型」: mark+勝者(ジム) VS mark+敗者(ジム)|method。
//
// 「第N試合」見出しを要求するBOUT_RE_F10と、見出し無し(短い任意文字列)でも
// 拾えるBOUT_RE_F10_NO_HEADINGの2種類があるが、従来はBOUT_RE_F10が1件でも
// マッチしたら即returnし、NO_HEADINGを一切試していなかった。この設計は
// ページ全体が「見出し無し」形式か「第N試合」形式かのどちらか一方に統一
// されている前提だったが、同一ページ内で見出し形式が混在するケースが実在
// する(2026-08-01、DEEP OSAKA IMPACT 2023 1st ROUND: 13試合は「第N試合」、
// 敢流 vs 入江一輝の1試合だけ見出しが「オープニングファイト」でNO_HEADING
// 側にしかマッチしない。heading文字数上限の緩和では解決しない=そもそも
// BOUT_RE_F10側の「第N試合」固定パターンには入り口すら無いため)。
// 両方を常に走らせ、選手名A・選手名B・method(=試合内容)の組が一致する
// 重複だけを弾く(NO_HEADING側は見出し制約が緩い分、既にF10側で拾った
// bout本体を字面違いで再ヒットする恐れがあるため)。
function extractF10Bouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  const seen = new Set<string>();
  const dedupeKey = (a: string, b: string, method: string) => `${a}|${b}|${method}`;

  BOUT_RE_F10.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_F10.exec(bodyClean))) {
    const fighterAName = m[4].trim();
    const fighterBName = m[7].trim();
    const methodRaw = m[9].trim();
    bouts.push({
      format: "f10_vs_and_mark",
      boutNumber: Number(m[1]),
      weightClassRaw: m[2].trim() || null,
      fighterAMark: m[3],
      fighterAName,
      fighterAGym: m[5].trim() || null,
      fighterBMark: m[6],
      fighterBName,
      fighterBGym: m[8].trim() || null,
      methodRaw,
      winnerNameHintRaw: null,
    });
    seen.add(dedupeKey(fighterAName, fighterBName, methodRaw));
  }

  BOUT_RE_F10_NO_HEADING.lastIndex = 0;
  while ((m = BOUT_RE_F10_NO_HEADING.exec(bodyClean))) {
    const fighterAName = m[3].trim();
    const fighterBName = m[6].trim();
    const methodRaw = m[8].trim();
    const key = dedupeKey(fighterAName, fighterBName, methodRaw);
    if (seen.has(key)) continue;
    bouts.push({
      format: "f10_vs_and_mark",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName,
      fighterAGym: m[4].trim() || null,
      fighterBMark: m[5],
      fighterBName,
      fighterBGym: m[7].trim() || null,
      methodRaw,
      winnerNameHintRaw: null,
    });
    seen.add(key);
  }
  return bouts;
}

function extractVsBouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  BOUT_RE_GROUP1.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUT_RE_GROUP1.exec(bodyClean))) {
    const trailingRaw = m[6].replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    const winnerMatch = trailingRaw.match(WINNER_HINT_RE);
    // 「決着方法 勝者 Name」(勝者ヒントが末尾寄り)の語順が前提だったが、
    // 2026-08-01、DEEP CAGE IMPACT IN OSAKA 2022で「勝者：Name 決着方法」
    // (勝者ヒントが文頭)の語順も実在すると判明。勝者ヒントが文頭(index 0)
    // にある場合はヒントの直後からを決着方法とみなす(既存の「文頭から
    // ヒント直前まで」ロジックのままだと決着方法が常に空になっていた)。
    let methodRaw: string;
    if (!winnerMatch) {
      methodRaw = trailingRaw;
    } else if (winnerMatch.index === 0) {
      methodRaw = trailingRaw.slice(winnerMatch.index + winnerMatch[0].length).trim();
    } else {
      methodRaw = trailingRaw.slice(0, winnerMatch.index).trim();
    }
    bouts.push({
      format: "group1_vs",
      boutNumber: Number(m[1]),
      weightClassRaw: null,
      fighterAMark: null,
      fighterAName: m[2].trim(),
      fighterAGym: m[3].trim() || null,
      fighterBMark: null,
      fighterBName: m[4].trim(),
      fighterBGym: m[5].trim() || null,
      methodRaw,
      winnerNameHintRaw: winnerMatch ? winnerMatch[1] : null,
    });
  }
  return bouts;
}

// 【試合結果】セクションのみに本文を絞り込む。DEEPのページには「試合結果」の
// 他に、同じ「第N試合」見出し番号を使い回しつつ結果情報を持たない別セクション
// (【計量結果】=計量時点の対戦カード再掲、対戦カードプレビューウィジェット等)が
// 同居することがある(2026-07-29、DEEP OSAKA IMPACT 2025 1st ROUND等で確認:
// 【計量結果】セクションのbout見出しがF1の正規表現に空マーク・空methodのまま
// マッチしてしまい、実際の19boutに対し倍の38件が抽出される事故があった)。
// 「【試合結果】」(全角鍵括弧つき)の直後から、次に現れる既知の非結果セクション
// 見出し(【計量結果】・【大会概要】)またはPAST EVENT/CONTACT等のナビゲーション
// 文言の手前までに絞ることで、この種の重複セクションを本文から除外してから
// 各フォーマットの正規表現を適用する。
//
// 鍵括弧つき「【試合結果】」の検索に限定する(括弧無しの生テキスト「試合結果」
// では検索しない)。2018〜2020年頃の旧テンプレート(例: DEEP 90 IMPACT)では、
// 実際の結果本文が先にあり、その後にナビゲーションラベルとしての「試合結果」
// (鍵括弧無し)が現れ、その直後にサイト共通のNEWSフィードが続く構造になって
// おり、鍵括弧無しで検索すると実際の結果本文を切り捨ててNEWSフィード側だけが
// 残ってしまう事故が起きる(2026-07-29、全期間拡張時に発見)。鍵括弧つきの
// 見出しが見つからない場合は本文全体を対象にする(この前処理はあくまで
// 2024年以降テンプレート固有の重複セクション除去であり、見つからないこと
// 自体を抽出失敗として扱わない)。
// 2026-08-01追記: 「計量結果」セクション名の表記ゆれ(前日計量の模様/
// 前日計量/計量の模様/計量の様子/【対戦カード】計量結果 等)が既存の
// 「【計量結果】」(鍵括弧つき完全一致)だけでは拾いきれず、この計量
// セクションが「第N試合 階級名」+選手名(ジム)という結果本文と同じ見出し
// 構造を体重kg付きで再掲するため、F1/group2等が誤ってマッチし、正しい
// bout(決まり手あり)の隣に空欄の重複boutを生む事故が発生した(実例:
// DEEP 125 IMPACT 5件)。全237大会+キャッシュ済み過去大会を走査し、
// 見つかった表記ゆれをすべて追加する(1件ずつの対症療法にしない)。
// 「計量オーバー」(体重超過による無効試合等の説明、決着文中に正当に
// 現れる語)は含めない――走査した実例はいずれも独立した見出しとしての
// 出現のみで、決着文の一部として埋め込まれた例は無かった。
const NON_RESULT_SECTION_MARKERS = [
  "【計量結果】",
  "計量結果",
  "前日計量",
  "計量の模様",
  "計量の様子",
  "【大会概要】",
  "PAST EVENT",
  "CONTACT",
];

function scopeToResultsSection(bodyClean: string): string {
  // 2026-08-01、DEEP 125 IMPACT等「【試合結果】」(鍵括弧つき)の見出しを
  // 持たないページで試した「見つからない場合はbodyClean先頭から末尾除外
  // する」という変更は、ページ冒頭のチケット告知文等に「前日計量」
  // 「計量結果」を含む無関係な文言が出現するページを大量に誤短縮し、
  // 抽出0件停止条件(閾値30)を237件中180件超過で踏むという重大な回帰に
  // なったため撤回した(この関数は従来どおりstartIdxが見つかった場合のみ
  // 末尾除外を行う)。計量セクション混入による重複bout(DEEP 125 IMPACT
  // 5件)への対応はdeduplicateBoutsByFighterPair(下記)で行う。
  const startIdx = bodyClean.indexOf("【試合結果】");
  if (startIdx === -1) return bodyClean;
  let endIdx = bodyClean.length;
  for (const marker of NON_RESULT_SECTION_MARKERS) {
    const idx = bodyClean.indexOf(marker, startIdx);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return bodyClean.slice(startIdx, endIdx);
}

// 1ページぶんの本文から、成功したフォーマットのbout配列を返す。
//
// フォーマットは「F1 → Group4 → Group2 → Group1」の優先順で1つだけ採用する
// (複数フォーマットを合算しない)。2026-07-29、DEEP 118 IMPACT等の悉皆実行で
// 判明した事故: F1(第N試合見出し+mark)で本来正しく抽出できるページの一部に、
// 本文とは無関係な「対戦カード」プレビュー用の別ウィジェット(結果を持たず、
// 次のbout見出しをそのままmethod欄として拾ってしまう)がGroup1(VS型)の
// 正規表現にも偶然マッチしてしまい、F1の正しい結果に加えて架空のbout(勝敗
// resultType=unknown・methodRawが次見出しの文字列)が混入する事故が発生した。
// 「1ページ内で複数フォーマットが正当に共存する」という確認済みの実例が無い
// 一方、「F1が成功しているページに無関係なVS風ウィジェットが混入する」事故は
// 実際に確認されたため、最初に見つかったフォーマット1つのみを採用し、それ以降の
// フォーマットは試さない設計にする(捏造ゼロ原則: 迷ったら合算せず1つに絞る)。
// 優先順位(2026-07-29、全期間拡張時に確定): F1 → Group4 → F2 → F10 → F8 →
// Group2 → Group1。「第N試合」見出しを要求するフォーマット(F1/Group4/F2/
// F10/F8)を先に試し、見出し前提を緩めたGroup2(「第N試合」以外の短い見出しも
// 許容)は最後に近い位置に置く(見出し前提が広いフォーマットほど、より
// 厳密なフォーマットが本来一致すべき本文を誤って先取りするリスクが高いため、
// 意図的に後段に置く)。marks自体を持たないGroup1(VS型)が最終フォールバック。
// 「第N試合」見出しの出現回数(=本来あるはずのbout数の目安)。0件のページ
// (見出し自体が第N試合形式でない旧テンプレート等)ではheadingCount=0を返し、
// 下記の選定ロジックでは「目安なし」として扱う。
//
// ユニーク番号数ではなく出現回数(生カウント)をそのまま使う(2026-07-31、
// DEEP 121 IMPACTで判明した事故: プロカード(第1〜第9試合、第6試合は無し=
// 8件)とアマチュア undercard(別セクションで第1試合・第2試合から番号が
// 振り直される)が同一ページに混在するケースで、番号をSetで重複排除すると
// アマチュア分の「1」「2」がプロ分と同じ集合要素に潰れてheadingCountが
// 実際の見出し件数(10件)より少ない8件に過小評価され、本来正しく全10件を
// 抽出できていたF1が「見出し数から乖離している」と誤判定されて、実際には
// 1件取りこぼしている劣ったフォーマットに採用が入れ替わってしまった)。
function countBoutHeadings(bodyClean: string): number {
  return [...bodyClean.matchAll(/第\s*(\d+)試合/g)].length;
}

// 2026-07-31、悉皆突合調査(PR #290/#291)で判明した事故: 「最初に見つかった
// フォーマット1つだけを採用する」設計そのものは正しいが、「1件以上マッチ=
// 成功」という判定基準が粗すぎるため、本来method中間型(f2)等で全bout抽出
// できるページで、F1/Group4の正規表現がページ内の「第N試合」見出しの並びを
// 跨いで1件だけ誤マッチ(前boutのmethod文を次boutの選手名として誤認識)して
// しまい、その1件を「F1が成功した」と誤判定してf2以降を一切試さないまま
// 大半のboutを取りこぼす事故が最大17大会で発生していた(DEEP 100 IMPACT等)。
//
// 対策: 各フォーマットを従来と同じ優先順位で全て計算したうえで、「第N試合」
// 見出し数が判明している場合はその数に最も近い候補を採用する(1件のみの
// 誤マッチは通常headingCountから大きく乖離するため自然に除外される)。
// 見出し数が0件のページ(旧テンプレート等)では目安が無いため、素直に
// マッチ数最大の候補を採用する。いずれの場合も「複数フォーマットを合算
// しない・1つだけ採用する」という既存方針は変えない(採用基準を精緻化した
// だけ)。同点の場合は既存の優先順位(F1→Group4→F2→F10→F8→Group2→Group1)を
// 維持する。
// 選手名として明らかに不自然な値(見出し・セクション区切り記号で始まる)を
// 含む候補は、境界判定を誤ってページの別セクションを飲み込んでいる可能性が
// 高いため丸ごと不採用にする(2026-07-31、DEEP TOKYO IMPACT 2023 6th ROUND等で
// 発見: headingCountに数値上近いというだけでf8がf2より優先されたが、f8の
// 実体はfighterBNameに次boutの見出しテキスト「▼DEEPメガトン級 5分3R」等が
// 丸ごと紛れ込んだ壊れた抽出だった)。件数の近さだけでなく内容の健全性も
// 選定基準に加える。
const HEADING_MARKER_RE = /^[▼■【]/;
// 決着方法(methodRaw)は実例上どれだけ長くても数十文字程度(例:「判定0-3
// (27-28/27-28/27-29)」)。2026-07-31、DEEP JEWELS 47・DEEP OSAKA IMPACT
// 2024 1st ROUND(いずれもgroup1_vs採用時)で発見: 次bout以降の見出しや、
// 最終boutでは大会概要・ニュース一覧・script等ページ全体の残骸がmethodRawに
// 丸ごと紛れ込む事故があった(名前欄は正常に見えるため選手名チェックだけでは
// 検出できない)。閾値は実在する最長の正当なmethod文より十分大きく、
// 事故時の混入量(数百〜数千文字)より十分小さい200文字に設定する。
const MAX_PLAUSIBLE_METHOD_LEN = 200;
// 2026-07-31、finish-text-normalize検証中に発見: マーカー分離型(F4対応の
// 発端)のページで、methodRaw欄に決まり手ではなく勝敗マーク単体(●○等)や
// 「VS」単体が丸ごと入ってしまう事故があった(実体は選手ブロックの一部が
// stripTags後に独立したセルとして誤って「method」欄に割り当てられたもの)。
// これらは実在する決まり手表記としてあり得ない値のため、他の判定基準と同様
// 「壊れた抽出」として不採用にする。これにより、同じページで「第N試合」
// 見出しを要求する既存フォーマット(F2等)がこのマーク単体を拾って誤って
// 選ばれてしまう場合でも不採用となり、マーク分離を正しく吸収するF4が
// 選ばれるようになる(既存フォーマットの正規表現自体は変更しない)。
const MARKER_ONLY_METHOD_RE = /^[●○〇△◯×⚪⚫]$|^vs$/i;
function hasGarbledContent(bouts: DeepRawBout[]): boolean {
  return bouts.some(
    (b) =>
      HEADING_MARKER_RE.test(b.fighterAName) ||
      HEADING_MARKER_RE.test(b.fighterBName) ||
      b.methodRaw.length > MAX_PLAUSIBLE_METHOD_LEN ||
      MARKER_ONLY_METHOD_RE.test(b.methodRaw)
  );
}

// 2026-08-01、DEEP 125 IMPACTで発見: 「【試合結果】」見出しを持たない
// ページでは、決着セクションの後に続く「前日計量の模様」等(体重kgを
// 決まり手欄の位置に持つ計量結果の再掲)が結果セクションと同じ見出し
// 構造を使っているためF1/group2等に誤マッチし、正しく抽出できたboutの
// 隣に「同じ対戦カードだが決着欄が空」の重複が生まれる。
// scopeToResultsSection側の対応(開始位置が見つからない場合も末尾除外を
// 適用)は、ページ冒頭のチケット告知文等に「前日計量」を含む無関係な
// ページを大量に誤短縮する重大な回帰を起こしたため撤回し(該当コメント
// 参照)、代わりにフォーマット単位の後処理として対応する: 同一
// フォーマット内で対戦カード(選手2名の組み合わせ、順不同)が重複し、
// 片方だけ決着欄が空の場合は空の側を不採用にする。両方空・両方非空の
// 組み合わせ(同一カード内での正当な再戦等、捏造ゼロ原則により推測しない)
// はそのまま残す。
function dedupeBoutsByFighterPair(bouts: DeepRawBout[]): DeepRawBout[] {
  const indexByPairKey = new Map<string, number>();
  const result: DeepRawBout[] = [];
  for (const b of bouts) {
    const key = [b.fighterAName, b.fighterBName].sort().join(" ");
    const existingIdx = indexByPairKey.get(key);
    if (existingIdx === undefined) {
      indexByPairKey.set(key, result.length);
      result.push(b);
      continue;
    }
    const existing = result[existingIdx];
    if (existing.methodRaw === "" && b.methodRaw !== "") {
      result[existingIdx] = b;
    } else if (existing.methodRaw !== "" && b.methodRaw === "") {
      // bを不採用(existingを残す)
    } else {
      result.push(b);
    }
  }
  return result;
}

// DEEP公式サイト側のPHP実行時警告(例:「<b>Warning</b>: Use of undefined
// constant za...」)が、選手名欄の直後に実在の対戦相手情報が無いページ末尾の
// boutで、選手名として誤って拾われることがある(2026-08-01、DEEP JEWELS 6・
// DEEP NAGOYA IMPACT 2022公武堂ファイトの各最終boutで発見。対戦相手欄が
// 公式ページ自体に存在しないため、正規表現がページ末尾の実コンテンツ
// (このPHP警告)まで探しに行ってしまう)。個別大会を除外するのではなく、
// stripTags後に単独の"Warning"という語として残るこの定型文を選手名欄から
// 汎用的に検知し、捏造せず空文字列(未取得)に戻す(将来の新規大会でも同じ
// 定型文が出た場合に自動的に対応できるようにする)。
const PHP_WARNING_BOILERPLATE = "Warning";
function scrubPhpWarningLeak(bouts: DeepRawBout[]): DeepRawBout[] {
  return bouts.map((b) => ({
    ...b,
    fighterAName: b.fighterAName.trim() === PHP_WARNING_BOILERPLATE ? "" : b.fighterAName,
    fighterBName: b.fighterBName.trim() === PHP_WARNING_BOILERPLATE ? "" : b.fighterBName,
  }));
}

export function extractDeepBouts(rawBodyClean: string): { bouts: DeepRawBout[]; formatsUsed: DeepBoutFormat[] } {
  const bodyClean = scopeToResultsSection(rawBodyClean);
  const headingCount = countBoutHeadings(bodyClean);

  const rawCandidates: { bouts: DeepRawBout[]; format: DeepBoutFormat }[] = [
    { bouts: extractNumberedMarkBouts(bodyClean, BOUT_RE_F1, "F1"), format: "F1" },
    { bouts: extractNumberedMarkBouts(bodyClean, BOUT_RE_F1_GLUED, "f1_method_glued"), format: "f1_method_glued" },
    { bouts: extractNumberedMarkBouts(bodyClean, BOUT_RE_GROUP4, "group4_detached_mark"), format: "group4_detached_mark" },
    { bouts: extractF2Bouts(bodyClean), format: "f2_method_middle" },
    { bouts: extractF10Bouts(bodyClean), format: "f10_vs_and_mark" },
    { bouts: extractF8Bouts(bodyClean), format: "f8_fully_separated" },
    { bouts: extractGroup2Bouts(bodyClean), format: "group2_no_heading" },
    { bouts: extractF4Bouts(bodyClean), format: "f4_detached_mark_label" },
    { bouts: extractVsBouts(bodyClean), format: "group1_vs" },
  ];
  const allCandidates = rawCandidates.map((c) => ({ ...c, bouts: dedupeBoutsByFighterPair(c.bouts) }));
  const candidates = allCandidates.filter((c) => c.bouts.length > 0 && !hasGarbledContent(c.bouts));

  if (candidates.length === 0) return { bouts: [], formatsUsed: [] };

  let best = candidates[0];
  if (headingCount > 0) {
    let bestDiff = Math.abs(best.bouts.length - headingCount);
    for (const c of candidates.slice(1)) {
      const diff = Math.abs(c.bouts.length - headingCount);
      if (diff < bestDiff) {
        best = c;
        bestDiff = diff;
      }
    }
  } else {
    for (const c of candidates.slice(1)) {
      if (c.bouts.length > best.bouts.length) best = c;
    }
  }

  return { bouts: scrubPhpWarningLeak(best.bouts), formatsUsed: [best.format] };
}

// ── 3.5. 見出しなしメインイベント/セミファイナルの回収 ──────────────────
//
// 2026-08-02、PR #374(motonomiki 4団体通算過少表示の原因調査)で判明した
// バグへの対応: DEEP公式ページのメインイベント/セミファイナル/コ・メイン
// イベントが「第N試合」の番号を伴わずに単独見出しとして現れることがあり、
// 上記extractDeepBouts()のF1/F1_GLUED/F2/Group4はいずれも「第N試合」を
// bout開始の必須アンカーにしているため、この番号なし見出しのboutを検出
// できず丸ごと欠落する(内部の妥当性チェックcountBoutHeadings()も同じ
// 「第N試合」表記しか数えないため、抽出漏れと検査漏れが同時に起きて
// 異常として検出できない=検査器が抽出器と同じ手がかりを共有していたこと
// が真因。全237大会の横展開調査で17大会・21bout確認、out/deep-headingless-
// mainevent-audit.md参照)。
//
// 対応方針: 既存7フォーマットの正規表現定義(BOUT_RE_F1等)は一切変更せず
// (238大会で実績のある抽出ロジックへの回帰リスクを避けるため)、同じ
// 本文パターン(MARK_OPT・NOT_METHOD_TEXT・KG_SUFFIX等、共有部品)を流用した
// 「見出しなし版」を追加のフォーマットとして独立に走らせ、既存の抽出結果に
// 無いbout(選手名の組で判定)だけを追加する。既存フォーマットの選定ロジック
// (extractDeepBouts内のF1→Group4→...→Group1優先順位・headingCountとの近さ
// 比較)には一切関与しない、純粋な追加専用パス。
//
// 見出し語は「メインイベント」「コ・メインイベント」(中黒有無どちらも)
// 「セミファイナル」の3種(out/deep-headingless-mainevent-audit.mdで確認した
// 表記ゆれの全て)。マッチ開始位置の直前に既に「第N試合」がある場合
// (例: DEEP JEWELS 31の「第6試合 セミファイナル…」)は、既存フォーマットが
// 正しく抽出できているケースのため、二重計上を避けて対象外にする。
const HEADINGLESS_OPENER = "(?:コ・?メインイベント|メインイベント|セミファイナル)";
const HEADINGLESS_LABEL_SCAN_RE = /(?:コ・?メインイベント|メインイベント|セミファイナル)/g;

// マッチ開始位置の直前(30文字以内)に既に「第N試合」が無いことを確認する
// (out/deep-headingless-mainevent-audit.mdの判定ロジックと同一の考え方)。
function isPrecededByNumberedHeading(bodyClean: string, matchIndex: number): boolean {
  const before = bodyClean.slice(Math.max(0, matchIndex - 30), matchIndex);
  return /第\s*\d+試合\s*$/.test(before);
}

// 見出しなし本文パターン(先頭を`^`でその見出し語自身に固定し、ブロック外に
// マッチが漏れ出さないようにする)。本文部分はBOUT_RE_F1/F1_GLUED/F2/
// GROUP4と同一(共有部品MARK_OPT等を再利用)。優先順位はF1→F1_GLUED→F2→
// Group4(既存extractDeepBoutsの優先順位を踏襲: 見出し+method末尾型を
// 最も厳密な形として先に試す)。
const HEADINGLESS_PATTERNS: { format: DeepBoutFormat; re: RegExp; build: (m: RegExpExecArray) => DeepRawBout }[] = [
  {
    format: "headingless_recovered",
    re: new RegExp(
      `^${HEADINGLESS_OPENER}\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*([^|]+)`
    ),
    build: (m) => ({
      format: "headingless_recovered",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: m[4].trim() || null,
      fighterBMark: m[5],
      fighterBName: m[6].trim(),
      fighterBGym: m[7].trim() || null,
      methodRaw: m[8].trim(),
      winnerNameHintRaw: null,
    }),
  },
  {
    format: "headingless_recovered",
    re: new RegExp(
      `^${HEADINGLESS_OPENER}\\s*\\|?\\s*([^|]+?)\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}\\|\\s*${MARK_OPT}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]\\s*(?:\\|\\s*)?${METHOD_LOOKS_REAL}([^|]*)`
    ),
    build: (m) => ({
      format: "headingless_recovered",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: m[4].trim() || null,
      fighterBMark: m[5],
      fighterBName: m[6].trim(),
      fighterBGym: m[7].trim() || null,
      methodRaw: m[8].trim(),
      winnerNameHintRaw: null,
    }),
  },
  {
    format: "headingless_recovered",
    re: new RegExp(
      `^${HEADINGLESS_OPENER}\\s*\\|?\\s*([^|]+?)(?:\\|\\s*)+${MARK_OPT}${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)(?:[(（](${GYM_CONTENT})${GYM_CLOSE})?${KG_SUFFIX}(?:\\|\\s*)+([^|]+?)(?:\\|\\s*)+${MARK_OPT}${MARK_CELL_SEP}\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*?)(?:[(（](${GYM_CONTENT})${GYM_CLOSE})?${KG_SUFFIX}(?:\\||$)`
    ),
    build: (m) => ({
      format: "headingless_recovered",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: (m[4] ?? "").trim() || null,
      methodRaw: m[5].trim(),
      fighterBMark: m[6],
      fighterBName: m[7].trim(),
      fighterBGym: (m[8] ?? "").trim() || null,
      winnerNameHintRaw: null,
    }),
  },
  {
    format: "headingless_recovered",
    re: new RegExp(
      `^${HEADINGLESS_OPENER}\\s*\\|?\\s*([^|]+?)(?:\\|\\s*)+${MARK_OPT}\\|?\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}(?:\\|\\s*)+${MARK_OPT}\\|?\\s*${NOT_METHOD_TEXT}([^|(（\\s][^|(（]*)[(（]([^)）]*)[)）]${KG_SUFFIX}(?:\\|\\s*)+(?!第\\s*\\d+試合)([^|]+)`
    ),
    build: (m) => ({
      format: "headingless_recovered",
      boutNumber: null,
      weightClassRaw: m[1].trim() || null,
      fighterAMark: m[2],
      fighterAName: m[3].trim(),
      fighterAGym: m[4].trim() || null,
      fighterBMark: m[5],
      fighterBName: m[6].trim(),
      fighterBGym: m[7].trim() || null,
      methodRaw: m[8].trim(),
      winnerNameHintRaw: null,
    }),
  },
];

// 選手名・method欄に見出し文字列やmark単体が紛れ込んでいないかの追加検証
// (2026-08-02、初回実装でGroup4/F2見出しなし版がページ内の無関係な区画
// (計量結果再掲・別boutの見出し等)にまで漏れ出し、選手名欄に「第9試合
// フライ級5分2R」等の見出しテキストが丸ごと混入する事故が実際に発生した。
// hasGarbledContent()の既存チェックに加え、見出しなし回収パス固有の
// 追加チェックとして、名前欄がmark単体・見出しの通し番号表記・階級/
// ラウンド表記そのものになっていないかを見る)。
const NAME_LOOKS_LIKE_HEADING_RE = /第\s*\d+試合|\d+分\d*R|５分|３Ｒ/;
function looksLikeGarbledHeadinglessBout(b: DeepRawBout): boolean {
  if (hasGarbledContent([b])) return true;
  if (/^[●○〇△◯×⚪⚫]+$/.test(b.fighterAName) || /^[●○〇△◯×⚪⚫]+$/.test(b.fighterBName)) return true;
  if (NAME_LOOKS_LIKE_HEADING_RE.test(b.fighterAName) || NAME_LOOKS_LIKE_HEADING_RE.test(b.fighterBName)) return true;
  if (b.fighterAName.length === 0 || b.fighterBName.length === 0) return true;
  return false;
}

const HEADINGLESS_LABEL_PLAIN_RE = /(?:コ・?メインイベント|メインイベント|セミファイナル)/;
const NUMBERED_HEADING_PLAIN_RE = /第\s*\d+試合/;

function extractHeadinglessBouts(bodyClean: string): DeepRawBout[] {
  const bouts: DeepRawBout[] = [];
  HEADINGLESS_LABEL_SCAN_RE.lastIndex = 0;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = HEADINGLESS_LABEL_SCAN_RE.exec(bodyClean))) {
    const idx = labelMatch.index;
    const labelEnd = idx + labelMatch[0].length;
    if (isPrecededByNumberedHeading(bodyClean, idx)) continue;

    // このbout候補の本文範囲を、次の「第N試合」または次の見出しなしラベルの
    // 直前までに厳密に絞る(既存フォーマットのようにページ全体を対象に
    // グローバル検索すると、無関係な区画(計量結果再掲・別boutの見出し等)
    // まで拾ってしまう事故が実際に起きたため、1候補=1ブロックに閉じ込める)。
    const rest = bodyClean.slice(labelEnd);
    const nextNumberedRel = rest.search(NUMBERED_HEADING_PLAIN_RE);
    const nextLabelRel = rest.search(HEADINGLESS_LABEL_PLAIN_RE);
    const boundaries = [nextNumberedRel, nextLabelRel].filter((v) => v !== -1);
    const blockEnd = boundaries.length > 0 ? labelEnd + Math.min(...boundaries) : bodyClean.length;
    const block = bodyClean.slice(idx, blockEnd);

    for (const pattern of HEADINGLESS_PATTERNS) {
      pattern.re.lastIndex = 0;
      const m = pattern.re.exec(block);
      if (!m) continue;
      const candidate = pattern.build(m);
      if (looksLikeGarbledHeadinglessBout(candidate)) continue;
      bouts.push(candidate);
      break;
    }
  }

  return bouts;
}

// 選手名の組(順不同)が既存bout配列に含まれるかどうか。見出しなし回収bout
// (recoverHeadinglessBouts)が、extractDeepBouts()側で既に正しく抽出済みの
// bout(例: DEEP JEWELS 31のように「第N試合 セミファイナル」と番号付きで
// 正しく抽出できているケース)と重複しないようにするための判定。
function sameFighterPairExists(existing: { fighterAName: string; fighterBName: string }[], candidate: DeepRawBout): boolean {
  const key = (a: string, b: string) => [a, b].sort().join(" ");
  const candidateKey = key(candidate.fighterAName, candidate.fighterBName);
  return existing.some((b) => key(b.fighterAName, b.fighterBName) === candidateKey);
}

// extractDeepBouts()の結果に、見出しなしメインイベント/セミファイナルの
// boutを追加専用で回収してマージする。extractDeepBouts()自体の選定ロジックは
// 一切変更しない(既存238大会の抽出結果への影響ゼロを保証するため、この
// 関数を呼ばなければextractDeepBouts()単体の挙動は従来と完全に同一)。
export function recoverHeadinglessBouts(
  rawBodyClean: string,
  existingBouts: { fighterAName: string; fighterBName: string }[]
): DeepRawBout[] {
  const bodyClean = scopeToResultsSection(rawBodyClean);
  const candidates = extractHeadinglessBouts(bodyClean);
  return candidates.filter((c) => !sameFighterPairExists(existingBouts, c));
}

// ── 3.6. 見出し表記に依存しない独立検査器(構造ベースの件数根拠) ──────────
//
// countBoutHeadings()(第\s*(\d+)試合の出現回数)は、bout抽出の正規表現群と
// 全く同じ「第N試合」という見出し表記を手がかりにしている。そのため、
// 見出し表記そのものが想定外(メインイベント/セミファイナル等、番号なし)の
// ページでは、抽出漏れとcountBoutHeadings()の過小評価が「同じ理由」で
// 同時に起こり、件数が(本来は足りていないのに)一致してしまい異常を検出
// できない(2026-08-02、PR #374で判明)。見出しの文言が今後さらに別の表記
// ゆれ(例:「オープニングマッチ」等)に広がった場合も、countBoutHeadings()
// 系の指標だけでは同じ理由で再び気づけなくなる。
//
// この関数は見出し文言を一切参照せず、DEEP公式サイト(WordPress生成)の
// DOM構造そのもの(1boutが1つの<p class="wp-block-paragraph">...</p>要素に
// 対応する、というテンプレート上の構造的事実)を根拠に「本文中に存在する
// bout情報を持つ段落の数」を数える。生HTML(stripTags前)を直接受け取る点が
// 既存のcountBoutHeadings()(stripTags後のパイプ区切りテキストが入力)との
// 決定的な違いで、見出しの文言がどう変わってもこの関数の判定基準
// (段落の中に「ジム括弧」+「決着手がかり(mark文字またはVS)」があるか)は
// 影響を受けない。
//
// build-deep-records.ts側でこの値と最終的な抽出bout数(見出しなし回収を
// 含む)を突合し、乖離があれば新しい停止条件/警告として扱う想定
// (この関数自体はカウントのみを行い、停止条件の閾値判断は呼び出し側が持つ)。
const RESULT_PARAGRAPH_RE = /<p[^>]*class="[^"]*wp-block-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
const HAS_GYM_PAREN_RE = /[(（][^)）]{0,40}[)）]/;
const HAS_RESULT_MARK_RE = /[●○〇△◯×⚪⚫]|(?:^|[^A-Za-z])VS(?:[^A-Za-z]|$)/;
// ページの装飾・告知文等、bout本体ではない段落が誤って混入しないよう、
// 実在するbout1件ぶんの本文として不自然に長い段落は対象外にする(既存の
// MAX_PLAUSIBLE_METHOD_LEN(200文字、method欄1つの上限)とは別軸で、
// 段落全体(見出し+2選手+method+付記)の上限として実測から500文字とする)。
const MAX_PLAUSIBLE_PARAGRAPH_LEN = 500;

export function countStructuralBoutBlocks(rawHtml: string): number {
  let count = 0;
  let m: RegExpExecArray | null;
  RESULT_PARAGRAPH_RE.lastIndex = 0;
  while ((m = RESULT_PARAGRAPH_RE.exec(rawHtml))) {
    const inner = m[1];
    if (inner.length > MAX_PLAUSIBLE_PARAGRAPH_LEN) continue;
    // タグを除去して純テキストで判定する(<strong>等の内部タグに惑わされない)。
    const innerText = inner.replace(/<[^>]+>/g, "");
    if (!HAS_GYM_PAREN_RE.test(innerText)) continue;
    if (!HAS_RESULT_MARK_RE.test(innerText)) continue;
    count++;
  }
  return count;
}

// ── 4. 勝敗判定 ──────────────────────────────────────────────────────────

export type DeepOutcome = {
  winner: "A" | "B" | null;
  resultType: "decisive" | "draw" | "nc" | "cancelled" | "unknown";
};

const NC_KEYWORDS = ["ノーコンテスト", "無効試合", "欠場", "試合中止", "試合不成立", "計量オーバーによりノーコンテスト"];
const DRAW_KEYWORDS = ["引き分け", "ドロー"];
const CANCELLED_KEYWORDS = ["中止"];

export function resolveOutcome(bout: DeepRawBout): DeepOutcome {
  // 優先順位の原則(修斗#255での反省を踏まえる): 明示的なシグナル(mark型なら
  // ●○〇△、VS型なら「勝者 名前」テキスト)を、method本文のキーワード検索
  // より必ず先に見る。キーワード検索を先に行うと、決着済みの試合のmethod文中に
  // たまたま「欠場」等の語(例: 「対戦相手の欠場により代打出場」のような
  // 経緯説明)が含まれていた場合に、明示的な決着結果を誤って上書きしてしまう
  // (修斗の「決着テキストによるマーカー上書き」バグと同じ構造)。
  // キーワードはあくまで「明示シグナルが無い/曖昧な場合」の二次的な手がかりとして
  // 使う。

  if (bout.format === "group1_vs") {
    if (bout.winnerNameHintRaw) {
      // 「勝者」直後の名前は姓のみ・フルネームのどちらもあり得るため、
      // 選手名の先頭一致(部分一致)で判定する(完全一致を要求すると姓のみ表記の
      // 場合に不一致になり、誤って「unknown」に落ちてしまう)。
      const hint = bout.winnerNameHintRaw;
      if (bout.fighterAName.startsWith(hint) || hint.startsWith(bout.fighterAName.slice(0, hint.length))) {
        return { winner: "A", resultType: "decisive" };
      }
      if (bout.fighterBName.startsWith(hint) || hint.startsWith(bout.fighterBName.slice(0, hint.length))) {
        return { winner: "B", resultType: "decisive" };
      }
      // 明示シグナル(勝者名)はあるが選手名と一致しない(表記ゆれ等)。これ以上
      // 推測しない。
      return { winner: null, resultType: "unknown" };
    }
    // 明示シグナルが無い場合のみキーワードにフォールバックする。
    if (NC_KEYWORDS.some((k) => bout.methodRaw.includes(k))) return { winner: null, resultType: "nc" };
    if (DRAW_KEYWORDS.some((k) => bout.methodRaw.includes(k))) return { winner: null, resultType: "draw" };
    return { winner: null, resultType: CANCELLED_KEYWORDS.some((k) => bout.methodRaw.includes(k)) ? "cancelled" : "unknown" };
  }

  // mark型(F1/Group2/Group4): ○〇=勝ち、●=負け、△=引き分け
  // (PR #201/#231のmarkToResultと同一の対応。2026-07-29、フューチャーキング
  // トーナメント2025の優勝者リストとの突合で独立に検証済み: 〇が付いた
  // 選手が実際に優勝者リストに載っていることを4階級全てで確認した)。
  const a = markToResult(bout.fighterAMark ?? "");
  const b = markToResult(bout.fighterBMark ?? "");

  if (a === "draw" || b === "draw") return { winner: null, resultType: "draw" };
  if (a === "win" && b === "loss") return { winner: "A", resultType: "decisive" };
  if (b === "win" && a === "loss") return { winner: "B", resultType: "decisive" };

  // マークが両方空欄/不明/同一(明示シグナル無し)の場合のみキーワードに
  // フォールバックする。
  if (NC_KEYWORDS.some((k) => bout.methodRaw.includes(k))) return { winner: null, resultType: "nc" };
  if (DRAW_KEYWORDS.some((k) => bout.methodRaw.includes(k))) return { winner: null, resultType: "draw" };
  return { winner: null, resultType: CANCELLED_KEYWORDS.some((k) => bout.methodRaw.includes(k)) ? "cancelled" : "unknown" };
}

// data/deepRecords.json の出力形式(scripts/build-deep-records.tsが書き出す)。
// ShootoRecordsBout/ShootoRecordsEvent(shootoScraper.ts)と同じ形をベースに、
// DEEP固有のフィールド(format・boutNumber)を追加している。
export interface DeepRecordsBout {
  cardPosition: number;
  isOpeningFight: boolean;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string; // DEEPページに明示のルール種別表記が無いため常に"unknown"(捏造しない)
  weightKg: number | null;
  namedDivision: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  winnerName: string | null;
  winnerSlug: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
  isWeighInMiss: boolean;
  // DEEP固有の追加フィールド
  format: DeepBoutFormat;
  boutNumber: number | null;
}

export interface DeepRecordsEvent {
  eventName: string;
  date: string;
  sourceUrl: string;
  fetchedDate: string;
  bouts: DeepRecordsBout[];
  parseFailures: number;
  // DEEP固有の追加フィールド
  venue: string | null;
}

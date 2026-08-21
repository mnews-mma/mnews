// /kick(立ち技名鑑)の決着欄(methodLabel()の出力)を、選手ページの主語である
// その選手を主語にした表記(勝ちならX>=Y、負けならX<=Yになる並び)に統一する。
//
// 元データ(methodRaw)は書き換えない(表示直前の変換のみ)。MMA本体側の
// src/lib/decisionScorePerspective.ts(2026-07-31追加)と同じ設計原則
// (「審判スコアは定義上、勝者側の数字が敗者側の数字以上になる」という数学的性質
// さえ分かれば、出典の表記慣習を知らなくても2数の大小関係だけで正しい表示順を
// 機械的に導出できる)を踏襲する。数字の大小からの並べ替え要否判定そのものは
// src/lib/decisionScoreDirection.ts に共通化し、重複させていない。
//
// MMA本体側との違い: MMA側は「判定X-Y」という単純な1組のスコアしか扱わない
// (正規表現は最初の1組にしかマッチしない)。/kickの決着欄は「判定3-0
// (29:28 29:28 29:27)」のように、メインの集計スコア(判定の得票数、3-0等)に
// 加えて審判別の内訳スコア(括弧内、通常3組)が付随する形式が多い
// (src/lib/kick/data.tsのSCORE_PAIR_RE/PAREN_SCORES_RE/SCORE_LIST_RE参照)。
// この内訳も同じ向きに揃えないと、メインスコアだけ並べ替えて内訳が古い向きの
// まま残る中途半端な表示になってしまう。
//
// 重要な注意点(このロジックの正しさの根拠): 内訳の各審判のスコアは、
// 個別には敗者側を支持している審判が存在しうる(スプリット判定の反対票)。
// そのため内訳の各組を「個別に」大小判定して並べ替えることはできない
// (2-1のスプリット判定で、反対票の審判のスコアだけ見ると負けている側の
// 数字が大きいことがあるため)。実際には出典サイトは「どちらの選手を
// 先に書くか」という一貫した表記順序を、メインスコアから内訳まで文字列全体で
// 統一して使っている。したがって「メインスコア(得票数の集計。過半数が
// 必ず勝者側になる)」から並べ替えの要否を1回だけ判定し、その判定結果を
// 内訳の全ペアに一律適用するのが正しい(個々の内訳ペアの大小では判定しない)。

import { isDecisionScoreOrderCorrect } from "../decisionScoreDirection";

export type KickResult = "win" | "loss" | "draw" | "no_contest" | "cancelled" | "scheduled" | "unknown";

export type KickScorePerspectiveCategory =
  /** 並べ替えを実施した(メイン+内訳全体、または内訳が複雑でメインのみ)。 */
  | "swapped"
  | "swapped_main_only"
  /** 既に選手視点の並びなので原文のまま(数字は同じ、触っていない)。 */
  | "already_correct"
  /** 勝敗が無い(引き分け・無効試合等)ため対象外。 */
  | "not_win_loss"
  /** 「判定」の文字列自体はあるが、直後にスコアの数字が続かない
   *  (例: "2回 判定")。並べ替える対象が無い。 */
  | "no_score"
  /** 主要スコア(メイン)の2値が同数で、どちらを先に出すべきかの向きに
   *  意味が無い(例: "判定0-0")。 */
  | "tied"
  /** スコアの数字の並び・区切り文字が機械的に安全に解釈できない
   *  (生データの破損・非対称な区切り文字等)。推測で並べ替えない。 */
  | "unparseable";

export interface KickScorePerspectiveResult {
  text: string;
  category: KickScorePerspectiveCategory;
  /** 並べ替え対象として認識できたスコアペアの数(メイン含む)。参考値。 */
  pairCount: number;
}

// メイン・内訳を通じて「ペアの中の区切り文字」として許容する文字
// (実データ調査で確認した範囲: ダッシュ系全種 + コロン全角半角 + スラッシュ。
// スラッシュは「30/29 30/29 30/29」のように内訳の組の中の区切りとして使う
// 出典が実在するため含める。ペア間の区切り(全角読点・カンマ・空白・審判名等)は
// 別途「between」側として扱われ、そちらは内容を問わないため、スラッシュを
// ここに加えても「30-29/30-29/30-29」(スラッシュがペア間区切りの用例)を
// 誤判定することはない(ペア間側の妥当性は検査していないため)。
// これ以外の文字がペアの中に来た場合は安全に解釈できないため並べ替えない。
const WITHIN_PAIR_CONNECTOR_RE = /^\s*[-－‐ー−:：/]\s*$/;

// 小数点は「.」のみを許容する(実データ「98.5-94.5」等)。「,」は/kickの内訳表記で
// 専らペア間の区切り文字として使われており(例:「10-9,10-9,10-9」)、小数点候補に
// 含めると「9,10」を1個の数字として誤って飲み込んでしまう(実データで検出・修正済み。
// src/lib/kick/data.tsのNUM_RE(whitelist判定用、許容範囲は広めでよい)とは目的が異なり、
// こちらは構造を機械的に安全に分解する必要があるため意図的に区別している)。
const NUMBER_TOKEN_SRC = String.raw`\d{1,3}(?:\.\d{1,2})?`;
const NUMBER_TOKEN_RE = new RegExp(`^(?:${NUMBER_TOKEN_SRC})$`);
// 2026-08-21追加: 「30:27×3」のように、3者の審判が同一スコアを付けた場合に「×3」で
// まとめて表記する出典(実データで確認)。「×N」の数字は審判別スコアの一部ではなく
// 繰り返し回数を示す注記であり、ペアとして並べ替える対象ではない。数字トークンとして
// 拾ってしまうと総数が奇数になり「安全に解釈できない」扱いになってしまうため、
// このトークナイザでは「×N」をまとめて1個の非数字(text)トークンとして扱う
// (TAIL_TOKEN_REの先頭に置き、通常の数字トークン判定より優先させる)。
const REPEAT_MARKER_SRC = String.raw`[×xX]\d{1,2}`;
// tail全体を「数字トークン」と「非数字トークン」に分解するトークナイザ。
const TAIL_TOKEN_RE = new RegExp(`(${REPEAT_MARKER_SRC})|(${NUMBER_TOKEN_SRC})|([^\\d]+)`, "g");

interface Tok {
  type: "num" | "text";
  value: string;
  index: number;
}

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  TAIL_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAIL_TOKEN_RE.exec(s))) {
    if (m[1] !== undefined) out.push({ type: "text", value: m[1], index: m.index }); // ×N(繰り返し注記)
    else if (m[2] !== undefined) out.push({ type: "num", value: m[2], index: m.index });
    else out.push({ type: "text", value: m[3], index: m.index });
  }
  return out;
}

interface Pair {
  aTok: Tok;
  bTok: Tok;
}

/**
 * tail(「判定」の直後から文字列末尾まで)を先頭から機械的にペア分解する。
 * 数字トークンが偶数個で、かつペア内の区切り文字がすべて許容セット
 * (ダッシュ/コロン系)であることを要求する。ペア間の区切り(全角読点・
 * カンマ・スラッシュ・空白・審判名・括弧等)は内容を問わない。
 * 数字トークンが区切り文字なしで隣接している(生データの欠損・誤結合)場合や、
 * 総数が奇数の場合はnullを返し、呼び出し側は「安全に解釈できない」として扱う。
 */
function tokenizePairs(tail: string): Pair[] | null {
  const tokens = tokenize(tail);
  const pairs: Pair[] = [];
  let pendingA: Tok | null = null;
  let numSeen = 0;
  let lastWasNum = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "num") {
      if (lastWasNum) return null; // 区切り文字なしで数字が隣接=破損
      numSeen++;
      if (numSeen % 2 === 1) {
        pendingA = t;
      } else {
        const connector = tokens[i - 1];
        if (!connector || connector.type !== "text") return null;
        if (!WITHIN_PAIR_CONNECTOR_RE.test(connector.value)) return null;
        pairs.push({ aTok: pendingA!, bTok: t });
        pendingA = null;
      }
      lastWasNum = true;
    } else {
      lastWasNum = false;
    }
  }
  if (numSeen % 2 !== 0) return null;
  if (pairs.length === 0) return null;
  return pairs;
}

function rebuildWithSwappedPairs(tail: string, pairs: Pair[]): string {
  let out = "";
  let cursor = 0;
  for (const p of pairs) {
    out += tail.slice(cursor, p.aTok.index);
    out += p.bTok.value;
    out += tail.slice(p.aTok.index + p.aTok.value.length, p.bTok.index);
    out += p.aTok.value;
    cursor = p.bTok.index + p.bTok.value.length;
  }
  out += tail.slice(cursor);
  return out;
}

// メインペアだけを狭く取り出す正規表現。「判定」直後、間に短いフィラー
// (空白・開き括弧・「勝者:氏名」等、いずれも数字を含まない)を挟んで
// 数字ペアが1組続く形を想定する。
const MAIN_PAIR_RE = new RegExp(
  String.raw`^([^\d]{0,10}?)(${NUMBER_TOKEN_SRC})([^\d]{1,3})(${NUMBER_TOKEN_SRC})`,
);

/**
 * 決着ラベル文字列から「判定」直後のメインスコアペアを取り出す。
 * normalizeKickDecisionScorePerspective()の内部実装と同じ正規表現(MAIN_PAIR_RE・
 * WITHIN_PAIR_CONNECTOR_RE)を再利用する。ビルド時ゲート
 * (scripts/check-kick-decision-score-perspective.ts)が「並べ替え後の出力を再度
 * 独自にパースして検証する」際、ここで別の正規表現を書いてしまうと2箇所の定義が
 * ズレて回帰を検知できなくなる(実際に開発中、ゲート側でカンマを小数点として扱う
 * 旧定義を使っていたために誤検知した経緯がある)ため、必ずこの関数を経由させる。
 */
export function extractMainScorePair(textAfterOrIncludingKeyword: string): { a: number; b: number } | null {
  const kwIdx = textAfterOrIncludingKeyword.indexOf("判定");
  const tail = kwIdx === -1 ? textAfterOrIncludingKeyword : textAfterOrIncludingKeyword.slice(kwIdx + 2);
  const m = MAIN_PAIR_RE.exec(tail);
  if (!m) return null;
  const [, , aStr, connector, bStr] = m;
  if (!WITHIN_PAIR_CONNECTOR_RE.test(connector)) return null;
  return { a: Number(aStr), b: Number(bStr) };
}

export function normalizeKickDecisionScorePerspective(
  methodLabelText: string,
  result: KickResult,
): KickScorePerspectiveResult {
  if (result !== "win" && result !== "loss") {
    return { text: methodLabelText, category: "not_win_loss", pairCount: 0 };
  }

  const kw = "判定";
  const kwIdx = methodLabelText.indexOf(kw);
  if (kwIdx === -1) {
    return { text: methodLabelText, category: "no_score", pairCount: 0 };
  }
  const headEnd = kwIdx + kw.length;
  const head = methodLabelText.slice(0, headEnd);
  const tail = methodLabelText.slice(headEnd);

  const mainMatch = MAIN_PAIR_RE.exec(tail);
  if (!mainMatch) {
    return { text: methodLabelText, category: "no_score", pairCount: 0 };
  }
  const [, , aStr, connector, bStr] = mainMatch;
  if (!WITHIN_PAIR_CONNECTOR_RE.test(connector)) {
    // メインの区切り文字自体が想定外(実データでは未観測だが念のため)。
    return { text: methodLabelText, category: "unparseable", pairCount: 0 };
  }
  const a = Number(aStr);
  const b = Number(bStr);
  if (a === b) {
    return { text: methodLabelText, category: "tied", pairCount: 1 };
  }
  const alreadyCorrect = isDecisionScoreOrderCorrect(a, b, result);

  // tail全体(メイン+内訳)をペア分解できるか試す。できればメイン+内訳を
  // 一律に並べ替える(できなければメインのみのフォールバックへ)。
  const allPairs = tokenizePairs(tail);
  const firstPairMatchesMain =
    allPairs !== null &&
    allPairs[0].aTok.value === aStr &&
    allPairs[0].bTok.value === bStr &&
    allPairs[0].aTok.index === mainMatch.index + mainMatch[1].length;

  if (allPairs && firstPairMatchesMain) {
    if (alreadyCorrect) {
      return { text: methodLabelText, category: "already_correct", pairCount: allPairs.length };
    }
    return {
      text: head + rebuildWithSwappedPairs(tail, allPairs),
      category: "swapped",
      pairCount: allPairs.length,
    };
  }

  // 内訳を安全に解釈できなかった場合のフォールバック: メインスコアの1組だけ
  // 並べ替える(内訳はデータ破損・特殊表記の可能性があるため一切触らない)。
  if (alreadyCorrect) {
    return { text: methodLabelText, category: "already_correct", pairCount: 1 };
  }
  const mainPairTok: Pair = {
    aTok: { type: "num", value: aStr, index: mainMatch.index + mainMatch[1].length },
    bTok: {
      type: "num",
      value: bStr,
      index: mainMatch.index + mainMatch[1].length + aStr.length + connector.length,
    },
  };
  return {
    text: head + rebuildWithSwappedPairs(tail, [mainPairTok]),
    category: "swapped_main_only",
    pairCount: 1,
  };
}

/** NUMBER_TOKEN_RE はテスト用に export しておく(トークン単体が数字か判定するヘルパー)。 */
export function isNumberToken(s: string): boolean {
  return NUMBER_TOKEN_RE.test(s);
}

// 対戦テーブルの決着欄(methodRaw)は4団体公式サイトの生テキストをそのまま
// 保持しており、記号・単位の表記ゆれが大きい(分/秒をプライム記号で書く/
// 書かない、ダッシュの全角半角、判定の囲み方等)。この関数は表示直前に
// 呼ぶ「字面(記号・単位)だけ」の正規化を行う。語順の統一は範囲外
// (「TKO 1R 3分50秒」と「1R 3分13秒 TKO」が並ぶことは許容する)。
//
// 対象外(素通し): 延長ラウンド・不戦勝・反則失格・テクニカル判定・
// S/TS(サブミッション)接頭辞などの構造・語順。未知パターンはどの正規表現にも
// マッチしないため自動的に原文のまま出力される(壊すくらいなら不揃いのまま
// 出す方針)。
//
// data/配下のmethodRaw原文は書き換えない。呼び出し箇所は
// src/lib/mnewsRating/multiOrgRecord.tsのtoBoutRow()1箇所に限定し、
// history.methodを経由する全consumer(選手ページ対戦テーブル・決着方法
// 内訳ウィジェット・対戦相手比較バナー)に一括反映する。
// normalizeDecisionScorePerspective(判定スコアの視点並べ替え)は本関数の
// 出力を受け取って動く想定(字面正規化→視点並べ替えの順)。

// 分(minute)側の記号として認識する文字(ダッシュ扱いのｰ等とは別枠)。
const MINUTE_MARK_CHARS = "'’′`"; // ' ’ ′ `(バッククォート、スクレイパー由来の表記ゆれ)
// 秒(second)側の記号として認識する文字。
const SECOND_MARK_CHARS = '"”″'; // " ” ″
// ダッシュとして認識する文字(半角ハイフンへ統一)。全角カタカナ長音記号
// (ー、U+30FC)は通常の単語表記に多用されるため対象外(誤爆防止)。
const DASH_LOOKALIKE_CHARS = "－‐−ｰ"; // － ‐ − ｰ(半角カナ長音)

const TIME_MARK_RE = new RegExp(
  `(\\d+)\\s*[${MINUTE_MARK_CHARS}]\\s*(\\d+)\\s*[${SECOND_MARK_CHARS}]` +
    // 直後に秒/他の引用符記号が続く二重アーティファクト(スクレイパー由来の
    // 既知の破損データ)はマッチさせず素通しする(壊れた変換を作るくらい
    // なら不揃いのまま出す)。
    `(?![秒${SECOND_MARK_CHARS}${MINUTE_MARK_CHARS}])`,
  "g"
);
const DASH_RE = new RegExp(`[${DASH_LOOKALIKE_CHARS}]`, "g");

// 判定の囲み(角括弧・丸括弧・コロン・スペース)を外して「判定X-Y」に揃える。
// スコア本体・※以降の補足文言は一切変更しない。
const JUDGE_BRACKET_WRAP_RE = /[[（(]\s*(判定)\s*[:：]?\s*([\d-]+)\s*[\]）)]/g; // [判定X-Y] （判定：X-Y）
const JUDGE_SCORE_PAREN_RE = /(判定)\s*[(（]\s*([\d-]+)\s*[)）]/g; // 判定(X-Y) 判定（X-Y）
const JUDGE_SPACE_RE = /(判定)[ 　]+(?=[\d-])/g; // 判定 X-Y → 判定X-Y

export function normalizeFinishText(raw: string): string {
  let s = raw;

  // 1. 分/秒の記号→漢字単位
  s = s.replace(TIME_MARK_RE, (_m, min: string, sec: string) => `${min}分${sec}秒`);

  // 2. ダッシュ類→半角ハイフン
  s = s.replace(DASH_RE, "-");

  // 3. 判定の囲み・コロン・スペースを外す(スコア・※以降は保持)
  s = s.replace(JUDGE_BRACKET_WRAP_RE, "$1$2");
  s = s.replace(JUDGE_SCORE_PAREN_RE, "$1$2");
  s = s.replace(JUDGE_SPACE_RE, "$1");

  // 4. 残った全角括弧・全角コロン・連続空白の正規化
  s = s.replace(/（/g, "(").replace(/）/g, ")").replace(/：/g, ":");
  s = s.replace(/[ 　]+/g, " ").trim();

  return s;
}

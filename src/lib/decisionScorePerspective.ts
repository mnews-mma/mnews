// 対戦テーブルの決着欄(methodRaw)は各団体公式サイトの生テキストをそのまま
// 保持しており、判定スコアの記法(勝者側を先に書くか敗者側を先に書くか)が
// 団体・年代によって異なる。同じ「勝ち」でも「判定3-0」と「判定0-3」が混在し、
// 選手ページ上で不自然に見える(2026-07-31)。
//
// 判定における審判スコアは定義上、勝者側の数字が敗者側の数字以上になる
// (過半数以上の審判が支持しない限り決定的勝利にはならない)。そのため
// 「どちらが勝者か」さえ分かれば、生テキストがどちらを先に書く慣習だったかを
// 知らなくても、2数の大小関係だけで正しい表示順を機械的に導出できる。
//
// data/配下のmethodRaw原文は書き換えない(将来の検証のため保持)。この関数は
// 表示直前に呼ぶ変換のみを行う。呼び出し箇所は選手ページの対戦テーブル
// (fighters/[slug]/page.tsx)の1箇所に限定し、判定ロジックを重複させない。
//
// 2数の大小関係から「並べ替えが必要か」を判定する部分は、/kick側
// (src/lib/kick/decisionScorePerspective.ts、2026-08-17追加)でも全く同じ判定が
// 必要になったため、isDecisionScoreOrderCorrect()として共有関数に切り出し済み
// (src/lib/decisionScoreDirection.ts)。この関数自体の正規表現パース部分は
// MMA側の「判定X-Y」単純1組専用のままで変更していない。
import { isDecisionScoreOrderCorrect } from "./decisionScoreDirection";

const DECISION_SCORE_DASH = "[-−‐－ｰ]";
const DECISION_SCORE_RE = new RegExp(`(判定)([^0-9]{0,6})(\\d+)\\s*${DECISION_SCORE_DASH}\\s*(\\d+)`);

export function normalizeDecisionScorePerspective(
  method: string,
  result: "win" | "loss" | "draw" | "nc"
): string {
  // 引き分け・無効試合はスコア表記を一切いじらない(仕様: 「引き分け(同数)は
  // そのまま」。ドローの中には「1-0」のような非対称表記も実データに存在するが、
  // 勝敗が無い以上どちらを先に出すべきかの基準が無いため、対象外として原文を保持する)。
  if (result !== "win" && result !== "loss") return method;

  const m = DECISION_SCORE_RE.exec(method);
  if (!m) return method;

  const [full, keyword, between, aStr, bStr] = m;
  const a = Number(aStr);
  const b = Number(bStr);

  // 既に仕様どおりの並び(勝者視点なら大きい数が先、敗者視点なら小さい数が先。
  // 数字が同じ場合は並べ替える意味が無いためこちらもtrue扱い)なら原文に一切
  // 触れない(区切り文字の表記ゆれ(－/−/ｰ等)を正規化してしまうと「並べ替えて
  // いないのに変わった」ことになり、変換対象を数字の並びだけに限定した仕様から
  // 外れるため)。
  if (isDecisionScoreOrderCorrect(a, b, result)) return method;

  const replacement = `${keyword}${between}${bStr}-${aStr}`;
  return method.slice(0, m.index) + replacement + method.slice(m.index + full.length);
}

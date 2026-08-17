// 判定における審判スコアの「向き」を判定する共通ロジック。
// 審判スコアは定義上、勝者側の数字が敗者側の数字以上になる
// (過半数以上の審判が支持しない限り決定的勝利にはならない)。
// この性質は競技・出典サイトの表記慣習に依存しない普遍的な事実であり、
// MMA本体側(src/lib/decisionScorePerspective.ts)と/kick側
// (src/lib/kick/decisionScorePerspective.ts)の両方で同じ判定が必要になる。
// 判定ロジックを2箇所に重複させないため、この最小の純粋関数だけを共有する
// (呼び出し側それぞれの文字列パース方法までは共有しない。パース対象の形式が
// MMA側は単純な「判定X-Y」1組のみ、/kick側はメインスコア+審判別内訳という
// 異なる構造を持つため)。
export function isDecisionScoreOrderCorrect(
  a: number,
  b: number,
  result: "win" | "loss",
): boolean {
  if (a === b) return true; // 同数は並べ替える意味が無いので「既に正しい」扱い
  return result === "win" ? a >= b : a <= b;
}

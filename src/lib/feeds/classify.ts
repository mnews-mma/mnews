// 二次メディア（ゴング格闘技 / MMAPLANET / イーファイト）の記事のうち、
// MMA（総合格闘技）に関係するものだけを「ニュース」欄に通すための判定。
// これらは公式発信ではないため団体分類は行わず、すべて "other"
// （ニュース・バッジ無し）として扱う。
const MMA_KEYWORDS: RegExp[] = [
  /RIZIN/i,
  /ライジン/,
  /UFC/i,
  /\bDEEP\b/i,
  /パンクラス/,
  /PANCRASE/i,
  /修斗/,
  /ONE\s?(Championship|FC|Friday Fights)/i,
  /PFL/i,
  /Bellator/i,
  /ベラトール/,
  /総合格闘技/,
  /\bMMA\b/,
  /グラップリング/,
  /ADCC/i,
];

export function isMmaRelevant(title: string): boolean {
  return MMA_KEYWORDS.some((p) => p.test(title));
}

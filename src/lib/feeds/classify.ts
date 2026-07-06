// 二次メディア（ゴング格闘技 / MMAPLANET / イーファイト）の記事のうち、
// MMA（総合格闘技）に関係するものだけを「ニュース」欄に通すための判定。
// これらは公式発信ではないため団体分類は行わず、すべて "other"
// （ニュース・バッジ無し）として扱う。
const MMA_KEYWORDS: RegExp[] = [
  /RIZIN/i,
  /ライジン/,
  /UFC/i,
  // DEEP は「DEEP132」「DEEP JEWELS」「DEEPフェザー級」等、直後に数字や
  // 日本語が続く表記が多い。\bDEEP\b だと DEEP と数字の間に語境界が無く
  // 「DEEP132」を取りこぼすため、前後が英字でない DEEP を許容する
  // （deeper / INDEEP 等の英単語の誤検知は防ぐ）。
  /(?<![A-Za-z])DEEP(?![A-Za-z])/i,
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

// RESULT/WINカード(src/app/api/og/result/route.tsx)専用の勝者名サイズ計算。
// events.ts(全カード横断の天井算出)とroute.tsx(実描画)の両方がこのファイルを
// 参照することで、算出ロジックと描画ロジックが分岐しないようにする
// (CLAUDE.mdに記録済みの過去バグ=算出/描画のズレの再発防止)。
// dream/vs OGP(src/lib/og/fitName.ts)やWeb側(src/lib/vsMath.ts)とは無関係の
// 独立した実装(RESULTカードは常に1行描画・折り返し無しのため、行パッキングは不要)。

// satoriは実行時にテキスト実寸を測れない(canvasのmeasureText相当が無い)ため、
// 文字種ごとの推定幅(半角=0.55em/全角=1.0em)で見積もる。
export function estimateNameWidthEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    // コードポイント255以下(Latin-1範囲)=半角ラテン/数字/記号、それ以外=全角(漢字/かな/カナ)
    const isHalfWidth = (ch.codePointAt(0) ?? 0) <= 255;
    w += isHalfWidth ? 0.55 : 1.0;
  }
  return w;
}

// 名前1件が指定幅にちょうど収まるフォントサイズ(クランプ無しの理論値)。
// 天井(OG_RESULT_WINNER_NAME_CEILING)算出側で使う。
export function exactFitNameFontSize(text: string, maxWidthPx: number): number {
  const widthEm = estimateNameWidthEm(text);
  if (widthEm === 0) return Infinity;
  return maxWidthPx / widthEm;
}

// 描画側: 天井以下ならちょうど天井(=単一サイズ)、天井算出の母集団に無い
// 極端に長い名前だけ下限まで自然に縮小する(拡大はしない)。
export function fitResultWinnerNameSize(
  text: string,
  maxWidthPx: number,
  ceiling: number,
  minSize: number
): number {
  const widthEm = estimateNameWidthEm(text);
  if (widthEm === 0) return ceiling;
  const fitted = Math.floor(maxWidthPx / widthEm);
  return Math.max(minSize, Math.min(ceiling, fitted));
}

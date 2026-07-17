// VSカード共通ロジック(docs/instructions/vs-card-spec.md準拠)。
// Web(MatchupTape等のCSS)とOGP(Satori)の両方から参照する単一ソース。
// レイアウト計算はすべて決定的(JS実行時の計測に依存しない)であること。

// 選手名の文字数(サロゲート考慮のcode point数、空白除く)からフォントサイズを
// 決める(spec §4.2)。CSSの自動縮小(clamp/vw)はSatori非対応のため使わない。
export function fighterNameSize(name: string): number {
  const len = [...name.replace(/\s/g, "")].length;
  if (len <= 7) return 20;
  if (len <= 11) return 17;
  return 15;
}

// 「・」の直後で改行できるようゼロ幅スペースを挿む(spec §4.3)。Web側は<wbr>を
// 使えるが、文字列としても同じ挿入結果を返せるようここに一本化する。
export function insertNameBreaks(name: string): string {
  return name.replaceAll("・", "・​");
}

export interface TugShare {
  shareA: number; // 0.08〜0.92にクランプ済み、小数1位
  shareB: number; // 1 - shareA
  neutral: boolean; // true = 両方0(ゼロ除算)。バーはneutral色1本、基準線非表示
}

const MIN_SHARE = 0.08;
const MAX_SHARE = 0.92;

// 綱引きバーの分割比率(spec §5.1-5.2)。a/bは同じ指標の絶対値(勝率%・
// フィニッシュ率%等)。片方でもnullなら呼び出し側でバー非表示・数値「—」に倒す
// (この関数はその判定をしない=両方数値がある前提)。
export function computeTugShare(a: number, b: number): TugShare {
  if (a === 0 && b === 0) {
    return { shareA: 0.5, shareB: 0.5, neutral: true };
  }
  const raw = a / (a + b);
  const clamped = Math.min(MAX_SHARE, Math.max(MIN_SHARE, raw));
  const shareA = Math.round(clamped * 1000) / 1000;
  return { shareA, shareB: Math.round((1 - shareA) * 1000) / 1000, neutral: false };
}

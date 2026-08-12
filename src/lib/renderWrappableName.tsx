import type { ReactNode } from "react";
import { splitLongToken } from "./vsMath";

// 選手名の折り返しは中黒「・」やスペースの位置、またはsplitLongToken()が
// 決めるちょうど1点でのみ発生させ、それ以外の位置では割れないようにする
// (区切りで分割しnowrapブロック化)。区切りの無い外国人リングネーム等
// (例:シンバートルバットエルデネ=13文字)をnowrap化すると375px幅のカラムから
// はみ出すため、1トークンが一定文字数を超える場合はsplitLongToken()で
// ちょうど2つのnowrapブロックに割る。以前は文字単位で任意の位置に折れる
// 通常のCJK折り返しにフォールバックしていたが、ブラウザは「最もバランスの
// 良い位置」ではなくコンテナ幅一杯まで貪欲に詰めるため、末尾1文字だけが
// 孤立する不自然な位置で折れる事故になっていた(2026-08-12、「宇佐美正
// パトリック」で発覚)。splitLongToken()はfighterNameSize()のサイズ計算と
// 同じ関数なので、折り返し可能な位置=サイズ計算が想定した位置を厳密に一致
// させる。
// BoutCard.tsx(大会ページ・夢のカード)・FighterVisuals.tsx(選手ページ次戦)・
// MatchupTape.tsx(VSカード系v2の名前描画)で使う共有ヘルパー=名前折り返しの
// 単一実装(循環import回避のため単独ファイルに切り出し)。
export function renderWrappableName(name: string): ReactNode {
  const parts = name.split(/(・|\s+)/).filter((p) => p !== "");
  return parts.flatMap<ReactNode>((part, i) => {
    if (part === "・" || /^\s+$/.test(part)) return [part];
    return splitLongToken(part).map((sub, j) => (
      <span key={`${i}-${j}`} style={{ whiteSpace: "nowrap" }}>
        {sub}
      </span>
    ));
  });
}

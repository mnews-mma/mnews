import type { ReactNode } from "react";
import { NOWRAP_TOKEN_MAX_LEN } from "./vsMath";

// 選手名の折り返しは中黒「・」やスペースの位置でのみ発生させ、単語(トークン)
// 途中で割れないようにする(区切りで分割しnowrapブロック化)。ただし区切りの
// 無い外国人リングネーム等(例:シンバートルバットエルデネ=13文字)をnowrap化
// すると375px幅のカラムからはみ出すため、1トークンが一定文字数を超える場合は
// 強制せず通常のCJK折り返し(文字単位)にフォールバックする(はみ出し優先回避)。
// BoutCard.tsx(大会ページ・夢のカード)・FighterVisuals.tsx(選手ページ次戦)・
// MatchupTape.tsx(VSカード系v2の名前描画)で使う共有ヘルパー=名前折り返しの
// 単一実装(循環import回避のため単独ファイルに切り出し)。
export function renderWrappableName(name: string): ReactNode {
  const parts = name.split(/(・|\s+)/).filter((p) => p !== "");
  return parts.map((part, i) =>
    part === "・" || /^\s+$/.test(part) || part.length > NOWRAP_TOKEN_MAX_LEN ? (
      part
    ) : (
      <span key={i} style={{ whiteSpace: "nowrap" }}>
        {part}
      </span>
    )
  );
}

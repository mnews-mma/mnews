import type { FighterRecordEntry } from "./fighterRecordsCache";

// 戦績ストリップ(events/[slug]・results/[slug]で共用)のデータ算出ロジック。
// fighterRecords.json のみをソースとし、算出不能な項目はnullで返す(呼び出し側が非表示にする)。

export interface FighterStripStats {
  record: string; // 例 "12-3-1"(wins-losses-draws)
  // フィニッシュ率 = (KO+一本)/勝数。勝数0は算出不能としてnull。
  finishRate: number | null;
  // 直近5戦。history を日付降順に並べ替えてから先頭5件を取る
  // (元データが既に降順の場合も多いが、順序を前提にしない)。
  last5: FighterRecordEntry["history"][number]["result"][];
}

export const LAST5_SYMBOL: Record<FighterRecordEntry["history"][number]["result"], string> = {
  win: "○",
  loss: "●",
  draw: "△",
  nc: "△",
};

export function computeFighterStripStats(entry: FighterRecordEntry): FighterStripStats {
  const record = `${entry.wins}-${entry.losses}-${entry.draws}`;
  const finishRate = entry.wins > 0 ? Math.round(((entry.ko + entry.sub) / entry.wins) * 100) : null;
  const last5 = [...entry.history]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
    .map((h) => h.result);
  return { record, finishRate, last5 };
}

export interface WinMethodBreakdown {
  koPct: number;
  subPct: number;
  decisionPct: number;
}

export interface MethodCounts {
  ko: number;
  sub: number;
  decision: number;
  other: number;
}

// history[].method(日本語の生テキスト、例:"2R 2:24 TKO（パウンド）"
// "1R 4:31 三角絞め" "5分3R終了 判定1-2")をKO/一本/判定に分類する。
// 既存のko/sub/decisionフィールド(Wikipedia側の英語表記からの分類 or
// infoboxの明示集計値)は勝ち側専用で、負け側の内訳フィールドは存在しない。
// このためhistoryのraw methodをキーワードで分類して再集計する(推定はしない、
// 実データのテキスト分類のみ)。分類できない場合はotherに計上する。
function classifyMethodJa(method: string): keyof MethodCounts {
  if (method.includes("判定")) return "decision";
  if (/TKO|KO/i.test(method)) return "ko";
  // 一本(サブミッション)は決まり技名で表現されることが多いため、代表的な
  // 関節技・絞め技のキーワードで判定する(history実データで確認された表記:
  // 「絞め」「クランク」「固め」「三角」「チョーク」「腕ひしぎ」「ロック」等)。
  if (/絞め|クランク|固め|三角|チョーク|腕ひしぎ|ロック|一本/.test(method)) return "sub";
  return "other";
}

function tallyMethods(fights: FighterRecordEntry["history"]): MethodCounts {
  const counts: MethodCounts = { ko: 0, sub: 0, decision: 0, other: 0 };
  for (const f of fights) counts[classifyMethodJa(f.method)]++;
  return counts;
}

// 負け側の決着内訳(history再集計)。敗北0件はnull(算出不能)。
export function computeLossBreakdown(entry: FighterRecordEntry): MethodCounts | null {
  const losses = entry.history.filter((h) => h.result === "loss");
  if (losses.length === 0) return null;
  return tallyMethods(losses);
}


// 勝ち方の内訳(KO/一本/判定の比率)。fighters/[slug]/page.tsx のフィニッシュ内訳バーと
// 同じ計算式(finishBase = max(wins, ko+sub+decision) || 1)に揃える。
// wins=0かつko+sub+decision=0の選手はnull(算出不能)。
export function computeWinMethodBreakdown(entry: FighterRecordEntry): WinMethodBreakdown | null {
  const finishBase = Math.max(entry.wins, entry.ko + entry.sub + entry.decision);
  if (finishBase === 0) return null;
  return {
    koPct: Math.round((entry.ko / finishBase) * 100),
    subPct: Math.round((entry.sub / finishBase) * 100),
    decisionPct: Math.round((entry.decision / finishBase) * 100),
  };
}

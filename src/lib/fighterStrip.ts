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

// 勝率 = 勝/(勝+敗)。分母から引き分け・NCを除外する(entry.wins/lossesは元々
// 引き分け・NCを含まない集計のため、この式だけで自然に満たされる)。
// 分母0(未勝負・データなし)はnull(呼び出し側は「—」等に倒す)。
export function computeWinRate(entry: FighterRecordEntry): number | null {
  const denom = entry.wins + entry.losses;
  if (denom === 0) return null;
  return Math.round((entry.wins / denom) * 100);
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
// 決着方法データが実質存在しない(round/time以外の記述が「N/A」のみ等)試合を
// 検出する。「2R N/A 洗濯ばさみ」のようにtimeだけがN/Aで決まり技名は実在する
// ケースを誤って弾かないよう、round+time相当のプレフィックスを取り除いた
// 残りが本当に空/N/Aの場合のみ「不明」とする(捏造ゼロ: 存在しない決着方法を
// 「その他」という決着があったかのように集計しない)。
function isUnknownMethod(method: string): boolean {
  const trimmed = method.trim();
  if (trimmed === "" || trimmed === "—") return true;
  const stripped = trimmed.replace(/^\S*\s+[\d:]+\s+/, "").trim();
  return /^N\/A$/i.test(stripped);
}

function classifyMethodJa(method: string): keyof MethodCounts {
  if (method.includes("判定")) return "decision";
  if (/TKO|KO/i.test(method)) return "ko";
  // 一本(サブミッション)は決まり技名で表現されることが多いため、代表的な
  // 関節技・絞め技のキーワードで判定する。history実データを全選手分棚卸しして
  // 判明した表記ゆれを網羅する:
  // 絞め系(絞め/チョーク/スリーパー[ホールド]/ドラゴンスリーパー/ネックシザース/
  // 洗濯ばさみ)、関節技系(固め/腕ひしぎ/三角/クランク/ロック/ヒール[フック・
  // ホールド]/アームバー/オモプラッタ/アメリカーナ/ツイスター/アンクルホールド/
  // ニーバー/ストレッチ[スロエフストレッチ・ネックストレッチ等])、その他
  // 「サブミッション」表記そのもの・「一本」。
  if (
    /絞め|クランク|固め|三角|チョーク|腕ひしぎ|ロック|一本|スリーパー|ホールド|ヒール|アームバー|オモプラッタ|アメリカーナ|ツイスター|ネックシザース|洗濯ばさみ|サブミッション|スロエフ|ニーバー|ストレッチ/.test(
      method
    )
  )
    return "sub";
  return "other";
}

function tallyMethods(fights: FighterRecordEntry["history"]): MethodCounts {
  const counts: MethodCounts = { ko: 0, sub: 0, decision: 0, other: 0 };
  for (const f of fights) {
    if (isUnknownMethod(f.method)) continue; // 集計から除外(捏造ゼロ)
    counts[classifyMethodJa(f.method)]++;
  }
  return counts;
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

// ── 選手ページ再設計(⑥)用の集計。すべて history の生データからの再解析で、
//    勝ち側/負け側とも同一ロジックで内部整合を取る(保存済みko/sub/decisionは
//    勝ち側のみ・出自が一様でないため、ここでは使わず history を正とする)。 ──

// 勝ち方 vs 負け方の並置対比用。勝ち・負けそれぞれのKO/一本/判定内訳を返す。
// 該当試合0件の側はnull(呼び出し側で非表示)。
export function computeMethodSplit(entry: FighterRecordEntry): { win: MethodCounts | null; loss: MethodCounts | null } {
  const wins = entry.history.filter((h) => h.result === "win");
  const losses = entry.history.filter((h) => h.result === "loss");
  return {
    win: wins.length > 0 ? tallyMethods(wins) : null,
    loss: losses.length > 0 ? tallyMethods(losses) : null,
  };
}


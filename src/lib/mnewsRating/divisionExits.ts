// 王座返上・階級離脱による除外(事実オーバーレイ)。retirements.tsと同じ思想:
// 一次ソースで確認できる「事実」のみを載せ、根拠不明な推測は一切行わない
// (捏造ゼロ)。引退とは別軸: 現役だが該当階級のベルトを返上し当該階級から
// 事実上離脱した選手を、その階級のランキングからのみ除外する(他階級・
// レート算出自体には触れない。Elo計算は引き続き全履歴で行い、この選手の
// 過去戦績は対戦相手のレート計算に影響を与え続ける)。
//
// 18ヶ月ルール(ELIGIBILITY_MAX_INACTIVE_MONTHS)・引退リスト(retirements.ts)
// だけでは、「王座返上後に他団体・他階級へ移ったが、直近18ヶ月以内に旧階級
// での試合が残っている」ケースを塞げない(境界期間は特に不安定)。階級移籍・
// 王座返上は引退と違って離散的な事実として一次ソースで確認できるため、
// 個別に事実オーバーレイとして持たせる。
//
// 2026-07-16(v9)追加: 堀口恭司がRIZINフライ級王座を返上しUFCへ復帰(2025-03-30
// RIZIN.50香川でのCEO発表・以後の全試合がUFC)。フライ級側は空位を受けて
// RIZIN WORLD GP 2025が新設されている。最終RIZIN戦(2024-12-31 RIZIN.49)から
// 本ノート作成時点で18ヶ月弱と18ヶ月ルールの境界に近く、機械判定だけに
// 委ねると出入りが不安定になるため、事実として恒久除外する。
//
// 【該当なし・確認済み】扇久保博正・元谷友貴は元王者だが現役でフライ級に
// 参戦し続けているため対象外(Kaina確認・2026-07-16)。今後も一次情報での
// 最終判断はオペレーター側で行う。
export interface DivisionExitEntry {
  slug: string;
  division: import("./divisions").MnewsDivision; // この階級のランキングからのみ除外
  name: string;
  reason: string;
  source: string;
  fetchedDate: string;
}

export const DIVISION_EXIT_FIGHTERS: DivisionExitEntry[] = [
  {
    slug: "horiguchi-kyoji",
    division: "フライ級",
    name: "堀口恭司",
    reason: "RIZINフライ級王座返上・UFC復帰による階級離脱",
    source: "https://news.yahoo.co.jp/articles/5f6b0d3123d07b920d670810ac20f0939ddb325f (RIZIN.50, 2025-03-30発表)",
    fetchedDate: "2026-07-16",
  },
];

export function isDivisionExit(slug: string, division: import("./divisions").MnewsDivision): boolean {
  return DIVISION_EXIT_FIGHTERS.some((e) => e.slug === slug && e.division === division);
}

// オペレーター判断による階級別除外(上のDIVISION_EXIT_FIGHTERS=一次ソースで確認できる
// 王座返上・階級離脱の「事実」リストとは別軸)。レート・戦績・他階級には触れず、
// 当該階級のランキング掲載からのみ手動除外。用途は「Eloも履歴も正しいが、直近の
// 資格対象戦がキャッチウェイト主体で当該階級への確信的なバケットができない」選手。
export const DIVISION_AMBIGUOUS_EXCLUSIONS: DivisionExitEntry[] = [
  {
    slug: "tokoro-hideo",
    division: "バンタム級",
    name: "所英男",
    reason:
      "直近の資格対象戦がキャッチウェイト主体で、バンタム級への確信的な階級判定が" +
      "できないため当該階級ランキングから除外(オペレーター判断)。Elo・戦績・他階級には触れない。",
    source: "operator-judgment (Kaina, 2026-07-19)",
    fetchedDate: "2026-07-19",
  },
];

export function isDivisionAmbiguousExcluded(slug: string, division: import("./divisions").MnewsDivision): boolean {
  return DIVISION_AMBIGUOUS_EXCLUSIONS.some((e) => e.slug === slug && e.division === division);
}

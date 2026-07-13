// RIZIN.1(2016-04-17)は「大会情報」タグ(rizinEventIndex.ts)に含まれず(サイト側の
// タグ付け漏れ)、かつ2016年当時のページテンプレートがrizinScraper.tsの新
// テンプレート用パーサーでは解析できない構造(<p class="match_info">ベース、
// 2018年以降の<h2>+<span>形式とは別物)のため、この1大会分のみ手動で書き起こして
// 格納する。
// 出典: https://jp.rizinff.com/_ct/16952376(TOP Presents RIZIN.1 試合結果一覧)
// 取得日: 2026-07-13
export interface RizinRawBoutManual {
  cardPosition: number; // 第N試合(1=オープナー、数字が大きいほどメインに近い)
  fighterAName: string;
  fighterBName: string;
  winnerName: string | null; // nullは引き分け・中止
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "女子MMA" | "グラップリング";
  weightKg: number | null; // 無差別契約等は null
  namedDivision: string | null;
  resultType: "decisive" | "draw" | "nc" | "cancelled";
  methodRaw: string;
}

export const RIZIN_1_BOUTS: RizinRawBoutManual[] = [
  { cardPosition: 1, fighterAName: "悠矢", fighterBName: "祐毅", winnerName: "悠矢", ruleType: "キックボクシング", weightKg: 60, namedDivision: null, resultType: "decisive", methodRaw: "1R 1:06 TKO（3ノックダウン）" },
  { cardPosition: 2, fighterAName: "ダニロ・ザノリニ", fighterBName: "網本規久", winnerName: "ダニロ・ザノリニ", ruleType: "キックボクシング", weightKg: 73, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:19 TKO（3ノックダウン）" },
  { cardPosition: 3, fighterAName: "大和哲也", fighterBName: "山口裕人", winnerName: "大和哲也", ruleType: "キックボクシング", weightKg: 64, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:37 TKO（3ノックダウン）" },
  { cardPosition: 4, fighterAName: "村田夏南子", fighterBName: "ナタリア・デニソヴァ", winnerName: "村田夏南子", ruleType: "女子MMA", weightKg: 53, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定3−0" },
  { cardPosition: 5, fighterAName: "元谷友貴", fighterBName: "アラン・ナシメント", winnerName: null, ruleType: "MMA", weightKg: 56.7, namedDivision: null, resultType: "cancelled", methodRaw: "中止（ドクターストップ）" },
  { cardPosition: 6, fighterAName: "悠太", fighterBName: "加藤久輝", winnerName: "加藤久輝", ruleType: "MMA", weightKg: 81.7, namedDivision: null, resultType: "decisive", methodRaw: "1R 1:04 TKO" },
  { cardPosition: 7, fighterAName: "キリル・シデルニコフ", fighterBName: "クリス・バーネット", winnerName: "キリル・シデルニコフ", ruleType: "MMA", weightKg: 120, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定2−1" },
  { cardPosition: 8, fighterAName: "ダロン・クルックシャンク", fighterBName: "佐々木信治", winnerName: "ダロン・クルックシャンク", ruleType: "MMA", weightKg: 70.3, namedDivision: null, resultType: "decisive", methodRaw: "1R 4:36 TKO" },
  { cardPosition: 9, fighterAName: "RENA", fighterBName: "シンディ・アルベス", winnerName: "RENA", ruleType: "シュートボクシング", weightKg: 51, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定3−0" },
  { cardPosition: 10, fighterAName: "桜庭和志＆所英男", fighterBName: "ヴァンダレイ・シウバ＆田村潔司", winnerName: null, ruleType: "グラップリング", weightKg: null, namedDivision: null, resultType: "draw", methodRaw: "1ラウンド15分 時間切れ" },
  { cardPosition: 11, fighterAName: "ギャビ・ガルシア", fighterBName: "アンナ・マリューコヴァ", winnerName: "ギャビ・ガルシア", ruleType: "女子MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 2:04 腕ひしぎ十字固め" },
  { cardPosition: 12, fighterAName: "テオドラス・オークストリス", fighterBName: "シング・心・ジャディブ", winnerName: "テオドラス・オークストリス", ruleType: "MMA", weightKg: 98, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定3−0" },
  { cardPosition: 13, fighterAName: "ワジム・ネムコフ", fighterBName: "カール・アルブレックソン", winnerName: "カール・アルブレックソン", ruleType: "MMA", weightKg: 93, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定1−2" },
  { cardPosition: 14, fighterAName: "イリー・プロハースカ", fighterBName: "藤田和之", winnerName: "イリー・プロハースカ", ruleType: "MMA", weightKg: 110, namedDivision: null, resultType: "decisive", methodRaw: "1R 3:18 TKO" },
];

export const RIZIN_1_SOURCE = {
  eventName: "TOP Presents RIZIN.1",
  date: "2016-04-17",
  sourceUrl: "https://jp.rizinff.com/_ct/16952376",
  fetchedDate: "2026-07-13",
};

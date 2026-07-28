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
  round?: string | null; // ページに明記されている場合のみ設定(推測しない)。
  // RIZIN.1書き起こし時点では未設定のままmethodRawに含めていたが、RIZIN.2以降は
  // ページ側に明確な「NR」表記があるため分離する(RIZIN.1側の既存値は変更しない)。
  time?: string | null; // 同上。判定等、時間の記載が無い決着は null のまま(捏造しない)。
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

// RIZIN.2(2016-09-25)は「大会情報」タグには含まれる(rizinEventIndex.tsの
// resultsPageId="16997624")が、RIZIN.1と同じく2016年当時の旧テンプレート
// (<div id="match-list">ベース、<p class="match_info">「第N試合」+
// (win)/(lose)マーカー形式)のためrizinScraper.tsのパーサーでは0試合になる。
// rizinEventIndex.tsの当該エントリにmanualOverride: trueを設定しており、
// update-rizin-records.tsの自動fetchループはこのエントリをスキップし、
// 代わりにこの13試合を手動書き起こしとして格納する(二重計上防止)。
// 出典: https://jp.rizinff.com/_ct/16997624
// (RIZIN.2 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 開幕戦 試合結果一覧)
// 取得日: 2026-07-27
export const RIZIN_2_BOUTS: RizinRawBoutManual[] = [
  { cardPosition: 1, fighterAName: "デスティニー・ヤーブロー", fighterBName: "ギャビ・ガルシア", winnerName: "ギャビ・ガルシア", ruleType: "女子MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2'42\" アームロック", round: "1R", time: "2'42\"" },
  { cardPosition: 2, fighterAName: "村田夏南子", fighterBName: "キーラ・バタラ", winnerName: "村田夏南子", ruleType: "女子MMA", weightKg: 52.2, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定 3-0", round: "3R", time: null },
  { cardPosition: 3, fighterAName: "木村“フィリップ”ミノル", fighterBName: "チャールズ・“クレイジー・ホース”・ベネット", winnerName: "チャールズ・“クレイジー・ホース”・ベネット", ruleType: "MMA", weightKg: 67, namedDivision: null, resultType: "decisive", methodRaw: "1R 0'07\" K.O", round: "1R", time: "0'07\"" },
  { cardPosition: 4, fighterAName: "テオドラス・オークストリス", fighterBName: "シモン・バヨル", winnerName: "シモン・バヨル", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 判定0-3", round: "2R", time: null },
  { cardPosition: 5, fighterAName: "ジョアン・アルメイダ", fighterBName: "アミール・アリアックバリ", winnerName: "アミール・アリアックバリ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2'25\" TKO(レフェリーストップ)", round: "1R", time: "2'25\"" },
  { cardPosition: 6, fighterAName: "カール・アルブレックソン", fighterBName: "ワレンティン・モルダフスキー", winnerName: "ワレンティン・モルダフスキー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 判定 0-3", round: "2R", time: null },
  { cardPosition: 7, fighterAName: "イリー・プロハースカ", fighterBName: "マーク・タニオス", winnerName: "イリー・プロハースカ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定 3-0", round: "3R", time: null },
  { cardPosition: 8, fighterAName: "才賀紀左衛門", fighterBName: "山本アーセン", winnerName: "山本アーセン", ruleType: "MMA", weightKg: 62.0, namedDivision: null, resultType: "decisive", methodRaw: "2R 判定 1-2", round: "2R", time: null },
  { cardPosition: 9, fighterAName: "アンディ・サワー", fighterBName: "ダロン・クルックシャンク", winnerName: "ダロン・クルックシャンク", ruleType: "MMA", weightKg: 71.0, namedDivision: null, resultType: "decisive", methodRaw: "1R 4'09\" リアネイキッドチョーク", round: "1R", time: "4'09\"" },
  { cardPosition: 10, fighterAName: "藤田和之", fighterBName: "バルト", winnerName: "バルト", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 判定 0-3", round: "2R", time: null },
  { cardPosition: 11, fighterAName: "ミョン・ヒョンマン", fighterBName: "ミルコ・クロコップ", winnerName: "ミルコ・クロコップ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2'20\" 肩固め", round: "1R", time: "2'20\"" },
  { cardPosition: 12, fighterAName: "山本美憂", fighterBName: "RENA", winnerName: "RENA", ruleType: "女子MMA", weightKg: 49.0, namedDivision: null, resultType: "decisive", methodRaw: "1R 4'50\" アームトライアングルチョーク", round: "1R", time: "4'50\"" },
  { cardPosition: 13, fighterAName: "所英男", fighterBName: "クロン・グレイシー", winnerName: "クロン・グレイシー", ruleType: "MMA", weightKg: 65.8, namedDivision: null, resultType: "decisive", methodRaw: "1R 9'44\" リアネイキッドチョーク", round: "1R", time: "9'44\"" },
];

export const RIZIN_2_SOURCE = {
  eventName: "RIZIN.2 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 開幕戦",
  date: "2016-09-25",
  sourceUrl: "https://jp.rizinff.com/_ct/16997624",
  fetchedDate: "2026-07-27",
};

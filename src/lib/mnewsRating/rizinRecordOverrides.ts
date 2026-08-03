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
  // "MIXルール"はSARABAの宴(2015-12-29)追加時に、rizinScraper.tsの
  // NON_MMA_RULE_TYPE_LABELSと同じ既存カテゴリとして追加した(新しい概念の
  // 導入ではない。2026-08-02)。
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "女子MMA" | "グラップリング" | "MIXルール";
  weightKg: number | null; // 無差別契約等は null
  namedDivision: string | null;
  resultType: "decisive" | "draw" | "nc" | "cancelled";
  methodRaw: string;
  round?: string | null; // ページに明記されている場合のみ設定(推測しない)。
  // RIZIN.1書き起こし時点では未設定のままmethodRawに含めていたが、RIZIN.2以降は
  // ページ側に明確な「NR」表記があるため分離する(RIZIN.1側の既存値は変更しない)。
  time?: string | null; // 同上。判定等、時間の記載が無い決着は null のまま(捏造しない)。
}

// SARABAの宴(2015-12-29)・IZAの舞(2015-12-31)はRIZIN旗揚げ興行(告知時の名称は
// 「RIZIN FIGHTING WORLD GRAND-PRIX 2015 さいたま3DAYS」。3日間興行として発表
// されたが初日(12/28)が中止となり、実施は2日間のみ)。「大会情報」タグには
// 正しく含まれる(PR #237の読み取り専用調査で確認済み)が、いずれのRIZIN_EVENT_INDEX
// エントリにもrizinRecordOverrides.tsにも一切含まれておらず、data/rizinRecords.json
// から丸ごと欠落していた(2026-08-02に追加)。
//
// SARABAの宴は2016年当時よりさらに古い最古期のテンプレート(<div id="match-list">
// ベース、<p class="match_info">「第N試合」形式)で、RIZIN.1/RIZIN.2と同型のため
// 手動書き起こしとする。
// 出典: https://jp.rizinff.com/_ct/16969713(SARABAの宴 試合結果一覧)
// 取得日: 2026-08-02
export const RIZIN_SARABA_BOUTS: RizinRawBoutManual[] = [
  { cardPosition: 1, fighterAName: "髙阪剛", fighterBName: "ジェームス・トンプソン", winnerName: "髙阪剛", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 1:58 レフェリーストップ" },
  { cardPosition: 2, fighterAName: "カルロス・トヨタ", fighterBName: "キリル・シデルニコフ", winnerName: "キリル・シデルニコフ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:23 TKO(レフェリーストップ)" },
  { cardPosition: 3, fighterAName: "元谷友貴", fighterBName: "フェリペ・エフライン", winnerName: null, ruleType: "MMA", weightKg: 56.7, namedDivision: null, resultType: "nc", methodRaw: "1R 5:46 ノーコンテスト" },
  { cardPosition: 4, fighterAName: "HIROYA", fighterBName: "西浦“ウィッキー”聡生", winnerName: "HIROYA", ruleType: "キックボクシング", weightKg: 65.0, namedDivision: null, resultType: "decisive", methodRaw: "3R 1:20 KO" },
  { cardPosition: 5, fighterAName: "宮田和幸", fighterBName: "日菜太", winnerName: "日菜太", ruleType: "MIXルール", weightKg: 70.0, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:14 TKO（3ダウン）" },
  { cardPosition: 6, fighterAName: "A.J.マシューズ", fighterBName: "アナトリー・トコフ", winnerName: "アナトリー・トコフ", ruleType: "MMA", weightKg: 84.0, namedDivision: null, resultType: "decisive", methodRaw: "1R 0:55 KO" },
  { cardPosition: 7, fighterAName: "所英男", fighterBName: "才賀紀左衛門", winnerName: "所英男", ruleType: "MMA", weightKg: 62, namedDivision: null, resultType: "decisive", methodRaw: "1R 5:16 アームバー" },
  { cardPosition: 8, fighterAName: "髙谷裕之", fighterBName: "DJ.taiki", winnerName: "髙谷裕之", ruleType: "MMA", weightKg: 65, namedDivision: null, resultType: "decisive", methodRaw: "3R判定 3-0" },
  { cardPosition: 9, fighterAName: "内田雄大", fighterBName: "ワレンティン・モルダフスキー", winnerName: "ワレンティン・モルダフスキー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:20 リアネイキッドチョーク" },
  { cardPosition: 10, fighterAName: "キング・モー", fighterBName: "ブレット・マクダーミット", winnerName: "キング・モー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:58 TKO" },
  { cardPosition: 11, fighterAName: "テオドラス・オークストリス", fighterBName: "ブルーノ・カッペローザ", winnerName: "テオドラス・オークストリス", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:58 TKO" },
  { cardPosition: 12, fighterAName: "ゴラン・レリッジ", fighterBName: "ワジム・ネムコフ", winnerName: "ワジム・ネムコフ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2:58 TKO" },
  { cardPosition: 13, fighterAName: "石井慧", fighterBName: "イリー・プロハースカ", winnerName: "イリー・プロハースカ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 1:36 KO" },
  { cardPosition: 14, fighterAName: "桜庭和志", fighterBName: "青木真也", winnerName: "青木真也", ruleType: "MMA", weightKg: 78, namedDivision: null, resultType: "decisive", methodRaw: "1R 5:56 TKO（セコンドのタオル投入）" },
];

export const RIZIN_SARABA_SOURCE = {
  eventName: "SARABAの宴",
  date: "2015-12-29",
  sourceUrl: "https://jp.rizinff.com/_ct/16969713",
  fetchedDate: "2026-08-02",
};

// IZAの舞(2015-12-31、さいたま3DAYS2日目)は2018年以降と同じ新テンプレート
// (<h2 class="article-heading">+<div class="raw-html">、フォーマットA)であり
// rizinScraper.tsの自動パーサーでも0件の失敗なく全13試合を解析できることを
// 実機確認済み(scripts/test-rizin-scraper.ts相当の検証)。ただし
// parseRuleInfo()には次の2件の既知の分類ギャップがあり、自動パイプラインを
// 通すとどちらも誤って"MMA"に分類されてしまう(NON_MMA_RULE_PATTERNSに
// 該当語が無いため):
// - 「K-1ルール」(武尊 vs ヤン・ミン): キックボクシング関連ルールだが
//   NON_MMA_RULE_PATTERNSの/キックボクシ|Kickboxing|ISKA/iに一致しない
// - 「SBルール」(曙太郎 vs ボブ・サップ、SB=シュートボクシングの略記): 同様に
//   /シュートボクシング/に一致しない
// この2件をmnewsレーティングのMMA戦績集計(computeFighterMmaRecord、
// MMA_RULE_TYPES==={"MMA"}のみ)に誤って算入させないため、SARABAの宴と
// 同様にこちらも手動書き起こしとする(rizinScraper.ts本体の分類ロジック修正は
// スコープ外。他の既存78大会への影響を避けるため)。女子MMA(RENA vs
// イリアーナ・ヴァレンティーノ、ギャビ・ガルシア vs レイディー・タパ)は
// RIZIN_1_BOUTS/RIZIN_2_BOUTSの既存慣例に合わせ"女子MMA"ラベルとする。
// 出典: https://jp.rizinff.com/_ct/16969509(IZAの舞 試合結果一覧)
// 取得日: 2026-08-02
export const RIZIN_IZA_BOUTS: RizinRawBoutManual[] = [
  { cardPosition: 1, fighterAName: "RENA", fighterBName: "イリアーナ・ヴァレンティーノ", winnerName: "RENA", ruleType: "女子MMA", weightKg: 51.0, namedDivision: null, resultType: "decisive", methodRaw: "2R 3分31秒 S（アームバー）" },
  { cardPosition: 2, fighterAName: "キング・モー", fighterBName: "テオドラス・オークストリス", winnerName: "キング・モー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 判定（5-0）" },
  { cardPosition: 3, fighterAName: "ワジム・ネムコフ", fighterBName: "イリー・プロハースカ", winnerName: "イリー・プロハースカ", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 10分 TKO（戦意喪失による）" },
  { cardPosition: 4, fighterAName: "長谷川賢", fighterBName: "ブレナン・ワード", winnerName: "ブレナン・ワード", ruleType: "MMA", weightKg: 81.0, namedDivision: null, resultType: "decisive", methodRaw: "2R 1分54秒 S（リアネイキッドチョーク）" },
  { cardPosition: 5, fighterAName: "キム・スーチョル", fighterBName: "マイケ・リニャーレス", winnerName: "キム・スーチョル", ruleType: "MMA", weightKg: 61.3, namedDivision: null, resultType: "decisive", methodRaw: "判定（3-0）" },
  { cardPosition: 6, fighterAName: "武尊", fighterBName: "ヤン・ミン", winnerName: "武尊", ruleType: "キックボクシング", weightKg: 57.0, namedDivision: null, resultType: "decisive", methodRaw: "2R 3分00秒 KO" },
  { cardPosition: 7, fighterAName: "ギャビ・ガルシア", fighterBName: "レイディー・タパ", winnerName: "ギャビ・ガルシア", ruleType: "女子MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 2分36秒 TKO（レフェリーストップ）" },
  { cardPosition: 8, fighterAName: "曙太郎", fighterBName: "ボブ・サップ", winnerName: "ボブ・サップ", ruleType: "シュートボクシング", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "2R 0分47秒 終了判定（3-0）" },
  { cardPosition: 9, fighterAName: "ピーター・アーツ", fighterBName: "バルト", winnerName: "バルト", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "3R 判定（3-0）" },
  { cardPosition: 10, fighterAName: "アンディ・サワー", fighterBName: "長島☆自演乙☆雄一郎", winnerName: "アンディ・サワー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 5分29秒 KO" },
  { cardPosition: 11, fighterAName: "クロン・グレイシー", fighterBName: "山本アーセン", winnerName: "クロン・グレイシー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 4分57秒 S（三角絞め）" },
  { cardPosition: 12, fighterAName: "エメリヤーエンコ・ヒョードル", fighterBName: "シング・心・ジャディブ", winnerName: "エメリヤーエンコ・ヒョードル", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 3分03秒 TKO（レフェリーストップ）" },
  { cardPosition: 13, fighterAName: "キング・モー", fighterBName: "イリー・プロハースカ", winnerName: "キング・モー", ruleType: "MMA", weightKg: null, namedDivision: null, resultType: "decisive", methodRaw: "1R 5分09秒 KO" },
];

export const RIZIN_IZA_SOURCE = {
  eventName: "IZAの舞",
  date: "2015-12-31",
  sourceUrl: "https://jp.rizinff.com/_ct/16969509",
  fetchedDate: "2026-08-02",
};

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

// 「試合中止」bout単位の補完(指示書①フォローアップ、2026-08-03に発見)。
//
// RIZIN公式サイトの中止試合には2パターンある。(1)通常の<div class="raw-html">
// 構造を保ったまま勝敗マーカーだけが欠け、見出しテキスト側に「※試合中止」が
// 含まれる形式(RIZIN.29「中村優作 vs. 北方大地」等)は、rizinScraper.tsの
// 通常パーサー+parseMethod()のheadingText判定で自動的にcancelled扱いできる。
// (2) 見出しに【試合中止】プレフィックスが付き、中身が<div class="raw-html">
// を一切持たない「お知らせ記事」構造(<div class="block-lbox">...)に丸ごと
// 置き換わる形式(RIZIN LANDMARK 12「ヴガール・ケラモフ vs. 松嶋こよみ」・
// RIZIN師走の超強者祭り「斎藤裕 vs. YA-MAN」)は、選手名リンクも勝敗マーカーも
// 存在しないため、rizinScraper.tsのどのフォーマットパーサー(A/B/C/D)でも
// 原理的にパース不可能(お知らせ記事構造を専用パーサーで追いかける案は、
// 記事本文の書式が大会ごとに揺れるため不採用)。
//
// この(2)のパターンは、コミット済みのdata/rizinRecords.jsonには手動で
// cardPosition小数値(前後の自動採番の間)を割り振って個別に格納済みだが、
// update-rizin-records.tsを素直に再実行すると再現されず消えてしまう
// (feedback_scraper_verification_traps.mdのLANDMARK15と同型の地雷)。
// お知らせ記事構造自体をパースしにいくのではなく、bout単位の確定値として
// ここに列挙し、update-rizin-records.ts側でイベント名をキーに自動抽出結果へ
// マージする(cardPosition降順で再結合するだけで、前後の自動採番には触れない)。
export interface RizinSupplementalBout {
  cardPosition: number; // 前後の自動採番bout(整数)の間に挿入する小数値
  headingText: string; // 公式サイトの見出しテキストそのまま(【試合中止】プレフィックスは除く)
  fighterAName: string;
  fighterBName: string;
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "女子MMA" | "グラップリング" | "MIXルール";
  weightKg: number | null;
  namedDivision: string | null;
  resultType: "decisive" | "draw" | "nc" | "cancelled";
  winnerName: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
}

// 出典: https://jp.rizinff.com/_ct/17800428(RIZIN LANDMARK 12 in KOBE 試合結果一覧)
// 「【試合中止】第12試合／ヴガール・ケラモフ vs. 松嶋こよみ」
// ケラモフがウィルス性胃腸炎でドクターストップとなり試合中止。
export const RIZIN_LANDMARK12_SUPPLEMENTAL_BOUTS: RizinSupplementalBout[] = [
  {
    cardPosition: 16.5,
    headingText: "第12試合／ヴガール・ケラモフ vs. 松嶋こよみ",
    fighterAName: "ヴガール・ケラモフ",
    fighterBName: "松嶋こよみ",
    ruleType: "MMA",
    weightKg: null,
    namedDivision: null,
    resultType: "cancelled",
    winnerName: null,
    round: null,
    time: null,
    methodRaw: "試合中止（ケラモフがウィルス性胃腸炎でドクターストップ）",
  },
];

// 出典: https://jp.rizinff.com/_ct/17813426(Yogibo presents RIZIN師走の超強者祭り 試合結果一覧)
// 「【試合中止】第9試合／斎藤裕 vs. YA-MAN」
// YA-MANが眼窩底骨折で欠場となり試合中止。
export const RIZIN_TOSHIKOSO_SUPPLEMENTAL_BOUTS: RizinSupplementalBout[] = [
  {
    cardPosition: 9.5,
    headingText: "第9試合／斎藤裕 vs. YA-MAN",
    fighterAName: "斎藤裕",
    fighterBName: "YA-MAN",
    ruleType: "MMA",
    weightKg: null,
    namedDivision: null,
    resultType: "cancelled",
    winnerName: null,
    round: null,
    time: null,
    methodRaw: "試合中止（YA-MANが眼窩底骨折で欠場）",
  },
];

// eventName(RIZIN_EVENT_INDEXのeventNameと完全一致)をキーに、update-rizin-records.ts側で
// 自動抽出結果へマージする。新しい中止試合(お知らせ記事構造)が発生した場合は
// ここへ追記していく(自動検出の仕組みは無い。運用上の既知の制約)。
export const RIZIN_SUPPLEMENTAL_BOUTS_BY_EVENT: Record<string, RizinSupplementalBout[]> = {
  "RIZIN LANDMARK 12 in KOBE": RIZIN_LANDMARK12_SUPPLEMENTAL_BOUTS,
  "Yogibo presents RIZIN師走の超強者祭り": RIZIN_TOSHIKOSO_SUPPLEMENTAL_BOUTS,
};

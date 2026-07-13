// RIZIN公式サイト(jp.rizinff.com)の「大会情報」ページIDと「試合結果一覧」
// ページIDの対応表。jp.rizinff.comの大会情報ページから結果ページへの内部リンクは
// 直近1大会分しか正しく機能せず(常に「最新大会」を指すサイドバー導線に化ける)、
// 動的にresultsPageIdを解決する手段がfetch()のみでは存在しなかったため、
// 2026-07-13に大会情報タグ(https://jp.rizinff.com/_tags/大会情報)の81件全件について
// WebSearch(site:jp.rizinff.com "<大会名> 試合結果一覧")でresultsPageIdを特定し、
// 各URLをWebFetchで開いて<title>が「<大会名> 試合結果一覧」であることを個別に
// 確認した上でこの表に確定した(捏造ゼロ・出典明示の原則に基づく、一度きりの
// 手動確定作業。スクレイパー本体は本表を参照してfetch()するだけで、実行のたびに
// 検索エンジンへ依存することはない)。
//
// RIZIN.1(2016-04-17)のみ「大会情報」タグの81件に含まれず(サイト側のタグ付け
// 漏れ)、個別にWebSearchでURLを特定した(results=16952376)。この1大会は
// 2016年当時の旧テンプレート(rizinScraper.tsの新テンプレート用パーサーでは
// パースできない構造)のため、rizinRecordOverrides.tsに全14試合を個別に
// 書き起こして格納する(このindexには含めない)。
//
// 今後新しい大会が開催されるたびに、この表へ1エントリずつ追記が必要になる
// (自動発見の仕組みは無い。運用上の既知の制約)。
export interface RizinEventIndexEntry {
  eventName: string; // 大会情報タグのタイトル表記そのまま
  date: string; // YYYY-MM-DD
  infoPageId: string; // 大会情報／チケットページ(参考。スクレイパーは使わない)
  resultsPageId: string; // 試合結果一覧ページ(スクレイパーが実際にfetchする対象)
  note?: string; // タイトル形式が通常と異なる等の特記事項
}

export const RIZIN_EVENT_INDEX: RizinEventIndexEntry[] = [
  { eventName: "RIZIN.2 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 開幕戦", date: "2016-09-25", infoPageId: "16978368", resultsPageId: "16997624" },
  { eventName: "RIZIN.3 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 2ND ROUND", date: "2016-12-29", infoPageId: "16978370", resultsPageId: "17026316" },
  { eventName: "RIZIN.4 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 FINAL ROUND", date: "2016-12-31", infoPageId: "16978371", resultsPageId: "17026860" },
  { eventName: "RIZIN.5 RIZIN 2017 in YOKOHAMA -SAKURA-", date: "2017-04-16", infoPageId: "17028393", resultsPageId: "17065978" },
  { eventName: "RIZIN.6 RIZIN FIGHTING WORLD GRAND-PRIX 2017 1st ROUND -夏の陣-", date: "2017-07-30", infoPageId: "17074243", resultsPageId: "17105213" },
  { eventName: "RIZIN.7 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメント1st ROUND -秋の陣-", date: "2017-10-15", infoPageId: "17095622", resultsPageId: "17125046" },
  { eventName: "RIZIN.8 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント2nd ROUND", date: "2017-12-29", infoPageId: "17369261", resultsPageId: "17369261", note: "大会情報／試合結果一覧が同一ページ(情報ページと結果ページが統合)" },
  { eventName: "RIZIN.9 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメントFinal ROUND", date: "2017-12-31", infoPageId: "17369262", resultsPageId: "17369262", note: "大会情報／試合結果一覧が同一ページ(情報ページと結果ページが統合)" },
  { eventName: "RIZIN.10", date: "2018-05-06", infoPageId: "17141092", resultsPageId: "17164316" },
  { eventName: "RIZIN.11", date: "2018-07-29", infoPageId: "17165159", resultsPageId: "17188889" },
  { eventName: "RWEDDINGS presents RIZIN.12", date: "2018-08-12", infoPageId: "17172176", resultsPageId: "17196408" },
  { eventName: "RIZIN.13", date: "2018-09-30", infoPageId: "17190942", resultsPageId: "17210031" },
  { eventName: "Cygames presents RIZIN.14", date: "2018-12-31", infoPageId: "17205387", resultsPageId: "17240378" },
  { eventName: "Cygames presents RIZIN 平成最後のやれんのか！", date: "2018-12-31", infoPageId: "17235581", resultsPageId: "17240269" },
  { eventName: "RIZIN.15", date: "2019-04-21", infoPageId: "17239891", resultsPageId: "17265699" },
  { eventName: "RIZIN.16", date: "2019-06-02", infoPageId: "17261216", resultsPageId: "17268641" },
  { eventName: "RIZIN.17", date: "2019-07-28", infoPageId: "17271516", resultsPageId: "17274221" },
  { eventName: "GOOD SPEED presents RIZIN.18", date: "2019-08-18", infoPageId: "17271802", resultsPageId: "17292041" },
  { eventName: "RIZIN.19", date: "2019-10-12", infoPageId: "17292708", resultsPageId: "17301435" },
  { eventName: "BELLATOR JAPAN", date: "2019-12-29", infoPageId: "17306896", resultsPageId: "17328412", note: "RIZIN主催ではなくBellator興行。RIZIN戦績への算入可否は取り込み側(update-rizin-records.ts)でイベント名フィルタにより判定する(このindexには生データとして残す)" },
  { eventName: "RIZIN.20", date: "2019-12-31", infoPageId: "17306880", resultsPageId: "17328443" },
  { eventName: "RIZIN.21", date: "2020-02-22", infoPageId: "17326540", resultsPageId: "17340654" },
  { eventName: "RIZIN.22 - STARTING OVER -", date: "2020-08-09", infoPageId: "17367330", resultsPageId: "17382986" },
  { eventName: "RIZIN.23 - CALLING OVER -", date: "2020-08-10", infoPageId: "17371252", resultsPageId: "17382996" },
  { eventName: "Yogibo presents RIZIN.24", date: "2020-09-27", infoPageId: "17385193", resultsPageId: "17395729" },
  { eventName: "Yogibo presents RIZIN.25", date: "2020-11-21", infoPageId: "17400048", resultsPageId: "17410665" },
  { eventName: "Yogibo presents RIZIN.26", date: "2020-12-31", infoPageId: "17408663", resultsPageId: "17421764" },
  { eventName: "Yogibo presents RIZIN.27", date: "2021-03-21", infoPageId: "17426000", resultsPageId: "17433429" },
  { eventName: "Yogibo presents RIZIN.28", date: "2021-06-13", infoPageId: "17440570", resultsPageId: "17459632" },
  { eventName: "Yogibo presents RIZIN.29", date: "2021-06-27", infoPageId: "17440571", resultsPageId: "17462946" },
  { eventName: "Yogibo presents RIZIN.30", date: "2021-09-19", infoPageId: "17465710", resultsPageId: "17481499" },
  { eventName: "+WEED presents RIZIN LANDMARK vol.1", date: "2021-10-02", infoPageId: "17475182", resultsPageId: "17485193" },
  { eventName: "Yogibo presents RIZIN.31", date: "2021-10-24", infoPageId: "17482686", resultsPageId: "17489769" },
  { eventName: "Yogibo presents RIZIN.32", date: "2021-11-20", infoPageId: "17486684", resultsPageId: "17497524" },
  { eventName: "RIZIN TRIGGER 1st", date: "2021-11-28", infoPageId: "17488002", resultsPageId: "17498791" },
  { eventName: "Yogibo presents RIZIN.33", date: "2021-12-31", infoPageId: "17498561", resultsPageId: "17508021" },
  { eventName: "SPASHAN HPS presents RIZIN TRIGGER 2nd", date: "2022-02-23", infoPageId: "17510666", resultsPageId: "17520846" },
  { eventName: "+WEED presents RIZIN LANDMARK vol.2", date: "2022-03-06", infoPageId: "17514776", resultsPageId: "17522386" },
  { eventName: "湘南美容クリニック presents RIZIN.34", date: "2022-03-20", infoPageId: "17514845", resultsPageId: "17525892" },
  { eventName: "SPASHAN presents RIZIN TRIGGER 3rd", date: "2022-04-16", infoPageId: "17522983", resultsPageId: "17534076" },
  { eventName: "湘南美容クリニック presents RIZIN.35", date: "2022-04-17", infoPageId: "17522979", resultsPageId: "17534237" },
  { eventName: "+WEED presents RIZIN LANDMARK vol.3", date: "2022-05-05", infoPageId: "17534202", resultsPageId: "17538454" },
  { eventName: "湘南美容クリニック presents RIZIN.36", date: "2022-07-02", infoPageId: "17538380", resultsPageId: "17552126" },
  { eventName: "湘南美容クリニック presents RIZIN.37", date: "2022-07-31", infoPageId: "17547861", resultsPageId: "17559478" },
  { eventName: "The Battle Cats presents 超RIZIN / 湘南美容クリニック presents RIZIN.38", date: "2022-09-25", infoPageId: "17561573", resultsPageId: "17573018" },
  { eventName: "湘南美容クリニック presents RIZIN.39", date: "2022-10-23", infoPageId: "17570012", resultsPageId: "17579359" },
  { eventName: "ANGEL CHAMPAGNE presents RIZIN LANDMARK 4 in NAGOYA", date: "2022-11-06", infoPageId: "17571805", resultsPageId: "17582838" },
  { eventName: "湘南美容クリニック presents RIZIN.40", date: "2022-12-31", infoPageId: "17579824", resultsPageId: "17597167" },
  { eventName: "RIZIN.41", date: "2023-04-01", infoPageId: "17600409", resultsPageId: "17618497" },
  { eventName: "FEDELTA presents RIZIN LANDMARK 5 in YOYOGI", date: "2023-04-29", infoPageId: "17603551", resultsPageId: "17625256" },
  { eventName: "RIZIN.42", date: "2023-05-06", infoPageId: "17603552", resultsPageId: "17626748" },
  { eventName: "RIZIN.43", date: "2023-06-24", infoPageId: "17618480", resultsPageId: "17637537" },
  { eventName: "のむシリカ presents 超RIZIN.2 powered by U-NEXT", date: "2023-07-30", infoPageId: "17630469", resultsPageId: "17645070", note: "<title>が「対戦カード 試合結果一覧」の複合表記(通常は結果一覧のみのタイトル)。WebFetchで本文が実際の勝敗・決着データを含むことを確認済み" },
  { eventName: "RIZIN.44", date: "2023-09-24", infoPageId: "17643814", resultsPageId: "17656548" },
  { eventName: "For Japan presents RIZIN LANDMARK 6 in NAGOYA", date: "2023-10-01", infoPageId: "17643815", resultsPageId: "17658629" },
  { eventName: "RIZIN LANDMARK 7 in Azerbaijan", date: "2023-11-04", infoPageId: "17647600", resultsPageId: "17664842" },
  { eventName: "にゃんこ大戦争 presents RIZIN.45", date: "2023-12-31", infoPageId: "17663189", resultsPageId: "17676735" },
  { eventName: "RIZIN LANDMARK 8 in SAGA", date: "2024-02-24", infoPageId: "17673870", resultsPageId: "17685725" },
  { eventName: "RIZIN LANDMARK 9 in KOBE", date: "2024-03-23", infoPageId: "17676773", resultsPageId: "17690948" },
  { eventName: "Yogibo presents RIZIN.46", date: "2024-04-29", infoPageId: "17676774", resultsPageId: "17697063" },
  { eventName: "Yogibo presents RIZIN.47", date: "2024-06-09", infoPageId: "17690928", resultsPageId: "17704393" },
  { eventName: "Yogibo presents 超RIZIN.3", date: "2024-07-28", infoPageId: "17689701", resultsPageId: "17713060" },
  { eventName: "Yogibo presents RIZIN.48", date: "2024-09-29", infoPageId: "17712361", resultsPageId: "17723239" },
  { eventName: "RIZIN LANDMARK 10 in NAGOYA", date: "2024-11-17", infoPageId: "17722340", resultsPageId: "17733287" },
  {
    eventName: "RIZIN DECADE / Yogibo presents RIZIN.49",
    date: "2024-12-31",
    infoPageId: "17729948",
    resultsPageId: "17741895",
    note:
      "2026-07-13訂正: 当初17741870を本戦の結果ページとして登録していたが、これは実際には" +
      "同日開催の別興行「雷神番外地」(アンダーカード、第1〜7試合)の結果ページであり、" +
      "RIZIN DECADE本戦(YA-MAN・武田光司ほか出場)の試合が1件も含まれていなかった" +
      "(WebSearch+WebFetchでのID特定時に、同じ「RIZIN DECADE」ブランドを冠する2つの" +
      "別々の結果ページを取り違えていた)。正しい本戦結果ページは17741895" +
      "(<title>「RIZIN DECADE / Yogibo presents RIZIN.49 試合結果一覧」)。",
  },
  {
    eventName: "RIZIN DECADE 雷神番外地",
    date: "2024-12-31",
    infoPageId: "17729948",
    resultsPageId: "17741870",
    note:
      "RIZIN DECADE本戦と同日開催の別カード(アンダーカード、第1〜7試合)。上記の訂正で" +
      "本戦の結果ページ(17741895)を別エントリとして追加したため、こちらは本戦とは別の" +
      "実在データとしてそのまま残す(捏造ゼロの原則により、実際に存在する試合結果は保持する)。",
  },
  { eventName: "RIZIN.50", date: "2025-03-30", infoPageId: "17744266", resultsPageId: "17757793" },
  { eventName: "RIZIN男祭り", date: "2025-05-04", infoPageId: "17751941", resultsPageId: "17764390" },
  { eventName: "RIZIN WORLD SERIES in KOREA", date: "2025-05-31", infoPageId: "17760601", resultsPageId: "17769437" },
  { eventName: "RIZIN LANDMARK 11 in SAPPORO", date: "2025-06-14", infoPageId: "17760081", resultsPageId: "17772202" },
  { eventName: "超RIZIN.4 真夏の喧嘩祭り", date: "2025-07-27", infoPageId: "17770448", resultsPageId: "17780689" },
  { eventName: "RIZIN.51", date: "2025-09-28", infoPageId: "17772171", resultsPageId: "17793158" },
  { eventName: "RIZIN LANDMARK 12 in KOBE", date: "2025-11-03", infoPageId: "17780688", resultsPageId: "17800428" },
  { eventName: "Yogibo presents RIZIN師走の超強者祭り", date: "2025-12-31", infoPageId: "17799885", resultsPageId: "17813426" },
  { eventName: "RIZIN.52", date: "2026-03-07", infoPageId: "17813445", resultsPageId: "17825885" },
  { eventName: "大和開発 presents RIZIN LANDMARK 13 in FUKUOKA", date: "2026-04-12", infoPageId: "17813447", resultsPageId: "17833713" },
  { eventName: "RIZIN.53", date: "2026-05-10", infoPageId: "17821353", resultsPageId: "17838643" },
  { eventName: "RIZIN LANDMARK 14 in SENDAI", date: "2026-06-06", infoPageId: "17825993", resultsPageId: "17843850" },
];

# /fighters対戦テーブル → /results 誤リンク監査

- 検査対象bout: 4849件(大会名ユニーク 2664件)
- リンクが張られるbout: 旧 697件 → 新 577件
- 判定が変わったbout: 120件
  - **A. 誤リンクの除去: 38件**(別大会を指していた)
  - **B. 巻き添えで落ちたリンク: 1件**(大会名は正しく一致。上流データの試合日が誤っている)
  - **C. unlisted大会へのリンク除去: 81件**(方針としてリンクを張らない)

## A. 誤リンクの除去

| 表示される大会名 | 旧リンク先(誤) | 新リンク先 | 影響bout数 |
|---|---|---|---|
| DEEP HAMAMATSU IMPACT | deep-hamamatsu-impact-2026-1st-round (2026-05-31 DEEP HAMAMATSU IMPACT 2026 1st ROUND) | リンク無し | 2 |
| DEEP JEWELS 4 | deep-jewels-48 (2025-03-23 DEEP JEWELS 48) | リンク無し | 2 |
| DEEP JEWELS 5 | deep-jewels-52 (2026-02-23 DEEP JEWELS 52) | リンク無し | 1 |
| DEEP NAGOYA IMPACT | deep-nagoya-impact-2026-2nd-round (2026-06-14 DEEP NAGOYA IMPACT 2026 2nd ROUND公武堂ファイト) | リンク無し | 1 |
| DEEP OSAKA IMPACT | deep-osaka-impact-2026-3rd-round (2026-06-21 DEEP OSAKA IMPACT 2026 3rd ROUND) | リンク無し | 4 |
| DEEP TOKYO IMPACT | deep-tokyo-impact-2026-1st-round (2026-02-23 DEEP TOKYO IMPACT 2026 1st ROUND) | リンク無し | 2 |
| PANCRASE BLOOD.1 | pancrase-blood-11 (2026-07-26 PANCRASE BLOOD.11) | リンク無し | 2 |
| プロフェッショナル修斗 | shooto-pound-out-2026 (2026-08-02 プロフェッショナル修斗公式戦『Lemino修斗~POUND OUT~』) | リンク無し | 6 |
| プロフェッショナル修斗公式戦 | shooto-pound-out-2026 (2026-08-02 プロフェッショナル修斗公式戦『Lemino修斗~POUND OUT~』) | リンク無し | 18 |

### DEEP HAMAMATSU IMPACT
- koike-kleber / 2009-09-27 / vs 藤井嵩士
- koike-kleber / 2014-09-14 / vs 別府セブン

### DEEP JEWELS 4
- ayaka-miura / 2014-05-18 / vs エラ・ウー
- sarami / 2014-05-18 / vs 石岡沙織

### DEEP JEWELS 5
- kurobe-mina / 2014-08-09 / vs 吉田正子

### DEEP NAGOYA IMPACT
- kubota-taito / 2016-10-02 / vs 石田勝也

### DEEP OSAKA IMPACT
- koike-kleber / 2009-08-30 / vs 前田吉朗
- nakamura-yusaku / 2011-09-04 / vs 赤尾セイジ
- shinryu-makoto / 2017-12-24 / vs 獅庵
- shirakawa-rikuto / 2019-04-28 / vs 釜谷真

### DEEP TOKYO IMPACT
- ashida-takahiro / 2011-02-27 / vs 有村脩也
- sugiyama / 2013-07-20 / vs 米沢知佐

### PANCRASE BLOOD.1
- miyake-kisa / 2024-02-18 / vs 名田英平
- nada / 2024-02-18 / vs 三宅輝砂

### プロフェッショナル修斗
- saito-yutaka / 2011-11-27 / vs 佐々木郁矢
- saito-yutaka / 2013-02-23 / vs 河野啓太
- saito-yutaka / 2013-06-08 / vs 鷹島大樹
- saito-yutaka / 2013-09-22 / vs 独眼竜刺牙
- saito-yutaka / 2013-11-09 / vs 村津孝徳
- minowa-hiroba / 2018-03-25 / vs 新井丈

### プロフェッショナル修斗公式戦
- yamagami-mikihito / 2010-11-19 / vs 室伏シンヤ
- uoi-fullswing / 2015-12-20 / vs 金物屋の秀
- uoi-fullswing / 2016-02-27 / vs 山田丑伍郎
- uoi-fullswing / 2016-03-27 / vs 玉城優介
- uoi-fullswing / 2016-05-28 / vs 松下祐介
- uoi-fullswing / 2016-07-03 / vs 服部賢大
- uoi-fullswing / 2017-03-24 / vs 小蒼卓也
- uoi-fullswing / 2017-05-12 / vs 加藤惇
- uoi-fullswing / 2017-10-15 / vs 論田愛空隆
- tyson-nobumitsu / 2017-10-15 / vs 松本光史
- uoi-fullswing / 2018-05-13 / vs 根津優太
- uoi-fullswing / 2018-09-23 / vs 土屋大喜
- uoi-fullswing / 2019-01-27 / vs 藤井伸樹
- uoi-fullswing / 2019-05-06 / vs 加藤ケンジ
- uoi-fullswing / 2019-09-22 / vs 田丸匠
- uoi-fullswing / 2020-01-26 / vs 手塚基伸
- sugimoto-megumi / 2020-11-23 / vs SARAMI
- uoi-fullswing / 2021-03-20 / vs 後藤丈治

## B. 巻き添えで落ちたリンク(上流データの日付誤り候補)

旧実装のリンク先は**正しい大会**だったが、bout側の試合日が結果ページの開催日と
ずれているため日付ガードに引っかかり、リンクが消えたもの。リンクの消失としては
回帰であり、同時に上流(Wikipedia等)の日付誤りの検出結果でもある。
`npm run check:event-slug-links` が毎回この件数を報告する。

| 選手 | bout日付 | 表示される大会名 | 正しいリンク先(開催日) |
|---|---|---|---|
| uchida-takeru | 2026-02-28 | Lemino修斗.3 | lemino-shooto-3 (2026-02-18 Lemino修斗.3) |

## C. unlisted(非公開)大会へのリンク除去

`unlisted: true` の大会は /results 一覧・sitemapから除外され個別ページもnoindexである。
選手ページの対戦テーブルからも同様にリンクを張らない(個別ページ自体は200のまま残るため、
直リンクでは引き続き閲覧できる=情報は失われない)。判定は eventResults.ts の
`isListedEvent()` に集約し、呼び出し側で条件式を書き直さない。

| リンクを外した大会 | 開催日 | 表示される大会名 | bout数 |
|---|---|---|---|
| rizin-2023-0924-nakajima-okada (RIZIN.44) | 2023-09-24 | RIZIN.44 | 11 |
| rizin-35 (RIZIN.35) | 2022-04-17 | RIZIN.35 【RIZINフェザー級タイトルマッチ】 | 2 |
| rizin-35 (RIZIN.35) | 2022-04-17 | RIZIN.35 【RIZINライト級タイトルマッチ】 | 2 |
| rizin-35 (RIZIN.35) | 2022-04-17 | RIZIN.35 【RIZIN女子スーパーアトム級タイトルマッチ】 | 1 |
| rizin-35 (RIZIN.35) | 2022-04-17 | RIZIN.35 | 8 |
| rizin-46 (RIZIN.46 【日韓対抗戦】) | 2024-04-29 | RIZIN.46 【日韓対抗戦】 | 5 |
| rizin-46 (RIZIN.46 【日韓対抗戦】) | 2024-04-29 | RIZIN.46 | 7 |
| rizin-48 (RIZIN.48) | 2024-09-29 | RIZIN.48 【RIZINバンタム級王座決定戦】 | 2 |
| rizin-48 (RIZIN.48) | 2024-09-29 | RIZIN.48 【RIZINライト級タイトルマッチ】 | 2 |
| rizin-48 (RIZIN.48) | 2024-09-29 | RIZIN.48 | 16 |
| rizin-49 (RIZIN.49) | 2024-12-31 | RIZIN.49 【RIZINフェザー級タイトルマッチ】 | 2 |
| rizin-49 (RIZIN.49) | 2024-12-31 | RIZIN.49 【RIZINフライ級タイトルマッチ】 | 2 |
| rizin-49 (RIZIN.49) | 2024-12-31 | RIZIN.49 【RIZINライト級タイトルマッチ】 | 2 |
| rizin-49 (RIZIN.49) | 2024-12-31 | RIZIN.49 | 19 |

合計 81bout

リンクが残っているunlisted大会: **0bout**(0でなければゲートが落ちる)

## 参考: 部分一致でリンクしている大会名(alias表の中身)

正規化後に完全一致しないリンク: 199bout / 大会名76件。
件数が多く(85件)、新規大会ごとに【階級タイトルマッチ】等の派生表記が増え続けるため、
部分一致そのものを捨ててalias表だけで運用することはできない。代わりに
`scripts/event-slug-alias-baseline.json` にレビュー済みの対応表として固定し、
表に無い部分一致が新たに出たらビルドを落とす(check-event-slug-links.ts)。

| 表示される大会名 | リンク先 | bout数 |
|---|---|---|
| RIZIN LANDMARK 12 | rizin-landmark-12 | 18 |
| RIZIN LANDMARK 15 | rizin-landmark-15 | 16 |
| RIZIN LANDMARK 11 | rizin-landmark-11 | 16 |
| 超RIZIN.4 真夏の喧嘩祭り 【RIZINフライ級ワールドグランプリ1回戦】 | super-rizin-4 | 10 |
| 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | shooto-2026-vol1 | 8 |
| 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | shooto-2025-vol3 | 6 |
| DEEP 124 IMPACT 【DEEPフェザー級グランプリ1回戦】 | deep-124-impact | 5 |
| 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | shooto-2025-vol8 | 5 |
| 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | shooto-2026-vol3 | 5 |
| RIZIN.51 【RIZINフライ級ワールドグランプリ準決勝】 | rizin-51 | 4 |
| 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | shooto-2025-vol7 | 4 |
| RIZIN男祭り 【RIZINヘビー級WORLDグランプリ1回戦】 | rizin-otoko-matsuri-2025 | 3 |
| DEEP 125 IMPACT 【DEEPフェザー級グランプリ準決勝】 | deep-125-impact | 3 |
| プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | lemino-shooto-6 | 3 |
| RIZIN 師走の超強者祭り 【RIZINフェザー級タイトルマッチ】 | rizin-shiwasu-2025 | 2 |
| RIZIN男祭り 【RIZINフェザー級タイトルマッチ】 | rizin-otoko-matsuri-2025 | 2 |
| RIZIN 師走の超強者祭り 【RIZINバンタム級タイトルマッチ】 | rizin-shiwasu-2025 | 2 |
| 超RIZIN.4 真夏の喧嘩祭り 【RIZINバンタム級タイトルマッチ】 | super-rizin-4 | 2 |
| RIZIN.50 【RIZINバンタム級タイトルマッチ】 | rizin-50 | 2 |
| RIZIN 師走の超強者祭り 【RIZIN女子スーパーアトム級タイトルマッチ】 | rizin-shiwasu-2025 | 2 |
| RIZIN LANDMARK 14 【RIZINフライ級タイトルマッチ】 | rizin-landmark-14 | 2 |
| RIZIN 師走の超強者祭り 【RIZINフライ級王座決定戦/RIZINフライ級ワールドグランプリ決勝】 | rizin-shiwasu-2025 | 2 |
| DEEP 125 IMPACT 【DEEPバンタム級タイトルマッチ】 | deep-125-impact | 2 |
| DEEP 131 IMPACT 【DEEPバンタム級暫定王者決定戦】 | deep-131-impact | 2 |
| RIZIN LANDMARK 13 【RIZINバンタム級タイトルマッチ】 | rizin-landmark-13 | 2 |
| RIZIN.51 【RIZINフライ級ワールドグランプリ・リザーブマッチ】 | rizin-51 | 2 |
| RIZIN.51 【RIZINライト級タイトルマッチ】 | rizin-51 | 2 |
| RIZIN 師走の超強者祭り 【RIZINライト級タイトルマッチ】 | rizin-shiwasu-2025 | 2 |
| RIZIN LANDMARK 13 【RIZINフェザー級タイトルマッチ】 | rizin-landmark-13 | 2 |
| 超RIZIN.4 真夏の喧嘩祭り 【RIZINヘビー級WORLDグランプリ準決勝】 | super-rizin-4 | 2 |
| DEEP 131 IMPACT 【DEEPフェザー級暫定王者決定戦】 | deep-131-impact | 2 |
| DEEP 129 IMPACT 【DEEPフェザー級タイトルマッチ】 | deep-129-impact | 2 |
| DEEP 131 IMPACT 【DEEPライト級暫定タイトルマッチ】 | deep-131-impact | 2 |
| DEEP 130 IMPACT 【DEEPライト級タイトルマッチ】 | deep-130-impact | 2 |
| DEEP 128 IMPACT 【DEEPライト級暫定王座決定戦】 | deep-128-impact | 2 |
| DEEP 130 IMPACT 【DEEPウェルター級タイトルマッチ】 | deep-130-impact | 2 |
| DEEP 131 IMPACT 【DEEPフライ級タイトルマッチ】 | deep-131-impact | 2 |
| DEEP 126 IMPACT 【DEEPフライ級王座決定戦】 | deep-126-impact | 2 |
| DEEP JEWELS 50 【DEEP JEWELSストロー級タイトルマッチ】 | deep-jewels-50 | 2 |
| PANCRASE 353 【ライト級キング・オブ・パンクラスタイトルマッチ】 | pancrase-353 | 2 |
| RIZIN.53 【RIZINライト級タイトルマッチ】 | rizin-53 | 2 |
| RIZIN.51 【RIZINフェザー級タイトルマッチ】 | rizin-51 | 2 |
| PANCRASE 355 【フライ級キング・オブ・パンクラス王者決定戦】 | pancrase-355 | 2 |
| プロフェッショナル修斗公式戦福岡大会「Lemino修斗TORAO」 | shooto-torao-2026 | 2 |
| 【第2部】PROFESSIONAL SHOOTO 2025 Vol.4 | shooto-2025-vol4 | 2 |
| DEEP 126 IMPACT 【DEEPフェザー級グランプリ決勝】 | deep-126-impact | 1 |
| DEEP 126 IMPACT 【DEEPメガトン級王座決定戦】 | deep-126-impact | 1 |
| DEEP 131 IMPACT 【DEEPストロー級タイトルマッチ】 | deep-131-impact | 1 |
| DEEP 131 IMPACT 25th Anniversary | deep-131-impact | 1 |
| DEEP 125 IMPACT 【DEEPウェルター級タイトルマッチ】 | deep-125-impact | 1 |
| DEEP JEWELS 52 【DEEP JEWELS バンタム級王座決定戦】 | deep-jewels-52 | 1 |
| DEEP JEWELS 53 【DEEP JEWELSフライ級タイトルマッチ】 | deep-jewels-53 | 1 |
| PROFESSIONAL SHOOTO 2025 Vol.9【インフィニティリーグ2025】 | shooto-2025-vol9 | 1 |
| PROFESSIONAL SHOOTO 2025 Vol.6【インフィニティリーグ2025】 | shooto-2025-vol6 | 1 |
| 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3【インフィニティリーグ2025】 | shooto-2025-vol3 | 1 |
| 修斗 PROFESSIONAL SHOOTO 2025 Vol.9 【修斗世界フライ級チャンピオンシップ】 | shooto-2025-vol9 | 1 |
| 修斗 BORDER2025「The 1st」 | shooto-border-2025-1st | 1 |
| L Lemino修斗TORAO【サイバートーナメント リバイバル2026 準決勝】 | shooto-torao-2026 | 1 |
| Lemino修斗.3 【サイバートーナメント リバイバル2026 1回戦】 | lemino-shooto-3 | 1 |
| PROFESSIONAL SHOOTO 2025 Vol.2 【修斗世界フェザー級チャンピオンシップ】 | shooto-2025-vol2 | 1 |
| PANCRASE 360 【ウェルター級キング・オブ・パンクラス・チャンピオンシップ】 | pancrase-360 | 1 |
| PANCRASE 361 【ライト級キング・オブ・パンクラスタイトルマッチ】 | pancrase-361 | 1 |
| PANCRASE 360 【フェザー級キング・オブ・パンクラス王者決定戦】 | pancrase-360 | 1 |
| PANCRASE 362 【バンタム級キング・オブ・パンクラス暫定王座決定戦】 | pancrase-362 | 1 |
| RIZIN.51 【RIZINヘビー級WORLDグランプリ決勝】 | rizin-51 | 1 |
| PANCRASE 354 【フェザー級キング・オブ・パンクラスタイトルマッチ】 | pancrase-354 | 1 |
| PANCRASE 358 【フライ級キング・オブ・パンクラス王者決定戦】 | pancrase-358 | 1 |
| プロフェッショナル修斗TORAO37 | shooto-torao-37 | 1 |
| 修斗 PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | shooto-2025-vol10-osaka | 1 |
| 株式会社大熊警備隊presentsプロフェッショナル修斗公式戦山口大会「TORAO37」 | shooto-torao-37 | 1 |
| PROFESSIONAL SHOOTO 2026 Vol.2 【修斗世界ミドル級チャンピオン決定トーナメント 1st ROUND】 | shooto-2026-vol2 | 1 |
| PROFESSIONAL SHOOTO 2026 Vol.2 【修斗世界女子アトム級王座決定戦】 | shooto-2026-vol2 | 1 |
| PANCRASE 360 【ストロー級クイーン・オブ・パンクラス・チャンピオンシップ】 | pancrase-360 | 1 |
| 【第2部】PROFESSIONAL SHOOTO 2026 Vol.3 | shooto-2026-vol3 | 1 |
| PANCRASE 361 【フライ級クィーン・オブ・パンクラス・チャンピオンシップ】 | pancrase-361 | 1 |
| PANCRASE 352 【フライ級クィーン・オブ・パンクラス・チャンピオンシップ】 | pancrase-352 | 1 |

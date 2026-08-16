# 立ち技名鑑(/kick) 全件品質検査レポート

実施日: 2026-08-16
対象ブランチ: `investigate/kick-full-qa-audit`(main分岐、PR #530は着手claim用のdraft。**修正なし・マージなし**)
対象データ: `data/kick/` 配下全データ(選手名簿3,315人、生bout 27,971件)

## 0. 実施方法

- `data/kick/*.json`(生データ)を直接見るのではなく、`npm run kick:data`(`scripts/build-kick-data.ts`)を実行して
  `data/kick/generated/`(実際に `/kick` ページが読む形式。重複統合・スラッグ解決・勝敗集計済み)を生成し、
  これを主対象として検査した。理由: ユーザーが実際に目にするのはgenerated側であり、生データ側だけを見ると
  重複統合やslug解決の結果として生まれる不整合(D・Eなど)を検出できないため。
- 検査A〜Hはfsベースのスクリプトで全3,315人×全bout(統合後26,167件)を走査。検査Iのみローカルdevサーバー
  (`localhost:3591`)+ブラウザで実機再現した。
- **修正は一切行っていない。** `data/kick/*.json`・`src/`・`scripts/`のいずれにも変更を加えていない。

## 1. 受入条件(5事例)の検出確認

着手前に提示された5つの実例について、各検査が正しく検出できるかを個別に確認した。全件検出できた
(検出できない場合は検査条件を先に修正する方針だったため、以下は調整後の最終状態)。

| # | 実例 | 担当検査 | 検出結果 |
| --- | --- | --- | --- |
| 1 | 安保瑠輝也 × マニー・パッキャオ(2024-07-28、超RIZIN.3) | A | 検出(`methodRaw`="3分3R終了 判定なし" に「判定なし」) |
| 2 | 安保瑠輝也 × 久保優太(RIZIN.45、2023-12-31) | A | 検出(`methodRaw`="1R 4:28 リアネイキッドチョーク" に「チョーク」) |
| 3 | 安保瑠輝也の相手欄「海人同名2人・特定不可」(2015-10-03) | B | 検出(`opponentAmbiguous:true`から合成される表示バッジ文言) |
| 4 | 安保璃紅のHoostCup 2015-03-01 | C | 検出(`methodRaw`に【1R】が2回出現するセル結合の兆候、C2) |
| 5 | kaito-2 と kaito-3 | D | 検出(所属表記は不一致だが、同一相手×近接日付のbout共有で一致) |
| 6 | 安保瑠輝也と海人の2015-10-03 | E | 検出(kaito-2側は安保へ解決済み、安保側は「海人」が同名2人でunresolved) |
| 7 | 与座優貴(10勝0敗0分) | F | 検出(`record`={wins:10, losses:0, draws:0, total:10}) |

## 2. 検査結果サマリ

| 検査 | 内容 | 該当件数 |
| --- | --- | --- |
| A | ルール混入(決着欄に寝技語彙・判定なし等) | **91件** |
| B | 内部ラベルの露出(相手欄の「同名N人・特定不可」バッジ) | **145件** |
| C1 | 決着欄の中身が空の【】 | **0件** |
| C2 | 決着欄が異常に長い/【】セグメントが複数(セル結合の兆候) | **24件** |
| C3 | 相手名に所属らしき文字列が連結(候補、要目視判定) | **306件** |
| D | 名簿の分裂(同一人物が複数slugに分かれている候補) | **1組** |
| E | 逆引き未解決(相手側は解決済みだが自分側は未解決) | **121件** |
| F | 勝敗の偏り(3試合以上で敗0または勝0) | **177件**(敗0: 73件 / 勝0: 104件) |
| G(狭義) | `sourceType`フィールド自体の不整合(真のバグ) | **0件** |
| G(広義) | 出典リンク先がWikipediaなのに表示ラベルが「◯◯公式」(設計上の挙動、全件が該当) | **5,268件**(全Wikipedia由来bout) |
| H | 「収録N試合」とmeta description/戦績表行数が不一致 | **234件** |
| I | `/kick/fighters`絞り込みUIの挙動 | 2件の挙動を実機で再現(下記§11) |

---

## 3. 検査A: ルール混入

決着欄(`methodRaw`)に寝技語彙(腕ひしぎ／チョーク／パウンド／グラウンド／三角／一本)、または
「判定なし」「勝敗なし」「エキシビション」(表記ゆれ「エキシビジョン」も含めて検索)「ボクシング」を
含むboutを全走査で抽出。**91件。**

検出語の内訳: [["一本",20],["腕ひしぎ",11],["パウンド",19],["グラウンド",2],["チョーク",26],["判定なし",11],["三角",3],["エキシビション",3],["勝敗なし",1]]

出典別内訳: sourceType=wikipedia経由 53件 / 公式ソース経由(sourceType=null) 38件。
**公式ソース側にも混入があり、Wikipedia由来に限った問題ではない**(例: RISE公式`https://rise-rc.com/fighter/petru-morari/`の
"3R 三角絞め"、NKB公式`https://nkb-r.com/`の"エキシビションマッのため勝敗なし")。

該当行全件:

| 選手slug | 選手名 | 日付 | 大会名 | 団体 | 相手 | 決着(methodRaw) | 検出語 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aito | 愛翔 | 2020-11-23 | BOUT 41 | RISE | 池田一歩 | 2R フロントチョーク | チョーク | https://rise-rc.com/fighter/aito/ |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 樫村公治 | 1R 一本勝ち | 一本 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 栗原勇樹 | 1R 合わせ一本 | 一本 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| amada-hiromi | 天田ヒロミ | 2015-04-18 | SHOOT BOXING 2015 act.2 | SHOOT BOXING | 南国超人 | 3R 1:50 フロントチョーク | チョーク | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F |
| andi-sawa | アンディ・サワー | 2016-09-25 | RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント | SHOOT BOXING | ダロン・クルックシャンク | 1R チョークスリーパー ※MMA | チョーク | https://shootboxing.org/fighter/andy_sower/ |
| andi-sawa | アンディ・サワー | 2016-12-29 | RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント 2nd ROUND | SHOOT BOXING | 宮田 和幸 | 1R 腕ひしぎ十字固め ※MMA | 腕ひしぎ | https://shootboxing.org/fighter/andy_sower/ |
| anpo-rukiya | 安保瑠輝也 | 2020-12-23 | K-1 DX『安保瑠輝也、誰とでも戦います。』 | K-1 / Krush / Krush-EX | 涼真&渋谷春 | 2分2R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E5%AE%89%E4%BF%9D%E7%91%A0%E8%BC%9D%E4%B9%9F |
| anpo-rukiya | 安保瑠輝也 | 2023-12-31 | RIZIN.45 | RIZIN | 久保優太 | 1R 4:28 リアネイキッドチョーク | チョーク | https://ja.wikipedia.org/wiki/%E5%AE%89%E4%BF%9D%E7%91%A0%E8%BC%9D%E4%B9%9F |
| anpo-rukiya | 安保瑠輝也 | 2024-07-28 | 超RIZIN.3 | RIZIN | マニー・パッキャオ | 3分3R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E5%AE%89%E4%BF%9D%E7%91%A0%E8%BC%9D%E4%B9%9F |
| ashizawa-ryuusei | 芦澤竜誠 | 2023-12-31 | RIZIN.45 | RIZIN | 太田忍 | 1R 2:21 KO（グラウンドパンチ） | グラウンド | https://ja.wikipedia.org/wiki/%E8%8A%A6%E6%BE%A4%E7%AB%9C%E8%AA%A0 |
| ashizawa-ryuusei | 芦澤竜誠 | 2024-12-31 | RIZIN.49 | RIZIN | 福田龍彌 | 1R 0:54 KO（左フック→パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E8%8A%A6%E6%BE%A4%E7%AB%9C%E8%AA%A0 |
| ashizawa-ryuusei | 芦澤竜誠 | 2025-12-31 | RIZIN 師走の超強者祭り | RIZIN | ジョリー | 1R 0:25 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E8%8A%A6%E6%BE%A4%E7%AB%9C%E8%AA%A0 |
| bobu-sapu | ボブ・サップ | 2012-02-11 | ONE FC 2: Battle of Heroes | ONE Championship | ホーレス・グレイシー | 1R 1:18 ギブアップ（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%83%9C%E3%83%96%E3%83%BB%E3%82%B5%E3%83%83%E3%83%97 |
| chie-honman | チェ・ホンマン | 2006-12-31 | K-1 PREMIUM 2006 Dynamite!! | K-1 / Krush / Krush-EX | ボビー・オロゴン | 1R 0:16 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%83%81%E3%82%A7%E3%83%BB%E3%83%9B%E3%83%B3%E3%83%9E%E3%83%B3 |
| doi-hiroyuki | 土井広之 | 2005-04-29 | SHOOT BOXING 2005 20th ANNIVERSARY SERIES 2nd "STAND UP!" | SHOOT BOXING | トビー・グレアー | 4R 0:21 スタンディング・チョークスリーパー | チョーク | https://ja.wikipedia.org/wiki/%E5%9C%9F%E4%BA%95%E5%BA%83%E4%B9%8B |
| fujimoto-arata | 藤本新 | 2018-10-20 | KROSS×OVER 4 | KROSS×OVER | 山市 雄太 | 1R34秒TKO ※パウンド | パウンド | https://krossover.jp/?p=218 |
| fujimoto-arata | 藤本新 | 2019-07-07 | KROSS×OVER 6 | KROSS×OVER | 森田 啓佑 | 1R1分15秒 一本 ※アンクルホールド | 一本 | https://krossover.jp/?p=212 |
| fujimoto-arata | 藤本新 | 2022-12-18 | KROSS×OVER 20 ５周年記念-BATTLE OF THE NEW ERA- | KROSS×OVER | 井上 悠司 | 2R 0’18” KO ※右フック→パウンド | パウンド | https://krossover.jp/?p=677 |
| furansowa-za-howaitobafaro-bota | フランソワ・"ザ・ホワイトバッファロー"・ボタ | 2004-12-31 | K-1 PREMIUM 2004 Dynamite!! | K-1 / Krush / Krush-EX | 秋山成勲 | 1R 1:54 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E3%83%95%E3%83%A9%E3%83%B3%E3%82%BD%E3%83%AF%E3%83%BB%E3%83%9C%E3%82%BF |
| geri-gudoriji | ゲーリー・グッドリッジ | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | ヤン・"ザ・ジャイアント"・ノルキヤ | 1R 1:11 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E3%82%B2%E3%83%BC%E3%83%AA%E3%83%BC%E3%83%BB%E3%82%B0%E3%83%83%E3%83%89%E3%83%AA%E3%83%83%E3%82%B8 |
| gin-grapplingshootboxersgym | 銀・グラップリングシュートボクサーズジム | 2023-10-01 | RIZIN LANDMARK 6 in NAGOYA | SHOOT BOXING | 太田 将吾 | 一本 1R ※MMA | 一本 | https://shootboxing.org/fighter/gin_grapplingshootboxersgym/ |
| hata-fumiya | 秦 文也 | 2022-04-24 | 喝釆シリーズvol.2 | NKB | ハリィ永田 | エキシビションマッチの為勝敗無し | エキシビション | https://nkb-r.com/main/2022/04/24/20220423/ |
| hinata | 日菜太 | 2010-09-18 | SHOOT BOXING 25TH ANNIVERSARY SERIES 第4戦 維新-ISHIN- 其の四 | SHOOT BOXING | アンディ・サワー | 1R 0:48 KO（スタンディングチョークスリーパー） | チョーク | https://ja.wikipedia.org/wiki/%E6%97%A5%E8%8F%9C%E5%A4%AA |
| hiroki-kasahara | 笠原弘希 | 2023-09-24 | SHOOT BOXING 2023 act.4 | SHOOT BOXING | ネイサン・ドライデン | KO 2R ※フロントチョーク ※OFGマッチ | チョーク | https://shootboxing.org/fighter/kasahara_hiroki/ |
| hiroya | HIROYA | 2020-12-31 | RIZIN.26 | RIZIN | シバター | 2R 0:38 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/HIROYA |
| iriana-varentino | イリアーナ・ヴァレンティーノ | 2015-12-31 | RIZIN FIGHTING WORLD GRAND-PRIX 2015さいたま3DAYS IZAの舞 | SHOOT BOXING | RENA | 2R 腕ひしぎ十字固め ※MMA | 腕ひしぎ | https://shootboxing.org/fighter/jieana_valentino/ |
| ishida-katsuki | 石田勝希 | 2010-11-20 | K-1甲子園 KING OF UNDER 18 〜FINAL | K-1 / Krush / Krush-EX | 石原將伍 | 1R 合わせ一本 | 一本 | https://ja.wikipedia.org/wiki/%E7%9F%B3%E7%94%B0%E5%8B%9D%E5%B8%8C |
| jadanba-narantongaragu | ジャダンバ・ナラントンガラグ | 2004-10-13 | K-1 WORLD MAX 2004 〜世界王者対抗戦〜 | K-1 / Krush / Krush-EX | 山本"KID"徳郁 | 1R 1:55 KO（右ストレート→パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%83%A3%E3%83%80%E3%83%B3%E3%83%90%E3%83%BB%E3%83%8A%E3%83%A9%E3%83%B3%E3%83%88%E3%83%B3%E3%82%AC%E3%83%A9%E3%82%B0 |
| jadanba-narantongaragu | ジャダンバ・ナラントンガラグ | 2015-11-21 | ONE Championship 34: Dynasty of Champions 4 | ONE Championship | マラット・ガフロフ | 4R 4:39 リアネイキドチョーク | チョーク | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%83%A3%E3%83%80%E3%83%B3%E3%83%90%E3%83%BB%E3%83%8A%E3%83%A9%E3%83%B3%E3%83%88%E3%83%B3%E3%82%AC%E3%83%A9%E3%82%B0 |
| jadanba-narantongaragu | ジャダンバ・ナラントンガラグ | 2016-05-06 | ONE Championship 42: Ascent to Power | ONE Championship | 朴光哲 | 3R 1:27 ヴォンフルーチョーク | チョーク | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%83%A3%E3%83%80%E3%83%B3%E3%83%90%E3%83%BB%E3%83%8A%E3%83%A9%E3%83%B3%E3%83%88%E3%83%B3%E3%82%AC%E3%83%A9%E3%82%B0 |
| jadanba-narantongaragu | ジャダンバ・ナラントンガラグ | 2016-11-11 | ONE Championship 49: Defending Honor | ONE Championship | マラット・ガフロフ | 1R 4:51 リアネイキドチョーク | チョーク | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%83%A3%E3%83%80%E3%83%B3%E3%83%90%E3%83%BB%E3%83%8A%E3%83%A9%E3%83%B3%E3%83%88%E3%83%B3%E3%82%AC%E3%83%A9%E3%82%B0 |
| kido-yasuhiro | 城戸康裕 | 2009-06-14 | BREAK THROUGH-11～突破口～ | Bigbang | 北見 朋久 | 一本 | 一本 | https://bigbang-kick.com/%e5%9f%8e%e6%88%b8-%e5%ba%b7%e8%a3%95-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| kido-yasuhiro | 城戸康裕 | 2023-07-23 | DEEP vs NARIAGARI | Bigbang | 平山 迅 | 一本 | 一本 | https://bigbang-kick.com/%e5%9f%8e%e6%88%b8-%e5%ba%b7%e8%a3%95-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| kido-yasuhiro | 城戸康裕 | 2024-10-19 | JAPAN MARTIAL ARTS EXPO PROLOGUE～日本格闘技界、夢の懸け橋～ | Bigbang | 照強 | 一本 | 一本 | https://bigbang-kick.com/%e5%9f%8e%e6%88%b8-%e5%ba%b7%e8%a3%95-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| kimu-donuku | キム・ドンウック | 2006-12-31 | K-1 PREMIUM 2006 Dynamite!! | K-1 / Krush / Krush-EX | 内藤征弥 | 3R 1:11 ギブアップ（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%82%AD%E3%83%A0%E3%83%BB%E3%83%89%E3%83%B3%E3%82%A6%E3%83%83%E3%82%AF_%28%E6%A0%BC%E9%97%98%E5%AE%B6%29 |
| kubo-yuuta | 久保優太 | 2021-12-31 | RIZIN.33 | RIZIN | シバター | 1R 1:34 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| kubo-yuuta | 久保優太 | 2022-11-06 | RIZIN LANDMARK 4 | RIZIN | 奥田啓介 | 1R 4:43 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| kubo-yuuta | 久保優太 | 2023-12-31 | RIZIN.45 | RIZIN | 安保瑠輝也 | 1R 4:28 リアネイキッドチョーク | チョーク | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| kubo-yuuta | 久保優太 | 2024-12-31 | RIZIN.49 | RIZIN | ラジャブアリ・シェイドゥラエフ | 2R 2:30 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| kubo-yuuta | 久保優太 | 2026-04-12 | RIZIN LANDMARK 13 | RIZIN | ラジャブアリ・シェイドゥラエフ | 1R 4:13 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| maikeru-makudonarudo | マイケル・マクドナルド | 2004-03-14 | K-1 BEAST 2004 〜新潟初上陸〜 | K-1 / Krush / Krush-EX | LYOTO | 1R 2:30 前腕チョーク | チョーク | https://ja.wikipedia.org/wiki/%E3%83%9E%E3%82%A4%E3%82%B1%E3%83%AB%E3%83%BB%E3%83%9E%E3%82%AF%E3%83%89%E3%83%8A%E3%83%AB%E3%83%89_%28%E6%A0%BC%E9%97%98%E5%AE%B6%29 |
| masashi-nakajima | 中島将志 | 2024-08-12 | 拳心館主催興行 冠鷲シリーズvol.5 | NKB | 後藤 啓太 | エキシビションマッのため勝敗なし | 勝敗なし、エキシビション | https://nkb-r.com/main/2024/08/12/20240810/ |
| miruko-kurokopu | ミルコ・クロコップ | 2016-12-29 | RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント 2nd ROUND | RIZIN | キング・モー | 2R 1:49 TKO（スタンドパンチ連打→パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%83%9F%E3%83%AB%E3%82%B3%E3%83%BB%E3%82%AF%E3%83%AD%E3%82%B3%E3%83%83%E3%83%97 |
| miruko-kurokopu | ミルコ・クロコップ | 2017-12-31 | RIZIN FIGHTING WORLD GRAND-PRIX 2017 Final ROUND | RIZIN | 高阪剛 | 1R 1:02 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%83%9F%E3%83%AB%E3%82%B3%E3%83%BB%E3%82%AF%E3%83%AD%E3%82%B3%E3%83%83%E3%83%97 |
| morimoto-naoya | 森本 直哉 |  | KROSS×OVER.32 | KROSS×OVER | 矢代 光 | ※1R 0′30″ TKO パウンド | パウンド | https://krossover.jp/?p=3677 |
| okahan-bara | オカハン バラ |  | KROSSxOVER-CAGE.3 | KROSS×OVER | 立石 康平 | ※1’17” 一本 バックチョーク | チョーク、一本 | https://krossover.jp/?p=2414 |
| okahan-bara | オカハン バラ | 2024-11-10 | KROSS×OVER.28 新宿FACE | KROSS×OVER | 山市 雄太 | ※1R 2’41”一本 バックチョーク | チョーク、一本 | https://krossover.jp/?p=3119 |
| okuyama-takahiro | 奥山 貴大 | 2024-12-26 | -SHOOT BOXING BATTLE SUMMIT-GROUND ZERO TOKYO 2024 | SHOOT BOXING | 白川 ダーク陸斗 | 一本 1R ※アームバー ※MMA | 一本 | https://shootboxing.org/fighter/okuyama_takahiro/ |
| okuyama-takahiro | 奥山 貴大 | 2025-09-28 | RIZIN.51 | SHOOT BOXING | 大和 哲也 | 一本 1R アームバー ※MMA | 一本 | https://shootboxing.org/fighter/okuyama_takahiro/ |
| okuyama-takahiro | 奥山 貴大 | 2025-12-14 | DEEP 129 | SHOOT BOXING | 武田 光司 | 一本 リアネイキドチョーク ※MMA | チョーク、一本 | https://shootboxing.org/fighter/okuyama_takahiro/ |
| oono-takashi | 大野崇 | 2008-02-03 | SHOOT BOXING 2008 火魂〜Road to S-cup〜 其の壱 | SHOOT BOXING | アルトゥール・ヤシュクル | 3R 1:04 フロントチョークスリーパー | チョーク | https://ja.wikipedia.org/wiki/%E5%A4%A7%E9%87%8E%E5%B4%87 |
| petoru-morari | ペトル・モラリ | 2023-02-11 | Hanuman Cup 45 | RISE | Marco Novák | 3R 三角絞め | 三角 | https://rise-rc.com/fighter/petru-morari/ |
| rena | RENA | 2013-04-20 | SHOOT BOXING 2013 act.2 | SHOOT BOXING | トウ・ペイリン | 3R スタンディングチョークスリーパー | チョーク | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2014-04-18 | SHOOT BOXING2014 act. 2 ～BOND 絆～ | SHOOT BOXING | イム・ソヒ | 1R フロントチョークスリーパー | チョーク | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2015-12-31 | RIZIN FIGHTING WORLD GRAND-PRIX 2015さいたま3DAYS IZAの舞 | SHOOT BOXING | イリアーナ・ヴァレンティーノ | 2R 腕ひしぎ十字固め ※MMA | 腕ひしぎ | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2016-09-25 | RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント | SHOOT BOXING | 山本 美憂 | 1R フロントチョーク ※MMA | チョーク | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2017-12-31 | RIZIN FIGHTING WORLD GRAND-PRIX 2017 男子バンタム級トーナメント＆女子トーナメント2nd ROUND/Final ROUND- | SHOOT BOXING | 浅倉 カンナ | 1R チョークスリーパー ※MMA | チョーク | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2023-04-29 | RIZIN LANDMARK 5 in YOYOGI | SHOOT BOXING | クレア・ロペス | 一本 3R 膝十字固め ※MMA | 一本 | https://shootboxing.org/fighter/rena/ |
| rena | RENA | 2025-12-31 | RIZIN師走の超強者祭り | SHOOT BOXING | 伊澤 星花 | 一本 2R フロントチョーク ※MMA | チョーク、一本 | https://shootboxing.org/fighter/rena/ |
| saiga-kizaemon | 才賀紀左衛門 | 2016-12-31 | RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント FINAL ROUND | RIZIN | ディラン・ウエスト | 1R 2:03 KO (パウンド) | パウンド | https://ja.wikipedia.org/wiki/%E6%89%8D%E8%B3%80%E7%B4%80%E5%B7%A6%E8%A1%9B%E9%96%80 |
| saiga-kizaemon | 才賀紀左衛門 | 2017-12-29 | RIZIN FIGHTING WORLD GRAND-PRIX 2017 2nd ROUND | RIZIN | 朝倉海 | 2R 2:34 TKO（グラウンドの膝蹴り） | グラウンド | https://ja.wikipedia.org/wiki/%E6%89%8D%E8%B3%80%E7%B4%80%E5%B7%A6%E8%A1%9B%E9%96%80 |
| sakisaka-junnosuke | 向坂 準之輔 | 2026-03-01 | KROSS×OVER -CAGE.8- GENスポーツパレス大会 | KROSS×OVER | 松元 仁志+ | 1R 5′00秒TKO パウンド | パウンド | https://krossover.jp/?p=3929 |
| samu-gureko | サム・グレコ | 2004-03-14 | K-1 BEAST 2004 〜新潟初上陸〜 | K-1 / Krush / Krush-EX | ステファン・ガムリン | 1R 0:25 チョークスリーパー | チョーク | https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A0%E3%83%BB%E3%82%B0%E3%83%AC%E3%82%B3 |
| serukan-irumatsu | セルカン・イルマッツ | 2005-02-23 | K-1 WORLD MAX 2005 〜日本代表決定トーナメント〜 | K-1 / Krush / Krush-EX | 宇野薫 | 1R 1:50 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%AB%E3%82%AB%E3%83%B3%E3%83%BB%E3%82%A4%E3%83%AB%E3%83%9E%E3%83%83%E3%83%84 |
| shota-tezuka | 手塚翔太 | 2024-12-26 | -SHOOT BOXING BATTLE SUMMIT-GROUND ZERO TOKYO 2024 | SHOOT BOXING | 成尾 拓輝 | KO 3R ※フロントチョーク | チョーク | https://shootboxing.org/fighter/tezuka_shota/ |
| shuhei-higashi | 東 修平 | 2020-11-01 | DEEP 99 | RISE | 和田教良 | 1R 一本 | 一本 | https://rise-rc.com/fighter/higashi_shuhei/ |
| shuhei-higashi | 東 修平 | 2021-02-21 | DEEP 100 IMPACT | RISE | CORO | 1R 一本 | 一本 | https://rise-rc.com/fighter/higashi_shuhei/ |
| suzuki-satoru | 鈴木悟 | 2010-04-11 | SHOOT BOXING 25TH ANNIVERSARY SERIES 第2戦 維新-ISHIN- 其の弐 | SHOOT BOXING | 宍戸大樹 | 2R 1:39 TKO（スタンディングフロントチョーク） | チョーク | https://ja.wikipedia.org/wiki/%E9%88%B4%E6%9C%A8%E6%82%9F_%28%E6%A0%BC%E9%97%98%E5%AE%B6%29 |
| takagi-kenta | 高木 健太 | 2025-12-14 | KROSS×OVER-CAGE.7 | KROSS×OVER | 加藤 正憲 | ※1R 1′7″TKO パウンド | パウンド | https://krossover.jp/?p=3768 |
| takeru-205 | TAKERU | 2022-10-30 | 喝釆シリーズvol.6 | NKB | KEIGO | ※山本太一選手の体調不良によりエキシビションマッチに変更。KEIGO選手の不戦勝 | エキシビション | https://nkb-r.com/main/2022/10/30/20221029/ |
| tenshin-nasukawa | 那須川天心 | 2013-02-24 | ビッグバン〜統一への道〜 其の十二 | Bigbang | 秋元皓貴 | 2分2R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2016-07-03 | RISE WEST.6 | RISE | 石井一成&裕樹（パートナー：花田元誓） | 3分2R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2016-12-29 | Cygames presents RIZIN FIGHTING WORLD GP 2016 無差別級トーナメント 2nd ROUND | RISE | ニキータ・サプン | 2R 一本 | 一本 | https://rise-rc.com/fighter/nasukawa_tenshin/ |
| tenshin-nasukawa | 那須川天心 | 2016-12-31 | Cygames presents RIZIN FIGHTING WORLD GP 2016 無差別級トーナメント Final ROUND | RISE | カウイカ・オリージョ | 2R 一本 | 一本 | https://rise-rc.com/fighter/nasukawa_tenshin/ |
| tenshin-nasukawa | 那須川天心 | 2017-05-10 | ROAD TO KNOCK OUT.1 | KNOCK OUT | 石井宏樹 | 3分1R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2017-09-15 | RISE 119 | RISE | 野辺広大 | 3分1R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2019-11-10 | RISE NORTH | RISE | 安斎宙 | 3分1R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2021-06-13 | RIZIN.28 | RIZIN | 大﨑孔稀、HIROYA、所英男 | 3分3R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tenshin-nasukawa | 那須川天心 | 2022-10-30 | RISE 162 | RISE | 寺戸伸近 | 3分1R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tomo | TOMO | 2022-10-16 | KROSS×OVER 19 | KROSS×OVER | 益田 拓摩 | 1R 3’17” KO ※パウンド連打 | パウンド | https://krossover.jp/?p=646 |
| tomoko-hida | 樋田智子 | 2021-07-18 | DEEP OSAKA IMPACT 2021～20th Anniversary～ | RISE | 須田萌里 | 2R 一本 | 一本 | https://rise-rc.com/fighter/hida_tomoko/ |
| umeno-genji | 梅野源治 | 2014-06-01 | Big Bang 17 | Bigbang | 城戸康裕 | 2分2R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E6%A2%85%E9%87%8E%E6%BA%90%E6%B2%BB |
| umeno-genji | 梅野源治 | 2022-12-31 | RIZIN.40 | RIZIN | 平本蓮 | 3分2R終了 判定なし | 判定なし | https://ja.wikipedia.org/wiki/%E6%A2%85%E9%87%8E%E6%BA%90%E6%B2%BB |
| umeno-genji | 梅野源治 | 2026-05-10 | RIZIN.53 | RIZIN | ダイキ・ライトイヤー | 1R 2:37 三角絞め | 三角 | https://ja.wikipedia.org/wiki/%E6%A2%85%E9%87%8E%E6%BA%90%E6%B2%BB |
| yaman | YA-MAN | 2025-07-27 | 超RIZIN.4 真夏の喧嘩祭り | RIZIN | 金原正徳 | 3R 2:51 TKO（右アッパー→パウンド） | パウンド | https://ja.wikipedia.org/wiki/YA-MAN |
| yan-norukiya | ヤン・ノルキヤ | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | ゲーリー・グッドリッジ | 1R 1:11 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E3%83%A4%E3%83%B3%E3%83%BB%E3%83%8E%E3%83%AB%E3%82%AD%E3%83%A4 |
| yan-norukiya | ヤン・ノルキヤ | 2003-12-31 | K-1 PREMIUM 2003 Dynamite!! | K-1 / Krush / Krush-EX | 成瀬昌由 | 1R 4:40 チョークスリーパー | チョーク | https://ja.wikipedia.org/wiki/%E3%83%A4%E3%83%B3%E3%83%BB%E3%83%8E%E3%83%AB%E3%82%AD%E3%83%A4 |
| yan-romuruda | ヤン・ロムルダー | 1995-09-03 | K-1 REVENGE II | K-1 / Krush / Krush-EX | 平直行 | 1R 0:49 チョークスリーパー | チョーク | https://ja.wikipedia.org/wiki/%E3%83%A4%E3%83%B3%E3%83%BB%E3%83%AD%E3%83%A0%E3%83%AB%E3%83%80%E3%83%BC |
| yasuhiro-kazuya | 安廣一哉 | 2004-07-07 | K-1 WORLD MAX 2004 〜世界一決定トーナメント決勝戦〜 | K-1 / Krush / Krush-EX | 山本"KID"徳郁 | 2R 0:58 腕ひしぎ十字固め | 腕ひしぎ | https://ja.wikipedia.org/wiki/%E5%AE%89%E5%BB%A3%E4%B8%80%E5%93%89 |
| yurugen-kuruto | ユルゲン・クルト | 2009-05-22 | K-1 Scandinavia: Rumble of the Kings 3 | K-1 / Krush / Krush-EX | タダス・レビッカス | 1R 0:53 三角絞め | 三角 | https://ja.wikipedia.org/wiki/%E3%83%A6%E3%83%AB%E3%82%B2%E3%83%B3%E3%83%BB%E3%82%AF%E3%83%AB%E3%83%88 |
| yurugen-kuruto | ユルゲン・クルト | 2009-11-20 | K-1 Scandinavia: Rumble of the Kings 4 | K-1 / Krush / Krush-EX | ジェイミー・フレッチャー | 1R 4:25 TKO（パウンド） | パウンド | https://ja.wikipedia.org/wiki/%E3%83%A6%E3%83%AB%E3%82%B2%E3%83%B3%E3%83%BB%E3%82%AF%E3%83%AB%E3%83%88 |


---

## 4. 検査B: 内部ラベルの露出

相手名・大会名・決着欄に「特定不可」「同名」「未取得」「TBD」を含む行を検索した。生データ
(`data/kick/*.json`)にはこれらの文字列は一切存在しない(grep確認済み、0件)。**145件全てが
`opponentAmbiguous:true`(相手が同名複数人でslug解決できない)のケースで、ページ側(`OpponentCell`)が
動的に合成する「同名N人・特定不可」バッジ文言に由来する。** これは実装上の意図された挙動(誤リンクを避ける
ためのフォールバック表示)だが、内部の解決ロジックの状態がそのままユーザー向け文言に出ている点で、
ユーザー体験上は「システムの内部事情が漏れて見える」表示になっている。

候補人数の内訳: [["2候補",78],["3候補",56],["4候補",11]]

該当行全件:

| 選手slug | 選手名 | 日付 | 大会名 | 団体 | 相手 | 決着(methodRaw) | 検出箇所:文字列 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abiraru-himarayan-chita | アビラル・ヒマラヤン・チーター | 2026-03-28 | Krush.188 | K-1 / Krush / Krush-EX | 璃久 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1121 |
| abiraru-himarayan-chita | アビラル・ヒマラヤン・チーター | 2023-12-09 | K-1 ReBIRTH2 | K-1 / Krush / Krush-EX | 璃久 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1121 |
| adachi-kohei | 安達 浩平 | 2016-10-30 | DUEL.8 | NJKF | 海人 | 判定3-0 (三者とも29-28) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2016/1030.html |
| akuseru | 明世流 | 2026-07-20 | ECO信頼サービス株式会社PRESENTS K-1 DONTAKU 2026 | K-1 / Krush / Krush-EX | 銀次 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1266 |
| amada-hiromi | 天田ヒロミ | 2002-09-22 | K-1 ANDY SPIRITS 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 延長R終了 判定0-2 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F |
| amada-hiromi | 天田ヒロミ | 2000-07-07 | K-1 SPIRITS 2000 | K-1 / Krush / Krush-EX | 武蔵 | 3分3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F |
| amada-hiromi | 天田ヒロミ | 1999-08-22 | K-1 SPIRITS '99 | K-1 / Krush / Krush-EX | 武蔵 | 3分3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F |
| anesuto-hosuto | アーネスト・ホースト | 2001-04-15 | K-1 BURNING 2001 〜火の国熊本初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | 5R終了 判定2-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%BC%E3%83%8D%E3%82%B9%E3%83%88%E3%83%BB%E3%83%9B%E3%83%BC%E3%82%B9%E3%83%88 |
| anesuto-hosuto | アーネスト・ホースト | 1998-07-18 | K-1 DREAM ’98 〜7対7全面対抗戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R 2:52 TKO（右アッパー） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%BC%E3%83%8D%E3%82%B9%E3%83%88%E3%83%BB%E3%83%9B%E3%83%BC%E3%82%B9%E3%83%88 |
| anpo-rukiya | 安保瑠輝也 | 2015-10-03 | SHOOT BOXING THE LAST BOMB | SHOOT BOXING | 海人 | 2R 2:59 KO（前蹴り） | opponentAmbiguousBadge:同名2人・特定不可 | https://ja.wikipedia.org/wiki/%E5%AE%89%E4%BF%9D%E7%91%A0%E8%BC%9D%E4%B9%9F |
| arasan-kamara | アラッサン・カマラ | 2025-11-15 | K-1 WORLD MAX 2025~-70kg世界最強決定トーナメント・決勝ラウンド~ | K-1 / Krush / Krush-EX | 璃久 | 無効 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1686 |
| berunaru-aka | ベルナール・アッカ | 2007-12-31 | K-1 PREMIUM 2007 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | 3R 1:26 KO（左フック） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%AB%E3%83%8A%E3%83%BC%E3%83%AB%E3%83%BB%E3%82%A2%E3%83%83%E3%82%AB |
| bobu-sapu | ボブ・サップ | 2005-12-31 | K-1 PREMIUM 2005 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%9C%E3%83%96%E3%83%BB%E3%82%B5%E3%83%83%E3%83%97 |
| burakupansa-beinoa | “ブラックパンサー”ベイノア | 2022-04-02 | Cygames presents RISE ELDORADO 2022 | RISE | 海人 | 1RKO | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/beynoah/ |
| burakupansa-beinoa | “ブラックパンサー”ベイノア | 2019-12-03 | SHOOT BOXING GROUND ZERO TOKYO 2019 | RISE | 海人 | 5R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/beynoah/ |
| chan-ri | チャン・リー | 2023-04-08 | DUAL Presents Krush~RING OF VENUS~ | K-1 / Krush / Krush-EX | KAI | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/888 |
| daina | 大夢 | 2024-01-28 | Krush.157 | K-1 / Krush / Krush-EX | 悠斗 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1174 |
| dengu-shiruba | デング・シルバ | 2024-03-20 | TRHD presents K-1 WORLD MAX | K-1 / Krush / Krush-EX | 璃久 | TKO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1443 |
| everuton-teishieira | エヴェルトン・テイシェイラ | 2008-09-27 | K-1 WORLD GP 2008 IN SEOUL FINAL16 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%B4%E3%82%A7%E3%83%AB%E3%83%88%E3%83%B3%E3%83%BB%E3%83%86%E3%82%A4%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%A9 |
| fujihira-ryuya | 藤平 琉矢 | 2026-02-08 | K-1 WORLD GP 2026~ -90kg世界最強決定トーナメント~ | K-1 / Krush / Krush-EX | 武蔵 | 判定 | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1703 |
| fujimoto-yuusuke | 藤本祐介 | 2007-03-04 | K-1 WORLD GP 2007 IN YOKOHAMA | K-1 / Krush / Krush-EX | 武蔵 | 延長R 1:23 KO（左ハイキック） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E8%97%A4%E6%9C%AC%E7%A5%90%E4%BB%8B |
| fujimoto-yuusuke | 藤本祐介 | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 延長R終了 判定0-2 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E8%97%A4%E6%9C%AC%E7%A5%90%E4%BB%8B |
| fujimura-daisuke | 藤村 大輔 | 2024-05-26 | Krush.161 | K-1 / Krush / Krush-EX | 璃久 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/636 |
| fukashi | 不可思 | 2018-04-01 | SHOOT BOXING 2018 act.2 | Bigbang | 海人 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://bigbang-kick.com/fukashi/ |
| fumito-nakata | 中田史斗 | 2024-09-08 | DEEP☆KICK 71 | DEEP☆KICK | 大輝 | TKO 3R2分16秒 セコンドタオル投入 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.deep-kick.com/posts/55277254?categoryIds=1233394 |
| furansowa-za-howaitobafaro-bota | フランソワ・"ザ・ホワイトバッファロー"・ボタ | 2005-09-23 | K-1 WORLD GP 2005 in OSAKA 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%95%E3%83%A9%E3%83%B3%E3%82%BD%E3%83%AF%E3%83%BB%E3%83%9C%E3%82%BF |
| furumura-kyohei | 古村 匡平 | 2017-10-01 | DUEL.12 | NJKF | 海人 | 判定0-3 (27-30、27-30、25-30) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2017/1001-3.html |
| gaogurai-gennorashin | ガオグライ・ゲーンノラシン | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 延長R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%AC%E3%82%AA%E3%82%B0%E3%83%A9%E3%82%A4%E3%83%BB%E3%82%B2%E3%83%BC%E3%83%B3%E3%83%8E%E3%83%A9%E3%82%B7%E3%83%B3 |
| geri-gudoriji | ゲーリー・グッドリッジ | 2003-04-06 | K-1 BEAST 2003 〜山形初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | 5R終了 判定0-1 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B2%E3%83%BC%E3%83%AA%E3%83%BC%E3%83%BB%E3%82%B0%E3%83%83%E3%83%89%E3%83%AA%E3%83%83%E3%82%B8 |
| geri-gudoriji | ゲーリー・グッドリッジ | 1999-04-25 | K-1 REVENGE '99 | K-1 / Krush / Krush-EX | 武蔵 | 1R 2:15 反則（金的攻撃） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B2%E3%83%BC%E3%83%AA%E3%83%BC%E3%83%BB%E3%82%B0%E3%83%83%E3%83%89%E3%83%AA%E3%83%83%E3%82%B8 |
| guraube-feitoza | グラウベ・フェイトーザ | 2006-07-30 | K-1 REVENGE 2006 K-1 WORLD GP 2006 IN SAPPORO 〜アンディ・フグ七回忌追悼イベント〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 |
| guraube-feitoza | グラウベ・フェイトーザ | 2005-11-19 | K-1 WORLD GP 2005 IN TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 2R 1:05 KO（左跳び膝蹴り） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 |
| guraube-feitoza | グラウベ・フェイトーザ | 2002-03-03 | K-1 WORLD GP 2002 in 名古屋 | K-1 / Krush / Krush-EX | 武蔵 | 5R終了 判定0-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 |
| harido-di-fausuto | ハリッド"ディ・ファウスト" | 2006-09-30 | K-1 WORLD GP 2006 in OSAKA 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定2-1 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%8F%E3%83%AA%E3%83%83%E3%83%89%22%E3%83%87%E3%82%A3%E3%83%BB%E3%83%95%E3%82%A1%E3%82%A6%E3%82%B9%E3%83%88%22 |
| hata-hajime | 畑 孟 | 2015-09-27 | NJKF 2015 6th | NJKF | 一輝 | 判定2-1 (29-28、27-28、29-28) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2015/0927-3.html |
| hatakeyama-hayato | 畠山 隼人 | 2015-07-20 | NJKF 2015 5th | NJKF | 一輝 | 判定1-0 (29-29、29-29、28-29) 延長3-0(三者とも8-10) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2015/0720-3.html |
| hattori-karin | 服部 華鈴 | 2026-02-28 | Krush.187 | K-1 / Krush / Krush-EX | KAI | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1704 |
| hayashi-yuta | 林 勇汰 | 2022-12-18 | Krush.144 | K-1 / Krush / Krush-EX | 銀次 | 延長判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/769 |
| hideki | 秀樹 | 2014-07-27 | J-FIGHT in SHINJUKU～vol.38～ | RISE | 海人 | 2R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/hideki/ |
| higashimoto-hisaki | 東本 央貴 | 2013-03-20 | Krush.27 | K-1 / Krush / Krush-EX | 一輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/311 |
| hiroki | 弘輝 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | KO | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1072 |
| hori-hiraku | 堀啓 | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 2R 3:00 KO（2ノックダウン：左ローキック） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%A0%80%E5%95%93 |
| horii-kaito | 堀井 海飛 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | 延長判定 | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1247 |
| i-sonhyon | イ・ソンヒョン | 2023-03-26 | Cygames presents RISE ELDORADO 2023 | RISE | 海人 | 5R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/lee_sunghyun/ |
| i-sonhyon | イ・ソンヒョン | 2019-09-28 | SHOOT BOXING 2019 act.4 | RISE | 海人 | 5R判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/lee_sunghyun/ |
| inoue-kaizan | 井上 海山 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 大輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1213 |
| ishigo-keito | 石郷 慶人 | 2026-02-01 | Krush.186 ~in OSAKA~ | K-1 / Krush / Krush-EX | 大輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1204 |
| jiemuzu-konde | ジェームズ・コンデ | 2023-12-16 | RUF presents RISE WORLD SERIES 2023 Final Round | RISE | 海人 | 1R KO | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/james-conde/ |
| jieromu-re-banna | ジェロム・レ・バンナ | 2009-09-26 | K-1 WORLD GP 2009 IN SEOUL FINAL16 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%A7%E3%83%AD%E3%83%A0%E3%83%BB%E3%83%AC%E3%83%BB%E3%83%90%E3%83%B3%E3%83%8A |
| jieromu-re-banna | ジェロム・レ・バンナ | 2002-12-07 | K-1 WORLD GP 2002 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 2R 0:51 TKO（タオル投入） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%A7%E3%83%AD%E3%83%A0%E3%83%BB%E3%83%AC%E3%83%BB%E3%83%90%E3%83%B3%E3%83%8A |
| kaishi | 魁志 | 2022-07-31 | 湘南美容クリニック presents RIZIN.37 | RIZIN | 龍聖 | 3R 1分23秒 TKO（レフェリーストップ） | opponentAmbiguousBadge:同名2人・特定不可 | https://jp.rizinff.com/_ct/17559478 |
| kaito | 海斗 | 2023-09-29 | Krush.153 | K-1 / Krush / Krush-EX | 大輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/824 |
| kajiwara-ryuuji | 梶原龍児 | 2012-12-14 | Krush.25 | K-1 / Krush / Krush-EX | 一輝 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/274 |
| kaneda-shoki | 兼田 将暉 | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 銀次 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1215 |
| kanta-motoyama | 基山幹太 | 2020-12-20 | プロフェッショナル修斗公式戦 PROFESSIONAL SHOOTO 2020 Vol.4 in OSAKA Supported by ONE Championship | SHOOT BOXING | 龍翔 | 3R 判定 | opponentAmbiguousBadge:同名4人・特定不可 | https://shootboxing.org/fighter/kanta_motoyama/ |
| kawakami-kyo | 川上 叶 | 2024-04-27 | KNOCK OUT 2024 vol.2 | SHOOT BOXING | 龍聖 | 3R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://shootboxing.org/fighter/kawakami_kyo/ |
| kazumi | 和美 | 2026-07-20 | ECO信頼サービス株式会社PRESENTS K-1 DONTAKU 2026 | K-1 / Krush / Krush-EX | 武蔵 | KO | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1783 |
| keito-uirasakureku | ケイト・ウィラサクレック | 2022-06-25 | K-1 WORLD GP 2022 JAPAN ~RING OF VENUS~ | K-1 / Krush / Krush-EX | KAI | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1100 |
| kido-yasuhiro | 城戸康裕 | 2025-11-02 | Super Bigbang 2025 | Bigbang | 大輝 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://bigbang-kick.com/%e5%9f%8e%e6%88%b8-%e5%ba%b7%e8%a3%95-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| kitamura-makoto | 喜多村誠 | 2020-11-28 | 一般社団法人シュートボクシング協会「SHOOT BOXING 2020 act.2」 | SHOOT BOXING | 海人 | 3R 0:14 KO（右ハイキック） | opponentAmbiguousBadge:同名2人・特定不可 | https://ja.wikipedia.org/wiki/%E5%96%9C%E5%A4%9A%E6%9D%91%E8%AA%A0 |
| kurata-eiki | 倉田 永輝 | 2023-12-17 | Krush.156 | K-1 / Krush / Krush-EX | 龍翔 | TKO | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1015 |
| kuroda-akihiro | 黒田アキヒロ | 2010-11-07 | 熱風 拾 | NJKF | 一輝 | 判定3-0 (29-28、29-28、30-29) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2010/1107.html |
| kuroda-akihiro | 黒田アキヒロ |  | ニュージャパンキックボクシング連盟「熱風 拾」 | NJKF | 一輝 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名2人・特定不可 | https://ja.wikipedia.org/wiki/%E9%BB%92%E7%94%B0%E3%82%A2%E3%82%AD%E3%83%92%E3%83%AD |
| kyoshiro | 恭士郎 | 2015-12-06 | Bigbang23 | Bigbang | 一輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://bigbang-kick.com/kyoshiro/ |
| kyoutarou | 京太郎 | 2008-06-29 | K-1 WORLD GP 2008 IN FUKUOKA | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定2-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E8%97%A4%E6%9C%AC%E4%BA%AC%E5%A4%AA%E9%83%8E |
| maikeru-tonpuson | マイケル・トンプソン | 1998-10-28 | K-1 JAPAN '98 〜神風〜 | K-1 / Krush / Krush-EX | 武蔵 | 5R終了 判定2-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%9E%E3%82%A4%E3%82%B1%E3%83%AB%E3%83%BB%E3%83%88%E3%83%B3%E3%83%97%E3%82%BD%E3%83%B3_%28%E6%A0%BC%E9%97%98%E5%AE%B6%29 |
| masashi-nakajima | 中島将志 | 2021-11-14 | Cygames presents RISE WORLD SERIES 2021 OSAKA2 | RISE | 海 人 | 3R判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/nakajima_masashi/ |
| masashi-yamato | 匡志YAMATO | 2024-11-23 | Krush.168 | RISE | 璃久 | 3R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/masashi_yamato/ |
| matsuba-toya | 松葉 斗哉 | 2023-07-22 | AZABU PRESENTS Krush.151 | K-1 / Krush / Krush-EX | 悠斗 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1312 |
| matsumoto-haruto | 松本 海翔 | 2024-10-05 | K-1 WORLD GP 2024 | K-1 / Krush / Krush-EX | 銀次 | TKO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1357 |
| minagi | 海凪 | 2026-03-28 | Krush.188 | K-1 / Krush / Krush-EX | 空龍 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1480 |
| miruko-kurokopu | ミルコ・クロコップ | 1999-12-05 | K-1 GRAND PRIX '99 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 2R 1:13 KO（左アッパー） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%9F%E3%83%AB%E3%82%B3%E3%83%BB%E3%82%AF%E3%83%AD%E3%82%B3%E3%83%83%E3%83%97 |
| miyakoshi-keijiro | 宮越 慶二郎 | 2011-07-17 | NEW JAPAN BLOOD 7 | NJKF | 一輝 | 判定3-0 (50-45、50-45、50-43) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2011/0717-2.html |
| miyakoshi-keijiro | 宮越 慶二郎 | 2010-08-01 | 熱風 零七 ～桜井洋平FINAL～ | NJKF | 一輝 | 判定2-1 (49-48、48-49、49-48) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2010/0801-2.html |
| mizutani-kodai | 水谷 昊代 | 2025-11-15 | K-1 WORLD MAX 2025~-70kg世界最強決定トーナメント・決勝ラウンド~ | K-1 / Krush / Krush-EX | 武蔵 | 判定 | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1687 |
| mohamedo-butaza | モハメド・ブタザ | 2025-02-09 | K-1 WORLD MAX 2025 | K-1 / Krush / Krush-EX | 璃久 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1581 |
| mohan-doragon | モハン・ドラゴン | 2021-04-10 | SHOOT BOXING 2021 act.2 | Bigbang | 海人 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://bigbang-kick.com/mohan-dragon/ |
| montanya-shiuba | モンターニャ・シウバ | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%A2%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%8B%E3%83%A3%E3%83%BB%E3%82%B7%E3%82%A6%E3%83%90 |
| montanya-shiuba | モンターニャ・シウバ | 2003-06-29 | K-1 BEAST II 2003 | K-1 / Krush / Krush-EX | 武蔵 | 2R 1:50 反則失格（倒れた相手への攻撃） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%A2%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%8B%E3%83%A3%E3%83%BB%E3%82%B7%E3%82%A6%E3%83%90 |
| morita-naoki | 森田 奈男樹 | 2023-07-22 | AZABU PRESENTS Krush.151 | K-1 / Krush / Krush-EX | 璃久 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1177 |
| nagano-ryuki | 長野 龍生 | 2025-11-29 | Krush.182 | K-1 / Krush / Krush-EX | 龍翔 |  | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1267 |
| nakasako-tsuyoshi | 中迫剛 | 2002-09-22 | K-1 ANDY SPIRITS 2002 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R+延長2R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E4%B8%AD%E8%BF%AB%E5%89%9B |
| nakasako-tsuyoshi | 中迫剛 | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E4%B8%AD%E8%BF%AB%E5%89%9B |
| naoya | 直也 | 2023-05-13 | 株式会社シマジュー Presents Krush-EX 2023 vol.4 in FUKUOKA | K-1 / Krush / Krush-EX | 銀次 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1360 |
| nikorasu-petasu | ニコラス・ペタス | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R+延長R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%8B%E3%82%B3%E3%83%A9%E3%82%B9%E3%83%BB%E3%83%9A%E3%82%BF%E3%82%B9 |
| nobu-hayashi | ノブ・ハヤシ | 1999-08-22 | K-1 SPIRITS '99 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%8E%E3%83%96%E3%83%BB%E3%83%8F%E3%83%A4%E3%82%B7 |
| noiri-masaaki | 野杁正明 | 2022-06-19 | Yogibo presents THE MATCH 2022 | K-1 / Krush / Krush-EX | 海人 | 延長判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/41 |
| nonaka-daito | 野中 大翔 | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 武蔵 | 判定 | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1594 |
| oda-jinku | 小田 尋久 | 2024-08-18 | Krush.164 | K-1 / Krush / Krush-EX | 璃久 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1338 |
| onodera-hayato | 小野寺 隼 | 2026-05-31 | K-1 REVENGE | K-1 / Krush / Krush-EX | 龍翔 | 判定 | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1571 |
| oshika-toki | 大鹿 統毅 | 2023-10-21 | Krush.154 | K-1 / Krush / Krush-EX | 悠斗 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1331 |
| ozaki-keiji | 尾崎圭司 | 2014-06-12 | Krush.42 | K-1 / Krush / Krush-EX | 一輝 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/272 |
| paku-yonsu | パク・ヨンス | 2007-08-05 | K-1 WORLD GP 2007 IN HONG KONG | K-1 / Krush / Krush-EX | 武蔵 | 2R 0:48 KO（右フック） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%91%E3%82%AF%E3%83%BB%E3%83%A8%E3%83%B3%E3%82%B9 |
| pita-atsu | ピーター・アーツ | 2006-12-02 | K-1 WORLD GP 2006 IN TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 1R 2:53 KO（2ノックダウン：パンチ連打） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 |
| pita-atsu | ピーター・アーツ | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-2 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 |
| pita-atsu | ピーター・アーツ | 2000-01-25 | K-1 RISING 2000 〜長崎初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | 延長R 1:25 TKO（タオル投入） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 |
| randi-kimu | ランディ・キム | 2006-12-31 | K-1 PREMIUM 2006 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | 3R 0:33 KO（右ストレート） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%A9%E3%83%B3%E3%83%87%E3%82%A3%E3%83%BB%E3%82%AD%E3%83%A0 |
| rei-sefo | レイ・セフォー | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 延長R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC |
| rei-sefo | レイ・セフォー | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-2 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC |
| rei-sefo | レイ・セフォー | 2000-12-10 | K-1 WORLD GP 2000 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 1R 1:38 KO（2ノックダウン：フック連打） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC |
| remi-bonyasuki | レミー・ボンヤスキー | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R+延長2R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%83%9F%E3%83%BC%E3%83%BB%E3%83%9C%E3%83%B3%E3%83%A4%E3%82%B9%E3%82%AD%E3%83%BC |
| remi-bonyasuki | レミー・ボンヤスキー | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%83%9F%E3%83%BC%E3%83%BB%E3%83%9C%E3%83%B3%E3%83%A4%E3%82%B9%E3%82%AD%E3%83%BC |
| rikarudo-nodosutorando | リカルド・ノードストランド | 2005-07-29 | K-1 WORLD GP 2005 in HAWAII | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-2 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AA%E3%82%AB%E3%83%AB%E3%83%89%E3%83%BB%E3%83%8E%E3%83%BC%E3%83%89%E3%82%B9%E3%83%88%E3%83%A9%E3%83%B3%E3%83%89 |
| rusuran-karaefu | ルスラン・カラエフ | 2005-11-19 | K-1 WORLD GP 2005 in TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 延長R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%83%AB%E3%82%B9%E3%83%A9%E3%83%B3%E3%83%BB%E3%82%AB%E3%83%A9%E3%82%A8%E3%83%95 |
| ryoga | 稜賀 | 2024-10-05 | K-1 WORLD GP 2024 | K-1 / Krush / Krush-EX | 龍翔 | KO | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1536 |
| ryoto | 玲翔 | 2021-10-17 | QP PRESENTS HOOST CUP KINGS KYOTO8 | RISE | 龍 聖 | 3R判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/ryoto/ |
| saito-ryunosuke | 齊藤 龍之介 | 2024-12-08 | Krush.169 | K-1 / Krush / Krush-EX | 龍翔 |  | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1333 |
| samo-peti | サモ・ペティ | 2023-06-25 | SHOOT BOXING 2023 act.3 | RISE | 海人 | 5R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/samo_petje/ |
| samo-peti | サモ・ペティ | 2022-08-21 | Cygames presents RISE WORLD SERIES OSAKA 2022 | RISE | 海人 | 延長R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/samo_petje/ |
| samu-gureko | サム・グレコ | 1996-09-01 | K-1 REVENGE '96 | K-1 / Krush / Krush-EX | 武蔵 | 3R 0:22 無効試合 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A0%E3%83%BB%E3%82%B0%E3%83%AC%E3%82%B3 |
| samu-gureko | サム・グレコ | 1996-05-06 | K-1 GRAND PRIX '96 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | 1R終了時 TKO（右足指負傷） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A0%E3%83%BB%E3%82%B0%E3%83%AC%E3%82%B3 |
| sasaki-daizo | 佐々木 大蔵 | 2013-11-10 | Krush.34 | K-1 / Krush / Krush-EX | 一輝 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/280 |
| sawayashiki-junichi | 澤屋敷純一 | 2008-04-13 | K-1 WORLD GP 2008 IN YOKOHAMA | K-1 / Krush / Krush-EX | 武蔵 | 2R 2:16 KO（3ノックダウン：左ストレート） | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E6%BE%A4%E5%B1%8B%E6%95%B7%E7%B4%94%E4%B8%80 |
| semi-shuruto | セミー・シュルト | 2006-04-29 | K-1 WORLD GP 2006 IN LAS VEGAS | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定3-0 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%9F%E3%83%BC%E3%83%BB%E3%82%B7%E3%83%A5%E3%83%AB%E3%83%88 |
| semi-shuruto | セミー・シュルト | 2002-04-21 | K-1 BURNING 2002 〜広島初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | 5R終了 判定2-1 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%9F%E3%83%BC%E3%83%BB%E3%82%B7%E3%83%A5%E3%83%AB%E3%83%88 |
| shinta | 心直 | 2025-06-27 | Krush.177 | K-1 / Krush / Krush-EX | 悠斗 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1413 |
| shiriru-abidi | シリル・アビディ | 2004-09-25 | K-1 WORLD GP 2004 in TOKYO 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E3%82%B7%E3%83%AA%E3%83%AB%E3%83%BB%E3%82%A2%E3%83%93%E3%83%87%E3%82%A3 |
| shizuka | C-ZUKA | 2021-08-21 | Krush.128 | K-1 / Krush / Krush-EX | KAI | 延長判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/845 |
| sho-ogawa | 小川翔 | 2018-08-12 | RWEDDINGS presents RIZIN.12 | RIZIN | 海人 | 3R 判定 3-0 | opponentAmbiguousBadge:同名2人・特定不可 | https://jp.rizinff.com/_ct/17196408 |
| so-yonteku | ソ・ヨンテク | 2024-04-21 | Krush-EX 2024 vol.1 in FUKUOKA | K-1 / Krush / Krush-EX | 銀次 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1467 |
| sutoyan-kopurivurensuki | ストーヤン・コプリヴレンスキー | 2022-12-25 | Cygames presents RISE WORLD SERIES / SHOOTBOXING-KINGS 2022 | RISE | 海人 | 3R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/stoyan-koprivlenski/ |
| suzuki-hiroaki | 鈴木 博昭 | 2017-06-16 | SHOOT BOXING 2017 act.3 | SHOOT BOXING | 海人 | 1R TKO | opponentAmbiguousBadge:同名2人・特定不可 | https://shootboxing.org/fighter/suzuki-hiroaki/ |
| suzuki-shinji | 鈴木真治 | 2009-05-10 | ROAD TO REAL KING 6 | NJKF | 一輝 | KO 4R2分03秒 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2009/0510-5.html |
| taito | 泰斗 | 2012-11-10 | Krush.24 | K-1 / Krush / Krush-EX | 一輝 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/14 |
| takahashi-seiji | 高橋 誠治 | 2012-02-18 | KICK TO THE FUTURE 1 | NJKF | 一輝 | 判定3-0 (49-47、49-47、50-47) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2012/0218-4.html |
| takumi-terada | 寺田 匠 | 2022-08-11 | ECO信頼サービス株式会社 PRESENTS K-1 WORLD GP 2022 JAPAN~K-1フェザー級世界最強決定トーナメント~ | K-1 / Krush / Krush-EX | 銀次 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1063 |
| terashima-kokoro | 寺島 想 | 2025-08-23 | Krush.179 | K-1 / Krush / Krush-EX | 龍翔 | 延長判定 | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1223 |
| terashima-kokoro | 寺島 想 | 2025-05-25 | Krush.176 | K-1 / Krush / Krush-EX | 銀次 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1223 |
| teyon | テヨン | 2014-09-21 | NJKF 2014 6th | NJKF | 一輝 | 判定3-0 (30-28、30-28、30-27) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.njkf.info/result2014/0921-5.html |
| tomihira-tatsufumi | 富平辰文 | 2002-09-22 | K-1 ANDY SPIRITS 2002 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%B9%B3%E8%BE%B0%E6%96%87 |
| tomihira-tatsufumi | 富平辰文 | 2000-05-28 | K-1 SURVIVAL 2000 | K-1 / Krush / Krush-EX | 武蔵 | 3R終了 判定0-3 | opponentAmbiguousBadge:同名3人・特定不可 | https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%B9%B3%E8%BE%B0%E6%96%87 |
| toyoda-yuki | 豊田 優輝 | 2024-05-26 | Krush.161 | K-1 / Krush / Krush-EX | 龍翔 | KO | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1032 |
| tsukuru-midorikawa | 緑川 創 | 2020-10-11 | Cygames presents RISE DEAD OR ALIVE 2020 YOKOHAMA | RISE | 海 人 | 3R 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/midorikawa_tsukuru/ |
| ueda-sakuya | 上田 咲也 | 2025-03-30 | Krush.172 | K-1 / Krush / Krush-EX | 武蔵 | TKO | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1490 |
| ueno-kanata | 上野 奏貴 | 2024-09-29 | K-1 WORLD MAX 2024 | K-1 / Krush / Krush-EX | 武蔵 | KO | opponentAmbiguousBadge:同名3人・特定不可 | https://www.k-1.co.jp/fighter/1485 |
| uzatsuyo-yoshiya | ウザ強ヨシヤ | 2018-07-29 | RIZIN.11 | RIZIN | 海人 | 2R 1分22秒 KO（右ヒザ） | opponentAmbiguousBadge:同名2人・特定不可 | https://jp.rizinff.com/_ct/17188889 |
| uzatsuyo-yoshiya | ウザ強ヨシヤ | 2018-07-28 | RIZIN.11 | RISE | 海 人 | 2RKO | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/uzatsuyo_yoshiya/ |
| vikutoru-akimofu | ヴィクトル・アキモフ | 2022-03-27 | KINGS KYOTO9〜REVERSAL〜 | HoostCup | 璃久 | 判定2-0 (29-29/30-29/30-29) | opponentAmbiguousBadge:同名2人・特定不可 | https://www.hoostcup.com/13fight/20220327-hoostcup.html |
| yamazaki-hideaki | 山崎秀晃 | 2013-06-16 | Krush.29 | K-1 / Krush / Krush-EX | 一輝 | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/8 |
| yasuo-ryuki | 安尾 瑠輝 | 2024-07-27 | Krush.163 | K-1 / Krush / Krush-EX | 悠斗 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1283 |
| yuka | Yuka☆ | 2021-11-27 | Krush-EX 2021 vol.7 | K-1 / Krush / Krush-EX | KAI | 判定 | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1219 |
| yushi | YUSHI | 2017-02-11 | SHOOT BOXING 2017 act.1 | SHOOT BOXING | 海人 | ノーコンテスト | opponentAmbiguousBadge:同名2人・特定不可 | https://shootboxing.org/fighter/yushi/ |
| yusuke | 佑典 | 2026-02-01 | Krush.186 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | KO | opponentAmbiguousBadge:同名4人・特定不可 | https://www.k-1.co.jp/fighter/1140 |
| yuya-kubota | 久保田有哉 | 2022-07-24 | DEEP☆KICK ZERO 04 | RISE | 龍聖 | 2R TKO | opponentAmbiguousBadge:同名2人・特定不可 | https://rise-rc.com/fighter/kubota_yuya/ |
| zora-akapyan | ゾーラ・アカピャン | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 璃久 | KO | opponentAmbiguousBadge:同名2人・特定不可 | https://www.k-1.co.jp/fighter/1451 |


---

## 5. 検査C: セル崩れ

### 5.1 C1: 決着欄の中身が空の【】

正規表現(`【\s*】`、および全角スペース・()バリエーションも含めて)で全26,167行を走査した結果、**0件**。
このパターンでの空セルは現状データに存在しない。

### 5.2 C2: 決着欄が異常に長い/【】セグメントが複数(セル結合の兆候)

決着欄(`methodRaw`)の文字数分布は p50=5字、p90=21字、p99=39字、最大164字(全26,167行)。
「異常に長い」を機械的な文字数閾値だけで切ると恣意的になるため、より直接的な構造シグナルとして
**「【…】セグメントが2個以上ある行」**(1試合の決着欄に2つの丸括弧付き時系列注記が連結している=
2セル分の内容が1セルに結合された痕跡)を主軸に、文字数80字超も合わせて抽出した。**24件、
全てHoostCup(17件)とKROSS×OVER(7件)の2団体に集中。** 受入条件の実例(安保璃紅、HoostCup 2015-03-01)は
このロジックで検出できる。

該当行全件:

| 選手slug | 選手名 | 日付 | 大会名 | 団体 | 決着(methodRaw) | 文字数 | 【】セグメント数 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| emiko-konishi | 小西江美香 |  | KROSS×OVER.31 -SHINJUKU FACE 20th Anniversary- | KROSS×OVER | 判定0-3 ※小西がKROSSxOVER GIRLS KICK NEXT GENERATIONS CUP Sクラストーナメント優勝 4月6日KROSSxOVER.30にて開催された（株）東雲ConnecT presents KROSSxOVER GIRLS KICK NEXT GENERATIONS CUPSクラストーナメント | 164 | 0 | https://krossover.jp/?p=3575 |
| fujihara-arashi | 藤原あらし | 2020-12-20 | KROSS×OVER 10 | KROSS×OVER | 判定 3-0(太田50-47竹村50-47/小池50-47) ※ユウ・ウォーワンチャイ選手が900gオーバーとなった為、『株式会社秀拓 presents KROSSxOVER最強決定ムエタイバンタム級トーナメント』は藤原あらし選手の優勝となり、PRO-MUAYTHAIスーパーファイト3分5Rとして行う | 151 | 0 | https://krossover.jp/?p=197 |
| bukhari-aqil | ブハリ亜輝留 |  | 【 KROSS×OVER CAGE.9】 | KROSS×OVER | ✖藤虎（フリー） 2R 1 ′24″ KO 左フック Krushミドル級王者にも輝いたブハリ亜輝留がKROSSxOVERに電撃参戦！ 対する藤虎は前戦ヤンダニエルとの撃ち合いを制し、今回が久々の登場となるが勝利する事があればその名は一気に轟くことだろう | 126 | 0 | https://krossover.jp/?p=4122 |
| fujimoto-hiroshi | 藤元 洋次 | 2018-09-02 | 西日本豪雨被害チャリティーHOOST CUP KINGS EHIME〜四国合戦〜 | HoostCup | 延長(4R)判定3-0(10-8/10-8/10-8) 本戦(3R)判定0-1(28-28/28-28/26-29) ※1R藤元にパンチでダウン１あり ※本戦3Rチューチャイにホールディングで減点1 延長4Rでもチューチャイにホールディング減点1あり | 125 | 0 | https://www.hoostcup.com/13fight/20180902-hoostcup.html |
| ogiwara-ai | 荻原 愛 | 2023-08-13 | KROSSxOVER.22 | KROSS×OVER | ※3R 開始時 ＴKO※ドクターストップ ※華は1Ｒに右ストレートでダウンあり ※荻原が10/22 KROSSxOVER .23内で行われるKROSSxOVER PRO-KICK 女子フライ級(-50.8kg)初代王座決定トーナメント準決勝に進出 | 123 | 0 | https://krossover.jp/?p=850 |
| rikuto | 陸刃 | 2022-10-16 | KROSS×OVER 19 | KROSS×OVER | 判定3-0(29-26 29-26 29-26) ※1R 陸刃が右ストレートでダウン ※シンイチに水まきによるイエローカード ※宿命IX チーム九州vsチーム関東5対5対抗戦はチーム九州が4-0で勝利し、(有)新羅ガーデンより和牛が贈呈された | 121 | 0 | https://krossover.jp/?p=646 |
| adachi-maiko | 足立 麻衣子 | 2023-08-13 | KROSSxOVER.22 | KROSS×OVER | 1R 1’43” ＴKO ※左フック ※1Ｒ、足立は左フックにてダウンあり ※登島が10/22 KROSSxOVER.23内で行われるKROSSxOVER PRO-KICK 女子フライ級(-50.8kg)初代王座決定トーナメント準決勝に進出 | 120 | 0 | https://krossover.jp/?p=850 |
| tsujide-yuuto | 辻出優翔 | 2014-06-22 | HoostCup SPIRIT4-京都の陣- | HoostCup | 3R0分18秒 レフリーストップによるTKO 【2R 2:00】左フックで[HIRΦKI]がダウン、【2R 2:42】左フックでHIRΦKI]がダウン、【3R 0:18】左フックで[HIRΦKI]がダウン | 102 | 3 | https://www.hoostcup.com/13fight/20140622-hoostcup-04.html |
| hirahara-riku | 平原 陸 |  | KROSS×OVER.32 | KROSS×OVER | 判定3-0(29：28 29：28 29：27) ※平原は3Ｒ、ホールディングにて減点1あり ※斎藤は2Ｒ、飛び膝蹴りにてダウンあり ※平原が初代フライ級(-51.5kg)王座決定トーナメント決勝戦へ進出 | 102 | 0 | https://krossover.jp/?p=3677 |
| bonta | ボン太 | 2014-06-22 | HoostCup SPIRIT4-京都の陣- | HoostCup | 1R2分25秒 パンチ連打によるTKO 【1R 1:50】パンチの連打で[陸虎]がダウン、【1R 2:05】パンチからの右膝で[陸虎]がダウン、【1R 2:25】パンチ連打で[陸虎]がダウン | 95 | 3 | https://www.hoostcup.com/13fight/20140622-hoostcup-04.html |
| tsujide-yuuto | 辻出優翔 | 2015-07-12 | HoostCup SPIRIT6 | HoostCup | 延長判定 0-3 本戦（30-30）（30-30）（29-30） 延長（9-10）（9-10）（9-10） 【2R】松崎に金的攻撃で注意、ホールデイング警告、【3R】松崎に金的攻撃で警告 | 93 | 2 | https://www.hoostcup.com/13fight/20150712-hoostcup.html |
| takuya-taira | 泰良拓也 | 2014-06-22 | HoostCup SPIRIT4-京都の陣- | HoostCup | 2R1分12秒 右フックによるTKO 【2R 0:36】右ストレートで[泉]がダウン、【2R 0:52】パンチラッシュで[泉]がダウン、【2R 1:12】右フックで[泉]がダウン | 89 | 3 | https://www.hoostcup.com/13fight/20140622-hoostcup-04.html |
| sato-atsushi | 佐藤 篤史 | 2014-03-23 | HoostCup LEGEND-伝説降臨- | HoostCup | 判定 3-0 （水谷:30-26）（山室:30-27）（御座岡:30-26） 【3R 2:05】パンチの連打でマルコスがダウン、【3R 2:43】左の膝蹴りでマルコスがダウン | 87 | 2 | https://www.hoostcup.com/13fight/20140323-hoostcup-legend.html |
| king-tsubasa | KING TSUBASA | 2019-03-03 | KINGS KYOTO5 | HoostCup | 3R 0’37” TKO (タオル投入) ※2Rタネにパンチで2ダウンあり、TSUBASAに1ダウンあり、3R TSUBASAにパンチでダウン2あり、セコンドタオル投入 | 84 | 0 | https://www.hoostcup.com/13fight/20190303-hoostcup.html |
| anesuto-hosuto | アーネスト・ホースト | 2014-03-23 | HoostCup LEGEND-伝説降臨- | HoostCup | 生年月日:1964年4月19日(49歳) 身長:186�p 構え:オーソドックス キック戦績:10戦9勝1敗4KO 総合戦績:8戦6勝2敗6KO 得意技:左ローキック | 83 | 0 | https://www.hoostcup.com/13fight/20140323-hoostcup-legend.html |
| daniro-zanorini | ダニロ・ザノリニ | 2014-11-16 | べラジオPRESENTS・HoostCup KINGS WEST-浪速の陣- | HoostCup | 生年月日:1981年06月07日(33歳) 血液型:x型 身長:173�p 構え:サウスポー 戦績:152戦103勝(18KO)36敗13分 得意技:ミドルキック | 81 | 0 | https://www.hoostcup.com/13fight/20141116-hoostcup-05.html |
| nishimoto-narufumi | 西元 也史 | 2016-03-20 | Hoost Cup KINGS ROAD -京都！王者への道- | HoostCup | 【3R 0:40】KO(右ストレート) 【1R 1:58】左ボデイ―で[エドワルド]がダウン、【1R 2:50】パンチの連打で[エドワルド]がダウン | 74 | 3 | https://www.hoostcup.com/13fight/20160320-hoostcup.html |
| kunitaka | 国崇 | 2016-03-20 | Hoost Cup KINGS ROAD -京都！王者への道- | HoostCup | 【3R 1:34】TKO(ヒジによる出血で[国崇]がドクターストップ、試合続行不可能) 【2R 1:48】右ヒジで[国崇]がダウン | 65 | 2 | https://www.hoostcup.com/13fight/20160320-hoostcup.html |
| nishimoto-narufumi | 西元 也史 | 2015-03-01 | HoostCup SPIRIT5〜京都の乱〜 | HoostCup | 【3R】1分43秒 パンチ連打によるTKO 【3R】柴田、右ストレート・パンチ連打でダウン。セコンドタオル投入 | 55 | 2 | https://www.hoostcup.com/13fight/20150301-hoostcup.html |
| takuya-taira | 泰良拓也 | 2016-03-20 | Hoost Cup KINGS ROAD -京都！王者への道- | HoostCup | 【2R 2:42】KO(パンチの連打） 【2R 1:30】左フックで[泰良]がダウン | 42 | 2 | https://www.hoostcup.com/13fight/20160320-hoostcup.html |
| hiroki | 弘輝 | 2016-03-20 | Hoost Cup KINGS ROAD -京都！王者への道- | HoostCup | 【2R 1:30】KO(左ストレート） 【2R 1:00】パンチで[大西]がダウン | 41 | 2 | https://www.hoostcup.com/13fight/20160320-hoostcup.html |
| atsushi-yamato | 敦YAMATO | 2016-06-05 | Hoost Cup KINGS KYOTO 〜MAMIYA祭り！意志を継ぐ者へ〜 | HoostCup | 【3R 2:30】TKO(パンチの連打) 【1R】右ストレートで[敦]がダウン | 39 | 2 | https://www.hoostcup.com/13fight/20160605-hoostcup.html |
| anpo-riku | 安保 璃紅 | 2015-03-01 | HoostCup SPIRIT5〜京都の乱〜 | HoostCup | 【1R】2分40秒 右ハイキックによるKO 【1R】右ヒザ, 右ボデイ― | 36 | 2 | https://www.hoostcup.com/13fight/20150301-hoostcup.html |
| takuya-taira | 泰良拓也 | 2015-03-01 | HoostCup SPIRIT5〜京都の乱〜 | HoostCup | 【1R】2分40秒 右ハイキックによるKO 【1R】右ヒザ, 右ボデイ― | 36 | 2 | https://www.hoostcup.com/13fight/20150301-hoostcup.html |


### 5.3 C3: 相手名に所属らしき文字列が連結(候補、要目視判定)

相手名(`opponentName`)に「ジム」「道場」「塾」「team/Team/TEAM」「club/Club/CLUB」「協会」「会館」
「GYM/Gym」のいずれかを含む行を抽出した。**306件。**

**重要な注意: この検査は精度を保証できていない。** タイ人選手など海外選手は公式サイト上でも
「選手名・所属ジム名」を一体の呼称として掲載する慣行があり(例: 「サンチャイ・TEPPEN GYM」)、これは
スクレイピングの誤りではなく元サイトの表記そのものである可能性が高い。一方で`opponentAffiliation`
欄が既に所属を保持しているのに`opponentName`側にも重複して所属語が入っているケースは、真のセル崩れ
(同じ情報が2箇所に重複)である可能性が高い。**この2つを機械的に判別する精度は今回のスクリプトにはない。**
団体別件数は以下の通り(降順):

[["RISE",62],["NJKF",60],["KNOCK OUT",48],["SHOOT BOXING",47],["K-1 / Krush / Krush-EX",35],["Bigbang",19],["HoostCup",13],["新日本キックボクシング協会(SNKA)",11],["JKA",7],["DEEP☆KICK",2],["RIZIN",1],["KROSS×OVER",1]]

該当行全件(団体別):


### RISE(62件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| akari | AKARI | 2020-12-18 | RISE144 | ユリカ・グラップリングシュートボクサーズジム | グラップリングシュートボクサーズ | https://rise-rc.com/fighter/akari/ |
| chanhyon-ri | チャンヒョン・リー | 2019-12-08 | The Battle of Muaythai BOM2-6 | スアキム・PKセンチャイムエタイジム | タイ | https://rise-rc.com/fighter/chanhyeong-lee/ |
| crazycat-yokko | 狂猫Yokko | 2022-11-27 | SUK WAN KINGTHONG 2022 FINAL | ペットルークオン・サーリージム | タイ/sarigym | https://rise-rc.com/fighter/crazycat_yokko/ |
| denisu-uoshiku | デニス・ウォシク | 2025-08-02 | ABEMA presents RISE WORLD SERIES 2025 TOKYO | スアレック･TEPPEN GYM | TEAM TEPPEN | https://rise-rc.com/fighter/denis-wosik/ |
| ferunando-arumeida | フェルナンド・アルメイダ | 2023-06-23 | RISE169 | コントゥアラーイ・JMボクシングジム |  | https://rise-rc.com/fighter/fernando-almeida/ |
| gentaro-kai | 甲斐元太郎 | 2022-05-29 | NJKF 2022 west 3rd | ジョムラウィー・K CRONY GYM | タイ | https://rise-rc.com/fighter/kai_gentaro/ |
| ishii-issei | 石井 一成 | 2021-04-11 | BOM WAVE04 -Get Over The COVID-19- | サンチャイ・TEPPEN GYM | タイ/TEPPEN GYM | https://rise-rc.com/fighter/ishii_issei/ |
| j | J | 2021-09-26 | BOM – ouroboros 2021 – | 大輝・FLYSKY GYM | FLYSKY GYM | https://rise-rc.com/fighter/j/ |
| kaito-hasegawa | 長谷川海翔 | 2024-02-23 | RISE176 | サンチャイ・TEPPENGYM | TEAM TEPPEN | https://rise-rc.com/fighter/hasegawa_kaito/ |
| kan-nakamura | 中村 寛 | 2017-11-26 | Hoost Cup KINGS OSAKA 2 | RYUYA ハーデスワークアウトジム |  | https://rise-rc.com/fighter/nakamura_kan/ |
| kazane | 風音 | 2019-03-23 | RISE131 | 村井雄誠 （エイワスポーツジム）） |  | https://rise-rc.com/fighter/kazane/ |
| kazuki-osaki | 大﨑一貴 | 2022-08-21 | Cygames presents RISE WORLD SERIES OSAKA 2022 | サンチャイ・TEPPENGYM | TEAM TEPPEN | https://rise-rc.com/fighter/osaki_kazuki/ |
| kazuki-osaki | 大﨑一貴 | 2020-01-19 | 長野復興チャリティ 野良犬祭6 | コンイサーン・エスジム | エスジム | https://rise-rc.com/fighter/osaki_kazuki/ |
| kazuki-osaki | 大﨑一貴 | 2019-02-11 | KNOCK OUT 2019 WINTER「THE ANSWER IS IN THE RING」 | チョークディー・PKセンチャイジム | タイ/PKセンチャイジム | https://rise-rc.com/fighter/osaki_kazuki/ |
| kazuki-osaki | 大﨑一貴 | 2018-06-15 | スック・ギャットペット | キアオ・パランチャイジム | タイ | https://rise-rc.com/fighter/osaki_kazuki/ |
| kazuma | 一馬 | 2022-02-23 | RISE155 | テーパリット・ジョウジム | JOE GYM | https://rise-rc.com/fighter/kazuma-1/ |
| kazuma | 一馬 | 2021-05-23 | RISE149 | ノラシン・スペチアーレジム | Speciale gym | https://rise-rc.com/fighter/kazuma-1/ |
| kenshin-yamamoto | 山元剣心 | 2021-04-11 | BOM WAVE04- Get Over The COVID-19- | パルコ・レンジャージム | レンジャージム | https://rise-rc.com/fighter/yamamoto_kenshin/ |
| kenta-nanbara | 南原健太 | 2023-08-18 | RISE171 | コントゥアラーイ・JMボクシングジム | タイ/JM Boxinggym | https://rise-rc.com/fighter/nanbara_kenta/ |
| kento-haraguchi | 原口健飛 | 2022-04-02 | Cygames presents RISE ELDORADO 2022 | ロンペット・Y'ZD GYM | Y'ZD豊見城 | https://rise-rc.com/fighter/haraguchi_kento/ |
| kesuke | ケースケ | 2025-06-29 | RISE189 | スアレック・TEPPEN GYM | TEAM TEPPEN | https://rise-rc.com/fighter/ke-suke/ |
| kodai | 滉大 | 2021-07-18 | Cygames presents RISE WORLD SERIES 2021 OSAKA | 志 朗（BeWELLキックボクシングジム |  | https://rise-rc.com/fighter/kodai/ |
| kodai | 滉大 | 2021-03-07 | QP PRESENTS HOOST CUP KINGS KYOTO 7 | ジョムラウィー・REFINAS GYM | タイ | https://rise-rc.com/fighter/kodai/ |
| koki-4 | 康輝 | 2023-12-10 | HOOST CUP KINGS NAGOYA 14 | クワン・サンライズジム | タイ/サンライズジム | https://rise-rc.com/fighter/koki/ |
| koki-4 | 康輝 | 2022-04-24 | Suk Wanchai MuayThai Super Fight | プーパンレック・ジョウジム | タイ/JOE GYM | https://rise-rc.com/fighter/koki/ |
| koki-osaki | 大﨑孔稀 | 2020-12-06 | BOM WAVE03 – Get Over The COVID-19- | サンチャイ・TEPPEN GYM | TEAM TEPPEN | https://rise-rc.com/fighter/osaki_koki/ |
| koyuki-miyazaki | 宮﨑小雪 | 2022-10-15 | Cygames presents RISE WORLD SERIES 2022 | ペットルークオン・サーリージム | sarigym | https://rise-rc.com/fighter/miyazaki_koyuki/ |
| masahide-kudo | 工藤政英 | 2017-11-23 | 3A-LIFE presents RISE121 | KEN・FLYSKYGYM | FLYSKYGYM | https://rise-rc.com/fighter/kudo_masahide/ |
| masahide-kudo | 工藤政英 | 2016-05-29 | RISE111 | 優吾・FLYSKYGYM | FLY SKY GYM | https://rise-rc.com/fighter/kudo_masahide/ |
| masahide-kudo | 工藤政英 | 2013-09-01 | M-FIGHT～蹴拳Ⅻ×Legend of Daddy3 | 広・センチャイジム | センチャイムエタイジム | https://rise-rc.com/fighter/kudo_masahide/ |
| masahide-kudo | 工藤政英 | 2013-04-28 | ムエローク2013 -1st- | 広・センチャイジム | センチャイムエタイ | https://rise-rc.com/fighter/kudo_masahide/ |
| masahiko-suzuki | 鈴木真彦 | 2021-07-18 | Cygames presents RISE WORLD SERIES 2021 OSAKA | テーパリット・ジョウジム | JOE GYM | https://rise-rc.com/fighter/suzuki_masahiko/ |
| masahiko-suzuki | 鈴木真彦 | 2018-09-16 | RISE127 | 優吾・FLYSKYGYM | FLYSKYGYM | https://rise-rc.com/fighter/suzuki_masahiko/ |
| momi | 紅絹 | 2016-12-25 | J-GIRLS 2016～Believe the unbreakable hearts～with J-FIGHT | ユリカ．グラップリングシュートボクサーズジム | グラップリングシュートボクサーズ名古屋 | https://rise-rc.com/fighter/momi/ |
| motoyasu | 基康 | 2022-11-20 | KICK Insist 14 | シュートン・ヨーユットムエタイジム | タイ | https://rise-rc.com/fighter/motoyasu/ |
| mutsuki-ebata | 江幡 睦 | 2019-07-07 | MAGNUM 50 | トーン・ハーブタイジョンジム | タイ | https://rise-rc.com/fighter/ebata_mutsuki/ |
| naoki-2 | 直樹 | 2021-12-12 | RISE153 | ジャルンチャイ・ライオンジム | LION GYM | https://rise-rc.com/fighter/naoki/ |
| riku-kazushima | 数島大陸 | 2021-07-28 | RISE151 | 竜哉・エイワスポーツジム | エイワスポーツジム | https://rise-rc.com/fighter/kazushima_riku/ |
| ryota-nakano | 中野椋太 | 2022-02-06 | NJKF 2022 west 1st | チャンスック・バーテックスジム |  | https://rise-rc.com/fighter/nakano_ryota/ |
| ryoya-inai | 稲井良弥 | 2025-11-09 | RISE193 | シンパヤック･ハマジム | HAMA・GYM | https://rise-rc.com/fighter/inai_ryoya/ |
| ryu-hanaoka | 花岡 竜 | 2023-02-11 | NO KICK NO LIFE | サンチャイ・TEPPENGYM | TEAM TEPPEN | https://rise-rc.com/fighter/hanaoka_ryu/ |
| ryuta-suekuni | 末國龍汰 | 2022-12-11 | Road to ONE Japan ＆ BOM 37 | 名高・エイワスポーツジム | エイワスポーツジム | https://rise-rc.com/fighter/suekuni_ryuta/ |
| ryuya-koide | 小出龍哉 | 2020-09-20 | RISE EVOL.6 | 虎二郎・FLYSKYGYM | FLY SKY GYM | https://rise-rc.com/fighter/koide_ryuya/ |
| sakai-yuzuki | 酒井柚樹 | 2021-12-12 | RISE153 | 竜哉・エイワスポーツジム | エイワスポーツジム | https://rise-rc.com/fighter/sakai_yuzuki/ |
| seiki-ueyama | 植山征紀 | 2021-11-14 | Cygames presents RISE WORLD SERIES 2021 OSAKA2 | 京谷祐希（山口道場）※偶然のバッティングにより3R 1分02秒までの途中判定 |  | https://rise-rc.com/fighter/ueyama_seiki/ |
| sho-ogawa | 小川翔 | 2022-12-18 | HOOST CUP KINGS NAGOYA 12 | シリモンコン・PKセンチャイジム | タイ/TYTムエタイジム | https://rise-rc.com/fighter/ogawa_sho/ |
| sota-cerberus-kimura | 木村“ケルベロス”颯太 | 2025-06-29 | RISE189 | スアレック・TEPPEN GYM | TEAM TEPPEN | https://rise-rc.com/fighter/kimura_cerberus_sota/ |
| strong-kobayashi | ストロング小林 | 2022-08-28 | PEACE | タムランナックFELLOWGYM | FELLOWGYM | https://rise-rc.com/fighter/strong_kobayashi/ |
| takigami-shota | 滝上 正太 | 2023-01-28 | RISE164 | アティ・フェロージム | FELLOWGYM | https://rise-rc.com/fighter/takigami_shota/ |
| takumi-sanekata | 實方拓海 | 2025-07-25 | RISE190 | シンパヤック・ハマジム | HAMA・GYM | https://rise-rc.com/fighter/sanekata_takumi/ |
| tatsuto | 龍翔 | 2021-12-19 | PROFESSIONAL SHOOTO 2021 Vol.8 in OSAKA | 澤谷大樹（HAWK GYM |  | https://rise-rc.com/fighter/tatsuto/ |
| tatsuya-inaishi | 稲石竜弥 | 2020-11-08 | スーパービッグバン2020 | 昇也（士魂村上塾 |  | https://rise-rc.com/fighter/inaishi_tatsuya/ |
| tenshin-nasukawa | 那須川天心 | 2019-07-21 | Cygames presents RISE WORLD SERIES 2019 2nd Round in Osaka | スアキム・PKセンチャイムエタイジム | PKセンチャイムエタイジム | https://rise-rc.com/fighter/nasukawa_tenshin/ |
| tenshin-nasukawa | 那須川天心 | 2016-12-05 | KNOCK OUT Vol.0 | ワンチャロン・PKセンチャイジム | タイ | https://rise-rc.com/fighter/nasukawa_tenshin/ |
| thalisson-crazy-cyclone | タリソン“Crazy Cyclone”フェレイラ | 2019-03-10 | Cygames presents RISE WORLD SERIES 2019 1st Round | スアキム・PKセンチャイムエタイジム | PKセンチャイムエタイジム | https://rise-rc.com/fighter/thalisson-crazy-cyclone/ |
| umeno-genji | 梅野源治 | 2021-09-26 | BOM-ouroboros 2021- | ロンペット・Y'ZD ジム | Y'ZD豊見城 | https://rise-rc.com/fighter/umeno_genji/ |
| umeno-genji | 梅野源治 | 2021-04-11 | BOM WAVE04-Get Over The COVID-19- | キヨソンセン ・フライスカイジム | FLYSKY GYM | https://rise-rc.com/fighter/umeno_genji/ |
| umeno-genji | 梅野源治 | 2021-02-28 | RISE Eldorado 2021 | ノラシン・スペチアーレジム |  | https://ja.wikipedia.org/wiki/%E6%A2%85%E9%87%8E%E6%BA%90%E6%B2%BB |
| yaman | YA-MAN | 2018-07-16 | RISE126 | 甲斐康介（HAYATO GYM |  | https://rise-rc.com/fighter/ya-man/ |
| yugo-kato | 加藤有吾 | 2022-03-13 | JAPAN KICKBOXING INNOVATION 認定 第8回 岡山ジム主催興行 | 壱・センチャイジム | センチャイムエタイジム | https://rise-rc.com/fighter/kato_yugo/ |
| yuki-kasahara | 笠原友希 | 2023-09-23 | SHOOT BOXING 2023 act.4 | シンダム・サンライズジム | タイ | https://rise-rc.com/fighter/kasahara_yuki/ |
| yuya | 憂也 | 2024-06-15 | RISE WORLD SERIES 2024 OSAKA | シンパヤック・ハマジム | タイ/HAMA・GYM | https://rise-rc.com/fighter/yuya/ |

### NJKF(60件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| anuwato-geosamurito | アヌワット・ゲーオサムリット | 2010-07-11 | ニュージャパンキックボクシング連盟「MuayThai Open 12」 | 心・センチャイジム |  | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%8C%E3%83%AF%E3%83%83%E3%83%88%E3%83%BB%E3%82%B2%E3%83%BC%E3%82%AA%E3%82%B5%E3%83%A0%E3%83%AA%E3%83%83%E3%83%88 |
| ashizawa-ryuusei | 芦澤竜誠 | 2013-02-24 | NJKF MuayThaiOpen 23 | 洋・センチャイジム |  | https://ja.wikipedia.org/wiki/%E8%8A%A6%E6%BE%A4%E7%AB%9C%E8%AA%A0 |
| atomuyamada | アトム山田 | 2009-09-23 | ROAD TO REAL KING 11 | 心センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/0923-4.html |
| banna | 繁那 | 2025-12-14 | 12月14日(日) WORLD ROAD 試合結果 | シャーク·チャラムスックジム | タイ/チャラムスックムエタイジム | https://www.njkf.info/result/20251214_worldroad.html |
| endou-tomofumi | 遠藤智史 | 2008-01-27 | ニュージャパンキックボクシング連盟 「START OF NEW LEGEND 〜新伝説の始まり〜 Start Me Up!!」 | ソンクラー・センチャイジム |  | https://ja.wikipedia.org/wiki/%E9%81%A0%E8%97%A4%E6%99%BA%E5%8F%B2 |
| hayama-syohei | 葉山 翔平 | 2014-03-16 | TREASURE HUNT Ⅴ | 広センチャイジム | センチャイムエタイ | https://www.njkf.info/result2014/0316-4.html |
| hisai-taimu | 久井 大夢 | 2024-06-02 | NJKF CHALLENGER 2024 3rd | テーパプット・シンコウムエタイジム | タイ | https://www.njkf.info/result/20240602_njkf-challenger.html |
| ishiguro-tatsuya | 石黒竜也 | 2008-11-30 | NJKF "START OF NEW LEGEND XIV 〜新しい伝説の始まり〜 Muay Thai Open 6" | クンスック・アラビアジム |  | https://ja.wikipedia.org/wiki/%E7%9F%B3%E9%BB%92%E7%AB%9C%E4%B9%9F |
| kenta | 健太 | 2015-09-27 | NJKF 2015 6th | セイサック・エスジム | タイ | https://www.njkf.info/result2015/0927-3.html |
| kiyoto-takahashi | 髙橋聖人 | 2019-06-23 | NJKF 2019 west 3rd | tatsu魅 TEAM武心會) NJKFフェザー級王者 |  | https://www.njkf.info/result2019/0623-4.html |
| kouji | 皇治 | 2010-06-13 | 熱風 零伍【BANZAI ATTACK Ⅰ】 | 謙センチャイジム | センチャイムエタイ | https://www.njkf.info/result2010/0613-5.html |
| kubo-kenji | 久保賢司 | 2007-01-28 | ニュージャパンキックボクシング連盟 「FIGHTING EVOLUTION II 〜進化する戦い〜 MUAYTHAI OPEN」 | サッミングノム・SKVジム |  | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E8%B3%A2%E5%8F%B8 |
| kubo-yuuta | 久保優太 | 2007-05-13 | ニュージャパンキックボクシング連盟「FIGHTING EVOLUTION VI 〜進化する戦い 6th〜」 | ファーカムワーン・SKVジム |  | https://ja.wikipedia.org/wiki/%E4%B9%85%E4%BF%9D%E5%84%AA%E5%A4%AA |
| kumura-shuhei | 玖村 修平 | 2017-09-24 | NJKF 2017 3rd | コンバンノー･エスジム | タイ | https://www.njkf.info/result2017/0924-4.html |
| kunitaka | 国崇 | 2017-09-03 | DUEL.11 | チャーオサム・エスジム | タイ | https://www.njkf.info/result2017/0903.html |
| kunitaka | 国崇 | 2016-02-07 | DUEL.4 | ゴンバンノー・エスジム | エスジム | https://www.njkf.info/result2016/0207-5.html |
| kurata-mitsutoshi | 倉田 光敏 | 2009-10-12 | ROAD TO REAL KING 13【Muay Thai Open 9】 | 洋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/1012-2.html |
| matsufuji-mai | 松藤 麻衣 | 2024-04-14 | 4月14日 GODDESS OF VICTORY Ⅱ 試合結果 | Muupar まどかポンムエタイジム | ポンムエタイジム | https://www.njkf.info/result/20240414-goddess-of-victory-ii.html |
| mika | ☆MIKA☆ | 2009-12-23 | ROAD TO REAL KING 15【Muay Thai Open 10】 | 悦センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/1223.html |
| miku-144 | MIKU | 2024-03-31 | 3月31日 絆XV 試合結果 | RUI・JANJIRA (JANJIRAGYM | ジャンジラジム) | https://www.njkf.info/result/20240331_kizuna15.html |
| miyakoshi-keijiro | 宮越 慶二郎 | 2013-07-15 | NJKF 2013 4th | 翔センチャジム | センチャイムエタイ | https://www.njkf.info/result2013/0715-5.html |
| miyakoshi-soichiro | 宮越 宗一郎 | 2009-10-12 | ROAD TO REAL KING 13【Muay Thai Open 9】 | クンスック・アラビアジム | タイ | https://www.njkf.info/result2009/1012-2.html |
| momotaro | MOMOTARO | 2012-11-25 | KICK TO THE FUTURE 9 | 裕センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/1125-2.html |
| momotaro | MOMOTARO | 2012-10-21 | Muay Thai Open 22 | 晋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/1021-3.html |
| momotaro | MOMOTARO | 2012-07-15 | BE MY SELF ～自分らしく～ | 謙センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/0715-4.html |
| nagasaki-hideya | 長崎秀哉 | 2010-03-28 | 熱風 零参 | 心センチャイジム | センチャイムエタイ | https://www.njkf.info/result2010/0328-3.html |
| nakajima-heihachi | 中嶋平八 | 2011-11-03 | NEW JAPAN BLOOD 9 | レッグ・エスジム | タイ | https://www.njkf.info/result2011/1103-3.html |
| nakajima-heihachi | 中嶋平八 | 2009-03-22 | ROAD TO REAL KING 3 | 心センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/0322-4.html |
| nakajima-heihachi | 中嶋平八 | 2008-07-06 | ニュージャパンキックボクシング連盟「Muay Thai Heritage 2」<!--センチャイムエタイジム主催--> | 洋・センチャイジム |  | https://ja.wikipedia.org/wiki/%E4%B8%AD%E5%B6%8B%E5%B9%B3%E5%85%AB |
| nishiyama-makoto | 西山誠人 | 2007-12-09 | ニュージャパンキックボクシング連盟「MuayThai Heritage」 | ソンクラー・センチャイジム |  | https://ja.wikipedia.org/wiki/%E8%A5%BF%E5%B1%B1%E8%AA%A0%E4%BA%BA |
| sakurai-youhei | 桜井洋平 | 2001-06-24 | ニュージャパンキックボクシング連盟「CHALLENGE TO MUAI-THAI 9」 | カチャスック・ジャンボジム |  | https://ja.wikipedia.org/wiki/%E6%A1%9C%E4%BA%95%E6%B4%8B%E5%B9%B3 |
| satou-tomonori | 佐藤友則 | 2012-10-21 | ニュージャパンキックボクシング連盟 「MuayThaiOpen 22」 | ポンパン・エスジム |  | https://ja.wikipedia.org/wiki/%E4%BD%90%E8%97%A4%E5%8F%8B%E5%89%87 |
| satou-tomonori | 佐藤友則 | 2007-07-29 | ニュージャパンキックボクシング連盟 「Fighting Evolution IX MUAY Thai Open」 | ラッタナデェ・KTジム |  | https://ja.wikipedia.org/wiki/%E4%BD%90%E8%97%A4%E5%8F%8B%E5%89%87 |
| satou-tomonori | 佐藤友則 | 2007-03-18 | ニュージャパンキックボクシング連盟 「FIGHTING EVOLUTION III〜進化する戦い〜3KINGS　チャンピオンカーニバル」 | ラッタナデェ・KTジム |  | https://ja.wikipedia.org/wiki/%E4%BD%90%E8%97%A4%E5%8F%8B%E5%89%87 |
| seimiya-taku | 清宮 拓 | 2010-03-07 | 熱風 零弐【Muay Thai Open 11】 | 晋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2010/0307-2.html |
| shoko-jsk | 祥子JSK | 2025-12-14 | 12月14日(日) WORLD ROAD 試合結果 | ユリカ グラップリングシュートボクサーズジム | GSB 名古屋 | https://www.njkf.info/result/20251214_worldroad.html |
| shota-saenchaigym | 翔・センチャイジム | 2013-02-24 | Muay Thai Open 23 | コンゲンチャイ・エスジム | タイ | https://www.njkf.info/result2013/0224-4.html |
| suzuki-shoya | 鈴木 翔也 | 2013-06-30 | Muay Thai Open 24 | 広センチャイジム | センチャイムエタイ | https://www.njkf.info/result2013/0630-3.html |
| suzuki-shoya | 鈴木 翔也 | 2009-08-30 | ROAD TO REAL KING 10【GO FOR BROKE】 | 洋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/0830-2.html |
| taaaachan-185 | TAaaaCHAN | 2023-08-11 | 8月11日 絆 XIV 試合結果 | シンダム・サンライズジム | サンライズジム | https://www.njkf.info/result/20230811_kizuna14.html |
| takahashi-seiji | 高橋 誠治 | 2013-10-14 | NJKF 2013 7th | 翔センチャイジム | センチャイムエタイ | https://www.njkf.info/result2013/1014-4.html |
| takahashi-seiji | 高橋 誠治 | 2012-11-25 | KICK TO THE FUTURE 9 | デェパノム・センチャイジム | タイ | https://www.njkf.info/result2012/1125-2.html |
| takuma-2 | 琢磨 | 2022-11-13 | 11月13日 NJKF2022 4th 試合結果 | コンゲンチャイ・エスジム | エスジム | https://www.njkf.info/result/njkf2022-4th.html |
| takuma-2 | 琢磨 | 2012-04-29 | KICK TO THE FUTURE 2 | 洋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/0429-2.html |
| takumi-2 | 匠 | 2023-09-17 | NJKF 2023 4th | コウキ・バーテックスジム | VERTEX | https://www.njkf.info/result/20230917_njkf_4th.html |
| takuya-316 | TAKUYA | 2023-04-16 | 4月16日 NJKF 2023 2nd 試合結果 | ガン・エスジム | エスジム | https://www.njkf.info/result/njkf-2023-2nd.html |
| takuya-316 | TAKUYA | 2012-05-26 | Muay Thai Open 20 | 晋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/0526-2.html |
| tanaka-masashi | 田中 将士 | 2009-04-12 | ROAD TO REAL KING 7【GO FOR BROKE】 | 洋センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/0412-5.html |
| teyon | テヨン | 2016-02-21 | NJKF 2016 1st | セイサック・エスジム | タイ | https://www.njkf.info/result2016/0221-4.html |
| teyon | テヨン | 2012-09-22 | KICK TO THE FUTURE 6 | 獏センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/0922-2.html |
| utsunomiya-joe | 宇都宮 城 | 2009-10-12 | ROAD TO REAL KING 13【Muay Thai Open 9】 | セーンアティット・サシプラパジム | タイ | https://www.njkf.info/result2009/1012-2.html |
| watabe-shota | 渡部 翔太 | 2013-02-24 | Muay Thai Open 23 | デェパノム・センチャイジム | タイ | https://www.njkf.info/result2013/0224-4.html |
| yamato-tetsuya | 大和 哲也 | 2015-05-10 | NJKF 2015 3rd | ゴーンサック・P.K.セーンチャイムエタイジム | タイ | https://www.njkf.info/result2015/0510-6.html |
| yamazaki-yoichi | 山崎 陽一 | 2010-12-05 | Muay Thai Open 14 | 影センチャイジム | センチャイムエタイ | https://www.njkf.info/result2010/1205-3.html |
| yoneda-takashi | 米田貴志 | 2010-05-09 | 熱風 零四 | 心センチャイジム | センチャイムエタイ | https://www.njkf.info/result2010/0509-6.html |
| yoneda-takashi | 米田貴志 | 2005-10-09 | ニュージャパンキックボクシング連盟 「INFINITE CHALLENGE IX 〜無限の挑戦〜」 | サナパー・コビットジム |  | https://ja.wikipedia.org/wiki/%E7%B1%B3%E7%94%B0%E8%B2%B4%E5%BF%97 |
| yosuke-mizuochi | 水落洋祐 | 2013-04-29 | NJKF 2013 3rd | 翔センチャジム | センチャイムエタイ | https://www.njkf.info/result2013/0429-3.html |
| yosuke-mizuochi | 水落洋祐 | 2009-04-26 | ROAD TO REAL KING 5【Muay Thai Open 7】 | 心センチャイジム | センチャイムエタイ | https://www.njkf.info/result2009/0426-3.html |
| yuma | 勇磨 | 2012-03-25 | Muay Thai Open 19 | 貴センチャイジム | センチャイムエタイ | https://www.njkf.info/result2012/0325-4.html |
| yuma | 勇磨 | 2011-12-04 | Muay Thai Open 18 | 貴センチャイジム | センチャイムエタイ | https://www.njkf.info/result2011/1204-3.html |

### KNOCK OUT(48件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| banna | 繁那 | 2025-10-12 | MAROOMS presents KNOCK OUT.58 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/banna_443 |
| banna | 繁那 | 2025-10-12 | KNOCK OUT.58 | 壱•センチャイジム |  | https://ja.wikipedia.org/wiki/%E7%B9%81%E9%82%A3 |
| chokdee-pk-saenchaimuaythaigym | チョークディー・PKセンチャイジム | 2024-06-23 | MAROOMS presents KNOCK OUT CARNIVAL 2024 SUPER BOUT “BLAZE” | 壱・センチャイジム |  | https://knockoutkb.com/fighters/chokdee_pk_saenchaimuaythaigym |
| fukuda-kaito | 福田 海斗 | 2026-05-10 | KNOCK OUT REBELS SERIES.10 | スラサック・クルーダームジム |  | https://knockoutkb.com/fighters/fukuda_kaito_564 |
| furuki-seiya | 古木 誠也 | 2023-12-09 | MAROOMS presents KNOCK OUT 2023 vol.6 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/furuki_seiya |
| furumura-hikaru | 古村 光 | 2026-02-15 | MAROOMS presents KNOCK OUT.61 | スラサック・クルーダームジム |  | https://knockoutkb.com/fighters/furumura_hikaru_68 |
| furumura-hikaru | 古村 光 | 2023-08-06 | MAROOMS presents KNOCK OUT 2023 vol.3 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/furumura_hikaru_68 |
| furumura-hikaru | 古村 光 | 2021-03-13 | KNOCK OUT ～The REBORN～ | 壱・センチャイジム |  | https://knockoutkb.com/fighters/furumura_hikaru_68 |
| geoganwan-so-amunuwaide | ゲーオガンワーン・ソー.アムヌワイデッー | 2026-03-14 | MAROOMS presents KNOCK OUT.62 | 弘・センチャイジム |  | https://knockoutkb.com/fighters/kaewganwan_sor_amnuwaides_411 |
| hisai-taimu | 久井 大夢 | 2024-09-21 | MAROOMS presents KNOCK OUT 2024 vol.4 | ペップンソン・フォームドジム |  | https://knockoutkb.com/fighters/hisai_taimu |
| hisai-taimu | 久井 大夢 | 2023-12-09 | MAROOMS presents KNOCK OUT 2023 vol.6 | トンミーチャイ・FELLOW GYM |  | https://knockoutkb.com/fighters/hisai_taimu |
| ishikawa-naoki-2 | 石川 直樹 | 2025-09-23 | MAROOMS presents KNOCK OUT.57 | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/ishikawa_naoki_229 |
| issei-saenchai-gym | 壱・センチャイジム | 2024-06-23 | MAROOMS presents KNOCK OUT CARNIVAL 2024 SUPER BOUT “BLAZE” | チョークディー・PKセンチャイジム |  | https://knockoutkb.com/fighters/issei_saenchaigym |
| katashima-satoshi | 片島 聡志 | 2023-11-05 | MAROOMS presents KNOCK OUT 2023 vol.5 “RED ZONE” | 壱・センチャイジム |  | https://knockoutkb.com/fighters/katashima_satoshi_122 |
| kawano-ryuki | 川野 龍輝 | 2024-04-27 | MAROOMS presents KNOCK OUT 2024 vol.2 | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/kawano_ryuki |
| kobayashi-arina | 小林愛理奈 | 2026-05-15 | MAROOMS presents KNOCK OUT.64 | プードゥアン・コマンドジム |  | https://knockoutkb.com/fighters/kobayashi_arina_545 |
| krungthai-tded99-514 | クルンタイ・ティーデッド99 | 2026-04-18 | REMY presents KNOCK OUT.63 KNOCK OUT SPRING FES in OKINAWA | 壱・センチャイジム |  | https://knockoutkb.com/fighters/krungthai_tded99_514 |
| kyoha | 響波 | 2023-03-05 | MAROOMS presents KNOCK OUT 2023 SUPER BOUT “BLAZE” | 壱・センチャイジム |  | https://knockoutkb.com/fighters/kyoha_168 |
| kyoken-jin | “狂拳”迅 | 2026-08-08 | REMY presents KNOCK OUT.67 ～KNOCK OUT SUMMER JAM in OSAKA～ | スラサック・クルーダームジム |  | https://knockoutkb.com/fighters/kyoken_jin_446 |
| maeda-shota | 前田 翔太 | 2024-12-30 | K.O CLIMAX 2024 | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/maeda_shota_110 |
| maeda-taison | 前田 大尊 | 2026-02-15 | MAROOMS presents KNOCK OUT.61 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/maeda_taison_319 |
| maeda-taison | 前田 大尊 | 2024-12-30 | K.O CLIMAX 2024 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/maeda_taison_319 |
| morioka-yuki | 森岡 悠樹 | 2025-06-22 | THE KNOCK OUT | 壱・センチャイジム |  | https://knockoutkb.com/fighters/morioka_yuki_111 |
| morioka-yuki | 森岡 悠樹 | 2024-12-30 | K.O CLIMAX 2024 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/morioka_yuki_111 |
| morioka-yuki | 森岡 悠樹 | 2022-11-19 | MAROOMS presents KNOCK OUT 2022 vol.7 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/morioka_yuki_111 |
| morioka-yuki | 森岡 悠樹 | 2021-08-22 | SACRED FORCE presents KNOCK OUT-EX 2021 vol.3 ～RED FIGHT～ | 壱・センチャイジム |  | https://knockoutkb.com/fighters/morioka_yuki_111 |
| ogasawara-eisaku | 小笠原 瑛作 | 2023-06-11 | MAROOMS presents KNOCK OUT 2023 vol.2 | トンミーチャイ・FELLOW GYM |  | https://knockoutkb.com/fighters/ogasawara_eisaku |
| ogasawara-eisaku | 小笠原 瑛作 | 2021-11-28 | KNOCK OUT 2021 vol.6 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/ogasawara_eisaku |
| ono-takashi | 大野 貴志 | 2022-09-23 | KNOCK OUT 2022 vol.5 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/ono_takashi_176 |
| otani-shoji | 大谷 翔司 | 2024-12-01 | MAROOMS presents KNOCK OUT 2024 vol.6 | セーンダオレック・スターライトジム |  | https://knockoutkb.com/fighters/otani_shoji |
| otani-shoji | 大谷 翔司 | 2024-06-23 | MAROOMS presents KNOCK OUT CARNIVAL 2024 SUPER BOUT “BLAZE” | セーンダオレック・スターライトジム |  | https://knockoutkb.com/fighters/otani_shoji |
| otsu-riku | 乙津 陸 | 2026-08-02 | MAROOMS presents KNOCK OUT.66 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/otsu_riku_124 |
| otsu-riku | 乙津 陸 | 2023-11-05 | MAROOMS presents KNOCK OUT 2023 vol.5 “RED ZONE” | サンチャイ・TEPPEN GYM |  | https://knockoutkb.com/fighters/otsu_riku_124 |
| shigemori-yota | 重森 陽太 | 2024-04-27 | MAROOMS presents KNOCK OUT 2024 vol.2 | セーンダオレック・スターライトジム |  | https://knockoutkb.com/fighters/shigemori_yota |
| shigemori-yota | 重森 陽太 | 2023-11-05 | MAROOMS presents KNOCK OUT 2023 vol.5 “RED ZONE” | ルンペット・センチャイジム |  | https://knockoutkb.com/fighters/shigemori_yota |
| shinjiro | 辰次郎 | 2025-09-23 | MAROOMS presents KNOCK OUT.57 | ペップンソン・フォームドジム |  | https://knockoutkb.com/fighters/shinjiro_295 |
| shirahata-yusei | 白幡 裕星 | 2021-09-25 | KNOCK OUT 2021 vol.4 | サンチャイ・TEPPEN GYM |  | https://knockoutkb.com/fighters/shirahata_yusei_211 |
| shuri | 珠璃 | 2025-10-05 | KNOCK OUT REBELS SERIES.6 | 真秀鷹虎センチャイジム |  | https://knockoutkb.com/fighters/shuri_448 |
| takahashi-kota | 髙橋 亨汰 | 2025-06-22 | THE KNOCK OUT | セーンダオレック・スターライトジム |  | https://knockoutkb.com/fighters/takahashi_kota |
| tanaka-shodai | 田中 頌大 | 2024-06-23 | MAROOMS presents KNOCK OUT CARNIVAL 2024 SUPER BOUT “BLAZE” | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/tanaka_shodai |
| tenshin-nasukawa | 那須川天心 | 2018-02-12 | KNOCK OUT FIRST IMPACT | スアキム・PKセンチャイムエタイジム |  | https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83 |
| tsujii-wakana | 辻井和奏 | 2026-08-02 | MAROOMS presents KNOCK OUT.66 | ルアンペー・コマンドジム |  | https://knockoutkb.com/fighters/tsujii_wakana_501 |
| tsuzaki-yoshiro | 津崎 善郎 | 2025-07-20 | MAROOMS presents KNOCK OUT.55 | ファーワンマイ・センチャイジム |  | https://knockoutkb.com/fighters/tsuzaki_yoshiro_108 |
| umeno-genji | 梅野源治 | 2016-12-05 | KNOCK OUT vol.0 | シリモンコン・PK・センチャイムエタイジム |  | https://ja.wikipedia.org/wiki/%E6%A2%85%E9%87%8E%E6%BA%90%E6%B2%BB |
| yamakawa-toshihiro | 山川敏弘 | 2026-05-15 | MAROOMS presents KNOCK OUT.64 | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/yamakawa_toshihiro_562 |
| yokono-hiro | 横野 洋 | 2022-01-22 | KNOCK OUT 2022 vol.1 | 壱・センチャイジム |  | https://knockoutkb.com/fighters/yokono_hiro_230 |
| yuto-3 | 優翔 | 2025-04-06 | MAROOMS presents KNOCK OUT 2025 vol.2 | ソンピチャイ・センチャイジム |  | https://knockoutkb.com/fighters/yuto |
| yuzuki | 柚子貴 | 2025-06-01 | KNOCK OUT REBELS SERIES. 3 | 蒔・センチャイジム |  | https://knockoutkb.com/fighters/yuzuki_101 |

### SHOOT BOXING(47件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| arao-yuta | 荒尾 祐太 | 2024-12-29 | プロフェッショナル修斗公式戦 PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | シンパヤック・ハマジム | タイ | https://shootboxing.org/fighter/arao_yuta/ |
| arima-reiji | 有馬 伶弐 | 2026-06-21 | SHOOT BOXING 2026 act.3 | ピラポン・ノーナクシンジム | タイ | https://shootboxing.org/fighter/arima_reiji/ |
| doi-hiroyuki | 土井広之 | 2005-01-23 | SHOOT BOXING 2005 GROUND ZERO FUKUOKA | パジョンスック・SKVジム |  | https://ja.wikipedia.org/wiki/%E5%9C%9F%E4%BA%95%E5%BA%83%E4%B9%8B |
| hiroki-kasahara | 笠原弘希 | 2022-09-17 | SHOOT BOXING 2022 act.4 | ロンペット・Y'ZDGYM | タイ | https://shootboxing.org/fighter/kasahara_hiroki/ |
| hiroki-kasahara | 笠原弘希 | 2021-09-04 | SHOOT BOXING 2021 act.4 | パランラック・FELLOWGYM |  | https://shootboxing.org/fighter/kasahara_hiroki/ |
| hiroki-kasahara | 笠原弘希 | 2017-02-11 | SHOOT BOXING 2017 act.1 | 賢一 Tenclober Gym |  | https://shootboxing.org/fighter/kasahara_hiroki/ |
| imoto-borukeno | イモト・ボルケーノ | 2022-07-24 | SHOOTBOXING 2022 YOUNG CAESER CUP CENTRAL #30 “DEAD or ALIVE 04” | シンパヤック・YZDGYM | タイ | https://shootboxing.org/fighter/imoto_volcano/ |
| imoto-borukeno | イモト・ボルケーノ | 2018-08-11 | SHOOTBOXING in MONGOLIA 2018 -SHINOBU FIGHT- | チングン新小岩ジム |  | https://shootboxing.org/fighter/imoto_volcano/ |
| imoto-borukeno | イモト・ボルケーノ | 2017-12-18 | SHOOTBOXING 2017 ヤングシーザー杯 in 花やしき act.5 | チングン新小岩ジム |  | https://shootboxing.org/fighter/imoto_volcano/ |
| imoto-borukeno | イモト・ボルケーノ | 2017-05-13 | SHOOTBOXING 2017 ヤングシーザー杯 in 花やしき act.2 | チングン新小岩ジム |  | https://shootboxing.org/fighter/imoto_volcano/ |
| kaito-2 | 海人 | 2022-02-13 | SHOOT BOXING 2022 act.1 | チューチャイ・ハーデスワークアウトジム |  | https://shootboxing.org/fighter/kaito/ |
| kaito-2 | 海人 | 2021-12-26 | SHOOT BOXING 2021 Champion Carnival | ジョー・FELLOWGYM |  | https://shootboxing.org/fighter/kaito/ |
| kaito-2 | 海人 | 2021-09-04 | SHOOT BOXING 2021 act.4 | チャンスック・バーテックスジム |  | https://shootboxing.org/fighter/kaito/ |
| kaito-2 | 海人 | 2018-06-10 | SHOOT BOXING 2018 act.3 | ジャオウェハー・シーリーラックジム |  | https://shootboxing.org/fighter/kaito/ |
| katayama-kai | 片山 魁 | 2026-04-11 | SHOOT BOXING 2026 act.2 | サンチャイ・TEPPENGYM | タイ | https://shootboxing.org/fighter/katayama_kai/ |
| keito-naito | 内藤啓人 | 2022-04-24 | BOM WAVE08 -Get Over The COVID-19- | 名高・エイワスポーツジム |  | https://shootboxing.org/fighter/naito_keito/ |
| kikuchi-minori | 菊地美乃里 | 2024-11-17 | SHOOTBOXING 2024 YOUNG CAESER CUP CENTRAL #35/MAX FC JAPAN“DEAD or ALIVE 09” | ユリカ・グラップリングシュートボクサーズジム | グラップリングシュートボクサーズ | https://shootboxing.org/fighter/kikuchi_minori/ |
| kitagawa-yuki | 北川 裕紀 | 2021-04-25 | HEAT 48 | ワンチャルーム・スペチアーレジム |  | https://shootboxing.org/fighter/kitagawa_yuki/ |
| koyata-yamada | 山田虎矢太 | 2025-08-09 | SHOOT BOXING 2025 act.4 | ペップンソン・フォームドジム | タイ | https://shootboxing.org/fighter/koyata_yamada/ |
| koyata-yamada | 山田虎矢太 | 2021-12-20 | SHOOT BOXING 2021 ヤングシーザー杯 | ポーン・シリラックムエタイジム |  | https://shootboxing.org/fighter/koyata_yamada/ |
| mina | MINA | 2018-07-06 | SHOOT BOXING Girls S-cup ～48㎏世界トーナメント2018〜 | ペットローイエット・ハイランドジム |  | https://ja.wikipedia.org/wiki/%E6%AB%BB%E4%BA%95%E6%9C%AA%E5%A5%88 |
| mina-2 | 未奈 | 2018-07-06 | SHOOT BOXING Girls S-cup ～48㎏世界トーナメント2018〜 | ペットローイエット・ハイランドジム |  | https://shootboxing.org/fighter/mina/ |
| misaki | MISAKI | 2024-04-13 | SHOOT BOXING 2024 act.2 | ホンカンラヤー・ゴー・パーサージム | タイ | https://shootboxing.org/fighter/misaki/ |
| misaki | MISAKI | 2023-06-25 | SHOOT BOXING 2023 act.3 | ホンヨック・パッサノンジム | タイ | https://shootboxing.org/fighter/misaki/ |
| murata-kiyoaki | 村田 聖明 | 2022-09-17 | SHOOT BOXING 2022 act.4 | シンパヤック・YZDGYM | タイ | https://shootboxing.org/fighter/murata_kiyoaki/ |
| murata-kiyoaki | 村田 聖明 | 2022-06-26 | SHOOT BOXING 2022 act.3 | プーパンレック・ジョウジム |  | https://shootboxing.org/fighter/murata_kiyoaki/ |
| murata-kiyoaki | 村田 聖明 | 2019-02-11 | SHOOT BOXING 2019 act.1 | ヒンチャイ・オー.センスックジム |  | https://shootboxing.org/fighter/murata_kiyoaki/ |
| murata-kiyoaki | 村田 聖明 | 2018-06-10 | SHOOT BOXING 2018 act.3 | ヒンチャイ・オー.センスックジム |  | https://shootboxing.org/fighter/murata_kiyoaki/ |
| murata-kiyoaki | 村田 聖明 | 2016-06-05 | SHOOT BOXING2016 act.3 | 賢一 TenCloverGym |  | https://shootboxing.org/fighter/murata_kiyoaki/ |
| naito-ryota | 内藤凌太 | 2022-05-07 | HEAT 50回記念大会 | ノラシン・スペチアーレジム |  | https://shootboxing.org/fighter/naito-ryouta/ |
| ogata-kenichi | 緒形健一 | 2007-02-25 | SHOOT BOXING 2007 無双〜MU-SO〜 其の壱 | ビッグベン・ケーサージム |  | https://ja.wikipedia.org/wiki/%E7%B7%92%E5%BD%A2%E5%81%A5%E4%B8%80 |
| okuyama-takahiro | 奥山 貴大 | 2018-04-01 | SHOOT BOXING 2018 act.2 | チングン新小岩ジム |  | https://shootboxing.org/fighter/okuyama_takahiro/ |
| ookuwa-hiroaki | 大桑 宏章 | 2018-04-01 | SHOOT BOXING 2018 act.2 | 優吾・FLYSKYGYM |  | https://shootboxing.org/fighter/ookuwa_hiroaki/ |
| possiblek | ポッシブルK | 2021-10-17 | HEAT 49 | ワンチャルーム・スペチアーレジム |  | https://shootboxing.org/fighter/possiblek/ |
| seiki-ueyama | 植山征紀 | 2017-03-05 | RISE 116 | 優吾・FLYSKYGYM |  | https://shootboxing.org/fighter/ueyama_seiki/ |
| shishido-hiroki | 宍戸 大樹 | 2016-04-03 | SHOOT BOXING2016 act.2 | ジャオウェハー・シーリーラックジム |  | https://shootboxing.org/fighter/shishido_hiroki/ |
| shishido-hiroki | 宍戸 大樹 | 2007-10-28 | SHOOTBOXING BATTLE SUMMIT GROUND ZERO TOKYO 2007 | ビックベン・ケーサージム |  | https://shootboxing.org/fighter/shishido_hiroki/ |
| shishido-hiroki | 宍戸 大樹 | 2003-04-13 | SHOOTBOXING“S” of the World Vol.2 | テーワリットノーイ・SKVジム |  | https://shootboxing.org/fighter/shishido_hiroki/ |
| shuto-sato | 佐藤執斗 | 2023-06-25 | SHOOT BOXING 2023 act.3 | サンチャイ・TEPPENGYM | タイ | https://shootboxing.org/fighter/satou-syuto/ |
| shuto-sato | 佐藤執斗 | 2021-10-24 | SHOOTBOXING 2021 YOUNG CAESER CUP CENTRAL #28 “MAXFC DEAD or ALIVE 02” | サンチャイ・TEPPENGYM |  | https://shootboxing.org/fighter/satou-syuto/ |
| tatsuya | 竜也 | 2024-03-20 | ACF 100th | プー・ライオンジム | タイ | https://shootboxing.org/fighter/tatsuya/ |
| ueda-kazuya | 上田 一哉 | 2017-04-29 | JAPAN KICKBOXING INNOVATION Join Forces-5 | ソムプラユン・ヒロキDANGER GYM |  | https://shootboxing.org/fighter/ueda_kazuya/ |
| yuki-kasahara | 笠原友希 | 2024-08-17 | SHOOT BOXING 2024 act.4 | ペットモラコット・スーパーボンジム | タイ | https://shootboxing.org/fighter/kasahara_yuuki/ |
| yuki-kasahara | 笠原友希 | 2024-04-19 | ONE Friday Fights 59 | ペットシーモック・PKセンチャイムエタイジム | タイ | https://shootboxing.org/fighter/kasahara_yuuki/ |
| yuki-kasahara | 笠原友希 | 2023-09-24 | SHOOT BOXING 2023 act.4 | シンダム・サンライズジム | タイ | https://shootboxing.org/fighter/kasahara_yuuki/ |
| yuki-kasahara | 笠原友希 | 2021-09-04 | SHOOT BOXING 2021 act.4 | ポーン・シリラックムエタイジム |  | https://shootboxing.org/fighter/kasahara_yuuki/ |
| yuki-kasahara | 笠原友希 | 2019-09-28 | SHOOT BOXING 2019 act.4 | ポンチャン・ブレイブジム |  | https://shootboxing.org/fighter/kasahara_yuuki/ |

### K-1 / Krush / Krush-EX(35件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| abiraru-himarayan-chita | アビラル・ヒマラヤン・チーター | 2022-09-11 | K-1 WORLD GP 2022 JAPAN~よこはまつり~ | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/1121 |
| anpo-riku | 安保 璃紅 | 2019-11-24 | “K-1冬のビッグマッチ 第1弾 横浜”「K-1 WORLD GP 2019 JAPAN ~よこはまつり~」 | ジャオスアヤイ・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/724 |
| ayinta-ali | 寧仁太・アリ | 2023-07-17 | AZABU PRESENTS K-1 WORLD GP 2023~スーパー・ウェルター級&女子フライ級ダブルタイトルマッチ~ | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/988 |
| dariru-ferudonku | ダリル・フェルドンク | 2025-02-09 | K-1 WORLD MAX 2025 | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/1449 |
| egawa-yuuki | 江川 優生 | 2019-11-24 | “K-1冬のビッグマッチ 第1弾 横浜”「K-1 WORLD GP 2019 JAPAN ~よこはまつり~」 | ジャオスアヤイ・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/114 |
| ishida-keisuke | 石田 圭祐 | 2016-06-12 | Krush.66 | ジョッキーレック・GTジム |  | https://www.k-1.co.jp/fighter/107 |
| ishikawa-naoki | 石川直生 | 2012-10-08 | Krush.23 | 翔・センチャイジム |  | https://www.k-1.co.jp/fighter/171 |
| izawa-namito | 伊澤 波人 | 2010-02-19 | Krush-EX 2010 vol.1 | 光センチャイジム |  | https://www.k-1.co.jp/fighter/106 |
| knuckle | 高梨knuckle美穂 | 2019-10-13 | Krush.106 | パヤーフォン・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/889 |
| makihira-keita | 牧平 圭太 | 2012-05-03 | Krush.18 | 翔・センチャイジム |  | https://www.k-1.co.jp/fighter/10 |
| masuko-kohei | 増子 航平 | 2014-12-21 | Krush.48 ~in SENDAI~ | 目黒ヨックタイジム |  | https://www.k-1.co.jp/fighter/407 |
| masumoto-shoya | 桝本 翔也 | 2012-12-14 | Krush.25 | 竜・センチャイジム |  | https://www.k-1.co.jp/fighter/188 |
| matsuoka-riki | 松岡 力 | 2023-12-09 | K-1 ReBIRTH2 | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/842 |
| minamino-takayuki | 南野 卓幸 | 2015-06-12 | Krush.55 | 夢・センチャイジム |  | https://www.k-1.co.jp/fighter/158 |
| mio | MIO | 2022-06-25 | K-1 WORLD GP 2022 JAPAN ~RING OF VENUS~ | パヤーフォン・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/1011 |
| moe | MOE | 2020-02-24 | Krush.111 | パヤーフォン・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/940 |
| morita-naoki | 森田 奈男樹 | 2022-12-03 | K-1 WORLD GP 2022 JAPAN~初代バンタム級王座決定トーナメント~ | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/1177 |
| nori | 訓 -NORI- | 2014-12-21 | Krush.48 ~in SENDAI~ | 菊地ヨックタイジム |  | https://www.k-1.co.jp/fighter/413 |
| osawa-fumiya | 大沢 文也 | 2022-08-11 | ECO信頼サービス株式会社 PRESENTS K-1 WORLD GP 2022 JAPAN~K-1フェザー級世界最強決定トーナメント~ | デンサヤーム・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/216 |
| ozawa-kaito | 小澤 海斗 | 2020-03-22 | K-1 WORLD GP 2020 JAPAN ~K’FESTA.3~ | ジャオスアヤイ・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/176 |
| pita-atsu | ピーター・アーツ | 1999-03-22 | K-1 THE CHALLENGE '99 | ジム・ミューレン |  | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 |
| rei-sefo | レイ・セフォー | 1999-06-06 | K-1 SURVIVAL '99 | ジム・ミューレン |  | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC |
| sasaki-daizo | 佐々木 大蔵 | 2023-06-03 | AZABU PRESENTS K-1 WORLD GP 2023~初代ミドル級王座決定トーナメント~ | パコーン・P.K.センチャイムエタイジム |  | https://www.k-1.co.jp/fighter/280 |
| sasaki-junki | 佐々木洵樹 | 2021-05-30 | K-1 WORLD GP 2021 JAPAN~K-1バンタム級日本最強決定トーナメント~ | ラット・エイワスポーツジム |  | https://www.k-1.co.jp/fighter/949 |
| sugawara-miyuu | 菅原 美優 | 2023-03-12 | K-1 WORLD GP 2023 ~K’FESTA.6~ | パヤーフォン・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/945 |
| sugawara-miyuu | 菅原 美優 | 2022-06-25 | K-1 WORLD GP 2022 JAPAN ~RING OF VENUS~ | パヤーフォン・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/945 |
| suzuki-hayato | 鈴木 勇人 | 2023-03-12 | K-1 WORLD GP 2023 ~K’FESTA.6~ | パコーン・P.K.センチャイムエタイジム |  | https://www.k-1.co.jp/fighter/733 |
| takei-yoshiki | 武居 由樹 | 2020-03-22 | K-1 WORLD GP 2020 JAPAN ~K’FESTA.3~ | デンサヤーム・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/56 |
| tomoki | TOMOKI | 2014-12-21 | Krush.48 ~in SENDAI~ | 佐藤ヨックタイジム |  | https://www.k-1.co.jp/fighter/411 |
| tsuboi-yusuke | 坪井 悠介 | 2010-01-04 | Krush.5 | 洋センチャイジム |  | https://www.k-1.co.jp/fighter/569 |
| urabe-hirotaka | 卜部弘嵩 | 2019-11-24 | “K-1冬のビッグマッチ 第1弾 横浜”「K-1 WORLD GP 2019 JAPAN ~よこはまつり~」 | ジャオスアヤイ・アユタヤファイトジム |  | https://www.k-1.co.jp/fighter/7 |
| urabe-kouya | 卜部功也 | 2014-08-09 | Krush.44 | 翔・センチャイジム |  | https://www.k-1.co.jp/fighter/5 |
| wajima-hiromi | 和島 大海 | 2023-03-12 | K-1 WORLD GP 2023 ~K’FESTA.6~ | ジョムトーン・ストライカージム |  | https://www.k-1.co.jp/fighter/703 |
| watanabe-takeshi-2 | 渡辺 武 | 2012-08-12 | Krush.21 | 翔・センチャイジム |  | https://www.k-1.co.jp/fighter/263 |
| yoshinari | 斐也 | 2015-09-22 | K-1 WORLD GP 2015 ~SURVIVAL WARS~ | HASE・FLYSKYGYM |  | https://www.k-1.co.jp/fighter/650 |

### Bigbang(19件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| atsumu | 鳩 | 2020-02-09 | The Battle Of MuayThai SEASONⅡ vol.7 pt.2 | ポン PITジム |  | https://bigbang-kick.com/atsumu/ |
| degai-taisuke | 出貝泰佑 | 2010-09-23 | REBELS.4 | キョウヘイ・ゴールドライフジム |  | https://bigbang-kick.com/taisuke-degai/ |
| hiroyuki | HIROYUKI | 2020-04-17 | Road to ONE：2nd sponsored by ABEMA | ポン・ピットジム |  | https://bigbang-kick.com/hiroyuki-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| hiroyuki | HIROYUKI | 2019-11-01 | KNOCK OUT 2019 BREAKING DAWN | 壱・センチャイジム |  | https://bigbang-kick.com/hiroyuki-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| hiroyuki | HIROYUKI | 2018-12-09 | 新日本キック SOUL IN THE RING 16 | ピンポンパン・エスジム |  | https://bigbang-kick.com/hiroyuki-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| kido-yasuhiro | 城戸康裕 | 2013-12-01 | Bigbang15 | クンタップ・パラエストラジム |  | https://bigbang-kick.com/%e5%9f%8e%e6%88%b8-%e5%ba%b7%e8%a3%95-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| koki | 晃貴 | 2025-12-21 | Bigbang 54 | サンチャイ・TEPPENGYM |  | https://bigbang-kick.com/%e6%99%83%e8%b2%b4-bigbang%e5%87%ba%e5%a0%b4%e9%81%b8%e6%89%8b%e8%a7%a3%e8%aa%ac/ |
| koyama-yasuaki | 小山泰明 | 2012-04-30 | J-NETWORK J-KICK 2012～NEXT J-GENERATION～2nd | シティーチャイ・ウルフジム |  | https://bigbang-kick.com/yasuaki-koyama/ |
| morii-yosuke | 森井 洋介 | 2018-10-07 | KNOCK OUT 2018 cross over | キヨソンセン・FLYSKYGYM |  | https://bigbang-kick.com/yosuke-morii/ |
| morii-yosuke | 森井 洋介 | 2015-12-13 | MuayThaiOpen33 ＆ Lumpinee Boxing Stadium of Japan | アーミー・サシプラパジム |  | https://bigbang-kick.com/yosuke-morii/ |
| morii-yosuke | 森井 洋介 | 2011-06-12 | M-1 FAIRTEX『がんばろうニッポン！RAORAK MUAY vol,2』 | スワノーイ・エスジム |  | https://bigbang-kick.com/yosuke-morii/ |
| ono-takashi | 大野 貴志 | 2017-04-30 | Festival of Martial Arts～FIGHT FOR PEACE8～ | スワノーイ・エスジム |  | https://bigbang-kick.com/takashi-ono/ |
| ono-takashi | 大野 貴志 | 2015-02-11 | 士道館新春興行MA日本4大タイトルマッチ | ポンパンレック・エスジム |  | https://bigbang-kick.com/takashi-ono/ |
| ono-takashi | 大野 貴志 | 2012-03-18 | BREAK-24 ～SAGITTARIUS～ | 凱センチャイジム |  | https://bigbang-kick.com/takashi-ono/ |
| ono-takashi | 大野 貴志 | 2010-11-27 | BREAK-7～トリプルタイトルマッチ～ | 謙・センチャイジム |  | https://bigbang-kick.com/takashi-ono/ |
| rasta | 良星 | 2013-09-08 | The Battle of Muaythai Ⅱ | 貴センチャイジム |  | https://bigbang-kick.com/rasta/ |
| takeuchi-kenichi | 竹内賢一 | 2019-06-23 | J-FIGHT＆J-GIRLS 2019~2nd~ | コンイサーン・エスジム |  | https://bigbang-kick.com/kenichi-takeuchi/ |
| yamagiwa-kazuki | 山際 和希 | 2011-06-18 | BREAK-14 | ススム・アラビアジム |  | https://bigbang-kick.com/kazuki-yamagiwa/ |
| yamazaki-yoichi | 山崎 陽一 | 2025-11-02 | WEBBWOODS presents Super Bigbang 2025 | ランボー・シンコウジム |  | https://bigbang-kick.com/yoichi-yamazaki/ |

### HoostCup(13件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| daniro-zanorini | ダニロ・ザノリニ | 2016-11-20 | KINGS NAGOYA2 | チューチャイ ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20161120-hoostcup.html |
| daniro-zanorini | ダニロ・ザノリニ | 2016-10-02 | KINGS OSAKA | チューチャイ・ ハーデスワークアウトジム | タイ ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20161002-hoostcup.html |
| daniro-zanorini | ダニロ・ザノリニ | 2014-11-16 | べラジオPRESENTS・HoostCup KINGS WEST-浪速の陣- | チューチャイ・ ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20141116-hoostcup-05.html |
| fujimoto-hiroshi | 藤元 洋次 | 2018-09-02 | 西日本豪雨被害チャリティーHOOST CUP KINGS EHIME〜四国合戦〜 | チューチャイ・ ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20180902-hoostcup.html |
| katsuki-kitano | 北野克樹 | 2017-11-26 | KINGS OSAKA | タップロン・ ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20171126-hoostcup.html |
| kodai | 滉大 | 2021-03-07 | KINGS KYOTO7 | ジュムラウィー・RefinasGym | MUAY THAI SUPER FIGHT推薦 RefinasGym | https://www.hoostcup.com/13fight/20210307-hoostcup.html |
| masashi-yamato | 匡志YAMATO | 2021-12-12 | KINGS NAGOYA10 | チャンスック・ バーテックスジム | バーテックスジム | https://www.hoostcup.com/13fight/20211212-hoostcup.html |
| masashi-yamato | 匡志YAMATO | 2019-12-15 | KINGS NAGOYA7 | チューチャイ・ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20191215-hoostcup.html |
| pk | センチャイ・PKセンチャイムエタイジム | 2014-03-23 | HOOST CUP LEGEND～伝説降臨～ | 翔・センチャイジム |  | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%B3%E3%83%81%E3%83%A3%E3%82%A4%E3%83%BBPK%E3%82%BB%E3%83%B3%E3%83%81%E3%83%A3%E3%82%A4%E3%83%A0%E3%82%A8%E3%82%BF%E3%82%A4%E3%82%B8%E3%83%A0 |
| taishi-hiratsuka | 平塚大士 | 2021-06-20 | KINGS NAGOYA9 | ワンチャルーム・スペチアーレジム | OISHI GYM | https://www.hoostcup.com/13fight/20210620-hoostcup.html |
| takuya-taira | 泰良拓也 | 2022-10-16 | KINGS KYOTO10 | トンFELLOW GYM |  | https://www.hoostcup.com/13fight/20221016-hoostcup.html |
| yamato-tetsuya | 大和 哲也 | 2015-12-27 | KINGS NAGOYA | パコーン・PKセンチャイムエタイジム | PKセンチャイムエタイジム | https://www.hoostcup.com/13fight/20151227-hoostcup.html |
| yamato-yuuya | 大和侑也 | 2018-12-23 | KINGS NAGOYA5 | タップロン・ハーデスワークアウトジム | ハーデスワークアウトジム | https://www.hoostcup.com/13fight/20181223-hoostcup.html |

### 新日本キックボクシング協会(SNKA)(11件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| ishii-hiroki | 石井宏樹 | 2011-10-02 | 新日本キックボクシング協会「MAGNUM 27」 | アピサックK.T.ジム |  | https://ja.wikipedia.org/wiki/%E7%9F%B3%E4%BA%95%E5%AE%8F%E6%A8%B9 |
| ishii-hiroki | 石井宏樹 | 2011-05-15 | 新日本キックボクシング協会「BRAVE HEARTS 16」 | ジャックサヤーム・エックシリコンジム |  | https://ja.wikipedia.org/wiki/%E7%9F%B3%E4%BA%95%E5%AE%8F%E6%A8%B9 |
| ishii-hiroki | 石井宏樹 | 2004-03-21 | 新日本キックボクシング協会「MAGNUM 4」 | パリンヤー・ジョッキージム |  | https://ja.wikipedia.org/wiki/%E7%9F%B3%E4%BA%95%E5%AE%8F%E6%A8%B9 |
| kenshirou | 拳士浪 | 2014-11-16 | 新日本キックボクシング協会 「KICK Insist 4」 | キヨソンセン・FLYSKY GYM（タイ） |  | https://ja.wikipedia.org/wiki/%E6%8B%B3%E5%A3%AB%E6%B5%AA |
| kenshirou | 拳士浪 | 2010-04-17 | 新日本キックボクシング協会 「TITANS NEOS 7」 | リョウ・ヨックタイジム |  | https://ja.wikipedia.org/wiki/%E6%8B%B3%E5%A3%AB%E6%B5%AA |
| kitamura-makoto | 喜多村誠 | 2016-10-23 | 新日本キックボクシング協会/伊原プロモーション「MAGNUM 42」 | ジャントーン・エスジム（カンボジア） |  | https://ja.wikipedia.org/wiki/%E5%96%9C%E5%A4%9A%E6%9D%91%E8%AA%A0 |
| kitamura-makoto | 喜多村誠 | 2014-10-26 | 新日本キックボクシング協会/伊原プロモーション「MAGNUM 36」 | サンムック・キクチジム（タイ） |  | https://ja.wikipedia.org/wiki/%E5%96%9C%E5%A4%9A%E6%9D%91%E8%AA%A0 |
| kitamura-makoto | 喜多村誠 | 2014-04-20 | 新日本キックボクシング協会 「TITANS NEOS 15」 | ゲンナロン・ブリザードジム（タイ） |  | https://ja.wikipedia.org/wiki/%E5%96%9C%E5%A4%9A%E6%9D%91%E8%AA%A0 |
| shigemori-yota | 重森 陽太 | 2019-04-14 | entryBody">TITANS NEOS 25 | ポンシャン・ブレイブジム | 南部ムエサイアムチャンピオン/ ブレイブジム | https://ameblo.jp/skb-blog/entry-12445022905.html |
| takeda-kouzou | 武田幸三 | 2003-01-26 | 新日本キックボクシング協会「DOWN BY LOW」 | チャワリット・ジョッキージム |  | https://ja.wikipedia.org/wiki/%E6%AD%A6%E7%94%B0%E5%B9%B8%E4%B8%89 |
| takeda-kouzou | 武田幸三 | 2000-12-03 | 新日本キックボクシング協会「Fight to Muay-Thai 2000」 | チャワリット・ジョッキージム |  | https://ja.wikipedia.org/wiki/%E6%AD%A6%E7%94%B0%E5%B9%B8%E4%B8%89 |

### JKA(7件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| caz-janjira-88 | CAZ JANJIRA | 2025-11-24 | KICK Insist２５ | ペップンミー・ビクトリージム | タイ／ビクトリージム／元ムエサイアム・イサーン・フライ級2位 | https://jka-japan-kickboxing-association.jp/result/kick-insist%ef%bc%92%ef%bc%95/ |
| minagawa-yuya | 皆川 裕哉 | 2023-10-09 | WARRIOR | チャット・ロックオンジム | タイ／ROCK ON／元ルンピニー認定ミニフライ級7位 | https://jka-japan-kickboxing-association.jp/result/warrior/ |
| nagasawa-samuel-kiyomitsu | 永澤サムエル聖光 | 2022-03-20 | KICK Insist12 | パランラック・FELLOW GYM | タイ／FELLOW GYM／元MAXムエタイ61.5kg王者 | https://jka-japan-kickboxing-association.jp/result/kick-insist12/ |
| nagasawa-samuel-kiyomitsu | 永澤サムエル聖光 | 2021-11-21 | KICK Insist11 | トーンミーチャイ・FELLOW GYM | タイ／元タイ・イサーン地区バンタム級王者 | https://jka-japan-kickboxing-association.jp/result/kick-insist11/ |
| takizawa-hirohito | 瀧澤博人 | 2024-03-24 | KICK Insist１８ | コッチャサーン・FELLOW GYM | タイ／FELLOW GYM／元ルンピニー認定スーパーバンタム級7位 | https://jka-japan-kickboxing-association.jp/result/kick-insist%ef%bc%91%ef%bc%98/ |
| takizawa-hirohito | 瀧澤博人 | 2020-11-23 | KICK Insist10 | ジョムラウィー・REFINAS GYM | タイ／REFINAS GYM／元タイ9chバンタム級王者、元パタヤスタジアム・バンタム級王者 | https://jka-japan-kickboxing-association.jp/result/kick-insist10/ |
| 中尾満 | 中尾満 | 2025-05-25 | Road to KING３ | ペップンミー・ビクトリージム | タイ／ビクトリージム／元タイ・ムエサイアムイサーン・フライ級2位 | https://jka-japan-kickboxing-association.jp/result/road-to-king%ef%bc%93/ |

### DEEP☆KICK(2件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| kitayama-takayoshi | 北山高与志 | 2009-07-05 | DEEP☆KICK 旗揚げ興行 | マット％自演乙％魁塾（タイ／魁塾）※テーチャカリン・チューワッタナから改名 |  | https://www.deep-kick.com/posts/4224826?categoryIds=1233394 |
| kitayama-takayoshi | 北山高与志 | 2009-07-05 | 長島☆自演乙☆雄一郎プロデュース DEEP KICK | マット％自演乙％魁塾 |  | https://ja.wikipedia.org/wiki/%E5%8C%97%E5%B1%B1%E9%AB%98%E4%B8%8E%E5%BF%97 |

### RIZIN(1件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| asahisa-taio | 朝久 泰央 | 2026-04-12 | 大和開発 presents RIZIN LANDMARK 13 in FUKUOKA | シンパヤック・ハマジム |  | https://jp.rizinff.com/_ct/17833713 |

### KROSS×OVER(1件)

| 選手slug | 選手名 | 日付 | 大会名 | 相手名(表示) | 相手所属欄 | 出典URL |
| --- | --- | --- | --- | --- | --- | --- |
| renta-uowanchai | レンタ・ウォーワンチャイ | 2021-03-07 | KROSS×OVER 11 | ラックチャイ・GTジム | GTジム | https://krossover.jp/?p=194 |


---

## 6. 検査D: 名簿の分裂

生の`fighters.json`(3,315件)から同一表記名で複数レコードが存在するグループを抽出したところ、
**14グループ・関係31名。** うち「所属を記号・空白を除いて正規化すると一致する」または「同一相手との
近接日付(±3日)のboutを共有する」の少なくとも一方を満たすペアは **1組。**


### 「海人」: kaito-2 と kaito-3

- 判定理由: 同一相手との近接日付bout共有
- kaito-2: 所属=TEAM F.O.D / 掲載団体=RISE、SHOOT BOXING
- kaito-3: 所属=SHOOT BOXING／TEAM FOD / 掲載団体=KNOCK OUT
- 共有bout: 相手「シッティチャイ・シッソンピーノン」/ kaito-2側日付=2025-12-31(KNOCK OUT.60 ～K.O CLIMAX 2025～) / kaito-3側日付=2025-12-30(MAROOMS presents KNOCK OUT.60 ～K.O CLIMAX 2025～)


**残り13グループ(29名)は、正規化しても所属が一致せず、bout共有も見つからなかった** ため、
「同姓同名の別人」である可能性が高いと判定した(個別の目視確認はしていない。§12参照)。

---

## 7. 検査E: 逆引き未解決

「相手側(Y)のページでは自分(X)がslug解決されているのに、自分(X)側では相手(Y)が未解決になっているbout」
を、Y→X解決済みの行を起点にX側の対応する行(同一相手名・日付±3日)を突き合わせて抽出した。**121件。**

いずれも自分側が`opponentAmbiguous:true`(同名複数候補)で、かつそのうちの1人が実は相手側ページでは
一意に自分へ解決できているケース。**検査Dの名簿分裂と同根の問題であることが多い**(例: 安保瑠輝也×海人の
ケースは、kaito-2/kaito-3への分裂(D)がそのままE(海人側では安保に解決済み、安保側では「同名2人」で
未解決)を引き起こしている)。

該当行全件:

| 選手slug(自分側) | 選手名 | 日付 | 大会名 | 団体 | 自分側に表示された相手名 | 自分側の相手slug | 自分側の解決状態 | 自分側出典URL | 相手側ページでは解決済み(相手情報) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abiraru-himarayan-chita | アビラル・ヒマラヤン・チーター | 2026-03-28 | Krush.188 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1121 | 璃久(riku)の2026-03-28 |
| abiraru-himarayan-chita | アビラル・ヒマラヤン・チーター | 2023-12-09 | K-1 ReBIRTH2 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1121 | 璃久(riku)の2023-12-09 |
| akuseru | 明世流 | 2026-07-20 | ECO信頼サービス株式会社PRESENTS K-1 DONTAKU 2026 | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1266 | 銀次(ginji-2)の2026-07-20 |
| amada-hiromi | 天田ヒロミ | 2002-09-22 | K-1 ANDY SPIRITS 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F | 武蔵(musashi)の2002-09-22 |
| amada-hiromi | 天田ヒロミ | 2000-07-07 | K-1 SPIRITS 2000 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F | 武蔵(musashi)の2000-07-07 |
| amada-hiromi | 天田ヒロミ | 1999-08-22 | K-1 SPIRITS '99 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%94%B0%E3%83%92%E3%83%AD%E3%83%9F | 武蔵(musashi)の1999-08-22 |
| anesuto-hosuto | アーネスト・ホースト | 2001-04-15 | K-1 BURNING 2001 〜火の国熊本初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%BC%E3%83%8D%E3%82%B9%E3%83%88%E3%83%BB%E3%83%9B%E3%83%BC%E3%82%B9%E3%83%88 | 武蔵(musashi)の2001-04-15 |
| anesuto-hosuto | アーネスト・ホースト | 1998-07-18 | K-1 DREAM ’98 〜7対7全面対抗戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%BC%E3%83%8D%E3%82%B9%E3%83%88%E3%83%BB%E3%83%9B%E3%83%BC%E3%82%B9%E3%83%88 | 武蔵(musashi)の1998-07-18 |
| anpo-rukiya | 安保瑠輝也 | 2015-10-03 | SHOOT BOXING THE LAST BOMB | SHOOT BOXING | 海人 | (未解決) | ambiguous(2候補) | https://ja.wikipedia.org/wiki/%E5%AE%89%E4%BF%9D%E7%91%A0%E8%BC%9D%E4%B9%9F | 海人(kaito-2)の2015-10-03 |
| arasan-kamara | アラッサン・カマラ | 2025-11-15 | K-1 WORLD MAX 2025~-70kg世界最強決定トーナメント・決勝ラウンド~ | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1686 | 璃久(riku)の2025-11-15 |
| berunaru-aka | ベルナール・アッカ | 2007-12-31 | K-1 PREMIUM 2007 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%AB%E3%83%8A%E3%83%BC%E3%83%AB%E3%83%BB%E3%82%A2%E3%83%83%E3%82%AB | 武蔵(musashi)の2007-12-31 |
| bobu-sapu | ボブ・サップ | 2005-12-31 | K-1 PREMIUM 2005 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%9C%E3%83%96%E3%83%BB%E3%82%B5%E3%83%83%E3%83%97 | 武蔵(musashi)の2005-12-31 |
| burakupansa-beinoa | “ブラックパンサー”ベイノア | 2022-04-02 | Cygames presents RISE ELDORADO 2022 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/beynoah/ | 海人(kaito-2)の2022-04-02 |
| burakupansa-beinoa | “ブラックパンサー”ベイノア | 2019-12-03 | SHOOT BOXING GROUND ZERO TOKYO 2019 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/beynoah/ | 海人(kaito-2)の2019-12-03 |
| chan-ri | チャン・リー | 2023-04-08 | DUAL Presents Krush~RING OF VENUS~ | K-1 / Krush / Krush-EX | KAI | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/888 | KAI(kai)の2023-04-08 |
| daina | 大夢 | 2024-01-28 | Krush.157 | K-1 / Krush / Krush-EX | 悠斗 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1174 | 悠斗(yuto)の2024-01-28 |
| dengu-shiruba | デング・シルバ | 2024-03-20 | TRHD presents K-1 WORLD MAX | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1443 | 璃久(riku)の2024-03-20 |
| everuton-teishieira | エヴェルトン・テイシェイラ | 2008-09-27 | K-1 WORLD GP 2008 IN SEOUL FINAL16 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%B4%E3%82%A7%E3%83%AB%E3%83%88%E3%83%B3%E3%83%BB%E3%83%86%E3%82%A4%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%A9 | 武蔵(musashi)の2008-09-27 |
| fujihira-ryuya | 藤平 琉矢 | 2026-02-08 | K-1 WORLD GP 2026~ -90kg世界最強決定トーナメント~ | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1703 | 武蔵(musashi-2)の2026-02-08 |
| fujimoto-yuusuke | 藤本祐介 | 2007-03-04 | K-1 WORLD GP 2007 IN YOKOHAMA | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E8%97%A4%E6%9C%AC%E7%A5%90%E4%BB%8B | 武蔵(musashi)の2007-03-04 |
| fujimoto-yuusuke | 藤本祐介 | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E8%97%A4%E6%9C%AC%E7%A5%90%E4%BB%8B | 武蔵(musashi)の2003-09-21 |
| fujimura-daisuke | 藤村 大輔 | 2024-05-26 | Krush.161 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/636 | 璃久(riku)の2024-05-26 |
| fukashi | 不可思 | 2018-04-01 | SHOOT BOXING 2018 act.2 | Bigbang | 海人 | (未解決) | ambiguous(2候補) | https://bigbang-kick.com/fukashi/ | 海人(kaito-2)の2018-04-01 |
| furansowa-za-howaitobafaro-bota | フランソワ・"ザ・ホワイトバッファロー"・ボタ | 2005-09-23 | K-1 WORLD GP 2005 in OSAKA 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%95%E3%83%A9%E3%83%B3%E3%82%BD%E3%83%AF%E3%83%BB%E3%83%9C%E3%82%BF | 武蔵(musashi)の2005-09-23 |
| gaogurai-gennorashin | ガオグライ・ゲーンノラシン | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%AC%E3%82%AA%E3%82%B0%E3%83%A9%E3%82%A4%E3%83%BB%E3%82%B2%E3%83%BC%E3%83%B3%E3%83%8E%E3%83%A9%E3%82%B7%E3%83%B3 | 武蔵(musashi)の2004-12-04 |
| geri-gudoriji | ゲーリー・グッドリッジ | 2003-04-06 | K-1 BEAST 2003 〜山形初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B2%E3%83%BC%E3%83%AA%E3%83%BC%E3%83%BB%E3%82%B0%E3%83%83%E3%83%89%E3%83%AA%E3%83%83%E3%82%B8 | 武蔵(musashi)の2003-04-06 |
| geri-gudoriji | ゲーリー・グッドリッジ | 1999-04-25 | K-1 REVENGE '99 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B2%E3%83%BC%E3%83%AA%E3%83%BC%E3%83%BB%E3%82%B0%E3%83%83%E3%83%89%E3%83%AA%E3%83%83%E3%82%B8 | 武蔵(musashi)の1999-04-25 |
| guraube-feitoza | グラウベ・フェイトーザ | 2006-07-30 | K-1 REVENGE 2006 K-1 WORLD GP 2006 IN SAPPORO 〜アンディ・フグ七回忌追悼イベント〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 | 武蔵(musashi)の2006-07-30 |
| guraube-feitoza | グラウベ・フェイトーザ | 2005-11-19 | K-1 WORLD GP 2005 IN TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 | 武蔵(musashi)の2005-11-19 |
| guraube-feitoza | グラウベ・フェイトーザ | 2002-03-03 | K-1 WORLD GP 2002 in 名古屋 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%A9%E3%82%A6%E3%83%99%E3%83%BB%E3%83%95%E3%82%A7%E3%82%A4%E3%83%88%E3%83%BC%E3%82%B6 | 武蔵(musashi)の2002-03-03 |
| harido-di-fausuto | ハリッド"ディ・ファウスト" | 2006-09-30 | K-1 WORLD GP 2006 in OSAKA 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%8F%E3%83%AA%E3%83%83%E3%83%89%22%E3%83%87%E3%82%A3%E3%83%BB%E3%83%95%E3%82%A1%E3%82%A6%E3%82%B9%E3%83%88%22 | 武蔵(musashi)の2006-09-30 |
| hattori-karin | 服部 華鈴 | 2026-02-28 | Krush.187 | K-1 / Krush / Krush-EX | KAI | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1704 | KAI(kai)の2026-02-28 |
| hayashi-yuta | 林 勇汰 | 2022-12-18 | Krush.144 | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/769 | 銀次(ginji-2)の2022-12-18 |
| hideki | 秀樹 | 2014-07-27 | J-FIGHT in SHINJUKU～vol.38～ | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/hideki/ | 海人(kaito-2)の2014-07-27 |
| hiroki | 弘輝 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1072 | 龍翔(tatsuto)の2025-05-18 |
| hori-hiraku | 堀啓 | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%A0%80%E5%95%93 | 武蔵(musashi)の2003-09-21 |
| horii-kaito | 堀井 海飛 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1247 | 龍翔(tatsuto-2)の2025-05-18 |
| i-sonhyon | イ・ソンヒョン | 2023-03-26 | Cygames presents RISE ELDORADO 2023 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/lee_sunghyun/ | 海人(kaito-2)の2023-03-26 |
| i-sonhyon | イ・ソンヒョン | 2019-09-28 | SHOOT BOXING 2019 act.4 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/lee_sunghyun/ | 海人(kaito-2)の2019-09-28 |
| inoue-kaizan | 井上 海山 | 2025-05-18 | Krush.174 ~in OSAKA~ | K-1 / Krush / Krush-EX | 大輝 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1213 | 大輝(daiki)の2025-05-18 |
| ishigo-keito | 石郷 慶人 | 2026-02-01 | Krush.186 ~in OSAKA~ | K-1 / Krush / Krush-EX | 大輝 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1204 | 大輝(daiki)の2026-02-01 |
| jiemuzu-konde | ジェームズ・コンデ | 2023-12-16 | RUF presents RISE WORLD SERIES 2023 Final Round | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/james-conde/ | 海人(kaito-2)の2023-12-16 |
| jieromu-re-banna | ジェロム・レ・バンナ | 2009-09-26 | K-1 WORLD GP 2009 IN SEOUL FINAL16 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%A7%E3%83%AD%E3%83%A0%E3%83%BB%E3%83%AC%E3%83%BB%E3%83%90%E3%83%B3%E3%83%8A | 武蔵(musashi)の2009-09-26 |
| jieromu-re-banna | ジェロム・レ・バンナ | 2002-12-07 | K-1 WORLD GP 2002 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%A7%E3%83%AD%E3%83%A0%E3%83%BB%E3%83%AC%E3%83%BB%E3%83%90%E3%83%B3%E3%83%8A | 武蔵(musashi)の2002-12-07 |
| kaito | 海斗 | 2023-09-29 | Krush.153 | K-1 / Krush / Krush-EX | 大輝 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/824 | 大輝(daiki-2)の2023-09-29 |
| kaneda-shoki | 兼田 将暉 | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1215 | 銀次(ginji-2)の2025-07-13 |
| kawakami-kyo | 川上 叶 | 2024-04-27 | KNOCK OUT 2024 vol.2 | SHOOT BOXING | 龍聖 | (未解決) | ambiguous(2候補) | https://shootboxing.org/fighter/kawakami_kyo/ | 龍聖(ryusei-2)の2024-04-27 |
| kazumi | 和美 | 2026-07-20 | ECO信頼サービス株式会社PRESENTS K-1 DONTAKU 2026 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1783 | 武蔵(musashi-2)の2026-07-20 |
| keito-uirasakureku | ケイト・ウィラサクレック | 2022-06-25 | K-1 WORLD GP 2022 JAPAN ~RING OF VENUS~ | K-1 / Krush / Krush-EX | KAI | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1100 | KAI(kai)の2022-06-25 |
| kitamura-makoto | 喜多村誠 | 2020-11-28 | 一般社団法人シュートボクシング協会「SHOOT BOXING 2020 act.2」 | SHOOT BOXING | 海人 | (未解決) | ambiguous(2候補) | https://ja.wikipedia.org/wiki/%E5%96%9C%E5%A4%9A%E6%9D%91%E8%AA%A0 | 海人(kaito-2)の2020-11-28 |
| kurata-eiki | 倉田 永輝 | 2023-12-17 | Krush.156 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1015 | 龍翔(tatsuto-2)の2023-12-17 |
| maikeru-tonpuson | マイケル・トンプソン | 1998-10-28 | K-1 JAPAN '98 〜神風〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%9E%E3%82%A4%E3%82%B1%E3%83%AB%E3%83%BB%E3%83%88%E3%83%B3%E3%83%97%E3%82%BD%E3%83%B3_%28%E6%A0%BC%E9%97%98%E5%AE%B6%29 | 武蔵(musashi)の1998-10-28 |
| masashi-nakajima | 中島将志 | 2021-11-14 | Cygames presents RISE WORLD SERIES 2021 OSAKA2 | RISE | 海 人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/nakajima_masashi/ | 海人(kaito-2)の2021-11-14 |
| masashi-yamato | 匡志YAMATO | 2024-11-23 | Krush.168 | RISE | 璃久 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/masashi_yamato/ | 璃久(riku)の2024-11-23 |
| matsuba-toya | 松葉 斗哉 | 2023-07-22 | AZABU PRESENTS Krush.151 | K-1 / Krush / Krush-EX | 悠斗 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1312 | 悠斗(yuto)の2023-07-22 |
| matsumoto-haruto | 松本 海翔 | 2024-10-05 | K-1 WORLD GP 2024 | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1357 | 銀次(ginji-2)の2024-10-05 |
| minagi | 海凪 | 2026-03-28 | Krush.188 | K-1 / Krush / Krush-EX | 空龍 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1480 | 空龍(aron)の2026-03-28 |
| miruko-kurokopu | ミルコ・クロコップ | 1999-12-05 | K-1 GRAND PRIX '99 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%9F%E3%83%AB%E3%82%B3%E3%83%BB%E3%82%AF%E3%83%AD%E3%82%B3%E3%83%83%E3%83%97 | 武蔵(musashi)の1999-12-05 |
| mizutani-kodai | 水谷 昊代 | 2025-11-15 | K-1 WORLD MAX 2025~-70kg世界最強決定トーナメント・決勝ラウンド~ | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1687 | 武蔵(musashi-2)の2025-11-15 |
| mohamedo-butaza | モハメド・ブタザ | 2025-02-09 | K-1 WORLD MAX 2025 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1581 | 璃久(riku)の2025-02-09 |
| mohan-doragon | モハン・ドラゴン | 2021-04-10 | SHOOT BOXING 2021 act.2 | Bigbang | 海人 | (未解決) | ambiguous(2候補) | https://bigbang-kick.com/mohan-dragon/ | 海人(kaito-2)の2021-04-10 |
| momotaro | MOMOTARO | 2023-09-29 | Krush.153 | RISE | 銀次 | ginji-3 | unresolved | https://rise-rc.com/fighter/momotaro/ | 銀次(ginji-2)の2023-09-29 |
| montanya-shiuba | モンターニャ・シウバ | 2003-09-21 | K-1 SURVIVAL 2003 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%A2%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%8B%E3%83%A3%E3%83%BB%E3%82%B7%E3%82%A6%E3%83%90 | 武蔵(musashi)の2003-09-21 |
| montanya-shiuba | モンターニャ・シウバ | 2003-06-29 | K-1 BEAST II 2003 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%A2%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%8B%E3%83%A3%E3%83%BB%E3%82%B7%E3%82%A6%E3%83%90 | 武蔵(musashi)の2003-06-29 |
| morita-naoki | 森田 奈男樹 | 2023-07-22 | AZABU PRESENTS Krush.151 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1177 | 璃久(riku)の2023-07-22 |
| nagano-ryuki | 長野 龍生 | 2025-11-29 | Krush.182 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1267 | 龍翔(tatsuto-2)の2025-11-29 |
| nakasako-tsuyoshi | 中迫剛 | 2002-09-22 | K-1 ANDY SPIRITS 2002 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E4%B8%AD%E8%BF%AB%E5%89%9B | 武蔵(musashi)の2002-09-22 |
| nakasako-tsuyoshi | 中迫剛 | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E4%B8%AD%E8%BF%AB%E5%89%9B | 武蔵(musashi)の2001-08-19 |
| naoya | 直也 | 2023-05-13 | 株式会社シマジュー Presents Krush-EX 2023 vol.4 in FUKUOKA | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1360 | 銀次(ginji-2)の2023-05-13 |
| nikorasu-petasu | ニコラス・ペタス | 2001-08-19 | K-1 ANDY MEMORIAL 2001 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%8B%E3%82%B3%E3%83%A9%E3%82%B9%E3%83%BB%E3%83%9A%E3%82%BF%E3%82%B9 | 武蔵(musashi)の2001-08-19 |
| nobu-hayashi | ノブ・ハヤシ | 1999-08-22 | K-1 SPIRITS '99 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%8E%E3%83%96%E3%83%BB%E3%83%8F%E3%83%A4%E3%82%B7 | 武蔵(musashi)の1999-08-22 |
| noiri-masaaki | 野杁正明 | 2022-06-19 | Yogibo presents THE MATCH 2022 | K-1 / Krush / Krush-EX | 海人 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/41 | 海人(kaito-2)の2022-06-19 |
| nonaka-daito | 野中 大翔 | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1594 | 武蔵(musashi-2)の2025-07-13 |
| oda-jinku | 小田 尋久 | 2024-08-18 | Krush.164 | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1338 | 璃久(riku)の2024-08-18 |
| onodera-hayato | 小野寺 隼 | 2026-05-31 | K-1 REVENGE | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1571 | 龍翔(tatsuto-2)の2026-05-31 |
| oshika-toki | 大鹿 統毅 | 2023-10-21 | Krush.154 | K-1 / Krush / Krush-EX | 悠斗 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1331 | 悠斗(yuto)の2023-10-21 |
| paku-yonsu | パク・ヨンス | 2007-08-05 | K-1 WORLD GP 2007 IN HONG KONG | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%91%E3%82%AF%E3%83%BB%E3%83%A8%E3%83%B3%E3%82%B9 | 武蔵(musashi)の2007-08-05 |
| pita-atsu | ピーター・アーツ | 2006-12-02 | K-1 WORLD GP 2006 IN TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 | 武蔵(musashi)の2006-12-02 |
| pita-atsu | ピーター・アーツ | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 | 武蔵(musashi)の2003-12-06 |
| pita-atsu | ピーター・アーツ | 2000-01-25 | K-1 RISING 2000 〜長崎初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%94%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%BB%E3%82%A2%E3%83%BC%E3%83%84 | 武蔵(musashi)の2000-01-25 |
| randi-kimu | ランディ・キム | 2006-12-31 | K-1 PREMIUM 2006 Dynamite!! | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%A9%E3%83%B3%E3%83%87%E3%82%A3%E3%83%BB%E3%82%AD%E3%83%A0 | 武蔵(musashi)の2006-12-31 |
| rei-sefo | レイ・セフォー | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC | 武蔵(musashi)の2004-12-04 |
| rei-sefo | レイ・セフォー | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC | 武蔵(musashi)の2003-12-06 |
| rei-sefo | レイ・セフォー | 2000-12-10 | K-1 WORLD GP 2000 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%82%A4%E3%83%BB%E3%82%BB%E3%83%95%E3%82%A9%E3%83%BC | 武蔵(musashi)の2000-12-10 |
| remi-bonyasuki | レミー・ボンヤスキー | 2004-12-04 | K-1 WORLD GP 2004 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%83%9F%E3%83%BC%E3%83%BB%E3%83%9C%E3%83%B3%E3%83%A4%E3%82%B9%E3%82%AD%E3%83%BC | 武蔵(musashi)の2004-12-04 |
| remi-bonyasuki | レミー・ボンヤスキー | 2003-12-06 | K-1 WORLD GP 2003 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AC%E3%83%9F%E3%83%BC%E3%83%BB%E3%83%9C%E3%83%B3%E3%83%A4%E3%82%B9%E3%82%AD%E3%83%BC | 武蔵(musashi)の2003-12-06 |
| rikarudo-nodosutorando | リカルド・ノードストランド | 2005-07-29 | K-1 WORLD GP 2005 in HAWAII | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AA%E3%82%AB%E3%83%AB%E3%83%89%E3%83%BB%E3%83%8E%E3%83%BC%E3%83%89%E3%82%B9%E3%83%88%E3%83%A9%E3%83%B3%E3%83%89 | 武蔵(musashi)の2005-07-29 |
| rusuran-karaefu | ルスラン・カラエフ | 2005-11-19 | K-1 WORLD GP 2005 in TOKYO 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%83%AB%E3%82%B9%E3%83%A9%E3%83%B3%E3%83%BB%E3%82%AB%E3%83%A9%E3%82%A8%E3%83%95 | 武蔵(musashi)の2005-11-19 |
| ryoga | 稜賀 | 2024-10-05 | K-1 WORLD GP 2024 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1536 | 龍翔(tatsuto-2)の2024-10-05 |
| saito-ryunosuke | 齊藤 龍之介 | 2024-12-08 | Krush.169 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1333 | 龍翔(tatsuto-2)の2024-12-08 |
| samo-peti | サモ・ペティ | 2023-06-25 | SHOOT BOXING 2023 act.3 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/samo_petje/ | 海人(kaito-2)の2023-06-25 |
| samo-peti | サモ・ペティ | 2022-08-21 | Cygames presents RISE WORLD SERIES OSAKA 2022 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/samo_petje/ | 海人(kaito-2)の2022-08-21 |
| samu-gureko | サム・グレコ | 1996-09-01 | K-1 REVENGE '96 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A0%E3%83%BB%E3%82%B0%E3%83%AC%E3%82%B3 | 武蔵(musashi)の1996-09-01 |
| samu-gureko | サム・グレコ | 1996-05-06 | K-1 GRAND PRIX '96 決勝戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A0%E3%83%BB%E3%82%B0%E3%83%AC%E3%82%B3 | 武蔵(musashi)の1996-05-06 |
| sawayashiki-junichi | 澤屋敷純一 | 2008-04-13 | K-1 WORLD GP 2008 IN YOKOHAMA | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E6%BE%A4%E5%B1%8B%E6%95%B7%E7%B4%94%E4%B8%80 | 武蔵(musashi)の2008-04-13 |
| semi-shuruto | セミー・シュルト | 2006-04-29 | K-1 WORLD GP 2006 IN LAS VEGAS | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%9F%E3%83%BC%E3%83%BB%E3%82%B7%E3%83%A5%E3%83%AB%E3%83%88 | 武蔵(musashi)の2006-04-29 |
| semi-shuruto | セミー・シュルト | 2002-04-21 | K-1 BURNING 2002 〜広島初上陸〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%BB%E3%83%9F%E3%83%BC%E3%83%BB%E3%82%B7%E3%83%A5%E3%83%AB%E3%83%88 | 武蔵(musashi)の2002-04-21 |
| shinta | 心直 | 2025-06-27 | Krush.177 | K-1 / Krush / Krush-EX | 悠斗 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1413 | 悠斗(yuto)の2025-06-27 |
| shiriru-abidi | シリル・アビディ | 2004-09-25 | K-1 WORLD GP 2004 in TOKYO 開幕戦 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E3%82%B7%E3%83%AA%E3%83%AB%E3%83%BB%E3%82%A2%E3%83%93%E3%83%87%E3%82%A3 | 武蔵(musashi)の2004-09-25 |
| shitichai-shisonpinon | シッティチャイ・シッソンピーノン | 2025-12-30 | MAROOMS presents KNOCK OUT.60 ～K.O CLIMAX 2025～ | KNOCK OUT | 海人 | kaito-3 | unresolved | https://knockoutkb.com/fighters/sitthichai_sitsongpeenong_494 | 海人(kaito-2)の2025-12-31 |
| shizuka | C-ZUKA | 2021-08-21 | Krush.128 | K-1 / Krush / Krush-EX | KAI | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/845 | KAI(kai)の2021-08-21 |
| sho-ogawa | 小川翔 | 2018-08-12 | RWEDDINGS presents RIZIN.12 | RIZIN | 海人 | (未解決) | ambiguous(2候補) | https://jp.rizinff.com/_ct/17196408 | 海人(kaito-2)の2018-08-12 |
| so-yonteku | ソ・ヨンテク | 2024-04-21 | Krush-EX 2024 vol.1 in FUKUOKA | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1467 | 銀次(ginji-2)の2024-04-21 |
| sutoyan-kopurivurensuki | ストーヤン・コプリヴレンスキー | 2022-12-25 | Cygames presents RISE WORLD SERIES / SHOOTBOXING-KINGS 2022 | RISE | 海人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/stoyan-koprivlenski/ | 海人(kaito-2)の2022-12-25 |
| suzuki-hiroaki | 鈴木 博昭 | 2017-06-16 | SHOOT BOXING 2017 act.3 | SHOOT BOXING | 海人 | (未解決) | ambiguous(2候補) | https://shootboxing.org/fighter/suzuki-hiroaki/ | 海人(kaito-2)の2017-06-16 |
| takumi-terada | 寺田 匠 | 2022-08-11 | ECO信頼サービス株式会社 PRESENTS K-1 WORLD GP 2022 JAPAN~K-1フェザー級世界最強決定トーナメント~ | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1063 | 銀次(ginji-2)の2022-08-11 |
| terashima-kokoro | 寺島 想 | 2025-05-25 | Krush.176 | K-1 / Krush / Krush-EX | 銀次 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1223 | 銀次(ginji-2)の2025-05-25 |
| terashima-kokoro | 寺島 想 | 2025-08-23 | Krush.179 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1223 | 龍翔(tatsuto-2)の2025-08-23 |
| tomihira-tatsufumi | 富平辰文 | 2002-09-22 | K-1 ANDY SPIRITS 2002 〜JAPAN GP 決勝戦〜 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%B9%B3%E8%BE%B0%E6%96%87 | 武蔵(musashi)の2002-09-22 |
| tomihira-tatsufumi | 富平辰文 | 2000-05-28 | K-1 SURVIVAL 2000 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%B9%B3%E8%BE%B0%E6%96%87 | 武蔵(musashi)の2000-05-28 |
| toyoda-yuki | 豊田 優輝 | 2024-05-26 | Krush.161 | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1032 | 龍翔(tatsuto-2)の2024-05-26 |
| tsukuru-midorikawa | 緑川 創 | 2020-10-11 | Cygames presents RISE DEAD OR ALIVE 2020 YOKOHAMA | RISE | 海 人 | (未解決) | ambiguous(2候補) | https://rise-rc.com/fighter/midorikawa_tsukuru/ | 海人(kaito-2)の2020-10-11 |
| ueda-sakuya | 上田 咲也 | 2025-03-30 | Krush.172 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1490 | 武蔵(musashi-2)の2025-03-30 |
| ueno-kanata | 上野 奏貴 | 2024-09-29 | K-1 WORLD MAX 2024 | K-1 / Krush / Krush-EX | 武蔵 | (未解決) | ambiguous(3候補) | https://www.k-1.co.jp/fighter/1485 | 武蔵(musashi-2)の2024-09-29 |
| uzatsuyo-yoshiya | ウザ強ヨシヤ | 2018-07-29 | RIZIN.11 | RIZIN | 海人 | (未解決) | ambiguous(2候補) | https://jp.rizinff.com/_ct/17188889 | 海人(kaito-2)の2018-07-29 |
| vikutoru-akimofu | ヴィクトル・アキモフ | 2022-03-27 | KINGS KYOTO9〜REVERSAL〜 | HoostCup | 璃久 | (未解決) | ambiguous(2候補) | https://www.hoostcup.com/13fight/20220327-hoostcup.html | 璃久(riku-2)の2022-03-27 |
| yasuo-ryuki | 安尾 瑠輝 | 2024-07-27 | Krush.163 | K-1 / Krush / Krush-EX | 悠斗 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1283 | 悠斗(yuto)の2024-07-27 |
| yuka | Yuka☆ | 2021-11-27 | Krush-EX 2021 vol.7 | K-1 / Krush / Krush-EX | KAI | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1219 | KAI(kai)の2021-11-27 |
| yushi | YUSHI | 2017-02-11 | SHOOT BOXING 2017 act.1 | SHOOT BOXING | 海人 | (未解決) | ambiguous(2候補) | https://shootboxing.org/fighter/yushi/ | 海人(kaito-2)の2017-02-11 |
| yusuke | 佑典 | 2026-02-01 | Krush.186 ~in OSAKA~ | K-1 / Krush / Krush-EX | 龍翔 | (未解決) | ambiguous(4候補) | https://www.k-1.co.jp/fighter/1140 | 龍翔(tatsuto-2)の2026-02-01 |
| zora-akapyan | ゾーラ・アカピャン | 2025-07-13 | ECO信頼サービス株式会社 presents K-1 DONTAKU | K-1 / Krush / Krush-EX | 璃久 | (未解決) | ambiguous(2候補) | https://www.k-1.co.jp/fighter/1451 | 璃久(riku)の2025-07-13 |


---

## 8. 検査F: 勝敗の偏り

収録3試合以上で敗0または勝0の選手を抽出。**177件**(敗0: 73件 / 勝0: 104件)。

**注意: この検査は「データ不整合の疑い」と「実際に無敗/未勝利の選手」を区別できない。**
例えば1位に出てくる那須川天心(51勝0敗7分)は実在の無敗記録であり、データ不整合ではない。
勝率の偏りは経歴の浅い選手・突出した強豪選手でも自然に起こりうるため、**全件が目視での個別確認を
要する候補リストであり、確定した不整合リストではない**。

該当行全件:


### F1: 敗0(73件)

| 選手slug | 選手名 | 所属 | 掲載団体 | 勝 | 敗 | 分 | 不明 | 収録試合数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tenshin-nasukawa | 那須川天心 | TARGET/Cygames | RISE | 51 | 0 | 7 | 0 | 58 |
| tomoyuki | TOMOYUKI | (空欄) | K-1 | 11 | 0 | 1 | 0 | 12 |
| rikarudo-burabo | リカルド・ブラボ | WSRフェアテックス | RISE、KNOCK OUT | 11 | 0 | 1 | 0 | 12 |
| usami-hide-meison | 宇佐美 秀 メイソン | Battle-Box | K-1 WORLD GP、RISE、KNOCK OUT | 9 | 0 | 2 | 0 | 11 |
| shin-nopadeson | シン・ノッパデッソーン | (空欄) |  | 10 | 0 | 1 | 0 | 11 |
| yuki-yoza | 与座優貴 | K-1 GYM SAGAMI-ONO KREST | RISE | 10 | 0 | 0 | 0 | 10 |
| tsujii-wakana | 辻井和奏 | BRING IT ONパラエストラAKK | RISE、KNOCK OUT | 8 | 0 | 1 | 0 | 9 |
| ueno-kanata | 上野 奏貴 | kickboxing gym  SHINYUUKI＋ | K-1 WORLD GP、Krush | 8 | 0 | 0 | 0 | 8 |
| jonasu-sarushicha | ジョナス・サルシチャ | TF Team/CT Allan Popeye | K-1 WORLD GP | 8 | 0 | 0 | 0 | 8 |
| momoka-cinderella | 桃花シンデレラ | 山口道場 | RISE | 8 | 0 | 0 | 0 | 8 |
| haruka-shimada | 島田知佳 | team VASILEUS | RISE | 8 | 0 | 0 | 0 | 8 |
| katono-neigo | 上遠野 寧吾 | POWER OF DREAM | K-1 WORLD GP、Krush、Krush-EX | 7 | 0 | 0 | 0 | 7 |
| shiba-kojiro | 芝 宏二郎 | Striker GYM | K-1 WORLD GP | 7 | 0 | 0 | 0 | 7 |
| nanaka-honda | 本田ななか | TRY HARD GYM | RISE | 7 | 0 | 0 | 0 | 7 |
| kairi-yatagai | 谷田貝海吏 | CYCLONE GYM | RISE | 7 | 0 | 0 | 0 | 7 |
| pk | センチャイ・PKセンチャイムエタイジム | (空欄) |  | 7 | 0 | 0 | 0 | 7 |
| naofumi-yamashina | 山科直史 | 極真会館 | RISE | 7 | 0 | 0 | 0 | 7 |
| yuta-uchida | 内田雄大 | フリー | RISE | 6 | 0 | 0 | 1 | 7 |
| hyuu | 陽勇 | TEAM3K | RISE | 7 | 0 | 0 | 0 | 7 |
| tsubasa-nio | 鳰 翼 | KSR GYM | RISE | 5 | 0 | 2 | 0 | 7 |
| ryuu-tsua | リュウ・ツァー | 唐山文旅驍騎ファイトクラブ/CFP | K-1 WORLD GP | 6 | 0 | 0 | 0 | 6 |
| bobo-sacko | ボボ･サッコ | Teambilos Muaythaï Gym 77 | RISE | 6 | 0 | 0 | 0 | 6 |
| taishi-hiratsuka | 平塚大士 | チームドラゴン | RISE | 6 | 0 | 0 | 0 | 6 |
| yuto-3 | 優翔 | team NOVA | KNOCK OUT | 6 | 0 | 0 | 0 | 6 |
| mina-hayashi | 林 美菜 | FORWARD GYM | RISE | 6 | 0 | 0 | 0 | 6 |
| karurosu-budio | カルロス・ブディオ | ブラジリアン・タイ | RISE | 5 | 0 | 0 | 0 | 5 |
| makasu-ebagu | マーカス・エバーグ | (空欄) |  | 5 | 0 | 0 | 0 | 5 |
| yodokunpon-uirasakureku | ヨードクンポン・ウィラサクレック | ウィラサクレック・フェアテックスジム | K-1 | 5 | 0 | 0 | 0 | 5 |
| sasaki-kosei | 佐々木昊生 | B.F.A-SEED | RISE、KNOCK OUT | 5 | 0 | 0 | 0 | 5 |
| shuri | 珠璃 | 闘神塾 | KNOCK OUT | 4 | 0 | 1 | 0 | 5 |
| shiryu-minamihara | 南原士龍 | 龍士會 | RISE | 5 | 0 | 0 | 0 | 5 |
| uchida-masayuki | 内田雅之 | (空欄) |  | 2 | 0 | 2 | 0 | 4 |
| kan-ri | カン・リー | (空欄) |  | 4 | 0 | 0 | 0 | 4 |
| kimura-mona | 木村 萌那 | K-1ジム目黒TEAM TIGER | K-1 WORLD GP、Krush、Krush-EX | 4 | 0 | 0 | 0 | 4 |
| kirachihiro | キラッ☆Chihiro | (空欄) | K-1 | 3 | 0 | 1 | 0 | 4 |
| geoganwan-so-amunuwaide | ゲーオガンワーン・ソー.アムヌワイデッー | タイ | KNOCK OUT | 4 | 0 | 0 | 0 | 4 |
| suzuki-shota | 鈴木 翔大 | 澁谷会/TEAM KAITO | Krush、Krush-EX | 4 | 0 | 0 | 0 | 4 |
| takumi-2 | 匠 | (空欄) |  | 4 | 0 | 0 | 0 | 4 |
| chansuku-petindiakademi | チャーンスック・ペッティンディーアカデミー | Petchyindee Academy | RISE | 4 | 0 | 0 | 0 | 4 |
| tsubasa-3 | 飛翔 | K-1ジム総本部チームペガサス | K-1 | 2 | 0 | 2 | 0 | 4 |
| tian-tazan | ティアン・ターザン | Luc Verheije Fight Club | K-1 WORLD GP | 4 | 0 | 0 | 0 | 4 |
| hamana-hayato | 浜名 颯斗 | K-1ジム大宮チームレオン | K-1 WORLD GP、Krush、Krush-EX | 4 | 0 | 0 | 0 | 4 |
| mikami-henri-daichi | 三上 大智 | ボスジムジャパン | SHOOT BOXING | 4 | 0 | 0 | 0 | 4 |
| mizutani-kodai | 水谷 昊代 | TEAM TMT | K-1 WORLD GP、Krush、Krush-EX | 4 | 0 | 0 | 0 | 4 |
| yasuhito | 靖仁 | (空欄) | K-1 | 2 | 0 | 2 | 0 | 4 |
| yurian-pozudoniakofu | ユリアン・ポズドニアコフ | ウクライナ | KNOCK OUT | 4 | 0 | 0 | 0 | 4 |
| rui-2 | ルイ | クラミツムエタイジム | KNOCK OUT | 3 | 0 | 1 | 0 | 4 |
| rukasu-ahaterubagu | ルーカス・アハテルバーグ | Team CSK/Sparta Aachen | K-1 WORLD GP | 4 | 0 | 0 | 0 | 4 |
| rukasu-yarosu | ルーカス・ヤロス | (空欄) |  | 4 | 0 | 0 | 0 | 4 |
| negi-tetsuya | 根木 哲也 | TEAM FOREST | SHOOT BOXING | 4 | 0 | 0 | 0 | 4 |
| megumi-yamaguchi | 山口 恵 | RICHキックボクシングジム | RISE | 4 | 0 | 0 | 0 | 4 |
| fukuda-kaito | 福田 海斗 | キング・ムエ | KNOCK OUT | 4 | 0 | 0 | 0 | 4 |
| rantaro | 乱太郎 | 猛者連愛媛支部OGRE | RISE | 4 | 0 | 0 | 0 | 4 |
| suzuki-chihiro | 鈴木 千裕 | KNOCK OUT クロスポイント吉祥寺 | KNOCK OUT | 3 | 0 | 1 | 0 | 4 |
| haruto-nio | 鳰 陽斗 | KSR GYM | RISE | 3 | 0 | 1 | 0 | 4 |
| ashurafu-ashira | アシュラフ・アーシラ | Hammer crew 69/ Empire Fight gym | RISE | 3 | 0 | 0 | 0 | 3 |
| igoru-yurukobichi | イゴール・ユルコビッチ | (空欄) |  | 3 | 0 | 0 | 0 | 3 |
| urajimiru-touraefu | ウラジーミル・トゥラエフ | Makeev Team | K-1 WORLD GP | 3 | 0 | 0 | 0 | 3 |
| zaku-pankuhasuto | ザック・パンクハースト | Taylormade Muay Thai | K-1 WORLD GP | 3 | 0 | 0 | 0 | 3 |
| jieijiei-morisu | ジェイジェイ・モーリス | Gym One/Team Morris | K-1 WORLD GP | 3 | 0 | 0 | 0 | 3 |
| suzuki-shinji | 鈴木真治 | (空欄) |  | 3 | 0 | 0 | 0 | 3 |
| sutefan-ratesuku | ステファン・ラテスク | SCORPIONS IASI | K-1 WORLD GP | 3 | 0 | 0 | 0 | 3 |
| tan-fon | タン・フォン | 中国/長沙鋭景ファイティングクラブ/CFP | KNOCK OUT | 3 | 0 | 0 | 0 | 3 |
| hirao | 平尾 大智 | (空欄) | K-1 | 1 | 0 | 2 | 0 | 3 |
| bonta | ボン太 | (空欄) | K-1 | 3 | 0 | 0 | 0 | 3 |
| marato-guregorian | マラット・グレゴリアン | (空欄) | K-1 | 3 | 0 | 0 | 0 | 3 |
| mirosu-tsuvechikanin | ミロス・ツヴェチカニン | 生年月日 | K-1 WORLD GP | 3 | 0 | 0 | 0 | 3 |
| joichiro-iwaduru | 岩鶴城一楼 | KOGスポーツジム | RISE | 3 | 0 | 0 | 0 | 3 |
| ikeda-kota | 池田 航太 | 拳粋会宮越道場 | KNOCK OUT | 2 | 0 | 1 | 0 | 3 |
| 斗吾 | 斗吾 | (空欄) |  | 3 | 0 | 0 | 0 | 3 |
| umezwa-ryotaro | 梅沢 遼太郎 | 白山道場 | KNOCK OUT | 2 | 0 | 1 | 0 | 3 |
| shoji-hagimoto | 萩本将次 | FUTAMI FIGHTCLUB | RISE | 2 | 0 | 1 | 0 | 3 |
| ibuki | 歩希 | team VASILEUS | KNOCK OUT | 2 | 0 | 1 | 0 | 3 |

### F2: 勝0(104件)

| 選手slug | 選手名 | 所属 | 掲載団体 | 勝 | 敗 | 分 | 不明 | 収録試合数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| utsunomiya-joe | 宇都宮 城 | (空欄) | K-1 | 0 | 9 | 1 | 0 | 10 |
| imai-ryoji | 今井 良次 | ポゴナ・クラブジム | K-1 | 0 | 7 | 1 | 0 | 8 |
| motoki | 元氣 | 楠誠会館 | RISE | 0 | 8 | 0 | 0 | 8 |
| oizumi-sho | 大泉 翔 | (空欄) | K-1 | 0 | 7 | 0 | 0 | 7 |
| mikity | 美斬帝 | テツジム | RISE | 0 | 6 | 1 | 0 | 7 |
| andoryu-ken-buryusuta | アンドリュー“KEN”ブリュースター | (空欄) | K-1 | 0 | 6 | 0 | 0 | 6 |
| uiriamu-dinda | ウィリアム・ディンダー | (空欄) |  | 0 | 6 | 0 | 0 | 6 |
| ozawa-rikiya | 小澤 量哉 | (空欄) | K-1 | 0 | 6 | 0 | 0 | 6 |
| go-oh | 剛王 | (空欄) | K-1 | 0 | 5 | 0 | 1 | 6 |
| yamane-takeo | 山根 武夫 | (空欄) | K-1 | 0 | 5 | 1 | 0 | 6 |
| kenta-mori | 森 謙太 | 秀心塾 | RISE | 0 | 6 | 0 | 0 | 6 |
| moue-kazuki | 馬上 一樹 | REX GYM | KNOCK OUT | 0 | 6 | 0 | 0 | 6 |
| ishii-hirokazu | 石井宏和 | (空欄) |  | 0 | 5 | 0 | 0 | 5 |
| okahan-bara | オカハン バラ | リーブルロア | Krush、Krush-EX | 0 | 5 | 0 | 0 | 5 |
| ochiai-jun | 落合 淳 | (空欄) | K-1 | 0 | 5 | 0 | 0 | 5 |
| kato-yosuke | 加藤 洋介 | K-1 GYM SAGAMI-ONO KREST | K-1 | 0 | 4 | 0 | 1 | 5 |
| kimu-gyonsoku | キム・ギョンソック | (空欄) |  | 0 | 5 | 0 | 0 | 5 |
| kura | 呼良 | SHINE SPORTS CLUB | Krush、Krush-EX | 0 | 4 | 1 | 0 | 5 |
| sakuta-yoshinori | 作田 良典 | (空欄) | K-1 | 0 | 3 | 1 | 1 | 5 |
| suzuki-tyson | 鈴木 太尊 | クボジム | K-1 WORLD GP、Krush、Krush-EX | 0 | 5 | 0 | 0 | 5 |
| tsuchiya-shinobu | 土屋 忍 | Y’ZD GYM | K-1 | 0 | 1 | 4 | 0 | 5 |
| natsuki | 夏気 | VRK GYM | Krush、Krush-EX | 0 | 5 | 0 | 0 | 5 |
| reito-nagamine | 永峯麗人 | インタージム谷山 | RISE | 0 | 5 | 0 | 0 | 5 |
| takeaki-kobayashi | 小林 丈晃 | 練誠塾 | KNOCK OUT | 0 | 3 | 2 | 0 | 5 |
| juna-koda | 上田樹那 | 山口道場 | RISE | 0 | 4 | 1 | 0 | 5 |
| sota-fukushima | 福島草太 | MASTER JAPAN | RISE | 0 | 4 | 1 | 0 | 5 |
| adachi-maiko | 足立 麻衣子 | ONESIDE KICKBOXING GYM | K-1 | 0 | 4 | 0 | 0 | 4 |
| aran-kudo | アラン・クドー | Brazilian Thai | K-1 WORLD GP、Krush、Krush-EX | 0 | 4 | 0 | 0 | 4 |
| uitikon-sonnamutankiri | ウィッティコーン・ソンナムタンキリ | ソンナムタンキリ | RISE | 0 | 4 | 0 | 0 | 4 |
| endo-shingen | 遠藤 信玄 | MASTERPIECE KICKBOXING | K-1 | 0 | 2 | 2 | 0 | 4 |
| ootakaichirou | 大高一郎 | (空欄) |  | 0 | 4 | 0 | 0 | 4 |
| kikuzakiu-tan | 菊崎U-TAN義史 | TANG TANG FIGHT CLUB | K-1 | 0 | 2 | 2 | 0 | 4 |
| kimu-donuku | キム・ドンウック | (空欄) |  | 0 | 4 | 0 | 0 | 4 |
| sasho-koichi | 佐生 光一 | K-1ジム五反田チームキングス | Krush、Krush-EX | 0 | 4 | 0 | 0 | 4 |
| shimizu-takuma | 清水 卓馬 | K-1ジム川口TEAM SIRIUS | K-1 | 0 | 4 | 0 | 0 | 4 |
| danieru-uiriamusu | ダニエル・ウィリアムス | (空欄) | K-1 | 0 | 4 | 0 | 0 | 4 |
| hata-fumiya | 秦 文也 | (空欄) | K-1 | 0 | 2 | 1 | 1 | 4 |
| pere-rido | ペレ・リード | (空欄) |  | 0 | 4 | 0 | 0 | 4 |
| mitsutaka | MITSUTAKA | (空欄) | K-1 | 0 | 4 | 0 | 0 | 4 |
| yamaguchi-sho | 山口 将 | STRIKEs GYM/3POUND | K-1 | 0 | 4 | 0 | 0 | 4 |
| yamada-sumie | 山田純琴 | (空欄) |  | 0 | 4 | 0 | 0 | 4 |
| yamamoto-yuuki | 山本佑機 | (空欄) |  | 0 | 4 | 0 | 0 | 4 |
| yuki-shun | ユウキ・旬 | (空欄) | K-1 | 0 | 3 | 1 | 0 | 4 |
| ranbo | 乱暴 | (空欄) | K-1 | 0 | 3 | 1 | 0 | 4 |
| watanabe-shunya | 渡部 瞬弥 | エスジム | K-1 | 0 | 4 | 0 | 0 | 4 |
| ihara-shunpei | 井原 駿平 | ワイルドシーサーコザ | KNOCK OUT | 0 | 4 | 0 | 0 | 4 |
| ibi-daisuke | 井樋 大介 | KNOCK OUT クロスポイント金沢 | KNOCK OUT | 0 | 3 | 1 | 0 | 4 |
| ishii-takuya | 石井 拓也 | TEAM FOREST | SHOOT BOXING | 0 | 4 | 0 | 0 | 4 |
| makoto-aiuchi | 相内 誠 | K26 | RISE | 0 | 3 | 0 | 0 | 3 |
| aimi | aimi- | DANGER GYM | K-1 | 0 | 3 | 0 | 0 | 3 |
| aira | 愛来 | 一神會舘 | KNOCK OUT | 0 | 2 | 1 | 0 | 3 |
| afumado-akodado | アフマド・アコーダッド | Brutal Gym | RISE | 0 | 3 | 0 | 0 | 3 |
| arai-takaya | 新井 昂弥 | Ten Clover Gym | KNOCK OUT | 0 | 2 | 1 | 0 | 3 |
| awano-takayuki | 粟納 貴之 | (空欄) | K-1 | 0 | 2 | 1 | 0 | 3 |
| uomu | ウォーム | ONE LINK | RISE | 0 | 3 | 0 | 0 | 3 |
| ozeki-keima | 大関 敬真 | POWER OF DREAM | K-1 | 0 | 3 | 0 | 0 | 3 |
| oohigashi-akira | 大東旭 | (空欄) |  | 0 | 3 | 0 | 0 | 3 |
| oyacchi | おやっち | BRAVE FIGHT CLUB | RISE | 0 | 3 | 0 | 0 | 3 |
| kikuzaki-yoshifumi | 菊崎 義史 | TANG TANG FIGHT CLUB | K-1 | 0 | 2 | 1 | 0 | 3 |
| kimura-shigeki | 木村 茂樹 | (空欄) | K-1 | 0 | 3 | 0 | 0 | 3 |
| kenta-3 | 絢太 | CUC | K-1 | 0 | 3 | 0 | 0 | 3 |
| kota | 皓太 | K-1ジム川口TEAM SIRIUS | K-1 | 0 | 3 | 0 | 0 | 3 |
| sashikubi-yuta | 指首 祐太 | (空欄) | K-1 | 0 | 3 | 0 | 0 | 3 |
| satoi | SATOI | (空欄) | K-1 | 0 | 3 | 0 | 0 | 3 |
| satoru | 沙斗流 | (空欄) | K-1 | 0 | 2 | 1 | 0 | 3 |
| takahashi | 高橋 功 | (空欄) | K-1 | 0 | 3 | 0 | 0 | 3 |
| teppei | 哲平 | VAINQUEUR GYM | K-1 | 0 | 2 | 1 | 0 | 3 |
| toshio | 俊雄 | PAL-GYM | K-1 | 0 | 3 | 0 | 0 | 3 |
| nagasaki-hideya | 長崎秀哉 | (空欄) |  | 0 | 3 | 0 | 0 | 3 |
| nakamura-hiroki | 中村 広輝 | 赤雲會 | K-1 | 0 | 2 | 0 | 1 | 3 |
| namuwan-sokonkurapan | ナムワーン・ソーコンクラパン | ソーコンクラパン | RISE | 0 | 3 | 0 | 0 | 3 |
| nishikawa-kohei | 西川 康平 | 8ball fitness | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| nishimaki-hayata | 西槇 隼汰 | POWER OF DREAM | K-1 | 0 | 3 | 0 | 0 | 3 |
| nishimoto-ryuya | 西本 竜也 | ISN GYM/CLIMB | K-1 WORLD GP、Krush、Krush-EX | 0 | 3 | 0 | 0 | 3 |
| hiraki-yumeto | 開 夢斗 | 魁塾中川道場 | K-1 | 0 | 2 | 1 | 0 | 3 |
| petosamui-shimura | ペットサムイ・シムラ | 志村道場 | K-1 | 0 | 3 | 0 | 0 | 3 |
| mio-rareina | MIO LaReyna | TEAM REY DE REYES | Krush、Krush-EX | 0 | 3 | 0 | 0 | 3 |
| mitsui-hiroki | 三井 大揮 | WIZARDキックボクシングジム | K-1 | 0 | 3 | 0 | 0 | 3 |
| mitsuru | MITSURU | (空欄) | K-1 | 0 | 2 | 1 | 0 | 3 |
| mohamedo-azui | モハメド・アズーイ | (空欄) |  | 0 | 3 | 0 | 0 | 3 |
| yamaguchi-mahiro | 山口 真宙 | 月心会チーム侍 | K-1 | 0 | 3 | 0 | 0 | 3 |
| yamachan | やまちゃん | K-1 GYM BLOWS | Krush、Krush-EX、KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| yuuki | YU-KI | 隆真ジム | Krush、Krush-EX、KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| yuoke-yusei | 湯桶 勇成 | K-1 GYM BLOWS | K-1 WORLD GP、Krush、Krush-EX | 0 | 3 | 0 | 0 | 3 |
| yoshimura-takumi | 吉村 匠 | TAD | K-1 WORLD GP、Krush、Krush-EX | 0 | 2 | 0 | 1 | 3 |
| ryuu-uei | リュウ・ウェイ | 深圳争途格闘クラブ/CFP | K-1 | 0 | 3 | 0 | 0 | 3 |
| tyson-rina-500 | タイソンRINA | TEAM TEPPEN | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| phakchi-okuda | パクチー奥田 | TEAM BEYOND | RISE | 0 | 2 | 1 | 0 | 3 |
| kenya | 剣夜 | SHINE沖縄 | KNOCK OUT | 0 | 2 | 1 | 0 | 3 |
| nobuhito-kohagura | 古波蔵信人 | 赤雲會 | RISE | 0 | 2 | 1 | 0 | 3 |
| sato-takuya | 佐藤 拓也 | KNOCK OUT クロスポイント吉祥寺 | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| sumida-mao | 住田 真生 | マッハ道場 | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| suda-tomoki | 須田 知希 | Katana Gym | KNOCK OUT | 0 | 2 | 1 | 0 | 3 |
| kyohei-nishijima | 西島恭平 | ELEVEN | RISE | 0 | 2 | 1 | 0 | 3 |
| chiba-yuki | 千羽 裕樹 | KNOCK OUT クロスポイント渋谷 | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| asakawa-hirotatu | 浅川 大立 | MWS | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| kusa-max | 草MAX | グラバカ赤羽 | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| 中尾満 | 中尾満 | (空欄) |  | 0 | 3 | 0 | 0 | 3 |
| nakagawa-kota | 仲川 広汰 | Ten Clover Gym | KNOCK OUT | 0 | 2 | 0 | 1 | 3 |
| umeo-mei | 梅尾 メイ | B9 GYM | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| nomoto-kiyoshi | 野元 清史 | 龍生塾 | SHOOT BOXING | 0 | 3 | 0 | 0 | 3 |
| ritomo | 利共 | TOP RUN GYM | KNOCK OUT | 0 | 3 | 0 | 0 | 3 |
| tatsuto-3 | 龍翔 | OU-BU GYM | RISE | 0 | 3 | 0 | 0 | 3 |
| ryo-2 | 涼 | ハーデスワークアウトジム | RISE | 0 | 2 | 1 | 0 | 3 |


---

## 9. 検査G: 出典の不一致

「出典ラベルが『◯◯公式』なのにリンク先がja.wikipedia.orgの行」について、2つの解釈で検査した。

**狭義(真のフィールド不整合)**: `sourceType`フィールド自体が「wikipedia」であるべきなのに設定されて
いない(=Wikipedia由来の行なのに公式源由来として扱われてしまっている)行を検索。**0件。** `sourceType`
フィールドの設定漏れという意味でのバグは見つからなかった。

**広義(表示上の文字通りの一致)**: 実際のページ(`src/app/kick/fighters/[slug]/page.tsx`)は、戦績表の
「出典」列に `PROMOTION_SHORT[promotion]`(例:「RIZIN公式」「K-1公式」)をリンクテキストとして表示し、
hrefには`sourceUrl`をそのまま使う。この`PROMOTION_SHORT`のラベルは常に「◯◯公式」という接尾辞になる
仕様のため、`sourceType==='wikipedia'`の行(=試合データの出典が実際にはWikipediaである行)でも
リンクテキストは「◯◯公式」のまま表示され、hrefだけがja.wikipedia.orgを指す。**この字面上の意味では、
Wikipedia由来の全5268件が該当する。**

団体別内訳: {"RIZIN":60,"RISE":402,"K-1 / Krush / Krush-EX":3543,"Bigbang":50,"ONE Championship":23,"新日本キックボクシング協会(SNKA)":495,"NJKF":266,"SHOOT BOXING":378,"KNOCK OUT":28,"Stand up":1,"DEEP☆KICK":14,"HoostCup":5,"KROSS×OVER":3}

**ただし公平のため付記する: 同じセルに隣接して「Wikipedia」という別バッジ(`sourceType==='wikipedia'`の
時のみ表示)が出るため、リンクテキストだけを見て公式情報だと誤認する可能性はバッジで一定程度緩和されて
いる。** それでも、リンクテキスト自体が実体(Wikipedia)と異なる語(「◯◯公式」)を名乗っている点は
文字通りの意味では検査Gの条件に合致するため、設計上の特性として報告する。件数が膨大(5,268件)なため、
全件は別紙(`out/kick-qa-report-appendix-g.md`)に出力した。以下はサンプル(先頭20件)。

| 選手slug | 選手名 | 日付 | 大会名 | 団体 | 相手 | 決着 | 出典URL(リンク先) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ajisu-katou | アジス・カトゥー | 2001-12-01 | K-1 WORLD GP 2002 プラハ大会 | K-1 / Krush / Krush-EX | シーン・プルヤック | 4R終了後 TKO | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2003-01-24 | K-1 WORLD GP 2003 世界地区予選 フランス大会 | K-1 / Krush / Krush-EX | ペポ | 2R 1:12 KO | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2003-06-14 | K-1 WORLD GP 2003 in PARIS | K-1 / Krush / Krush-EX | シリル・アビディ | 3R終了 判定0-3 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2003-07-13 | K-1 WORLD GP 2003 in FUKUOKA | K-1 / Krush / Krush-EX | ペレ・リード | 2R終了時 TKO（右脛カット） | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2003-08-15 | K-1 WORLD GP 2003 in LAS VEGAS II | K-1 / Krush / Krush-EX | ラウル・ロメロ | 3R終了 判定2-0 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2004-01-23 | K-1 WORLD GP 2004 in Marseilles | K-1 / Krush / Krush-EX | アゼム・マクスタイ | 3R終了 判定2-1 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2004-03-27 | K-1 WORLD GP 2004 in SAITAMA | K-1 / Krush / Krush-EX | フランソワ"ザ・ホワイトバッファロー"ボタ | 3R終了 判定2-0 | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2004-07-17 | K-1 WORLD GP 2004 in SEOUL | K-1 / Krush / Krush-EX | レミー・ボンヤスキー | 2R 1:59 TKO（レフェリーストップ） | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-katou | アジス・カトゥー | 2005-05-27 | K-1 WORLD GP 2005 in PARIS | K-1 / Krush / Krush-EX | ナオフォール“アイアン・レッグ” | 1R 1:58 KO（右ハイキック、2ノックダウン） | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%82%AB%E3%83%88%E3%82%A5%E3%83%BC |
| ajisu-yaya | アジス・ヤヤ | 2008-08-09 | K-1 WORLD GP 2008 IN HAWAII | K-1 / Krush / Krush-EX | ポール・スロウィンスキー | 3R 1:54 KO（左フック、3ノックダウン） | https://ja.wikipedia.org/wiki/%E3%82%A2%E3%82%B8%E3%82%B9%E3%83%BB%E3%83%A4%E3%83%A4 |
| akimoto-hiroki | 秋元皓貴 | 2008-08-29 | K-1 甲子園　KING OF UNDER 18〜FINAL16〜 | K-1 / Krush / Krush-EX | 江幡睦 | 3R終了 判定3-0 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2009-08-10 | K-1甲子園 2009 KING OF UNDER 18 -FINAL16- | K-1 / Krush / Krush-EX | 山口裕人 | 3R終了 判定3-0 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2009-10-26 | K-1 WORLD MAX 2009 -FINAL- | K-1 / Krush / Krush-EX | 嶋田翔太 | 3R終了 判定0-3 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-09-23 | ビッグバン・統一への道 其の参 | Bigbang | 山口正道 | 3R終了 判定3-0 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園2010 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 晴山翔栄 | 3R 0:23 KO(ローキック) | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 石田圭吾 | 延長R 1:46 KO(左ミドル) | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 小川翔 | 延長R終了 判定3-0 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 樫村公治 | 1R 一本勝ち | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2010-11-20 | K-1甲子園 -KING OF UNDER 18- FINAL | K-1 / Krush / Krush-EX | 栗原勇樹 | 1R 合わせ一本 | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2011-02-05 | ビッグバン・統一への道 其の四 | Bigbang | TURBΦ | 2R 1:05 KO（右飛び膝蹴り） | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |
| akimoto-hiroki | 秋元皓貴 | 2011-05-15 | ビッグバン・統一への道 其の五 | Bigbang | 祥汰 | 1R 1:46 KO（左膝蹴り） | https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E7%9A%93%E8%B2%B4 |

(全5268件は別紙参照)

---

## 10. 検査H: 数字の不整合

選手ページの3箇所の数字表示を突き合わせた。
- 「収録N試合: X勝Y敗Z分」(`f.record.total`。scheduled/no_contest/cancelled/walkoverを除外して集計。
  0件なら非表示)
- meta descriptionの「◯◯試合を掲載」(`f.bouts.length`。全bout件数、除外なし)
- 戦績表の行数(`f.bouts.length`と同一。表は全boutを表示する)

**meta descriptionと戦績表行数は常に同じ値(`bouts.length`)を参照する実装のため、原理的に一致する。
不一致が起きるのは「収録N試合」対「表の行数/meta description」の間のみで、これは実装上scheduled/
no_contest/cancelled/walkoverを意図的に除外して集計しているためであり、除外ロジック自体は仕様として
コメントで明記されている。** ただし、この設計により**表には出ているのにヘッダーの「収録N試合」には
含まれない試合**が生じ、利用者から見れば「表は49行あるのにヘッダーは43試合と言っている」という数字の
矛盾に見える。**234件。**

該当行全件:

| 選手slug | 選手名 | 「収録N試合」の表示値 | meta description件数 | 戦績表行数 | 差分(表-収録) | 除外内訳(予定/無効/中止/不戦勝敗) |
| --- | --- | --- | --- | --- | --- | --- |
| takeru-2 | 武尊 | 43 | 49 | 49 | 6 | 予定0/無効6/中止0/不戦0 |
| okubo-rui | 大久保 琉唯 | 16 | 19 | 19 | 3 | 予定1/無効2/中止0/不戦0 |
| shina-karimian | シナ・カリミアン | 15 | 18 | 18 | 3 | 予定0/無効3/中止0/不戦0 |
| arasan-kamara | アラッサン・カマラ | 2 | 4 | 4 | 2 | 予定1/無効1/中止0/不戦0 |
| ueno-kanata | 上野 奏貴 | 8 | 10 | 10 | 2 | 予定1/無効1/中止0/不戦0 |
| ueno-kuto | 上野 空大 | 10 | 12 | 12 | 2 | 予定1/無効1/中止0/不戦0 |
| urabe-kouya | 卜部功也 | 66 | 68 | 68 | 2 | 予定0/無効2/中止0/不戦0 |
| oiwa-tatsuya | 大岩 龍矢 | 43 | 45 | 45 | 2 | 予定0/無効2/中止0/不戦0 |
| kaneko-akihiro | 金子 晃大 | 31 | 33 | 33 | 2 | 予定1/無効1/中止0/不戦0 |
| satou-yoshihiro | 佐藤嘉洋 | 52 | 54 | 54 | 2 | 予定0/無効2/中止0/不戦0 |
| satomi-yuzuki | 里見 柚己 | 29 | 31 | 31 | 2 | 予定1/無効1/中止0/不戦0 |
| shirahata-yusei | 白幡 裕星 | 15 | 17 | 17 | 2 | 予定1/無効1/中止0/不戦0 |
| noiri-masaaki | 野杁正明 | 62 | 64 | 64 | 2 | 予定0/無効2/中止0/不戦0 |
| yamazaki-hideaki | 山崎秀晃 | 44 | 46 | 46 | 2 | 予定0/無効2/中止0/不戦0 |
| yamato-tetsuya | 大和 哲也 | 31 | 33 | 33 | 2 | 予定0/無効2/中止0/不戦0 |
| riamu | 璃明武 | 22 | 24 | 24 | 2 | 予定1/無効1/中止0/不戦0 |
| aito | 愛翔 | 13 | 15 | 15 | 2 | 予定0/無効1/中止0/不戦1 |
| ryuki-yoshioka | 吉岡龍輝 | 14 | 16 | 16 | 2 | 予定0/無効0/中止0/不戦2 |
| azusa-kaneko | 金子 梓 | 5 | 7 | 7 | 2 | 予定0/無効1/中止0/不戦1 |
| naofumi-yamashina | 山科直史 | 7 | 9 | 9 | 2 | 予定0/無効0/中止0/不戦2 |
| kan-nakamura | 中村 寛 | 28 | 30 | 30 | 2 | 予定0/無効1/中止0/不戦1 |
| kaito-hasegawa | 長谷川海翔 | 24 | 26 | 26 | 2 | 予定0/無効1/中止0/不戦1 |
| toki-tamaru | 田丸 辰 | 18 | 20 | 20 | 2 | 予定0/無効2/中止0/不戦0 |
| naito-ryota | 内藤凌太 | 49 | 51 | 51 | 2 | 予定0/無効0/中止0/不戦2 |
| shohei-asahara | 麻原将平 | 27 | 28 | 28 | 1 | 予定0/無効0/中止0/不戦1 |
| asahisa-taio | 朝久 泰央 | 26 | 27 | 27 | 1 | 予定1/無効0/中止0/不戦0 |
| atsushi-yamato | 敦YAMATO | 9 | 10 | 10 | 1 | 予定0/無効0/中止0/不戦1 |
| arishieru-karumenofu | アリシェル・カルメノフ | 3 | 4 | 4 | 1 | 予定0/無効1/中止0/不戦0 |
| arufosenu-kamara | アルフォセヌー・カマラ | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| anpo-rukiya | 安保瑠輝也 | 31 | 32 | 32 | 1 | 予定0/無効1/中止0/不戦0 |
| i-hyonsoku | イ・ヒョンソク | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| ikeda-koji | 池田 幸司 | 27 | 28 | 28 | 1 | 予定1/無効0/中止0/不戦0 |
| ishii-issei | 石井 一成 | 16 | 17 | 17 | 1 | 予定0/無効1/中止0/不戦0 |
| taichi-ishikawa | 石川泰市 | 13 | 14 | 14 | 1 | 予定0/無効1/中止0/不戦0 |
| ishiguro-tatsuya | 石黒竜也 | 15 | 16 | 16 | 1 | 予定0/無効0/中止0/不戦1 |
| ishida-kano | 石田 協 | 10 | 11 | 11 | 1 | 予定1/無効0/中止0/不戦0 |
| ishida-ryota | 石田 龍大 | 17 | 18 | 18 | 1 | 予定1/無効0/中止0/不戦0 |
| ito-nagisa | 伊藤 渚 | 11 | 12 | 12 | 1 | 予定1/無効0/中止0/不戦0 |
| inose-naoki | 猪瀬 尚希 | 2 | 3 | 3 | 1 | 予定1/無効0/中止0/不戦0 |
| iwagami-yukito | 岩上 行統 | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| uomu | ウォーム | 3 | 4 | 4 | 1 | 予定0/無効1/中止0/不戦0 |
| taisei-umei | 梅井泰成 | 27 | 28 | 28 | 1 | 予定0/無効1/中止0/不戦0 |
| umeno-genji | 梅野源治 | 35 | 36 | 36 | 1 | 予定0/無効1/中止0/不戦0 |
| urajimiru-touraefu | ウラジーミル・トゥラエフ | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| eito | EITO | 6 | 7 | 7 | 1 | 予定0/無効1/中止0/不戦0 |
| egawa-yuuki | 江川 優生 | 25 | 26 | 26 | 1 | 予定0/無効1/中止0/不戦0 |
| oishi-masaki | 大石 昌輝 | 8 | 9 | 9 | 1 | 予定1/無効0/中止0/不戦0 |
| okubo-seri | 大久保 世璃 | 5 | 6 | 6 | 1 | 予定1/無効0/中止0/不戦0 |
| onishi-hiyori | 大西 日和 | 4 | 5 | 5 | 1 | 予定1/無効0/中止0/不戦0 |
| ono-yukika | 大野 起和 | 0(非表示) | 1 | 1 | 1 | 予定0/無効1/中止0/不戦0 |
| oda-jinku | 小田 尋久 | 13 | 14 | 14 | 1 | 予定1/無効0/中止0/不戦0 |
| kachisu-shusuta | カーチス・シュースター | 4 | 5 | 5 | 1 | 予定0/無効0/中止0/不戦1 |
| kasuperu-mushinsuki | カスペル・ムシンスキ | 7 | 8 | 8 | 1 | 予定1/無効0/中止0/不戦0 |
| kazuma | 一馬 | 23 | 24 | 24 | 1 | 予定0/無効0/中止0/不戦1 |
| kazuyoshi | kazyosi | 11 | 12 | 12 | 1 | 予定0/無効1/中止0/不戦0 |
| kato-go | 加藤 港 | 19 | 20 | 20 | 1 | 予定0/無効1/中止0/不戦0 |
| kawasaki-kaiki | 河崎 鎧輝 | 5 | 6 | 6 | 1 | 予定0/無効0/中止0/不戦1 |
| kimu-hyonjun | キム・ヒョンジュン | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| kimura-daichi | 木村 太地 | 11 | 12 | 12 | 1 | 予定0/無効1/中止0/不戦0 |
| kimura-mona | 木村 萌那 | 4 | 5 | 5 | 1 | 予定1/無効0/中止0/不戦0 |
| kimura-philip-minoru | 木村“フィリップ”ミノル | 41 | 42 | 42 | 1 | 予定0/無効1/中止0/不戦0 |
| kyoken-takeuchi-yuji | “狂拳”竹内 裕二 | 15 | 16 | 16 | 1 | 予定0/無効1/中止0/不戦0 |
| kyoshiro | 恭士郎 | 41 | 42 | 42 | 1 | 予定0/無効0/中止0/不戦1 |
| kintaro | 金太郎 | 2 | 3 | 3 | 1 | 予定1/無効0/中止0/不戦0 |
| kusatsu-kenji | 草津賢治 | 13 | 14 | 14 | 1 | 予定0/無効0/中止0/不戦1 |
| kubo-yuuta | 久保優太 | 57 | 58 | 58 | 1 | 予定0/無効1/中止0/不戦0 |
| kumura-shuhei | 玖村 修平 | 38 | 39 | 39 | 1 | 予定0/無効1/中止0/不戦0 |
| kuraudio-isutorate | クラウディオ・イストラテ | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| kurata-eiki | 倉田 永輝 | 20 | 21 | 21 | 1 | 予定1/無効0/中止0/不戦0 |
| kuriaki-shogo | 栗秋 祥梧 | 13 | 14 | 14 | 1 | 予定0/無効0/中止0/不戦1 |
| kuwata-yuta | 桑田 裕太 | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| gunji-taito | 軍司 泰斗 | 38 | 39 | 39 | 1 | 予定0/無効1/中止0/不戦0 |
| geo-uirasakureku | ゲーオ・ウィラサクレック | 19 | 20 | 20 | 1 | 予定0/無効1/中止0/不戦0 |
| koki | 晃貴 | 27 | 28 | 28 | 1 | 予定0/無効1/中止0/不戦0 |
| kouji | 皇治 | 32 | 33 | 33 | 1 | 予定0/無効1/中止0/不戦0 |
| koutarou | KOTARO | 1 | 2 | 2 | 1 | 予定0/無効1/中止0/不戦0 |
| komiyama-kousuke | 小宮山工介 | 35 | 36 | 36 | 1 | 予定0/無効0/中止0/不戦1 |
| kondo-kaisei | 近藤 魁成 | 20 | 21 | 21 | 1 | 予定0/無効1/中止0/不戦0 |
| saiga-kizaemon | 才賀紀左衛門 | 29 | 30 | 30 | 1 | 予定0/無効1/中止0/不戦0 |
| saikyo-haruma | 西京 春馬 | 20 | 21 | 21 | 1 | 予定0/無効1/中止0/不戦0 |
| saikyo-yuma | 西京 佑馬 | 22 | 23 | 23 | 1 | 予定0/無効1/中止0/不戦0 |
| saito-koya | 齋藤 紘也 | 13 | 14 | 14 | 1 | 予定1/無効0/中止0/不戦0 |
| saito-ristu | 齊藤 律 | 1 | 2 | 2 | 1 | 予定1/無効0/中止0/不戦0 |
| saito-ryunosuke | 齊藤 龍之介 | 10 | 11 | 11 | 1 | 予定1/無効0/中止0/不戦0 |
| zaku-pankuhasuto | ザック・パンクハースト | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| satou-tomonori | 佐藤友則 | 17 | 18 | 18 | 1 | 予定0/無効0/中止0/不戦1 |
| jieijiei-morisu | ジェイジェイ・モーリス | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| shinohara-hiroaki | 篠原 広耀 | 6 | 7 | 7 | 1 | 予定0/無効1/中止0/不戦0 |
| shoya | 昇也 | 30 | 31 | 31 | 1 | 予定0/無効1/中止0/不戦0 |
| jonasan-aiuru | ジョナサン・アイウル | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| jonasu-sarushicha | ジョナス・サルシチャ | 8 | 9 | 9 | 1 | 予定1/無効0/中止0/不戦0 |
| jonisu-koriseu | ジョニス・コリセウ | 5 | 6 | 6 | 1 | 予定1/無効0/中止0/不戦0 |
| shiro | 志朗 | 46 | 47 | 47 | 1 | 予定0/無効1/中止0/不戦0 |
| shinryu | 臣龍 | 4 | 5 | 5 | 1 | 予定0/無効1/中止0/不戦0 |
| sutoyan-kopurivurensuki | ストーヤン・コプリヴレンスキー | 16 | 17 | 17 | 1 | 予定1/無効0/中止0/不戦0 |
| serugei-adamuchaku | セルゲイ・アダムチャック | 10 | 11 | 11 | 1 | 予定1/無効0/中止0/不戦0 |
| soichiro | 宗一郎 | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| soda-riki | 早田 吏喜 | 8 | 9 | 9 | 1 | 予定0/無効1/中止0/不戦0 |
| zora-akapyan | ゾーラ・アカピャン | 7 | 8 | 8 | 1 | 予定1/無効0/中止0/不戦0 |
| knuckle | 高梨knuckle美穂 | 12 | 13 | 13 | 1 | 予定1/無効0/中止0/不戦0 |
| takiya-shouta | 瀧谷渉太 | 34 | 35 | 35 | 1 | 予定0/無効1/中止0/不戦0 |
| takei-yoshiki | 武居 由樹 | 23 | 24 | 24 | 1 | 予定0/無効1/中止0/不戦0 |
| takeno-ren | 竹野 蓮 | 6 | 7 | 7 | 1 | 予定0/無効0/中止0/不戦1 |
| tatsuto | 龍翔 | 13 | 14 | 14 | 1 | 予定0/無効0/中止0/不戦1 |
| tanabe-kenshin | 田邉 謙心 | 2 | 3 | 3 | 1 | 予定1/無効0/中止0/不戦0 |
| dariru-ferudonku | ダリル・フェルドンク | 10 | 11 | 11 | 1 | 予定1/無効0/中止0/不戦0 |
| tsukamoto-takuma | 塚本 拓真 | 21 | 22 | 22 | 1 | 予定1/無効0/中止0/不戦0 |
| tsutsumi-daisuke | 堤 大輔 | 8 | 9 | 9 | 1 | 予定0/無効1/中止0/不戦0 |
| toun-menhon | トゥン・メンホン | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| tomihira-yoshihito | 富平 禎仁 | 11 | 12 | 12 | 1 | 予定0/無効1/中止0/不戦0 |
| nagasaka-lyra | 永坂 吏羅 | 15 | 16 | 16 | 1 | 予定0/無効1/中止0/不戦0 |
| nagasawa-samuel-kiyomitsu | 永澤サムエル聖光 | 16 | 17 | 17 | 1 | 予定1/無効0/中止0/不戦0 |
| nishimoto-narufumi | 西元 也史 | 31 | 32 | 32 | 1 | 予定1/無効0/中止0/不戦0 |
| aoi-noda | 野田蒼 | 26 | 27 | 27 | 1 | 予定0/無効0/中止0/不戦1 |
| hashimoto-raita | 橋本 雷汰 | 13 | 14 | 14 | 1 | 予定1/無効0/中止0/不戦0 |
| hayashi-kenta | 林 健太 | 41 | 42 | 42 | 1 | 予定1/無効0/中止0/不戦0 |
| hayashi-yuta | 林 勇汰 | 12 | 13 | 13 | 1 | 予定0/無効1/中止0/不戦0 |
| harada-toki | 原田 闘鬼 | 8 | 9 | 9 | 1 | 予定1/無効0/中止0/不戦0 |
| haratani-ayaka | 原谷 彩香 | 0(非表示) | 1 | 1 | 1 | 予定0/無効1/中止0/不戦0 |
| pita-maesutorobichi | ピーター・マエストロビッチ | 27 | 28 | 28 | 1 | 予定0/無効0/中止0/不戦1 |
| hiramoto-ren | 平本 蓮 | 15 | 16 | 16 | 1 | 予定0/無効1/中止0/不戦0 |
| hiroto | 寛心 | 2 | 3 | 3 | 1 | 予定1/無効0/中止0/不戦0 |
| bukhari-aqil | ブハリ亜輝留 | 11 | 12 | 12 | 1 | 予定0/無効1/中止0/不戦0 |
| franck-chan | フランクちゃん | 2 | 3 | 3 | 1 | 予定0/無効0/中止0/不戦1 |
| furumiya-haru | 古宮 晴 | 18 | 19 | 19 | 1 | 予定1/無効0/中止0/不戦0 |
| bureiku-torupu | ブレイク・トループ | 0(非表示) | 1 | 1 | 1 | 予定0/無効1/中止0/不戦0 |
| bogudan-sutoika | ボグダン・ストイカ | 3 | 4 | 4 | 1 | 予定1/無効0/中止0/不戦0 |
| nanaka-honda | 本田ななか | 7 | 8 | 8 | 1 | 予定0/無効0/中止0/不戦1 |
| maki-douwansonpon | マキ・ドゥワンソンポン | 4 | 5 | 5 | 1 | 予定0/無効1/中止0/不戦0 |
| makishimu-bakuranofu | マキシム・バクラノフ | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| makihira-keita | 牧平 圭太 | 29 | 30 | 30 | 1 | 予定0/無効1/中止0/不戦0 |
| masanobu | 眞暢 | 19 | 20 | 20 | 1 | 予定0/無効1/中止0/不戦0 |
| matsutani-kira | 松谷 綺 | 15 | 16 | 16 | 1 | 予定0/無効1/中止0/不戦0 |
| matsumoto-kazuki | 松本 和樹 | 13 | 14 | 14 | 1 | 予定1/無効0/中止0/不戦0 |
| matsumoto-haruto | 松本 海翔 | 9 | 10 | 10 | 1 | 予定1/無効0/中止0/不戦0 |
| manueru-menendesu | マヌエル・メネンデス | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| mahiro | 真優 | 13 | 14 | 14 | 1 | 予定0/無効1/中止0/不戦0 |
| mio | MIO | 5 | 6 | 6 | 1 | 予定0/無効1/中止0/不戦0 |
| miburo-kazuki | 壬生狼 一輝 | 16 | 17 | 17 | 1 | 予定0/無効1/中止0/不戦0 |
| miyakawa-hirotaka | 宮川 博孝 | 0(非表示) | 1 | 1 | 1 | 予定0/無効1/中止0/不戦0 |
| miyamoto-musashi | 宮本武勇志 | 21 | 22 | 22 | 1 | 予定0/無効0/中止0/不戦1 |
| murakoshi-yuta | 村越 優汰 | 16 | 17 | 17 | 1 | 予定1/無効0/中止0/不戦0 |
| merudado-sayadi | メールダード・サヤディ | 0(非表示) | 1 | 1 | 1 | 予定0/無効1/中止0/不戦0 |
| melty-kira | Melty輝 | 13 | 14 | 14 | 1 | 予定0/無効1/中止0/不戦0 |
| yasu-jota | 安 晟太 | 9 | 10 | 10 | 1 | 予定1/無効0/中止0/不戦0 |
| yamamoto-yuuya | 山本優弥 | 34 | 35 | 35 | 1 | 予定0/無効1/中止0/不戦0 |
| yan-honchoru | ヤン・ホンチョル | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| yuki | 裕樹 | 59 | 60 | 60 | 1 | 予定0/無効0/中止0/不戦1 |
| yuka | Yuka☆ | 10 | 11 | 11 | 1 | 予定0/無効1/中止0/不戦0 |
| yokoyama-tomoya | 横山 朋哉 | 26 | 27 | 27 | 1 | 予定1/無効0/中止0/不戦0 |
| yoshimura-takumi | 吉村 匠 | 3 | 4 | 4 | 1 | 予定0/無効1/中止0/不戦0 |
| raiki-2 | 羅粋 | 2 | 3 | 3 | 1 | 予定0/無効0/中止0/不戦1 |
| ranma | 嵐舞 | 6 | 7 | 7 | 1 | 予定0/無効0/中止0/不戦1 |
| rikarudo-burabo | リカルド・ブラボ | 12 | 13 | 13 | 1 | 予定0/無効0/中止0/不戦1 |
| riku | 璃久 | 9 | 10 | 10 | 1 | 予定0/無効1/中止0/不戦0 |
| ron-panha | ローン・パンハ | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| rorentsuo-di-vara | ロレンツォ・ディ・ヴァラ | 1 | 2 | 2 | 1 | 予定1/無効0/中止0/不戦0 |
| hotaru | Hotaru | 12 | 13 | 13 | 1 | 予定0/無効0/中止0/不戦1 |
| kokoz | KOKOZ | 16 | 17 | 17 | 1 | 予定0/無効0/中止0/不戦1 |
| rena | RENA | 62 | 63 | 63 | 1 | 予定0/無効0/中止0/不戦1 |
| ryotaro | RYOTARO | 22 | 23 | 23 | 1 | 予定0/無効0/中止0/不戦1 |
| seido | SEIDO | 11 | 12 | 12 | 1 | 予定0/無効0/中止0/不戦1 |
| tetsu | TETSU | 21 | 22 | 22 | 1 | 予定0/無効1/中止0/不戦0 |
| tsutomu | TSUTOMU | 15 | 16 | 16 | 1 | 予定0/無効1/中止0/不戦0 |
| yaya | YAYAウィラサクレック | 11 | 12 | 12 | 1 | 予定0/無効1/中止0/不戦0 |
| yushi | YUSHI | 23 | 24 | 24 | 1 | 予定0/無効1/中止0/不戦0 |
| chappy-yoshinuma | チャッピー吉沼 | 10 | 11 | 11 | 1 | 予定0/無効0/中止0/不戦1 |
| marine-nicol | マリン・二コル | 0(非表示) | 1 | 1 | 1 | 予定1/無効0/中止0/不戦0 |
| haruto-yasumoto | 安本晴翔 | 25 | 26 | 26 | 1 | 予定0/無効1/中止0/不戦0 |
| endo-ryomu | 遠藤 凌夢 | 4 | 5 | 5 | 1 | 予定0/無効0/中止0/不戦1 |
| shoma-okumura | 奥村将真 | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| norio-yokoyama | 横山典雄 | 7 | 8 | 8 | 1 | 予定0/無効0/中止0/不戦1 |
| shimoji-kanato | 下地 奏人 | 6 | 7 | 7 | 1 | 予定0/無効0/中止0/不戦1 |
| kosaka-shuto | 河坂 修斗 | 0(非表示) | 1 | 1 | 1 | 予定0/無効0/中止0/不戦1 |
| kaito-2 | 海人 | 74 | 75 | 75 | 1 | 予定0/無効1/中止0/不戦0 |
| ren-kikukawa | 菊川 蓮 | 9 | 10 | 10 | 1 | 予定0/無効1/中止0/不戦0 |
| tatsuma | 健真 | 15 | 16 | 16 | 1 | 予定0/無効0/中止0/不戦1 |
| negi-tetsuya | 根木 哲也 | 4 | 5 | 5 | 1 | 予定0/無効0/中止1/不戦0 |
| shuto-sato | 佐藤執斗 | 48 | 49 | 49 | 1 | 予定0/無効1/中止0/不戦0 |
| ryunosuke-hosokoshi | 細越竜之介 | 11 | 12 | 12 | 1 | 予定0/無効0/中止0/不戦1 |
| takahiro-hosono | 細野登弘 | 11 | 12 | 12 | 1 | 予定0/無効0/中止0/不戦1 |
| hiroki-zaitsu | 財津大樹 | 14 | 15 | 15 | 1 | 予定0/無効0/中止0/不戦1 |
| kenshin-yamamoto | 山元剣心 | 16 | 17 | 17 | 1 | 予定0/無効0/中止0/不戦1 |
| yuma-yamaguchi | 山口侑馬 | 25 | 26 | 26 | 1 | 予定0/無効0/中止0/不戦1 |
| yamada-kotaro | 山田彪太朗 | 28 | 29 | 29 | 1 | 予定0/無効1/中止0/不戦0 |
| yuma-yamahata | 山畑雄摩 | 30 | 31 | 31 | 1 | 予定0/無効0/中止0/不戦1 |
| shota-tezuka | 手塚翔太 | 29 | 30 | 30 | 1 | 予定0/無効1/中止0/不戦0 |
| shunnosuke | 旬ノ介 | 17 | 18 | 18 | 1 | 予定0/無効0/中止0/不戦1 |
| naoya-otada | 小只直弥 | 8 | 9 | 9 | 1 | 予定0/無効0/中止0/不戦1 |
| manazo-kobayashi | 小林愛三 | 32 | 33 | 33 | 1 | 予定0/無効0/中止0/不戦1 |
| ryu-matsunaga | 松永 隆 | 15 | 16 | 16 | 1 | 予定0/無効0/中止0/不戦1 |
| ryunosuke-matsushita | 松下竜之助 | 15 | 16 | 16 | 1 | 予定0/無効0/中止0/不戦1 |
| yuto-uemura | 上村雄音 | 10 | 11 | 11 | 1 | 予定0/無効1/中止0/不戦0 |
| jin-mandokoro | 政所 仁 | 29 | 30 | 30 | 1 | 予定0/無効1/中止0/不戦0 |
| yuga-hoshi | 星 憂雅 | 17 | 18 | 18 | 1 | 予定0/無効0/中止0/不戦1 |
| shoki-hoshikubo | 星久保将城 | 6 | 7 | 7 | 1 | 予定0/無効1/中止0/不戦0 |
| nishimura-kojiro | 西村 虎次郎 | 3 | 4 | 4 | 1 | 予定0/無効0/中止0/不戦1 |
| yuga-asano | 浅野裕雅 | 5 | 6 | 6 | 1 | 予定0/無効1/中止0/不戦0 |
| osawa-fumiya | 大沢 文也 | 57 | 58 | 58 | 1 | 予定0/無効1/中止0/不戦0 |
| kazuki-osaki | 大﨑一貴 | 54 | 55 | 55 | 1 | 予定0/無効1/中止0/不戦0 |
| koki-osaki | 大﨑孔稀 | 22 | 23 | 23 | 1 | 予定0/無効0/中止0/不戦1 |
| takuma-2 | 琢磨 | 32 | 33 | 33 | 1 | 予定0/無効1/中止0/不戦0 |
| takeuchi-kenichi | 竹内賢一 | 47 | 48 | 48 | 1 | 予定0/無効0/中止1/不戦0 |
| fumito-nakata | 中田史斗 | 11 | 12 | 12 | 1 | 予定0/無効0/中止0/不戦1 |
| nakajima-rintaro | 中島 凛太郎 | 6 | 7 | 7 | 1 | 予定0/無効0/中止0/不戦1 |
| eito-hasegawa | 長谷川英翔 | 8 | 9 | 9 | 1 | 予定0/無効0/中止0/不戦1 |
| kosei-tanaka | 田中恒星 | 13 | 14 | 14 | 1 | 予定0/無効1/中止0/不戦0 |
| yuki-tanaka | 田中佑樹 | 13 | 14 | 14 | 1 | 予定0/無効0/中止0/不戦1 |
| tosamaru | 土佐丸 | 19 | 20 | 20 | 1 | 予定0/無効1/中止0/不戦0 |
| kaito-fujii | 藤井海人 | 8 | 9 | 9 | 1 | 予定0/無効0/中止0/不戦1 |
| shigeki-fujii | 藤井重綺 | 12 | 13 | 13 | 1 | 予定0/無効0/中止0/不戦1 |
| hikaru-fujihashi | 藤橋 光 | 8 | 9 | 9 | 1 | 予定0/無効1/中止0/不戦0 |
| shun-shiraishi | 白石 舜 | 10 | 11 | 11 | 1 | 予定0/無効0/中止0/不戦1 |
| taiju-shiratori | 白鳥大珠 | 30 | 31 | 31 | 1 | 予定0/無効1/中止0/不戦0 |
| atsumu | 鳩 | 21 | 22 | 22 | 1 | 予定0/無効1/中止0/不戦0 |
| hyuga | 彪司 | 10 | 11 | 11 | 1 | 予定0/無効0/中止0/不戦1 |
| yuta-take | 武 裕太 | 14 | 15 | 15 | 1 | 予定0/無効1/中止0/不戦0 |
| yonekawa-tasuku | 米川 たすく | 0(非表示) | 1 | 1 | 1 | 予定0/無効0/中止0/不戦1 |
| tomohiro-kitai | 北井智大 | 30 | 31 | 31 | 1 | 予定1/無効0/中止0/不戦0 |
| ryuta-suekuni | 末國龍汰 | 10 | 11 | 11 | 1 | 予定0/無効1/中止0/不戦0 |
| mina-2 | 未奈 | 24 | 25 | 25 | 1 | 予定0/無効0/中止0/不戦1 |
| yura-2 | 夢空 | 7 | 8 | 8 | 1 | 予定0/無効0/中止0/不戦1 |
| kimura-ryoto | 木村 涼仁 | 7 | 8 | 8 | 1 | 予定0/無効0/中止0/不戦1 |
| aoi-kadowaki | 門脇碧泉 | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| yuto-nomura | 野村勇人 | 13 | 14 | 14 | 1 | 予定0/無効0/中止0/不戦1 |
| yuya | 憂也 | 40 | 41 | 41 | 1 | 予定0/無効0/中止0/不戦1 |
| riku-2 | 璃久 | 9 | 10 | 10 | 1 | 予定0/無効0/中止0/不戦1 |
| tatsuya | 竜也 | 10 | 11 | 11 | 1 | 予定0/無効1/中止0/不戦0 |
| ruka-3 | 瑠夏 | 7 | 8 | 8 | 1 | 予定0/無効1/中止0/不戦0 |
| suzuki-hiroaki | 鈴木 博昭 | 68 | 69 | 69 | 1 | 予定0/無効1/中止0/不戦0 |
| masahiko-suzuki | 鈴木真彦 | 47 | 48 | 48 | 1 | 予定0/無効0/中止0/不戦1 |
| shin-sakurai | 櫻井 芯 | 8 | 9 | 9 | 1 | 予定0/無効0/中止0/不戦1 |
| hamada-una | 濱田 海 | 10 | 11 | 11 | 1 | 予定0/無効0/中止0/不戦1 |
| joichi-yana | 簗 丈一 | 6 | 7 | 7 | 1 | 予定0/無効1/中止0/不戦0 |


---

## 11. 検査I: /kick/fighters 絞り込みUIの挙動

ローカルdevサーバー(`localhost:3591`、`npm run kick:data && next dev`)を起動し、ブラウザで実機確認した。

### 11.1 「団体フィルタ選択時、候補パネルの下に全件一覧が残る」挙動

**再現した。** 団体セレクトで「RIZIN」を選択すると、検索窓の直下にドロップダウン形式の候補パネル
(`.kick-search__panel`)が開き、フィルタ結果が表示される。**しかしパネルの外側・下方には、
元のページがサーバーサイドでレンダリングしている五十音順の全選手リスト(3,315人、フィルタの影響を
受けない静的HTML)がそのまま表示され続ける。** これは実装コメント(`FighterSearch.tsx`)に明記された
意図的な設計(「下に並ぶ五十音順の全選手リストは一切変更しない」、JS無効なクローラー・利用者への
到達性を確保するため)だが、UIの見た目としては「団体を選んでもページの大部分(全選手リスト)は
フィルタされないまま」という一見矛盾した状態になる。

### 11.2 「候補が一定件数で打ち切られ、残りに到達できない」挙動

**再現した。ただし打ち切り件数はコード上30件であり、9件ではなかった。**
`FighterSearch.tsx`の`MAX_RESULTS = 30`により、候補パネルは最大30件しか表示しない。RIZINタグを
持つ選手は111人おり、フィルタ結果は「ほか81件。絞り込みを続けてください。」という文言と共に
30件で打ち切られる。DOM実測: `itemCount=30`, `panelScrollHeight=1230px` vs `panelClientHeight=430px`
(60vh)。

- パネル自体はスクロール可能で、30件までは全てスクロールして到達できることをDOM測定で確認した
  (打ち切りの30件自体は「到達不能」ではない)。
- **しかし30件を超える候補(RIZINの場合111人中81人)には、UI上どうやっても到達する手段がない。**
  「絞り込みを続けてください」という案内文は、団体のみで絞り込んでいる状態(検索テキスト未入力)では
  実行不可能な指示になっている(団体は1つしか選べないため、テキストを追加入力する以外に絞り込む手段が
  なく、目的の選手の名前の一部を知っていないと残り81人には辿り着けない)。
- **パネルの表示領域(60vh)は1画面(1280×720)で約10行分しか同時に見えない**(41px/行 × 10 ≒ 410px)。
  スクロール可能であることに気づかなければ、見た目上「10件弱で打ち切られている」ように見える。
  ユーザーが申告した「9件」はこの視認上の見かけの件数に近く、実装上のハード上限(30件)とは別の観察
  ポイントだったと考えられる。
- 文字列検索と団体フィルタのAND条件自体は正常に機能することを確認した(「朝久」+RIZIN選択で1件に
  絞り込み成功)。

修正はしていない(指示通り、検査Iも再現・記載のみ)。

---

## 12. この検査が触っていない範囲(未測定事項)

- **3,315人のうち、A〜Iの機械的検査をすり抜ける欠陥は未測定。** 着手前に目視確認できていたのは
  5ページ(安保瑠輝也・安保璃紅・kaito-2/kaito-3・与座優貴)のみであり、今回の検査もその5ページから
  逆算した5パターン(A〜F相当)+ユーザー指定のB・G・H・Iをそのまま実装したものに過ぎない。
  この9パターン以外の欠陥類型(例: 日付の妥当性、大会名の表記ゆれ、階級・団体分類の誤り、読み仮名の
  誤変換、選手名自体の誤字等)は一切検査していない。
- **検査C3(相手名への所属連結)・検査F(勝敗の偏り)・検査G(広義)は、機械的な条件に合致した「候補リスト」
  であり、確定した不整合のリストではない。** 特にC3はタイ人選手の正当な表記慣行との判別ができておらず、
  Fは正当な無敗記録との判別ができておらず、G(広義)はUI設計上の意図された挙動である可能性が高い
  (隣接するWikipediaバッジによる緩和あり)。個別の目視判定は今回実施していない。
- **検査D(名簿の分裂)は、生の`fighters.json`で表記名が完全一致するケースのみを対象にした。**
  表記ゆれ(全角/半角、旧字体/新字体、ミドルネームの有無等)がある同一人物の分裂は対象外であり、
  今回の14グループ・31名という母数そのものが「表記が完全一致する重複」に限定された過小な数字である
  可能性が高い。
- **検査E(逆引き未解決)は日付差±3日以内・相手名の正規化一致のみで突き合わせている。** 大会名の表記
  ゆれや日付の記載ミスにより、本来同一のはずのboutが±3日を超えてずれているケースは見逃している
  可能性がある。
- `data/kick/fighters.csv`・`data/kick/realnames.json`・`data/kick/sourceMeta.json`は今回の検査対象に
  含めていない(A〜Iのいずれの検査項目にも該当しなかったため)。
- パフォーマンス・アクセシビリティ・SEO(構造化データ、sitemap等)は検査範囲外。
- 検査Iはブラウザでの実機再現のみ行い、モバイル幅・キーボード操作・スクリーンリーダーでの挙動は
  検査していない。

---

## 13. 添付ファイル

- `out/kick-qa-report-appendix-g.md`: 検査G(広義)の全5268行(選手slug・日付・大会名・団体・相手・決着・出典URL)

# パンクラス公式アーカイブ戦績構築 検証結果

生成日時: 2026-07-28T12:58:16.091Z

対象: 選手DB「必達セット」パンクラス35名 + fighters.ts収録済み(listed)パンクラス16名。
名鑑3系統(prfl2/prfl-e/prfl-a)のindexページから抽出したローマ字URLで、1993〜2026年の全大会結果ページ(HTML化されている416件)からboutを突合した。

## サマリー

- 必達35名のうち **35/35名** でレコード+対戦テーブルを構築できた(1試合以上のboutが公式アーカイブ上のプロフィールURLで突合できた)。
- 既存fighters.ts収録済み(listed)パンクラス16名のうち **16/16名** で同様に構築できた。
- 名鑑3系統の合計エントリー数: 1699件(日本人1631+外国人?+女子?は out/pancrase-fighters.csv 参照)。
- 全大会数: 418件(1993〜2026年、年別indexのリンク総数)。うちPDFのみで本文HTMLが存在しないため対象外: 2件(2010/0516, 2011/0130)。残り416件のHTML化大会のうち、bout表(<table>構造)が1件も検出できなかった大会が5件(いずれも「パンクラスゲート」アマ系大会で、結果がPDFのみ掲載されHTML本文には概要文しかない): 2004-0502, 2006-0219, 2011-0710, 2012-0122, 2012-0729。抽出失敗率 5/416 = 1.2%(停止条件の10%を大幅に下回る)。
- 抽出できたbout総数: 4877件(411大会×平均約11.9試合)。
- 名前照合(選手DB既存収録者へのリンク解決)は必ず `findFighterSlugByName`(src/lib/fighters.ts)のみを使用した。

## 勝敗記号・決着表記の実測値(設計前に全件列挙、実施済み)

- 勝ちマーカー: `○`(U+25CB, 最多)/`◯`(U+25EF, 少数)/`〇`(U+3007, 少数) の3種類が混在。全て勝ちとして扱った。
- 負けマーカー: `×` の1種類のみ(表記ゆれなし)。
- 引き分けマーカー: `△`。
- ノーコンテスト(無効試合/試合不成立): `-` (半角ハイフン)。
- マーカーなし(空欄・空欄): エキシビションマッチ、試合中止、プロレスルール特別試合など77件。レコード集計からは除外し、対戦テーブルには残す。
- 片側のみマーカー欠落(公式サイト側の記載漏れ): 3件確認。決着方法(判定/KO等)と反対コーナーの明示マーカーから推定した(推測で埋めたのではなく、対称性から機械的に導出)。該当bout行の note列に `*_inferred_from_opponent*` を記録。
- コーナー位置(crdl=左/crdr=右)とマーカーの前置/後置は原則(左=前置、右=後置)だが、稀に逆転する行が実在した(例: 2006-1001 藤原大地戦で左コーナーのマーカーが名前の後ろに付いていた)。パーサーは前後どちらの位置でも検出するようにした。
- `<div class="nolinkl">`/`<div class="nolinkr">` という別レイアウト(プロフィールリンクが無い選手向け)が2014-bout.html(通常のMMDD命名でない特殊ファイル名の実在大会、2014.10.19函館)で使用されていた。
- 1994年のみ`<title>`タグがShift-JISのままUTF-8ページに混入(文字化け)。本文のbout構造には影響しないため実害なし。

## URL衝突・エイリアス(全件列挙・人間判断に回す対象)

35名+16名の全プロフィールURLについて、名鑑index由来の正規URLだけでなく、bout表側で実際に使われているリンク先(名前の正規化一致で突合)も突き合わせた結果、以下の3件で正規URL以外のリンク先が見つかった。いずれも自動で一意化せず、根拠つきで個別確認した内容をそのまま記録する。

1. **張豊**: 名鑑index(prfl2)の正規URLは `prfl2/zhangyuta.html` だが、bout表からは全件 `prfl-e/zhangyuta.html` にリンクされていた。実機確認したところ `prfl-e/zhangyuta.html` は中身が `<meta http-equiv=refresh content="1;url=../prfl2/zhangyuta.html">` のみのリダイレクト用スタブページで、実体は同一人物(`prfl2/zhangyuta.html` 自身が持つレコード表と本ツールの集計結果が一致することでも裏取り済み)。→ 同一人物と判断し、2つのURLを別名として扱った。
2. **本川ハルアキ**: 名鑑indexの正規URLは `motokawaharuaki.html` だが、bout表では同一トーナメント(フライ級)の一回戦・二回戦が `motokawaharuki.html`、決勝戦のみ `motokawaharuaki.html` と表記ゆれがあった。同一階級・同一トーナメントの連続ラウンドであるため同一人物と判断したが、これは名前一致とラウンド進行からの推定であり、URLそのものが同一であることの証明ではない。
3. **名田英平**: 2012-1125大会の1試合のみ、対戦相手側にリンクが無く名前がプレーンテキストで記載されていた(プロフィールページ開設前の出場と見られる)。正規化した名前文字列の一致でこの1件のみ補完した。

上記以外の必達35名+listed16名では、正規化名一致で複数の異なるURLが見つかるケースは無かった(単一URL)。

## 必達セット パンクラス35名

### 佐藤生虎

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/satoshogo.html

**レコード(mnews集計、no_marker/nc除く): 5勝1敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-07-09 | PANCRASE 336 | ウェルター級 | 伊藤丈皓 | - | win | 1R 1:01、TKO/グラウンドのパンチ |
| 2023-09-24 | PANCRASE 337 | ウェルター級 | 渡邉ショーン | - | win | 1R 0:35、TKO/グラウンドのパンチ |
| 2023-12-24 | PANCRASE 340 | ウェルター級 | 川中孝浩 | - | win | 1R 1:22、TKO/グラウンドのパンチ |
| 2024-04-29 | PANCRASE 342 | ウェルター級 | 長岡弘樹 | - | win | 3R 5:00、判定/3-0 |
| 2024-09-29 | PANCRASE 347 | ウェルター級 | 押忍マン洸太 | - | (none) (no_marker_in_source) | 無効試合 |
| 2025-04-27 | PANCRASE 353 | ウェルター級 | 押忍マン | - | win | 2R 0:39、TKO/グラウンドのパンチ |
| 2025-12-21 | PANCRASE 360 | ウェルター級 | ゴイチ・ヤマウチ | yamauchi-goiti | loss | 2R 1:47、TO/RNC |

### 平信一

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/taira.html

**レコード(mnews集計、no_marker/nc除く): 7勝7敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数14件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2019-07-21 | PANCRASE307 | ライト級 | 松岡嵩志 | - | loss | 3R 3:00、判定/3-0 |
| 2019-10-20 | PANCRASE309 | ライト級 | 阿部右京 | - | win | 3R 3:00、判定/0-3 |
| 2021-06-27 | PANCRASE 322 | ライト級 | 丸山数馬 | - | loss | 3R 5:00、判定/3-0 |
| 2021-10-17 | PANCRASE 324 | ライト級 | 高橋“Bancho”良明 | - | win | 2R 4:14、KO/スタンドのパンチ |
| 2022-04-29 | PANCRASE 327 | ライト級 | 粕谷優介 | kasuya-yusuke | loss | 2R 2:40、TO/RNC |
| 2022-10-10 | NEO BLOOD! 2 | ライト級 | 西尾真輔 | nishio-shinsuke | win | 2R 3:47、TO/チョークスリーパー |
| 2023-03-26 | PANCRASE 332 | ライト級 | 余 勇利 | - | win | 3R 5:00、判定/3-0 |
| 2023-11-12 | PANCRASE 339 | ライト級 | 丸山数馬 | - | loss | 3R 5:00、判定/0-3 |
| 2024-03-31 | PANCRASE 341 | ライト級 | 神谷大智 | kamiya-daichi | loss (left_marker_inferred_from_opponent(source_omitted_x)) | 3R 3:08、TO/RNC |
| 2024-07-21 | PANCRASE 346 | ライト級 | 鈴木悠斗 | - | loss | 2R 1:28、TKO/グラウンドのパンチ |
| 2024-12-15 | PANCRASE 351 | ライト級 | 張 豊 | - | win | 2R 3:22、TKO/グラウンドのパンチ |
| 2025-09-23 | PANCRASE 357 | ライト級 | 畑 大晴 | - | win | 3R 5:00、判定/3-0 |
| 2026-02-11 | PANCRASE BLOOD.9 | (欠損) | 美木 航 | - | win | 2R 2:30、TKO/グラウンドのパンチ |
| 2026-05-31 | PANCRASE 362 | ライト級 | 鈴木慈也 | - | loss | 3R 5:00、判定/0-3 |

### 張豊

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/zhangyuta.html / https://www.pancrase.co.jp/data/prfl-e/zhangyuta.html(複数=エイリアス、上記セクション参照)

**レコード(mnews集計、no_marker/nc除く): 2勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-12-15 | PANCRASE 351 | ライト級 | 平 信一 | - | loss | 2R 3:22、TKO/グラウンドのパンチ |
| 2025-05-06 | PANCRASE BLOOD.6 | ライト級 | アンディ サカイ | - | win | 3R 5:00、判定/3-0 |
| 2025-09-23 | PANCRASE 357 | ライト級 | 斎藤主己 | - | win | 3R 5:00、判定/3-0 |

### 鈴木悠斗

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/suzukiyuto.html

**レコード(mnews集計、no_marker/nc除く): 6勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-07-09 | PANCRASE 335 | ライト級 | 水杉泰誠 | - | win | 3R 5:00、判定/0-3 |
| 2023-11-12 | PANCRASE 338 | ライト級 | 上田智大 | - | win | 1R 0:57、TKO/グラウンドのパンチ |
| 2024-03-31 | PANCRASE 341 | ライト級 | クリス | - | win | 1R 4:53、TKO/スタンドのパンチ |
| 2024-05-25 | PANCRASE 343 | ライト級 | 原田直人 | - | win | 1R 0:15、KO/スタンドのパンチ |
| 2024-07-21 | PANCRASE 346 | ライト級 | 平 信一 | - | win | 2R 1:28、TKO/グラウンドのパンチ |
| 2024-12-15 | PANCRASE 350 | ライト級 | 小川道的 | - | win | 1R 1:50、TKO/グラウンドのパンチ |
| 2025-07-27 | PANCRASE 355 | ライト級 | ラファエル・バルボーザ | barboza-rafael | loss | 1R 4:31、TO/スピニングチョーク |

### 透暉鷹

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/tokitaka.html

**レコード(mnews集計、no_marker/nc除く): 9勝1敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数11件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2020-07-24 | PANCRASE316 | フェザー級 | 小森真誉 | - | win | 1R 3:12、タップアウト/バックチョーク |
| 2020-10-25 | PANCRASE 319 | フェザー級 | 田中半蔵 | - | win | 3R 5:00、判定/0-3 |
| 2021-05-30 | PANCRASE 321 | フェザー級 | Ryo | - | loss | 3R 4:59、TKO(レフェリーストップ)/フロントチョーク |
| 2021-10-17 | PANCRASE 324 | フェザー級 | 内村洋次郎 | - | win | 3R 5:00、判定/3-0 |
| 2022-03-21 | PANCRASE 326 | フェザー級 | 名田英平 | - | win | 2R 1:31、TO/RNC |
| 2022-04-29 | PANCRASE 327 | フェザー級 | 岩本達彦 | - | win | 1R 4:30、TKO/グラウンドのパンチ |
| 2022-07-18 | PANCRASE 328 | フェザー級 | 亀井晨佑 | - | win | 4R 4:35、TO/RNC |
| 2022-12-25 | PANCRASE 330 | フェザー級 | パン・ジェヒョク | - | win | 3R 5:00、判定/2-1 |
| 2023-12-24 | PANCRASE 340 | バンタム級 | 河村泰博 | - | win | 1R 4:45、TKO/肩固め |
| 2025-04-27 | PANCRASE 353 | バンタム級 | カリベク・アルジクル ウルル | - | (none) (no_marker_in_source) | 試合中止/両者計量失格 |
| 2026-03-14 | PANCRASE 361 | (欠損) | ギレルメ・ナカガワ | - | win | 1R 4:33、TKO/グラウンドのパンチ |

### 岡田拓真

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/okadatakuma.html

**レコード(mnews集計、no_marker/nc除く): 5勝2敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-06-04 | PANCRASE 334 | フェザー級 | 上田智大 | - | win | 1R 2:22、TO/RNC |
| 2023-08-27 | NEO BLOOD! 5 | フェザー級 | 望月貴史 | - | win | 3R 5:00、判定/3-0 |
| 2023-11-12 | PANCRASE 339 | フェザー級 | 糸川義人 | - | win | 3R 5:00、判定/0-3 |
| 2024-12-15 | PANCRASE 350 | フェザー級 | 敢流 | - | loss | 2R 0:54、TKO/グラウンドのパンチ |
| 2025-06-01 | PANCRASE 354 | フェザー級 | 中村晃司 | - | win | 3R 3:32、TKO/グラウンドのパンチ |
| 2025-09-23 | PANCRASE 357 | フェザー級 | 石田陸也 | - | win | 1R 3:43、TKO/グラウンドのパンチ |
| 2026-03-14 | PANCRASE 361 | フェザー級 | 清水博人 | shimizu-hiroto | loss | 3R 5:00、判定/0-3 |

### Ryo

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/ryoa.html

**レコード(mnews集計、no_marker/nc除く): 5勝7敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数12件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2020-10-25 | PANCRASE 319 | フェザー級 | 滝田J太郎 | - | win | 3R 5:00、判定/0-3 |
| 2020-12-13 | PANCRASE 320 | フェザー級 | 林優作 | - | win | 1R 1:12、TO/フロントチョーク |
| 2021-05-30 | PANCRASE 321 | フェザー級 | 透暉鷹 | - | win | 3R 4:59、TKO(レフェリーストップ)/フロントチョーク |
| 2021-09-12 | PANCRASE 323 | (欠損) | 中田大貴 | - | loss | 3R 5:00、判定/3-0 |
| 2022-03-21 | PANCRASE 326 | フェザー級 | 岩本達彦 | - | loss | 1R 3:17、TO/アームロック |
| 2022-07-18 | PANCRASE 328 | フェザー級 | 遠藤来生 | - | loss | 2R 2:09、KO/スタンドのパンチ |
| 2022-12-25 | PANCRASE 330 | フェザー級 | 田村一聖 | - | loss | 3R 5:00、判定/3-0 |
| 2023-07-09 | PANCRASE 335 | フェザー級 | 名田英平 | - | win | 3R 5:00、判定/0-3 |
| 2023-12-24 | PANCRASE 340 | フェザー級 | 栁川唯人 | yanagawa-yuito | win | 3R 0:33、TO/腕十字固め |
| 2024-06-30 | PANCRASE 345 | フェザー級 | 平田直樹 | hirata-naoki | loss | 3R 5:00、判定/3-0 |
| 2025-03-09 | PANCRASE 352 | フェザー級 | 山本歩夢 | - | loss | 2R 1:43、TO/アームロック |
| 2025-12-21 | PANCRASE 360 | フェザー級 | オタベク・ラジャボフ | rajabov-otabek | loss | 1R 5:00、TKO/コーナーストップ |

### 遠藤来生

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/endoraiki.html

**レコード(mnews集計、no_marker/nc除く): 3勝8敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数12件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2021-06-27 | PANCRASE 322 | フェザー級 | 中川皓貴 | - | win | 3R 5:00、判定/3-0 |
| 2021-09-12 | PANCRASE 323 | ④フェザー級 | 岩本達彦 | - | loss | 2R 2:47、TO/フロントチョーク |
| 2022-03-21 | PANCRASE 326 | フェザー級 | 内村洋次郎 | - | loss | 3R 5:00、判定/1-2 |
| 2022-07-18 | PANCRASE 328 | フェザー級 | Ryo | - | win | 2R 2:09、KO/スタンドのパンチ |
| 2023-03-26 | PANCRASE 332 | フェザー級 | 高木凌 | takagi-ryo | loss | 2R 4:29、KO/スタンドのパンチ |
| 2023-09-24 | PANCRASE 337 | フェザー級 | 平田直樹 | hirata-naoki | loss | 3R 5:00、判定/3-0 |
| 2024-03-31 | PANCRASE 341 | フェザー級 | 石田陸也 | - | loss | 3R 5:00、判定/0-3 |
| 2024-07-28 | PANCRASE BLOOD.3 | フェザー級 | 中村晃司 | - | win | 3R 5:00、判定/3-0 |
| 2024-11-10 | PANCRASE 348 | フェザー級 | シュウジ ヤマウチ | - | (none) (no_marker_in_source) | 試合中止 |
| 2025-03-09 | PANCRASE 352 | フェザー級 | 木下尚祐 | - | loss | 3R 5:00、判定/0-3 |
| 2025-09-23 | PANCRASE 356 | フェザー級 | オタベク・ラジャボフ | rajabov-otabek | loss | 1R 3:28、TKO/スタンドの膝蹴り |
| 2026-05-31 | PANCRASE 362 | フェザー級 | 三宅輝砂 | miyake-kisa | loss | 3R 5:00、判定/0-3 |

### 名田英平

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/nada.html

(うち4件はプロフィールリンク無し・氏名の正規化一致で補完)

**レコード(mnews集計、no_marker/nc除く): 10勝9敗2分 (NC 0件、マーカーなし/対象外 0件、bout総数21件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2012-11-25 |  | フェザー級 | 山田雅道 | - | win | 1R、TKO(レフェリーストップ)/グラウンドのパンチ |
| 2014-07-20 | パンクラス大阪主催興行　PANCRASE 大阪大会 | フェザー級 | 上野藤士 | - | draw | 2R 3:00、時間切れドロー |
| 2014-12-21 | パンクラス大阪主催興行　PANCRASE 大阪大会 | フェザー級 | 松野佑哉 | - | draw | 2R 3:00、時間切れドロー |
| 2016-07-31 | PANCRASE大阪大会 | フェザー級 | 上山雄大 | - | win | 2R 3:00、判定/0-3 |
| 2017-07-16 | PANCRASE大阪大会 | フェザー級 | 岩本達彦 | - | loss | 1R 1:18、ギブアップ/フロントチョーク |
| 2018-07-15 | PANCRASE 大阪大会 | フェザー級 | 田上隼 | - | win | 1R 2:02、フロントチョーク |
| 2018-12-24 | PANCRASE302 | フェザー級 | 森宏之 | - | loss | 3R 0:58、ギブアップ/フロントチョーク |
| 2019-04-14 | PANCRASE304 | ⑦フェザー級 | DARANI DATE | - | win | 3R 3:00、判定/1-2 |
| 2019-06-30 | PANCRASE306 | フェザー級 | 立成洋太 | - | win | 1R 2:13、ギブアップ/フロントチョーク |
| 2019-09-29 | PANCRASE308 | フェザー級 | 葛西和希 | - | win | 3R 3:00、判定/2-1 |
| 2021-04-04 | PANCRASE 大阪大会 | フェザー級 | 小森真誉 | - | win | 3R 5:00、判定/3-0 |
| 2021-06-27 | PANCRASE 322 | フェザー級 | 高橋祐樹 | - | win | 2R 1:15、TO/RNC |
| 2021-10-17 | PANCRASE 324 | フェザー級 | 狩野優 | karino-yu | loss | 1R 4:56、TO/RNC |
| 2022-03-21 | PANCRASE 326 | フェザー級 | 透暉鷹 | - | loss | 2R 1:31、TO/RNC |
| 2023-03-26 | PANCRASE 331 | フェザー級 | 糸川義人 | - | win | 3R 5:00、判定/3-0 |
| 2023-07-09 | PANCRASE 335 | フェザー級 | Ryo | - | loss | 3R 5:00、判定/0-3 |
| 2023-11-12 | PANCRASE 338 | フェザー級 | キム・サンウォン | - | loss | 3R 5:00、判定/0-3 |
| 2024-02-18 | PANCRASE BLOOD.1 | フェザー級 | 三宅輝砂 | miyake-kisa | loss | 2R 1:02、TKO/スタンドのパンチ |
| 2024-07-28 | PANCRASE BLOOD.3 | フェザー級 | シュウジ ヤマウチ | - | loss | 1R 2:29、TO/腕十字固め |
| 2024-12-15 | PANCRASE 350 | フェザー級 | 栁川唯人 | yanagawa-yuito | loss | 1R 3:21、TKO/グラウンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | フェザー級 | 糸川義人 | - | win | 3R 5:00、判定/0-3 |

### 関翔渚

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/sekisena.html

**レコード(mnews集計、no_marker/nc除く): 4勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数4件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-04-27 | PANCRASE 353 | フェザー級 | 松岡 拓 | - | win | 3R 5:00、判定/0-3 |
| 2025-09-23 | PANCRASE 356 | フェザー級 | 星野柊哉 | - | win | 2R 2:35、TO/フロントチョーク |
| 2026-05-04 | PANCRASE BLOOD.10 | フェザー級 | 大谷啓元 | - | win | 3R 1:41、TKO/グラウンドのパンチ |
| 2026-07-26 | PANCRASE BLOOD.11 | フェザー級 | 浜松大和 | - | win | 3R 5:00、判定/3-0 |

### 糸川義人

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/itokawayoshito.html

**レコード(mnews集計、no_marker/nc除く): 4勝7敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数11件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2022-05-22 | NEO BLOOD! 1 | フェザー級 | FUMA | - | win | 1R 5:00、TKO(レフェリーストップ)/頭部裂傷 |
| 2022-10-10 | NEO BLOOD! 2 | フェザー級 | 石田陸也 | - | win | 3R 5:00、判定/3-0 |
| 2023-03-26 | PANCRASE 331 | フェザー級 | 名田英平 | - | loss | 3R 5:00、判定/3-0 |
| 2023-07-09 | PANCRASE 336 | フェザー級 | 平田直樹 | hirata-naoki | loss | 2R 1:50、TKO/グラウンドのパンチ |
| 2023-11-12 | PANCRASE 339 | フェザー級 | 岡田拓真 | - | loss | 3R 5:00、判定/0-3 |
| 2024-04-29 | PANCRASE 342 | フェザー級 | 櫻井裕康 | - | win | 3R 5:00、判定/3-0 |
| 2024-06-30 | PANCRASE 344 | フェザー級 | 小森真誉 | - | win | 3R 5:00、判定/2-1 |
| 2024-09-29 | PANCRASE 347 | フェザー級 | 栁川唯人 | yanagawa-yuito | loss | 3R 5:00、判定/0-3 |
| 2025-05-18 | PANCRASE BLOOD.7 | フェザー級 | 敢流 | - | loss | 3R 3:53、TO/RNC |
| 2025-11-09 | PANCRASE 358 | フェザー級 | 清水博人 | shimizu-hiroto | loss | 3R 4:31、TKO/スタンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | フェザー級 | 名田英平 | - | loss | 3R 5:00、判定/0-3 |

### 石田陸也

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/ishidarikuya.html

**レコード(mnews集計、no_marker/nc除く): 3勝5敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数8件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2022-05-22 | NEO BLOOD! 1 | フェザー級 | 大森光 | - | win | 1R 3:32、TO/三角絞め |
| 2022-10-10 | NEO BLOOD! 2 | フェザー級 | 糸川義人 | - | loss | 3R 5:00、判定/3-0 |
| 2023-06-04 | PANCRASE 334 | ライト級 | 望月貴史 | - | loss | 2R 2:44、TO/RNC |
| 2023-11-03 | NEO BLOOD! 6 | フェザー級 | 前田村生 | - | win | 1R 4:31、TO/アームロック |
| 2024-03-31 | PANCRASE 341 | フェザー級 | 遠藤来生 | - | win | 3R 5:00、判定/0-3 |
| 2024-07-21 | PANCRASE 346 | フェザー級 | 三宅輝砂 | miyake-kisa | loss | 1R 2:34、TKO/グラウンドのパンチ |
| 2024-11-10 | PANCRASE 349 | フェザー級 | 中田大貴 | - | loss | 1R 1:47、TKO/グラウンドのパンチ |
| 2025-09-23 | PANCRASE 357 | フェザー級 | 岡田拓真 | - | loss | 1R 3:43、TKO/グラウンドのパンチ |

### 荒田大輝

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/aratadaiki.html

**レコード(mnews集計、no_marker/nc除く): 6勝1敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数8件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-02-25 | PANCRASE BLOOD.2 | バンタム級 | 嶺 大基 | - | win | 2R 1:43、TO/腕十字固め |
| 2024-05-25 | PANCRASE 343 | バンタム級 | 目怒頑丈 | - | win | 2R 4:41、TO/RNC |
| 2024-07-21 | PANCRASE 346 | バンタム級 | 白井誠司 | - | win | 3R 5:00、判定/0-3 |
| 2024-11-10 | PANCRASE 348 | バンタム級 | 山口怜臣 | - | loss | 3R 5:00、判定/2-1 |
| 2025-04-27 | PANCRASE 353 | (欠損) | ギレルメ・ナカガワ | - | win | 2R 0:51、TKO/スタンドのパンチ |
| 2025-07-27 | PANCRASE 355 | バンタム級 | 安藤武尊 | - | win | 3R 2:07、TO/RNC |
| 2025-12-21 | PANCRASE 360 | バンタム級 | 松井斗輝 | - | (none) (no_marker_in_source) | 試合中止 |
| 2026-03-14 | PANCRASE 361 | バンタム級 | 山木麻弥 | - | win | 3R 5:00、判定/0-3 |

### 佐藤ゆうじ

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/satoyuji_bonsai.html

**レコード(mnews集計、no_marker/nc除く): 4勝3敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-06-30 | PANCRASE 344 | バンタム級 | 渡邉泰斗 | - | loss | 3R 5:00、判定/3-0 |
| 2025-02-11 | PANCRASE BLOOD.5 | バンタム級 | 小間駿史 | - | win | 1R 2:47、TO/ヒールホールド |
| 2025-05-06 | PANCRASE BLOOD.6 | バンタム級 | 木本海人 | - | win | 1R 2:37、TO/三角締め |
| 2025-08-10 | PANCRASE BLOOD.8 | バンタム級 | 木村耀人 | - | win | 1R 3:59、TO/腕十字固め |
| 2025-11-09 | PANCRASE 358 | バンタム級 | 白井誠司 | - | loss | 3R 5:00、判定/1-2 |
| 2026-05-04 | PANCRASE BLOOD.10 | バンタム級 | 前田浩平 | - | win | 2R 1:31、TS/RNC |
| 2026-07-26 | PANCRASE 364 | バンタム級 | 髙城光弘 | - | loss | 3R 5:00、判定/3-0 |

### バラカトゥロ・アサドゥラエフ

プロフィールURL: https://www.pancrase.co.jp/data/prfl-e/asadulloev.html

**レコード(mnews集計、no_marker/nc除く): 1勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数1件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2026-05-31 | PANCRASE 362 | バンタム級 | 矢澤 諒 | - | win | 3R 5:00、判定/0-3 |

### 山木麻弥

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/yamakimahiro.html

**レコード(mnews集計、no_marker/nc除く): 3勝2敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数5件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-07-28 | PANCRASE BLOOD.3 | バンタム級 | 前田 海 | - | win | 2R 0:29、TKO/グラウンドのパンチ |
| 2024-11-10 | PANCRASE 348 | バンタム級 | 宮城成歩滝 | - | win | 1R 4:15、TKO/肘によるカット |
| 2025-03-09 | PANCRASE 352 | バンタム級 | 矢澤 諒 | - | win | 1R 1:43、TKO/グラウンドのパンチ |
| 2025-06-01 | PANCRASE 354 | バンタム級 | 田嶋 椋 | tajima-ryo | loss | 3R 3:54、TKO/セコンドのタオル投入 |
| 2026-03-14 | PANCRASE 361 | バンタム級 | 荒田大輝 | - | loss | 3R 5:00、判定/0-3 |

### 前田浩平

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/maedakohei.html

**レコード(mnews集計、no_marker/nc除く): 10勝8敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数18件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2019-03-17 | PANCRASE303 | バンタム級 | 平田純一 | - | win | 3R 3:00、判定/3-0 |
| 2019-05-26 | PANCRASE305 | ⑨バンタム級 | 宮川峻 | - | win | 3R 3:00、判定/3-0 |
| 2019-09-01 | Road to ONE:CENTURY | バンタム級 | 野尻定由 | - | loss | 2R 2:25、フロントチョーク |
| 2020-02-16 | PANCRASE312 | フライ級 | 竹内直矢 | - | win | 2R 3:19、タップアウト/RNC |
| 2020-10-25 | PANCRASE 319 | フライ級 | 山中憲次 | - | loss | 3R 5:00、判定/3-0 |
| 2021-06-27 | PANCRASE 322 | ①ネオブラッドトーナメント｛フライ級 | 聡-S DATE | - | loss | 2R 2:11、TKO/スタンドのパンチ |
| 2021-10-17 | PANCRASE 324 | フライ級 | 赤﨑清志朗 | - | win | 3R 5:00、判定/0-3 |
| 2022-03-21 | PANCRASE 326 | フライ級 | 田代悠生 | - | win | 2R 2:16、TKO/グラウンドのパンチ |
| 2022-07-18 | PANCRASE 328 | フライ級 | 大塚智貴 | otsuka-tomoki | loss | 3R 5:00、判定/0-3 |
| 2023-03-26 | PANCRASE 331 | フライ級 | 今井健斗 | - | win | 3R 5:00、判定/2-1 |
| 2023-07-09 | PANCRASE 335 | (欠損) | ジョセフ・カマチョ | - | loss | 3R 5:00、判定/0-3 |
| 2023-11-12 | PANCRASE 338 | (欠損) | 萩原幸太郎 | - | loss | 3R 5:00、判定/3-0 |
| 2024-04-29 | PANCRASE 342 | フライ級 | 砂辺光久 | - | win | 3R 5:00、判定/0-3 |
| 2024-07-21 | PANCRASE 346 | (欠損) | 増田大河 | - | win | 3R 5:00、判定/2-0 |
| 2025-03-09 | PANCRASE 352 | バンタム級 | 梅原規祥 | - | win | 3R 5:00、判定/3-0 |
| 2025-07-27 | PANCRASE 355 | バンタム級 | 神部篤坊 | - | loss | 1R 2:32、TKO/グラウンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | バンタム級 | 佐藤ゆうじ | - | loss | 2R 1:31、TS/RNC |
| 2026-07-26 | PANCRASE 364 | バンタム級 | 小原統哉 | - | win | 2R 4:42、TKO/グラウンドのパンチ |

### 合島大樹

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/gojima.html

**レコード(mnews集計、no_marker/nc除く): 8勝9敗1分 (NC 0件、マーカーなし/対象外 0件、bout総数18件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2014-02-02 | PANCRASE 256 | バンタム級 | 富田浩司 | - | draw | 2R 5:00、判定/0-0 |
| 2014-06-29 | PANCRASE 259 | バンタム級 | CORO | coro | win | 3R 3:00、判定/1-2 |
| 2014-10-05 | PANCRASE 261 | バンタム級 | 藤井伸樹 | - | loss | 3R 1:01、ギブアップ/チョークスリーパー |
| 2015-02-01 | PANCRASE 264 | バンタム級 | 井関遼 | - | win | 3R 3:00、判定/3-0 |
| 2015-05-31 | PANCRASE 267 | バンタム級 | 滝田J太郎 | - | win | 3R 3:00、判定/0-3 |
| 2015-07-05 | PANCRASE 268 | バンタム級 | 小野“名人"浩 | - | win | 1R 2:38、ギブアップ/腕ひしぎ十字固め |
| 2015-11-01 | PANCRASE 271 | バンタム級 | アラン“ヒロ”ヤマニハ | - | loss | 3R 3:00、判定/1-2 |
| 2016-03-13 | PANCRASE276 | バンタム級 | 福島秀和 | - | loss | 3R 3:00、判定/3-0 |
| 2016-12-18 | PANCRASE283 | バンタム級 | 坂本瑞氣 | - | win | 3R 2:09、TKO/グラウンドのパンチ |
| 2017-03-12 | PANCRASE285 | バンタム級 | TSUNE | - | loss | 3R 3:00、判定/3-0 |
| 2017-10-08 | PANCRASE290 | バンタム級 | 清水俊一 | - | loss | 3R 3:00、判定/2-1 |
| 2018-02-04 | PANCRASE293 | バンタム級 | 河村泰博 | - | loss | 2R 2:25、TKO(レフェリーストップ)/三角絞め |
| 2018-07-15 | PANCRASE 大阪大会 | バンタム級 | 金太郎 | kintaro | loss | 3R 3:00、判定/0-3 |
| 2018-11-25 | PANCRASE301 | バンタム級 | 原田惟紘 | - | win | 3R 1:24、TKO/グラウンドのパンチ |
| 2024-05-25 | PANCRASE 343 | バンタム級 | 小原統哉 | - | win | 2R 3:31、TKO/スタンドのパンチ |
| 2024-12-15 | PANCRASE 351 | (欠損) | 安藤武尊 | - | win | 3R 5:00、判定/3-0 |
| 2025-03-09 | PANCRASE 352 | バンタム級 | 後藤丈治 | goto-joji | loss | 1R 4:12、TKO/スタンドのパンチ |
| 2025-11-09 | PANCRASE 358 | バンタム級 | 神部篤坊 | - | loss | 1R 0:59、TKO/グラウンドのパンチ |

### 白井誠司

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/shiraijoji.html

**レコード(mnews集計、no_marker/nc除く): 4勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数5件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-02-25 | PANCRASE BLOOD.2 | バンタム級 | タカリンダマン | - | win | 3R 0:39、TKO/グラウンドのパンチ |
| 2024-05-25 | PANCRASE 343 | バンタム級 | 梅原規祥 | - | win | 3R 5:00、判定/3-0 |
| 2024-07-21 | PANCRASE 346 | バンタム級 | 荒田大輝 | - | loss | 3R 5:00、判定/0-3 |
| 2025-02-11 | PANCRASE BLOOD.5 | バンタム級 | 平澤宏樹 | - | win | 3R 5:00、判定/3-0 |
| 2025-11-09 | PANCRASE 358 | バンタム級 | 佐藤ゆうじ | - | win | 3R 5:00、判定/1-2 |

### 猿飛流

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/satoru.html

**レコード(mnews集計、no_marker/nc除く): 10勝4敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数14件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2017-12-10 | PANCRASE292 | &#9315;フライ級 | 杉山廣平 | sugiyama-kohei | loss | 1R 0:27、TKO/スタンドの膝蹴り |
| 2018-03-11 | PANCRASE294 | フライ級 | 廣中克至 | - | win | 1R 2:09、ギブアップ/腕十字固め |
| 2018-07-01 | PANCRASE297 | フライ級 | 鈴木千裕 | suzuki-chihiro | loss | 3R 3:00、判定/3-0 |
| 2018-12-09 | PANCRASE302 | ⑧フライ級 | 渡辺竜也 | - | win | 3R 3:00、判定/3-0 |
| 2019-03-17 | PANCRASE303 | フライ級 | 岡野竜己 | - | win | 3R 3:00、判定/3-0 |
| 2019-05-26 | PANCRASE305 | フライ級 | 三澤陽平 | - | win | 3R 3:00、判定/3-0 |
| 2019-09-29 | PANCRASE308 | フライ級 | 赤﨑清志朗 | - | win | 2R 1:50、タップアウト/チョークスリーパー |
| 2020-02-16 | PANCRASE312 | フライ級 | 荻窪祐輔 | - | win | 3R 5:00、判定/0-3 |
| 2021-05-30 | PANCRASE 321 | フライ級 | 上田将竜 | - | win | 3R 5:00、判定/1-2 |
| 2022-03-21 | PANCRASE 326 | フライ級 | 小川徹 | - | win | 5R 5:00、判定/0-3 |
| 2022-12-25 | PANCRASE 330 | フライ級 | 鶴屋 怜 | tsuruya-rei | loss | 2R 1:03、TO/RNC |
| 2024-12-15 | PANCRASE 351 | フライ級 | ジョセフ・カマチョ | - | loss | 2R 0:48、TO/RNC |
| 2025-07-27 | PANCRASE 355 | フライ級 | 岸田宙大 | - | win | 3R 5:00、判定/0-3 |
| 2026-03-14 | PANCRASE 361 | フライ級 | 大塚智貴 | otsuka-tomoki | win | 2R 0:25、TKO/グラウンドのパンチ |

### ラファエル・リベイロ

プロフィールURL: https://www.pancrase.co.jp/data/prfl-e/rafaelribeiro.html

**レコード(mnews集計、no_marker/nc除く): 2勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-07-21 | PANCRASE 346 | フライ級 | 濱田 巧 | hamada-takumi | loss | 3R 5:00、判定/2-1 |
| 2025-04-27 | PANCRASE 353 | フライ級 | 眞藤源太 | - | win | 2R 2:30、TO/肩固め |
| 2025-11-09 | PANCRASE 358 | フライ級 | 山崎蒼空 | - | win | 3R 1:54、TKO/グラウンドのパンチ |

### 増田大河

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/masudataiga.html

**レコード(mnews集計、no_marker/nc除く): 4勝3敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2022-10-10 | NEO BLOOD! 2 | ストロー級 | 清沢魁人 | - | win | 3R 0:30、TKO/スタンドのパンチ |
| 2023-03-04 | NEO BLOOD! 3 | ストロー級 | 大和田光太郎 | - | win | 1R 4:09、TKO/グラウンドのパンチ |
| 2023-08-27 | NEO BLOOD! 5 | ストロー級 | 寺岡拓永 | - | loss | 3R 5:00、判定/3-0 |
| 2024-03-31 | PANCRASE 341 | ストロー級 | 植松洋貴 | - | loss | 3R 5:00、判定/2-1 |
| 2024-07-21 | PANCRASE 346 | (欠損) | 前田浩平 | - | loss | 3R 5:00、判定/2-0 |
| 2025-07-27 | PANCRASE 355 | フライ級 | 大野友哉 | - | win | 2R 2:29、TKO/グラウンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | フライ級 | 小林了平 | - | win | 3R 5:00、判定/0-3 |

### 浜本キャット雄大

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/hamamoto.html

**レコード(mnews集計、no_marker/nc除く): 1勝3敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数4件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-05-25 | PANCRASE 343 | フライ級 | ジョセフ・カマチョ | - | win | 3R 5:00、判定/3-0 |
| 2024-11-10 | PANCRASE 349 | フライ級 | 眞藤源太 | - | loss | 3R 5:00、判定/1-2 |
| 2025-04-27 | PANCRASE 353 | フライ級 | 大塚智貴 | otsuka-tomoki | loss | 3R 5:00、判定/3-0 |
| 2025-12-21 | PANCRASE 360 | フライ級 | 岸田宙大 | - | loss | 1R 2:41、TO/腕十字固め |

### 植松洋貴

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/uematsuyoshiki.html

**レコード(mnews集計、no_marker/nc除く): 6勝4敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数11件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2021-12-12 | PANCRASE 325 | ⑦ストロー級 | 佐藤良太 | - | win | 1R 4:03、TO/RNC |
| 2022-03-21 | PANCRASE 326 | ストロー級 | 大城正也 | - | win | 3R 5:00、判定/0-3 |
| 2022-10-10 | NEO BLOOD! 2 | (欠損) | 江崎 壽 | - | loss | 3R 0:42、TO/腕ひしぎ十字固め |
| 2023-03-26 | PANCRASE 332 | ストロー級 | リトル | - | (none) (no_marker_in_source) | 3R 5:00、判定/1-1 |
| 2023-07-09 | PANCRASE 336 | ストロー級 | 野田遼介 | - | loss | 1R 3:18、TKO/グラウンドのパンチ |
| 2024-03-31 | PANCRASE 341 | ストロー級 | 増田大河 | - | win | 3R 5:00、判定/2-1 |
| 2024-07-28 | PANCRASE BLOOD.3 | ストロー級 | 尾崎龍紀 | - | win | 3R 5:00、判定/3-0 |
| 2024-11-10 | PANCRASE 349 | ストロー級 | 髙島俊哉 | - | win | 1R 4:49、TKO/グラウンドのパンチ |
| 2025-03-09 | PANCRASE 352 | ストロー級 | 黒澤亮平 | - | loss | 2R 2:33、TKO/スタンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | フライ級 | 織部修也 | - | win | 1R 1:58、TKO/グラウンドのパンチ |
| 2026-07-26 | PANCRASE BLOOD.11 | フライ級 | 菅 歩夢 | - | loss | 3R 3:40、TO/ツイスター |

### 小林了平

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/kobayashiryohei.html

**レコード(mnews集計、no_marker/nc除く): 2勝3敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数5件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-07-09 | PANCRASE 335 | ストロー級 | 黒澤亮平 | - | loss | 1R 1:40、KO/スタンドのパンチ |
| 2024-06-30 | PANCRASE 344 | フライ級 | 大野友哉 | - | win | 3R 5:00、判定/0-3 |
| 2024-12-15 | PANCRASE 351 | フライ級 | 水戸邉荘大 | - | loss | 3R 5:00、判定/3-0 |
| 2025-11-09 | PANCRASE 359 | フライ級 | 萩原幸太郎 | - | win | 1R 3:26、KO/スタンドのパンチ |
| 2026-05-04 | PANCRASE BLOOD.10 | フライ級 | 増田大河 | - | loss | 3R 5:00、判定/0-3 |

### 菅歩夢

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/kanayumu.html

**レコード(mnews集計、no_marker/nc除く): 6勝2敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数8件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-03-04 | NEO BLOOD! 3 | バンタム級 | 髙杉遼介 | - | win | 3R 5:00、判定/0-3 |
| 2023-06-04 | PANCRASE 334 | バンタム級 | 寺本雄輝 | - | win | 1R 1:02、TKO/グラウンドのパンチ |
| 2023-08-27 | NEO BLOOD! 5 | バンタム級 | 小原とうや | - | win | 1R 1:27、KO/スタンドのパンチ |
| 2023-11-03 | NEO BLOOD! 6 | バンタム級 | 坂本瑞氣 | - | win | 3R 1:07、TO/バックチョーク |
| 2024-12-15 | PANCRASE 350 | フライ級 | 岸田宙大 | - | loss | 3R 5:00、判定/1-2 |
| 2025-12-21 | PANCRASE 360 | フライ級 | クーパー・ロイヤル | - | win | 3R 5:00、判定/3-0 |
| 2026-03-14 | PANCRASE 361 | フライ級 | 谷村泰嘉 | - | loss | 1R 1:06、TS/フロントチョーク |
| 2026-07-26 | PANCRASE BLOOD.11 | フライ級 | 植松洋貴 | - | win | 3R 3:40、TO/ツイスター |

### 山崎蒼空

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/yamasakisora.html

**レコード(mnews集計、no_marker/nc除く): 5勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数6件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-08-27 | NEO BLOOD! 5 | フライ級 | 伊藤勇輝 | - | win | 3R 5:00、判定/3-0 |
| 2024-02-25 | PANCRASE BLOOD.2 | フライ級 | 佐々木瞬真 | - | win | 3R 4:25、TO/RNC |
| 2024-04-29 | PANCRASE 342 | フライ級 | AXEL RYOTA | - | win | 2R 0:22、TKO/スタンドのパンチ |
| 2024-06-30 | PANCRASE 344 | フライ級 | 饒平名知靖 | - | win | 3R 5:00、判定/0-3 |
| 2024-09-29 | PANCRASE 347 | フライ級 | 岸田宙大 | - | win | 3R 5:00、判定/0-3 |
| 2025-11-09 | PANCRASE 358 | フライ級 | ラファエル・リベイロ | - | loss | 3R 1:54、TKO/グラウンドのパンチ |

### 本川ハルアキ

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/motokawaharuaki.html / https://www.pancrase.co.jp/data/prfl2/motokawaharuki.html(複数=エイリアス、上記セクション参照)

**レコード(mnews集計、no_marker/nc除く): 3勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-02-11 | PANCRASE BLOOD.5 | フライ級 | 降旗健太郎 | - | win | 2R 2:26、TKO/ツイスター |
| 2025-05-06 | PANCRASE BLOOD.6 | フライ級 | 齋藤楼貴 | - | win | 3R 5:00、判定/0-3 |
| 2025-11-09 | PANCRASE 358 | フライ級 | 柴山鷹成 | - | win | 1R 1:39、TO/三角絞め |

### 寺岡拓永

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/teraokatakuei.html

**レコード(mnews集計、no_marker/nc除く): 4勝4敗1分 (NC 0件、マーカーなし/対象外 0件、bout総数9件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-03-04 | NEO BLOOD! 3 | ストロー級 | 孫悟空DATE | - | win | 3R 5:00、判定/0-3 |
| 2023-06-04 | PANCRASE 334 | ストロー級 | 米山唯人 | - | win | 3R 5:00、判定/0-3 |
| 2023-08-27 | NEO BLOOD! 5 | ストロー級 | 増田大河 | - | win | 3R 5:00、判定/3-0 |
| 2023-11-12 | PANCRASE 338 | ストロー級 | リトル | - | loss | 3R 5:00、判定/2-1 |
| 2024-04-29 | PANCRASE 342 | ストロー級 | 氏原魁星 | - | win | 3R 5:00、判定/3-0 |
| 2024-07-21 | PANCRASE 346 | ストロー級 | 髙島俊哉 | - | loss | 3R 5:00、判定/0-2 |
| 2024-12-15 | PANCRASE 351 | ストロー級 | 船田電池 | - | loss | 3R 5:00、判定/0-3 |
| 2025-06-01 | PANCRASE 354 | ストロー級 | 飯野タテオ | - | loss | 3R 5:00、判定/0-3 |
| 2026-06-28 | PANCRASE 363 | ストロー級 | 氏原魁星 | - | draw | 3R 5:00、判定/0-0 |

### 杉山しずか

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/sugiyama.html

**レコード(mnews集計、no_marker/nc除く): 3勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数4件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-03-31 | PANCRASE 341 | 女子フライ級 | ライカ | - | win | 3R 5:00、判定/3-0 |
| 2024-07-21 | PANCRASE 346 | フライ級 | 重田ホノカ | - | win | 1R 2:40、TKO/フロントチョーク |
| 2025-03-09 | PANCRASE 352 | フライ級 | 渡邉史佳 | - | loss | 1R 2:15、TKO/スタンドのパンチ |
| 2026-03-14 | PANCRASE 361 | フライ級 | 和田綾音 | - | win | 5R 5:00、判定/3-0 |

### 和田綾音

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/wadaayane.html

**レコード(mnews集計、no_marker/nc除く): 2勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-07-28 | PANCRASE BLOOD.3 | 女子フライ級 | ライカ | - | win | 3R 5:00、判定/0-3 |
| 2025-06-01 | PANCRASE 354 | 女子フライ級 | オノダマン | - | win | 3R 5:00、判定/3-0 |
| 2026-03-14 | PANCRASE 361 | フライ級 | 杉山しずか | - | loss | 5R 5:00、判定/3-0 |

### ライカ

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/raika.html

**レコード(mnews集計、no_marker/nc除く): 7勝8敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数15件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2015-07-05 | PANCRASE 268 | スーパーフライ級 | ズラブカ・ビタリー | - | win | 3R 3:00、判定/2-1 |
| 2016-07-24 | PANCRASE279 | フライ級 | 中井りん | - | loss | 3R 2:43、TKO/グラウンドでの肘 |
| 2018-07-01 | PANCRASE297 | フライ級 | クセニヤ・グーセヴァ | - | loss | 3R 5:00、判定/1-2 |
| 2018-12-09 | PANCRASE302 | フライ級 | エジナ・トラキナス | - | win | 3R 5:00、判定/2-1 |
| 2019-04-14 | PANCRASE304 | フライ級 | マイラ・カントゥアリア | - | loss | 1R 3:17、タップアウト/腕ひしぎ十字固め |
| 2019-07-21 | PANCRASE307 | フライ級 | グレイシ・ファリア | - | win | 1R 0:45、ギブアップ/チョークスリーパー |
| 2019-10-20 | PANCRASE309 | フライ級 | アニー・カロリネ | - | win | 3R 5:00、判定/2-1 |
| 2020-07-24 | PANCRASE316 | フライ級 | 端貴代 | - | loss | 3R 5:00、判定/0-3 |
| 2021-05-30 | PANCRASE 321 | フライ級 | 法DATE | - | loss | 3R 5:00、判定/0-3 |
| 2023-03-26 | PANCRASE 331 | 女子フライ級 | 渡邉史佳 | - | win | 3R 5:00、判定/2-1 |
| 2023-07-09 | PANCRASE 336 | 女子フライ級 | ナギ | - | win | 1R 0:25、TKO/スタンドのパンチ |
| 2023-11-12 | PANCRASE 338 | 女子フライ級 | 重田ホノカ | - | loss | 3R 5:00、判定/0-3 |
| 2024-03-31 | PANCRASE 341 | 女子フライ級 | 杉山しずか | - | loss | 3R 5:00、判定/3-0 |
| 2024-07-28 | PANCRASE BLOOD.3 | 女子フライ級 | 和田綾音 | - | loss | 3R 5:00、判定/0-3 |
| 2025-07-27 | PANCRASE 355 | 女子フライ級 | オノダマン | - | win | 2R 1:22、KO/スタンドのパンチ |

### 本野美樹

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/motonomiki.html

**レコード(mnews集計、no_marker/nc除く): 2勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数2件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-03-09 | PANCRASE 352 | ストロー級 | 藤野恵実 | - | win | 3R 5:00、判定/0-3 |
| 2025-12-21 | PANCRASE 360 | ストロー級 | KAREN | - | win | 5R 5:00、判定/0-3 |

### KAREN

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/karen.html

**レコード(mnews集計、no_marker/nc除く): 9勝3敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数12件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2019-12-08 | PANCRASE311 | ⑥ストロー級 | DIANA | - | win | 3R 3:00、判定/0-3 |
| 2020-10-25 | PANCRASE 319 | ストロー級 | 青木文菜 | - | win | 1R 4:22、タップアウト/RNC |
| 2021-06-27 | PANCRASE 322 | ストロー級 | EDGE | - | win | 3R 1:10、TKO/グラウンドのパンチ |
| 2021-10-17 | PANCRASE 324 | ストロー級 | 新谷琴美 | - | win | 1R 1:39、TKO/肘によるカット |
| 2022-03-21 | PANCRASE 326 | ストロー級 | 藤野恵実 | - | win | 4R 3:18、TKO/肘による額のカット |
| 2022-09-11 | PANCRASE 329 | ストロー級 | 宝珠山桃花 | - | win | 3R 5:00、判定/3-0 |
| 2022-12-25 | PANCRASE 330 | ストロー級 | ソルト | - | loss | 3R 5:00、判定/0-3 |
| 2023-04-30 | PANCRASE 333 | ストロー級 | ソルト | - | loss | 5R 5:00、判定/0-3 |
| 2023-09-24 | PANCRASE 337 | ストロー級 | 高本千代 | - | win | 3R 5:00、判定/3-0 |
| 2024-04-29 | PANCRASE 342 | ストロー級 | ホン・イェリン | - | win | 3R 5:00、判定/3-0 |
| 2024-09-29 | PANCRASE 347 | ストロー級 | エジナ・トラキナス | - | win | 3R 5:00、判定/3-0 |
| 2025-12-21 | PANCRASE 360 | ストロー級 | 本野美樹 | - | loss | 5R 5:00、判定/0-3 |

### SARAMI

プロフィールURL: https://www.pancrase.co.jp/data/prfl-a/sarami.html

**レコード(mnews集計、no_marker/nc除く): 3勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-12-24 | PANCRASE 340 | アトム級 | ジェニー・ファン | - | win | 3R 5:00、判定/0-3 |
| 2024-03-31 | PANCRASE 341 | アトム級 | 沙弥子 | - | win | 1R 0:48、TKO/グラウンドのパンチ |
| 2024-09-29 | PANCRASE 347 | アトム級 | ホン・イェリン | - | win | 3R 5:00、判定/3-0 |

## 既存fighters.ts収録済み(listed)パンクラス16名

### ゴイチ・ヤマウチ (fighters.ts slug: yamauchi-goiti)

プロフィールURL: https://www.pancrase.co.jp/data/prfl-e/goitiyamauchi.html

**レコード(mnews集計、no_marker/nc除く): 2勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数2件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-04-27 | PANCRASE 353 | ウェルター級 | 内藤由良 | - | win | 1R 1:10、TKO/スタンドのパンチ |
| 2025-12-21 | PANCRASE 360 | ウェルター級 | 佐藤生虎 | - | win | 2R 1:47、TO/RNC |

### ラファエル・バルボーザ (fighters.ts slug: barboza-rafael)

プロフィールURL: https://www.pancrase.co.jp/data/prfl-e/rafaelbarbosa.html

**レコード(mnews集計、no_marker/nc除く): 3勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数3件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-03-09 | PANCRASE 352 | ライト級 | 粕谷優介 | kasuya-yusuke | win | 2R 4:02、TS/ダースチョーク |
| 2025-07-27 | PANCRASE 355 | ライト級 | 鈴木悠斗 | - | win | 1R 4:31、TO/スピニングチョーク |
| 2026-03-14 | PANCRASE 361 | ライト級 | 雑賀 ヤン坊 達也 | saiga-yanbo-tatsuya | win | 2R 4:41、TKO/瞼のカット |

### 神谷大智 (fighters.ts slug: kamiya-daichi)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/kamiya.html

**レコード(mnews集計、no_marker/nc除く): 7勝0敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数8件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2022-10-10 | NEO BLOOD! 2 | ライト級 | 芳賀ビラル海 | haga-bilalkai | win | 3R 5:00、判定/1-2 |
| 2023-06-04 | PANCRASE 334 | ライト級 | 吉村天弥 | - | win | 3R 2:30、DQ/グラウンドでの顔面膝蹴り |
| 2023-09-24 | PANCRASE 337 | ライト級 | 余 勇利 | - | win | 3R 5:00、判定/0-3 |
| 2024-03-31 | PANCRASE 341 | ライト級 | 平 信一 | - | win (left_marker_inferred_from_opponent(source_omitted_x)) | 3R 3:08、TO/RNC |
| 2024-06-30 | PANCRASE 345 | ライト級 | 西尾真輔 | nishio-shinsuke | (none) (no_marker_in_source) | 1R 1:16、ノーコンテスト |
| 2025-12-21 | PANCRASE 360 | ライト級 | 松岡嵩志 | - | win | 2R 1:05、TKO/腕の負傷 |
| 2026-03-14 | PANCRASE 361 | ライト級 | 葛西和希 | - | win | 3R 5:00、判定/2-1 |
| 2026-06-28 | PANCRASE 363 | ライト級 | 粕谷優介 | kasuya-yusuke | win | 2R 3:39、TKO/グラウンドのパンチ |

### 粕谷優介 (fighters.ts slug: kasuya-yusuke)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/kasuya.html

**レコード(mnews集計、no_marker/nc除く): 6勝8敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数14件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2017-08-20 | PANCRASE289 | フェザー級 | 松嶋こよみ | matsushima-koyomi | loss | 3R 5:00、判定/3-0 |
| 2017-12-10 | PANCRASE292 | フェザー級 | ISAO | isao | loss | 3R 5:00、判定/3-0 |
| 2019-04-14 | PANCRASE304 | ライト級 | 菊入正行 | - | win | 1R 1:01、TKO(レフェリーストップ)/グラウンドのパンチ |
| 2019-09-29 | PANCRASE308 | ライト級 | サドゥロエフ・ソリホン | - | loss | 2R 0:37、TKO/グラウンドのパンチ |
| 2021-06-27 | PANCRASE 322 | ライト級 | 松岡嵩志 | - | loss | 1R 0:22、KO/スタンドのパンチ |
| 2022-04-29 | PANCRASE 327 | ライト級 | 平信一 | - | win | 2R 2:40、TO/RNC |
| 2022-12-25 | PANCRASE 330 | ライト級 | 岡野裕城 | - | win | 1R 4:47、TKO/RNC |
| 2023-04-30 | PANCRASE 333 | ライト級 | 葛西和希 | - | win | 3R 5:00、判定/3-0 |
| 2023-12-24 | PANCRASE 340 | ライト級 | 雑賀 ヤン坊 達也 | saiga-yanbo-tatsuya | loss | 3R 5:00、判定/0-3 |
| 2024-04-29 | PANCRASE 342 | ライト級 | 久米鷹介 | - | loss | 3R 5:00、判定/0-3 |
| 2024-09-29 | PANCRASE 347 | ライト級 | ホン・ソンチャン | - | win | 1R 1:36、TKO/グラウンドのパンチ |
| 2025-03-09 | PANCRASE 352 | ライト級 | ラファエル・バルボーザ | barboza-rafael | loss | 2R 4:02、TS/ダースチョーク |
| 2025-12-21 | PANCRASE 360 | ライト級 | ISAO | isao | win | 2R 0:44、TO/RNC |
| 2026-06-28 | PANCRASE 363 | ライト級 | 神谷大智 | kamiya-daichi | loss | 2R 3:39、TKO/グラウンドのパンチ |

### 雑賀ヤン坊達也 (fighters.ts slug: saiga-yanbo-tatsuya)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/saika.html

**レコード(mnews集計、no_marker/nc除く): 8勝2敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数10件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2019-07-21 | PANCRASE307 | ライト級 | 小林裕 | - | win | 1R 1:34、KO/スタンドのパンチ |
| 2020-09-27 | PANCRASE 318 -Beyond317- | ライト級 | 林源平 | - | win | 1R 1:55、KO/スタンドのパンチ |
| 2021-12-12 | PANCRASE 325 | ライト級 | 久米鷹介 | - | loss | 2R 2:28、TO/腕ひしぎ十字固め |
| 2022-09-11 | PANCRASE 329 | ライト級 | 松岡嵩志 | - | win | 1R 1:36、TKO/グラウンドのパンチ |
| 2022-12-25 | PANCRASE 330 | ライト級 | シュウジ ヤマウチ | - | win | 1R 4:49、TKO/グラウンドのパンチ |
| 2023-12-24 | PANCRASE 340 | ライト級 | 粕谷優介 | kasuya-yusuke | win | 3R 5:00、判定/0-3 |
| 2024-03-31 | PANCRASE 341 | ライト級 | アキラ | - | win | 1R 1:42、KO/ハイキック |
| 2024-09-29 | PANCRASE 347 | ライト級 | 久米鷹介 | - | win | 2R 0:27、TKO/グラウンドのパンチ |
| 2025-04-27 | PANCRASE 353 | ライト級 | 天弥 | tenya | win | 3R 0:54、TKO/グラウンドのパンチ |
| 2026-03-14 | PANCRASE 361 | ライト級 | ラファエル・バルボーザ | barboza-rafael | loss | 2R 4:41、TKO/瞼のカット |

### 天弥 (fighters.ts slug: tenya)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/yoshimuratenya.html

**レコード(mnews集計、no_marker/nc除く): 5勝2敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-03-04 | NEO BLOOD! 3 | ライト級 | 芳賀ビラル海 | haga-bilalkai | win | 1R 3:16、TKO/グラウンドのパンチ |
| 2023-06-04 | PANCRASE 334 | ライト級 | 神谷大智 | kamiya-daichi | loss | 3R 2:30、DQ/グラウンドでの顔面膝蹴り |
| 2023-08-27 | NEO BLOOD! 5 | ライト級 | 木村裕斗 | - | win | 1R 0:29、TKO/グラウンドのパンチ |
| 2024-03-31 | PANCRASE 341 | ライト級 | 松本光史 | - | win | 3R 5:00、判定/0-3 |
| 2024-09-29 | PANCRASE 347 | ライト級 | 葛西和希 | - | win | 1R 4:58、TKO/グラウンドのパンチ |
| 2025-04-27 | PANCRASE 353 | ライト級 | 雑賀 ヤン坊 達也 | saiga-yanbo-tatsuya | loss | 3R 0:54、TKO/グラウンドのパンチ |
| 2025-12-21 | PANCRASE 360 | ライト級 | クリストフ・キルシュ | - | win | 1R 1:37、TO/RNC |

### 栁川唯人 (fighters.ts slug: yanagawa-yuito)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/yanagawayuito.html

**レコード(mnews集計、no_marker/nc除く): 6勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数7件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-03-04 | NEO BLOOD! 3 | フェザー級 | 森井一輝 | - | win | 1R 0:50、KO/スラム |
| 2023-08-27 | NEO BLOOD! 5 | フェザー級 | 高田寛也 | - | win | 1R 1:40、TO/腕十字固め |
| 2023-12-24 | PANCRASE 340 | フェザー級 | Ryo | - | loss | 3R 0:33、TO/腕十字固め |
| 2024-09-29 | PANCRASE 347 | フェザー級 | 糸川義人 | - | win | 3R 5:00、判定/0-3 |
| 2024-12-15 | PANCRASE 350 | フェザー級 | 名田英平 | - | win | 1R 3:21、TKO/グラウンドのパンチ |
| 2025-06-01 | PANCRASE 354 | フェザー級 | 平田直樹 | hirata-naoki | win | 3R 5:00、判定/0-3 |
| 2025-12-21 | PANCRASE 360 | フェザー級 | カリベク・アルジクル ウール | - | win | 1R 2:45、KO/スタンドのパンチ |

### オタベク・ラジャボフ (fighters.ts slug: rajabov-otabek)

プロフィールURL: https://www.pancrase.co.jp/data/prfl-e/otabek.html

**レコード(mnews集計、no_marker/nc除く): 4勝0敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数5件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-07-21 | PANCRASE 346 | バンタム級 | 高城光弘 | - | win | 3R 3:18、TO/RNC |
| 2024-12-15 | PANCRASE 350 | バンタム級 | 田嶋 椋 | tajima-ryo | (none) (no_marker_in_source) | 試合中止 |
| 2025-09-23 | PANCRASE 356 | フェザー級 | 遠藤来生 | - | win | 1R 3:28、TKO/スタンドの膝蹴り |
| 2025-12-21 | PANCRASE 360 | フェザー級 | Ryo | - | win | 1R 5:00、TKO/コーナーストップ |
| 2026-06-28 | PANCRASE 363 | フェザー級 | 木下尚祐 | - | win | 3R 2:45、TS/三角絞め |

### 平田直樹 (fighters.ts slug: hirata-naoki)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/hiratanaoki.html

**レコード(mnews集計、no_marker/nc除く): 5勝4敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数9件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2023-04-30 | PANCRASE 333 | ①フェザー級 | 渡辺謙明 | - | win | 1R 2:18、CO/肩固め |
| 2023-07-09 | PANCRASE 336 | フェザー級 | 糸川義人 | - | win | 2R 1:50、TKO/グラウンドのパンチ |
| 2023-09-24 | PANCRASE 337 | フェザー級 | 遠藤来生 | - | win | 3R 5:00、判定/3-0 |
| 2023-12-24 | PANCRASE 340 | フェザー級 | 亀井晨佑 | - | win | 3R 5:00、判定/0-3 |
| 2024-06-30 | PANCRASE 345 | フェザー級 | Ryo | - | win | 3R 5:00、判定/3-0 |
| 2024-12-15 | PANCRASE 351 | フェザー級 | 三宅輝砂 | miyake-kisa | loss | 1R 1:12、TKO/グラウンドのパンチ |
| 2025-06-01 | PANCRASE 354 | フェザー級 | 栁川唯人 | yanagawa-yuito | loss | 3R 5:00、判定/0-3 |
| 2025-11-09 | PANCRASE 359 | フェザー級 | カリベク・アルジクル ウール | - | loss | 2R 3:55、TO/レッグロック |
| 2026-05-04 | PANCRASE BLOOD.10 | フェザー級 | 敢流 | - | loss | 3R 1:06、TKO/スタンドのパンチ |

### 清水博人 (fighters.ts slug: shimizu-hiroto)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/shimizuhiroto.html

**レコード(mnews集計、no_marker/nc除く): 5勝0敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数5件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2025-02-11 | PANCRASE BLOOD.5 | フェザー級 | 長 佳輝 | - | win | 1R 3:48、KO/スタンドのパンチ |
| 2025-05-06 | PANCRASE BLOOD.6 | フェザー級 | 目怒頑丈 | - | win | 1R 2:05、TKO/グラウンドのパンチ |
| 2025-08-10 | PANCRASE BLOOD.8 | フェザー級 | 福里凱亜 | - | win | 3R 5:00、判定/1-2 |
| 2025-11-09 | PANCRASE 358 | フェザー級 | 糸川義人 | - | win | 3R 4:31、TKO/スタンドのパンチ |
| 2026-03-14 | PANCRASE 361 | フェザー級 | 岡田拓真 | - | win | 3R 5:00、判定/0-3 |

### 三宅輝砂 (fighters.ts slug: miyake-kisa)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/miyakekisa.html

**レコード(mnews集計、no_marker/nc除く): 9勝4敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数14件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2020-12-13 | PANCRASE 320 | バンタム級 | 矢澤諒 | - | win | 3R 5:00、判定/3-0 |
| 2021-05-30 | PANCRASE 321 | 1DAYフェザー級 | 牧野滉風 | - | win | 1R 3:03、TO/RNC |
| 2021-05-30 | PANCRASE 321 | ネオブラッドトーナメント｛フェザー級 | 為房虎太郎 | - | win | 1R 5:00、TKO/アゴの骨折 |
| 2021-09-12 | PANCRASE 323 | ⑤フェザー級 | 亀井晨佑 | - | loss | 3R 5:00、判定/2-1 |
| 2022-04-29 | PANCRASE 327 | フェザー級 | 田村一聖 | - | loss | 3R 5:00、判定/3-0 |
| 2022-10-10 | NEO BLOOD! 2 | フェザー級 | 小森真誉 | - | win | 2R 0:53、KO/スタンドのパンチ |
| 2023-03-26 | PANCRASE 331 | フェザー級 | 中田大貴 | - | loss | 2R 4:59、テクニカルサブミッション/フロントチョーク |
| 2023-11-12 | PANCRASE 338 | フェザー級 | 櫻井裕康 | - | win | 2R 4:52、TKO(レフェリーストップ)/RNC |
| 2024-02-18 | PANCRASE BLOOD.1 | フェザー級 | 名田英平 | - | win | 2R 1:02、TKO/スタンドのパンチ |
| 2024-07-21 | PANCRASE 346 | フェザー級 | 石田陸也 | - | win | 1R 2:34、TKO/グラウンドのパンチ |
| 2024-12-15 | PANCRASE 351 | フェザー級 | 平田直樹 | hirata-naoki | win | 1R 1:12、TKO/グラウンドのパンチ |
| 2025-06-01 | PANCRASE 354 | フェザー級 | 中田大貴 | - | (none) (no_marker_in_source) | 1R 3:48、TKO/スタンドのパンチ |
| 2026-05-31 | PANCRASE 362 | フェザー級 | 遠藤来生 | - | win | 3R 5:00、判定/0-3 |
| 2026-07-26 | PANCRASE 364 | フェザー級 | カリベク・アルジクル ウール | - | loss | 3R 5:00、判定/3-0 |

### 田嶋椋 (fighters.ts slug: tajima-ryo)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/tajimaryo.html

**レコード(mnews集計、no_marker/nc除く): 9勝3敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数13件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2021-05-30 | PANCRASE 321 | ネオブラッドトーナメント｛バンタム級 | 矢澤諒 | - | win | 3R 5:00、判定/1-2 |
| 2021-09-12 | PANCRASE 323 | ネオブラッドトーナメント｛バンタム級 | 風間敏臣 | - | loss | 1R 0:55、TO/ヒールフック |
| 2021-12-12 | PANCRASE 325 | ④バンタム級 | サイバー遼 | - | win | 1R 4:50、TKO/スタンドのパンチ |
| 2022-05-22 | NEO BLOOD! 1 | バンタム級 | 水永将太 | - | win | 2R 2:30、TKO(レフェリーストップ)/グラウンドのパンチ |
| 2022-07-18 | PANCRASE 328 | ③バンタム級 | 鬼神光司 | - | win | 3R 5:00、判定/2-1 |
| 2022-10-10 | NEO BLOOD! 2 | バンタム級 | 上田祐起 | - | win | 2R 2:41、TKO/グラウンドのパンチ |
| 2022-12-25 | PANCRASE 330 | バンタム級 | TSUNE | - | win | 4R 3:13、TKO/スタンドのパンチ |
| 2023-04-30 | PANCRASE 333 | バンタム級 | 中島太一 | nakajima-taichi | loss | 5R 5:00、判定/3-0 |
| 2023-12-24 | PANCRASE 340 | バンタム級 | 笹 晋久 | - | win | 3R 5:00、判定/3-0 |
| 2024-03-31 | PANCRASE 341 | バンタム級 | 井村 塁 | imura-rui | loss | 3R 5:00、判定/0-3 |
| 2024-12-15 | PANCRASE 350 | バンタム級 | オタベク・ラジャボフ | rajabov-otabek | (none) (no_marker_in_source) | 試合中止 |
| 2025-06-01 | PANCRASE 354 | バンタム級 | 山木麻弥 | - | win | 3R 3:54、TKO/セコンドのタオル投入 |
| 2025-12-21 | PANCRASE 360 | バンタム級 | 井村 塁 | imura-rui | win | 1R 3:42、TKO/グラウンドのパンチ |

### 松井 涼 (fighters.ts slug: matsui-ryo)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/matsuiryo.html

**レコード(mnews集計、no_marker/nc除く): 3勝1敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数4件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2024-08-25 | PANCRASE BLOOD.4 | バンタム級 | 佐々木健吾 | - | win | 3R 5:00、判定/3-0 |
| 2025-03-09 | PANCRASE 352 | バンタム級 | 千種純平 | - | win | 3R 5:00、判定/0-3 |
| 2025-09-23 | PANCRASE 357 | バンタム級 | アンドレイ・チェルバエフ | - | win | 3R 5:00、判定/3-0 |
| 2026-02-11 | PANCRASE BLOOD.9 | (欠損) | 宮城成歩滝 | - | loss | 3R 0:10、KO/スタンドのパンチ |

### 井村塁 (fighters.ts slug: imura-rui)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/imurarui.html

**レコード(mnews集計、no_marker/nc除く): 13勝5敗0分 (NC 0件、マーカーなし/対象外 0件、bout総数18件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2020-02-16 | PANCRASE312 | バンタム級 | 宮平守太郎 | - | win | 1R 2:14、タップアウト/腕十字固め |
| 2020-09-27 | PANCRASE 318 -Beyond317- | バンタム級 | 田中スネ夫ハヤト | - | win | 2R 2:31、ギブアップ/RNC |
| 2020-10-25 | PANCRASE 319 | バンタム級 | MG眞介 | - | win | 1R 3:33、TKO/アームバー |
| 2020-12-13 | PANCRASE 320 | バンタム級 | 修我 | - | win | 1R 1:40、TKO/三角絞め |
| 2021-05-30 | PANCRASE 321 | バンタム級 | 平岡将英 | - | win | 1R 2:48、TKO(レフェリーストップ)/グラウンドのパンチ |
| 2021-10-17 | PANCRASE 324 | バンタム級 | ジェイク・ムラタ | - | win | 1R 2:11、TO/三角絞め |
| 2021-12-12 | PANCRASE 325 | バンタム級 | 中島太一 | nakajima-taichi | loss | 2R 0:08、TKO/スタンドのパンチ |
| 2022-04-29 | PANCRASE 327 | バンタム級 | TSUNE | - | loss | 3R 5:00、判定/0-3 |
| 2022-09-11 | PANCRASE 329 | バンタム級 | 平田丈二 | - | win | 2R 2:38、TO/RNC |
| 2022-12-25 | PANCRASE 330 | バンタム級 | 佐久間健太 | - | win | 3R 5:00、判定/3-0 |
| 2023-04-30 | PANCRASE 333 | バンタム級 | 石井逸人 | - | win | 3R 5:00、判定/3-0 |
| 2023-09-24 | PANCRASE 337 | バンタム級 | 河村泰博 | - | loss | 1R 0:56、TO/フロントチョーク |
| 2023-11-12 | PANCRASE 339 | バンタム級 | 矢澤 諒 | - | win | 1R 1:10、TO/RNC |
| 2024-03-31 | PANCRASE 341 | バンタム級 | 田嶋 椋 | tajima-ryo | win | 3R 5:00、判定/0-3 |
| 2024-09-29 | PANCRASE 347 | バンタム級 | カリベク・アルジクル ウルル | - | loss | 1R 1:15、TKO/グラウンドのパンチ |
| 2025-03-09 | PANCRASE 352 | バンタム級 | 松井斗輝 | - | win | 1R 3:18、TO/RNC |
| 2025-07-27 | PANCRASE 355 | バンタム級 | 髙城光弘 | - | win | 3R 0:21、テクニカル判定/3-0 |
| 2025-12-21 | PANCRASE 360 | バンタム級 | 田嶋 椋 | tajima-ryo | loss | 1R 3:42、TKO/グラウンドのパンチ |

### 大塚智貴 (fighters.ts slug: otsuka-tomoki)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/otsukatomoki.html

**レコード(mnews集計、no_marker/nc除く): 8勝7敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数16件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2020-10-25 | PANCRASE 319 | ストロー級 | 山北渓人 | keito-yamakita | loss | 3R 5:00、判定/3-0 |
| 2021-05-30 | PANCRASE 321 | ストロー級 | 石井涼馬 | - | win | 3R 5:00、判定/3-0 |
| 2021-09-12 | PANCRASE 323 | 第27回ネオブラッドトーナメント｛ストロー級 | 朝日向大貴 | - | win | 3R 5:00、判定/3-0 |
| 2021-12-12 | PANCRASE 325 | ①第27回ネオブラッドトーナメント決勝戦｛ストロー級 | 孫悟空DATE | - | win | 2R 3:54、TO/三角絞め |
| 2022-05-22 | NEO BLOOD! 1 | フライ級 | 谷村泰嘉 | - | loss | 1R 0:35、TO/フロントチョーク |
| 2022-07-18 | PANCRASE 328 | フライ級 | 前田浩平 | - | win | 3R 5:00、判定/0-3 |
| 2023-03-26 | PANCRASE 332 | フライ級 | 赤﨑清志朗 | - | win | 2R 0:27、TO/フロントチョーク |
| 2023-07-09 | PANCRASE 336 | フライ級 | 松井斗輝 | - | loss | 3R 5:00、判定/0-3 |
| 2023-11-12 | PANCRASE 339 | フライ級 | 濱田 巧 | hamada-takumi | loss | 3R 5:00、判定/3-0 |
| 2024-03-31 | PANCRASE 341 | フライ級 | 眞藤源太 | - | win | 3R 5:00、判定/3-0 |
| 2024-06-30 | PANCRASE 345 | フライ級 | 山崎聖哉 | - | win | 2R 4:20、KO/スタンドのパンチ |
| 2024-11-10 | PANCRASE 348 | フライ級 | 秋葉太樹 | - | loss | 3R 5:00、判定/0-3 |
| 2025-04-27 | PANCRASE 353 | フライ級 | 浜本“キャット”雄大 | - | win | 3R 5:00、判定/3-0 |
| 2025-07-27 | PANCRASE 355 | フライ級 | 濱田 巧 | hamada-takumi | (none) (no_marker_in_source) | 3R 0:31、ノーコンテスト/アクシデントバッティング |
| 2025-11-09 | PANCRASE 358 | フライ級 | 濱田 巧 | hamada-takumi | loss | 5R 5:00、判定/2-1 |
| 2026-03-14 | PANCRASE 361 | フライ級 | 猿飛流 | - | loss | 2R 0:25、TKO/グラウンドのパンチ |

### 濱田 巧 (fighters.ts slug: hamada-takumi)

プロフィールURL: https://www.pancrase.co.jp/data/prfl2/hamadatakumi.html

**レコード(mnews集計、no_marker/nc除く): 7勝0敗0分 (NC 0件、マーカーなし/対象外 1件、bout総数8件)**

| 日付 | 大会 | 階級表記 | 対戦相手 | 相手slug(findFighterSlugByName) | 結果 | 決着方法(生データ) |
|---|---|---|---|---|---|---|
| 2022-05-22 | NEO BLOOD! 1 | フライ級 | 渦巻DATE | - | win | 1R 3:39、TKO(レフェリーストップ)/グラウンドのパンチ |
| 2022-10-10 | NEO BLOOD! 2 | フライ級 | 伊藤まこと | - | win | 3R 5:00、判定/0-3 |
| 2023-11-12 | PANCRASE 339 | フライ級 | 大塚智貴 | otsuka-tomoki | win | 3R 5:00、判定/3-0 |
| 2024-03-31 | PANCRASE 341 | フライ級 | 山崎聖哉 | - | win | 3R 2:25、TKO/スタンドのパンチ |
| 2024-07-21 | PANCRASE 346 | フライ級 | ラファエル・リベイロ | - | win | 3R 5:00、判定/2-1 |
| 2025-07-27 | PANCRASE 355 | フライ級 | 大塚智貴 | otsuka-tomoki | (none) (no_marker_in_source) | 3R 0:31、ノーコンテスト/アクシデントバッティング |
| 2025-11-09 | PANCRASE 358 | フライ級 | 大塚智貴 | otsuka-tomoki | win | 5R 5:00、判定/2-1 |
| 2026-05-31 | PANCRASE 362 | フライ級 | ジョセフ・カマチョ | - | win | 2R 1:05、TO/フロントチョーク |


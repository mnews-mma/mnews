# パンクラス公式アーカイブ 出場選手データ信頼開始年 確定調査(読み取り専用)

- 調査日: 2026-07-27
- 調査対象: `https://www.pancrase.co.jp/data/result/` 配下(年別index + 個別大会ページ)、`https://www.pancrase.co.jp/data/prfl2/` `prfl-e/` `prfl-a/`(選手名鑑)
- 手法: curl(UA: `Mozilla/5.0 (compatible; MNewsArchiveAudit/1.0)`、リクエスト間隔2秒以上)で取得したHTMLを、タグを`|`に落とす程度の単純整形(`sed 's/<[^>]*>/|/g'`)のみで人間の目視確認。**新規の正規表現によるバウト抽出は一切実装していない。**
- 変更ファイル: `out/pancrase-archive-audit.md` のみ。`data/`・`src/`は無変更(git diffゼロ)。

## 結論(最重要)

**出場選手データが信頼できる開始年 = 1993年**(パンクラス公式アーカイブの最古年)。

DEEP公式アーカイブの調査(PR #231/#232)とは対照的に、パンクラス公式アーカイブは**1993年から2026年現在まで、個別対戦カード(選手名+vs+勝敗記号○/×/△)が単一の一貫したテンプレート構造で全年にわたり読み取り可能**だった。年代によって付随情報(体重表示・ランキング表示・王座名・採点表リンク等)は増減するが、「誰と誰が対戦し、勝敗がどうだったか」という核となる出場選手データの構造自体は1993年時点から破綻していない。

停止条件(本文フォーマット10種超/開始年が2024年より新しい/サンプル100件超)には**いずれも該当しない**。

## 1. 年別index調査(1993〜2026年、全34年)

`https://www.pancrase.co.jp/data/result/index.html` から1993〜2026年の全リンクが存在することを確認(欠番年なし)。各年の年別indexページ(`https://www.pancrase.co.jp/data/result/{年}/index.html`)は全34年ともHTTP 200で取得できた。「大会がない年」と「indexページ自体が存在しない年」の区別は不要だった(全年ともindexページが存在し、かつ全年1件以上の大会を保持)。

| 年 | 大会数(index内の個別ページリンクのユニーク数) | サンプル取得URL(1件) |
|---|---|---|
| 1993 | 4 | https://www.pancrase.co.jp/data/result/1993/1208.html |
| 1994 | 10 | https://www.pancrase.co.jp/data/result/1994/1217.html |
| 1995 | 10 | https://www.pancrase.co.jp/data/result/1995/1214.html |
| 1996 | 11 | https://www.pancrase.co.jp/data/result/1996/1215.html |
| 1997 | 12 | https://www.pancrase.co.jp/data/result/1997/1220.html |
| 1998 | 15 | https://www.pancrase.co.jp/data/result/1998/1219.html |
| 1999 | 12 | https://www.pancrase.co.jp/data/result/1999/1218.html |
| 2000 | 9 | https://www.pancrase.co.jp/data/result/2000/1209.html |
| 2001 | 9 | https://www.pancrase.co.jp/data/result/2001/1201.html |
| 2002 | 10 | https://www.pancrase.co.jp/data/result/2002/1221.html |
| 2003 | 12 | https://www.pancrase.co.jp/data/result/2003/1221.html |
| 2004 | 13 | https://www.pancrase.co.jp/data/result/2004/1221.html |
| 2005 | 14 | https://www.pancrase.co.jp/data/result/2005/1204.html |
| 2006 | 14 | https://www.pancrase.co.jp/data/result/2006/1210.html |
| 2007 | 14 | https://www.pancrase.co.jp/data/result/2007/1222.html |
| 2008 | 11 | https://www.pancrase.co.jp/data/result/2008/1207.html |
| 2009 | 10 | https://www.pancrase.co.jp/data/result/2009/1206.html |
| 2010 | 14 | https://www.pancrase.co.jp/data/result/2010/1219.html |
| 2011 | 13 | https://www.pancrase.co.jp/data/result/2011/1203.html |
| 2012 | 16 | https://www.pancrase.co.jp/data/result/2012/1201.html |
| 2013 | 15 | https://www.pancrase.co.jp/data/result/2013/1231.html |
| 2014 | 12 | https://www.pancrase.co.jp/data/result/2014/1221.html |
| 2015 | 15 | https://www.pancrase.co.jp/data/result/2015/1223.html |
| 2016 | 13 | https://www.pancrase.co.jp/data/result/2016/1218.html |
| 2017 | 13 | https://www.pancrase.co.jp/data/result/2017/1224.html |
| 2018 | 13 | https://www.pancrase.co.jp/data/result/2018/1224.html |
| 2019 | 13 | https://www.pancrase.co.jp/data/result/2019/1208.html |
| 2020 | 7 | https://www.pancrase.co.jp/data/result/2020/1213.html |
| 2021 | 7 | https://www.pancrase.co.jp/data/result/2021/1212.html |
| 2022 | 8 | https://www.pancrase.co.jp/data/result/2022/1225.html |
| 2023 | 8 | https://www.pancrase.co.jp/data/result/2023/1224.html |
| 2024 | 9 | https://www.pancrase.co.jp/data/result/2024/0929.html |
| 2025 | 9 | https://www.pancrase.co.jp/data/result/2025/1221.html |
| 2026 | 6 | https://www.pancrase.co.jp/data/result/2026/0726.html(進行中) |

備考:
- 1994年の年別indexページ(`1994/index.html`)のみ、生バイト上で日付とリンクの間の空白文字が非UTF-8バイト(mojibake)になっており、`cat`でそのまま表示すると文字化けする。ただし`grep -a`(バイナリ扱い回避)でhref抽出・件数集計は問題なく行え、個別大会ページ本文(`1994/1217.html`)自体は正常なUTF-8で選手名・対戦カードが読み取れた。実害なし。

## 2. 各年1件サンプリングによる本文フォーマット目視確認(全34件)

各年から1大会(index内の先頭リンク)を取得し、タグを`|`に落とした本文を目視確認した。**全34年で「メインイベント/セミファイナル/第N試合」のような見出し + 個別選手名(2名) + `vs` + 勝敗記号(○/×/△) + 決着方法」の構造が確認できた。** 年代によって以下のように周辺情報の詳しさが変化するが、出場選手データそのものの読み取り可否には影響しない。

### 1993〜2001年(初期フォーマット)
体重表示・ランキング表示なし。選手名+所属+vs+勝敗記号+決着方法のみ。

例(1993年12月8日、メインイベント。原文抜粋):
```
|メインイベント　30分1本勝負|
|○|船木誠勝|
|(パンクラス)|
|vs|
|高橋義生|×
|(パンクラス)|
|3分09秒、レフェリーストップ|
```

### 2002〜2019年(中期フォーマット)
ランキング表示・王座名・体重(kg)表示・判定スコアの採点者名が追加。構造自体は初期と同一(選手名+vs+勝敗記号は変わらず)。

例(2008年12月7日、メインイベント。原文抜粋):
```
|メインイベント　第2代ライト級キング・オブ・パンクラス決定戦　5分3ラウンド|
|ランキング1位|
|○|井上克也|
|vs|
|ランキング2位|
|大石幸史|×
|3R 5:00、判定/3-0|
判定：松宮智生(○29-29)和田良覚(30-29)岡本浩稔(30-29)
|井上克也(70.2kg)|
|大石幸史(70.1kg)|
```

### 2020〜2026年(現行フォーマット)
「全試合採点結果表」への内部リンク、試合番号の丸数字(①②…)、公式ランキング一覧(PANCRASE OFFICIAL RANKING)が追加。核となる選手名+vs+勝敗記号+決着方法の構造は変わらず。

例(2026年7月26日、メインイベント。原文抜粋):
```
|メインイベント⑧　ストロー級次期挑戦者決定戦　5分3ラウンド|
|1位|
×|佐々木瞬真|
|vs|
|2位|
|船田電池|○
|3R 5:00、判定/0-3|
判定：出口直樹(28-29)中島康喜(28-29)梅木良則(28-29)
|佐々木瞬真(52.3kg)|
|船田電池(52.45kg)|
```

いずれの時代区分も「抽出できない」ケースは0件だった。DEEP調査で見られたような「個別対戦結果が一切なく優勝者サマリーのみ」の形式は、サンプリングした34件の中では確認されなかった。

各年サンプルの`vs`出現回数(=対戦カード数の目安、全34年で最小5件〜最大22件、全年で複数カード掲載を確認):

| 年 | vs件数 | 年 | vs件数 | 年 | vs件数 | 年 | vs件数 |
|---|---|---|---|---|---|---|---|
|1993|5|2002|9|2011|13|2020|22|
|1994|5|2003|10|2012|19|2021|16|
|1995|7|2004|9|2013|19|2022|17|
|1996|7|2005|9|2014|14|2023|14|
|1997|8|2006|10|2015|12|2024|15|
|1998|8|2007|8|2016|16|2025|14|
|1999|8|2008|17|2017|18|2026|8|
|2000|7|2009|16|2018|15|
|2001|8|2010|12|2019|15|

## 3. 境界確認について

各年の代表フォーマットが「初期(1993-2001)→中期(2002-2019)→現行(2020-2026)」と滑らかに情報量が増える一方、選手名+vs+勝敗記号という核構造は**1993年の最初のサンプルから既に完全な形で存在**しており、どの隣接年境界でも「読める→読めない」の切り替わりは発生しなかった。そのため追加の境界詰めサンプリングは不要と判断した(全34年で1件ずつ、合計34件のサンプリングに留めた)。

## 4. 選手名鑑(prfl2 / prfl-e / prfl-a)の疎通確認

- `https://www.pancrase.co.jp/data/prfl2/index.html`(日本人選手index): HTTP 200、UTF-8、あかさたな行の見出し+選手名リンク一覧が正常にパースできることを確認。
- `https://www.pancrase.co.jp/data/prfl-e/index.html`(外国人選手index): HTTP 200、UTF-8、正常にパース可能。
- `https://www.pancrase.co.jp/data/prfl-a/index.html`(女子選手index): HTTP 200、UTF-8、正常にパース可能。
- 個別ページサンプル3件(日本人1件・外国人1件・女子1件)いずれもHTTP 200、UTF-8で取得でき、生年月日・身長体重・出身・所属・年別対戦成績(日付・対戦相手・ラウンド/決着方法・勝敗記号)が読み取れた。
  - 日本人サンプル: `https://www.pancrase.co.jp/data/prfl2/tanimuraaito.html`
  - 外国人サンプル: `https://www.pancrase.co.jp/data/prfl-e/soares.html`
  - 女子サンプル: `https://www.pancrase.co.jp/data/prfl-a/aoki.html`

指示書に記載のあった「名鑑個別ページが過去に外部から開けなかった実績(文字コード疑い)」は、**今回の調査環境・手法(curl + 明示UA + IPv4強制 `-4` + リクエスト間隔確保)では再現しなかった**。全て`file`コマンドで`UTF-8 text`と判定され、文字化けは見られなかった。名簿の抽出自体(選手名の網羅的リストアップ・パース処理の実装)は別指示書のスコープのため、ここでは疎通確認のみに留めた。

## 5. 停止条件の該非

- 本文フォーマットが10種を超えた → **非該当**(実質1種類の構造で、時代による周辺情報の増減が3段階ある程度)
- 「信頼できる開始年」が2024年より新しい → **非該当**(1993年)
- サンプリングが100件を超える必要が生じた → **非該当**(年別index 34件 + 大会本文サンプル34件 + 名鑑index 3件 + 名鑑個別3件 = 合計74件)

## 6. 取得ファイル一覧(生データ、worktree外・スクラッチ領域に保存)

作業用に取得した生HTMLは本レポートの外部(スクラッチディレクトリ)に保管しており、`out/`にはこのMarkdownのみをコミットしている(DEEP調査同様、1ファイルのみの方針に合わせた)。

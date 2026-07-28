# PR #252(修斗関連)投入値 vs data/shootoRecords.json 再集計 突合レポート

作成日: 2026-07-29
対象: draft PR #258 (branch `feat/roster-recheck-shooto`) 読み取り専用調査

## 停止条件チェック

差分のある選手は19名で、40名の停止条件には該当しません(そのまま完了報告します)。

## サマリー

- 対象選手数(修斗関連。`org==="shooto"` または `orgs`に`"shooto"`を含む): **59名**
  - 内訳: 単独修斗(org==="shooto") 57名 / 複数団体混在(KAREN・SARAMI) 2名
- 差分ありの選手数: **19名**
- 差分なしの選手数: 40名

### 差分の内訳(件数はbout単位、複数選手にまたがる同一試合の重複カウントを含む)

- `result`違い(win/loss/draw/ncの実際の勝敗が投入値と異なる): **7件**
  - 全件が「投入データではwin/lossだったが、再集計ではdraw」というパターン。背景に記載のドロー誤判定バグと一致する。
- `method`違い(内容差、区切り文字ノイズを除く): **12件**
  - 全件が「投入データのmethodが空文字列("")だが、再集計では"ドロー"」というパターン(resultフィールドは既にdrawで一致しているケースも含む=method情報のみの欠落)。
- `round`違い: **1件**
- `event`名違い: **2件**(大会名が"プロフェッショナル修斗公式戦"という汎用ラベルだったものが、再集計では実際の大会名に解決)
- 投入データにあるが再集計データに見つからない試合(`notFoundInRecords`、KAREN/SARAMIの想定パンクラス分を除く): **0件**
- 再集計データにあるが投入データ(history)に無い試合(`missingFromInjected`、KAREN/SARAMIを除く単独修斗選手のみ対象): **12件**
- 集計値(wins/losses/draws)が投入値と不一致の選手数(KAREN/SARAMIを除く): **9名**

参考情報(差分にはカウントしていないもの): methodフィールドで区切り文字(スラッシュ"/" ⇔ 半角スペース)のみが異なる表記ゆれが **130件** あった。これは値の相違ではなく表記規約の違いであることをサンプル照合で確認済み(下記「検証メモ」参照)。KAREN・SARAMIについては、投入データ13件・7件のうちそれぞれ12件・3件が`data/shootoRecords.json`(修斗のみのデータ)に見つからなかったが、これは全件パンクラス側の試合(イベント名が"PANCRASE ###")であることを確認済みであり、想定どおりの結果(修斗データに無くて当然)。

## 検証メモ(突合ロジックの妥当性確認)

- 既知の一致するはずの試合を人力で3件、`data/shootoRecords.json`の生データと目視突合し、突合ロジックが正しく拾うことを確認した:
  1. `asahina-ken`(旭那拳) vs 黒部和沙 (2026-01-18, PROFESSIONAL SHOOTO 2026 Vol.1): 投入値`result:"loss", method:"判定 3-0"` → 生データ`resultType:"decisive", winnerName:"黒部 和沙", methodRaw:"判定 3-0"`。一致確認。
  2. `asahina-ken` vs 友利琉偉 (2025-09-21): 投入値`result:"win", method:"S", round:"R1 04:55"` → 生データ`resultType:"decisive", winnerName:"旭那 拳", methodRaw:"S", round:"1R", time:"04:55"`(round/time結合ロジック `"1R"+"04:55"` → `"R1 04:55"` が投入値と一致)。一致確認。
  3. `nakajima-riku`(中島陸) vs 青井心ニ (2024-12-29): 投入値`result:"loss"` → 生データは`resultType:"draw", methodRaw:"ドロー"`(投入値の"loss"は誤り、正しくは"draw")。背景に記載のドロー誤判定バグの実例を直接確認。
- method文字列の一次突合で142件の「差分」が検出されたが、うち130件は`"TKO/レフェリーストップ"`(投入データ側)と`"TKO レフェリーストップ"`(再集計データ側)のように、カテゴリコードと詳細の区切り文字がスラッシュか半角スペースかだけが異なる表記ゆれだった(2つ目以降の区切りは両者とも"/"のまま)。これを区切り文字ノイズとして除外し、内容そのものが異なる12件のみを実質差分として計上した(その12件は全て「投入データのmethodが空文字列、再集計では"ドロー"」というパターンで、ドロー誤判定バグに付随する情報欠落)。
- 逆方向チェック(名前一致するがhistoryに無い試合)で見つかった件数のうち、KAREN・SARAMI以外は`resultType`が`nc`/`unknown`/`cancelled`のもの(未解決試合、PR#252側で意図的に除外されたと推定されるもの)が大半だったが、`asahina-ken`のふじい☆ペリー戦(2018-11-25, 勝利)と`fujino-emi`の前澤智戦(2024-12-15, ドロー)の2件は`resultType:"decisive"`/`"draw"`の解決済み試合であり、単純な除外基準では説明できない純粋な欠落として個別に記録した。

## 差分ありの選手(差分件数の多い順)

### 杉本 恵 (`sugimoto-megumi`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **11-7-1**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **11-7-1**(参考: nc 1件, 未解決/中止等ambiguous 1件は勝敗集計に含めず)

**bout内容の差分(2件):**

- 2024-12-15 vs 高本千代
  - method: `` → `ドロー`
- 2020-11-23 vs SARAMI
  - event: `プロフェッショナル修斗公式戦` → `PROFESSIONAL SHOOTO 2020 Vol.7 Supported by ONE Championship`

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2020-03-29 vs 中村 未来 → resultType=unknown(outcome=ambiguous(unknown)), method="", event="【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが6件あったが内容は同一のため差分に含めていない)*

### 嶋屋 澪 (`mio-shiyama`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **2-5-1**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **2-4-2** **← 投入値と不一致**

**bout内容の差分(2件):**

- 2025-07-21 vs erika
  - result: `loss` → `draw`
  - method: `` → `ドロー`
- 2024-12-29 vs Fukky
  - method: `` → `ドロー`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが1件あったが内容は同一のため差分に含めていない)*

### 高本 千代 (`takamoto-chiyo`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **3-4-1**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **3-3-2** **← 投入値と不一致**

**bout内容の差分(2件):**

- 2025-09-21 vs 片山智絵
  - result: `loss` → `draw`
  - method: `` → `ドロー`
- 2024-12-15 vs 杉本恵
  - method: `` → `ドロー`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが1件あったが内容は同一のため差分に含めていない)*

### erika (`erika`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **3-1-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **2-1-1**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず) **← 投入値と不一致**

**bout内容の差分(1件):**

- 2025-07-21 vs 嶋屋澪
  - result: `win` → `draw`
  - method: `` → `ドロー`

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2026-03-29 vs 片山 智絵 → resultType=cancelled(outcome=ambiguous(cancelled)), method="不戦", event="PROFESSIONAL SHOOTO 2026 Vol.2"

### 片山 智絵 (`katayama-tomoe`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **3-1-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **2-1-1**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず) **← 投入値と不一致**

**bout内容の差分(1件):**

- 2025-09-21 vs 高本千代
  - result: `win` → `draw`
  - method: `` → `ドロー`

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2026-03-29 vs erika → resultType=cancelled(outcome=ambiguous(cancelled)), method="不戦", event="PROFESSIONAL SHOOTO 2026 Vol.2"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが1件あったが内容は同一のため差分に含めていない)*

### 高田 暖妃 (`takada-atsuhi`) — 差分 3件

- org=shooto
- 投入値(wins-losses-draws): **3-1-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **2-1-1**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず) **← 投入値と不一致**

**bout内容の差分(1件):**

- 2024-12-15 vs チョンチャヒョン
  - result: `win` → `draw`
  - method: `` → `ドロー`

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2023-08-20 vs 幸田 來弥 → resultType=unknown(outcome=ambiguous(unknown)), method="判定 -", event="広島大会「TORAO | colors」"

### 旭那 拳 (`asahina-ken`) — 差分 2件

- org=shooto
- 投入値(wins-losses-draws): **10-7-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **11-7-0** **← 投入値と不一致**

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2018-11-25 vs ふじい ☆ ペリー → resultType=decisive(outcome=win), method="S スリーパーホールド", event="THE SHOOTO OKINAWA vol.1"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが4件あったが内容は同一のため差分に含めていない)*

### ダイキ ライトイヤー (`lightyear-daiki`) — 差分 2件

- org=shooto
- 投入値(wins-losses-draws): **9-9-2**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **9-9-2**(参考: nc 1件, 未解決/中止等ambiguous 0件は勝敗集計に含めず)

**bout内容の差分(1件):**

- 2017-06-25 vs エダ塾長こうすけ
  - method: `` → `ドロー`

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2024-09-22 vs 川北 晏生 → resultType=nc(outcome=nc), method="ノーコンテスト", event="PROFESSIONAL SHOOTO 2024 Vol.7"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが8件あったが内容は同一のため差分に含めていない)*

### 中島 陸 (`nakajima-riku`) — 差分 2件

- org=shooto
- 投入値(wins-losses-draws): **8-1-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **8-0-1** **← 投入値と不一致**

**bout内容の差分(1件):**

- 2024-12-29 vs 青井心ニ
  - result: `loss` → `draw`
  - method: `` → `ドロー`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが7件あったが内容は同一のため差分に含めていない)*

### 結城 大樹 (`yuki-daiki`) — 差分 2件

- org=shooto
- 投入値(wins-losses-draws): **7-5-1**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **6-5-2** **← 投入値と不一致**

**bout内容の差分(1件):**

- 2021-07-25 vs 仲山貴志
  - result: `win` → `draw`
  - method: `` → `ドロー`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが1件あったが内容は同一のため差分に含めていない)*

### 藤野 恵実 (`fujino-emi`) — 差分 2件

- org=shooto
- 投入値(wins-losses-draws): **6-0-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **6-0-1** **← 投入値と不一致**

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2024-12-15 vs 前澤 智 → resultType=draw(outcome=draw), method="ドロー", event="COLORS Produce by SHOOTO Vol.4"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが3件あったが内容は同一のため差分に含めていない)*

### 川北 晏生 (`kawakita-haruki`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **6-1-3**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **6-1-3**(参考: nc 1件, 未解決/中止等ambiguous 0件は勝敗集計に含めず)

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2024-09-22 vs ダイキ ライトイヤー → resultType=nc(outcome=nc), method="ノーコンテスト", event="PROFESSIONAL SHOOTO 2024 Vol.7"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが2件あったが内容は同一のため差分に含めていない)*

### チョウ スソン (`susung`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **4-2-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **4-2-0**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず)

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2020-09-19 vs 新井 拓巳 → resultType=unknown(outcome=ambiguous(unknown)), method="", event="PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship 第2部"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが1件あったが内容は同一のため差分に含めていない)*

### 磯城嶋 一真 (`shikijima-kazuma`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **6-1-2**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **6-1-2**

**bout内容の差分(1件):**

- 2024-11-17 vs 工藤圭一郎
  - method: `` → `ドロー`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが2件あったが内容は同一のため差分に含めていない)*

### 岩﨑 大河 (`iwasaki-taiga`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **7-1-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **7-1-0**

**bout内容の差分(1件):**

- 2021-11-06 vs 清水洸志
  - round: `` → `03:13`

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが5件あったが内容は同一のため差分に含めていない)*

### 中村 未来 (`nakamura-miku`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **9-6-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **9-6-0**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず)

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2020-03-29 vs 杉本 恵 → resultType=unknown(outcome=ambiguous(unknown)), method="", event="【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが5件あったが内容は同一のため差分に含めていない)*

### 黒部 三奈 (`kurobe-mina`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **6-4-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **6-4-0**(参考: nc 1件, 未解決/中止等ambiguous 1件は勝敗集計に含めず)

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2020-03-29 vs 大島 沙緒里 → resultType=unknown(outcome=ambiguous(unknown)), method="", event="【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが3件あったが内容は同一のため差分に含めていない)*

### SARAMI (`sarami`) — 差分 1件

- org=pancrase, orgs=["shooto","pancrase"]
- 投入値(wins-losses-draws): **6-1-0**
- 再集計値: 複数団体のため集計比較対象外

**bout内容の差分(1件):**

- 2020-11-23 vs 杉本恵
  - event: `プロフェッショナル修斗公式戦` → `PROFESSIONAL SHOOTO 2020 Vol.7 Supported by ONE Championship`

**投入データにはあるが再集計データ(修斗)に見つからない試合(3件): 参考情報。イベント名が全てPANCRASE表記のためパンクラス側の試合と推定。集計・順位付けの差分スコアには含めていない。**

- 2024-09-29 vs ホン・イェリン (win, 判定/3-0, PANCRASE 347)
- 2024-03-31 vs 沙弥子 (win, TKO/グラウンドのパンチ, PANCRASE 341)
- 2023-12-24 vs ジェニー・ファン (win, 判定/0-3, PANCRASE 340)

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが2件あったが内容は同一のため差分に含めていない)*

### ソルト (`salt`) — 差分 1件

- org=shooto
- 投入値(wins-losses-draws): **2-4-0**
- 再集計値(data/shootoRecords.jsonのみ、修斗分): **2-4-0**(参考: nc 0件, 未解決/中止等ambiguous 1件は勝敗集計に含めず)

**再集計では見つかるが投入データ(history)には無い試合(1件):**

- 2022-03-21 vs 須恵 樹季 → resultType=cancelled(outcome=ambiguous(cancelled)), method="", event="PROFESSIONAL SHOOTO 2022 Vol.2"

*(参考: 上記とは別に、method区切り文字のみの表記ゆれが2件あったが内容は同一のため差分に含めていない)*

## 差分なしの選手(一覧)

計40名。history全件が日付・対戦相手・結果・方法・ラウンド・大会名まで再集計データと一致し、集計値(wins/losses/draws)も一致、逆方向チェックでの欠落も無かった。

`taguchi-keita`(田口 恵大)、`tomori-rui`(友利 琉偉)、`tomori-kota`(友利 幸汰)、`umeki-yutoku`(梅木 勇徳)、`sugimoto-seiya`(杉本 静弥)、`unconfirmed-shooto-1875`(砂辺 光久)、`baikin-dokuichiro`(梅筋 毒一郎)、`yamauchi-wataru`(山内 渉)、`okada-arashi`(岡田 嵐士)、`nakaike-takehiro`(中池 武寛)、`suzuki-takeru`(鈴木 尊)、`fujii-nobuki`(藤井 伸樹)、`nojiri-yasuyuki`(野尻 定由)、`park-jongjun`(パク ジョンジュン)、`saito-tsubasa`(齋藤 翼)、`uehara-taira`(上原 平)、`iino-yuto`(飯野 雄斗)、`dinesh-nain`(ネイン デイネッシュ)、`azumi-kento`(安海 健人)、`body-maxthe`(マックス・ザ・ボディ)、`tyson-nobumitsu`(大尊 伸光)、`tanaka-yu`(田中 有)、`valenzuela-victor`(ヴィクター バレンズエラ)、`tamura-hibiki`(田村 ヒビキ)、`waki-grappler`(グラップラー脇)、`yuji-arai`(荒井 勇ニ)、`unconfirmed-shooto-1849`(沙門)、`henry`(HENRY)、`young-kim`(キム ジェヨン)、`aono-hikaru`(青野 ひかる)、`noa-tokumoto`(徳本 望愛)、`hirata-ayane`(平田 彩音)、`young-parkseo`(パク ソヨン)、`huang-jenny`(ジェニー ファン)、`watanabe-ayaka`(渡辺 彩華)、`aya-murakami`(村上 彩)、`hoshuyama-momoka`(宝珠山 桃花)、`park-bohyun`(パク ボヒョン)、`hailaiwusamo`(ハイライ ウーシャアモー)、`karen`(KAREN)


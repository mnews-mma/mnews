# 指示書③: infobox と表本体の不整合13名 一次ソース照合レポート

- 調査日: 2026-08-03
- 対象: `data/fighterRecords.json` の集計値(Wikipedia infobox由来、`checkFighterRecordIntegrity`の`stored`)と
  `history`再集計(Wikipedia戦績表=表本体)が食い違う13名(2026-08-03実測時点)
- 着手前確認: `gh pr list --state open`・`git worktree list`で13名/`recordOverrides.ts`/`fighterRecords.json`を
  対象とする既存PR・worktreeが無いことを確認済み(パトリッキー・ピットブルのみ`patricky-pitbull-rizin-gap`worktreeが
  存在したが、調べた結果RIZIN公式データ側の名前解決問題で今回の論点とは別レイヤーと判明)
- 本レポート・作業はすべて`out/`配下のみで完結。実データ変更は確定4名のみ`src/lib/mnewsRating/recordOverrides.ts`
  + `data/fighterRecords.json`/`fighterRecordsMeta.json`に反映

## サマリー

| 選手 | 判定 | 対応 |
|---|---|---|
| sato-shoko | 既知(タスク指示で確認済み) | 対応不要(2026-08-11 RIZIN.54の未消化1戦をinfoboxが先取り) |
| nakamura-daisuke | **確定** | recordOverrides.tsにadd追加済み |
| strasser-kiichi | **確定** | recordOverrides.tsにadd追加済み(2件) |
| kurobe-kazusa | **確定** | recordOverrides.tsにadd追加済み |
| patricky-pitbull | **確定** | recordOverrides.tsにremove追加済み |
| uno-caol | 確定(原因特定)だが現行機構では対応不可 | 未反映・下記「構造的ギャップ」参照 |
| sugiyama | 確定(原因特定)だが現行機構では対応不可 | 未反映・同上 |
| uoi-fullswing | 確定(historyが正)だが該当bout特定不可 | 未反映・同上 |
| miyake-kisa | 確定(historyが正)だが該当bout特定不可 | 未反映・同上 |
| ohara-juri | 未確定(強い候補、二次情報のみ) | 未反映 |
| lee-kaiwen | 未確定(強い候補、二次情報のみ) | 未反映 |
| tokoro-hideo | 未確定(8試合中0件を一次情報で確定) | 未反映 |

## 1. sato-shoko(佐藤 将光)— 既知・対応不要

タスク指示で既に確認済み: infobox wins=38、表本体は確定37勝+未消化1戦(2026-08-11 RIZIN.54)。
infoboxが未開催の試合を先取りカウントしている状態で、試合が終われば自然解消する。データ訂正は不要、監視のみ。

## 2. 確定・recordOverrides.tsに反映した4名

### nakamura-daisuke(中村大介)— DEEP

- **差分bout**: 2026-05-04 DEEP 131 IMPACT 25th Anniversary 第7試合、vs 狩野優、判定0-3で敗北
- **根拠**: DEEP公式サイト https://www.deep2001.com/deep-131-impact/ (第7試合、●中村大介 vs ○狩野優、判定0-3)。
  `data/deepRecords.json`の当該boutとも完全一致
- **原因**: Wikipedia戦績表にこの1敗だけ記載が丸ごと欠落(インフォボックスの通算成績35-29-1は既にこの敗戦を
  反映済み)
- **対応**: `RECORD_OVERRIDES`にadd型(`totalsAlreadyReflected: true`)を追加。`data/fighterRecords.json`を
  `--slug=nakamura-daisuke`で再生成し反映済み(35-29-1、historyCount 64→65)

### strasser-kiichi(ストラッサー起一)— DEEP/PANCRASE

- **差分bout**: 2006-03-19 PANCRASE 2006 BLOW TOUR(vs 鳥生将大、KO負け)、2006-10-01 PANCRASE 2006 BLOW TOUR
  (vs 青山晃剛、ギブアップ勝ち)
- **根拠**: PANCRASE公式サイト https://www.pancrase.co.jp/data/result/2006/0319.html 、
  https://www.pancrase.co.jp/data/result/2006/1001.html (いずれも改名前の本名「国本起一」名義で確認)
- **原因**: 2007年9月30日にリングネームを本名「国本起一」から「ストラッサー起一」へ改名した経緯があり、
  Wikipedia戦績表は改名後の試合しか収録せず本名時代の2006年2試合が丸ごと欠落
- **対応**: add型2件(いずれも`totalsAlreadyReflected: true`)を追加。再生成済み(21-13-2、historyCount 34→37、
  NC1件込み)

### kurobe-kazusa(黒部和沙)— 修斗

- **差分bout**: 2024-04-07 SHOOTO GIG TOKYO Vol.36 メインイベント第9試合、vs 澤田龍人、1R3:38ネックストレッチで勝利
- **根拠**: 修斗公式サイト https://www.shooto-mma.com/result/?id=181 。`data/shootoRecords.json`の当該boutとも
  完全一致
- **原因**: Wikipedia戦績表の日付表記が「2024年4月**7月**」という単純なタイポ(「日」であるべき箇所)になっており、
  mnewsの日付パーサ`parseJaDate()`(`src/lib/feeds/wikipedia.ts`)が日付を抽出できず、`parseJaFightHistory()`が
  この1行を無音でスキップしていた(コード側のバグではなくWikipedia本文のタイポが引き金)
- **対応**: add型(`totalsAlreadyReflected: true`)を追加。再生成済み(6-1-1、historyCount 7→8)

### patricky-pitbull(パトリッキー・ピットブル)— RIZIN

- **差分bout**: 2025-05-31 ADXC 10、vs アルマン・ツァルキヤン、5Rリアネイキドチョークで敗北 → **除外対象**
- **根拠**: Wikipedia記事「パトリッキー・ピットブル」本文の`=== グラップリング ===`節(MMA戦績表`{{MMA
  recordbox}}`とは別枠)に記載された、サブミッションのみのグラップリング興行(ADXC)。MMA戦績ではない
- **原因**: `src/lib/feeds/wikipedia.ts`の`extractMmaSection()`がこの記事の見出し(「総合格闘技」という文言を
  含まない)にマッチせず記事全文へフォールバックした結果、グラップリング節の1行がMMA historyに混入した
  (既存の`kate-lotus`エキシビション混入除外と同型のバグ)
- **対応**: remove型を追加。再生成済み(25-16-0、historyCount 42→41)
- **既存調査との関係**: `investigate/patricky-pitbull-rizin-gap`(指示書O、PR未作成・2026-07-31完了)は
  `data/rizinRecords.json`側の名前解決失敗(RIZIN.19/20の3bout)を扱ったもので、今回のWikipedia記事内
  グラップリング混入とは別レイヤーの問題。なお同調査時点でnullだったRIZIN.19/20の該当3boutは、本調査時点では
  既に`patricky-pitbull`へ解決済みだったことも確認した(別途の修正が入った模様、本タスクのスコープ外)

## 3. 確定(原因特定済み)だが現行override機構では対応不可な4名

`recordOverrides.ts`のoverride機構は**bout単位**(add/remove/patch-*)でのみ動作する設計(集計値=`stored`だけの
直接上書きは不可)。以下4名は「historyが正しく、infobox側の集計が古い/誤り」と一次情報で確定できたが、
訂正すべき**特定のbout自体が存在しない**(historyに欠落も混入もない、集計値そのものがズレているだけ)ため、
現行の機構では表現できない。**本PRでは実装しない**が、恒久対応には集計値を直接指定する新しい override型
(例: `patch-totals`)の追加が必要になる。

### uno-caol(宇野薫)— 修斗: 原因bout特定済み

- **確定内容**: 2023-12-04の編集でWikipedia戦績表に「2023-11-19 vs オーディン(高木オーディン祥多)、
  PROFESSIONAL SHOOTO 2023 Vol.7、2R KO負け」が追加されたが、インフォボックスの集計は同時に更新されず、
  以後2年以上ズレが持ち越されている(版間差分`https://ja.wikipedia.org/w/index.php?diff=98329030`で確認)
- **根拠**: Wikipedia版間差分 + `data/shootoRecords.json`(同一boutが実在、修斗公式アーカイブ由来)
- **structural gap**: 該当boutは既に`history`に存在する(欠落していない)ため、`add`型は使えない
  (`add`は「historyに無いboutを足す」機構)。必要なのは「集計値をhistory再集計の35-24-5に合わせる」ことだが、
  対応するoverride型がない

### sugiyama(杉山しずか)— パンクラス: 原因bout特定済み

- **確定内容**: 2026-03-14の編集(revid 108754787)でWikipedia戦績表に「2026-03-14 vs 和田綾音、PANCRASE 361、
  判定3-0勝ち」が追加されたが、インフォボックスの集計は同時に更新されず現在までズレが継続
- **根拠**: Wikipedia版間差分(`https://ja.wikipedia.org/w/index.php?diff=108754787&oldid=107810882`) +
  `data/pancraseRecords.json`(同一boutが実在)
- **structural gap**: uno-caolと同型(bout自体はhistoryに存在、集計値だけがズレ)

### uoi-fullswing(魚井フルスイング)— DEEP: 原因bout特定不可

- **確定内容**: infobox(27-16-4)とhistory(26-17-4)の差(判定負け13→12、sub勝ち1→2相当のズレ)について、
  history側の47試合のうち独立ソースで裏取りできた14件超は全てhistory記載どおりで矛盾なし。具体的にどの1試合が
  infoboxのズレの原因かは特定できなかった(未確認3試合=地方/古い興行のみ残るが、method欄に矛盾がなくいずれも
  怪しくない)
- **判定**: historyの26-17-4が正しいとみてよいが、bout単位での訂正対象が無いため現行機構では対応不可

### miyake-kisa(三宅輝砂)— パンクラス: 原因bout特定不可

- **確定内容**: 19試合全てをパンクラス公式記録/報道記事で個別に裏取りしたが、全試合ともhistory記載(13-6-0)の
  通りで矛盾なし。infobox(14-5-0)のdecision内訳(5勝4敗 vs 実際4勝5敗)だけが記事内で自己矛盾しており、
  対応する具体的なboutは存在しない
- **判定**: historyの13-6-0が正しいとみてよいが、同上の理由で対応不可

## 4. 未確定のまま残す3名(推測で埋めない)

### ohara-juri(大原樹理)— DEEP

- infobox(38-21-2)とhistory(39-20-2)は総試合数61戦で一致、判定勝ち/判定負けの内訳のみ1件分逆転
- 有力候補: 2013-05-18 DEEP TOKYO IMPACT 2013【ライト級GP二回戦】vs 福本よう一(history上は判定2-1勝ちだが、
  FightMatrix(`https://www.fightmatrix.com/fighter-profile/Juri+Ohara/56579/`)は判定負けと記載)
- **未確定と判断した理由**: FightMatrixは二次情報(第三者データベース)であり、DEEP公式サイトの2013年アーカイブ
  (旧カレンダーシステム)には404で到達できず、当時の一次報道も見つからなかった。一次情報での裏取りができるまで
  `patch-result`は追加しない

### lee-kaiwen(リー・カイウェン)— RIZIN

- infobox(16-8-0)がhistory(15-8-0)より1勝多い(1試合欠落)
- 有力候補: 2025-12-21 Dragon FC「Longsan Fight: Day 2」ライト級タイトルマッチ、vs Tatsuya Tomozane、
  1R3:47 TKO勝ち。infoboxの決着内訳(KOwins=9)ともhistory側の実測(KOwins=8+この1件=9)が完全一致し、
  日程の空白(2025-08-22〜2026-05-10)ともちょうど符合する
- **未確定と判断した理由**: 出典がSherdog/Tapology/FightMatrix(いずれも二次情報)のみで、Dragon FC(中国国内
  団体)自体の公式記録ページには到達できなかった。内部整合性(内訳の一致)は非常に強い状況証拠だが、
  指示書の基準(一次情報必須)を満たさないため追加しない

### tokoro-hideo(所英男)— RIZIN(他多数団体を歴戦)

- infobox(36-34-1、計71戦)とhistory(33-29-1、計63戦)の差が8試合分と本調査対象で最大
- DREAM/HERO'S/K-1/ZST/Shooto Lithuania/Bellator等、非常に多くの団体を渡り歴戦したベテランのため、
  RIZIN以外の一次情報にほぼ到達できなかった
- 唯一の候補(2001-09-21 リングスBATTLE GENESIS Vol.8、vs 小谷直之、判定負け)も出典はWikipedia系列の
  周辺記事のみで一次情報(RINGS公式)ではない
- 追加の注記: 検索過程でinfoboxの71戦という数字自体、情報源によって「36-33-2」という異なる値も見つかり、
  **infobox側の総数自体の信頼性にも疑義がある**。8試合全てを埋めようとするより、historyの積み上げ(試合単位で
  検証可能)を優先すべきという結論
- 8試合中0件を一次情報で確定できたのみで、本件は未確定のまま残す

## 5. スクレイパー側の整合チェック導入について(可否・方式のみ、実装はしない)

今回の13件の内訳から、実装すれば有効と考えられる自動チェックが最低2種類特定できた:

1. **パース時の行ドロップ検知**: `kurobe-kazusa`のケースのように、`parseJaFightHistory()`
   (`src/lib/feeds/wikipedia.ts`)が日付未取得等の理由で`{{Fight-cont}}`行を無音でスキップした場合、
   スキップした行数をログに出し、`parseJaRecordTotals()`(infobox集計)の総試合数と実際に採用した行数が
   食い違う場合は警告を出す、という方式が有効。今回のケースは全て「行がパースできず消えた」ことが原因の
   一部を占めており、機械的に検知可能
2. **非MMA節混入検知**: `patricky-pitbull`のケースのように、`extractMmaSection()`が見出しマッチに失敗して
   記事全文にフォールバックした場合、その旨をログに残し、既存の`stripAmateurSections()`と同様の
   `stripGrapplingSections()`(「グラップリング」「柔術」等の見出しを除去)を追加適用する方式が有効
3. 上記2つとは別に、`uno-caol`/`sugiyama`のような「infoboxの集計だけがWikipedia側編集時に更新漏れした」
   ケースは、mnews側のパース処理では検知できても自動修正はできない(Wikipedia側の編集ミスのため)。
   `checkFighterRecordIntegrity`の既存warning機構(非破綻の不一致として保留リストに残す)がまさにこの
   ケース向けの設計であり、現状の運用で十分と考える

いずれも今回のPRでは実装しない(指示書の指定どおり)。実装するなら1・2はscripts/update-fighter-records.ts
または`src/lib/feeds/wikipedia.ts`側への追加、3は現行のfighterRecordIntegrity.tsの運用継続が妥当。

## 6. 波及確認: rankings.jsonへの影響

確定・反映した4名(nakamura-daisuke, strasser-kiichi, kurobe-kazusa, patricky-pitbull)について、`data/rankings.json`
への影響を実際にこのworktree内で検証した。

- nakamura-daisuke(DEEP)・strasser-kiichi(DEEP/PANCRASE)・kurobe-kazusa(修斗)は、いずれもRIZIN以外の団体の
  ため`data/rankings.json`(RIZINランキング)に元々未掲載。**影響なし**
- patricky-pitbull(RIZIN)は`lightweight`(ライト級)ランキングに掲載あり(rank 5)。`--slug`再取得で
  `data/fighterRecords.json`を更新後、`scripts/update-mnews-rating.ts`を実行して`data/rankings.json`を
  再生成し、修正前後を比較した:
  - rank・rating・record(3-2-0)とも**完全に一致、変化なし**
  - 理由: mnewsレーティングのランキング表示record・Eloは`computeMultiOrgRecord`
    (`src/lib/mnewsRating/multiOrgRecord.ts`)経由でRIZIN/DEEP/修斗/パンクラスの4公式アーカイブのみから
    再集計されており(ファイル冒頭コメントに明記)、Wikipedia由来の`fighterRecords.json`の`history`は
    参照しない。除去したADXC(グラップリング)の1件も4アーカイブいずれにも存在しない試合のため、
    そもそもElo計算の対象外だった
  - 検証後、`data/rankings.json`・`data/rankings.prev.json`・`data/rankings.legitimateBaseline.json`は
    元の内容に戻し(再計算スクリプトの実行が`delta`表示等の無関係な差分を生んだため)、コミットには含めていない

**結論: 4名とも1行目(`data/fighterRecords.json`のwins/losses/draws)は変わるが、rankings.jsonへの波及は0件。**
なお4選手全員が`fighters.ts`で`recordFromResults: true`のため、`/fighters/[slug]`ページの表示自体も
`computeMultiOrgRecord`由来(4団体公式アーカイブ直接集計)であり、今回の`fighterRecords.json`修正は表示にも
影響しない。今回の修正の実質的な効果は、`checkFighterRecordIntegrity`(ビルド時整合チェック)の保留リストを
13件→9件に減らすことに限定される(建前上のWikipediaミラーデータの正確性を上げる意味はある)。

## 実行時コスト

`out/`配下のみ(このレポート)。`data/fighterRecords.json`・`data/fighterRecordsMeta.json`は確定4名分のみ
`--slug`再取得で更新(全選手の一括再スクレイプは行っていない)。

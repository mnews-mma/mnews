# C型288件の規模測定・全件分類・確定分の修正

## スコープ

[#349](https://github.com/mnews-mma/mnews/pull/349)(指示書R-5、A/B/C型悉皆調査)・
[#353](https://github.com/mnews-mma/mnews/pull/353)(A型2件+C型13件の訂正)・前回セッションの
続き。前回セッションでは20件のサンプル検証までだったが、今回は**残件113件全件**を
機械的に4分類し、日付誤りとして確定できた5件のみ`recordOverrides.ts`で修正した。

## 前提・出典

`out/fighter-records-abc-audit.py`(#349の調査スクリプト)をmain最新時点に対して
再実行し、C型の対戦相手名クロス突合(`out/c-type-scale-measurement.py`)を適用した
結果、対象(DEEP+PANCRASE+RIZIN、修斗除く)144件のうち31件を誤検知として除外、
残件**113件**を得た(前回セッションの内容そのまま)。

### 母数の実測値が288件と一致しないことについて(前回セッションからの引用)

C型総数は再実行時点で**314件**(#349時点の327件から#353で13件訂正後、#350等の
後続変更を経て変動)。288件は#353本文中の一時点のスナップショット値で、その後の
mainの変更を反映していない。指示書の「C型288件」は対象スコープを指す名称として
扱い、実際の分母は再実行時点の実測値(残件113件)を正とした。

## a) 残件113件の全件分類

前回の20件サンプルでは「どのトラックが本丸かを決められない」との指摘を受け、
今回は113件全件を機械的ルールで4分類した(`out/c-type-residual-full-classification.py`)。

### 分類ロジック

1. **団体誤判定**: 大会名に`road to`/`qualifier`等のキーワードを含むか、個別に
   確認済みのケースを列挙。
2. **日付誤り(確定)**: 大会の通し番号(`DEEP NN IMPACT`・`DEEP JEWELS NN`・
   `RIZIN.N`等、時代を通して一意な番号のみ対象。年ごとに使い回される
   `Nth ROUND`系は対象外)が団体データ側に実在し、かつ**DEEP公式サイト
   (deep2001.com)の大会ページでbout単位(対戦相手・決着方法)まで個別確認できた
   もの**。番号だけ一致してbout単位で確認できなかったものは「未解決」に分類する
   (詳細は後述)。
3. **構造的カバレッジ不足**: 該当ブランド(大会シリーズ)の団体データ収録が
   始まる最古の日付より前、またはそのブランドが団体データに1件も存在しない。
4. **未解決**: 上記いずれにも該当しない残り。

### 結果(確定値)

| 分類 | 件数 | 団体別内訳 |
|---|---|---|
| 団体誤判定 | 1件 | PANCRASE 1 |
| 日付誤り(確定・修正済み) | 5件 | DEEP 5 |
| 構造的カバレッジ不足 | 71件 | DEEP 65・RIZIN 6 |
| 未解決 | 36件 | DEEP 36 |
| **合計** | **113件** | |

## b) 日付誤り群の修正(5件、確定分のみ)

機械的な番号一致検出では7件が候補に挙がったが、**DEEP公式サイトの大会ページで
bout単位(対戦相手名・決着方法)まで個別確認できたのは5件のみ**。残り2件
(神龍誠×中山ハルキ、酒井リョウ×水口清吾。いずれも「DEEP 86 IMPACT」グループ)は、
大会自体は2022-10-27に実在するものの、DEEP公式サイトの当該大会結果ページに
claim通りのboutが見当たらなかった(酒井リョウは同日に別カード「vs誠吾」が実在するが
「水口清吾」と同一人物か確認できず)ため、確定させず「未解決」に残した。#353の
基準(大会の実在だけでなくbout単位の確認を必須とする)をそのまま踏襲している。

`src/lib/mnewsRating/recordOverrides.ts`に`patch-date`(4件)・`patch-date`+
`patch-method`(goto-joji、1件)を追加し、`npx tsx scripts/update-fighter-records.ts
--slug=<fighterId>`で対象5選手のdata/fighterRecords.jsonを再生成した。

| 選手 | 誤(1行目) | 正 | 出典 |
|---|---|---|---|
| motoya-yuki | DEEP 86 IMPACT / 2018-10-27 | 2022-10-27(大会名は誤りなし) | https://www.deep2001.com/deep-86-impact/ |
| takeda-koji | DEEP 86 IMPACT / 2018-10-27 | 2022-10-27 | 同上 |
| kitaoka-satoru | DEEP 86 IMPACT / 2018-10-27 | 2022-10-27 | 同上 |
| koya-kanda | DEEP 99 IMPACT / 2020-11-02 | 2020-11-01 | https://www.deep2001.com/deep-99-impact/ |
| goto-joji | DEEP 122 IMPACT / 2024-12-08 | **DEEP TOKYO IMPACT 2024 5th ROUND / 2024-11-23** | https://www.deep2001.com/deep-122-impact/ 、https://www.deep2001.com/deep-tokyo-impact-2024-5th-round/ |

### goto-joji(DEEP122 IMPACT)について: #353の結論を覆す新事実

指示書の指定どおりサンプルに含めた案件。**#353では「団体データ側の欠落の可能性」
として未解決のまま残されていたが、今回DEEP公式サイトを個別に確認したところ、
大会名・日付の両方がWikipedia側の誤りだったことが判明した。**
DEEP 122 IMPACT自体は2024-11-04に後楽園ホールで開催されており、後藤丈治×
マンド・グティエレス戦は「マンド・グディエレスがVISAの関係で11/4のDEEP 122
IMPACTに間に合わないため11/23のDEEP TOKYO IMPACT 2024 5th ROUNDに延期」と
DEEP公式サイトに明記されている。data/deepRecords.jsonの当該大会(2024-11-23)にも
このboutが実在し(fighterASlug: goto-joji、判定1-2でマンド・グディエレス勝利)、
Wikipedia戦績表の決着方法(5分3R終了 判定1-2)と完全一致する。

これは「DEEP 122 IMPACT」という番号自体は実在するが(機械的な番号一致検出は
2024-11-04の本来のDEEP122 IMPACTを見つけていた)、**claimされたbout自体は延期で
別大会に移っていた**という、番号一致だけでは救えないパターン。この経験を踏まえ、
今回の分類では「番号一致候補はあるがbout単位で確認できなかったもの」を安易に
「日付誤り確定」に含めず、個別にDEEP公式サイトで裏取りしている。

## c) 団体誤判定: gustavo-luis以外に同型ケースが無いことの確認

`Imortal FC 5 - Road to Pancrase`(gustavo-luis、2016-07-23)は、パンクラス本体が
主催していないブラジルの提携プロモーションの予選大会で、大会名に"Pancrase"を
含むだけで誤ってPANCRASEと判定されていた(調査スクリプム自身のorg推定ロジックの
誤検知であり、`data/pancraseRecords.json`自体にこのboutは含まれていない=
本番の4団体通算計算には影響していない)。

同型のケースが他に無いかを確認するため、113件全件をキーワード
(`road to`/`qualifier`/`contender`/`featuring`/`予選`等)でスキャンし、
加えて目視で「大会名に複数団体名が混在する」行(DEEP以外の団体名・海外の
プロモーション名を含むもの)を洗い出した。ヒットした3パターン(Black Combat
・MGL-1・PANCRASE vs DEEP大阪大会、計10行)をWeb検索で個別確認したところ、
いずれもgustavo-luisのケースとは性質が異なり、**DEEP(または両団体)が
正式に選手を選抜・派遣した公式の対抗戦・共催大会**であることが確認できた:

| 大会名 | 確認結果 |
|---|---|
| Black Combat 5: Song of the Sword(2023-02-04、韓国) | DEEPが選抜した5選手(現王者2名含む)を派遣した公式対抗戦(DEEP 2勝3敗)。ゴング格闘技等で詳報あり |
| MGL-1 Fighting Championship - MGL-1 vs. Deep(2016-09-24、モンゴル) | DEEPとの共催(co-promoted by DEEP)と明記(Tapology) |
| PANCRASE vs DEEP 大阪大会(2017-12-24等) | パンクラス大阪とDEEP事務局の共催と両団体公式サイトに明記 |

これらはgustavo-luisと違い「団体側が実際に関与した本物のDEEP/PANCRASE関連試合」
であり、団体誤判定ではなく構造的カバレッジ不足(deepRecords.jsonのスクレイパーが
deep2001.com自体のページしか対象にしておらず、海外開催・提携大会の結果ページを
収録していない)に分類している。**結論: 団体誤判定はgustavo-luis 1件のみで
確定。修正は行っていない**(誤りの所在は本調査スクリプト側のorg推定ロジックで
あり、production側の4団体通算計算(`computeMultiOrgRecord`)は
`data/pancraseRecords.json`を直接読むため、そもそもこのboutを含んでおらず
実害は無い)。

## d) 構造的カバレッジ不足(71件)・未解決(36件): 集計のみ、修正なし

指示書の指定どおり、この2分類(合計107件)は件数を確定するだけで修正しない。

- **構造的カバレッジ不足71件**: DEEP65件(2002〜2013年の疎な収録年代、および
  CAGE/TOKYO/NAGOYA/OSAKA/HAMAMATSU等の地域ブランドが2013年以前に未収録)、
  RIZIN6件(全て2015年12月のRIZIN旗揚げ戦=さいたま3DAYS。rizinRecords.jsonは
  RIZIN.1=2016-04-17から収録開始のため構造的に対象外、Web検索で実在確認済み)。
- **未解決36件**: DEEP36件。goto-jojiと同型の「番号一致はあるがbout単位で
  確認できなかった」2件を含む。個別の一次資料確認が必要。

## まとめ

- 残件113件を機械的に全件分類: 団体誤判定1・日付誤り(確定・修正済み)5・
  構造的カバレッジ不足71・未解決36。
- 日付誤り5件を`recordOverrides.ts`で修正し、`data/fighterRecords.json`の
  対象5選手のみ更新(他352選手は無変化を確認)。
- goto-jojiは#353の「未解決」という結論を覆し、大会名・日付ともに誤りと判明
  (延期の事実をDEEP公式サイトで確認)。
- gustavo-luis以外に団体誤判定の同型ケースは無いことを確認(Black Combat・
  MGL-1・PANCRASE共催大会は正式なDEEP関連試合であり誤判定ではない)。
- 構造的カバレッジ不足・未解決の計107件は集計のみで修正していない。

### ⚠️ rankings.jsonへの実害(要判断)

`npx tsx scripts/update-mnews-rating.ts`を実行して検証したところ、**#353とは異なり
実質的な差分が生じた**(単なる浮動小数点の丸め誤差ではない)。takeda-kojiの
DEEP86 IMPACT戦を2018-10-27→2022-10-27に訂正した結果、Eloの時系列処理が変わり
featherweight 8位/9位で**takeda-koji↔takagi-ryo の順位が入れ替わる**
(takeda-kojiのrawRating: 1518.17→1514.71、表示rating: 1520→1510)。日付訂正
自体は正しい(実際の試合は2022年)ため、この順位変動はデータをより正確にした
結果でありバグではないが、無視できない実害のため報告する。

`data/rankings.json`等の生成物は#353の前例(rankings.jsonへの実質差分が無かった
ため未コミット)に倣い、**本PRにはコミットしていない**(ローカルで生成した後
`git checkout`で復元済み)。マージ後の夜間バッチ(`update-fighter-records.yml`、
JST2:30目安)で自動的に反映される想定。この順位変動を許容してマージするか、
別途確認してから進めるかはご判断ください。

## 出力ファイル

- `out/c-type-residual-full-classification.py` — 残件113件の全件分類スクリプト
  (標準ライブラリのみ、`out/c-type-scale-measurement.py`の実行後に実行する)
- `out/c-type-residual-{org-misattribution,date-error,structural-gap,unresolved}.csv`
  — 分類後の4ファイル
- `src/lib/mnewsRating/recordOverrides.ts` — 日付誤り5件分の`patch-date`/
  `patch-method`オーバーライドを追加
- `data/fighterRecords.json`・`data/fighterRecordsMeta.json` — 対象5選手のみ更新
- (前回セッション分)`out/c-type-scale-measurement.py`・
  `out/c-type-scale-measurement-{resolved,residual}.csv`・
  `out/c-type-scale-measurement-sample.json`・
  `out/fighter-records-abc-audit-*`

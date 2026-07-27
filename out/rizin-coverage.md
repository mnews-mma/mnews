# RIZIN 収録期間の実測(読み取り専用調査)

調査日: 2026-07-27 / 対象: `data/rizinRecords.json`(80件) vs RIZIN公式サイト「大会情報」タグ一覧(https://jp.rizinff.com/_tags/大会情報 )

## 結論(先出し)

**RIZINの「収録開始年」として言える最古の年は 2016年。2015年は完全に未収録。**

- 公式サイトの「大会情報」タグには2015年12月に開催された2大会(SARABAの宴・IZAの舞)が存在し、いずれも試合結果一覧ページ(実データ)を持つ正規のRIZIN興行だが、`data/rizinRecords.json`・`rizinEventIndex.ts`・`rizinRecordOverrides.ts`のいずれにも一切収録されていない。
- 2016年はRIZIN.1〜.4の4大会が全て「大会エントリとして」収録されている(RIZIN.1は個別override、.2〜.4はindex経由)。ただしRIZIN.2は取得はされているが`parseFailures`により試合データが0件(空データ)という別種の品質問題を抱えている(後述、収録"漏れ"とは区別)。
- 欠落大会は2件(2015年の2大会のみ)で、停止条件の「10件超」には該当しない。

## 1. 手順1: ローカルデータの大会一覧(`data/rizinRecords.json`)

- 配列構造・80要素、1要素=1大会(`eventName`/`date`/`sourceUrl`/`fetchedDate`/`bouts[]`/`parseFailures`)。**大会単位の一覧作成は問題なく可能**(停止条件「配列構造上作れない」は非該当)。
- 収録範囲: 2016-04-17(TOP Presents RIZIN.1)〜2026-07-18(abc presents RIZIN LANDMARK 15 in HIROSHIMA)。
- `fetchedDate`は`2026-07-13`/`2026-07-18`/`2026-07-19`の3値のみ。
- `bouts.length === 0`(=parseFailuresのみで実データなし)の大会が4件: RIZIN.2(2016-09-25)/RIZIN.5(2017-04-16)/RIZIN.10(2018-05-06)/RIZIN.21(2020-02-22)。いずれも`sourceUrl`は取得試行済みだがパースに全敗している。**これは「未収録」ではなく取得ロジックの品質問題**(スコープ外だが記録として残す)。

## 2. 手順2: 公式サイト「大会情報」タグとの突合

`https://jp.rizinff.com/_tags/大会情報` をWebFetchで取得。1ページ目の時点で2015-12-29(SARABAの宴)まで遡って全86件が表示され、追加ページ(`?p=2`)を確認しても新規大会名は増えなかった(同一内容の再掲)。86件のうち直近5件(2026-08-11〜2026-12-31)は**未開催の予定大会**(今日2026-07-27時点)であり、収録漏れの対象にならない。

開催済み大会は 86 − 5 = **81件**。ローカルは80件。日付ベースで突合した結果:

### 完全に欠落している大会(全件列挙、2件)

| 開催日 | 大会名 | 公式結果ページ | 備考 |
|---|---|---|---|
| 2015-12-29 | SARABAの宴 | https://jp.rizinff.com/_ct/16969713 | 主要試合: 青木真也 vs 桜庭和志(メインイベント)。試合結果一覧ページが実在し、実データを持つ正規大会 |
| 2015-12-31 | IZAの舞 | https://jp.rizinff.com/_ct/16969509 | 主要試合: キング・モー vs イリー・プロハースカ(ヘビー級トーナメント決勝)。同じく試合結果一覧ページが実在 |

いずれもWebSearchで公式サイトの個別試合結果記事(`jp.rizinff.com/_ct/...`)がヒットしており、実際に開催され結果データが存在する大会であることを確認済み。`rizinEventIndex.ts`(79エントリ)にも`rizinRecordOverrides.ts`(RIZIN.1個別分)にも一切含まれていない。RIZIN.1(2016-04-17)を「サイトのタグ付け漏れ」として個別override済みなのに対し、この2大会はタグ付け漏れではなく(「大会情報」タグには正しく含まれている)、**単純に一度も取り込み対象になっていない**。

### 名称の表記ゆれによる突合失敗(機械的一致に失敗したが目視で欠落ではないと判定したもの)

日付ベースの突合では大会名の完全一致を要求していないため機械的失敗は生じなかったが、目視で以下の表記差異を確認した(いずれも同一大会と判定・欠落ではない):

- 公式タグ一覧は「RIZIN.2」のように短縮表記だが、ローカル・indexは「RIZIN.2 Cygames presents RIZIN FIGHTING WORLD GRAND-PRIX 2016 開幕戦」のように長い正式タイトルを保持(RIZIN.1〜.9で同様の傾向)。表記ゆれではあるが同一大会であることは日付・番号から明白。
- 2024-12-31: 公式タグ一覧では**「RIZIN DECADE」1件**として表示されるが、ローカルには**「RIZIN DECADE / Yogibo presents RIZIN.49」(本戦)と「RIZIN DECADE 雷神番外地」(アンダーカード)の2件**に分割して収録されている。これは事前情報として共有されていた過去の事故(本戦0件化)の修正結果であり、正しい取り扱い。日付カウント突合で唯一の「official=1件・local=2件」の不一致点として検出したが、欠落ではなく意図的な分割。

### 超RIZIN.2・BELLATOR JAPANの個別確認結果

- **超RIZIN.2**(のむシリカ presents 超RIZIN.2 powered by U-NEXT、2023-07-30): 公式タグ一覧・ローカルデータ双方に存在。ローカルには13 boutsが収録済み。双方向で欠落なしを確認。
- **BELLATOR JAPAN**(2019-12-29): 公式タグ一覧・ローカルデータ双方に存在(14 bouts)。ただし`rizinEventIndex.ts`のコメントは「RIZIN戦績への算入可否は取り込み側(update-rizin-records.ts)でイベント名フィルタにより判定する」と説明しているが、**`scripts/update-rizin-records.ts`にはそのようなイベント名フィルタは実装されていない**(grep実測、該当箇所なし)。実際に集計をフィルタしているのは`src/lib/mnewsRating/rizinRecordsAggregate.ts`の`computeFighterMmaRecord()`のみで、これは`ruleType`(MMA/キックボクシング/その他)でしか絞り込んでおらず、主催者(BELLATOR/RIZIN)では絞り込んでいない。BELLATOR JAPANのboutsを確認したところ`ruleType`は`'MMA'`/`'キックボクシング'`/`'その他'`が混在しており、MMAルール分は**現状、他のRIZIN大会と同様に「RIZIN限定集計」に算入されてしまう**。これはコメントの説明と実装が食い違っている状態であり、スコープ外だが別途の確認・対応が必要な発見事項として記録する。

### 「ドン・フライ杯」について

WebSearchで「ドン・フライ杯」単体、および「ドン・フライ杯 RIZIN」「ドン・フライ杯 格闘技」で検索したが、該当する大会は見つからなかった。ドン・フライ(Don Frye)は著名な総合格闘家個人としてのヒットのみで、同名の大会・杯は存在しないと判断する。**該当なし**。

## 3. 年別欠落集計

| 年 | 公式タグ大会数(開催済み) | ローカル収録数 | 欠落 |
|---|---|---|---|
| 2015 | 2(SARABAの宴/IZAの舞) | 0 | **2件(全欠落)** |
| 2016〜2026(開催済み分) | 79 | 80(DECADE分割+1) | 0 |

→ 「その年の全大会が揃っている」と言える最古の年は **2016年**。2015年は2大会とも完全に欠落しているため対象外。

## 4. `scripts/update-rizin-records.ts`実行スナップショットの鮮度

- `RIZIN_EVENT_INDEX`(`src/lib/mnewsRating/rizinEventIndex.ts`)の最新エントリは「RIZIN LANDMARK 14 in SENDAI」(2026-06-06)止まりで、2026-07-13時点の公式タグ一覧手動確認から**7週間分(LANDMARK 15以降)が未追記**。
- ところが`data/rizinRecords.json`には既に「abc presents RIZIN LANDMARK 15 in HIROSHIMA」(2026-07-18、11 bouts、fetchedDate 2026-07-19)が収録されている。ただしこのエントリの`sourceUrl`は他の79件のような個別`resultsPageId`(`https://jp.rizinff.com/_ct/xxxxxxx`)ではなく、タグページURL(`https://jp.rizinff.com/_tags/RIZIN_LANDMARK15`)になっている。**つまりこの1件だけは`RIZIN_EVENT_INDEX`経由の標準パイプラインを通っておらず、別の手段(手動追記等)で投入された形跡がある。**
- 結果として「実際に保持しているデータ」は公式サイトの開催済み大会と(2015年の2件を除き)一致しており鮮度の実害は無いが、「今後の運用で頼りにするはずの`RIZIN_EVENT_INDEX`」自体は7週間分低いエントリで止まっており、**このままの状態で`update-rizin-records.ts`を実行してもLANDMARK 15以降を再現できない**(indexに無いため)。運用上は要追記状態。
- 直近の未開催大会(2026-08-11 RIZIN.54 〜 2026-12-31 大晦日名古屋大会(仮)、計5件)はまだ結果が存在しないため、indexへの追記自体は開催後で構わない。

## 5. `fighterRecords.json`と`rizinRecords.json`の関係(独立2系統であることの整理)

`scripts/update-fighter-records.ts`・`src/lib/mnewsRating/rizinRecordsAggregate.ts`・`src/lib/mnewsRating/engine.ts`を確認した結果、両ファイルは**同じ「RIZIN試合結果」を扱いながら、完全に独立した別系統のデータ**であることを確認した。

| | `data/fighterRecords.json` | `data/rizinRecords.json` |
|---|---|---|
| 生成元 | `scripts/update-fighter-records.ts` | `scripts/update-rizin-records.ts` |
| 一次ソース | **Wikipedia**(`resolveFighter()`経由、選手記事の戦績表・infobox) | **RIZIN公式サイト**(`jp.rizinff.com`、大会ごとの試合結果一覧ページ) |
| 単位 | 選手単位(1選手1エントリ、`history[]`に全キャリアの試合を保持。RIZIN以外の団体も混在) | 大会単位(1大会1エントリ、`bouts[]`に対戦カードを保持。RIZINサイトが掲載する全ルール種別=MMA/キックボクシング等が混在) |
| 「通算戦績」(勝敗数の合計値) | Wikipedia/DATA-MMAのシード値(`r.wins`等)をそのまま採用。**historyの都度カウントには切り替えない**(2026-07-13のコメントに明記: シェイドゥラエフが19-0→22-0に水増しされた事故の再発防止のため、意図的にhistory非依存) | 該当なし(大会単位データのため選手ごとの累計は保持しない。集計は都度`computeFighterMmaRecord()`で導出) |
| RIZIN限定戦績としての用途 | **無い**。`fighterRecords.json`は一般ユーザー向けの選手プロフィール表示(通算戦績・試合履歴)用で、RIZIN限定集計のPhase4対象には含まれていない(コメント: 「rizinRecords由来カウントに統一する対象外」) | **これが本来のRIZIN限定集計の入力**。`rizinRecordsAggregate.ts`の`computeFighterMmaRecord()`が`ruleType==="MMA"`のboutのみを選手ごとに集計し、`mnewsRating/engine.ts`(mnewsレーティング・AI RIZINランキング)がこれを使う |

**要点**: 二重管理ではあるが、二重"カウント"にはなっていない。用途が完全に分離されている(`fighterRecords.json`=表示用の一般戦績、`rizinRecords.json`=レーティングエンジン用のRIZIN限定戦績)ため、同じ「RIZIN LANDMARK 15」の対戦が両ファイルに独立に(別ソースから)記録されていても、mnewsレーティングの計算自体は`rizinRecords.json`側のみを見ており、`fighterRecords.json`側のhistoryを二重加算することはない。ただし両者のソースが異なる(Wikipedia vs 公式サイト)ため、勝敗・決着方法等の食い違いが将来的に起き得る構造ではある(今回の調査ではその食い違いの有無までは検証していない、スコープ外)。

## 停止条件の該非

- 欠落大会10件超: **非該当**(欠落は2015年の2件のみ)
- 配列構造上、大会単位の一覧が作れない: **非該当**(単純な配列、問題なく一覧化できた)

→ いずれの停止条件にも該当せず、手順1〜5を最後まで完走した。

## 付記: data/・src/への変更

本調査は読み取り専用。`data/`・`src/`配下は一切変更していない(`git diff`はこのファイル追加分のみ)。

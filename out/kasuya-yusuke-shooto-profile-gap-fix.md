# 粕谷優介(kasuya-yusuke) 修斗プロフィール戦績5件投入

生成日時: 2026-08-03(JST)。

## 発端

`/fighters/kasuya-yusuke`の修斗分は6戦中1戦(2011-12-18 大尊伸光戦)のみ反映されており、
残り5戦(引き分け2件を含む)が未反映だった。

## 原因(2種類、それぞれ別対応)

### 原因A: 母集団スコープ漏れ(4件: coBa/太田洋平/藤石義和/独眼竜刺牙、いずれもpre-cutoff)

指示書R-7/R-8(#350、マージ済み)の修斗プロフィール監査は`fighters.ts`の
`org: "shooto"`101名(現在104名)を対象母集団としていた。kasuya-yusukeは
`org: "pancrase"`のため対象外で、**本人のプロフィール(id=323)は一度も
取得されていなかった**。唯一反映済みの1戦(2011-12-18)は、対戦相手の
大尊伸光(tyson-nobumitsu, org: "shooto")側が101名の対象だったために
偶発的に拾われたものであり、kasuya側が能動的に監査された結果ではない。

上記4名の対戦相手(coBa/太田洋平/藤石義和/独眼竜刺牙)は`fighters.ts`に
一件も登録が無く、どちら側からも監査対象になっていなかった。

### 原因B: archive収録漏れ(1件: 児山佳宏、post-cutoff 2013-12-15)

`data/shootoRecords.json`(大会アーカイブ)には2013年12月の大会が
1件も存在しない。post-cutoff(2012-12-24以降)にもかかわらず大会自体が
アーカイブに無いため、通常の大会単位の突合では発見できない。

## 対応

`scripts/add-shooto-profile-bouts-kasuya-yusuke.ts`を新設し、
指示書R-8/C-3で確立済みのスキーマ(1bout=1件の疑似`ShootoRecordsEvent`、
`sourceType: "profile"`、負の`shootoEventId`)に倣って5件を
`data/shootoProfileBouts.json`に追記した。`data/shootoRecords.json`・
`src/lib/mnewsRating/shootoScraper.ts`は変更していない(原因Bの
大会単位の再取得には着手していない)。

原因Bの1件(2013-12-15 児山佳宏戦)についても同じプロフィール経由の
疑似イベント形式で投入できたため、除外せず含めた。

### データ出所

https://www.shooto-mma.com/fighters/?id=323 を実測(2026-08-03、curl)。

**注記**: 同ページ上部のヘッダー集計は「6戦4勝1分」だが、戦績表本体は
6戦4勝2分(△が2013-12-15・2011-10-01の2件)。既知の
ヘッダー/テーブル食い違いパターンに倣い、テーブル本体を正とした。

## 検証結果

- `computeFighterShootoRecord()`(修斗単体): 投入前 1-0-0(1戦) → 投入後 4-0-2(6戦)。引き分け2件が正しく`draws`としてカウントされることを確認。
- `computeMultiOrgRecord()`(4団体通算、2行目): 投入前 7-8-0(15戦) → 投入後 10-8-2(20戦)。
- **波及確認**: `FIGHTERS`全365名で`computeFighterShootoRecord()`の前後差分を突合。**変化したのはkasuya-yusuke 1名のみ**(他選手への二重計上・意図しない変化は0件)。
- **`data/rankings.json`**: 無変更(バイト比較で完全一致)。`scripts/update-mnews-rating.ts`は`shootoRecords`/`shootoProfileBouts`をimportしておらず、そもそも入力に含まれない(#350時点の確認と同じ)。
- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: 成功

### ★既知の残存リスク(本PRでは対応しない)

`src/lib/multiOrgRecordsData.ts`の`fetchShootoRecords()`は`data/shootoRecords.json`と
`data/shootoProfileBouts.json`を単純concatするのみで、日付+対戦相手の複合キーによる
重複排除は行っていない(実装を確認済み)。将来`shootoRecords.json`のarchive収集範囲が
広がり2013年12月の大会(児山佳宏戦の実大会)が追加された場合、本PRで投入した
2013-12-15 vs 児山佳宏のprofile発の1boutと重複するリスクがある。archive収集範囲を
広げる作業を行う際は、この1bout(date="2013-12-15", 相手="児山  佳宏")が
二重計上されないか個別に確認すること。

## 今回のスコープ外: 357名(現365名)規模のクロスorg監査

今回の調査で、R-7b/R-8の「修斗org 101名(現104名)」という母集団自体に
構造的な抜けがあることが判明した。**「修斗org以外にタグ付けされているが
実際は修斗歴を持つ選手」が丸ごと未監査**であり、kasuya-yusukeはその一例に
過ぎない。

### 規模見積り(次の指示書用)

- `FIGHTERS`全365名のうち、`org !== "shooto"`かつ`orgs`に`"shooto"`を含まない選手: **261名**。この261名が「粕谷型」の可能性がある未監査母集団。
- 261名全員の修斗プロフィールを直接fetchする必要はない。R-7bのステップa)と同様、まず修斗公式選手一覧ページのローマ字表記との名前突合(**追加fetch不要、既存の`/fighters/`一覧1ページのみ**)でid特定を行い、**実際にidが特定できた選手のみ**プロフィールページを1件ずつfetchする(1.2秒間隔・robotsGate経由)。
- 実際に何名がヒットするかは名前突合をやってみないと分からないが、105名(101→104に近い規模)が「本業が修斗」の選手だったことを踏まえると、261名中「たまたま修斗歴もある」選手はそれより少ない可能性が高い。それでも上限としては**最大261件のプロフィールfetch**を想定しておくべきで、本タスクの停止条件(150件超で対象を絞る)には抵触する規模。
- 次の指示書では、まずid特定ステップ(fetch不要)だけを先行実行して実際のヒット数を確定させ、その時点で150件超か再判定するのが妥当。

## 出力ファイル

- [scripts/add-shooto-profile-bouts-kasuya-yusuke.ts](../scripts/add-shooto-profile-bouts-kasuya-yusuke.ts)
- `data/shootoProfileBouts.json`(115件、既存110件+5件)

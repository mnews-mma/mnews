# 住村竜市朗の戦績を埋める(指示書N)報告

## 1. historyが空になっている箇所の特定

`https://ja.wikipedia.org/wiki/住村竜市朗` の生wikitextを直接確認した結果、
`{{MMA statsbox3}}`(選手プロフィール)と`== 戦績 ==`節の`{{MMA recordbox}}`
(集計値のみ: total=36, wins=27, losses=8, draws=1)は存在するが、
**`{{Fight-start}}`/`{{Fight-cont}}`/`{{Fight-end}}`の個別試合節がそもそも
記事中に存在しない**。パーサ(`parseJaFightHistory`)のバグではなく、
記事自体に取り込める対戦履歴データが無いことが原因と判明した。

## 2. 4団体データでの実測

`computeMultiOrgRecord`/`computeMultiOrgBoutTable`をRIZIN・DEEP・パンクラス・
修斗の4データセット全てを渡して実行した結果:

```
record: 19勝6敗1分(26bout)
```

infobox集計値(36戦)の72%(26/36)が4団体データで捕捉できていた。不足10戦は
主に2013年以前(修斗プロフィール由来の初期キャリア)と一部のBellator Japan等
4団体外の試合とみられる。

## 3. 対応方針の決定(ユーザー判断)

当初「2行目(4団体合算)へ切り替える」案を提示したが、切り替えるとヘッダー表示が
27-8-1(36戦)→19-6-1(26戦)に見た目上減少する(本人の実戦績を隠す形になる)ため
不採用。**「ヘッダーは1行目のまま、テーブルが4団体合算にフォールバックしている
場合にその旨を注記する」**方針を採用した。

## 4. 実装

`src/app/fighters/[slug]/page.tsx` に以下を追加(`shouldPreferMultiOrgRecord`は
無変更):

```ts
const tableIsMultiOrgFallbackUnderRowOneHeader =
  !suppressNoRecordRow && history.length === 0 && SHOW_MULTI_ORG_RECORD && displayHistory.length > 0;
```

この条件を満たす場合、テーブル直前に既存の「他団体・海外での試合は含みません」
と文言・見た目を揃えた注記を表示する:

```
対戦表はRIZIN・DEEP・パンクラス・修斗の試合のみ表示しています ／ 集計について
```

住村竜市朗を名指しする条件ではなく、「ヘッダーが1行目由来(2行目への切り替え
条件を満たさない)・その選手自身のhistoryが空・4団体合算のテーブルが1件以上ある」
という一般条件で判定している。

## 5. 全365名での実測

```
新規注記(テーブルのみ4団体fallback、ヘッダーは1行目): 1名(sumimura-ryuichiro)
既存注記(suppressNoRecordRow、2行目自体がヘッダー): 167名
```

**新規注記の対象は住村竜市朗1名のみ**。既存の「他団体・海外での試合は含みません」
注記(suppressNoRecordRowベース)は本PRで一切変更していないロジックで167名に
表示される(受入条件にあった想定値「86名」とは異なる実測値だったため、変化の
有無ではなく実測値そのものを報告する。本PRはこの条件式に一切手を加えていない
ため、マージ前後でこの167名という数字自体は不変)。

## 6. ヘッダー・テーブル・注記の実測(ローカル、本番未マージのため)

本PRは`data/fighterRecords.json`・`data/rankings.json`を一切変更していないため、
`fighterRecordsCache.ts`のGitHub raw(mainブランチ)経由のデータ取得でも
本番相当の正しい値が返る(#439の制約と異なり、本PRはコードのみの変更のため
ローカル確認が有効)。ローカルビルド+起動で確認した実際の表示:

- **ヘッダー**: 27-8-1(通算戦績)、勝率77%、フィニッシュ率44%
- **注記**: 「対戦表はRIZIN・DEEP・パンクラス・修斗の試合のみ表示しています／集計について」(新規追加、テーブル直前に表示)
- **テーブル**: 26行(4団体合算bout、2010-2026年)
- **決着内訳バー(MethodButterfly)**: 従来どおり非表示(`historyReconciles`が
  ヘッダー27-8-1とテーブル再カウント19-6-1の不一致によりfalseを返すため。
  本PRはこの判定ロジックに一切手を加えていない)

## 7. ヘッダー数値の変化

`data/fighterRecords.json`・`data/rankings.json`は本PRで完全無変更
(git diffに現れない、origin/mainとmd5一致)。**全365名でヘッダー数値が
変化した選手は0名。**

## 8. rankings.json無変更確認

```
md5(本PR) = 28503f985f51f163ced0173e0feb191b
md5(origin/main) = 28503f985f51f163ced0173e0feb191b
```
完全一致。

## 9. 波及確認

- `historyReconciles()`: 関数自体・呼び出し箇所とも無変更。判定に使う
  `chartTotals`/`methodButterflyHistory`の計算式も無変更のため、全365名で
  判定結果は不変(コード変更が新規追加した独立変数のみで、既存の計算式には
  一切触れていないため測定不要なレベルで自明だが、grep実測でも新規変数の
  参照箇所が宣言1箇所・JSX表示1箇所の計2箇所のみであることを確認済み)。
- 次戦カード・meta title・OG画像・一覧カード: いずれも新規変数
  `tableIsMultiOrgFallbackUnderRowOneHeader`を参照しておらず、影響なし。

## 10. tsc/build

`npx tsc --noEmit -p .`: エラーなし
`npm run build`: 成功

## 変更ファイル

- `src/app/fighters/[slug]/page.tsx`(17行追加のみ、既存ロジック無変更)

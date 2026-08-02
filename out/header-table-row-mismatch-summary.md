# 選手ページ: ヘッダー戦績とテーブル行数の食い違い調査(read-only)

## 経緯

`/fighters/tamura-hibiki` でヘッダーの通算戦績が9-11-5(25試合)なのに対戦テーブルには1試合しか
出ていない不整合が報告された。原因は `src/app/fighters/[slug]/page.tsx` の

- ヘッダー総試合数: `suppressNoRecordRow` が true なら2行目(4団体合算 `computeMultiOrgRecord`)、
  false なら1行目(`data/fighterRecords.json` の `wins/losses/draws`)
- 対戦テーブル: `history.length > 0` なら常にその `history`(1行目と同じWikipedia由来)を使い、
  4団体合算(`computeMultiOrgBoutTable`)にはフォールバックしない(page.tsx:353-372)

という**互いに独立した判定・データソース**で決まっており、一致を保証する仕組みがどこにも無いこと。

## 調査方法

`scripts/investigate-header-table-row-mismatch.ts`(read-only、data/への書き込み無し)で
page.tsxと同じ判定ロジックを再現し、全選手について「ヘッダー総試合数」と「テーブル行数」を算出して
比較した。2回連続実行でSHA256一致(決定論的)を確認済み。

## 結果: 77件(通算戦績が何らか表示される359名中)

| パターン | 件数 | ヘッダー | テーブル | 原因 |
|---|---|---|---|---|
| A | 34件 | 2行目(4団体合算) | history(Wikipedia、1行目相当)のまま | ユーザー報告と同型の構造的バグ。`suppressNoRecordRow`で1行目を隠して2行目を出しているのに、テーブル側は`history.length>0`の間は4団体合算に切り替わらない |
| B | 38件 | 1行目(Wikipedia、wins+losses+draws) | history.length(同じくWikipedia由来) | 同一データソース内での不整合。`data/fighterRecords.json`の集計値(wins/losses/draws)とhistory配列の実際の行数がズレている |
| C | 5件 | 2行目(4団体合算) | 4団体bout table(同じ4団体合算) | 同じ4団体合算内での不整合。`computeMultiOrgRecord`は日付未確定bout(実測: パンクラス2件相当)も勝敗数に含めるが、`computeMultiOrgBoutTable`側の`toBoutRow`は日付が無い試合を行として出さない(multiOrgRecord.ts:132「日付未確定の試合は出さない」) |

パターンBの内訳: 38件中34件は差分ちょうど1で、抽出したサンプル(堀口恭司・朝倉未来・クレベル・コイケ等)は
いずれもhistory配列に`result:"nc"`(無効試合)が1件含まれ、wins/losses/drawsには数えられていないことが原因と
確認できた(NC扱いの設計自体は妥当。ただし「ヘッダー総試合数」と「テーブル行数」を字面通り比較すると不一致になる)。
残り4件(所英男・住村竜市朗・北方大地・大原樹理)は差分が2〜10あり、個別のデータ不整合(所英男はwins/losses
フィールドがhistory配列の実際の勝敗数と噛み合っていない、住村竜市朗はwins/losses/draws値がある一方history配列が
空、など)で、NC説明では片付かない。

詳細は `out/header-table-row-mismatch.csv` 参照(全77件、slug/表示元/各総数/パターン付き)。

## 選択肢(修正はこのPRに含めない)

**対象はパターンA・C(計39件、構造的にテーブル側の参照元選択が誤っている分)。**

1. **テーブルの参照元をヘッダーと同じ判定基準に統一する**(`displayHistory`の分岐条件を
   `history.length > 0` から `suppressNoRecordRow` 基準に変更し、2行目を表示中は常にテーブルも
   `multiOrgBoutTable` を使う)。差分は小さく、A・Cのほぼ全件を解消できる。デメリットは、
   Wikipedia側にしかない試合(4団体データに未収録の海外団体戦等)が2行目表示中は見えなくなる点だが、
   suppressNoRecordRowはそもそも「4団体合算の方が試合数が多い」場合にしか立たないため実害は小さいと見られる。
2. **historyと4団体boutをマージして出す**(日付+対戦相手で名寄せし重複除去)。情報を捨てないが、
   表記ゆれ(決着方法・イベント名の書式差)による名寄せミス・二重掲載のリスクがあり実装コストが高い。
3. **現状維持+注記のみ**(「テーブルは総試合数と一致しない場合があります」等)。実装コストは最小だが
   ユーザー体験は改善しない。

**パターンB(38件)は表示ロジックの選択の問題ではなく、`data/fighterRecords.json`生成バッチ側の
集計値とhistory配列のズレが原因**なので、上記の選択肢では解決しない。34件はNC対象外という既存仕様の
帰結として許容するか明示するかの判断、残り4件は個別データ修正が必要。

## 検証

- [x] `./node_modules/.bin/tsc --noEmit` エラー無し
- [x] `npm run build` 成功
- [x] 調査スクリプト2回実行でSHA256一致(決定論的)
- [x] `data/`配下は無変更(read-onlyのため)

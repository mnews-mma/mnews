# 引用符付きニックネーム表記の正規化(指示書N)

## 背景

nii-suguruが未解決だった原因は、生表記「新居"コンバ王子"卓」に対しaliasが断片
「コンバ王子」のみで、生表記全体との完全一致にならないため(指示書I調査で確認済み)。
同型の表記(姓"ニックネーム"名)はパンクラス公式アーカイブ等に多数存在する。

なお調査の過程で、`src/lib/fighters.ts`の`findFighterSlugByName()`(選手データ
build時の名前解決に使用)には既に`stripDecorativeNickname()`という同種の
処理(引用符・カギ括弧・丸括弧で囲まれた挿入部の除去)が存在していたことが判明した。
今回追加が必要だったのは、独立したバックフィル再実行スクリプト
(`scripts/backfill-shooto-pancrase-slugs.ts`・`scripts/backfill-rizin-slugs.ts`)側の
`scripts/lib/fighterNameBackfill.ts`(build時とは別の、より単純な正規化ロジック)に
同等の処理が無かった点。

## 1. 全件抽出

4団体の生表記(`fighterAName`/`fighterBName`)から、引用符(直線・カーリー、開始/終了で
異なる文字種が混在するケース含む)で囲まれた挿入部を2文字以上持つものを機械抽出した。

- 検出文字: U+201C(")・U+201D(")・U+22(")のみ実データに出現。単引用符・カギ括弧・
  全角引用符(〝〞〟等)の出現は0件だった。
- 延べヒット数(A/B個別): **247件**
- ユニーク生表記数: **89件**
- 団体別内訳: RIZIN 50・修斗 1・パンクラス 121・DEEP 75

出力: `out/quote_nickname_raw_hits.json`

## 2. 実装

`scripts/lib/fighterNameBackfill.ts`に`stripQuotedInsert()`を追加し、`resolveSlug()`を
拡張した:
- 引用符ペア(種類問わず)またはカギ括弧「」で囲まれた区間を丸ごと除去する版を生成
- 除去前(既存のnormalize()、引用符記号のみ除去)と除去後の両方でindex照合を試みる
- 両方がヒットし、かつ**別のslugに解決された場合は曖昧として弾く**(指示書指定の
  安全策。今回の実データでは0件該当)
- 丸括弧は対象外とした(生表記側にジム名等の別情報が丸括弧で残るケースがあり、
  誤って壊すリスクがあるため。gym名は既に`fighterAGym`等の別フィールドに分離済み)

## 3. 89件の内訳(実装のnormalize()関数を直接89件全件に適用して分類)

| 分類 | 件数 |
|---|---|
| 既存のnormalize()で解決済み(本PR無関係) | 3 |
| **挿入部除去で新規解決** | **7**(実質3名: shirakawa-rikuto・hibino-junya・arato-hidetaka) |
| 除去前後で別slugに衝突・弾いた | 0 |
| 依然未解決 | 79 |

依然未解決の79件の大半は、ニックネームだけでなく**姓自体も4団体側の表記とズレている**
(例: パトリッキー・"ピットブル"・フレイレ→姓「フレイレ」がfighters.ts側に無い。
指示書O参照)ため、ニックネーム除去だけでは解決しない。これらは別途、姓側の
表記ゆれ対応が必要(本PRのスコープ外)。

## 4. 実データへの適用結果

`scripts/backfill-shooto-pancrase-slugs.ts`・`scripts/backfill-rizin-slugs.ts`を
再実行した(#301のalias追加分[kanru/tenya]も同時に反映される点に注意)。

- **DEEP**: 新規解決2件(kanru×1=#301由来、**hibino-junya×1=本PR由来**)
- **パンクラス**: 新規解決3件(tenya×3、いずれも#301由来。本PR固有の新規解決は0件)
- **修斗・RIZIN**: 新規解決0件

shirakawa-rikuto・arato-hidetakaの該当bout自体は、`findFighterSlugByName()`側の
`stripDecorativeNickname()`により**既に解決済み**だったため、今回のバックフィルでは
差分として現れなかった(既存機能が既にカバーしていた)。

## 5. unresolved件数の変化とベースライン更新

| 団体 | 変更前 | 変更後 | 差分 |
|---|---|---|---|
| RIZIN | 1103 | 1103 | 0 |
| 修斗 | 2921 | 2921 | 0 |
| パンクラス | 8500 | 8497 | -3(全てtenya由来、#301) |
| DEEP | 3671 | 3669 | -2(kanru=#301由来、hibino-junya=本PR由来) |
| 合計 | 16195 | 16190 | -5 |

`scripts/check-null-slug-baseline.ts`のBASELINEを上記「変更後」の値に更新した。

## 6. 検証

- `npx tsc --noEmit`: パス
- `npm run build`(全checkスクリプト+`next build`): パス、139ページ生成成功
- `npm run test:mnews-rating`: 220件成功/0件失敗
- ローカル`next start`で主要ページ200確認: `/`・`/fighters`・
  `/fighters/hibino-junya`・`/fighters/shirakawa-rikuto`・`/events`・`/results`・`/rankings`

## 補足: 他PRとの関係

PR #302(指示書I)も同じmainから分岐し、`data/deepRecords.json`・
`data/pancraseRecords.json`・`scripts/check-null-slug-baseline.ts`の同じ箇所を
独立に更新している。どちらを先にマージしても、後からマージする側でこのPRの
差分(コンフリクト解消+BASELINE再調整)が必要になる。

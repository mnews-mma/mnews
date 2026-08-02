# 選手ページ: ヘッダー戦績とテーブル行数の食い違い修正(指示書R-9)

PR #359(investigate/header-table-row-mismatch、read-only)の悉皆調査で見つかった
A型34件・C型5件(計39件)を対象に、以下の方針で修正した。

## 方針(案①)

`src/app/fighters/[slug]/page.tsx` の `displayHistory` を、ヘッダー(通算戦績
スタットカード)と同じ判定基準(`suppressNoRecordRow`)に統一した。
`suppressNoRecordRow` が true(=ヘッダーが2行目=4団体合算を表示中)の間は、
対戦テーブルも常に `multiOrgBoutRows`(2行目と同じ集計元)を参照する。
それ以外(通常のWikipedia選手)は従来どおり `history` を優先し、history も
無い選手(`noRecordData`)は従来どおり4団体boutにフォールバックする。

B型(38件、Wikipedia側=1行目のwins/losses/draws合計とhistory配列長のズレ)は
この分岐を通らないため無変更(38件とも変化なしを実測確認済み)。

## 事前検証: 案①でテーブルから消えるboutの件数

`scripts/investigate-a-c-fix-impact.ts` で、A型34名についてhistory(Wikipedia)
にはあるがmultiOrgBoutTableには無いbout(=案①適用でテーブルから見えなくなる
試合)を洗い出した。

- 対象34名中5名で計11件のbout(RFC・ROAD FC・Road to UFC・旧JEWELS等、4団体
  データの収録範囲外の団体・大会が中心)。
- **ただしこの11件は、修正前から既にヘッダー側(2行目=multiOrgTotal)の
  通算戦績には含まれていなかった**(multiOrgTotalとmultiOrgBoutLenは修正前
  から一致しており、どちらも同じ4団体生データのみを集計元とするため)。
  つまり案①はヘッダーが既に表示していた(小さい方の)数字にテーブルを
  合わせるだけで、新たな情報欠落は生じない。実害はゼロと判断し、そのまま
  進めた。

## C型5件: 原因の再特定(日付未確定ではなくNC)

PR #359の報告書は「`computeMultiOrgRecord`が日付未確定boutも勝敗数に含める
のに`computeMultiOrgBoutTable`側が日付未確定を出さない」ことが原因という
仮説(未検証)を記していたが、5件全件を実データで突き合わせた結果、
**実際の原因は日付未確定boutではなくNC(無効試合)だった**:

- `computeFighterMmaRecord`等の集計(wins/losses/draws)はNC(`resultType: "nc"`)
  を除外する。
- `computeMultiOrgBoutTable`の`toBoutRow`はNCも行として出す(`result: "nc"`、
  表示は「無効」)。
- 5件とも差分はちょうど1件で、各1件のNC bout(西尾真輔⇔神谷大智の
  PANCRASE 345戦など)が原因と特定できた。日付未確定boutは関与していない。

この挙動は、B型38件のうち34件が同じ理由(Wikipedia側history配列の
`result:"nc"`がwins/losses/draws集計に含まれない)で不一致になっている
既存の仕様と**構造的に同一**であり、PR #359の報告書自身もB型のNC由来の
不一致を「NC扱いの設計自体は妥当」と評価している。B型を変更しない方針と
整合させるため、C型のNC由来の不一致についても**コード変更は行わない**
(NC bout はテーブルに「無効」として表示されたまま、ヘッダーの勝敗数
(wins/losses/draws)には従来どおり含めない)。

## 修正後の状態

`scripts/verify-header-table-row-mismatch-postfix.ts`(PR #359の調査
ロジックを修正後のpage.tsxに合わせて再現)で再測定。

| パターン | 修正前 | 修正後 | 内訳 |
|---|---|---|---|
| A(テーブル参照元の取り違え) | 34件 | 0件(参照元は完全一致) | - |
| B(Wikipedia側NC由来等) | 38件 | 38件(無変更) | 対象外・無変更を確認済み |
| C(4団体合算内のNC由来) | 5件 | 5件(無変更・意図的) | 全件NC1件ずつが原因、Bと同型のため未修正 |
| 残存(A・C由来、NC1件ずつ) | - | 12件 | 全件 `tableTotal - headerTotal == 1`、原因は各1件のNCで統一。B型の34件と同じ「NC扱いは妥当」パターン |

**「ヘッダーの参照元とテーブルの参照元が食い違う」という構造的バグ
(A型34件)はゼロになった。** 残る12件(旧A型7件+C型5件)は、いずれも
NC(無効試合)がテーブルには表示されヘッダーの勝敗数には数えられないという、
既存のB型34件と同一の(修正対象外と判断済みの)仕様上の差分であり、
新たなバグではない。

## 検証

- [x] `./node_modules/.bin/tsc --noEmit` エラー無し
- [x] `npm run build` 成功
- [x] `npm run test:mnews-rating` 220件成功/0件失敗
- [x] `git status` で `data/` 配下の変更なし(表示ロジックのみの修正)
- [x] B型38件が完全に無変更であることを新旧CSVのdiffで確認
- [x] ローカル`npm run dev`で実機確認:
  - `tamura-hibiki`(A型代表例): ヘッダー「9-11-5」、テーブル25行で一致
  - `matsuda-arisa`(C型): ヘッダー「6-0-0」、テーブル7行(うち1行はNCと
    明示された「無効」表示)で、勝敗数とテーブルの対応が視覚的に破綻しない
    ことを確認
  - `horiguchi-kyoji`(B型、対象外): 1行目・2行目・テーブルとも修正前と
    同じ表示のまま

## 別件(スコープ外、参考記録)

`generateMetadata()`(`<title>`・メタディスクリプション生成)は
`fighter.wins/losses/draws/history.length`(常に1行目=Wikipedia値)を
参照しており、`suppressNoRecordRow`を考慮しない。そのため
`suppressNoRecordRow`中の選手は、本文の表示(2行目基準)と`<title>`
(1行目基準)が一致しないことがある(例: tamura-hibikiの`<title>`は
「戦績1勝0敗0分｜全1戦の結果」のまま)。本PRのスコープ(本文ヘッダーと
対戦テーブルの食い違い)とは別の問題のため、本PRでは修正しない。

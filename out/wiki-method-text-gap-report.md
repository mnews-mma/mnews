# 指示書②: チャート≠1行目「決着方法テキスト欠落」8名の原因調査

## 結論(先に要約)

前提として与えられた「21名のうち8名が決着方法テキスト欠落」という数字は、
**選手ページの実際の描画ロジック(`suppressNoRecordRow`による4団体合算への
表示差し替え)を考慮しない単純比較(v1)でのみ再現される**。この単純比較を
実際のpage.tsxのロジックに合わせて補正すると(v2)、以下の通り数字が変わる。

| | v1(単純比較・data/fighterRecords.jsonの生historyのみ見る) | v2(page.tsx実装準拠・suppressNoRecordRow考慮) |
|---|---|---|
| チャート≠1行目 総数 | 21名 | **14名** |
| うち決着方法テキスト欠落 | 8名 | **3名** |

v1の8名のうち6名(結城大樹・嶋屋澪・高本千代・erika・片山智絵・高田暖妃)は
全員`needsReview: true`が立っており、`shouldPreferMultiOrgRecord()`
(`src/lib/mnewsRating/multiOrgRecord.ts:213`)の条件
`if (fighter.needsReview) return record.wins + record.losses + record.draws > 0;`
により、4団体合算データ(shootoRecords.json由来)が1件でもあれば
**常に**1行目・チャート・対戦テーブルの全てが4団体合算側に差し替わる
(`suppressNoRecordRow`)。差し替え後は1行目とチャートが同じ
`computeMultiOrgRecord`/`computeMultiOrgBoutTable`から生成されるため、
実際のページ上ではそもそも食い違いが発生しない。v1がこれを見落としていたのは、
`data/fighterRecords.json`の生の`wins`/`losses`/`history`だけを見て、
page.tsx側の差し替え判定を再現していなかったため。

v2で正しく再現した結果、決着方法テキスト欠落として残るのは3名のみで、
**全件が「試合が実際に行われなかった(不戦勝/失格)」または「非公式戦で
記事自体に決着方法の記載がない」ことによる、捏造ゼロ方針での正しい除外**
だった。パーサ側のバグでも、記事側の書き忘れでもなく、**修正対象ではない**。

## v2: 決着方法テキスト欠落 3名の内訳

### ① karamov-vugar(ヴガール・ケラモフ)source=seed(ja.wikipedia由来)

- 欠落bout: 2016-12-31 vs ジャマル・バリ(Azerbaijan MMA Federation Azerbaijan vs. Iran)
- header 21-7 / チャート 20-7(1勝ぶん欠落)
- **ja.wikipedia記事(https://ja.wikipedia.org/wiki/ヴガール・ケラモフ )の生Wikitext**:
  ```
  {{Fight-cont|○|ジャマル・バリ|1R 0:00 [[N/A]]|Azerbaijan MMA Federation Azerbaijan vs. Iran|2016年12月31日}}
  ```
  決着方法欄が記事に literal に `[[N/A]]`(「N/A」への内部リンク)と書かれている。
  非公式戦(アゼルバイジャンMMA連盟主催のfederation内戦)で、Wikipedia編集者自身が
  決着方法を把握できず「N/A」と記載したもの。**記事側に元々情報が無い**。
  `isUnknownMethod()`がround/time部分を除いた残りが`N/A`と一致することを検出し、
  正しく除外している(`src/lib/methodClassify.ts:23-28`)。
  他の情報源で正確な決着方法が判明しない限り、捏造ゼロ方針上ここは埋められない。
  **対応不要(仕様通り)**。

### ② uehara-taira(上原 平)source=multiOrg(4団体合算・data/shootoRecords.json由来)

- 欠落bout: 2023-07-23 vs CHAN 龍(PROFESSIONAL SHOOTO 2023 Vol.5)
- header 7-3 / チャート 6-3(1勝ぶん欠落)
- **data/shootoRecords.jsonの該当エントリ**(修斗公式アーカイブから機械取得、
  取得元: https://www.shooto-mma.com ):
  ```json
  {
    "resultType": "decisive", "winnerName": "上原 平", "winnerSlug": "uehara-taira",
    "methodRaw": "",
    "noteRaw": "※青：CHAN-龍が前日計量に出頭せず、試合出場の意思を確認できなかった為。..."
  }
  ```
  対戦相手が前日計量に出頭せず、試合自体が成立しなかった不戦勝。**実際に
  試合が行われていないため決着方法が存在しない**(公式アーカイブ自体が空欄)。
  既存の調査記録([[project_methodbutterfly_displayhistory_fix]]、PR#392)でも
  同一の結論に到達済み。**対応不要(仕様通り)**。

### ③ iwasaki-taiga(岩﨑 大河)source=multiOrg(4団体合算・data/shootoRecords.json由来)

- 欠落bout: 2025-05-18 vs アレクシス カンポス(【第1部】PROFESSIONAL SHOOTO 2025 Vol.3)
- header 8-1 / チャート 8-0(1敗ぶん欠落)
- **data/shootoRecords.jsonの該当エントリ**:
  ```json
  {
    "headingText": "中止試合 5分3R", "isWeighInMiss": true,
    "resultType": "decisive", "winnerName": "アレクシス カンポス",
    "methodRaw": "",
    "noteRaw": "計量失格\n※赤：岩﨑が規定時間までに計量を行うことが出来なかったため。"
  }
  ```
  岩﨑が計量失格となり試合が中止(不戦敗)。②と同型の「試合不成立」ケース。
  **対応不要(仕様通り)**。

v1で挙がっていた他の5名(結城大樹・嶋屋澪・高本千代・erika・片山智絵)と
高田暖妃は、上記の通り実際のページでは4団体合算表示に切り替わっており
チャート≠1行目は発生していない(検証: ローカルdevサーバーで6名全員の
選手ページを確認、下記「副次的に発見した問題」参照)。

## 副次的に発見した問題(決着方法欠落とは別件・修正済み)

v1の8名を個別に裏取りする過程で、`src/lib/fighters.ts`に直書きされた
seedデータ(history配列)6件について、**引き分け(ドロー)が勝敗として
誤登録されている**ことを発見した。`data/shootoRecords.json`(修斗公式
アーカイブ機械取得データ)と突合して確認:

| 選手 | 対戦相手 | 日付 | 大会 | fighters.ts(修正前) | 公式アーカイブ実際 |
|---|---|---|---|---|---|
| yuki-daiki(結城大樹) | 仲山貴志 | 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 | win | **draw**("ドロー") |
| mio-shiyama(嶋屋澪) | erika | 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | loss | **draw** |
| erika | 嶋屋澪 | 2025-07-21 | (同上・相手側) | win | **draw** |
| takamoto-chiyo(高本千代) | 片山智絵 | 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | loss | **draw** |
| katayama-tomoe(片山智絵) | 高本千代 | 2025-09-21 | (同上・相手側) | win | **draw** |
| takada-atsuhi(高田暖妃) | チョンチャヒョン | 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | loss | **draw** |

いずれも決着方法が空欄("")だった行で、実際には引き分け(判定なしの
ドロー)だったため元々決着方法自体が存在しない試合だった。`result`を
`draw`に修正し、各選手のトップレベル`wins`/`losses`/`draws`カウントも
連動して修正した(`src/lib/fighters.ts`・`data/fighterRecords.json`両方、
最小差分)。

**この6件は`needsReview: true`のため、修正前後どちらでも実際の選手ページの
表示(1行目・チャート・対戦テーブル)には影響しない**(上記の通り常に
4団体合算表示に差し替わるため)。純粋なデータ品質の是正であり、
チャート≠1行目問題の修正ではない。将来`needsReview`フラグが外れた場合や、
他の消費箇所がfighters.tsのseedを直接参照する場合に誤ったデータを
出さないための予防的修正。

## 波及確認

- `git diff origin/main -- src/lib/fighters.ts` は上記6選手ブロックの
  `result`/`wins`/`losses`/`draws`フィールドのみ(12ハンク、対象6名)。
  他選手のhistoryパース結果への影響はゼロ(パーサ自体を変更していないため)。
- `data/fighterRecords.json`も同じ6選手のみ、最小差分で同期。
- `npm run check:fighter-records`(既存の整合性チェック)を修正前後で実行し、
  fatal 0件・warning 13→13件(row-count-mismatch、決着方法欠落とは別の
  既知カテゴリ、対象外)で変化なしを確認。
- `npx tsc --noEmit`・`npm run build` とも成功。
- ローカルdevサーバーで修正対象6名+検証対象3名の選手ページを目視確認
  (erika: "2-1-1"表示・片山智絵との対戦が「分/ドロー」表示、
  上原平: "7-3-3"/チャート"6勝3敗"、岩﨑大河: "8-1"/チャート"8勝0敗"
  で意図通りの表示)。

## 出力ファイル

- `scripts/audit-chart-vs-row1.ts`(v1・単純比較、指示書①相当の再現用)
- `scripts/audit-chart-vs-row1-v2.ts`(v2・page.tsx実装準拠、本調査の正)
- `out/chart-vs-row1-audit.json` / `out/chart-vs-row1-audit-v2.json`
- `out/chart-vs-row1-audit-postfix.log`(6件修正後のv1再実行ログ)

## 受入条件との対応

- 「8名それぞれ、欠落boutを日付・大会名・相手名で列挙+記事の該当行の生
  wikitext併記」→ v1の8名のうち6名は実際には表示に影響しないため、生の
  wikitext自体が存在しない(そもそもWikipedia記事を持たない選手)。該当なしを
  含め全8名について原因を特定・記載した(上記)。
- 「修正後にチャート合計が1行目と一致するか実測」→ 副次的に発見した6件は
  修正後、fighters.ts単体で見ればチャート=1行目に一致(v1後処理ログで確認)。
  ページ実描画では元々一致していた(suppressNoRecordRowのため)。
- 「波及: 全選手のパース結果diffが対象選手以外0件」→ パーサ変更なし。
  git diffで対象6選手以外への影響ゼロを確認。
- 「実行コスト: out/のみ、ページ側の計算量は変更しない」→ src/の変更は
  wikipedia.ts等のロジックではなくfighters.tsのデータリテラルのみ。
  計算量・実行パスへの変更なし。

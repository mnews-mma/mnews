# 宝珠山桃花: カード⇔内訳バー勝敗数食い違いの調査(read-only)

## 結論(先出し)

- `computeMultiOrgRecord`(カード)と`computeMultiOrgRates`(4団体合算の内訳率)は**食い違っていない**。宝珠山桃花(`hoshuyama-momoka`)で直接呼び出して検証した結果、両者ともwins=7で完全一致した(`out/hoshuyama-card-bar-check.txt`)。
- 実際に食い違って見えるのは、選手ページ(`/fighters/hoshuyama-momoka`)の**戦績スタットカード2行目(4団体合算・正しい値)**と、その下に出る**「勝ち方と負け方」バタフライ図(`MethodButterfly`)**の勝数合計。バタフライ図は4団体合算を経由せず、`fighters.ts`直書きの1行目データ(`needsReview:true`、信頼性が既知で低い)を毎回再解析して出している。
- 原因は`computeMultiOrgRates`の分類ロジックの中に閉じていない。**`src/app/fighters/[slug]/page.tsx:676`が`MethodButterfly`に渡す`history`を、他の全表示箇所(スタットカード・対戦テーブル)と揃えず`displayHistory`(4団体合算後)ではなく生の`history`(1行目)のまま渡している**、page.tsx側の配線漏れが真因。
- 指示書の停止条件(「原因がcomputeMultiOrgRates側の分類ロジックに閉じないなら報告して停止する」)に該当するため、**修正はせず本レポートのみで停止する**。

## 1. slugと直接呼び出し結果

宝珠山桃花のslugは`hoshuyama-momoka`(`src/lib/fighters.ts:2782`)。

`computeMultiOrgRecord("hoshuyama-momoka", data)`と`computeMultiOrgBoutTable`/`computeMultiOrgRates`を直接呼んだ結果(`scripts/investigate-hoshuyama-card-bar-mismatch.ts`、生ログ`out/hoshuyama-card-bar-check.txt`):

```
card (record):    wins=7, losses=7, draws=2
breakdown (rates): ko=0, sub=3, decision=4  → 合計7
winRows.length: 7
```

内訳: shooto集計(`computeFighterShootoRecord`)がwins=7/losses=6/draws=2、pancrase集計(`computeFighterPancraseRecord`)がwins=0/losses=1/draws=0で、合算するとwins=7/losses=7/draws=2。**この2関数の間に矛盾はない**(bout単位の勝ち数え方は完全に同じ7件)。

## 2. 選手ページで実際に食い違って見える箇所

`src/app/fighters/[slug]/page.tsx`:

- L306-307: `fighter = resolveFighterCached(seed)` → `history`/`noRecordData`はここで**1行目(`data/fighterRecords.json`、実体は`fighters.ts`直書きのneedsReview値)に固定**され、以後再代入されない。
- L322-330: `multiOrgSummary`(4団体合算のrecord/rows/rates)を別途取得。
- L340-342: `hoshuyama-momoka`は`needsReview:true`かつ4団体合算に試合がある(`shouldPreferMultiOrgRecord`がtrue)ため`suppressNoRecordRow = true`。
- L602-623: `suppressNoRecordRow`により1行目のスタットカードは**非表示**。
- L635-662: 2行目(4団体合算、`multiOrgRecord`)のスタットカードが**wins=7-7-2**で表示される。ここは正しい。
- L676: `{!noRecordData && <MethodButterfly history={history} />}` — **`history`が1行目の生値のまま**。`noRecordData`ガードは通る(彼女は`noRecordData`ではなく`needsReview`のため)ので描画される。`MethodButterfly`は`computeMethodSplit(history)`で`history`をresult別に再フィルタ・再集計するため、**1行目のraw勝数(8勝)がそのままバタフライ図の合計に出る**。

結果、同じページ内で
- スタットカード2行目: 7-7-2(4団体合算、正)
- バタフライ図見出し「◯勝/◯敗」: 8勝/7敗(1行目raw、誤りを含む)

という食い違いが起きる。`displayHistory`(L368付近、multiOrgBoutRowsから作られる対戦テーブル用の変数)は既に4団体合算に揃っているが、`MethodButterfly`はこの`displayHistory`を使わず`history`をそのまま使っている。

## 3. 1件だけ挙動が違うbout(勝ち側の数え方)

1行目(`fighters.ts`)と4団体合算(`shootoRecords.json`)を突合すると、勝敗が食い違うboutは2件ある:

| 日付 | 相手 | 1行目(fighters.ts) | 4団体合算(shootoRecords.json) |
|---|---|---|---|
| 2024-08-03 | 高本千代(COLORS Produce by SHOOTO Vol.3) | **win**(判定 1-0) | **draw** |
| 2022-12-04 | 古賀愛蘭(TORAO28) | **loss**(判定 0-1) | **draw** |

このうち**勝ち側の数え方だけが食い違っている(=1行目でwinとカウントされ、4団体合算ではwinとカウントされない)のは2024-08-03の高本千代戦1件のみ**。TORAO28戦はloss→drawの食い違いで、勝ち側のカウントには影響しない(このbout単独では両者ともwinとして数えていない)。

### resultType / methodRaw / NC判定(実測)

`data/shootoRecords.json`の該当bout生データ:

```json
{
  "event": "COLORS Produce by SHOOTO Vol.3",
  "date": "2024-08-03",
  "fighterAName": "宝珠山 桃花",
  "fighterBName": "高本 千代",
  "resultType": "draw",
  "winnerName": null,
  "winnerSlug": null,
  "methodRaw": "判定 1-0",
  "noteRaw": "［レフェリー］出合 淳\n［サブレフェリー］\n片岡誠人 20-18（1R 10-9／2R 10-9）\n鍋久保雄太 19-19（1R 9-10／2R 10-9）\n浦 僚克 19-19（1R 9-10／2R 10-9）"
}
```

`resultType`は`"draw"`で、`NC`ではない。ジャッジスコアの内訳(`noteRaw`)を見ると、3人のレフェリーのうち1人(片岡誠人)が宝珠山寄りの20-18、残り2人(鍋久保雄太・浦僚克)が19-19の同点判定。これは**多数決ドロー(majority draw)**であり、`resultType: "draw"`という4団体合算側の判定は公式スコアカードと整合している。

一方`fighters.ts`側の直書き値(`result: "win"`)は誤り。指示書が懸念していた「ドローかNCが判定勝ちに分類されている」という方向とは逆で、**実際に間違っているのは4団体合算側ではなく1行目(fighters.ts手入力)側**であり、`computeMultiOrgRates`の分類ロジックには問題がない。

## 4. 同型の食い違いが他に何名いるか(全選手1回走査)

`page.tsx`と同じ条件(`noRecordData`でない・`suppressNoRecordRow`が成立する・カード=4団体合算wins、バー=生historyのwin合計)で全選手を1回走査した(`scripts/investigate-card-bar-mismatch-scan.ts`、生ログ`out/card-bar-mismatch-scan.txt`)。

**37名が同型の食い違いを持つ**(宝珠山桃花を含む)。差分は最小1件から最大24件まで様々(例: `motonomiki`はカード9勝・バー2勝で7件差、`fujino-emi`はカード16勝・バー31勝で15件差)。全件は`out/card-bar-mismatch-scan.txt`参照。

この37名という規模と、原因が単一箇所(`page.tsx:676`が`displayHistory`ではなく`history`を渡している)に閉じていることから、**個別bout修正ではなくpage.tsx側の配線修正で一括解消できる性質の不具合**と考えられる。ただし本調査の停止条件により、この修正自体は本PRのスコープ外とする。

## 受入条件との対応

- 宝珠山桃花でカードと内訳バーの勝敗数が一致 → **未達(現状把握のみ)**。原因はcomputeMultiOrgRates側ではなくpage.tsx側のため、指示書の停止条件に従い修正しない。
- 3の同型件数 → **37件**(0件にはできていない。原因はpage.tsx:676の配線漏れで、修正には`src/app/fighters/[slug]/page.tsx`の変更が必要)。
- `data/`無変更 → 満たす(read-only調査)。
- `rankings.json`差分ゼロ → 満たす(未変更)。
- tsc・build・test:mnews-rating 220件 → 別途実行し確認(下記)。

## スコープについて

指示書の停止条件「原因がcomputeMultiOrgRatesの分類ロジックに閉じないなら報告して停止する」に該当するため、`src/app/fighters/[slug]/page.tsx`の修正(MethodButterflyへの`displayHistory`渡し)はこのPRでは行わない。修正が必要な場合は別セッションで着手の要否を判断してください。

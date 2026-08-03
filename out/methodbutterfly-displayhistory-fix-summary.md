# MethodButterflyの参照元をヘッダー(displayHistory)に統一

#390の調査で判明した通り、選手ページ2行目スタットカード(4団体合算)と
「勝ち方/負け方」バタフライ図(`MethodButterfly`)が別ソースを見ていたため、
宝珠山桃花で7-7-2(カード)と8勝(バー)のように食い違って見えていた。

## 変更

`src/app/fighters/[slug]/page.tsx`:
- 対戦テーブル(#363・R-9)と同じ`displayHistory`(`suppressNoRecordRow`基準で
  1行目/4団体合算のどちらかに揃え済み)を`FightRecord`互換の形に詰め替えた
  `methodButterflyHistory`を追加し、`MethodButterfly`にはこちらを渡すよう変更。
- 新しい条件式は作らず、既存の`suppressNoRecordRow`/`displayHistory`をそのまま
  再利用(`.map()`による形変換のみ、`computeMultiOrgRecord`等の新規呼び出しは
  追加していない)。

## 検証: 37名→1名

修正前に37名該当していた「カードの勝ち数(4団体合算)とMethodButterflyの勝ち数
合計が食い違う」パターンを、修正後の`displayHistory`ベースで再走査した
(`scripts/verify-methodbutterfly-displayhistory-fix.ts`、
`out/methodbutterfly-displayhistory-fix-verify.txt`)。

```
Scanned (suppressNoRecordRow===true) fighters: 96
Mismatch count: 1
uehara-taira: card(multiOrg).wins=7 vs bar(displayHistory-based).winTotal=6 (rows=13, raw-history-len=14)
```

### 残り1件(uehara-taira)の理由

これは配線バグではなく、`tallyMethods`/`isUnknownMethod`(`src/lib/methodClassify.ts`)
の既存の意図的な仕様が原因。上原平の2023-07-23 PROFESSIONAL SHOOTO 2023 Vol.5
(vs CHAN 龍)は`headingText: "不戦 第1試合 ..."`・`methodRaw: ""`(対戦相手が
計量に現れず不戦勝)で、決着方法のテキスト自体が存在しない。`isUnknownMethod`は
空の`method`を「不明」と判定し`tallyMethods`の集計(KO/一本/判定/その他)から
除外する仕様(コード内コメント「集計から除外(捏造ゼロ)」)。

カード側の勝ち数(7)は勝敗のみをカウントするため不戦勝も1勝として数えるが、
バー側は「決着方法の内訳」であり、決着方法が存在しない不戦勝は内訳に計上しよう
がない(捏造ゼロ方針上、KO/一本/判定/その他のどれかに無理に振り分けることは
できない)。これは`displayHistory`統一とは無関係に、この選手固有のデータ属性
(不戦勝)によって必然的に生じる差であり、修正対象ではない。

## 検証結果

- [x] `./node_modules/.bin/tsc --noEmit` エラー無し
- [x] `npm run build` 成功
- [x] `npm run test:mnews-rating` 220/0
- [x] `data/` 無変更
- [x] `rankings.json` 差分ゼロ(未変更)
- [x] `npm run dev`でhoshuyama-momokaを実ブラウザ確認: カード「7-7-2」・バー
      見出し「7勝/7敗」で一致。対戦テーブルの高本千代戦・古賀愛蘭戦も「分」表示
      に修正されていることを確認(displayHistory側は元々ここが正しかった)。
- [x] `methodButterflyHistory`は既存計算済みの`displayHistory`を`.map()`で
      詰め替えるのみで、`computeMultiOrgRecord`/`computeMultiOrgRates`/
      `getMultiOrgSummaryCached`等の新規呼び出しは追加していない(集計回数・
      走査量は変更前と同じ)。

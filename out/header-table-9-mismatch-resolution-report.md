# 真の食い違い9名の決着(指示書M)報告

方針: recordOverrides.tsに型を追加せず、生成側(data/fighterRecords.jsonの集計値決定箇所)で
「infobox集計値とhistory実カウントが食い違う場合はhistory実カウントを採用」に変更。

## 1. 生成側の集計値の決定箇所(特定結果)

`src/lib/mnewsRating/recordOverrides.ts` の `applyRecordOverridesToTotals()`
(呼び出し元: `scripts/update-fighter-records.ts` の `toCacheEntry()`)。

**当初 `src/lib/feeds/wikipedia.ts` の `fetchJaWikiFighterRecord()`(infobox優先の
`...(totals ?? tally(history))`)を疑い一度そこを編集したが、実装検証の過程で
2つの副作用が判明したため差し戻した**(詳細は3節):
1. `tally()`の決着方法分類が英語表記専用で、日本語historyのmethodテキストでは
   ko/sub/decisionが崩れる(全員0付近に潰れる)
2. `wikipedia.ts`のtally()はrecordOverridesのadd/remove適用**前**の生historyに対して
   動くため、既存のremove型override(ケイト・ロータス等)の前提(「表には出さないが
   集計はinfobox通り」)と二重にズレる

最終的な修正箇所は `recordOverrides.ts:1364-1379`(`applyRecordOverridesToTotals`の末尾)。
既存のinfobox/add型ロジックで得たtotals `t` とは別に、recordOverrides適用後の
補正済みhistoryから`deriveTotalsFromHistory()`で実カウントし、**wins/losses/drawsが
食い違う場合だけ**実カウント側で置き換える。一致する場合は`t`をそのまま返すため、
add型のtotalsAlreadyReflected・isNc(計量オーバー裁定)等の既存ガードは無効化されない。
`wikipedia.ts`自体は無変更(コメント追記のみ)。

## 2. 対象9名(当初8名から1名追加)

検証(「未確認: infoboxとhistoryが一致している選手が実カウント方式で本当に不変か」)の
過程で、当初の8名以外に**大原樹理(ohara-juri, DEEP)**も同じ現象を抱えていることが
判明し、ユーザー判断により対象を9名に拡大した。

### 2-1. 大原樹理が指示書Lのスキャンで見逃されていた原因

`scripts/scan-header-table-mismatch.ts:110` の `breakdownMismatch` 判定が
`countDiff === 0`(合計件数が一致する場合)のみ内訳(W/L/D個別)をチェックしており、
大原樹理のように**合計は一致するが勝敗が1件ずつ入れ替わっている**ケース
(生wikitext実カウント: 39勝20敗2分3NC、infobox: 38勝21敗2分3NC。合計64は一致)を
「NC説明可能(無害)」に誤分類していた。`countDiff`の値によらず常にW/L/D個別比較する
`scripts/rescan-header-table-mismatch-strict.ts` を新規作成し全365名を再走査した結果、
**新たな誤分類は大原樹理以外に無い**ことを確認した(再スキャンで新規に見つかった選手は0名)。

## 3. 修正前後の全365名 wins/losses/draws 突き合わせ

`data/fighterRecords.json` を9名分だけ `--slug=<slug>` で個別に焼き直し(住村竜市朗は対象外)、
修正前後の全365エントリをJSON突き合わせした。

**変化したのは以下9名のみ、他356名は完全無変化(byte-identical)。**

| 選手 | 修正前(W-L-D, ko-sub-dec) | 修正後(W-L-D, ko-sub-dec) |
|---|---|---|
| 所英男(tokoro-hideo) | 36-34-1 (6-21-9) | 33-29-1 (5-19-9) |
| 関鉄矢(seki-tetsuya) | 18-11-1 (9-3-6) | 16-11-1 (8-2-6) |
| リー・カイウェン(lee-kaiwen) | 16-8-0 (9-1-6) | 15-8-0 (8-1-6) |
| 宇野薫(uno-caol) | 35-23-5 (3-18-14) | 35-24-5 (2-19-14) |
| 杉山しずか(sugiyama) | 23-8-1 (6-6-11) | 24-8-1 (6-6-12) |
| 佐藤将光(sato-shoko) | 38-17-2 (20-4-14) | 37-17-2 (19-4-14) |
| 魚井フルスイング(uoi-fullswing) | 27-16-4 (12-2-13) | 26-17-4 (12-1-13) |
| 三宅輝砂(miyake-kisa) | 14-5-0 (6-3-5) | 13-6-0 (6-3-4) |
| 大原樹理(ohara-juri) | 38-21-2 (21-2-12) | 39-20-2 (21-5-13) |

## 4. NC説明可能41名(大原樹理を除く)の無変化確認

再スキャン(`scripts/rescan-header-table-mismatch-strict.ts`)で「table_more_nc_explained」
(無害)に分類される41名(修正前の39名から、大原樹理が「真の食い違い」側から
こちら側へ移動した影響で+2名。中身は既存39名+佐藤将光+大原樹理)について、
修正前後で該当41名のwins/losses/drawsが変化していないことを diff スクリプトで確認済み
(3節の「他356名は完全無変化」に含まれる)。

## 5. ヘッダー・テーブル・決着内訳バーの3つの一致(9名実測)

`historyReconciles()` を9名全員に対して実行した結果、**全員 `true`**(修正前は
9名とも `false` で決着内訳バー=MethodButterflyが非表示だった)。

| 選手 | ヘッダー(1行目) | テーブル(history再カウント) | 一致 |
|---|---|---|---|
| 所英男 | 33-29-1 | 33-29-1(63行) | ✅ |
| 関鉄矢 | 16-11-1 | 16-11-1(28行) | ✅ |
| リー・カイウェン | 15-8-0 | 15-8-0(23行) | ✅ |
| 宇野薫 | 35-24-5 | 35-24-5(64行) | ✅ |
| 杉山しずか | 24-8-1 | 24-8-1(33行) | ✅ |
| 佐藤将光 | 37-17-2 | 37-17-2(57行) | ✅ |
| 魚井フルスイング | 26-17-4 | 26-17-4(47行) | ✅ |
| 三宅輝砂 | 13-6-0 | 13-6-0(19行) | ✅ |
| 大原樹理 | 39-20-2 | 39-20-2(64行) | ✅ |

決着内訳バー(MethodButterfly)は`displayHistory`をそのまま渡して内部で
`classifyMethodJa`(tallyMethods)により再分類する設計であり、ヘッダーの
勝率/フィニッシュ率(`calcFighterRates`)も`historyReconciles()===true`の場合は
同じ`tallyMethods`にフォールバックする設計(2026-07-20修正、既存)。
そのため`historyReconciles`がtrueになった時点で、ヘッダー・テーブル・決着内訳バーは
**構造的に同一データソース(history)・同一分類器(classifyMethodJa)から導出され
一致することが保証される**(fighterRecords.json側に保存されたko/sub/decisionの粗い値
=`deriveTotalsFromHistory`の分類とは別経路であり、表示側はそちらを使わない)。

## 6. rankings.json 無変更確認

```
md5(修正前) = 28503f985f51f163ced0173e0feb191b
md5(修正後) = 28503f985f51f163ced0173e0feb191b
diff: 完全一致
```

RIZIN限定のランキング/Elo集計(`rizinRecordsAggregate.ts`)は`rizinRecords.json`
(公式ソース)から独立に導出されており、本PRが変更した「通算戦績」
(`fighterRecords.json`のwins/losses/draws)を入力にしていないため、無変更は
設計上も整合する。

## 7. 波及確認(次戦カード・meta title・OG画像・一覧カード・ランキング入力)

コード上の経路監査により、以下が全て`fetchFighterRecords()`(GitHub raw経由の
`data/fighterRecords.json`取得)→`mergeFighterRecord`/`resolveFighterCached`という
**単一の経路**を共有していることを確認した(個別の重複計算・別ソース参照は無い):

- 次戦カード: `resolveDisplayRecordCached`→`resolveFighterCached`(2026-08-03の対戦カード相手側修正PR#417と同じ経路)
- meta title/description: `generateMetadata()`内の`resolveFighterCached(seed)`
- OG画像(`/api/og/fighter/[slug]`): `resolveFighterCached`
- 選手一覧カード(`/fighters`): `getVisibleFighters()`内の`fetchFighterRecords()`
- ランキング入力: 対象外(6節参照。rizinRecords.json由来で本ファイルと無関係)

ローカル`npm run start`での実機確認は行っていない
(`feedback_local_verify_github_raw_fetch.md`記載の既知の制約通り、ローカル起動でも
`fighterRecordsCache.ts`はGitHub raw(mainブランチ)経由でdata/fighterRecords.jsonを
取得するため、本ブランチ未マージの間はローカルサーバーで確認しても常に修正前の
値が表示される。実際に確認しようとしたところ所英男のページタイトルが
「戦績36勝34敗1分」(修正前の値)のままであることで再現・原因を特定した)。
上記の経路監査(コードリーディングによる単一ソース確認)と3〜5節のデータ層での
実測で代替した。マージ後の本番デプロイ後に主要な波及先ページの表示確認を行う。

## 8. tsc/build

`npx tsc --noEmit -p .`: エラーなし
`npm run build`: 成功(全ルートのビルド完了)

## 9. 残件

- **住村竜市朗(sumimura-ryuichiro)**: 裏取り未了のため本PRでは触っていない。
  `history`が空(Wikipedia記事に{{Fight-cont}}無し)のため、本PRの修正ロジック
  (history非空の場合のみ実カウントを優先)の影響も受けない。指示書Lで報告された
  「ヘッダー27-8-1 / テーブル(実体は4団体合算フォールバック)19-6-1」の食い違いは
  未解決のまま残る。
- 再スキャン(内訳まで見る厳密版)で大原樹理以外の新規誤分類は0名だった。
  追加調査は不要と判断する。

## 出力ファイル

- [scripts/rescan-header-table-mismatch-strict.ts](../scripts/rescan-header-table-mismatch-strict.ts)
- [out/rescan-header-table-mismatch-strict.json](rescan-header-table-mismatch-strict.json)

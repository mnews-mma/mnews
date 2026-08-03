# 日次バッチによる非プロ/非MMA bout除外の巻き戻り 実測・修正記録(指示書⑤)

## 1. 巻き戻りの構造的原因

`.github/workflows/update-org-records.yml` は生スクレイパー
(`build-shooto-records.ts`・`build-pancrase-records.ts`)を実行して直接commitしており、
`scripts/filter-nonpro-bouts.ts` を一度も呼んでいなかった。このため日次実行のたびに
過去の除外PR(#265/#268/#269)による除外が再混入し、`data/shootoRecords.json`・
`data/pancraseRecords.json` が未フィルタ相当に戻っていた。

RIZIN(`scripts/update-rizin-records.ts`)・DEEP(`scripts/build-deep-records.ts`)は
このバッチと同じ構造上の問題を持たない。両スクレイパーは `isExcludedNonProBout()` を
取得処理の内部(inline)で直接呼んでおり、独立の後処理フィルタステップに依存しないため。

## 2. 巻き戻りbout件数の実測(着手前・main HEAD時点)

`npx tsx scripts/filter-nonpro-bouts.ts --dry-run` / `npx tsx scripts/filter-deep-futureking-bouts.ts --dry-run` の実行結果、および `data/rizinRecords.json` への直接走査で確認。

| 団体 | 巻き戻り件数 | 内訳 |
|---|---|---|
| RIZIN | **0件** | inline除外のため巻き戻りなし。全1039boutを`classifyNonProBout()`で走査し非該当を確認(1件「ジュニア・タファ」戦がキーワード部分一致したが、対戦相手の実名であり実際のアマ/キッズ試合ではない誤検知。詳細は5節) |
| 修斗 | **190件**(2158→1968) | non_mma_karate 65 / non_mma_kids_shooto 64 / non_mma_submission_only 7 / not_pro_amateur 21 / not_pro_tryout 33 |
| パンクラス | **43件**(4877→4834) | not_pro_amateur 7 / not_pro_cage_gate 36 |
| DEEP | **0件**(2470→2470) | フューチャーキングトーナメントのbout混入なし(inline除外が機能しているため) |

合計 **233bout** が巻き戻っていた(修斗190 + パンクラス43)。

## 3. 影響選手数の実測

`src/lib/mnewsRating/multiOrgRecord.ts` の `computeMultiOrgRecord()`(選手ページ2行目と同じ集計ロジック)を使い、修斗/パンクラスに登場する全245slugについて除外前後の4団体通算戦績を比較した。

- **4団体通算の勝敗数が変化する選手: 17名**
  `uno-caol` `sekiguchi-yuto` `saito-tsubasa` `tsuruya-rei` `sugimoto-megumi`
  `nakaike-takehiro` `sasaki-shunma` `susung` `shikijima-kazuma` `takada-atsuhi`
  `goto-ryo` `noel` `okada-arashi` `noa-tokumoto` `mio-shiyama` `katayama-tomoe`
  `yamaguchi-satoshi`
- **4団体通算が0-0-0化する選手: 0件**(停止条件に非該当)

## 4. rankings.json / 選手ページへの波及確認

- `scripts/update-mnews-rating.ts`(`data/rankings.json`生成元)は `data/rizinRecords.json` のみを読み、`shootoRecords.json`/`pancraseRecords.json`/`deepRecords.json` を一切参照しない(grep実測で確認)。RIZINの巻き戻りは0件のため、**rankings.jsonに差分は出ない**(停止条件に非該当)。
- 選手ページ1行目・2行目・チャート:上記17名で`computeMultiOrgRecord()`が参照する`data/shootoRecords.json`・`data/pancraseRecords.json`が変わるため反映される(除外を再適用する本来の状態に戻るだけで、新規の除外基準は導入していない)。
- `/methodology/records`:「アマチュア大会は含みません」の既存記述の範囲内。文言変更不要(#406と同じ結論)。

## 5. RIZIN/DEEPを恒久ゲートの対象にしなかった理由

`classifyNonProBout()` はheadingText/strapTitle/noteRaw/namedDivisionの全文字列(haystack)を対象に部分一致でキーワード判定する。RIZIN.40「スダリオ剛 vs. ジュニア・タファ」戦は対戦相手の実名「ジュニア・タファ」が `non_mma_kids_shooto` のキーワード「ジュニア」に部分一致し、実際にはプロの通常対戦であるにもかかわらず除外対象と誤判定される。

RIZIN/DEEPのスクレイパーはこの誤検知を避けるため、判定対象フィールドを意図的に絞っている(RIZIN: `noteRaw`のみ、DEEP: `weightClassRaw`/`eventName`のみ)。このため`scripts/check-nonpro-bout-gate.ts`は修斗/パンクラスの2団体のみを対象にした(RIZIN/DEEPに同じフルhaystack判定を適用すると上記の誤検知で常時ゲートが落ち、日次バッチが恒久的に赤くなる)。RIZIN/DEEPの実際の巻き戻りは2節の実測のとおり0件であり、ゲート対象外にしても実害はない。

## 6. 修正内容

1. `.github/workflows/update-org-records.yml`: スラグbackfill後・bout数比較前に以下2ステップを追加
   - `Filter non-pro/non-MMA bouts (Shooto/Pancrase)`: `npx tsx scripts/filter-nonpro-bouts.ts`(dry-runなしの実行)
   - `Check non-pro bout exclusion gate`: `npx tsx scripts/check-nonpro-bout-gate.ts`
2. `scripts/check-nonpro-bout-gate.ts`(新規): 修斗/パンクラスのdata/内に非プロ/非MMA boutが1件でも残っていたら`exit 1`する恒久ゲート
3. `data/shootoRecords.json`・`data/pancraseRecords.json`: `filter-nonpro-bouts.ts`を実行し、巻き戻っていた233boutを除外し直した(既存の除外基準の再適用のみ。新規カテゴリの追加はしていない)

他の書き込み経路(手動スクリプト等)の同種の穴の有無:`build-shooto-records.ts`・`build-pancrase-records.ts` を呼んでいるのは `update-org-records.yml` のみ(grep実測、他のworkflow・scriptからの参照なし)。したがって本ジョブの修正のみで巻き戻り経路を塞げる。

## 7. 検証結果

- `npx tsx scripts/filter-nonpro-bouts.ts` を2回連続実行し、2回目の出力(`data/shootoRecords.json`・`data/pancraseRecords.json`)が1回目とbyte完全一致することを確認(冪等性)
- `npx tsx scripts/check-nonpro-bout-gate.ts`:除外済みの現状データでは`exit 0`。パンクラスへ「アマチュア新人戦 第1試合」という見出しのboutを1件人為的に混入させたところ`exit 1`で検知することを確認(検証後は混入データを復元済み)
- `tsc --noEmit`:エラー0件
- `npm run build`:成功(exit 0)
- `npx tsx scripts/test-mnews-rating.ts`:220件成功/0件失敗
- `git status`で`data/rankings.json`・`data/rizinRecords.json`・`data/deepRecords.json`が無変更であることを確認

### 実行時間の増分(実測)

追加した2ステップ(`filter-nonpro-bouts.ts`・`check-nonpro-bout-gate.ts`)をローカルで実行した所要時間:
- `filter-nonpro-bouts.ts`: 約0.4秒
- `check-nonpro-bout-gate.ts`: 約0.3秒

いずれもデータ読み込み+配列走査のみで外部通信を行わないため、GitHub Actions上でもnpx/tsxの起動オーバーヘッドを含めて数秒程度の増分に収まる見込み。既存バッチの実測実行時間(中央値8.5分・最大13.8分、CLAUDE.md記載)に対して無視できる増分。

**注記**: GitHub Actionsの`workflow_dispatch`(`dry_run: true`)を実際にトリガーしての検証は行っていない(4団体公式サイトへの実スクレイピングを伴い、CLAUDE.mdの「トークン消費が大きい作業は対象を絞る」方針および無用な外部サイトアクセスを避けるため)。本PRが変更したのはfetch後のフィルタ/ゲート工程のみで、fetch自体のロジックは変更していないため、現在のcommit済みdata(実際にfetchされた結果と同型)を入力にローカルで新ステップの冪等性・ゲート動作を検証した。

### 波及していないことの確認

- `data/rizinRecords.json`・`data/deepRecords.json`:無変更
- `data/rankings.json`:無変更
- ページ側の毎リクエスト計算量:変更なし(ビルド時データ生成の変更のみ)

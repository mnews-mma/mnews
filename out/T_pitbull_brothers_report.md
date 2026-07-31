# ピットブル兄弟の分離(指示書T)

## 1. patricky-pitbullへのalias追加・解決確認

`src/lib/fighters.ts`の`patricky-pitbull`エントリに以下2件を追加:
- `パトリッキー・"ピットブル"・フレイレ`(data/rizinRecords.json内の実際の生表記、カーリー引用符)
- `パトリッキー・フレイレ`(表記ゆれの保険)

`scripts/backfill-rizin-slugs.ts`を実行し、RIZIN.19/RIZIN.20の3boutが解決したことを確認:

| 大会 | 日付 | 対戦相手 | 勝敗 |
|---|---|---|---|
| RIZIN.19【1回戦】 | 2019-10-12 | 川尻達也 | 勝 |
| RIZIN.20【準決勝】 | 2019-12-31 | ルイス・グスタボ | 勝 |
| RIZIN.20【決勝】 | 2019-12-31 | トフィック・ムサエフ | 敗 |

`computeMultiOrgRecord("patricky-pitbull", ...)`: `{wins:1,losses:2,draws:0}` →
`{wins:3,losses:3,draws:0}`(RIZINのみ集計。Wikipedia通算25-16-0との残差はBellator/PFL/ADXC等
4団体外の実戦歴によるもので、想定どおり解消しない)。

## 2. パトリシオ・ピットブル(実兄)の扱い

`src/lib/fighters.ts`に**未登録**であることを確認した(grep 0件)。ユーザーの確認通り、
パトリシオ・フレイレ(フェザー級)とパトリッキー・フレイレ(ライト級)は実の兄弟で別人。
**同一エントリへのマージは行っていない**(fighters.tsのpatricky-pitbullエントリは
パトリッキー本人の情報のみ)。

`data/rizinRecords.json`内の未解決bout(2件、いずれも生表記「パトリシオ・ピットブル」):

| 大会 | 日付 | 対戦相手 | 勝敗 | 決着 |
|---|---|---|---|---|
| 湘南美容クリニック presents RIZIN.40 | 2022-12-31 | クレベル・コイケ | 勝 | 3R判定(0-3) |
| のむシリカ presents 超RIZIN.2 powered by U-NEXT | 2023-07-30 | 鈴木千裕 | 敗 | 1R 2分32秒 KO(スタンドパンチ) |

登録の是非(選手DB収録基準の判断)は本PRのスコープ外のため実施していない。

## 3. 検証

- `npx tsc --noEmit`: パス
- `npm run build`: パス、139ページ生成成功
- `npm run test:mnews-rating`: 220件成功/0件失敗
- ローカル`next start`で主要ページ200確認: `/`・`/fighters`・
  `/fighters/patricky-pitbull`・`/events`・`/results`・`/rankings`

## ベースライン更新

`scripts/check-null-slug-baseline.ts`のRIZINベースラインを1103→1100に更新
(他団体は変化なし)。

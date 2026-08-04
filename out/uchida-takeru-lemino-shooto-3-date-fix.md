# uchida-takeru「Lemino修斗.3」試合日誤りの訂正(残件1)

PR#431 で入れた日付ガード(bout日付と結果ページ開催日の±1日一致を要求)が検出した
唯一の「大会名は一致するのに日付だけずれている」bout。上流(Wikipedia戦績表)の
試合日が誤っていた。

## 事実

| 項目 | mnews側(data/fighterRecords.json) | 修斗公式 |
|---|---|---|
| 大会名 | Lemino修斗.3 | Lemino修斗.3 |
| 開催日 | **2026-02-28** | **2026-02-18** |
| 会場 | (保持せず) | 後楽園ホール |
| 階級 | (保持せず) | バンタム級 |
| 対戦相手 | **青井真司** | **青井心**(ニ心技館) |
| 結果 | win | 内田タケルの勝利 |
| 決着 | 1R 1:28 腕ひしぎ十字固め | 1R 1:28 腕十字固め |

出典: https://www.shooto-mma.com/result/?id=260 (取得日 2026-08-04)

決着方法・ラウンド・時間が完全一致するため同一試合と特定できる。
`src/lib/eventResults.ts` の `lemino-shooto-3` エントリ(2026-02-18、後楽園ホール)にも
`{weightClass:"バンタム級", fighterA:"青井心", fighterB:"内田タケル", winner:"内田タケル",
method:"腕十字固め", round:"1R 1:28"}` として同じ試合が入っており、公式と一致している。

## 訂正した範囲

`src/lib/mnewsRating/recordOverrides.ts` に `patch-date` を1件追加し、
**日付のみ** 2026-02-28 → 2026-02-18 に訂正した。

## 訂正しなかったもの: 対戦相手名「青井真司」

公式表記は「青井心」だが、本PRでは**訂正していない**。

- `recordOverrides.ts` に相手名だけを訂正する型が存在しない
  (`add` / `remove` / `patch-weight-class` / `patch-date` / `patch-result` / `patch-method` のみ)
- `remove` + `add` で消して足し直すことはしない。訂正の由来(どのboutを何の根拠で
  どう直したか)が追えなくなるため
- 相手名の差異そのものは表示上の軽微な問題にとどまり、日付ガード・リンク解決・
  レーティングのいずれにも影響しない(オーバーライドの突合キーが
  `date + opponent` であるため、**今後この選手のこのboutを他の型で訂正する場合は
  キーとして「青井真司」を使う**点にだけ注意)

`patch-opponent` 型を追加するかどうかは別途判断とする。同種の事例が他にどれだけ
あるかは未調査。

## 検証結果(いずれも read-only、data/ は未変更)

`scripts/verify-uchida-lemino3-date-fix.ts` / `scripts/verify-uchida-lemino3-rating-impact.ts`

| 受入条件 | 結果 |
|---|---|
| 1. 当該boutの日付 | 2026-02-28 → **2026-02-18** |
| 2. リンク総数 | 577 → **578**(+1) |
| 3. 「大会名一致・日付ずれ」でリンクを見送ったbout | 1件 → **0件** |
| 4. レーティング算出結果(rankings.jsonの生成元) | **完全一致(差分ゼロ)**。bout総数578→578、掲載エントリ162→162 |
| 副作用 | bout総数 4849 → 4849、変化した行は当該1行のみ |

レーティングに影響が出ない理由: mnewsレーティングの `buildBouts()` はRIZIN MMA bout
のみを対象とするため、修斗のこのboutは元々Eloの計算対象に入っていない。ただし
「入っていないはず」で済ませず、`update-mnews-rating.ts` と同じ順序・同じパラメータ
(ELO_PARAMS_V5 / INITIAL_RATING_BOOST_PARAMS_V6 / DECAY_PARAMS_V6、asOf固定)で
訂正前後の算出結果を突き合わせて実測した。

## 重要: この訂正がサイトに出るのは次回の日次バッチ実行後

`recordOverrides.ts` は**リクエスト時に効くコード層ではない**。
`applyRecordOverrides()` の呼び出し元は `scripts/update-fighter-records.ts` のみで、
これは `.github/workflows/update-fighter-records.yml`(nominal JST 2:30、実起動は
中央値3.27時間遅延)が `data/fighterRecords.json` を再生成するときに適用される。
選手ページは `fighterRecordsCache.ts` の `RAW_URL`
(`raw.githubusercontent.com/.../main/data/fighterRecords.json`)を読むだけなので、
**本PRのマージ直後は日付が2026-02-28のままである**。

したがって上記の受入条件1〜4は、バッチと同じ `applyRecordOverrides()` を現行の
`data/fighterRecords.json` に当てて「バッチ実行後の姿」を再現したうえで実測している。

実機確認も同じ方法で行った(ローカルのみ `RAW_URL` を一時的にローカルスタブへ
向け、確認後に元へ戻してコミットには含めていない):

```
対戦テーブル : 2026-02-18  LINK /results/lemino-shooto-3   Lemino修斗.3
ページ全体の "2026-02-28" 出現回数 : 0
ページ全体の "2026-02-18" 出現回数 : 2
ヘッダー集計(通算戦績) : 9-2-0(変化なし)
meta description / og:description / og:title : 日付を含まず、古い日付の残留なし
/api/og/fighter/uchida-takeru : 200 image/png
```

## 申し送り

次回 `update-fighter-records.yml` の実行完了後に、本番 `/fighters/uchida-takeru` で
次を確認すること:

1. 「Lemino修斗.3」の行が **2026-02-18** になっている
2. その行に `/results/lemino-shooto-3` へのリンクが付いている
3. `npm run check:event-slug-links` の「大会名は一致するが開催日がずれてリンクを
   見送ったbout」が **0件** になっている(1件のまま残っていればバッチにオーバーライドが
   効いていない)

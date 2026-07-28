# RIZIN戦績除外ロジックの再設計(#240の続き・女子MMA誤除外の修正)

作業日: 2026-07-28。#243で発見した「RENAの女子MMA戦が誤除外される」問題の修正。#240で確立した「除外は積極的にMMA以外と判定できたときだけ」という原則が、`ruleType !== "MMA"`という厳密一致のままだったため実質的に貫徹できていなかった穴を塞ぐ。#240の続きとして扱う。

## 1. `data/rizinRecords.json`実在のruleType全件列挙

修正着手前に、既存1004試合の`ruleType`を全件集計した。

| ruleType | 件数 |
|---|---|
| MMA | 777 |
| キックボクシング | 148 |
| その他 | 44 |
| unknown | 28 |
| 女子MMA | 5 |
| シュートボクシング | 1 |
| グラップリング | 1 |

7種類のみ存在。「女子MMA」(5件、いずれも手動書き起こし分=RIZIN.1に2件・RIZIN.2に3件。自動スクレイパー(`parseRuleInfo`)はこの値を生成しない)以外に、これまで気づかれていなかった複合ラベルは見つからなかった。

## 2. 修正内容

`src/lib/mnewsRating/rizinRecordsOverride.ts`の`applyRizinRecordsToHistory()`で、`match.ruleType !== "MMA"`という厳密一致による除外を、非MMAと積極的に判定できる値のみを名指しするdenylistに変更した。

```ts
const CONFIRMED_NON_MMA_RULE_TYPES = new Set<string>(["キックボクシング", "シュートボクシング", "グラップリング", "その他"]);
...
if (CONFIRMED_NON_MMA_RULE_TYPES.has(match.ruleType) || match.resultType === "cancelled") {
  excludedCount++;
  continue;
}
```

`"MMA"`・`"女子MMA"`はいずれもdenylistに含めていない(=除外されず、通常のMMA戦としてWikipedia側の記録を上書きする対象になる)。将来ここに無い新しいラベルが現れた場合も、名指しされていない限り誤って除外されない設計にした(不明なラベルを機械的に「非MMA」と決めつけない)。

`ruleType==="unknown"`(#240で導入済み)の扱いは変更していない(引き続き除外もWikipedia上書きもせず温存)。

## 3. 戦績が変化する選手(全件・実測)

`data/fighterRecords.json`の全139名分(mnewsレーティングエンジンが内部で追跡する全選手)について、修正前後の`buildDisplayEntries()`出力(wins/losses/draws/fights)を実際にエンジンを2回実行(修正前コード・修正後コード)して突き合わせた。

**戦績が変化した選手は1名のみ: RENA(rena)。**

| 選手 | 修正前 | 修正後 |
|---|---|---|
| RENA(rena) | 14-4-0(18戦) | 15-4-0(19戦) |

変化した試合はRIZIN.2(2016-09-25)の第12試合(山本美憂×RENA、RENA勝利)。これまで`ruleType="女子MMA"`のため除外されていたが、除外対象から外れWikipedia側の記録(win)がそのまま採用された。

他138名は`wins`/`losses`/`draws`/`fights`のいずれも1件も変化していないことを確認した(女子MMA5件のうちRENA以外の4件・7名分の対戦相手はいずれも自社DBに未解決のため無影響)。

停止条件「戦績が変化する選手が10名を超えた」には**非該当(1名)**。

## 4. AI RIZINランキングの差分

全5階級(フライ級・バンタム級・フェザー級・ライト級・ヘビー級)で**新規掲載・掲載外れ・順位移動、いずれも0件**。RENAは現状どの階級ランキングにも掲載されていないため、この修正はランキング表示には一切影響しない(内部の戦績集計のみ正確になった)。

## 5. 検証結果

| チェック | 結果 |
|---|---|
| `update-mnews-rating.ts --mode=data-correction` 2回実行の決定性 | 一致(`updatedAt`以外完全一致) |
| `check-h2h-invariant.ts`(必達不変条件・H2H違反) | PASS(全階級で違反0件、必達不変条件チェック違反0件) |
| `check:fighter-records`(整合チェック) | OK(fatal 0件、warning 14件=既存の無関係な警告、本修正前と同数) |
| `check:rankings-slugs` | OK |
| `check:rizin-weightclass` | OK(fatal 0件) |
| `tsc --noEmit` | エラーなし |
| `npm run build` | 成功 |

## 6. 変更ファイル

- `src/lib/mnewsRating/rizinRecordsOverride.ts`: 除外判定をdenylist方式に変更
- `data/rankings.json`・`data/rankings.prev.json`: 再生成(内容は`updatedAt`のみ変化、RENA非掲載のため表示上の差分なし)
- `data/rizinRecords.json`: **無変更**(このタスクはロジック修正のみで、rizinRecords.json自体は#243の状態のまま)
- `data/fighterRecords.json`: 無変更

## 7. スコープ外として明記する未検証事項

`その他`(44件)は今回のdenylistに引き続き含めた(既存の除外挙動を変更していない)。ただし過去に1件、超RIZIN.2(パトリッキー・ピットブル×ホベルト・サトシ・ソウザ)で「その他」タグが実際にはMMA戦だった誤タグ付けが発覚しピンポイント訂正した実績がある(`RIZIN_RECORDS_RULE_TYPE_OVERRIDES`参照)。今回、44件の「その他」全件について同様の誤タグ付けが他に無いかの悉皆監査は行っていない(本タスクの指示は「女子MMAの実害確認とdenylist化」であり、「その他」タグ全件の正確性監査はスコープ外と判断した)。将来的に必要であれば別タスクとして切り出すことを推奨する。

## 停止条件の該非

- 戦績が変化する選手が10名を超えた → **非該当(1名)**
- 必達不変条件が1つでも破れた → **非該当**

いずれの停止条件にも該当せず、手順を完走した。マージ可否は人間の判断に委ねる。

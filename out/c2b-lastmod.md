# C-2b: sitemapのVSルートlastmod修正

## C-2b-1: EVENTS側のフィールド確認(着手前)

[src/lib/events.ts](../src/lib/events.ts) `MEvent`インターフェース(27-47行目)を確認した。

| 候補フィールド | 有無 |
|---|---|
| カード発表日(announced_at相当) | **無い**(`MEvent`に該当フィールドなし) |
| イベント日 | **有る**(`date: string` フィールド、`YYYY-MM-DD`) |
| データ更新日時(updatedAt相当) | EVENTS自体には無いが、選手戦績データ側に実在する(`data/fighterRecordsMeta.json`の`generatedAt`。`fetchFighterRecordsGeneratedAt()`、[src/lib/fighterRecordsCache.ts:51](../src/lib/fighterRecordsCache.ts)。既に`/fighters`・`/ranking/undefeated`ページの「データ最終更新」表示で使われている実データ) |

指示書の分岐(「発表日がある→それを使う」「無いがイベント日がある→イベント日を使う」)に厳密に従うと**イベント日を使う**分岐になる。ただし実装時に以下の問題が判明したため、イベント日単体では済まなかった(詳細は次項)。

## 実装内容・分岐の詳細

[src/app/sitemap.ts](../src/app/sitemap.ts)のVSルート生成部分を変更した。

```ts
const matchup = findMatchupEvent(fA.nameJa, fB.nameJa);
const eventDate = matchup?.event.date;
const lastModified =
  eventDate && eventDate <= TODAY ? eventDate : (fighterRecordsUpdatedAtJst ?? TODAY);
```

**イベント日をそのまま使えなかった理由**: `findMatchupEvent`は`getUpcomingEvents()`(status: upcoming/live)のみを見るため、ヒットする`event.date`は**ほぼ必ず未来日**になる。C-2b-3で明示されている検証項目「lastmodが未来日にならないこと」に抵触するため、`eventDate <= TODAY`の場合のみ採用し、それ以外(未来日のイベント、または実カード自体が無いペア)は選手戦績データのバッチ生成時刻(`fighterRecordsUpdatedAtJst`)にフォールバックする設計にした。バッチ生成時刻も取得できない場合のみ、捏造を避けるため従来通り`TODAY`にフォールバックする(3段フォールバック)。

日付整形は`eventCountdown.ts`の`toJstDateStr()`経由(バッチのISO日時→JST暦日変換)。`event.date`自体は既存の`resultRoutes`/`eventRoutes`と同じくYYYY-MM-DD文字列をそのまま渡しており、`new Date()`での再パースは行っていない(PR-Fゲート対象パターンに抵触しない)。

## 検証結果(実データ、2026-07-26実行時点)

- `TODAY`: `2026-07-26`
- `fighterRecordsGeneratedAt`(バッチ生成時刻、raw): `2026-07-21T15:35:00.109Z`
- `fighterRecordsUpdatedAtJst`(JST変換後): `2026-07-22`
- index対象ペア数合計: **2,486件**(C-2aで実カード追加後の数と一致)
  - `event.date`採用(未来日でない実カード): **0件**(現時点で登録されている実カードは全て未来日のため。将来、大会当日にstatus=liveのカードが発表されれば採用されうる設計)
  - フォールバック(戦績バッチ日時 `2026-07-22`)採用: **2,486件**(全件)
  - `TODAY`への最終フォールバック(バッチ日時取得も失敗した場合): 0件
- **旧実装との比較**: 旧実装は2,486件全てが実行のたびに変動する`TODAY`(例えば明日実行すれば`2026-07-27`)だった。新実装は2,486件全てが**実際のバッチ実行日である`2026-07-22`という固定値**になる(バッチが次回実行されるまで変わらない)。「毎日必ず変わる」から「実際にデータが更新された日にのみ変わる」への転換を実現した。
- lastmodが未来日になっていないことを確認: 上記の通り`event.date`分岐が採用された件数は0件(未来日は全て除外されフォールバックに回った)ため、今回のデータでは未来日が出力される経路自体が発火しなかった。将来的に採用されるケース(`event.date <= TODAY`)は定義上未来日になり得ない。
- **2回生成して完全一致**: 同一スクリプトを2回実行し、出力全体のハッシュ(md5)が完全一致することを確認した(`f14a2229889def7ad978bc16b0d02675`)。

## 見送った項目

- なし(C-2b-1〜C-2b-3の全項目を実施)。

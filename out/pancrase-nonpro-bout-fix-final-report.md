# パンクラス非プロbout除外 恒久修正 — 完了報告

ブランチ: `investigate/ushiku-juntaro-record-display` / PR #443(このトラックの最終報告)

## 1. 実装(1つの入口に統一、パターンごとの特別扱いなし)

`nonProBoutFilter.ts`の`classifyNonProBout()`という**単一の判定関数**に、判定材料として渡すフィールドを増やす形で統一した(判定ロジック自体の分岐は増やしていない)。

1. **`src/lib/mnewsRating/nonProBoutFilter.ts`**: カテゴリ`not_pro_promotion_tournament`(キーワード「プロ昇格」)を追加。`NonProBoutFilterInput`に`sectionHeading`フィールドを追加し`toHaystack()`に含めた。
2. **`scripts/build-pancrase-records.ts`**: `extractBoutTables()`を、ページ中の`<h3>`セクション見出し(「パンクラスゲート」「プロ昇格トーナメント決勝戦」等)と`<table>`(bout表)を出現順に1回のスキャンで拾い、直近の見出しを各boutの`sectionHeading`として紐付ける実装に変更。この値を`PancraseRecordsBout`に永続化する(スクレイパー側の恒久修正、今後の新規取得にも自動的に効く)。
3. **`scripts/filter-nonpro-bouts.ts`**: `classifyNonProBout(b as any)`が`eventName`(bout側ではなくevent側のフィールド)を渡していなかったバグを修正。大会名自体に「パンクラスゲート」を含む「パンクラスゲート2009」等はこれだけで既存キーワードで捕捉できるようになった。

**`multiOrgRecord.ts`は無変更**(git diff確認済み)。表示ロジックには一切手を入れず、入力データ(`data/pancraseRecords.json`)側だけを是正する方針で完結させた。

## 2. 削除bout 最終リスト(重複排除後・確定)

**127bout・29イベント**(2004年〜2018年)。理由内訳: `not_pro_pancrase_gate` 88件・`not_pro_promotion_tournament` 31件・`not_pro_cage_gate` 8件。

| 日付 | 大会名 | 件数 | 理由 |
|---|---|---|---|
| 2018-12-24 | PANCRASE302 | 2 | not_pro_pancrase_gate |
| 2018-07-15 | PANCRASE 大阪大会 | 2 | not_pro_pancrase_gate |
| 2017-12-24 | 光野有二朗グループpresents PANCRASE vs DEEP 大阪大会 | 2 | not_pro_pancrase_gate |
| 2017-10-22 | PANCRASE札幌大会 | 1 | not_pro_pancrase_gate |
| 2015-12-06 | PANCRASE札幌大会2015 | 2 | not_pro_pancrase_gate |
| 2014-11-02 | PANCRASE 262 | 4 | not_pro_cage_gate |
| 2014-06-22 | パンクラス北海道大会 | 1 | not_pro_pancrase_gate |
| 2013-12-31 | Bayside FIGHT.2 | 4 | not_pro_cage_gate |
| 2013-09-07 | PANCRASE 251 | 3 | not_pro_promotion_tournament |
| 2013-07-14 | PANCRASE249 | 1 | not_pro_promotion_tournament |
| 2013-05-19 | PANCRASE247 | 8 | not_pro_pancrase_gate |
| 2013-03-17 | PANCRASE246 | 1 | not_pro_pancrase_gate |
| 2012-11-25 | PANCRASE 2012 PROGRESS TOUR | 2 | not_pro_pancrase_gate |
| 2012-10-06 | PANCRASE 2012 PROGRESS TOUR | 5 | not_pro_promotion_tournament |
| 2012-05-20 | PANCRASE 2012 PROGRESS TOUR | 2 | not_pro_pancrase_gate |
| 2012-03-11 | PANCRASE 2012 PROGRESS TOUR | 1 | not_pro_pancrase_gate |
| 2011-11-27 | PANCRASE 2011 IMPRESSIVE TOUR | 3 | not_pro_pancrase_gate |
| 2011-09-04 | PANCRASE 2011 IMPRESSIVE TOUR | 3 | not_pro_promotion_tournament |
| 2010-12-05 | PANCRASE 2010 PASSION TOUR | 3 | not_pro_promotion_tournament |
| 2010-07-04 | PANCRASE 2010 PASSION TOUR | 2 | not_pro_promotion_tournament |
| 2010-02-07 | PANCRASE 2010 PASSION TOUR | 1 | not_pro_pancrase_gate |
| 2010-01-10 | パンクラスゲート4th CHANCE | 3 | not_pro_pancrase_gate |
| 2009-10-17 | PANCRASE 2009 CHANGING TOUR | 14 | not_pro_promotion_tournament |
| 2009-07-26 | パンクラスゲート2009 | 23 | not_pro_pancrase_gate |
| 2009-05-24 | パンクラスゲート2009 | 22 | not_pro_pancrase_gate |
| 2007-04-08 | PANCRASE REAL 2007 | 3 | not_pro_pancrase_gate |
| 2006-10-01 | PANCRASE 2006 BLOW TOUR | 6 | not_pro_pancrase_gate |
| 2005-09-04 | PANCRASE 2005 SPIRAL TOUR | 2 | not_pro_pancrase_gate |
| 2004-12-21 | PANCRASE 2004 BRAVE TOUR | 1 | not_pro_pancrase_gate |

「パンクラスゲート2009」(2大会・45bout)は大会名自体に既存キーワードを含んでいたにもかかわらず除外されていなかった分(filter-nonpro-bouts.tsのeventName未渡しバグが原因、③参照)。

### 純増減の内訳(全bout数: 4584 → 4482、差102)

上記127件の除外に加え、今回h3検出のため再取得した63イベントのうち一部で、既存の別バグ(2026-08-04指示書H「id属性付き`<table>`の取りこぼし」)が未反映のまま古いデータが残っていたものが再取得により正しく回復した(純増25bout、この25件はushiku-juntaro等5名には無関係)。127(除外) − 25(回復) = 102(純減)。

## 3. フィルタが必ず1回通ることの確認(③、原因究明はせず接続だけ確認)

`.github/workflows/update-org-records.yml`は既に`build-pancrase-records.ts`実行後に`filter-nonpro-bouts.ts`→`check-nonpro-bout-gate.ts`を呼ぶ配線になっていた。「パンクラスゲート2009」が抜けていたのは配線の不備ではなく、`filter-nonpro-bouts.ts`内の`classifyNonProBout(b as any)`呼び出しが`eventName`(bout側でなくevent側のフィールド)を渡していなかった実装バグが原因(②で修正済み)。ワークフロー自体の変更は不要と判断した。

## 4. 実在選手5名 変化前後・表示ソース

| 選手 | slug | 変化前 | 変化後 | 4団体合算(2行目)前→後 | 表示ソース(前→後) |
|---|---|---|---|---|---|
| 牛久絢太郎 | ushiku-juntaro | 22-12-1(35戦) | **22-12-0(34戦)** | 22-12-1→21-12-0 | **2行目→1行目に切替** |
| 名田英平 | nada | 10-9-1(20戦) | 9-9-1(19戦) | 同左 | 2行目のまま(変化なし) |
| 泰斗 | taito-rangers | 6-7-2(15戦) | 5-7-2(14戦) | 同左 | 2行目のまま(noRecordData、変化なし) |
| 藤井伸樹 | fujii-nobuki | 21-16-2(39戦) | 21-15-2(38戦) | 同左 | 2行目のまま(needsReview、変化なし) |
| 窪田泰斗 | kubota-taito | 13-7-0(20戦)※Pancrase単独 | 12-7-0(19戦)※Pancrase単独 | 12-7-0→12-7-0(4団体合算は元々13-7-0→12-7-0の内訳。全体は変化するが表示ソースは1行目のまま) | 1行目のまま(live、元々1行目優位、変化なし) |

牛久絢太郎のみ表示ソースが切り替わる(4団体合算が33戦までに減り、wiki側の34戦を下回ったため)。他4名は数字だけ更新され、表示ソース(1行目/2行目のどちら由来か)は変化しない。

牛久絢太郎ページの実際の表示(ページ本体・meta title/description・`/api/og/fighter`・`/fighters`一覧カードの計算ロジックをローカルdata経由で直接検証、後述⑥参照): **ヘッダー「22-12-0」・対戦テーブル34行・KO6/一本1/判定15・勝率65%/フィニッシュ率32%、全て一致**。

## 5. `/results`(削除boutが載っていたイベントの確認、想定と異なる結果)

指示は「削除boutが載っていた全イベントの`/results`から該当試合が消えることを確認」だったが、確認の結果、**`/results`は`data/pancraseRecords.json`を一切参照していない**(ソースコード上、この生データを読むのは`fighters/[slug]/page.tsx`と`/api/og/fighter/[slug]/route.tsx`の2箇所のみ)。

`/results/[slug]`は`src/lib/eventResults.ts`の`EVENT_RESULTS`(手動整備の別データ)を参照する。`EVENT_RESULTS`のパンクラス関連エントリは20件のみで、全て2025〜2026年の直近大会(PANCRASE 35x/36x、BLOOD系)。今回削除した29イベント(2004〜2018年)とは日付ベースで**1件も一致しない**(機械的に突合済み)。

結論: **`/results`には元々この29イベントが掲載されておらず、今回の変更による表示変化は無い**。指示の前提(`/results`から該当試合が消える)は成立しなかったため、削除bout一覧は上記②の表で代替する。

## 6. 波及確認(牛久絢太郎含む5名、ローカルdata直接検証)

`data/pancraseRecords.json`等の生成dataはGitHub raw(`main`固定URL)経由でしか読まれない実装のため、ローカルdevサーバーの実ブラウザ表示では今回の変更(未マージ)が反映されない(feedback_local_verify_github_raw_fetch.md記載の既知の制約)。このため、選手ページ本体・meta生成・OGP生成が呼ぶのと同じ関数(`resolveFighter`/`resolveDisplayRecord`/`shouldPreferMultiOrgRecord`/`computeMultiOrgRecord`等)をローカルdataで直接呼び出し、同一ロジックでの計算結果が一致することを検証した(5名全員、ヘッダー・対戦テーブル行数・meta用・OGP用が完全一致)。ブラウザでの実表示確認はマージ後のデプロイでのみ可能(CLAUDE.mdの本番保護ルールに従う)。

`/fighters`一覧カード相当のロジック(`visibleFighters.ts`)も別途ローカル再現し、5名とも同じ数字になることを確認した。

## 7. DEEP・修斗の同型パターン(④、記録のみ・未着手)

- **修斗**: `scripts/build-shooto-records.ts`に`<h3>`等のセクション見出しを扱うロジックが元々無い。修斗公式サイトのサンプルページ(結果ページ1件)を実際に取得し見出しタグ(h2/h3)の有無を確認したところ0件で、同じ構造の問題は無さそうという弱い根拠を得た(全231大会は未走査)。`filter-nonpro-bouts.ts`のeventName未渡しバグ修正は修斗にも共通適用されるが、dry-run実測で修斗側の除外件数は0件のまま(該当する構造的な混入は無い)。
- **DEEP**: `build-deep-records.ts`は元々スクレイプ時にインラインで非プロ/非MMA boutを除外する設計になっており(パンクラスの「後から別スクリプトで除外」方式とは異なるアーキテクチャ)、今回発見したのと同型の問題は構造的に起きにくいと考えられる。

いずれも指示どおり修正は行っていない。

## 8. 検証結果

- `tsc --noEmit`: 通過
- `npm run build`(全checkスクリプト+testスイート+`next build`): 通過(EXIT 0)
- `data/rankings.json`: 差分ゼロ(再生成して確認。`updatedAt`のみ変化したため、その差分もコミット対象から除外・revert済み)
- `data/fighterRecordsMeta.json`: 同様に`generatedAt`のみの差分だったためrevert済み
- `data/fighterRecords.json`: 5名分`update-fighter-records.ts --slug=`を実行したが、この生成データはWikipedia側(1行目)由来のみで4団体合算(2行目)の値を含まないため、今回の変更では差分が発生しない(想定どおり)
- `multiOrgRecord.ts`: 無変更(git diff確認済み)

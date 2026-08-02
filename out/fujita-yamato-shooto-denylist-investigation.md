# 藤田大和の修斗戦績denylist調査(2026-08-03)

## 結論: コード・データ変更は不要。修斗分は既に解決・集計済みだった

指示書の前提(「`nameCollisionDenylist.ts`が藤田大和をブロックしており修斗分が
まるごと入っていない」)は、現在のdata/状態とは一致しない。調査の結果、
以下が判明した。

## 1. 修斗公式ロースターに「藤田大和」は1名のみ

`https://www.shooto-mma.com/fighters/?all=1`(全1,897件)を取得し、生HTMLを
直接grepして確認(WebFetchのAI要約による見落としを避けるため、
`scripts/lib/robotsGate.ts`と同じUA・タイムアウト設定で自前取得)。

「藤田　大和」(id=1920)は1件のみ。指示書が前提とする「同姓同名2プロフィール」
は存在しない。

一方、「大和」(単独名、id=501)という**別人**のプロフィールが存在し、
denylistの構築ロジック(指示書U、`out/build_denylist.ts`)の
「一方が他方の部分文字列」ルールにより、「大和」⊂「藤田大和」の関係で
denylistに追加されていたことを確認した(「岡本大和」「西川大和」「平尾大和」も
同じ理由でdenylist入りしている)。

## 2. id=1920が本人であることの確認

`https://www.shooto-mma.com/fighters/?id=1920` のプロフィール:
- 所属ジム: 「リバーサルジム新宿Me,We」→ ja.Wikipedia「藤田大和」記載の
  所属ジムと完全一致
- 通算1戦1敗(プロ修斗公式戦)、唯一の試合は2026-03-30 Lemino修斗.4
  vs ルケ コンセイソン(1R KO負け)

ja.Wikipedia「藤田大和」の戦績表(21戦14勝7敗)を全行確認したところ、
修斗(Lemino修斗ブランド含む)の試合はLemino修斗.4の1試合のみだった。

## 3. id=501(「大和」)は別人と確認

- ストロー級 [-52.2kg]、通算3戦3勝、2010〜2012年に活動、所属ジム記載なし。
- 藤田大和(フライ級、2018〜2026年活動、リバーサルジム新宿Me,We所属)とは
  階級・活動時期・所属いずれも一致せず、別人と確定できる。
- denylistの「藤田大和」エントリは、この別人(id=501)との部分文字列衝突を
  防ぐ安全策として今も妥当。**denylistからは外さない。**

## 4. Lemino修斗.4の1戦は既にdata/shootoRecords.jsonに正しく解決済み

該当bout(`data/shootoRecords.json` shootoEventId=262):
```
fighterAName: "藤田 大和" / fighterASlug: "fujita-yamato" (解決済み)
winnerName: "ルケ コンセイソン" (敗け)
```

`fighterASlug`の解決は`scripts/build-shooto-records.ts`が使う
`findFighterSlugByName()`(fighters.ts内の完全一致、`AMBIGUOUS_NAMES`で
ガード)経由であり、`NAME_COLLISION_DENYLIST`(`scripts/lib/
fighterNameBackfill.ts`の`resolveSlug()`専用、未解決slugの事後バックフィル
にのみ使われる)を通らない。そのためdenylistはこの解決を一切妨げていない。

`computeFighterShootoRecord()`(`shootoRecordsAggregate.ts`)は`winnerSlug`
ではなく`winnerName`文字列比較で勝敗を決めるため、対戦相手側
(ルケ コンセイソン)のslugが未解決でも藤田大和側の敗け1件は正しく
カウントされている。

実測(2026-08-03時点、`computeMultiOrgRecord("fujita-yamato", ...)`):
```
wins: 8, losses: 4, draws: 0, orgsWithBouts: [RIZIN, DEEP, 修斗]
```
修斗は既に`orgsWithBouts`に含まれている。

## 5. 1行目(14-7-0)と2行目の残差の内訳(このPRのスコープ外)

Wikipedia戦績21戦の内訳:
- UAE Warriors 7戦(mnewsが追跡していない団体。構造上取得不可能)
- 修斗 1戦(Lemino修斗.4) → 上記の通り解決済み
- RIZIN 2戦(2017-10-15 vs 那須川天心、2022-07-02 vs 曹竜也)
- DEEP 11戦(うちDEEP 107 IMPACT vs 神龍誠1戦は`fighterBName`空文字の
  既知パーサーバグでスコープ外、PR #345で既出)

現在の2行目(8-4-0)にはRIZIN 2戦のうち1戦(那須川天心)が欠落し、
もう1戦(曹竜也)は勝敗が反転(本来win、現在loss表示)している。これは
open draft PR #356「fix: RIZINのwinnerSlug再計算漏れ(fujita-yamato 2件、
#292と同型)」が対象としている問題そのものであり、本調査のスコープ外。

## 受入条件との照合

- 「2行目に修斗分が加わること」→ 既に加わっている(本PR着手前から)。
- 「2行目が1行目を上回らないこと」→ 8-4-0 < 14-7-0、問題なし。
- 「藤田大和以外の選手の解決件数が変化しないこと」→ コード・データの変更を
  一切行っていないため自明に維持される。

## 実行ログ

- 取得: `https://www.shooto-mma.com/fighters/?all=1`(1回)、
  `https://www.shooto-mma.com/fighters/?id=1920`・`?id=501`(WebFetch経由、
  各1回)。1,897件一覧の再取得は不要なため`out/`キャッシュ化はしていない
  (今回の調査は一過性のread-onlyで再実行前提が無いため)。

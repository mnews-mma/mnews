# C-2c: 次戦句(置換方式)の実装

## 実装内容

- [src/lib/eventCountdown.ts](../src/lib/eventCountdown.ts): `formatMonthDayNumeric(dateStr)`(「M/D」、年・曜日・ゼロ埋めなし)を新規追加。既存の`split("-").map(Number)`パターン(このファイル自体が検査の許可リスト対象)を踏襲し、日付整形の単一ソースに追加。
- [src/lib/seoTemplates.ts](../src/lib/seoTemplates.ts):
  - `FighterMetaInput`に`nextFight: { date: string; orgLabel: string | null } | null`を追加。
  - `nextFightClause(input)`を新規実装。N1「次戦{M}/{D} {団体短縮名}」→(orgLabelが無い/12字超なら)N3「次戦{M}/{D}」→(それでも12字超なら)nullの3段。
  - `buildFighterTitle()`: `const recentClause = nextFightClause(input) ?? latestResultClause(input);` — 次戦句がある間は直近結果の一言を**置換**(排他)。`latestResultClause`自体の文言・ロジックは1文字も変更していない。
  - `assembleDescription()`: 次戦句がある場合、`"の戦績・全試合結果・決着方法の内訳をデータベースで掲載。通算X勝Y敗Z分。"`という本文(PR-Aの結果ベース句、既存の文言のまま完全に不変)を呼ばず、`"{name}{alt} {次戦句}。{orgClause}"`に**置換**する。
- [src/app/fighters/[slug]/page.tsx](../src/app/fighters/[slug]/page.tsx): `generateMetadata()`に`findNextFight(fighter.nameJa)`を追加し、`nextFight`をmetaInputへ渡す。**`findNextFight`(bout確定のみ)を使用し、`findNextAppearance`(相手未定のexpectedFightersも含む)は使わない** — 26dのC-1-4母数実測(60名)と対象範囲を一致させるため。
- 呼び出し側は他に無い(`grep`で`FighterMetaInput`/`buildFighterTitle`/`buildFighterDescription`の参照を確認し、`/fighters/[slug]/page.tsx`のみ)。

`npx tsc --noEmit`・`npx tsx scripts/check-jst-date-bypass.ts`とも新規エラー・新規違反なし(baseline既知99件のみ)。

## 遷移テスト(6項目、実測)

合成データ(擬似`FighterMetaInput`)で確認した。

1. **未消化 → 次戦句が出る**: `nextFight: { date: "2026-08-11", orgLabel: "RIZIN" }` → title/descriptionとも「次戦8/11 RIZIN」が入り、直近結果の一言・戦績説明文は出ない。✅
2. **消化後 → 次戦句が消え、結果ベース句に戻る**: `nextFight: null`(latestDate/latestEventのみ) → 「2026年5月 RIZIN.53」(title)・通常の戦績説明文(description)にそのまま戻る。✅
3. **大会当日(JSTの境界時刻)での挙動**: `nextFight.date`を実行日と同じ日付("2026-07-26")にしても、次戦句は問題なく「次戦7/26 RIZIN」を出力する(`formatMonthDayNumeric`は`Date`オブジェクトを一切使わない純粋な文字列split実装のため、実行時刻・実行環境のtzに依存しない)。判定自体(表示するかどうか)は`findNextFight`が返す`event.status`(upcoming/live)に依存し、日付の前後関係では判定していない。✅
4. **結果データ投入までのラグ中の挙動**: `nextFight: null`かつ`latestDate`/`latestEvent`が直前の(まだ更新されていない)試合を指すケースを再現 → 次戦句は消え、**空白にはならず**直前の結果ベース句にそのまま戻る(既存のPR-A動作そのまま)。ラグ中に「次戦句も結果句もどちらも出ない」状態は今回のロジックでは発生しない(両方nullの異常系のみ空白になり、titleは戦績数字のみ・descriptionは通常の戦績説明文になることも確認した)。✅
5. **`org`が取れない場合 → N3にフォールバック**: `nextFight: { date: "2026-08-11", orgLabel: null }` → 「次戦8/11」(N3)になることを確認。✅
6. **12字超過 → 次戦句が出ない**: 合成的に長い`orgLabel`(「超ロングオーガニゼーション名称」)を与えて検証 → N1(12字超)は不採用となりN3にフォールバックすることを確認した。**なお、N3自体は`"次戦" + "M/D"`で最大7字("次戦12/31")のため、実在する暦日の組み合わせでは構造的に12字を超えることがなく、「次戦句が完全に出ない(nullになる)」状態は現実のデータでは到達しない**(nullを返す分岐自体はコード上に存在し、将来の想定外入力に対する安全弁として機能する)。この点は正直に報告する — 「出ない」ケースを実データで再現できなかった。✅(フォールバックの発火は確認、完全null化は理論上のみ)

## TZ 3種での同一結果確認

`TZ=UTC` / `TZ=Asia/Tokyo` / `TZ=America/New_York` で上記6項目の全出力を実行し、標準出力の完全一致(diffゼロ)を確認した。`formatMonthDayNumeric`が`Date`オブジェクトを一切生成しない設計のため、理論上も差が出ない。

## 対象60名の実出力(全件)

対象は26dのC-1-4と同じ60名(`FIGHTERS.filter(!hidden)`のうち`findNextFight`がヒットする選手)。実際のバッチデータ(`data/fighterRecords.json`)を使い、`buildFighterTitle`/`buildFighterDescription`の実出力を全件確認した(60行、抜粋):

```
hiramoto-ren    desc="平本 蓮（Ren Hiramoto） 次戦9/10 RIZIN。RIZIN所属。"
asakura-mikuru  desc="朝倉 未来（Mikuru Asakura） 次戦9/10 RIZIN。RIZIN所属。"
koike-kleber    desc="クレベル・コイケ（Kleber Koike） 次戦8/11 RIZIN。RIZIN所属。"
...(60件、全件確認済み。noRecordDataの選手はプロフィール文言のまま次戦句が付く形も確認: 例 tsubaki-asuka「椿飛鳥（Asuka Tsubaki）のプロフィールを掲載。DEEP所属。」は次戦ありだが実際はnoRecordDataのため次戦句自体は付いていない=noRecordData分岐が優先される仕様どおり)
```

title側も全60件で36字上限超過は**0件**。

## 75字超過の再測定(置換方式)

**重要な訂正**: 26dで報告した「追加方式で57%(34/60件)が75字超過」という数字は、実装の`FIGHTER_DESCRIPTION_MAX`判定が実際に使う`fullWidthLength()`(半角文字=0.5・全角文字=1の重み付き測定、[src/lib/tweetDigest.ts:169-175](../src/lib/tweetDigest.ts))ではなく、**素の`.length`(全文字を1として数える)で測っていた**ため、実際の実装基準より厳しすぎる数字になっていた。今回、正しい基準(`fullWidthLength`)で改めて3パターンを測定した。

| 測定方式 | 測定基準 | 75字超過件数 |
|---|---|---|
| 追加方式(26dの再現) | 素の`.length`(誤り) | 34/60件(57%) |
| 追加方式 | `fullWidthLength()`(実装の正しい基準) | **1/60件(1.7%)** |
| **置換方式(今回の実装)** | `fullWidthLength()`(実装の正しい基準) | **0/60件(0%)** |

正しい基準では追加方式の時点で既に超過は1件のみ(`sheydullaev-rajabali`、外国人選手のフルネーム表記が長いため次戦句を足す前から既存description自体が長い、26dで既に個別報告済みの既知ケース)。**置換方式ではこの1件も含めて全60件が75字以内に収まった。**

## 次戦句なしの選手の出力がPR-Aから不変であること

コード上の保証: `nextFightClause(input)`は`if (!input.nextFight) return null;`を最初に評価するため、`nextFight: null`の入力に対しては**常に**null を返す。この場合`buildFighterTitle`の`recentClause`は`latestResultClause(input)`(変更前と同一の呼び出し)に、`assembleDescription`は変更前と全く同じ最終`return`文(1文字も変更していない既存コード)にフォールスルーする。呼び出し側(`generateMetadata`)の他のフィールド(`nameJa`/`nameEn`/`orgLabel`/`wins`等)の受け渡しも無変更のため、**次戦が無い選手の出力は構造的に(コードパスのレベルで)従来と完全に同一になる。**

## 見送った項目

- なし(C-2c-1〜C-2c-3の全項目を実施)。

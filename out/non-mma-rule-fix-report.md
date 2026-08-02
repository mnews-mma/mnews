# K-1ルール・SBルール等 非MMA判定の一本化(修正PR)

read-only調査(PR #369、`out/non-mma-rule-contamination-audit.md`)で見つかった
「ルール種別の非MMA判定が団体ごとにバラバラで、DEEP・修斗には判定自体が無い」
問題の修正。**マージはしない(ビルドレート制限解除後に人手でマージ)。**

## 変更内容

1. **判定を1箇所に集約**: `scripts/lib/nonProBoutFilter.ts`を
   `src/lib/mnewsRating/nonProBoutFilter.ts`へ移設(4団体すべての集計関数
   (`src/lib/mnewsRating/*.ts`)から参照できるようにするため。移設前は
   scripts/配下のみ想定で、src/配下からは参照できない構成だった)。
   `classifyMmaRuleType()` + 統合済み`NON_MMA_RULE_PATTERNS`を追加。
   - RIZIN(`rizinScraper.ts`のparseRuleInfo): ルール原文(ruleLineRaw)が
     data/rizinRecords.jsonに保存されないため、スクレイプ時にこの共有関数へ
     一度だけ判定を委譲。
   - パンクラス・DEEP・修斗: headingText/namedDivisionが保存されているため、
     各`computeFighter*Record()`が集計のたびに共有関数で判定し直す
     (保存済みruleTypeフィールドは信用しない。パターン更新が再スクレイプ
     無しで即座に反映される)。
   - パンクラスの`build-pancrase-records.ts`(スクレイプ時の参考値計算)も
     同じ共有関数に委譲(将来の再スクレイプでも一致させるため)。
2. **DEEPのbout単位判定**: `computeFighterDeepRecord`に非MMA除外を追加
   (元々判定自体が無かった)。イベントタイトル単位の`isKickEvent()`では
   捕捉できない混在カード(大会名は通常のMMA本戦だが一部undercardのみ
   キック/グラップリングルール)にも対応。
3. **パンクラスのISKAパターン欠落を修正**: 統合後のパターンに`ISKA`を追加
   (RIZIN側には元々あったが、パンクラス側の独立パターンリストに無かった)。
4. **修斗のbout単位判定**: `computeFighterShootoRecord`に非MMA除外を追加。
   ファイル冒頭コメントの「修斗はキックボクシング等の異種目カードを持たない」
   という誤った前提を訂正。

### 除外しない値: `"unknown"`(ルール表記自体が無い)

DEEPは実測295件(うちslug解決済み112件)がheadingText空("unknown")で、
これは単なるヘッダー抽出漏れであり非MMAの根拠にはならない。RIZINの既存
集計(`MMA_RULE_TYPES.has(b.ruleType)`)は"unknown"も除外扱いだが、これは
ruleLineRaw自体が空だったケース(RIZIN公式ページのルール行が本当に無い)の
話で、DEEPのheadingText空とは性質が異なる。DEEP・修斗・パンクラスいずれも
`ruleType !== "MMA" && ruleType !== "unknown"` の場合のみ除外する設計にした
(捏造ゼロの原則。「ルール情報が無い」ことを「非MMA」の根拠にしない)。

## 除外対象bout(全件・人が読める形)

キーワード一致の全件(未解決含む)は `out/non-mma-rule-fix-verification.log`
に出力済み(`scripts/verify-rule-type-classifier-safety.ts`で再生成可能)。

- パンクラス: 保存済みruleTypeとの差分1件(ISKAオリエンタル・ルール、
  両選手ともslug未解決のため現状の戦績への影響なし)
- DEEP: 41件(うちslug解決済み7件・6名に影響)
- 修斗: 65件(うちslug解決済み9件・7名に影響)

全件を目視確認し、本来MMAの試合を誤って除外しているケースは0件だった
(見出しテキストにいずれも「キックルール」「グラップリング」「新空手道連盟」
「CKC」「エキシビション」等の明確な非MMA表記がある)。

## 影響選手13名の4団体通算 増減(全件)

| 選手 | 団体 | 団体単体(前→後) | 4団体通算(前→後) | 4団体通算試合数(前→後) |
|---|---|---|---|---|
| 三浦彩佳 | DEEP | 3-2-0 → 2-1-0 | 7-3-0 → 6-2-0 | 10 → 8 |
| SARAMI | DEEP | 6-9-0 → 5-8-0 | 13-11-0 → 12-10-0 | 24 → 22 |
| 杉本恵 | DEEP | 0-3-0 → 0-1-0 | 11-8-3 → 11-6-3 | 22 → 20 |
| 伊澤星花 | DEEP | 5-0-0 → 4-0-0 | 17-0-0 → 16-0-0 | 17 → 16 |
| タンク内藤 | DEEP | 2-0-0 → 1-0-0 | 2-0-0 → 1-0-0 | 2 → 1 |
| 青野ひかる | DEEP | 13-6-0 → 12-6-0 | 15-7-0 → 14-7-0 | 22 → 21 |
| 黒部三奈 | 修斗 | 6-4-0 → 6-2-0 | 18-8-0 → 18-6-0 | 26 → 24 |
| 上原平 | 修斗 | 7-3-3 → 7-3-3(変化なし) | 7-3-3 → 7-3-3(変化なし) | 13 → 13 |
| NOEL | 修斗 | 4-1-1 → 4-1-0 | 6-2-1 → 6-2-0 | 9 → 8 |
| 藤野恵実 | 修斗 | 5-0-2 → 5-0-1 | 15-8-2 → 15-8-1 | 25 → 24 |
| 中島陸 | 修斗 | 8-0-1 → 7-0-1 | 8-0-1 → 7-0-1 | 9 → 8 |
| 村上彩 | 修斗 | 2-3-0 → 2-2-0 | 11-4-0 → 11-3-0 | 15 → 14 |
| 平田彩音 | 修斗 | 4-2-0 → 3-2-0 | 4-3-0 → 3-3-0 | 7 → 6 |

**0-0-0になった選手: 0名(停止条件に該当なし)**。

上原平の団体単体・4団体通算いずれも数値が変化していない理由: 除外対象の
1件(東京・後楽園ホール、エキシビションマッチ)は元々`resultType: "nc"`
(ノーコンテスト扱い)で、勝敗・引分の集計(wins/losses/draws)には最初から
数えられていなかったため(bouts配列の件数自体は減っている)。

特に目立つ変化: 杉本恵はDEEP単体が「0勝3敗」→「0勝1敗」(3戦中2戦が
非MMAだったと確定)、タンク内藤は「2勝0敗」→「1勝0敗」(DEEP単体2勝の
半分がキックボクシングルールだったと確定)。

## 検証結果

- **2回実行でSHA256一致**: `verify-rule-type-classifier-safety.ts`・
  `report-affected-fighters-before-after.ts`いずれも2回連続実行で出力
  ハッシュが完全一致(純関数・静的data参照のみで非決定要素が無いため)。
- **RIZIN既存77大会への影響再検証**: 統合後のパターンは旧RIZIN専用パターン
  に対する追加のみ(既存の一致条件を狭めていない)ため理論上差分は
  出ないはずだが、本番データのため公式サイトを実際に再取得し
  `parseRuleInfo()`の新旧結果を全bout突合した
  (`scripts/verify-rizin-rule-pattern-migration.ts`)。
  **結果: fetch失敗0大会・総966bout・差分0件**
  (`out/rizin-rule-pattern-migration-verification.log`)。
- **tsc(`npx tsc --noEmit`)**: エラー0件
- **`npm run build`**(全check:スクリプト+全test:スクリプト+`next build`の
  一括実行): 成功。型チェック・静的生成とも全ページ正常完了
  (`Failed to set Next.js data cache ... items over 2MB`という警告は
  data/pancraseRecords.json等の既存ファイルサイズに起因する既知の無害な
  警告で、今回の変更とは無関係)。
- **`npx tsx scripts/test-mnews-rating.ts`**: 220件成功 / 0件失敗
- **`npx tsx scripts/test-rizin-scraper.ts`**: 44件成功 / 0件失敗
- **`data/rankings.json`**: 無変更(`git status --short data/`が空。今回の
  変更は`src/lib/mnewsRating/*RecordsAggregate.ts`・`nonProBoutFilter.ts`・
  `rizinScraper.ts`・`build-pancrase-records.ts`のみで、レーティングエンジン
  (`fighterRecords.json`のみを入力とする)には一切触れていない)

## 停止条件チェック

- 除外件数が想定を大きく超えたか: **いいえ**。read-only調査(PR #369)で
  事前に把握していた件数(DEEP41件・修斗65件、うちslug解決済み7件/9件)と
  完全一致。
- MMA戦を誤って除外している疑いが1件でもあるか: **いいえ**。全106件
  (未解決含む)を目視確認し、いずれも見出しに明確な非MMA表記あり。
- 4団体通算が0-0-0になった選手はいるか: **いいえ**。

いずれの停止条件にも該当しないため、修正PRとして提出する。

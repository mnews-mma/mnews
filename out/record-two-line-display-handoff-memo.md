# 戦績2行表示(#260)引き継ぎメモ — 2026-07-29

このメモは、同一スコープ(feat/record-two-line-display)に別セッションが並行着手していたことに気づいた別セッションが、自分の作業を止めて降りる際に残したもの。以下は降りる直前に受け取っていた指示内容。両セッションの設計が食い違う場合の参考にしてください。

## 受け取っていた指示(4点)

1. **slugの埋め直しは data/ 生成側の専用スクリプトに一本化する設計にする**。
   - 対象: `scripts/build-shooto-records.ts` / `scripts/build-pancrase-records.ts`。
   - 現状これらは `findFighterSlugByName`(`src/lib/fighters.ts`)を使ってbout側のslugを解決しているが、この関数は `hidden` 選手を解決対象から除外する(`if (f.hidden) return false;`)。#252で投入された92名(#248/#247由来、hidden:true)はこのため常にslug null になる。
   - 対応方針: `findFighterSlugByName` 自体は不触(公開リンク生成用の既存挙動を変えない)。**hiddenも解決対象に含める別のリゾルバを、この2つの生成スクリプト専用に**新設し、生成時にbout側のfighterASlug/fighterBSlugを正しく埋める。

2. **表示側(集計時)の名前突合は不採用**。
   - 「slugがnullの場合だけ対象選手のnameJa/aliasesとの正規化名一致でフォールバックする」というアプローチ(このセッションで書きかけていた `multiOrgFighterMatch.ts` の `matchesFighterCorner`/`FighterMatchTarget` によるOR条件マッチ)は不採用と判断された。
   - 理由: 1の生成時slug解決を直せば、集計時のフォールバックは本来不要になるはずで、突合ロジックを2箇所(生成時・表示時)に持つと二重実装・整合性リスクになる。**集計は常にslug完全一致のみで行う**方針。

3. **未解決一覧(slugがnullのまま残った名前)のうち、1〜2文字違いのペアは別枠で出す**。
   - 生成スクリプトの実行ログ/レポートで「解決できなかった名前」を出す際、既存FIGHTERSの名前と編集距離1〜2文字程度の近さがあるペアがあれば、それを別枠(表記ゆれ疑いリスト)として分けて出力する設計にする、という指示。
   - 目的: 単純な表記ゆれ(例: 濁点・全角半角・旧字体等)による取りこぼしを、真に対応する選手がいない未解決と区別して人間が拾えるようにするため。

4. **現行の唯一の停止条件は「#252投入の92名のうち、3団体合算(RIZIN+修斗+パンクラス)戦績が0-0-0になる選手が出た場合」のみ**。
   - このセッションで一度設定した「0-0-0が30名を超えたら停止」という条件は、RIZIN単独集計を前提にした誤った基準だったため撤回済み(RIZIN以外の団体出身選手がRIZIN単独では0になるのは当然のため)。
   - 「ランキング/戦績が動く場合は停止」という条件も検討したが、`computeFighterMmaRecord`/この2行目表示の集計ロジックは現状ランキング計算パイプライン(`scripts/update-mnews-rating.ts`等)からは呼ばれておらず(テストのみで使用)、表示専用の読み取りである限りランキングには影響しないことをこのセッションで確認済み。

## このメモを書いた時点でこのブランチに存在していたWIPについて

`git status` で以下が確認できた(このセッション自身が触れたのは一部の`export`追加のみで、大半は既に他セッションの作業と思われる):
- `src/lib/mnewsRating/multiOrgFighterMatch.ts`(名前フォールバック突合。上記2の理由で不採用方針)
- `src/lib/mnewsRating/multiOrgRecord.ts`, `pancraseRecordsAggregate.ts`, `pancraseRecordsTypes.ts`, `shootoRecordsAggregate.ts`, `src/lib/multiOrgRecordsData.ts`
- `data/shootoRecords.json` / `data/pancraseRecords.json` の再生成済み変更
- `src/app/fighters/[slug]/page.tsx` の変更

このセッションはこれらの中身を実装・検証していない(読んで方針を確認しただけ)。上記1〜4の指示との整合性は、続きの作業者側で確認してください。

# DEEP bout総数 2473→2403(-70)の内訳調査(read-only)

## 前提・確認済みの事実(引き継ぎ)

- `daily-records-workflow` worktree(PR #389, `feat/daily-records-workflow`)で
  `scripts/build-deep-records.ts` をキャッシュ済みHTML(`out/deep-html-cache/`)
  から再取得なしでdry-run実行した結果、`data/deepRecords.json` のbout総数が
  現行main(コミット済み、238大会・2473bout)から238大会・2403bout(-70)に
  減少する。
- 43大会で計-70bout。DEEP OSAKA IMPACT 2022 5th ROUNDが8→1と突出。
- DEEP 45 IMPACT(pinned・17bout)は前後で変化なし。
- 2回連続実行でSHA256一致(決定的な差分。実行順・タイミング起因のノイズでは
  ない)。

本調査ではこの「原因」を当たりを付けずに、実データの突合のみで特定した。

## 調査方法

1. 現行main(コミット済み `data/deepRecords.json`、HEAD)を before、
   `daily-records-workflow` worktreeのdry-run出力(作業ツリー上の未コミット
   `data/deepRecords.json`)を after として、大会単位でbout数を突合。
2. bout数が変化した大会について、選手ペア(順不同)+決着欄(`methodRaw`)を
   キーにbefore/afterのbout集合をmultiset差分し、消えたbout・増えたboutを
   実体(選手名・resultType・methodRaw・見出しテキスト・format)まで特定。
3. 特定した消失boutの `format` フィールド、及び原因候補として挙がっていた
   共催大会除外リスト・非プロ/非MMA除外フィルタ・公式ニュース欄混入除去との
   関係をコードから裏取り。

## ①大会ごとの内訳(43大会・全件)

| 日付 | 大会名 | before | after | diff |
|---|---|---|---|---|
| 2022-12-18 | DEEP OSAKA IMPACT 2022 5th ROUND | 8 | 1 | -7 |
| 2024-05-12 | DEEP CAGE IMPACT 2024 in HAMAMATSU | 12 | 7 | -5 |
| 2025-03-15 | DEEP 124 IMPACT | 11 | 6 | -5 |
| 2020-11-01 | DEEP 99 IMPACT | 9 | 5 | -4 |
| 2012-08-18 | DEEP 59 IMPACT | 12 | 10 | -2 |
| 2013-06-15 | DEEP CAGE IMPACT 2013 in KORAKUEN HALL | 15 | 13 | -2 |
| 2014-02-16 | DEEP JEWELS 3 | 7 | 5 | -2 |
| 2014-10-26 | DEEP 69 IMPACT | 15 | 13 | -2 |
| 2015-08-29 | DEEP CAGE IMPACT 2015 | 12 | 10 | -2 |
| 2019-04-28 | DEEP CAGE IMPACT 2019 in 大阪 | 17 | 15 | -2 |
| 2022-09-11 | DEEP TOKYO IMPACT 2022 5th ROUND | 14 | 12 | -2 |
| 2023-09-18 | DEEP 115 IMPACT～DEEP VS BLACK COMBAT～ | 11 | 9 | -2 |
| 2025-05-05 | DEEP 125 IMPACT | 7 | 5 | -2 |
| 2026-03-20 | DEEP 130 IMPACT | 10 | 8 | -2 |
| 2010-10-24 | DEEP 50 IMPACT | 17 | 16 | -1 |
| 2011-02-25 | DEEP 52 IMPACT | 11 | 10 | -1 |
| 2013-04-28 | DEEP OSAKA IMPACT 2013 | 11 | 10 | -1 |
| 2014-05-18 | DEEP JEWELS 4 | 9 | 8 | -1 |
| 2014-12-21 | DEEP 70 IMPACT | 15 | 14 | -1 |
| 2015-02-21 | DEEP JEWELS 7 | 4 | 3 | -1 |
| 2015-02-28 | DEEP 71 IMPACT | 14 | 13 | -1 |
| 2015-10-17 | DEEP 73 IMPACT | 12 | 11 | -1 |
| 2017-07-15 | DEEP CAGE IMPACT 2017 | 9 | 8 | -1 |
| 2017-12-23 | DEEP 81 IMPACT | 15 | 14 | -1 |
| 2018-06-30 | DEEP 84 IMPACT | 18 | 17 | -1 |
| 2018-12-22 | DEEP 87 IMPACT | 10 | 9 | -1 |
| 2019-03-09 | DEEP JEWELS 23 | 11 | 10 | -1 |
| 2019-10-22 | DEEP 92 IMPACT | 10 | 9 | -1 |
| 2020-03-01 | DEEP 94 IMPACT | 11 | 10 | -1 |
| 2020-08-23 | DEEP 95 IMPACT | 9 | 8 | -1 |
| 2020-11-01 | DEEP 98 IMPACT | 7 | 6 | -1 |
| 2021-02-21 | DEEP 100 IMPACT ～20th Anniversary～ | 17 | 16 | -1 |
| 2021-05-05 | DEEP 101 IMPACT | 8 | 7 | -1 |
| 2023-09-24 | DEEP HAMAMATSU IMPACT 2023 | 19 | 18 | -1 |
| 2024-03-24 | DEEP JEWELS 44 | 9 | 8 | -1 |
| 2024-05-03 | DEEP 119 IMPACT | 7 | 6 | -1 |
| 2024-09-08 | DEEP JEWELS 46 | 9 | 8 | -1 |
| 2024-09-16 | DEEP 121 IMPACT | 9 | 8 | -1 |
| 2025-04-27 | DEEP HAMAMATSU IMPACT 2025 1st ROUND | 10 | 9 | -1 |
| 2025-08-17 | DEEP 126 IMPACT | 10 | 9 | -1 |
| 2025-09-07 | DEEP JEWELS 50 | 8 | 7 | -1 |
| 2025-09-21 | DEEP OSAKA IMPACT 2025 4th ROUND | 8 | 7 | -1 |
| 2026-02-23 | DEEP TOKYO IMPACT 2026 1st ROUND | 11 | 10 | -1 |

合計: 43大会、-70bout。増加した大会・新規/消失大会は0(238大会は前後で1対1、
イベント単体の消失は無い)。

選手ペア+決着欄キーでの突合において、逆方向(beforeに存在せずafterにのみ
存在するbout)は**0件**。つまりboutの入れ替わりではなく純粋な「70件の消失」の
みで-70の全量を説明できる(突合の不一致イベントも0件)。

## ②消えたboutの実体・resultType内訳

70件全件のresultType内訳:

| resultType | 件数 |
|---|---|
| decisive | 60 |
| unknown | 6 |
| nc | 3 |
| draw | 1 |

**70件全件が `format: "structural_paragraph"`。他の10フォーマット
(F1/f1_method_glued/f2_method_middle/f4_detached_mark_label/
f8_fully_separated/f10_vs_and_mark/group1_vs/group2_no_heading/
group4_detached_mark/headingless_recovered)からの消失は0件。**

全43大会×70bout分の選手名・決着欄の詳細一覧は
[deep-2473-2403-removed-bouts-detail.md](deep-2473-2403-removed-bouts-detail.md)
を参照(本ファイルには冒頭の主要大会のみ抜粋を記載)。

### 抜粋: DEEP OSAKA IMPACT 2022 5th ROUND(8→1、最大の減少幅)

出典: https://www.deep2001.com/deep-osaka-impact-2022-5th-round/

| 選手A | 選手B | resultType | methodRaw | format |
|---|---|---|---|---|
| 中本龍平 | 牧野滉風 | decisive | 2R2:52 TKO | structural_paragraph |
| 大野"虎眼"賢良 | ディーシー"オーバーマン"クラー | decisive | 判定0-3 | structural_paragraph |
| 森井翼 | 角野晃平 | decisive | 判定0-3 | structural_paragraph |
| 大宮優 | 田中壱季 | decisive | 1R1:48 アームロック | structural_paragraph |
| 上荷大夢 | 関本龍翔 | decisive | 2R3:47 肩固め | structural_paragraph |
| フェルナンド | 松本レイ | decisive | 1R4:28 腕十字 | structural_paragraph |
| 亮馬 | 石井涼馬 | decisive | 判定0-3 | structural_paragraph |

after(1bout)に残るのは `format: "group1_vs"` の柴田"MONKEY"有哉 vs
杉山廣平のみ(通常の主抽出パスで取れる1boutだけが残り、他7boutが丸ごと
消失)。

## ③原因の分類(実データから起こした分類。事前の当たりは反映していない)

**分類は1種類のみ。70件全件が同一原因で説明できる(按分・複数原因の混在は
無い)。**

### 確定原因: `recoverStructuralParagraphBouts()` が通常ビルドパイプライン
### (`scripts/build-deep-records.ts`)に配線されていない(一括パッチの
### 未統合)

- `structural_paragraph` フォーマットは `src/lib/mnewsRating/deepScraper.ts`
  の `recoverStructuralParagraphBouts()`(3.7節、コミット `1aa6ce8`
  「fix: DEEP未回収2件を構造段落ベースの回収で解消」、mainにマージ済み)で
  のみ生成される。
- このコミットは同時に **一回限りの最小パッチスクリプト**
  `scripts/patch-deep-structural-paragraph-recovery.ts` を追加しており、
  現行mainの `data/deepRecords.json` 内の70件のstructural_paragraph boutは
  すべて、このパッチスクリプトを**1回実行した結果として直接
  `data/deepRecords.json` に追記されたもの**(パッチ自身のレポート
  `out/deep-structural-paragraph-recovery-report.md` に「回収bout数: 70件」
  「新規追加70件のみ」と明記されている)。
- 一方、通常の再構築パイプライン `scripts/build-deep-records.ts` は
  `recoverHeadinglessBouts()`(PR #374由来の見出しなし回収。367行目・443行目
  で呼び出し)は呼ぶが、`recoverStructuralParagraphBouts()` は
  **importにも呼び出しにも一切現れない**(リポジトリ全体を検索しても
  `structural_paragraph` という文字列が出現するのは `deepScraper.ts`
  (定義)と `patch-deep-structural-paragraph-recovery.ts`
  (一回限りパッチ)の2ファイルのみ)。
- したがって、`build-deep-records.ts` がキャッシュ済みHTMLから
  `data/deepRecords.json` をゼロから再構築すると、この一括パッチで追加された
  70bout分だけが再現されず、常に-70で再現される。dry-run 2回でSHA256が
  完全一致する(決定的)という確認済みの事実とも整合する
  (`recoverStructuralParagraphBouts()` を呼ばない同一コードを毎回実行して
  いるだけなので、当然決定的になる)。
- OSAKA IMPACT 2022 5th ROUNDが8→1と突出する理由も同じ資料から説明できる:
  同大会のセミファイナル(VS型・mark無しカード)は、
  `recoverStructuralParagraphBouts()` 実装の**直接の動機**になった2件の
  代表例の1つであり(もう1件はDEEP 130 IMPACTのノーコンテストの主戦)、
  同大会は「通常の主抽出パスの境界検出バグにより大半のboutが道連れで
  欠落する」既知の別バグの影響下にあったため、7bout全てがこの回収パスに
  依存していた。DEEP 130 IMPACTも70件のうち1件(大原樹理 vs 倉本大悟の
  ノーコンテスト)としてリストに含まれている。

### 除外した仮説(裏取りの結果、本件の原因ではないと確認)

1. **共催大会の除外リスト(`CO_HOSTED_PANCRASE_EXCLUSIONS`,
   `build-deep-records.ts` 120-128行目)**: 対象は
   2017-12-24/2019-11-17/2020-11-29/2022-04-10の4大会のみで、これらは
   43大会の変更リストに1件も含まれない。加えてこのリストは大会単位の
   全除外(該当すればイベントごと除外される)であり、今回のように大会数が
   238→238で一致(消失イベント0件)している事実と整合しない。→**無関係**。
2. **公式ニュース欄の混入除去(非プロ/非MMA除外フィルタ
   `isExcludedNonProBout`)**: このフィルタはstructural_paragraph回収パス
   自体の内部(パッチスクリプト側)でも既に適用済み(パッチのレポートで
   「非プロ/非MMA判定で除外: N件」と別途記録されている数字であり、
   committed済み70件はこのフィルタを通過済みのデータ)。`build-deep-records.ts`
   に `recoverStructuralParagraphBouts()` を配線した場合も同一フィルタを
   通すことになるため、この関数を呼びさえすれば差は消える性質のもので、
   フィルタ自体の挙動差ではない。→**今回の-70の直接原因ではない**
   (配線すれば再現される70件の中身がフィルタ後の数であることの説明であり、
   フィルタが差を生んでいるわけではない)。
3. **パーサ修正の副作用(既存フォーマットの抽出ロジック変更によるリグレッ
   ション)**: 消失70件は全件`structural_paragraph`のみで、他の10
   フォーマットからの消失は0件。もし何らかのパーサ修正が副作用を起こして
   いるなら特定フォーマット以外にも波及するはずだが、そうなっていない。
   → **既存フォーマットの抽出ロジックへの副作用は確認されなかった**。

## DEEP 45 IMPACT(pinned・17bout)が変化しない理由

DEEP 45 IMPACTは `DEEP_PINNED_MANUAL_SOURCES`(Wayback Machine経由の手動
指定ソース、`build-deep-records.ts` 288-297行目)から取得される17boutで、
全bout `format: "group2_no_heading"`(structural_paragraphではない)。
`recoverStructuralParagraphBouts()` はそもそもこの大会のboutを1件も
回収していない(元のパッチレポートにもDEEP 45 IMPACTへの言及は無い)ため、
本調査の対象範囲外であり前後不変なのは当然の結果。

## 結論

- -70の全量は「`recoverStructuralParagraphBouts()` が
  `scripts/build-deep-records.ts` の通常ビルド経路に配線されておらず、
  一回限りのパッチスクリプトでしか反映されていない」という単一のパイプライン
  統合漏れで説明できる(70/70bout、43/43大会が同一原因)。
- 共催大会除外・非プロ/非MMA除外フィルタ・既存フォーマットのパーサ
  リグレッションは、いずれもデータ上の裏付けが無く除外した。
- **本調査はread-onlyであり、`scripts/build-deep-records.ts` への
  `recoverStructuralParagraphBouts()` 配線などの修正は行っていない。**
  修正時の論点(配線した場合に70件全件が完全に再現されるか、
  `daily-records-workflow` の日次ジョブでも今後同種の一括パッチが
  埋もれないようにする運用面の対応など)は本レポートの範囲外として別途
  判断が必要。

# 勝敗マーカーの誤読 横断調査(read-only)

調査対象: `data/{rizin,deep,pancrase,shooto}Records.json`(main時点、2026-07-31)。
修正は行っていない(`git diff` は `scripts/audit-winner-marker.mjs` の新規追加のみ)。

## 0. きっかけと結論の先出し

2023-10-01 RIZIN LANDMARK 6 万智 vs 渡辺彩華戦で、選手ページが両者とも「敗」表示になっている件(#292で個別対応中)について、**`rizinRecords.json` 自体の当該boutは正しい**ことをまず確認した。

```json
{"headingText":"第6試合／渡辺彩華 vs. 万智","fighterAName":"渡辺彩華","fighterBName":"万智",
 "fighterASlug":"watanabe-ayaka","fighterBSlug":"fukuda-machi",
 "resultType":"decisive","winnerName":"万智","winnerSlug":null, ...}
```

`winnerName="万智"` は正しく設定されている(渡辺彩華ではなく万智が勝者)。`data/fighterRecords.json` 側でも `watanabe-ayaka` の該当試合は `result:"loss"`(正しい・彼女は負けた)。一方 `fukuda-machi` は `fighterRecords.json` に**キー自体が存在しない**(未収録)。

→ この個別ケースの「両者敗」表示は、4団体の生データ(本調査対象)の破損が原因ではない。原因は選手DB未収録側(万智)のフロントエンド/生成ロジック側のフォールバック挙動にあると推定される。**これは本調査のスコープ外(4ファイルの外)**であり、`fighterRecords.json` 生成ロジックまたはフロントエンド表示コンポーネントの追加調査が必要。

以下、指示された4基準での機械的な横断チェック結果。

## 1. 団体別件数サマリー

| チェック内容 | RIZIN | DEEP | PANCRASE | SHOOTO | 合計 |
|---|---|---|---|---|---|
| ① 同一boutで両者勝ち/両者負け(パンクラスのleftMarkerRaw/rightMarkerRaw突合) | 0 | – | 0 | – | 0 |
| ② resultType=decisiveなのにwinnerName/winnerSlugが空・欠損 | 7 | 0 | 0 | 0 | 7 |
| ③ winnerNameが出場者どちらとも不一致 | 0 | 0 | 0 | 0 | 0 |
| ④ 勝敗マーカー記号(○×●等)が名前欄に混入 | 0 | 7 | 1 | 0 | 8 |

※①はRIZIN/DEEP/SHOOTOには両者独立マーカーのフィールドが存在しない(winnerNameの単一フィールドのみ)ため、構造上この基準を直接適用できるのはleftMarkerRaw/rightMarkerRawを持つPANCRASEのみ。

### 補足チェック(指示された4ファイルの範囲外だが、報告された症状の再現を試みたもの)

`data/fighterRecords.json`(選手別に展開された戦績)との突合で、同一boutについて両選手の記録が「両者win」または「両者loss」になっていないかを確認した。

| 補足チェック | 件数 |
|---|---|
| fighterRecords.json側で両者が同じ結果(両者win/両者loss) | **0**(修正後の再検証で確定。当初1件検出したが同日トーナメント2試合の誤突合によるfalse positiveと判明し除外) |
| fighterRecords.json側で片方の選手が未収録(比較不能) | 175 |

→ 生データ(4団体JSON)にも、選手別展開後(fighterRecords.json、mainマージ済み分)にも、「両者勝ち/両者負け」の矛盾は0件だった。万智のケースが再現しないのは、彼女がそもそも`fighterRecords.json`に未収録のため比較対象にならないから。

## 2. 該当30件以内の全件列挙

### ② resultType=decisiveなのにwinnerName欠損(RIZIN, 7件)

いずれも `methodRaw` に「勝敗なし」「DRAW」「判定0-0」等の表記があり、**resultTypeが"decisive"のまま誤ラベルされている**(本来は "no_contest" または "draw" であるべき)。

| 大会 | 日付 | 対戦カード | methodRaw |
|---|---|---|---|
| Yogibo presents RIZIN.33 | 2021-12-31 | 那須川天心 vs 五味隆典 | 2R終了(勝敗なし) |
| 超RIZIN/RIZIN.38 | 2022-09-25 | フロイド・メイウェザー vs 朝倉未来 | 2R 3分15秒 TKO レフェリーストップ(勝敗なし) |
| 超RIZIN/RIZIN.38 | 2022-09-25 | 皇治 vs ジジ | 3R 0分50秒 TKO レフェリーストップ(勝敗なし) |
| 湘南美容クリニック presents RIZIN.40 | 2022-12-31 | 平本蓮 vs 梅野源治 | 2R 3分00秒 勝敗なし |
| Yogibo presents 超RIZIN.3 | 2024-07-28 | マニー・パッキャオ vs 安保瑠輝也 | 3R 判定(0-0) |
| RIZIN WORLD SERIES in KOREA | 2025-05-31 | ジョ・サンヘ vs 宇佐美秀メイソン | 3R 判定(0-0)DRAW |
| RIZIN.53 | 2026-05-10 | 平本蓮 vs 皇治 | 3R 終了(勝敗なし) |

### ④ 勝敗マーカー記号が名前欄に混入(DEEP 7件、PANCRASE 1件)

| 団体 | 大会 | 日付 | カード# | 症状 | fighterAName | fighterBName | winnerName |
|---|---|---|---|---|---|---|---|
| DEEP | DEEP JEWELS 23 | 2019-03-09 | #2 | ○がBの名前先頭に結合 | にっせー | **○KOTORI** | null |
| DEEP | DEEP JEWELS 26 | 2019-10-22 | #1 | ●がBの名前先頭に結合 | 玉田育子 | **●KOTORI** | null |
| DEEP | DEEP 100 IMPACT ～20th Anniversary～ | 2021-02-21 | #1 | 判定注釈文がB欄をまるごと置換 | 安谷屋智弘 | **[判定3-0] ※20-18, 19-19×2** | null |
| DEEP | DEEP JEWELS 35 | 2021-12-11 | #2 | ▲(引分マーカー)がA・B両方の名前先頭に結合 | **▲音波** | **▲山口遥花** | null(resultType=draw) |
| DEEP | DEEP 107 IMPACT | 2022-05-08 | #2 | ○がB欄・winnerName欄をまるごと置換 | DJ.TAIKI | **○** | **○** |
| DEEP | DEEP 110 IMPACT | 2022-11-12 | #2 | ○がA欄をまるごと置換 | **○** | 酒井リョウ | null |
| DEEP | DEEP 110 IMPACT | 2022-11-12 | #3 | ○がB欄・winnerName欄をまるごと置換 | 北岡悟 | **○** | **○** |
| PANCRASE | PANCRASE REAL 2007 | 2007-04-08 | #8 | 2試合分のタイトル/勝敗注記がA・B両欄に混入(別bout結合疑い) | **鈴木みのる(三冠ヘビー級王者) ×冨宅飛駈(SGPグローバルジュニア王者)** | **シーサー・マスク○ ミラクルマン** | null |

うち DEEP 107 IMPACT #2・DEEP 110 IMPACT #3 の2件は、PR #290(#232のF6パターン)で既知として報告済みの同一事象。それ以外の6件(DEEP4件・PANCRASE1件のカードポジション差異込み)は本調査で新規に確認したもの。

## 3. 原因分類

| 分類 | 該当 | 内容 |
|---|---|---|
| **resultTypeの誤ラベル(no_contest/drawをdecisiveのまま放置)** | RIZIN 7件 | methodRawが「勝敗なし」「0-0」等を明示しているのにresultTypeが更新されていない。抽出スクリプトがresultType判定にmethodRawの当該パターンを含めていないと推測 |
| **勝敗マーカー記号(○×●▲)の名前欄への混入(完全置換型)** | DEEP 4件(JEWELS23, JEWELS26, 107, 110×2) | 元サイトのHTML構造で勝敗マーカーと選手名が隣接しており、パーサーが分離に失敗。マーカー単体または「マーカー+名前」の結合形で誤って名前欄に格納。PR#232で報告済みのF6フォーマットと同系統 |
| **判定結果注釈文による名前欄の完全置換** | DEEP 1件(100 IMPACT) | PR#290で既報の「判定・処分注釈が名前欄に混入」パターンと同一 |
| **複数bout/複数注記のテキストが1boutに結合** | PANCRASE 1件(REAL 2007) | タイトル名・段位・勝敗マーカーを含む長大な文字列が名前欄に丸ごと入っており、パーサーが試合区切りを誤認識した可能性。他3団体では未確認の局所パターン |
| **両者勝ち/両者負けの矛盾(データレベル)** | 0件 | 生データ・fighterRecords.json突合とも矛盾なし。報告された「万智/渡辺彩華」症状はこの層では再現せず |

## 4. 手法の限界・スコープ外

- ①のパンクラス`leftMarkerRaw`/`rightMarkerRaw`とwinnerNameの不一致チェックは0件だったが、これは「両フィールドが揃っている場合」のみの検証。片方が欠損しているケースは対象外(別途調査要)。
- ④のマーカー文字検出は正規表現ベースの機械的抽出であり、リングネームに使われる「☆」「★」は既知の誤検知源として除外済み(例: `ANIMAL☆KOJI`, `WINDY智美` は正常な名前)。除外後も未知の記号パターン(全角波ダッシュ・特殊約物等)による混入は検出対象外の可能性がある。
- `fighterRecords.json`との突合は、mainに現在マージ済みのデータ(351名)のみが対象。pancrase-records/shooto-records/deep-records-data等、未マージブランチ側で今後生成される`fighterRecords.json`は未検証。
- winnerSlugが導出可能(winnerNameがfighterA/BSlugのどちらかの表示名と一致)にもかかわらずnullのままのケースが、RIZIN 22件・DEEP 105件・PANCRASE 374件・SHOOTO 371件と広範に存在することを確認した(本調査の4基準には含まれないため件数のみ記録、個別列挙はしていない)。これ自体は「誤読」ではなく「未導出」だが、下流の選手別戦績生成がwinnerSlug依存だった場合の潜在リスクとして申し送る。

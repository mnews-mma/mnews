# B型38件の検出式修正 + 残り不一致の個別分類(指示書R-9フォローアップ)

前回レポート(`out/nc-audit-report.md`)に対する指示: (1)検出式をNC考慮に直して真の不一致件数を
確定させる、(2)残った不一致を個別に分類する。修正は未実施(read-only継続)。

## 0. 前提の訂正: 「B型38件」の出典を特定した

「B型38件」は、[PR #359](https://github.com/mnews-mma/mnews/pull/359)
(`investigate/header-table-row-mismatch`)自身の調査結果(`out/header-table-row-mismatch.csv`の
`pattern=B`、38行)そのものだった。同PRの定義:

> パターンB: ヘッダー=1行目(Wikipedia, wins+losses+draws)、テーブル=history.length
> (同じくWikipedia由来)。同一データソース内での不一致。

つまり検出式は `wins + losses + draws === history.length` で、これが前回レポートで私が独自に
再構築したものと同一だった。同PRの本文には「38件中34件は差分ちょうど1で...history配列に
result:"nc"が1件含まれ...確認できた。残り4件(所英男・住村竜市朗・北方大地・大原樹理)は
NC説明では片付かない」との記載がある。

**前回レポートでの訂正が必要な点**: 私は前回、`sato-shoko`(佐藤将光)と`kurobe-kazusa`(黒部和沙)を
この「B型」関連の不整合として調査したが、両者は**実際にはPattern Bの38件に含まれていない**。
- `sato-shoko`: `wins+losses+draws`(57) === `history.length`(57) が既に一致しており
  (内訳の入れ替わりで合計が偶然相殺されるケース)、単純な総数比較では検出されない。
  発見した「NC分を勝ちに誤算入している疑い」自体は実在する問題だが、Pattern B(総数不一致)
  ではなくPattern A寄りの内訳不一致であり、分類を誤っていた。
- `kurobe-kazusa`: ヘッダーが2行目(4団体合算, `computeMultiOrgRecord`)に切り替わっているため
  `pattern=A`に分類されており、そもそもPattern Bの対象外だった。発見した「日付欄のタイプミスで
  1試合が欠落」というバグ自体は実在するが、B型38件の一員ではない。

両者の調査結果自体は真正な発見のため本レポート末尾に「参考: スコープ外だが実在する発見」として
残すが、以降の「B型38件」の議論からは除外して集計し直す。

## 1. 検出式の修正

`scripts/audit-fighterrecords-tally-vs-history.ts` を新規追加した(#361に含む)。

- 旧式(粗い): `wins + losses + draws === history.length`
- 新式(NC考慮): `wins + losses + draws + ncCount === history.length`
  (`ncCount` は `history` 内の `result: "nc"` 行数)

`history.length === 0`(住村竜市朗のように集計値のみで対戦テーブル自体が記事に無い既知の
正常状態)も、#359のPattern B集計と母集団を揃えるため対象に含め、`isEmptyHistoryKnownCase`
フラグで区別できるようにした。

実行: `npx tsx scripts/audit-fighterrecords-tally-vs-history.ts`
出力: `out/nc-audit-b-type-nc-aware.json`

## 2. 再計算: PR #359のPattern B(38件)をNC考慮式で再検証

`out/header-table-row-mismatch.csv`(PR #359)の`pattern=B`38行を抽出し、各選手の実際の
`history`内`result:"nc"`件数と突合した(2026-08-02、mainブランチHEAD `02b28d4`時点のデータ)。

| 区分 | 件数 |
|---|---|
| NC行数で差分(diff)が完全に説明できる(=バグではない) | **29件** |
| NC行では説明できない(=別原因が残る) | **9件** |

PR #359本文の「34件がNC」という数字は、"diff がちょうど1"の集合をサンプル確認した結果の
概算であり、`kitakata-daichi`(北方大地、NC2件・diff2)や`ohara-juri`(大原樹理、NC3件・diff3)
のように**diffが2件以上でも実際にはNC件数と完全に一致する**ケースがあり、PR #359はこの2件を
誤って「NC説明では片付かない4件」の側に含めていた。NC行数を実際に数えて突合した結果、
正しくは29件がNCで完全に説明でき、9件が真に別原因である。

## 3. 真に別原因が残る9件

| slug | nameJa | wins-losses-draws | history総数 | nc行数 | diff | 既存トラック |
|---|---|---|---|---|---|---|
| sumimura-ryuichiro | 住村竜市朗 | 27-8-1 | 0 | 0 | -36 | (既知の正常状態) |
| tokoro-hideo | 所英男 | 36-34-1 | 63 | 0 | -8 | ★対象外(既存トラック) |
| patricky-pitbull | パトリッキー・ピットブル | 25-16-0 | 42 | 0 | +1 | ★対象外(PR #306) |
| nakamura-daisuke | 中村大介 | 35-29-1 | 64 | 0 | -1 | 分類対象 |
| strasser-kiichi | ストラッサー起一 | 21-13-2 | 35 | 1 | -2 | 分類対象 |
| kitaoka-satoru | 北岡悟 | 45-29-10 | 83 | 0 | -1 | 分類対象 |
| lee-kaiwen | リー・カイウェン | 16-8-0 | 23 | 0 | -1 | 分類対象 |
| uno-caol | 宇野薫 | 35-23-5 | 64 | 0 | +1 | 分類対象 |
| sugiyama | 杉山しずか | 23-8-1 | 33 | 0 | +1 | 分類対象 |

指示により`tokoro-hideo`(既にfighterRecordIntegrity.tsのコメントで「保留中ケース」と
明記済み)と`patricky-pitbull`(PR #306で個別調査済み)には触れない。残り**7件**を以下で
個別分類する。

## 4. 7件の個別分類(ja.wikipedia記事の実際の表記・自社公式データで裏取り)

すべて `wins+losses+draws ≠ history.length` の内訳を見ると、勝ち/負けいずれか1カテゴリだけが
ズレており、2カテゴリが相殺する「勝敗入れ替わり」型は**1件もなかった**。全件が
「bout欠落」(historyに1件足りない、または1件多い)型。

### 4-1. `sumimura-ryuichiro`(住村竜市朗) — 既知の正常状態、修正不要

`src/lib/fighterRecordIntegrity.ts`のコメントに明記済み: 「historyが空(集計値のみ持つ記事。
例: 住村竜市朗)は既知の正常状態」。記事に対戦テーブル(Fight-cont)自体が存在せず、
`{{MMA recordbox}}`等の集計値のみが記載されている。`resolveFighter()`もこのケースを想定して
「history が空でも集計が有効なら ja-wiki を採用する(捏造しない)」と設計している。
**バグではない。対応不要。**

### 4-2. `nakamura-daisuke`(中村大介) — bout欠落、一次ソースで裏取り済み

**原因**: 2026-05-04 vs 狩野優(敗北、DEEP 131 IMPACT 25th Anniversary)が、自社公式データ
`data/deepRecords.json`には存在する(`resultType: "decisive", winnerName: "狩野優"`)が、
ja.wikipedia記事(`中村大介 (プロレスラー)`)のFight-cont表にはまだ追加されていない
(記事本文を検索して不在を確認済み)。infobox側の`losses`集計値だけが先に更新され、
表側の行がまだ無い状態(Wikipedia編集側のカバレッジ遅れ)。

**一次ソース**: `data/deepRecords.json`(DEEP公式結果ベース)で当該試合の存在・結果を確認済み。
**対応**: 本セッションでは修正しない。将来的にはWikipedia側の追記を待つか、`RECORD_OVERRIDES`
(add型)で`data/deepRecords.json`を出典として追加することが可能(和田竜光・青木真也と同型の対応)。

### 4-3. `kitaoka-satoru`(北岡悟) — bout欠落、原因はテンプレートタグの大文字小文字ミス

**原因**: ja.wikipedia記事内に `{{fight-cont|×|山本颯志|5分3R終了 判定0-3|DEEP 124 IMPACT|
2025年3月15日}}` という行が実在するが、テンプレート名が小文字の`fight-cont`(正しくは
`Fight-cont`)になっている。`src/lib/feeds/wikipedia.ts`の`extractFightContBlocks()`は
リテラル文字列`"{{Fight-cont|"`(大文字F)を大文字小文字を区別して検索するため、この1行だけが
抽出漏れになっている(記事内の他86件は正しく`Fight-cont`表記でヒットしている)。

**一次ソース**: `data/deepRecords.json`で2025-03-15 vs 山本颯志(DEEP 124 IMPACT、北岡の敗北)
を確認済み。ja.wikipedia記事本文でも該当行の実在を確認済み(二重裏取り)。

**対応**: これは`kurobe-kazusa`の日付欄タイプミス(後述、スコープ外だが同種)と同じ「Wikipedia
記事側の表記ゆれにパーサが対応しきれていない」クラスの既知の限界。パーサを大文字小文字
非依存にする、または個別`RECORD_OVERRIDES`で当該boutを追加する、のいずれかで解消できるが
本セッションでは修正しない。

### 4-4. `lee-kaiwen`(リー・カイウェン) — bout欠落(疑い)、一次ソースで特定できず

**原因未特定**: infoboxの`wins=16`に対し、記事のFight-cont表(プロ総合格闘技節、24ブロック
=15勝8敗+開催前1件)は15勝までしか無い。テンプレート表記・日付表記に異常は見つからず、
`extractFightContBlocks`/`parseJaFightHistory`の抽出漏れではない(実データと再パース結果が
完全一致)。自社`data/rizinRecords.json`にはリー・カイウェンの試合が1件(2026-05-10敗北、
既にhistory・data双方に反映済み)しかなく、これ以上の裏取りができなかった。

**対応**: 一次ソース未確認のまま。infobox側の`wins`表記自体が古い可能性(記事の他の版で
数字だけ先に更新され、対応する1勝の追記が漏れている可能性)が高いが、特定の欠落試合を
指し示せていない。継続調査が必要。

### 4-5. `strasser-kiichi`(ストラッサー起一) — NC(1件)は正しく除外済みだが、別に+1勝+1敗の未解決差分

**確認事項**: `no_contests=1`はNC行(吉岡宏高戦、PANCRASE 2008 SHINING TOUR、
「ノーコンテスト（バッティング）」)と一致しており、正しく除外されている。それとは別に、
infoboxの`wins=21`・`losses=13`が、実際のFight-cont表(20勝12敗2分1NC=35件)より
それぞれ+1多い。

**既知の関連情報**: `src/lib/feeds/wikipedia.ts`のコード内コメント(2026-07-19)に、この選手の
記事本文(表ではなく地の文)に「2024年3月23日、RIZIN LANDMARK 9でイゴール・タナベと対戦予定
であったが、イゴールが前日計量で規定体重を3.25kg超過したことで試合は中止となった」という
記述があることが記録されている。実際に本文を確認し、この記述の実在を確認した。ただしこの
試合は不成立(計量失敗による中止)であり、そもそも「勝ち」でも「負け」でもない試合のため、
+1勝+1敗という2カテゴリ同時のズレの説明にはならない(不成立試合1件では最大でも1カテゴリの
説明にしかならない)。

**対応**: この記述以外に該当しそうな追加のboutをja.wikipedia記事本文・Fight-cont表から
発見できなかった。一次ソースで特定できず、**未解決のまま継続調査が必要**と記録する。

### 4-6. `uno-caol`(宇野薫) — バグではない。むしろこちらのデータの方が最新かつ正しい

**確認事項**: `history`に2026-07-13 vs 児山佳宏(敗北、Lemino修斗.7)が正しく記録されている
(記事のFight-cont表の最新行と完全一致)。ところがinfoboxの`losses=23`はこの最新の敗戦分が
まだ反映されておらず、23のまま止まっている(表が先行更新され、infoboxのサマリ数値の
更新だけが追いついていない、というよくあるWikipedia編集パターン)。

**対応**: **こちらのデータ(data/fighterRecords.json)の方が正しく、修正不要。** infobox側が
古い。Wikipedia側の追記を待つのみ。

### 4-7. `sugiyama`(杉山しずか) — バグではない。uno-caolと同型(表が先行)

**確認事項**: `history`に2026-03-14 vs 和田綾音(勝利、PANCRASE 361 フライ級クィーン・オブ・
パンクラス・チャンピオンシップ)が正しく記録されている(自社`data/pancraseRecords.json`の
公式結果とも一致: `winnerName: "杉山しずか"`)。infoboxの`wins=23`はこの最新の勝利分が
まだ反映されておらず、23のまま止まっている。

**対応**: **こちらのデータの方が正しく、修正不要。** infobox側が古い。

## 5. まとめ

| 区分 | 内訳 |
|---|---|
| NCで完全に説明できる(バグではない、修正不要) | 29件 |
| 既存トラックにつき対象外 | tokoro-hideo(所英男)、patricky-pitbull |
| 既知の正常状態(修正不要) | sumimura-ryuichiro(住村竜市朗) |
| バグではなく、こちらのデータの方が正しい(infobox側が古いだけ) | uno-caol(宇野薫)、sugiyama(杉山しずか) |
| 一次ソースで原因特定・裏取り済み(Wikipedia記事側の表記ゆれ) | nakamura-daisuke(中村大介、記事のカバレッジ遅れ)、kitaoka-satoru(北岡悟、テンプレート名の大文字小文字ミス) |
| 一次ソースで特定できず継続調査 | lee-kaiwen(リー・カイウェン)、strasser-kiichi(ストラッサー起一) |

**#359のA・C修正の受入条件(「B型が変化しないこと」)への示唆**: 上記の分類はすべて
`data/fighterRecords.json`生成バッチ(Wikipedia解析・パーサ)側の話であり、#359が対象とする
`src/app/fighters/[slug]/page.tsx`の表示ロジック(パターンA・C)には一切依存しない。したがって
#359のA・C修正を実施しても、本レポートの数字(NC説明29件・別原因9件)は変化しないはずであり、
`scripts/audit-fighterrecords-tally-vs-history.ts`の出力を#359適用前後で比較すれば
「B型が変化しないこと」を機械的に検証できる。

## 6. 参考: スコープ外だが実在する発見(前回レポートからの訂正)

前回レポートでPattern Bの一員として扱ったが、実際には対象外だった2件。発見自体は真正のため
記録を残す。

### `sato-shoko`(佐藤将光) — Pattern B対象外(合計が一致するため検出されない)。infobox側の
NC算入疑いを確認できた

ja.wikipedia記事の「プロ総合格闘技」節(アマチュア総合格闘技節は別途分離されており除外は
正常)を確認したところ、infoboxは`wins=38, losses=17, draws=2, no_contests=1, total=58`。
実際のFight-cont表(プロ節)は37勝17敗2分1NCの58ブロック(1件は開催前の未来対戦)で構成されて
おり、`losses`・`draws`・`no_contests`はinfoboxと完全一致するが、**`wins`だけが38(実際は37)と
1多い**。この差はNC行数(1)とちょうど一致しており、**infobox側の`wins`がNC判定になった
西村広和戦(Cage Force 9、2008-12-06、「無効試合（レフリングミス）」)を勝ちとして数えたまま
更新されていない**という記事側の不整合である可能性が高い(その後NC判定に修正された際、
表側の勝敗記号は「-」に直されたが、infoboxのサマリ数値は更新されなかったと推測される)。

**対応**: 記事側の特殊事情であり、こちらのデータ(37勝、NC1件を正しく除外)が正しい。
**修正不要。**

### `kurobe-kazusa`(黒部和沙) — Pattern A対象、日付欄のタイプミスでbout欠落

ja.wikipedia記事に `{{Fight-cont|○|[[澤田龍人]]|1R 3:38 ネックストレッチ|SHOOTO GIG TOKYO
Vol.36|2024年4月7月}}` という行が実在する。日付欄が「2024年4月**7月**」(「日」であるべき
箇所が「月」と誤記されている)ため、`parseJaDate()`の正規表現
`/(\d{4})年(\d{1,2})月(\d{1,2})日/`が一致せず、この1勝(2024-04-07、澤田龍人戦)が丸ごと
historyから欠落している。infobox(`wins=6, losses=1, draws=1, total=8`)と実際のFight-cont
表(8ブロック、6勝1敗1分)は完全に一致しており、記事側は正しい。

**対応**: これは`kitaoka-satoru`のテンプレート名タイプミスと同種の「Wikipedia記事側の
表記ゆれにパーサが対応しきれていない」既知の限界。PR #360(`fix/wiki-jadate-space`、
「年」直後のスペース表記対応)と同じ問題クラス。Pattern B(38件)対象外のため、本PRでの
修正は見送る(kurobe-kazusaはPattern Aの管轄)。

## 7. 修正の実施(指示書R-10、read-only解除)

上記4-3(`kitaoka-satoru`)の原因(テンプレート名の大文字小文字ゆれ)をパーサ側の汎用修正で
解消した。特定記事のハードコードではなく、`{{fight-cont|`のような表記ゆれ全般を吸収する形
(PR #360の`parseJaDate()`の`\s*`対応と同じ考え方)。

### 修正内容

`src/lib/feeds/wikipedia.ts`の`extractFightContBlocks()`(Fight-contブロックの切り出し)を、
マーカー検索だけ大文字小文字を無視するように変更した。実際のブロック内容のスライスは
元の大小そのままの文字列から行うため、抽出結果自体は変わらない。

```diff
 function extractFightContBlocks(scope: string): string[] {
   const marker = "{{Fight-cont|";
+  const lowerScope = scope.toLowerCase();
+  const lowerMarker = marker.toLowerCase();
   const blocks: string[] = [];
   let searchFrom = 0;
   while (true) {
-    const start = scope.indexOf(marker, searchFrom);
+    const start = lowerScope.indexOf(lowerMarker, searchFrom);
     if (start === -1) break;
```

### 検証: 全361選手を再走し、不一致件数が増えないことを確認

修正前後で `scripts/audit-fighterrecords-tally-vs-history.ts`(NC考慮版)を実行し比較した。

1. 修正前のdata/fighterRecords.jsonをバックアップ(`/tmp/fighterRecords-before-fix.json`)、
   NC考慮版監査を実行 → **357選手中11件不一致**。
2. パーサ修正後、`npx tsx scripts/update-fighter-records.ts`(スラッグ指定なし、全選手を
   Wikipediaから再取得)をバックグラウンドで実行(全361選手、逐次実行のため約20分)。
3. 再度NC考慮版監査を実行 → **361選手中11件不一致**(母集団が357→361に増えたのは、
   直近マージされた新規選手(`seki-tetsuya`(関鉄矢)含む4名)がこの実行で初めて
   Wikipedia解決されたためで、本修正とは無関係)。
4. 差分を突合: `kitaoka-satoru`が不一致リストから消え、代わりに`seki-tetsuya`(初回解決の
   新規選手、既存の別課題)が加わった。**それ以外の選手には一切変化なし**
   (=他の記事でのテンプレート名表記ゆれによる過剰マッチ・誤爆は発生していないことを確認)。
5. `kitaoka-satoru`個別確認: `history`に2025-03-15 vs 山本颯志(敗北、DEEP 124 IMPACT)が
   正しく追加され、`wins-losses-draws`(45-29-10)と`history.length`(84)が一致した。

### コミットするデータ差分は`--slug`指定で最小化

上記の全選手再取得(検証目的)はWikipedia側の最新反映(無関係な新規bout多数)を大量に含む
ため、そのままコミットせず`data/fighterRecords.json`・`data/fighterRecordsMeta.json`を
一旦元に戻し、`npx tsx scripts/update-fighter-records.ts --slug=kitaoka-satoru`で
北岡悟1人だけを再生成した(blast radiusを1人に限定。`update-fighter-records.ts`の
`--slug`モードの設計思想どおり)。結果、`data/fighterRecords.json`の差分は北岡悟の
history配列に1件(山本颯志戦)を追加する8行のみ。

### 最終検証

- `./node_modules/.bin/tsc --noEmit`: エラーなし
- `npm run build`: 成功
- `npm run test:mnews-rating`: 220件成功 / 0件失敗
- `data/rankings.json`: 無変更(バイト単位で一致)
- `scripts/check-fighter-records-integrity.ts`: fatal 0件 / warning 12件
  (13件→12件。`kitaoka-satoru`が解消された分)
- `npx tsx scripts/audit-fighterrecords-tally-vs-history.ts`: 357選手中10件不一致
  (11件→10件)

### 修正しなかった項目の記録(指示どおり)

- **`uno-caol`(宇野薫)・`sugiyama`(杉山しずか)・`nakamura-daisuke`(中村大介)**:
  記事(ja.wikipedia)のinfobox側が更新遅れなだけで、`data/fighterRecords.json`側の
  データの方が正しい(宇野薫・杉山しずかは表側が先行更新済みで最新の試合を正しく反映、
  中村大介は自社`data/deepRecords.json`で存在確認済みの試合がまだ記事の表に未掲載)。
  **修正しない。**
- **`lee-kaiwen`(リー・カイウェン)・`strasser-kiichi`(ストラッサー起一)**: 一次ソースで
  具体的な欠落試合を特定できなかった。**深追いせず保留として記録に留める。**
- **`kurobe-kazusa`(黒部和沙)**: Pattern B(38件)には含まれない(Pattern A対象)ため、
  本PRのスコープ外として据え置く。同種の日付タイプミス問題は将来的にPR #360の
  `\s*`対応と組み合わせて別途検討可能。

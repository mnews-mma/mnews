# RIZINパース失敗4大会の原因調査

調査日: 2026-07-27。`data/rizinRecords.json`で`bouts.length === 0`(パース失敗)になっている4大会(RIZIN.2/.5/.10/.21)について、それぞれの`resultsPageId`(`src/lib/mnewsRating/rizinEventIndex.ts`記載)を1回だけ取得し、既存の抽出関数(`src/lib/mnewsRating/rizinScraper.ts`の`splitIntoBoutChunks`・`parseBoutChunk`、無改変)にそのまま通して失敗箇所を特定した。

## ⚠️ 停止条件に該当(指示書§: 失敗原因が3種類以上に分かれた場合)

**4大会の失敗原因はそれぞれ独立した4種類**であり、指示書の停止条件「4大会の失敗原因が3種類以上に分かれた」に該当する。**このため手順2(修正の実装)以降は行っていない。** `data/`・`src/`・`scripts/`は一切変更していない(git diffゼロ)。以下は手順1(原因特定)のみの報告。

## 大会ごとの原因(全件)

### RIZIN.2(2016-09-25、resultsPageId=16997624)

**原因: 完全に別テンプレート。既存4フォーマット(A〜D)がいずれも前提とする`<h2 class="article-heading">`見出し自体が1つも存在しない。**

`splitIntoBoutChunks`は見出しが0件のため、ページ全体を1個の巨大チャンクとして返し(`starts.length === 0`→`[html]`)、その1チャンクに対しフォーマットA〜Dのいずれも一致せず失敗する。

このページの実際の構造は`<div id="match-list">`ベースの旧レイアウトで、以下のような形:

```html
<p class="match_info">第1試合</p>
<p class="match_info">RIZIN女子MMAルール<br>5分3R 無差別級</p>
<p style="text-align:center; font-weight: bold">(win)<a href="...">ギャビ・ガルシア</a><br>
<a href="http://jp.rizinff.com/_ct/16997402">1R 2'42" アームロック</a><br>
<a href="...">デスティニー・ヤーブロー</a>(lose)</p>
```

`(win)`/`(lose)`が**小文字**である点、決着方法(時間+方式)が選手名と同じ`<a>`並びの中に**別リンクとして**埋め込まれている点(フォーマットA〜Dのどれとも一致しない配置)が特徴。RIZIN.1(2016-04-17)がやはり旧テンプレートのため`rizinRecordOverrides.ts`に個別書き起こしされているのと同種の事情で、**RIZIN.2も同様の個別対応(新規パーサーか手動書き起こしか)が必要**と考えられる。

### RIZIN.5(2017-04-16、resultsPageId=17065978)

**原因: フォーマットBの勝敗マーカー正規表現が半角角括弧`[WIN]/[LOSE]`を前提としているが、実際のページは全角角括弧`［WIN］／［LOSE］`(U+FF3B/U+FF3D)を使っている。**

見出し分割自体は正常(13チャンク、`第1試合 才賀紀左衛門 VS 伊藤盛一郎`のような見出しテキストも正しく取れている)。該当`<h3 class="article-subheading">`の実際のテキスト:

```
［LOSE］才賀紀左衛門（2R判定 0-3）伊藤盛一郎［WIN］
```

`parseBoutChunkFormatB`の正規表現 `/^\[(\w+)\]\s*(.+?)\s*（([\s\S]*?)）\s*(.+?)\s*\[(\w+)\]/` は半角`\[`/`\]`のみを想定しており、全角`［`/`］`には一致しない(確認済み: 半角ASCII `[]` の正規表現でマッチさせるとfalse、全角`［］`で試すとtrue)。

### RIZIN.10(2018-05-06、resultsPageId=17164316)

**原因: フォーマットAの勝敗span要素の正規表現が`style="font-weight:bold"`(コロンの後にスペースなし)を前提としているが、実際のページは`style="font-weight: bold"`(コロンの後にスペースあり)を使っている。**

見出し分割・`<div class="raw-html">`・`<p style="text-align:center;">`の抽出までは正常に進むが、その内側の該当箇所:

```html
<span style="font-weight: bold">(WIN)<a href="...">堀口恭司</a> vs. <a href="...">イアン・マッコール</a>(LOSE)</span>
```

`parseBoutChunkFormatA`の正規表現 `/<span style="font-weight:bold">([\s\S]*?)<\/span>/` はコロン直後にスペースがない前提のため一致しない(確認済み: スペースなし版でfalse、スペースあり版でtrue)。

### RIZIN.21(2020-02-22、resultsPageId=17340654)

**原因: フォーマットAの`<div class="raw-html">`抽出が非貪欲マッチのため、1チャンク内に複数の`raw-html`divがある場合に最初のdiv(この大会ではYouTube動画埋め込みラッパー)の内側の入れ子`</div>`で早期に打ち切られ、実際の結果が書かれた2つ目の`raw-html`divに到達できない。**

各チャンクの構造:

```html
<div class="raw-html"><div style="position: relative; padding-bottom: 56.25%;" class="disable-autoplay-onscrolledintoview">
  <iframe ... src="https://www.youtube.com/embed/..."></iframe>
</div></div>
<div class="raw-html"><p style="text-align:center;">［RIZIN MMAルール：5分 3R（68.0kg）※肘あり］<br>
<span style="font-weight:bold">（WIN）<a href="...">朝倉未来</a> vs. <a href="...">ダニエル・サラス</a>（LOSE）</span>
<br>2R 2分34秒 KO（グラウンドパンチ）</p>
<p style="text-align:center; font-weight: bold"><a href="...">試合結果詳細</a></p></div>
```

`parseBoutChunkFormatA`の`rawHtmlMatch = chunk.match(/<div class="raw-html">([\s\S]*?)<\/div>/)`は非貪欲(`[\s\S]*?`)のため、最初の`<div class="raw-html">`から最初に現れる`</div>`(=動画ラッパーの内側divの閉じタグ)までしかキャプチャしない。その結果`rawHtmlMatch[1]`には`<p style="text-align:center;">`を含む本来の結果ブロックが一切含まれず、後続の`pMatch`が必ず失敗する(実測確認済み: このチャンクからの`rawHtmlMatch[1]`に`<p style="text-align:center;">`は含まれない)。

なお、勝敗マーカーはこの大会では全角括弧`（WIN）／（LOSE）`(RIZIN.21固有ではなくフォーマットAの通常表記と同じ全角)であり、ここは問題ない。**問題は括弧の全角/半角ではなく、raw-html divの抽出範囲そのもの。**

## まとめ表

| 大会 | 開催日 | 原因分類 | 原因の一言 |
|---|---|---|---|
| RIZIN.2 | 2016-09-25 | ①別テンプレート | `<h2 class="article-heading">`自体が存在しない旧`#match-list`構造 |
| RIZIN.5 | 2017-04-16 | ②括弧の全角/半角 | フォーマットBの`[WIN]/[LOSE]`(半角)regexが全角`［WIN］／［LOSE］`に非対応 |
| RIZIN.10 | 2018-05-06 | ③style属性のスペース有無 | フォーマットAの`font-weight:bold`(スペースなし)regexが`font-weight: bold`(スペースあり)に非対応 |
| RIZIN.21 | 2020-02-22 | ④raw-html div抽出範囲 | 非貪欲マッチが動画埋め込み用の1つ目のraw-html divで打ち切られ、結果本体の2つ目に届かない |

**4件とも異なる原因であり、指示書の停止条件(3種類以上)に該当するため、修正の実装(手順2以降)は行っていない。**

## 参考: 個々の修正自体は技術的には小さいが、判断を要する点

- RIZIN.2は他の3件と異なり「既存フォーマットの正規表現を微修正する」話ではなく、**RIZIN.1と同様の個別対応(新規パーサーを書くか、`rizinRecordOverrides.ts`に手動書き起こすか)の意思決定が必要**。RIZIN.1は1大会限りという前提で手動書き起こしが選ばれた経緯があるが、RIZIN.2以外にも同種の旧テンプレート大会が(2015年の2大会「SARABAの宴」「IZAの舞」を含め)他に存在する可能性があり、個別対応か汎用パーサーかの選択はスコープが今回の4件に留まらない可能性がある。
- RIZIN.5(全角括弧)・RIZIN.10(スペース有無)・RIZIN.21(div抽出範囲)は、それぞれ既存の対応する関数(`parseBoutChunkFormatB`/`A`/`A`)への局所的なパッチで解決できる可能性が高いことは確認できたが、**この3件の修正だけを先行して実装するかどうかも人間の判断**(指示書は「4大会の原因調査」を一体のタスクとして依頼しており、停止条件が全体にかかる)。

## 停止条件の該非(全項目)

- 失敗原因が3種類以上に分かれた → **該当(4種類)。このため以降の手順は実施していない**
- 既存80大会に差分が出た → 未実施(手順2以降を行っていないため評価対象外)
- 必達不変条件が破れた → 未実施(同上)
- ランキング順位移動が20件を超えた → 未実施(同上)

## 変更ファイル

`out/rizin-parse-failures.md`のみ。`data/`・`src/`・`scripts/`は無変更(git diffゼロ)。取得したHTML(4件)はリポジトリ外のスクラッチ領域に保存し、gitには含めていない。

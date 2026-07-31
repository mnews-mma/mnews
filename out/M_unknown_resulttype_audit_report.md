# resultType:"unknown" 全件監査(指示書M・read-only)

調査日: 2026-07-31。対象: `data/{rizin,shooto,pancrase,deep}Records.json`。
`src/`・`data/`への変更なし。修正は行っていない(実装はしない、と明示された指示)。

## 1. 団体別・年代別件数

| 団体 | 件数 |
|---|---|
| RIZIN | 2 |
| 修斗 | 10 |
| パンクラス | 24 |
| DEEP | 56 |
| **合計** | **92** |

DEEPが突出して多く、特に**2023年に23件が集中**している。DEEP内のフォーマット別内訳:

| フォーマット | 件数 |
|---|---|
| f2_method_middle | 30 |
| F1 | 15 |
| group1_vs | 8 |
| f8_fully_separated | 3 |

団体×年代の詳細は`out/audit_M_unknown_resulttype.ts`実行時の標準出力、全92件の生データは
`out/M_unknown_resulttype_all.json`参照。

## 2. 敢流(kanru)のbout(2023-11-26 DEEP OSAKA IMPACT 2023 3rd ROUND)の原因特定

### 実際のHTML(https://www.deep2001.com/deep-osaka-impact-2023-3rd-round/ より抜粋)

```html
<p class="wp-block-paragraph">▼DEEPフェザー級 5分2R<br>
<strong>●木村総一郎(パラエストラ加古川）</strong><br>
○<strong>森田敢流(パンクラス大阪稲垣組）</strong><br>
判定0-3</p>
```

**重要な構造上の非対称性**: 敗者側(木村総一郎)は「mark+氏名+ジム」が丸ごと同一の`<strong>`タグ内に
入っているのに対し、勝者側(森田敢流)は**勝敗マーク「○」が`<strong>`タグの外**に置かれ、氏名+ジムだけが
別の`<strong>`タグに入っている。この非対称なタグネストがDEEP公式サイト側の表記ゆれ(HTML入力担当者に
よる手打ちの揺れと推測される)。

### stripTags()後のbodyClean(`src/lib/mnewsRating/deepScraper.ts`の実関数で実際に変換した結果)

```
...|▼DEEPフェザー級 5分2R|●木村総一郎(パラエストラ加古川）|○|森田敢流(パンクラス大阪稲垣組）|判定0-3|...
```

`stripTags()`はすべてのHTMLタグを一律で`|`に変換し連続する`|`を1つに畳み込む
(`src/lib/mnewsRating/deepScraper.ts:33-49`)。`</strong><br>`(2タグ)は`|`1つに畳まれるが、
その直後にタグに包まれない生テキスト「○」が単独で存在するため、次の`<strong>`開始タグとの間に
**もう1つ`|`が生まれる**。結果、本来「mark+氏名(ジム)」が1セグメントであるべき箇所が
「mark+氏名(ジム)」「孤立したmarkだけのセグメント」「氏名(ジム)のみ」の3セグメントに分裂する。

### 実際に`extractDeepBouts()`(実関数)が返したRawBout

```json
{
  "format": "f2_method_middle",
  "fighterAMark": "●", "fighterAName": "木村総一郎", "fighterAGym": "パラエストラ加古川",
  "methodRaw": "○",
  "fighterBMark": "", "fighterBName": "森田敢流", "fighterBGym": "パンクラス大阪稲垣組"
}
```

F2正規表現(`mark+氏名(ジム) | METHOD | mark+氏名(ジム)`という3セグメント構造を前提)が、
上記の孤立した「○」セグメントを**method欄として誤って取り込んでしまう**。その結果:
- `fighterAMark`は正しく「●」を取得
- `methodRaw`は本来の"判定0-3"ではなく孤立した「○」になる(本来のmethod文字列
  「判定0-3」は氏名(ジム)セグメントの後ろに残ったまま、どの正規表現グループにも
  取り込まれずに切り捨てられる)
- `fighterBMark`は空文字列になる(本来の勝者マークがmethod欄に吸われたため)

### `resolveOutcome()`での判定(`src/lib/mnewsRating/deepScraper.ts:660-680`)

mark型判定: `a = markToResult("●")` → `"loss"`。`b = markToResult("")` → 不明(勝敗判定不能)。
`a==="win"&&b==="loss"`も`b==="win"&&a==="loss"`も成立しないためフォールバックし、
`methodRaw="○"`にNC/引き分け/中止のキーワードが含まれないため **`resultType: "unknown"`** で確定する。

**根本原因(確定)**: DEEP公式サイトのHTMLで、片方のコーナーの勝敗マークが`<strong>`タグの
外側に置かれる非対称な入力揺れがあり、`stripTags()`のタグ→`|`変換によって想定外のパイプ境界が
生まれ、F2正規表現(3セグメント固定構造)がmarkだけの孤立セグメントをmethod欄と誤認する。

## 3. 同じ原因で落ちているbout件数

92件中、`methodRaw`が単一の勝敗マーク文字(●○〇△◯×⚪⚫)そのものになっているケースを
機械的に抽出したところ、**23件が完全に同一のシグネチャ**だった(全てDEEP・全てformat
`f2_method_middle`。他団体・他フォーマットには1件も無い)。これが「マークが孤立して
method欄に誤って吸われるバグ」の再現件数と考えられる。

残り69件(RIZIN2・修斗10・パンクラス24・DEEP33)は別原因が混在しており、本調査では
個別の切り分けまでは行っていない(サンプル確認した範囲では: 「勝敗なし」等の明示的な
未確定試合、対戦相手名が「Warning」等に化けている別種のHTML異常、mark文字が
対戦相手名フィールド側に紛れ込む鏡像パターン「○KOTORI」等、が混在)。

## 4. 修正方針(実装はしない)

`stripTags()`または`extractF2Bouts()`の前段に、**孤立した単一マーク文字のみで構成される
パイプ区切りセグメントを検出し、直後の「氏名(ジム)」セグメントの先頭に統合する正規化パス**を
追加する案が最小変更かつ低リスクと考える。具体的には:

1. `bodyClean`を`|`で分割した配列に対し、要素が`^[●○〇△◯×⚪⚫]$`(前後空白除去後)に
   完全一致し、かつ直後の要素が氏名+ジムらしい形(`.+[(（].+[)）]`)である場合、その2要素を
   `孤立mark + 直後の要素`として結合してから元の文字列に戻す前処理関数を追加する。
2. これによりF2正規表現側は一切変更不要になる(入力側の正規化のみで対応可能)。
3. 適用後は`data/deepRecords.json`を再生成し、上記23件が正しく`resultType: "decisive"`に
   変わること、かつ他の(壊れていない)bout件数・内容に影響が出ないことを回帰確認する
   (特に`fighterBMark`が正しく勝敗マークを取得するようになるため、`winnerName`判定も
   同時に正しくなるはず)。
4. 残り69件(異なる原因)は本監査のスコープ外。原因分類が完了するまでは同じ機械的な
   正規化を適用しない(取り違いで別の誤りを生む恐れがあるため、個別確認してから対応する)。

## 5. 出力ファイル

- `out/M_unknown_resulttype_all.json`: 92件全件の生データ(団体・年・大会・フォーマット・
  対戦相手名・methodRaw)
- `out/audit_M_unknown_resulttype.ts`: 集計に使ったスクリプト本体

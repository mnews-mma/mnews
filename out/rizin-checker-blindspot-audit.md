# RIZINスクレイパー「検査器の同型盲点」監査(指示書①・read-only)

対象: `src/lib/mnewsRating/rizinScraper.ts` / `scripts/update-rizin-records.ts`
実施日: 2026-08-03
着手前確認: `gh pr list --state open` と `git worktree list` を確認。RIZIN系読み取り専用調査
(`feat/rizin-coverage-audit` #237, `feat/rizin-other-tag-audit` #246, `feat/rizin-parse-failures` #239)
は全てCLOSED、`fix/rizin-winnerslug-fujita-yamato` #356(DRAFT)は`data/rizinRecords.json`を
触るがwinnerSlugの個別修正でありスコープ非重複と判断し着手。

## 結論サマリ

1. **DEEPと同型の盲点は実在する。** `parseFailures`は「h2/h3見出しで分割したチャンクのうちパースに
   失敗した数」であり、抽出(`splitIntoBoutChunks`)と検査(`parseFailures`集計)は完全に同じ入口
   (`<h2 class="article-heading">` / 入れ子`<h3 class="article-subheading">`)を共有している。
   見出し自体が欠落・想定外の形になるケースには両方とも無力。
2. 独立根拠として使える候補は2系統見つかった: **(a)「≫ 試合結果詳細」個別ページリンクの`_ct/\d+` ID**
   (bout単位、2017年4月以降の大会で使用可)、**(b)「大会情報」タグ一覧ページの大会単位カタログ**
   (イベント丸ごと欠落の検出用、SARABAの宴のケースはこちら)。`data-id`属性はサンプルページ内には
   存在しなかった(ユーザー指示にあった「data-idをアンカーにしている」報告は今回未確認)。
3. axis (a) で全77大会(manualOverride除く)を突合した結果、**食い違いのある大会は9件**(停止条件30件には
   非該当)。このうち**実際にMMA本戦boutが消えている確定バグは1件のパターンで2bout**(RIZIN.28の
   メインイベントを含む)。残りは「2人制パーサー前提が崩れる特殊マッチ」3件と「チェック手法自体の限界」
   4+2件(era制約・detail link省略)に分類できた。
4. 超RIZIN(RIZIN.38)は既に`expandNestedH3Bouts`で修正済みのため現状では差分ゼロだが、**修正前の状態を
   シミュレートすると独立根拠(11)に対し抽出可能チャンクは最大4、差7が本手法で検出可能だったと確認**
   (最低限の妥当性確認をクリア)。SARABAの宴はaxis (a) では原理的に検出不能(ページ自体が
   `RIZIN_EVENT_INDEX`の外にあり、そもそもfetch対象にならない)なことを確認し、axis (b) (大会情報タグ
   一覧、`out/rizin-html-cache/tag_taikaijoho_p1.html`)に実在することも確認した。

---

## 1. 抽出根拠と検査根拠の同一性

`scripts/update-rizin-records.ts` の `buildEventBouts()`:

```ts
const chunks = splitIntoBoutChunks(html);       // 抽出の入口
let parseFailures = 0;
for (const chunk of chunks) {
  const raw = parseBoutChunk(chunk);
  if (!raw) { parseFailures++; continue; }       // 検査もこの同じchunks配列でしか走らない
  successful.push({ raw });
}
```

`splitIntoBoutChunks()`(`rizinScraper.ts:86-88`)は `<h2 class="article-heading">` で分割し
(`splitByH2`)、1つのh2チャンク内に複数の`<h3 class="article-subheading">`がまとめられている場合のみ
`expandNestedH3Bouts()`で展開する。つまり**チャンクの母集団自体がh2/h3見出しの出現数に完全に依存**して
おり、`parseFailures`は「その母集団の中で`parseBoutChunk`が失敗した数」でしかない。見出し自体が
存在しない・想定外の構造(旧`<div id="match-list">`型、SARABAの宴/RIZIN.1/RIZIN.2)や、1つの見出しの
中に複数の実質的な試合が展開しきれずに残っている場合は、**そもそもチャンクとして数えられないため
`parseFailures`にも計上されず、件数の一致だけを見ていると異常として検出できない**。これはDEEPで
実害を出した構造そのもの。

比較として、DEEPは既に`build-deep-records.ts`側で `parseFailures = Math.max(0, headingNumbers.size - rawBouts.length)`
という**抽出とは別に数えた見出し数**を基準に検査するよう直っている(`headingNumbers`は
`<p class="wp-block-paragraph">`ベースの独立集計)。RIZIN側はこの分離がまだ行われていない。

## 2. 独立根拠の候補

### (a) 「≫ 試合結果詳細」個別ページリンク(bout単位・推奨)

各bout見出しの直後には、その試合の個別詳細ページへのリンクが埋め込まれている:

```html
<p style="text-align:center; font-weight: bold"><a href="https://jp.rizinff.com/_ct/17825883"> ≫ 試合結果詳細</a></p>
```

`_ct/\d+` のIDはCMSが個別コンテンツに振るものであり、h2見出しテキストのパース結果とは無関係な系統。
ページ全体からこのリンクの**ユニークID数**を数えれば、h2/h3の分割に依存しない「想定bout数」の目安に
なる。実測(RIZIN.52)で `h2=13`(うち1件は非bout見出し「大会情報」)、独立リンク数=12、実際の抽出
bouts=12で一致を確認。

**既知の制約**:
- 2016年当時(RIZIN.3/RIZIN.4等、フォーマットB初期)はこのリンク自体がテンプレートに存在せず、
  独立根拠として使えない(0が返るが「全滅」ではなく「この時代は非対応」)。RIZIN.5(2017-04)以降は
  存在を確認。
- オープナー(第1試合)や記念興行の一部試合では、この詳細リンクが省略されているケースがある
  (RIZIN.14/.29、RIZIN LANDMARK 12、RIZIN師走で確認)。**独立根拠が抽出結果より少なく出るのは
  過検知(false negative)側の限界であり、必ずしも実際の欠落ではない。**

### (b) 「大会情報」タグ一覧ページ(イベント単位)

`https://jp.rizinff.com/_tags/大会情報` には `<div class="person"><a href="…/_ct/{id}">…<h4>{日付}<br>{大会名}</h4></a></div>`
という構造でRIZIN公式が認識している大会が列挙されている。ここに載っているのに`RIZIN_EVENT_INDEX`に
無い大会があれば、**イベント丸ごとの欠落**(axis (a)では原理的に検出できないカテゴリ)を検出できる。
SARABAの宴はこのタグページに実在することを確認済み(`out/rizin-html-cache/tag_taikaijoho_p1.html`)。

今回はこのタグページの取得・実在確認のみに留め、`RIZIN_EVENT_INDEX`(80件)との悉皆突合は行っていない
(タグページの`person`ブロックは86件あり広告枠等ノイズを含むため、正確な突合には別途パースロジックの
設計が必要。今後開催予定で結果が未確定の大会も含まれるため、単純な件数比較はできない)。**これは
別タスクとして切り出すのが妥当**と判断する(指示書のスコープは「候補を出す」までであり、悉皆突合は
「修正に必要な作業の見積り」の一部として扱う)。

### `data-id`属性について

ユーザーからの申し送りで「class名・data-idをアンカーにしているとの報告がある」とあったが、実際に
取得したページ(RIZIN.52、超RIZIN、RIZIN.2、RIZIN.5等)には`data-id`属性は1件も存在しなかった。
近い候補としてh2要素自体に`data-section-number="1."`のような属性が付与されているが、これは
**h2要素に付随する属性であり、h2アンカーと同一系統**(独立根拠にはならない)。`data-id`という
具体的な報告の裏付けは今回のサンプルでは取れなかった。

## 3. 現状の欠落規模(axis (a)による全大会突合)

対象: `RIZIN_EVENT_INDEX`のうち`manualOverride`でない77大会。全件HTMLを取得し
`out/rizin-html-cache/{resultsPageId}.html`にキャッシュ、独立リンク数と
`data/rizinRecords.json`の実際のbout数を突合。詳細は`out/rizin-independent-check-result.json`。

**食い違いのある大会: 9件**(停止条件「30件超」には非該当)

| 大会 | 独立根拠 | 抽出bouts | parseFailures | diff | 分類 |
|---|---|---|---|---|---|
| RIZIN.3(2016-12-29) | 0 | 13 | 2 | -13 | チェック手法の限界(era外・2016年当時は詳細リンク自体が存在しない) |
| RIZIN.4(2016-12-31) | 0 | 11 | 4 | -11 | 同上 |
| RIZIN.13(2018-09-30) | 13 | 12 | 1 | +1 | **真の抽出漏れ**(下記③) |
| RIZIN.14(2018-12-31) | 13 | 14 | 0 | -1 | チェック手法の限界(オープナーに詳細リンクなし) |
| RIZIN.28(2021-06-13) | 10 | 7 | 6 | +3 | **真の抽出漏れ**(下記①②、メインイベント含む) |
| RIZIN.29(2021-06-27) | 12 | 13 | 2 | -1 | チェック手法の限界(オープナーに詳細リンクなし) |
| RIZIN LANDMARK vol.3(2022-05-05) | 5 | 4 | 3 | +1 | **真の抽出漏れ**(下記③) |
| RIZIN LANDMARK 12(2025-11-03) | 18 | 19 | 4 | -1 | チェック手法の限界(オープナーに詳細リンクなし) |
| RIZIN師走の超強者祭り(2025-12-31) | 15 | 16 | 4 | -1 | チェック手法の限界(オープナーに詳細リンクなし) |

### ① 新規発見バグ: サブタイトル段落による非貪欲マッチの誤爆(RIZIN.28、2件、メインイベント含む)

`parseBoutChunkFormatA`の

```ts
const pMatch = rawHtml.match(/<p style="text-align:center;">([\s\S]*?)<\/p>/);
```

は非貪欲マッチのため、**チャンク内で最初に出現する`<p style="text-align:center;">`を掴む**。通常は
これがルール情報+選手情報を含む段落だが、RIZIN.28では「喧嘩道スペシャルマッチ」のような特別企画の
サブタイトルが独立した`<p style="text-align:center;"><span style="font-weight:bold">喧嘩道スペシャルマッチ</span><br></p>`
として先頭に入っており、`pMatch`がこちらを誤って掴んでしまい、本来の選手名・勝敗情報を含む2番目の
`<p>`に届かない。結果、`anchorMatches.length`が0になり`parseBoutChunkFormatA`が`null`を返し、
**メインイベント(朝倉未来 vs. クレベル・コイケ)を含む2件のMMA本戦boutが`data/rizinRecords.json`から
丸ごと消えている**(第10試合=メインイベント、第7試合=朝倉海 vs. 渡部修斗)。`parseFailures`としては
数値上見えているが(RIZIN.28は`parseFailures=6`)、その内訳(非bout見出し3件の正当な失敗と、
本物のbout失敗3件)を見分ける仕組みが無いため、**メインイベントが欠落していること自体が今回の
監査まで気づかれていなかった**。

### ② 2人制パーサー前提が崩れる特殊マッチ(3件、非MMA含む)

- RIZIN.28「第9試合／那須川天心vs.3人 スペシャルマッチ(那須川天心 vs. 大﨑孔稀、HIROYA、所英男)」:
  1対3の特別マッチ。`<a>`タグが4つ(那須川+対戦相手3名)出現し`anchorMatches.length !== 2`で失敗。
- RIZIN LANDMARK vol.3「第3試合 Exciting RIZIN presents グラップリングマッチ／所英男 & 金原正徳 vs.
  中村大介 & 太田忍」: 2対2の団体戦。`<a>`タグが4つで同様に失敗(グラップリングのため非MMA判定
  対象ではあるが、現状は「非MMAとして正しく除外」ではなく「パース自体が失敗」という形で消えている)。
- RIZIN.13「3 on 3 星取団体戦(韓国 vs. 日本)」: 選手個人名ではなく国名がプレーンテキストで
  入っており`<a>`タグが0(anchorMatches.length=0)で失敗。RIZIN鉄拳ルール(非MMA)のため実害は
  小さいが同型のすり抜け。

いずれも`RizinRawBout`のデータモデル(`fighterAName`/`fighterBName`の2名固定)自体が1対1試合しか
表現できない設計のため、パーサーのロジック修正だけでなく**型の拡張(何名参加のマッチかを表現する
必要があるか)の設計判断**が要る。

### ③ チェック手法側の限界(4+2件、実害なし)

- RIZIN.3/RIZIN.4(2016年当時): 「試合結果詳細」個別リンク自体がこの時代のテンプレートに存在しない。
  独立根拠(a)が使えない期間があることを示す既知の制約。
- RIZIN.14/RIZIN.29/RIZIN LANDMARK 12/RIZIN師走: オープナー(第1試合・第0試合)に詳細リンクが
  省略されているケースがあり、独立根拠が抽出結果より1件少なく出る。実データ側は正しく抽出できている
  ことを`tmp-rizin-chunk-classify.ts`で個別確認済み(全チャンクOK、該当チャンクのみdetail=無)。

## 4. 妥当性確認(超RIZIN・SARABAの宴)

- **超RIZIN(RIZIN.38)**: 現行コードは`expandNestedH3Bouts`で既に修正済みのため、現状のaxis (a)
  突合では差分ゼロ(h2=4, h3=11, 独立根拠=11, 抽出bouts=11で一致)。**修正前の状態(h2のみで分割した
  場合、最大4チャンク)をシミュレートすると独立根拠11との差が7になり、本手法で検出可能だったことを
  確認した**(過去の実際の修正の妥当性を裏付ける形での確認)。
- **SARABAの宴(2015-12-29)**: axis (a)は`RIZIN_EVENT_INDEX`に載っているイベントのページしか見ないため、
  そもそもインデックス外だったSARABAの宴を検出することは**原理的に不可能**(2026-08-02に既に
  `manualOverride:true`として追加・手動書き起こし済み)。axis (b)の「大会情報」タグ一覧ページ
  (`out/rizin-html-cache/tag_taikaijoho_p1.html`)には`SARABAの宴 / 2015年12月29日 / _ct/16969713`
  として実在することを確認した。**つまりSARABA型の欠落はaxis (b)でのみ検出可能であり、axis (a)だけ
  では不十分**というのが今回の結論。

## 5. 修正に必要な作業の見積り(修正は未実施)

1. **①サブタイトル段落バグの修正**: `parseBoutChunkFormatA`の`pMatch`を、`rawHtml`内の
   `<p style="text-align:center;">`候補全てを走査し、`font-weight:bold`のspanを含む(=実際に
   選手情報を含む)ものを優先的に採用するロジックに変更する必要がある。RIZIN.28で2件確認したが、
   同型パターン(サブタイトル付き特別企画マッチ)が他の大会にも存在するかどうかは、**今回のaxis (a)
   突合は「件数の一致/不一致」のみを見ており、"一致しているが実は違う段落を掴んでいる"ケースを
   検出できない**(たまたま件数が合っていても中身が誤っている可能性は残る)。修正時は全77大会の
   `raw-html`ブロックを`喧嘩道スペシャルマッチ`のような追加`<p>`の有無で全件走査し直す追加調査が
   必要。
2. **②多人数/団体戦マッチ対応**: `RizinRawBout`型が2名固定のため、1対3・2対2・3on3のような
   フォーマットを扱うには型自体の拡張が必要。確認できた件数は少ない(3件)が、設計変更を伴うため
   コストは①より高い。データモデルの変更方針(配列化するか、専用の別型を作るか)は人間の判断が要る。
3. **axis (b)(大会情報タグ×`RIZIN_EVENT_INDEX`)の仕組み化**: 現状`RIZIN_EVENT_INDEX`は完全手動
   追記(自動発見の仕組み無し、コード内コメントに明記済み)。定期的な突合(新規追加スクリプト)を
   作るかどうかは運用コスト次第。タグページの`person`ブロック(86件、広告枠等のノイズを含む)から
   正確に大会名を抽出するパーサー設計が前提になるため、今回の監査とは別の悉皆調査タスクとして
   切り出すのが妥当。

## 6. 取得HTMLキャッシュ

`out/rizin-html-cache/` 配下(83ファイル)。後続の修正作業で再取得不要。

- `{resultsPageId}.html` × 77件: `RIZIN_EVENT_INDEX`の全auto-fetch対象(axis (a)突合用)
- `chorizin38_17573018.html` / `saraba_16969713.html` / `rizin2_16997624.html` / `rizin5_17065978.html`:
  妥当性確認用サンプル(超RIZIN/SARABA/RIZIN.2/RIZIN.5)
- `rizin52_17825885.html`: 初期のDOM構造調査用サンプル(RIZIN.52)
- `tag_taikaijoho_p1.html`: axis (b)候補確認用(「大会情報」タグ一覧ページ)

axis (a)突合の生データ: `out/rizin-independent-check-result.json`(全77件の内訳・診断値)。

---

以上、指示書①の手順1〜4を完了。停止条件(差分30件超)には該当せず、全件の原因分類まで完了した。
修正は未実施(指示書の指示通り)。

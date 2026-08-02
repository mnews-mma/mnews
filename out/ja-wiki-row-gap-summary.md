# ja.wikipedia戦績表 行取りこぼし監査

読み取り専用調査。`src/lib/feeds/wikipedia.ts` の `parseJaFightHistory` が
ja.wikipedia記事の戦績表(`{{Fight-cont}}`テーブル)の行を取りこぼしていないかを、
`data/fighterRecords.json` に history を持つ全選手で確認した。修正は行っていない。

## 集計(必須3項目)

比較対象は「ja.wikipediaに実際に戦績表({{Fight-cont}}節)がある選手」のみ
(167人。en.wikipedia由来など該当節が無い選手107人は対象外 — 後述)。

- **総選手数(ja.wikipediaに戦績表がある選手)**: 167人
  (参考: history>0の全選手は274人)
- **記事本文の行数とhistoryの行数に差があった選手数**: 53人
- **総欠落行数(記事の戦績表行数 > dbのhistory行数の選手だけを合算。正味の欠落行のみ)**: 52行
  (参考: 符号付き合計は51行。db側の方が多い選手=将来戦の反映漏れ等が相殺している)

## 内訳(原因切り分け)

上記の「差」は2種類の異なる原因が混ざっているため、切り分けた:

- **パーサの取りこぼし** (sectionRowCount − parserKeptNow > 0の選手): 53人 / 合計53行
  — `parseJaFightHistory()`自体が「有効な1試合」と認識できず捨てている行。これが本来の意味での「取りこぼし」。
  - うち `marker-blank-future`(空欄マーカー=未開催の予定戦。仕様通りの除外で取りこぼしではない): 52行
  - **真の異常(空欄未開催を除いた実質的な取りこぼし)**: 1人 / 1行
- **パイプライン由来の差**(parserKeptNow − dbHistoryLen ≠ 0の選手、パーサのバグではない):
  未来日付フィルタ(`scripts/update-fighter-records.ts`)・`RECORD_OVERRIDES`(既知の個別補正)による増減。
- **「総合格闘技」節がFight-cont行を含む形で複数に分割されている選手**: 5人
  (`extractMmaSection`は最初に該当した節しか見ないため、後続の節の試合が丸ごと欠落する可能性がある)

## ja.wikipedia対象外(107人。集計から除外)

en.wikipedia由来で戦績を組み立てている選手、またはja記事はあるが「総合格闘技」節にFight-cont行が
無い選手。これらは記事側に比較対象となる戦績表そのものが無いため、上記の集計には含めていない
(含めるとdb側の行数がそのまま「欠落」としてカウントされてしまい、実際のパーサ問題と無関係な
ノイズになる)。

- ja記事自体が見つからない: 73人
- ja記事はあるが「総合格闘技」節/Fight-cont行が無い: 34人

## 取りこぼし行(パーサレベル)の理由内訳

- marker-blank-future: 52行
- date-empty: 1行

- うち `<ref>`脚注付き行: 0行
- うち 画像/国旗アイコン(`{{flagicon}}`等)混入行: 0行

## 上位: パーサ取りこぼし行数が多い選手

- 朝倉 海(asakura-kai): 節内29行 → パーサ採用28行 (取りこぼし1行) marker-blank-future:1
- 鶴屋 怜(tsuruya-rei): 節内13行 → パーサ採用12行 (取りこぼし1行) marker-blank-future:1
- 平本 蓮(hiramoto-ren): 節内8行 → パーサ採用7行 (取りこぼし1行) marker-blank-future:1
- 朝倉 未来(asakura-mikuru): 節内27行 → パーサ採用26行 (取りこぼし1行) marker-blank-future:1
- クレベル・コイケ(koike-kleber): 節内47行 → パーサ採用46行 (取りこぼし1行) marker-blank-future:1
- 秋元 強真(akimoto-kyoma): 節内14行 → パーサ採用13行 (取りこぼし1行) marker-blank-future:1
- RENA(rena): 節内22行 → パーサ採用21行 (取りこぼし1行) marker-blank-future:1
- 斎藤 裕(saito-yutaka): 節内33行 → パーサ採用32行 (取りこぼし1行) marker-blank-future:1
- YA-MAN(ya-man): 節内5行 → パーサ採用4行 (取りこぼし1行) marker-blank-future:1
- 摩嶋 一整(majima-kazumasa): 節内26行 → パーサ採用25行 (取りこぼし1行) marker-blank-future:1
- 冨澤 大智(tomizawa-daichi): 節内6行 → パーサ採用5行 (取りこぼし1行) marker-blank-future:1
- ジョリー(jolly): 節内5行 → パーサ採用4行 (取りこぼし1行) marker-blank-future:1
- 高木 凌(takagi-ryo): 節内15行 → パーサ採用14行 (取りこぼし1行) marker-blank-future:1
- 平本 丈(hiramoto-jo): 節内6行 → パーサ採用5行 (取りこぼし1行) marker-blank-future:1
- 佐藤 将光(sato-shoko): 節内58行 → パーサ採用57行 (取りこぼし1行) marker-blank-future:1
- 後藤 丈治(goto-joji): 節内29行 → パーサ採用28行 (取りこぼし1行) marker-blank-future:1
- 伊藤 裕樹(ito-yuki): 節内28行 → パーサ採用27行 (取りこぼし1行) marker-blank-future:1
- NOEL(noel): 節内7行 → パーサ採用6行 (取りこぼし1行) marker-blank-future:1
- ホベルト・サトシ・ソウザ(souza-roberto-satoshi): 節内25行 → パーサ採用24行 (取りこぼし1行) marker-blank-future:1
- 武田 光司(takeda-koji): 節内28行 → パーサ採用27行 (取りこぼし1行) marker-blank-future:1

## 上位: 記事行数とdbのhistory行数の差が大きい選手(全原因込み)

- 朝倉 海(asakura-kai): 記事29行 / db history28行 (差1) [パーサ採用28] 
- 鶴屋 怜(tsuruya-rei): 記事13行 / db history12行 (差1) [パーサ採用12] 
- 平本 蓮(hiramoto-ren): 記事8行 / db history7行 (差1) [パーサ採用7] 
- 朝倉 未来(asakura-mikuru): 記事27行 / db history26行 (差1) [パーサ採用26] 
- クレベル・コイケ(koike-kleber): 記事47行 / db history46行 (差1) [パーサ採用46] 
- 秋元 強真(akimoto-kyoma): 記事14行 / db history13行 (差1) [パーサ採用13] 
- RENA(rena): 記事22行 / db history21行 (差1) [パーサ採用21] 
- 斎藤 裕(saito-yutaka): 記事33行 / db history32行 (差1) [パーサ採用32] 
- 摩嶋 一整(majima-kazumasa): 記事26行 / db history25行 (差1) [パーサ採用25] 
- 冨澤 大智(tomizawa-daichi): 記事6行 / db history5行 (差1) [パーサ採用5] 
- ジョリー(jolly): 記事5行 / db history4行 (差1) [パーサ採用4] 
- 高木 凌(takagi-ryo): 記事15行 / db history14行 (差1) [パーサ採用14] 
- 平本 丈(hiramoto-jo): 記事6行 / db history5行 (差1) [パーサ採用5] 
- 佐藤 将光(sato-shoko): 記事58行 / db history57行 (差1) [パーサ採用57] 
- 後藤 丈治(goto-joji): 記事29行 / db history28行 (差1) [パーサ採用28] 
- 伊藤 裕樹(ito-yuki): 記事28行 / db history27行 (差1) [パーサ採用27] 
- NOEL(noel): 記事7行 / db history6行 (差1) [パーサ採用6] 
- ホベルト・サトシ・ソウザ(souza-roberto-satoshi): 記事25行 / db history24行 (差1) [パーサ採用24] 
- 武田 光司(takeda-koji): 記事28行 / db history27行 (差1) [パーサ採用27] 
- エドポロキング(edpolo-king): 記事4行 / db history3行 (差1) [パーサ採用3] 

## 手動追跡調査(スクリプト出力後に個別確認)

自動集計だけでは「本当のバグ」と「仕様通りの除外」が区別できない2パターンについて、
実際のwikitextを取得して手で確認した。

### ①「複数節に分散」5人 → 全件、仕様通りの除外と確認(バグではない)

`otherSectionsRowCount > 0` の5人(堀口恭司・扇久保博正・久保優太・ジョン・ドッドソン・
エンカジムーロ・ズールー)全員の記事を直接確認したところ、"他の節"の中身は以下のいずれかで、
すべて**エキシビションマッチ／非公式戦**だった:

- `=== 総合格闘技エキシビション ===`(ドッドソン・ズールー)
- `=== プロ総合格闘技（エキシビション） ===`(久保優太)
- `=== YouTube企画（総合格闘技） ===`(堀口恭司)
- 扇久保博正の「総合格闘技エキシビション」節には石渡伸太郎引退興行・TUFトーナメント等
  「判定なし」を含む6試合があったが、いずれも公式戦績に数えない性質の試合だった。

`extractMmaSection`が「最初に{{Fight-cont}}を含む節」だけを採用する実装は、この5人については
結果的にエキシビション節を正しく弾いている。**「複数の表に分割されている」という懸念は
今回の167人の範囲では実害ゼロだった**(ただし、もし将来「プロ戦績が本当に2節に分かれている」
記事が現れた場合はこの実装のままだと後半の節が丸ごと欠落するリスクは構造的に残る)。

### ②「date-empty」1件 → 実在するパーサバグ(唯一の真の取りこぼし)

石司晃一(`ishizuka-koichi`)の記事に、`{{Fight-cont|○|城田和秀|...|DEEP 86 IMPACT|2018年 2月24日}}`
という行がある。日付フィールドが `2018年 2月24日` で、**「年」と月の数字の間に半角スペースが
1つ挟まっている**。`parseJaDate()`の正規表現 `/(\d{4})年(\d{1,2})月(\d{1,2})日/` は
「年」の直後に数字が続くことを前提にしており、間にスペースが挟まると一致せず日付が空文字になる。
結果として `!date` 判定に引っかかり、**実在する勝利(○)の試合が1件、無音で欠落**している。

これは今回確認できた唯一の「本物のパーサバグ」。`cleanWikiMarkup()`が呼ばれる前の生の日付文字列に
対して直接正規表現をかけているため、`\s*`ではなく`年`直後を厳密一致させている箇所が原因。

## 出力ファイル

- `out/ja-wiki-row-gap-audit.csv`: 選手ごとの全指標
- `out/ja-wiki-row-gap-dropped-rows.csv`: パーサが取りこぼした行1件ごとの生データ(marker/opponent/event/date)

## 既知の留意点

- 比較対象は「ja.wikipedia記事」限定(指示どおり)。en.wikipedia由来で戦績を組み立てている選手・
  ja記事はあるがFight-cont節が無い選手(計107人)は対象外(上記「ja.wikipedia対象外」参照)。
- `sectionRowCount`は「採用された節(最初にFight-contを含む節)」の生行数。アマチュア節は既存ロジック通り除去済み(意図的な除外であり取りこぼしではない)。
- `dbHistoryLen`との差には、パーサ由来ではない差分(未来日付フィルタ・RECORD_OVERRIDES)が混ざる。
- **結論**: 167人中、本当にパーサが行を落としていたのは1人・1行(石司晃一、日付フィールドの
  空白によるパースミス)のみ。残り52人分の「差」はすべて「未開催の予定戦(空欄マーカー)」で、
  仕様通りの正しい除外だった。「複数節分散」5人も調査の結果すべて仕様通り。

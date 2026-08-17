# /kick yamakawa二重計上・NC誤変換・軽微3件 対応レポート

PR: `fix/kick-yamakawa-dup-nc-minor`(PR #575)。50人検品2周目(#572、読み取り専用)の
申し送り事項への対応。

## 項目1: yamakawa-toshihiroの二重計上解消+同型検出

### 裏取り結果

出典(`https://www.njkf.info/result/njkf2012_west_kyoto_result.html`)を実際に開いて確認した。
ページの**タイトル**は「12月5日 NJKF2021 west 京都大会〜ワイルドウエスト〜試合結果」、
**本文末尾**には「日時：**2021年**12月5日(日)」と明記されている。URLスラグに含まれる
「2012」はNJKF公式サイト側の命名の癖(実際の開催年とは無関係)であり、正しい開催日は
**2021-12-05**と確認できた(思い込みで直さず、実ページを開いて裏取り済み)。

### 根本原因

`scripts/standup-pipeline/ingest_njkf.py`の日付抽出ロジック(`extract_meta()`)には4段階の
フォールバックがある。このページは本文冒頭(最初の勝敗マーク記号より前)に完全な
「YYYY年M月D日」表記が無いため、最終フォールバック(ファイル名/URL中の西暦4桁 +
タイトル中の「N月N日」を組み合わせる)が使われる。URLの「njkf**2012**_west_kyoto」から
誤った年2012を、タイトルの「**12月5日**」から月日を取り、`2012-12-05`という誤った日付を
生成していた。本文末尾の正しい「2021年12月5日」表記は、既存のフォールバックのどの段階でも
参照される位置にない(先頭寄り検索のため)。

### 全DBでの同型検出結果

大会名文字列に埋め込まれた西暦4桁と、日付フィールドの年が食い違う行を全`data/kick/bouts_*.json`
(15団体+Wikipedia)から検出した。**6行が同型**として見つかった。**全6行が同一の1ページ
(上記NJKF URL)由来**で、それぞれ以下の対戦カードの各選手のbout行だった:

| 選手 | 対戦相手 |
|---|---|
| 優心 | 谷津晴之 |
| 山川敏弘 | 鈴木力登 |
| 中島 隆徳 | 松田龍聖 |
| エミNFC | AYA |
| 上野hippo宣子 | 寺西美緒 |

うち**2組(山川敏弘×鈴木力登、エミNFC×AYA)は正しい日付(2021-12-05)の行がRISE公式にも
別途存在しており、日付が食い違ったまま二重計上されていた**。残り3組(優心×谷津晴之、
中島隆徳×松田龍聖、上野hippo宣子×寺西美緒)はこのNJKF行が唯一の記録であり、二重計上は
無いが日付自体が誤っていた。

### 修正内容

`scripts/build-kick-data.ts`に`correctEventEmbeddedYearMismatch()`を追加し、全bout行の読み込み
時点(dedupe前)で適用した。大会名に埋め込まれた年が単一種類・大会名中の「N月N日」がdateの
月日と一致する場合のみ、dateの年を大会名側の年に補正する(誤補正防止のため、大会名に複数の
異なる年が埋め込まれている場合は補正しない安全側の設計)。日付を補正することで、既存の
`dedupe()`の同日キー機構がそのまま働き、山川敏弘×鈴木力登・エミNFC×AYAの2組は自動的に
正しくマージされた(重複除去ロジック自体への追加変更は不要だった)。

### 解消後の試合数

**yamakawa-toshihiro(山川敏弘)は22試合→21試合に修正された。**
```
{"date":"2021-12-05","event":"NJKF2021 west 京都大会 〜ワイルドウエスト〜",
 "opponentName":"鈴木力登","result":"win","methodRaw":"2R KO",
 "sourceUrl":"https://rise-rc.com/fighter/yamakawa_toshihiro/",
 "alsoFrom":["https://www.njkf.info/result/njkf2012_west_kyoto_result.html"]}
```
RISE公式の行が生き残り、NJKF公式のsource_urlは`alsoFrom`として保持される。

### ゲート新設

`scripts/check-kick-event-date-year-mismatch.ts`を新設し、`data/kick/generated/`に対して
同じ検出条件をゼロ件不変条件として再検証する(build-kick-data.tsの補正ロジックが将来の
リファクタで外れた場合の多重防御)。`package.json`のbuildチェーンに追加。

### 破壊テスト

`data/kick/generated/fighters/yamakawa-toshihiro.json`の1行を意図的に日付2012年・大会名に
「2021」を含む値へ書き換えてゲートを実行し、**実際にビルドが落ちる(exit 1)ことを確認**
(その後元に戻した)。

---

## 項目2: miru-bun-tienのノーコンテスト→「分」誤変換の修正

### 原因調査結果

`data/kick/bouts_knockout.json`の当該行を確認したところ、`method: "no_contest"`
`method_raw: "ノーコンテスト"`(テキストベースの判定は正しくno_contestになっている)一方、
`result: "draw"` `result_mark: "fight-log--draw"`だった。`scripts/standup-pipeline/bouts.py`の
KNOCK OUT専用パーサ(`KO_CLASS2RESULT`)を確認したところ、`nocontest`/`nocon`→`no_contest`への
マッピング自体は正しく実装されていた。つまりmnews側のマッピングロジックにバグは無く、
**KNOCK OUT公式サイト自身のHTML上で、このノーコンテスト試合に勝敗を表すCSSクラス
`fight-log--draw`(本来drawを表すクラス)がそのまま使われていた**ことが直接の原因と判明した。
実際にKNOCK OUT公式の選手ページ(`https://knockoutkb.com/fighters/meas_bunthen_467`)を
開いて確認したところ、通算成績欄には「56戦 49勝(15KO) 5敗 **1分 1NC**」とNCが分とは別枠で
明記されており、この試合の決着テキストも「ノーコンテスト」と明示されていた。ソース側の
CSSクラスとテキストが矛盾しているケースであり、より信頼できるテキスト側(method="no_contest")
を正として補正するのが妥当と判断した。

### 全DBでの同型検出結果

methodRaw(決着原文)に明示的なノーコンテスト系キーワード(「ノーコンテスト」「無効」、
取り込みスクリプト自身がmethod=no_contest判定に使っている語と統一)を含み、かつ構造化された
resultがdraw/win/lossになっている行を全`data/kick/bouts_*.json`から検出した。**7行**該当
(うち6行がKNOCK OUT公式・1行がBigbang公式)。

(注: 当初「method !== no_contest」という広い条件で検出したところ128件ヒットしたが、
大半(75件)は`method_raw: "勝敗無し"`(エキシビションマッチ、result="no_contest"は正しく
"#exi"由来で意図通り)で、method="other"はテキスト側に「ノーコンテスト」「無効」の
明示語が無いための正当な分類漏れ(バグではない)と判明したため、明示的なNCキーワードを
含む行に絞り込んだ。)

### 修正内容

`scripts/build-kick-data.ts`に`correctNoContestResultMismatch()`を追加し、
`method==="no_contest"` かつ methodRawに明示的なNC語を含む かつ `result`がdraw/win/lossの
いずれかの場合、resultを`"no_contest"`に補正するようにした。全bout行の読み込み時点で適用。

### ゲート新設

`scripts/check-kick-nocontest-result-mismatch.ts`を新設し、`data/kick/generated/`に対して
同じ検出条件をゼロ件不変条件として再検証する。`package.json`のbuildチェーンに追加。

### 破壊テスト

`data/kick/generated/fighters/miru-bun-tien.json`の該当行のresultを意図的に"draw"に書き換えて
ゲートを実行し、**実際にビルドが落ちる(exit 1)ことを確認**(その後元に戻した)。

---

## 項目3: 軽微3件の全DB件数把握+修正

### 3-1. 決着欄への勝者名の冗長表記(ishii-tatsuya)

**全DB件数: 14行**(fujihara-arashi・ishii-hiroki・ishii-tatsuya・kitamura-makoto・
matsumoto-toshio・matsuoka-riki・mutsuki-ebata(2件)・ootsuki-shouta・rui-ebata 他)。
出典(HoostCup公式等)が「勝者:江幡 KO 2:36」のように決着原文に勝者名を前置きする表記慣習を
持っており、mnewsはこれをverbatim(逐語)保持していた。勝者が誰かは対戦相手欄・勝敗欄の
組み合わせで既に判別できるため、決着欄では冗長。

**なぜ既存ゲートで捕捉されなかったか**: PR #570のwhitelist化(`isMethodLabelWhitelisted()`)は
「この形式が壊れたデータではない(出典の正当な表記)」と正しく判定するよう`WINNER_PREFIX_RE`を
設計しており、whitelistの目的(壊れた値の検知)には反していなかった。今回のissueは
「壊れていないが冗長」という表示品質の話であり、whitelistのスコープ外だった。

**修正**: `src/lib/kick/data.ts`の`methodLabel()`に、先頭の「勝者[:：]?\s*NAME\s*」パターンを
除去する処理を追加(whitelist自体は許容パターンとして維持しつつ、表示前に取り除く)。

**ゲート**: 既存の`check-kick-method-label-whitelist.ts`に、methodLabel()の出力が「勝者」で
始まる行が0件であることを検証する追加チェックを実装(独立した新規ファイルではなく、
methodLabel()の出力検証という同じ関心事のため既存ファイルを拡張)。

**破壊テスト**: `methodLabel()`内の勝者名前置き除去処理を一時的に無効化してゲートを実行し、
**実際にビルドが落ちる(exit 1、14件検知)ことを確認**(その後元に戻した)。

### 3-2. 大会名欄の完全な空欄(robu-kaman)

**全DB件数: 69行**。原因はevent フィールドが`null`ではなく**空文字列`""`**になっていたこと。
`src/app/kick/fighters/[slug]/page.tsx`の`{b.event ?? <span className="kick-empty">不明</span>}`は
nullish coalescingのため、`null`には反応するが空文字列`""`(falsyだがnullishではない)には
反応せず、「不明」バッジすら出ない完全な空欄になっていた。

**なぜ既存ゲートで捕捉されなかったか**: `check-kick-field-whitelist.ts`(PR-G)は
date・method・methodRaw・opponentName・kanaの5フィールドを検査対象にしていたが、**event
フィールド自体を検査対象に含めていなかった**(未対応だった、ゼロからの新設カテゴリ)。

**修正**: `scripts/build-kick-data.ts`のevent整形ロジックを`!b.event || isPlaceholderEventName(b.event) ? null : ...`
に変更し、空文字列もnull同様に扱う(既存の「不明」バッジ表示に統一)。

**ゲート**: `check-kick-field-whitelist.ts`に`event_empty_string`カテゴリを新設(既存ファイルの
拡張、ratchet対象に追加)。

**破壊テスト**: 生成データの1行のeventを意図的に空文字列へ書き換えてゲートを実行し、
**実際にビルドが落ちる(exit 1、`event_empty_string: 1件 > 前回基準0件`)ことを確認**
(その後元に戻した)。

### 3-3. 対戦相手名先頭の記号残存(ganeko-yuki)

**全DB件数: 7行**(NJKF公式4行「⚪️岩橋伸太郎」「⚪️志賀将大」「⚪️佐々木勝海」
「⚪️高橋大輝」、NKB公式3行「●sasori」「● 浅井義弘」「●藤野 伸哉」)。出典サイトの
勝敗マーク記号(○×△等)がそのまま対戦相手名欄の先頭に残っていた。

**なぜ既存ゲートで捕捉されなかったか**: `check-kick-field-whitelist.ts`の
`opponentName_markup_residue`カテゴリは`[=<]|\{\{|\|`(wikitextマークアップ記号)のみを
検査対象にしており、勝敗マーク絵文字・記号(⚪️○×△●等)は対象外だった。

**修正**: `scripts/build-kick-data.ts`に`stripLeadingKickMark()`を追加し、対戦相手名の先頭に
残った勝敗マーク記号を除去(既存の`stripTrailingKickPunct()`が末尾専用だったのに対する
先頭版)。

**ゲート**: `check-kick-field-whitelist.ts`に`opponentName_leading_mark_residue`カテゴリを
新設(既存ファイルの拡張)。

**破壊テスト**: 生成データの1行のopponentNameを意図的に「⚪️佐々木勝海」へ書き換えてゲートを
実行し、**実際にビルドが落ちる(exit 1、`opponentName_leading_mark_residue: 1件 > 前回基準0件`)
ことを確認**(その後元に戻した)。

---

## boutRows残余ゼロの確認

| 指標 | 修正前(baseline) | 修正後 | 差分 |
|---|---:|---:|---:|
| boutRows | 32,569 | 32,567 | **-2** |
| mergedDuplicateRows | 2,286 | 2,288 | **+2** |
| boutRowsOfficial | 20,739 | 20,737 | -2 |
| boutRowsWikipedia | 11,830 | 11,830 | 0 |

**boutRowsの減少2件は、mergedDuplicateRowsの増加2件と完全に一致し、すべて項目1
(yamakawa-toshihiro×鈴木力登、エミNFC×AYAの二重計上解消)によるもの**。項目2・3は
表示ロジック・resultカテゴリの補正のみで、行数の増減はゼロ(boutRowsは項目1の-2から
変化していない)。想定どおり残余ゼロで説明できた。

## 副作用: 外部基準比較ゲートのratchet更新

項目1の重複解消でyamakawa-toshihiroの掲載数が1減った影響で、`kickOfficialProfileCoverageBaseline.json`の
`deficitSum`が34833→34834(+1)へ微増した(二重計上により隠れていた既存の未収録が
可視化されたもので、新規の欠落ではない。同種の事象はPR #570でも発生・対応済み)。
`kickIdentityMergeRiskBaseline.json`は52→50へ**改善**(項目1の重複解消により、同名の
近接日付ペアがマージされ、誤結合リスク候補として検知されていた対象が減ったことによる
自然な改善、ratchetスクリプト自身が自動でタイト化)。

## npm run buildの成否

`/kick`関連の全ゲート(既存17件+新設2件+拡張2件、計21スクリプト)は個別実行・
`npm run build`のkick関連チェーン部分いずれも**全てOK**であることを確認した
(`kick:data`から`check:kick-*`まで、`★`(失敗マーカー)は0件)。

一方、`next build`(サイト全体、3,819ページの静的生成)については、本セッションの作業環境から
GitHub raw(`raw.githubusercontent.com`)への外部データ取得が**HTTP 429(レート制限)**を
返す状態になっており(直接`curl`で確認済み)、`/fighters/taira-tatsuro`等/kickと無関係な
既存MMA選手ページ(数千ページ規模、大きいJSONを外部取得している)のビルドが60秒タイムアウトで
失敗する状態だった。5回試行したが解消しなかった。これは本PRの変更に起因するものではなく
(発生箇所はいずれも/kick以外のページで、対象選手も毎回異なる)、環境側のレート制限による
一時的な問題である。`/kick`固有の変更の正しさは、`kick:data`+全`check:kick-*`ゲート(新設分
含む)の個別実行で確認済み。レート制限の解消を待って`next build`込みの完全な
`npm run build`を再実行することを推奨する(コーディネーター側でのマージ前再確認を想定)。

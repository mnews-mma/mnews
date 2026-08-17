# /kick サイレント失敗ビルドゲート導入(PR-G) 実施レポート

作成日: 2026-08-17(マージ前レビュー対応を反映して更新)
ブランチ: `feat/kick-silent-failure-gates`(PR #564)

**本PRはゲート(検査スクリプト)の追加と、その検査が現状どれだけの違反件数を検出するかの
可視化のみを行う。`data/kick/*.json` の中身(生データ)は一切変更していない
(新規のベースライン記録用/スナップショットJSONの追加のみ)。**

## マージ前レビュー対応(2026-08-17、2ラウンド)

### 1回目

マージ前レビューで2点の修正依頼を受け、対応した。

1. **origin/mainへの追従**: このブランチを切った後、`feat/kick-silent-failure-gates`が
   分岐した時点より後に **PR #563**(`fix(kick): 安保瑠輝也パース漏れ再調査+recordbox
   不一致19件診断+Wikipedia母集団拡張(718→833)`、commit `9b127cf`)がorigin/mainへ
   マージされた。`git fetch origin main && git rebase origin/main` でコンフリクト無く
   統合できた(#563は`scripts/build-kick-data.ts`のdedupe()にプレースホルダー対戦相手名
   [「不明」等]の重複除去バグ修正を追加しており、本PRのitem 1(`normName`の
   `normalizeKickName()`統一)とは別の行を触っていたため競合しなかった)。統合後
   `npx tsx scripts/build-kick-data.ts` を再実行し、`data/kick/generated/*` を#563後の
   最新データで作り直した。
2. **カバレッジ指標(item 4)の外部基準が構造的に自分自身を検証していた問題の修正**、
   および **Python-TS移植の手動同期が未ゲート化だった問題の修正**。詳細は下記
   「4. カバレッジ指標」「6. Python-TS移植の同期ゲート」参照。

### 2回目

マージ前レビューで追加のゲート要求(「手動編集が再生成で無言に巻き戻る」型のサイレント
失敗の検知)を受け、対応した。詳細は下記「7. 手動編集ドリフト検知ゲート」参照。
`git fetch origin main` を再実行したが、`feat/kick-silent-failure-gates`は既に最新の
origin/main(#565マージ後)を含んでおり、追加のrebaseは不要だった(このブランチの作業中に
origin/mainは#563→#565と2回進んでいたが、1回目のレビュー対応時に#565分まで既にrebase
済みだったため)。カバレッジ指標(item 4)のベースライン(159人)についても、#563の
母集団拡張(718→833)を踏まえて妥当性を再検証した(詳細は「4. カバレッジ指標」の
「#563の母集団拡張との関係」参照。結論: 159のまま据え置きが正しい)。

---

## 1. 正規化キーの一本化

### 特定した既存の正規化処理

- **「相手名寄せ」**(`scripts/build-kick-data.ts` の旧 `normName`):
  `NFKC正規化 + 空白除去 + 中黒(・･)除去 + 小文字化` のみ。
- **「Wikipedia記事(`realnames.json`)↔選手(`fighters.json`)の結合」**:
  `fightersByName.get(r.name)` による**完全一致のみ**。正規化処理そのものが無かった
  (半角スペース1つの有無・旧字体1文字の違いで結合そのものが失敗する状態)。

### 統一した正規化関数

新設: `src/lib/kick/nameNormalize.ts` の `normalizeKickName()`。適用順:

1. NFKC正規化(半角/全角英数字・半角/全角スペースの統一を含む)
2. 残った空白の除去
3. 引用符類・区切り記号の除去(ニックネーム囲みの各種引用符・プライム記号・中黒全角/半角・中点)
4. 旧字体・異体字の統一(`scripts/lib/fighterNameBackfill.ts` の `VARIANT_CHAR_MAP` と同一の
   対応表を踏襲: 髙→高、﨑→崎、齋/齊/斎→斉、濵→浜)
5. 字形が酷似する漢字/カタカナの統一(同ファイルの `HOMOGRAPH_CHAR_MAP` と同一の対応表:
   ニ→二、ロ→口、カ→力、エ→工、ト→卜)
6. 大文字/小文字の統一

`scripts/build-kick-data.ts` の `normName` をこの関数に差し替え、`realnames.json` の結合も
同じ関数による正規化キーへ変更した(同名異人の一意化ロジック自体は変更なし)。

### 統一前後の結合結果の変化(実測)

`npx tsx scripts/build-kick-data.ts` を統一前/統一後でそれぞれ実行し、生成された
選手ごとの全32,058〜32,062行の対戦相手解決結果(`opponentSlug`)を突合した。

| 指標 | 統一前 | 統一後 | 差分 |
|---|---:|---:|---:|
| 総bout行数(全選手合計) | 32,062 | 32,058 | −4(重複統合が増えた分) |
| 相手を解決できた行数 | 20,337 | 20,383 | +46 |
| `fuzzyResolvedCount`(表記ゆれ名寄せでの解決) | 186 | 235 | **+49** |
| `mergedDuplicateRows`(複数団体掲載の重複統合) | 2,202 | 2,206 | +4 |
| `reverseResolvedCount`(逆引き解決) | 70 | 70 | 0(変化なし) |
| `realnames.json` 結合(本名) | 158/158解決・0未解決 | 158/158解決・0未解決 | 変化なし(既存分は全件維持) |

**行単位の厳密diff(`(slug, date, opponentName, sourceUrl)` をキーに突合)**:
- 新たに解決した行: **49件**(すべて統一前は未解決 → 統一後に解決。逆方向=新たに解決しなく
  なった行は**0件**)
- 統合により行そのものが消えた(2行が1行に統合された)行: 4件
- 新たに追加された行: 0件

代表例(統一前は未解決、統一後に解決): 「岩崎 悠斗」(半角スペース入り表記)が旧字体差
(`岩﨑悠斗` vs `岩崎 悠斗`)により9件以上のbout行で一致していなかったものが、異体字統一に
より解決するようになった。同様に「大崎」/「大﨑」表記ゆれも複数件解決した。

**回帰は0件確認済み**(統一によって新たに解決しなくなった行は無い。字形類似統一
(ニ→二等)によって別人同士が誤って同一視されるケースも、`unmatchedBouts`(12件、変化なし)・
`manualRuleExclusions.json` の既存マッチ状況(統一前後で件数不変)を確認し、想定外の悪化は
無いことを確認した)。

---

## 2. フィールド値ホワイトリストのビルドゲート化

新設: `scripts/check-kick-field-whitelist.ts`(npm script: `check:kick-field-whitelist`)。
`data/kick/generated/`(ビルド直前に `build-kick-data.ts` が生成した最終データ)を検査する。

### 検査項目とベースライン件数(2026-08-17時点)

| フィールド | 検査内容 | 違反件数 |
|---|---|---:|
| `date` | `null` か、妥当な `YYYY-MM-DD`(カレンダー上実在する日付)か | **2件** |
| `method`(決着区分) | 既知の決着enum(SCHEMA.md記載の12種 + 実データ調査で発見した`disqualification`)に含まれるか | **0件** |
| `methodRaw`(決着原文) | wikitextテンプレート・タグの残骸(`{{`、`<ref>`、`<!--`)を含んでいないか | **4件** |
| `opponentName`(対戦相手名) | wikitextマークアップ記号(`=` `<` `{{` `\|`)を含んでいないか | **0件** |
| `kana`(読み) | ひらがな/カタカナ(半角含む)・長音符・中黒・空白のみで構成されているか | **33件** |

### 調査中に見つかった具体的な欠陥

- **`date`の2件はいずれもカレンダー上存在しない日付**(Wikipedia由来):
  `nagasaka-lyra` の `2025-06-31`(6月に31日は無い)、`sasaki-daizo` の `2025-02-29`
  (2025年はうるう年ではない)。形式は`YYYY-MM-DD`として正規表現には一致するが実在しない日付
  であり、従来のいかなる検査もこれを検出していなかった。
- **`methodRaw`の4件は全て `macto-saenchai-gym` の行で、`{{Cite web` というwikitextの
  引用テンプレート断片がそのまま残存**していた(例: `"2-1【判定負け】{{Cite web"`)。
  PR-22の`<ref>`/`<!--`除去では捕捉されないテンプレート残骸の新規発見。
- **`method`の`disqualification`(反則負け、72件)はSCHEMA.md記載のenum一覧に無かった値**
  だが、調査の結果これは正当な決着区分でありwikitext残骸ではないと判断し、ホワイトリストに
  追加した(SCHEMA.mdの記載漏れ)。
- **`kana`の33件**はいずれも「読み」フィールドの目的(かな検索・五十音順分類)に対して
  非かな文字を含む: ニックネーム引用符囲み(`"コング" コウセイ`)、ラテン文字表記
  (`COMACHI`、`HaseFlyskyGym`)、数字(`man48`)、タイ人選手のローマ字転写に使われる
  全角ピリオド(`ソー.カムイン`)、フランス語名の`=`区切り(`ジャン=クロード`)。

いずれも `data/kick/*.json` は変更せず、検出のみをゲート化した。

### ゲート破壊テストの結果

`data/kick/generated/fighters/tenshin-nasukawa.json` に合成の不正bout
(`date: "2099-13-40"`, `method: "illegal_method_value"`, `methodRaw: "{{Cite web|url=test}}"`,
`opponentName: "=|{{テスト}}<ref>"`)を注入して実行 → **date/method/methodRaw/opponentNameの
4カテゴリすべてで基準超過を検知しビルド失敗(exit 1)を確認**。注入後、
`npx tsx scripts/build-kick-data.ts` を再実行して生成データを元に戻し、ゲート再実行でOKに
復帰することも確認した。

---

## 3. 派生値の単一関数化

### 調査結果

`/kick/fighters`(一覧、`src/app/kick/fighters/page.tsx`)は `KickIndexEntry.boutCount`
(`data/kick/generated/index.json` 由来)、`/kick/fighters/[slug]`(詳細、同ディレクトリの
`page.tsx`)は `KickFighter.bouts.length`(`fighters/<slug>.json` 由来)を、それぞれ生の
フィールドとして直接参照していた。現状は `build-kick-data.ts` 側で両方とも同じ `bouts`配列
から一度だけ計算された値のため値自体は一致していたが、**ページ側のコードは2つの別経路
(別フィールド)を直接触っており、将来どちらか一方だけを書き換えると静かに乖離しうる**構造
だった。

### 実施した統一

`src/lib/kick/data.ts` に `getFighterBoutCount()` を新設し、一覧・詳細の両ページの
戦績数表示箇所(メタディスクリプション・戦績サマリー見出し・セクション見出し・0件判定)を
すべてこの関数経由に置き換えた(`src/app/kick/fighters/page.tsx`、
`src/app/kick/fighters/[slug]/page.tsx`)。

### 新設ゲート

`scripts/check-kick-bout-count-consistency.ts`(npm script:
`check:kick-bout-count-consistency`)。両ページが実際に呼ぶ `getFighterBoutCount()` を、
一覧側の入力(`KickIndexEntry`)・詳細側の入力(`KickFighter`)それぞれに適用し、
生成済み全3,300選手について結果が一致することを検証する。baselineは持たずゼロ件を要求する
(常設のratchetではなく、単一関数へ統一済みである以上ゼロ件が構造的に成立するはずのため)。

**現状の結果: 検査対象3,300人 / 不一致0件 / 詳細データ欠落0件。**

### ゲート破壊テストの結果

`data/kick/generated/index.json` の選手1名(`kong-kosei`)の `boutCount` を意図的に破壊
(+999)して実行 → **不一致1件を検知しビルド失敗(exit 1)を確認**
(`kong-kosei: 一覧=1009 / 詳細=10`)。`build-kick-data.ts` を再実行して復元後、OKに
復帰することも確認した。

---

## 4. カバレッジ指標

**★マージ前レビューで外部基準の定義に構造的な欠陥が指摘され、修正版に差し替えた
(2026-08-17、後述「マージ前レビュー対応」参照)。以下は修正後の最終版。**

### 外部基準として採用したデータソースと理由(修正後)

**`data/kick/kickWikipediaArticleSnapshot.json`**(ja.wikipedia記事の戦績表から、
`/kick`の取り込みパイプライン`ingest_wikipedia.py`を一切経由せず独立に再抽出した
選手ごとの試合数。出典: メインworktreeの`out/kana-leg4-report.md`・
`out/kana-leg4-per-fighter.csv`、718人分)を外部基準として採用した。

**旧版(初回実装)からの変更理由**: 初回実装は外部基準として
`data/kick/bouts_wikipedia.json`(=取り込みパイプライン自身が生成した「取り込み済み」
行数)を使っていた。これは**自分の取り込み結果を自分の掲載結果と比べているだけ**で、
取り込み漏れそのものを検知できない(取り込みが漏れていれば基準側も一緒に減るため差分が
出ない)。実際、取り込みパイプラインを経由しない独立の再抽出調査では、Wikipedia記事の
ある718人で欠落8,375行という、初回実装の「差分あり6人」とは全く乖離した規模の欠落が
見つかっている。外部基準は取り込みパイプラインと完全に独立した実装でなければ意味が
無いため、差し替えた。

### 選手名→slugの解決

`kickWikipediaArticleSnapshot.json`の`fighterName`(Wikipedia記事タイトル)を
`normalizeKickName()`(本PR item 1で統一した正規化関数)で正規化し、
`fighters.json`の表記名と突合する。**候補が1件に定まった場合のみ**解決する
(0件・2件以上=解決不能、誤結合を避けるため安全側に倒す)。

### 現状のベースライン(2026-08-17、マージ前最終レビュー時点)

| 区分 | 人数 |
|---|---:|
| スナップショット対象 | 718人 |
| 　└ 戦績表なし(`total=0`、比較対象外) | 216人 |
| 　└ 名前解決不能(比較対象外、下記参照) | 1人 |
| 　└ 比較実施 | 501人 |
| 　　　└ 一致(掲載数が外部基準以上) | 340人 |
| 　　　└ **差分あり(掲載数が外部基準を下回る、ベースライン)** | **161人** |

**名前解決不能6人→1人への修正(マージ前最終レビューで発見・修正)**: 当初、
`アマラ忍`・`クンタップ・ウィラサクレック`・`ゲーオ・フェアテックス`・`ジョムトーン・チュワタナ`・
`ブアカーオ・ポー.プラムック`の5人が「候補0件」で名前解決不能になっていた。原因は
スナップショット取得時点(2026-08-16)より後にマージされた#563がこの5人の表記名を
改名したため(本PRが追加した`data/kick/manualOverrides.json`の
`renamedFighterWikipediaIdentity`と全く同じ5人)、旧スナップショットの表記名が現在の
`fighters.json`と一致しなくなっていたもの。本PRは既にこの5人分の改名対応表を
`manualOverrides.json`として持っていたため、`check-kick-coverage-gap.ts`の名前解決時に
この対応表を読み、旧表記→新表記へ読み替えてから照合するよう修正した(表示は
スナップショット由来の元の表記のまま)。結果、5人中3人は一致(問題なし)、2人
(該当選手は下記gapリストに含まれる)は実際に差分ありと判明し、比較対象・差分あり件数
双方に反映された。**名前解決不能として残った1人**は`龍聖`(候補2件、同名異人)のみで、
これは#563自身の調査でも「既存のDISAMBIGUATION_OVERRIDES機構で正しく1名に紐付け済み」と
報告されており、本ゲートの安全側の設計(2件以上は解決しない)どおりの想定内の除外。

**差分あり161人という数字は初回実装(6人)から大幅に増えているが、これは想定どおり**
(外部基準を取り込みパイプラインと独立にしたことで、これまで検知できなかった取り込み漏れが
表面化したもの)。ゼロ件を目指すゲートではなく、現状値をベースラインとして固定し、今後
悪化したら検知する。代表例: `azuma`(AZUMA) 外部基準36試合 > 掲載30試合、
`andi-fugu`(アンディ・フグ) 外部基準70試合 > 掲載47試合、`kajiwara-ryuuji`(梶原龍児)
外部基準61試合 > 掲載39試合。個別の欠落原因調査・データ修正は本PRのスコープ外。

新設: `scripts/check-kick-coverage-gap.ts`(npm script: `check:kick-coverage-gap`)。
baselineは `data/kick/kickCoverageGapBaseline.json` にratchet方式(前回値を基準にし、
増加したら失敗・減少/同値なら基準更新)で記録する。スナップショット本体
(`data/kick/kickWikipediaArticleSnapshot.json`)は`out/`配下のCSVがgit管理外のため、
必要な列(`fighterName`/`total`/`covered`/`missing`/`noTableReason`)のみを抽出して
コミット対象としてブランチ内に取り込んだ(出典・抽出方法は同JSONの`_meta`フィールドに
記載)。

### #563の母集団拡張との関係(マージ前レビュー2回目の指摘への回答)

**指摘**: #563はWikipedia到達母集団を718→833人へ拡張した。本ゲートの外部基準
スナップショットも718人であり、数字が符合するため「同じ718人か、別の718人か」の確認が
必要。同一なら、833人への拡張分も本ゲートの基準に含めるべきかを検討すること。

**確認結果: 同一の718人である。** `scripts/standup-pipeline/build_coverage_population_v2.py`
内の定数 `LEG3_CSV = "/Users/kainakishiyoshi/Desktop/mnews/out/kana-leg3-wiki-existence.csv"`
が参照するファイルは、本ゲートの外部基準スナップショット
(`data/kick/kickWikipediaArticleSnapshot.json`)の出典である `out/kana-leg4-report.md` が
「対象母集団: レグ③で確認した『記事あり(完全一致)718件』(`out/kana-leg3-wiki-existence.csv`)」
と明記しているものと**同一パスの同一ファイル**であり、#563が説明する成長過程
「一覧2ページ509人→記事実在確認**718人**→前PRのスペース正規化+99人=817人→(#563)alias
+16人=833人」の「718人」の段階と完全に一致する。

**833人への拡張分(+115人、実測では120人の差分)を本ゲートの基準に含めるべきか判断した
結果: 含めない(#563拡張分は据え置き)。理由:**

1. #563の+99人(スペース正規化)・+16人(alias経由)は、いずれも**「Wikipedia記事が
   fighters.jsonの既存選手と一致するかどうか」の名寄せ範囲を広げた**もので、記事の
   戦績表そのものを`kana-leg4`方式(ネストしたテンプレート対応バグを自前で修正した
   独立パーサ)で再抽出し直したものではない。「新たにマッチする記事を発見した」段階で
   あり、「発見した記事の戦績表行数を、取り込みパイプラインを経由せず独立に数え直した」
   段階(=本ゲートの外部基準として必要な性質)にはまだ進んでいない。
2. この+115人前後について「外部基準の試合数」を得る唯一の現実的な手段は、現時点では
   `data/kick/bouts_wikipedia.json`(取り込みパイプライン自身の出力)しかない。これを
   基準に使うと、修正1で排除したはずの循環参照(パイプラインの出力を、パイプラインの
   検証基準として使う)を、まさにこの新規115人分についてだけ再導入することになり、
   ゲートの健全性が損なわれる。
3. データを捏造せず、既存の`kana-leg4`実測結果の範囲でのみ判断するという本PR全体の方針
   (「data/kick/*.jsonの生データは変更しない」と同様、独立検証データも実測済みの範囲を
   超えて拡張しない)に照らし、718人という現在の外部基準の範囲を尊重し、159人を
   ベースラインとして確定する。
4. **未対応のまま残る範囲であることは明示する**: `scripts/check-kick-coverage-gap.ts`は
   実行のたびに「参考(ゲート対象外): coverage_population.json(#563時点833人)のうち
   外部基準スナップショット(718人)に含まれない人数 = 120人」を診断ログとして出力する
   (ゲート判定には使わない)。この120人に対する`kana-leg4`相当の独立再抽出は、本PRの
   スコープ外の次PRへの申し送り事項とする。

### 名前解決の追加修正(マージ前最終確認で発見・同セッション内で修正)

上記の母集団確認の過程で、「名前解決不能6人」の内訳5人(`アマラ忍`等)が、まさに本PRが
`manualOverrides.json`に登録した改名5人と一致していることに気づいた。原因は
スナップショット(2026-08-16採取)が旧表記名のままで、#563マージ後の`fighters.json`
(新表記名)と正規化一致しなくなっていたため。`check-kick-coverage-gap.ts`の名前解決に
`manualOverrides.json`の`renamedFighterWikipediaIdentity`を読み替え用に適用する修正を
追加し、名前解決不能を6人→1人(`龍聖`、同名異人で候補2件、想定内の除外)に削減した。
これにより比較対象が496人→501人に増え、5人中2人が実際の差分ありと判明したため
**ベースラインを159人→161人に更新した。**

### ゲート破壊テストの結果(最終版で再実施)

改名解決の対象そのものである`shinobu-amara`(忍アマラ―、外部基準45試合)の掲載数
(`index.json`の`boutCount`)を意図的に0へ破壊して実行 → **差分あり件数が基準の161人から
162人へ増加したことを検知しビルド失敗(exit 1、実測で確認)**。`index.json`を復元後、
OK(161人)に復帰することも確認した。

---

## 5. 既存欠陥への遡及ゲート(合成フィクスチャによる回帰テスト)

5本の `test:kick-*` スクリプトを新設し、`npm run build` チェーンに追加した。各テストは
過去に実際に起きた壊れ方を最小限のフィクスチャで再現している。

| テスト(npm script) | 対応する過去の欠陥 | 検証対象コード |
|---|---|---|
| `test:kick-name-normalize` | 正規化不一致全般(本PR item 1の統一そのものの固定) | `src/lib/kick/nameNormalize.ts` |
| `test:kick-gym-suffix-split` | PR-9(検査C3、相手名への所属連結306件) | `scripts/build-kick-data.ts` の `splitOpponentGymSuffix` |
| `test:kick-nickname-dedupe` | #562(913de59、Wikipedia結合キー不一致+ニックネーム重複) | `stripQuotedNickname` + `normalizeKickName` |
| `test:kick-wikitext-nested-template` | PR-14(6fc6162、ネストテンプレートで決着・大会名・日付が空になる) | `scripts/lib/kickWikitextMirror.ts`(下記参照) |
| `test:kick-wikitable-cell-attrs` | PR-21.5(fd6543b、#559、セル属性による列ずれ) | 同上 |

### PR-14・PR-21.5のテストについての設計上の注記

これら2件の実装本体は `scripts/standup-pipeline/ingest_wikipedia.py`(Python、
`data/kick/bouts_wikipedia.json` をオフラインで生成するスクリプト)にあり、`npm run build`
チェーンには含まれない(Vercelのビルド環境にPython実行が保証されないため、ビルドをPythonに
依存させる設計変更は行わない)。そのため `scripts/lib/kickWikitextMirror.ts` として該当ロジック
(`find_fight_cont_blocks`・`_strip_cell_attrs`)をTypeScriptに移植し、そちらをテスト対象に
した。**Python本体を直接検査するものではなく、Python側を変更した場合は手動で同期が必要**
であることをファイル冒頭コメントに明記した。この「手動同期が必要」という前提自体が
見落としのリスクであるため、マージ前レビュー対応(下記「6. Python-TS移植の同期ゲート」)で
片方だけが変更された場合にビルドを落とすゲートを追加した。

### ゲート破壊テストの結果(各テストについて実施)

- `test:kick-name-normalize`: `nameNormalize.ts` の異体字統一マップから `﨑→崎` の対応を
  一時的に削除して実行 → **失敗を確認**(`expected="岩崎悠斗" actual="岩﨑悠斗"`)。復元後
  OKに復帰。
- `test:kick-wikitext-nested-template`: `findFightContBlocksMirror` を意図的に旧バグ実装
  (非貪欲マッチ)にすり替えて実行 → **3件のアサーション失敗を確認**(ネストしたテンプレート
  以降の日付・大会名・決着フィールドが軒並み欠落)。復元後OKに復帰。
- `test:kick-gym-suffix-split` / `test:kick-nickname-dedupe` / `test:kick-wikitable-cell-attrs`
  は現行実装に対して初回から成功しており、フィクスチャ自体が対応する過去の欠陥を正しく
  再現できていること(期待値との突合が機能していること)は上記2件の破壊テストで手法として
  確認済み。

---

## 6. Python-TS移植の同期ゲート(マージ前レビュー対応、修正2)

### 課題

`scripts/lib/kickWikitextMirror.ts`(上記item 5で作成)は `ingest_wikipedia.py` の
`find_fight_cont_blocks`・`_strip_cell_attrs` を手動移植したものだが、「Python側が変更
されてもTS側は自動的には追随しない」という注記があるだけの状態だった。これでは将来
Python側だけが変更された場合に必ず見落とされる。

### 実装内容

新設: `scripts/lib/extractPyFunction.ts`(Pythonソースからトップレベル関数のテキストだけを
抽出するユーティリティ。`def <name>(`行から、インデントの無い次の非空行の直前までを本体とみなす)。
新設: `scripts/check-kick-wikitext-mirror-sync.ts`(npm script: `check:kick-wikitext-mirror-sync`、
buildチェーンに追加)。

- `ingest_wikipedia.py` から `find_fight_cont_blocks`・`_strip_cell_attrs` のテキストを
  抽出し、SHA-256ハッシュを `data/kick/kickWikitextMirrorSyncBaseline.json` に記録する。
- **ファイル全体のハッシュにせず、対象2関数のテキストだけをハッシュ化する**理由:
  `ingest_wikipedia.py` は母集団判定・団体推定等の他ロジックも含む大きなファイルで、
  対象外の変更(#563のような無関係な修正)のたびに毎回ゲートが落ちるとノイズになり、
  本来検知したい変更が埋もれる。実際、修正2の実装中に「対象外の関数に無関係なコメントを
  追加してもゲートは反応しない」ことを確認済み(下記参照)。
- 不一致時はビルドを失敗させ、「`kickWikitextMirror.ts`も同じ修正が必要か確認し、両方直して
  から記録ハッシュを更新すること」という趣旨のメッセージと、記録済み/現在の関数テキストの
  差分を表示する。
- ベースラインの更新は自動ratchetにせず(Python側の変更が常に「悪化」とは限らないため)、
  `UPDATE_KICK_MIRROR_SYNC_BASELINE=1` を付けて明示的に再実行した場合のみ更新する。

### ゲート破壊テストの結果

`ingest_wikipedia.py` の `find_fight_cont_blocks` 内の1文字(`content_end = i - 2` を
`i - 3` に変更)を書き換えて実行 → **変更を検知しビルド失敗(exit 1)を確認**(記録済み/
現在の関数テキストの差分が表示されることも確認)。元に戻してOKに復帰することを確認した。

また、**対象外の関数**(`guess_org`)にコメントを追記して実行 → **ゲートは反応せずOKのまま**
であることを確認(ファイル全体ハッシュではなく関数単位ハッシュにした設計が機能していることの
確認)。こちらも元に戻した。

---

## 7. 手動編集ドリフト検知ゲート(マージ前レビュー対応、2回目)

### 調査(何が起きたか)

- `git show 8a66fff`(PR-18、#554)を確認: `data/kick/bouts_wikipedia.json`
  (`scripts/standup-pipeline/ingest_wikipedia.py`が生成するファイル。同時に
  `build-kick-data.ts`が直接読む入力でもある)を**直接手動編集**し、改名選手5人
  (`アマラ忍`→`忍アマラ―`等)の壊れた`fighter_slug`/`fighter_name`(旧名義のまま、
  `fighters.json`のどのidentityにも一致しない)を正しい値へ書き換えていた。
- `git show 9b127cf`(#563)を確認: `build_coverage_population_v2.py`を再実行して
  母集団を再生成した際、PR-18の手動修正が**再生成のたびに無言で巻き戻っていた**ことが
  発覚した。原因は、PR-18の修正が`bouts_wikipedia.json`(生成物)を直接書き換えただけで、
  それを生成する側のスクリプト(`build_coverage_population_v2.py`)のロジックには
  一切反映されていなかったため。#563は同スクリプトに`LEG3_NAME_RENAMES`という恒久的な
  リネーム表を追加し、再生成しても巻き戻らないよう根治した。
- **既存のunmatchedBoutsBaseline.json(ratchet、集計値)がなぜこの回帰を検知できな
  かったかも確認した**: #563は同じビルドで母集団を718→833人へ拡張しており、新規に
  マッチするようになったbout数の方が、この5人の巻き戻りによる減少分より大きかった
  ため、`unmatchedBouts`の**集計値は全体として悪化して見えなかった**(個別の回帰が
  無関係な改善に相殺されてマスクされた)。これはPR-Gが警戒すべき「集計ratchetの穴」の
  実例そのものであり、個別の既知の値を直接検証するゲートが別途必要という結論に至った。

### ゲート設計

- 新設: `data/kick/manualOverrides.json`(`manualRuleExclusions.json`と同じ発想の
  レジストリ)。改名5人それぞれについて `oldFighterName` / `newFighterName` /
  `reason` / `fixedInCommit` を登録。
- 新設: `scripts/check-kick-manual-edit-drift.ts`(npm script:
  `check:kick-manual-edit-drift`、buildチェーンに追加)。
  - **検査1(レジストリ、ゼロ件ゲート)**: 登録済みの各改名について、
    `data/kick/bouts_wikipedia.json`内に旧名義(`fighter_name`)の行が1件でも
    再出現していないか、新名義の行が0件(データごと消失)になっていないかを検証する。
  - **検査2(未登録の同型ドリフト、ratchetベースライン)**: レジストリに無い行でも、
    `fighter_slug`が`fighters.json`のどのidentityにも一致しないのに`fighter_name`が
    実在する選手の表記名と完全一致する行(=名前は既知なのに識別子だけが古い/壊れている
    状態)を検出し件数を記録する。

### 実測: 現在のドリフト件数

| 検査 | 件数 |
|---|---:|
| 検査1: レジストリ登録済み5件のうち巻き戻り | **0件**(5件とも正しく反映されたまま) |
| 検査2: 未登録の同型ドリフト(識別子不一致だが表記名は既知) | **0件** |

現時点でこの型のドリフトは0件(#563の根治後、健全な状態)。検査2のratchetベースラインは
0で記録し、今後1件でも発生したらビルドを失敗させる。

### ゲート破壊テストの結果

- **検査1**: `data/kick/bouts_wikipedia.json`の`忍アマラ―`(42行)を、PR-18修正前の
  壊れた状態(`fighter_name: "アマラ忍"`、`fighter_slug`を誰にも一致しない値)へ実際に
  書き戻して実行 → **「旧名義の行が42件再出現」「新名義の行が0件」の両方を検知し
  ビルド失敗(exit 1)を確認**。`data/kick/bouts_wikipedia.json`を元に戻し
  (`git diff --stat`で完全一致を確認)、OKに復帰することも確認した。
- **検査2**: 未登録の合成bout(`fighter_name: "安保瑠輝也"`、`fighter_slug`を
  意図的に無効な値に設定)を注入して実行 → **件数が基準の0件から1件へ増加したことを
  検知しビルド失敗(exit 1)を確認**。ファイルを元に戻し、OK(0件)に復帰することも
  確認した。

---

## 副次的な発見(本PRのスコープ外、修正はしていない)

- `test:kick-gym-suffix-split` のフィクスチャ作成中、選手「サンチャイ・TEPPENGYM」
  (1語のリングネーム)が他選手の対戦相手として表示される際、`splitOpponentGymSuffix`が
  「サンチャイ・TEPPEN」+所属「GYM」に誤分割して表示する既存バグを発見した。データ修正
  禁止のスコープのため本PRでは対応せず、別タスクとしてフラグした。
- `check-kick-field-whitelist` 実装時、`method` の実データに `disqualification`
  (反則負け、72件)というSCHEMA.md未記載の値が見つかった。データとしては正当なため
  ホワイトリストに追加した(SCHEMA.md自体の更新は本PRのスコープ外)。

---

## 他PRとのファイル競合リスク

**#563は2026-08-17 07:02 UTCにorigin/mainへマージ済み**(このレポート冒頭「マージ前
レビュー対応」参照)。rebaseで既に統合済みのためコンフリクトは解消済み。

作業完了時点(2026-08-17)で `gh pr list --state open` を再確認したところ、**新規PR
`#565 fix(kick): 選手一覧の戦績数不一致/ローマ字混在/件数食い違いの3件対応`
(`investigate/kick-fighters-list-diag`、draft=false、base=main)** が見つかった。
`gh pr diff 565 --name-only` で確認したところ、本PRと同じ3ファイル
(`scripts/build-kick-data.ts` / `src/app/kick/fighters/page.tsx` / `src/lib/kick/data.ts`)
を触っている。

内容を確認したところ、**ロジック面の重複は無い**: #565は本PR文中で「同じスコープ
(戦績数表示の単一化)は別セッションのPR #564が既に着手中だったため…重複実装は行っていない」
と明記しており、`gh pr diff 564` で本PRの内容を確認したうえで、`getFighterBoutCount()`
関連には触れず、別の指摘(`kanaBucket()`のひらがな未対応・件数表記の整理)のみを実装している
(#565のPR本文より)。ただし**同じファイルを触っている以上、マージ順序によってはgit上の
軽微なコンフリクト(行の近接による自動マージ失敗)が起きうる**ことは#565側も認めており、
後発でマージする側がrebaseで解消する前提。本PRからは#565のマージ順序には踏み込まない。

その他のopen PR(`#542`・`#530`・`#524`・`#522`)はいずれも読み取り専用の調査PRで、
対象ファイルへの書き込みは無い。

**マージ前レビュー2回目時点での再確認**: `#565`は既にorigin/mainへマージ済み(`gh pr
list --state open`にもう出てこない)。`git fetch origin main`でも新規のorigin/main進行は
無く(`feat/kick-silent-failure-gates`は既に#565分まで含んでいた)、追加のrebaseは
不要だった。

---

## npm run build の成否

`npm run build`(`kick:data` → 全 `check:*` → 全 `test:*` → `next build`)を、
origin/main(#563・#565マージ後の最新)を反映した状態でローカルにフルパス実行し、
**全工程が成功することを確認した**(`next build` は3,819ページを生成、`/kick/fighters`
および `/kick/fighters/[slug]`(3,300選手分)を含む。新設した
`check:kick-manual-edit-drift`ゲートも含め全12件の`check:kick-*`/`test:kick-*`が
成功)。

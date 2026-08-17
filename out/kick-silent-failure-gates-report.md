# /kick サイレント失敗ビルドゲート導入(PR-G) 実施レポート

作成日: 2026-08-17
ブランチ: `feat/kick-silent-failure-gates`(PR #564)

**本PRはゲート(検査スクリプト)の追加と、その検査が現状どれだけの違反件数を検出するかの
可視化のみを行う。`data/kick/*.json` の中身(生データ)は一切変更していない
(新規のベースライン記録用JSON 2件の追加のみ)。**

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

### 外部基準として採用したデータソースと理由

**`data/kick/bouts_wikipedia.json` の、選手本人のWikipedia記事に由来する行数**を外部基準
として採用した。

理由:
- 対象509人(`ingest_wikipedia.py` の母集団、ja.wikipedia個別記事に `{{Fight-cont}}` 戦績表
  を持つ選手)は、選手本人のWikipedia記事が「本人自身の戦績」として明示的に列挙した行数
  である。
- RIZIN・ONE等の他公式データは名簿の掲載元ではなく戦績専用ソースであり、全選手を横断する
  「この選手が本来何試合しているか」の独立基準にはならない(名簿掲載選手の一部にしか
  戦績が無い)。Wikipediaは選手本人の記事という単位で「この人物の試合数」を明示的に
  述べている点で、掲載数と直接比較できる数少ない独立ソースである。

### 判定方法

`bouts_wikipedia.json` の各行の `fighter_slug`(identity形式の文字列)ごとに行数を数え、
`fighters.json` のidentityと一致するもの(=名簿に実在する選手本人の記事)だけを対象にする。
`slugs.json` でslugへ変換し、`data/kick/generated/index.json` の `boutCount`(掲載数)と
比較する。**外部基準の試合数 > 掲載数** の選手を「差分あり」としてカウントする(逆に掲載数の
方が多いのは、公式一次ソース側にWikipediaが拾っていない試合が別途あるという正常な状態であり
差分に含めない)。Wikipedia行が1件も無い選手は「基準なし」として別集計にし、違反件数には
含めない。

### 現状のベースライン(2026-08-17時点)

| 区分 | 人数 |
|---|---:|
| 外部基準あり(Wikipedia本人記事に戦績行が存在) | 562人 |
| 　└ 掲載数が外部基準以上(一致) | 556人 |
| 　└ **掲載数が外部基準を下回る(差分あり、ベースライン)** | **6人** |
| 基準なし(Wikipedia本人記事に戦績表が無い、または対象外) | 2,738人 |

差分ありの6人はいずれも1〜6試合分の小さな差(例: `arekusanda-usutinofu` 外部基準71試合 >
掲載65試合)で、複数団体重複試合の統合ルールとの相互作用等、個別調査が必要な事案として
記録するに留める(本PRでのデータ修正は行わない)。

新設: `scripts/check-kick-coverage-gap.ts`(npm script: `check:kick-coverage-gap`)。
baselineは `data/kick/kickCoverageGapBaseline.json` にratchet方式(前回値を基準にし、
増加したら失敗・減少/同値なら基準更新)で記録する。

### ゲート破壊テストの結果

外部基準ありグループの中で従来「一致」側だった選手
(`burakupansa-beinoa`、外部基準11試合)の掲載数(`index.json`の`boutCount`)を意図的に0へ
破壊して実行 → **差分あり件数が基準の6人から7人へ増加したことを検知しビルド失敗
(exit 1)を確認**。`build-kick-data.ts` を再実行して復元後、OK(6人)に復帰することも
確認した。

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
であることをファイル冒頭コメントに明記した。

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

作業完了時点(2026-08-17)で `gh pr list --state open` を再確認した。同じ2ファイル
(`src/lib/kick/data.ts` / `scripts/build-kick-data.ts`)を将来触りうる関連PRとして
`#563 fix/kick-anpo-parsegap-and-population-closure` があるが、`gh pr diff 563 --name-only`
は空(まだ実装なし、scope-claimのみ)であり、**現時点でのコンフリクトは無い**。#563が実装を
進めた場合、本PRの正規化統一(item 1)・`getFighterBoutCount`統一(item 3)と同じ関数に
触れる可能性があるため、マージ順序の調整が必要になる可能性がある(本PRからは踏み込まない)。

---

## npm run build の成否

`npm run build`(`kick:data` → 全 `check:*` → 全 `test:*` → `next build`)をローカルで
フルパス実行し、**全工程が成功することを確認した**(`next build` は3,819ページを生成、
`/kick/fighters` および `/kick/fighters/[slug]`(3,300選手分)を含む)。

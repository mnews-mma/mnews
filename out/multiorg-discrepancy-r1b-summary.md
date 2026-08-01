# 指示書R-1b: 4団体通算(2行目)が1行目を上回る45名の原因分類(read-only)

## 前提

- R1で「2行目(computeMultiOrgRecord)が1行目(data/fighterRecords.json)を勝・敗・分・総試合数いずれかで上回る」選手を全選手突合で列挙した結果、45名該当(指示書の停止条件「10名超」に該当したため、修正は一切行わず本調査のみ実施)。
- 本調査は read-only。src/・data/への変更は無し。

## 手法

1. 45名それぞれについて、RIZIN・修斗・パンクラス・DEEPの生データ(data/*.json)から「勝敗分に寄与するbout(resultType=decisive/draw)」を集計し、1行目のhistory配列の日付集合に無いものを「超過bout」として抽出(全144件、`out/multiorg-discrepancy-excess-bouts.csv`)。
2. 各超過boutの対象選手側の生表記(ownRaw)が、fighters.tsのnameJa/aliasesとどの正規化段階で一致したかを分類(exact/nfkc_whitespace/quote_symbol/variant_char/homograph_char/no_match_found)。
3. 上位の疑わしいケース(homograph_char・no_match_found・名指しされたmotonomiki)についてパンクラス公式・修斗公式のプロフィールページ(生年月日・出身地・所属ジム・身長)を直接確認し、同一人物か別人かを裏取り。
4. 45名それぞれについて`fighters.ts`の`needsReview`/`recordFromResults`フラグを確認。

## 重要な発見:仮説(同名別人の融合)は2件とも「誤り」と判明

### 荒井勇二/荒井勇ニ(yuji-arai、超過11件、homograph_char)

事前仮説は「2026-07-29追加の漢字カタカナ同形正規化(ニ→二)が同名別人を誤って融合させたのでは」だった。パンクラス公式・修斗公式のプロフィールページを直接確認した結果:

| | パンクラス(荒井勇二、2014-2025) | 修斗(荒井勇ニ、2026) |
|---|---|---|
| 生年月日 | 1984年8月8日 | 1984年8月8日 |
| 出身地 | 長野県 | 長野県 |
| 所属ジム | 暁道場 | 暁道場 |
| 身長 | 182cm | 182cm |

**完全一致。同一人物と確定。** パンクラスで11戦戦った後、2026年に修斗へ移籍した同一選手であり、正規化ロジックは正しく機能している。1行目(fighterRecords.json、needsReview=true)が2026年の修斗2戦のみを記録しており、2014-2025年のパンクラス期間が欠落しているのが実体。→ **カテゴリ⑤(1行目不完全)。バグではない。**

### RYOGA(ryoga、超過10件、no_match_found)

事前調査でRIZIN・DEEP側の「RYOGA」は`findFighterSlugByName`の英名一致パス(`f.nameEn.toLowerCase() === name.toLowerCase()`、**衝突ガード(AMBIGUOUS_NAMES)の対象外**、コード内コメントで明記)経由で解決されていることが判明。これは構造的にはリスクの高い経路(衝突ガード無しの完全一致のみ)。修斗公式プロフィール(id=1493)を確認した結果:

- 修斗公式が明記する英語リングネームは**まさに「RYOGA」**(全角/半角問わず本人公式表記)
- 体重階級: フライ級(-56.7kg)。RIZIN LANDMARK 8の契約体重60kg、DEEP各戦の「58kg以下」「-60kg」「59kg以下」「60kg以下」と整合
- 生年月日1998年12月7日・兵庫県神戸市・総合格闘技ゴンズジム

**同一人物と確定。** 修斗・DEEP・RIZINを股にかける地方巡業選手の実態と一致し、たまたま英名一致が正しく機能したケース。→ **カテゴリ⑤。バグではないが、英名一致パスが衝突ガード対象外である設計自体は、より一般的なリングネーム(例:単純な英単語)では誤爆しうる潜在リスクとして別途記録に値する。**

### 本野美樹(motonomiki、超過7件、exact)

指示書で「同名別人混入の第一候補」と名指しされていたが、DEEP公式データを確認した結果、超過7件は全てDEEP JEWELS(2019-2022)のストロー級戦で、fighters.tsの`weightClass: "女子ストロー級"`と完全に整合。2020年にはDEEP JEWELSストロー級暫定王座決定戦にも出場しており、一貫したキャリアの選手。1行目(fighterRecords.json、needsReview=true)は2025年のPANCRASE2戦のみを記録。→ **カテゴリ⑤。バグではない。DEEP→(空白期間)→PANCRASEという団体移籍が単に1行目に反映されていないだけ。**

## クラスタ分類(45名・144件)

| クラスタ | 該当選手数 | 該当bout数 | 判定根拠 |
|---|---|---|---|
| **⑤ 1行目データソースが構造的に限定的(2行目が正しい)** | **39名** | **132件** | 下記参照 |
| ④候補: 真正Wikipedia選手での小幅な内訳差(resultType等、要個別調査) | 6名 | 12件相当(isao型含む) | isao/kate-lotus/goto-joji/ito-yuki/noel/kubo-yuta |
| ① 正規化による同名別人の融合 | 0名(確認した2候補は共に同一人物と確定) | 0件 | 上記参照 |
| ② denylist未カバーの同名別人 | 0名(確認した1候補=RYOGAは同一人物と確定) | 0件 | 上記参照 |
| ③ 同一boutの二重収録 | 未検出 | - | 144件の中に日付・対戦相手が重複するペアは無し |

### ⑤(1行目データソース限定型)の内訳39名の内訳

fighters.tsのフラグで機械判定可能:

- **needsReview: true 由来(33名)**: 1行目(fighterRecords.json)のwins/losses/historyがfighters.ts上に直接ハードコードされた単一ソース由来の未レビュー値で、`historyLen`が1行目の総試合数と正確に一致する(=1行目はこの短いhistory配列そのもの)。fujii-nobuki(超過24件、パンクラス2010-2018の8年間が丸ごと欠落)・tamura-hibiki・kawakita-haruki・salt・endoraiki・kurobe-kazusa(重複、後述)等。
- **recordFromResults: true 由来(6名: ryoga・ushiku-juntaro・kurobe-kazusa・ohara-juri・sekihara-sho・nakajima-taichi)**: fighters.ts上のコメントに明記の通り「戦績は自社EVENT_RESULTS(mnews独自の結果記事DB)から動的に組み立てる」設計。EVENT_RESULTSは/resultsページの掲載基準(主要大会・タイトルマッチ・DB選手が絡む試合)に沿って選別されており、4団体公式アーカイブの網羅的な全件収録とは前提が異なる。従って1行目<2行目は設計上の必然であり、修正不要。

この2フラグのいずれかが立っている選手は45名中39名(87%)で、超過bout数では144件中132件(92%)を占める。

### ④候補(真正Wikipedia選手、6名)

`needsReview=false` かつ `recordFromResults=false`(=1行目はハードコードでなく動的なWikipedia由来と推定される)6名:

| slug | 1行目計 | 2行目計 | 型 |
|---|---|---|---|
| isao | 38 | 35 | データ入替型(総数不超過、分draws 2→4に増加) |
| kate-lotus | 18 | 16 | データ入替型 |
| goto-joji | 28 | 27 | データ入替型 |
| ito-yuki | 27 | 23 | データ入替型 |
| ohara-juri* | 61 | 40 | recordFromResults=trueだが総数不超過(データ入替型と重複) |
| sekihara-sho* | 19 | 18 | 同上 |
| nakajima-taichi* | 33 | 28 | 同上(recordFromResults=true) |
| noel | 6 | 7 | 超過+1(分) |
| kubo-yuta | 8 | 9 | 超過+1(敗) |

(*印はrecordFromResults=trueだが総数が超過せずisao型の挙動を示した3名。集計上は上表クラスタ表のrecordFromResults=6名に含めている。)

isaoの詳細: 1行目(Wikipedia由来と見られる包括的なhistory、Bellator・VTJ・TRIBELATE等4団体外の試合も含む)38戦(27-9-2)に対し、2行目(4団体データのみ)35戦(25-6-4)。総数が2行目の方が少ないのは、Bellator/VTJ/TRIBELATE等4団体データセット対象外の試合が1行目にのみ含まれるため想定通り。一方でdraws(分)が1行目2→2行目4に増加しており、これは総数減少と両立しない(=どこかのbout が win/loss→draw に振り替わっている)。パンクラス生データ側のresultType判定に誤りがある可能性があるが、本調査のスコープ外につき原因未特定。**修正はこのPRに含めない。**

## 停止条件・スコープの遵守

- 修正・alias追加・denylist追加は一切行っていない(read-only)。
- 出力: `out/multiorg-discrepancy-excess-bouts.csv`(144行)、`out/multiorg-discrepancy-fighter-summary.json`(45名分)、本ファイル。

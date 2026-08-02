# DEEP未回収2件の解消(構造段落ベース回収、PR #374フォローアップ)

## 経緯

[out/deep-headingless-recovery-reconciliation.md](deep-headingless-recovery-reconciliation.md)
で判明した、見出し語ベースの回収(`recoverHeadinglessBouts`)では拾えなかった
2件への対応。

- DEEP OSAKA IMPACT 2022 5th ROUND セミファイナル(中本龍平 vs 牧野滉風):
  VS型(mark無し)カードのbout境界検出がGroup1(`BOUT_RE_GROUP1`)の複雑な
  先読み境界と噛み合わず、同一大会内の大半のboutが道連れで欠落していた。
- DEEP 130 IMPACT メインイベント(大原樹理 vs 倉本大悟): ノーコンテストの
  ため勝敗markが存在せず、「王者：/：挑戦者」という肩書き付き表記のみで
  選手が示される特殊構造。

**見出しパターンを追加する方向には戻らず**、既存の`countStructuralBoutBlocks()`
と同じ根拠(生HTMLの`<p class="wp-block-paragraph">`1個=bout1件というDOM構造+
ジム括弧+決着手がかり)で段落を直接パースする`recoverStructuralParagraphBouts()`
を新規実装した(`deepScraper.ts` 3.7節)。

## 実装

- `isStructuralBoutParagraph()`: 決着手がかりの判定にmark・VSに加えて決まり手
  キーワード(判定・KO・TKO・一本・ノーコンテスト等)も追加(ノーコンテストは
  markが存在しないため)。
- `recoverStructuralParagraphBouts()`: 各`<p>`段落を独立に3パターン
  (method末尾型・method中間型・VS型)で試し、最初に一致した1パターンのみ採用
  (段落=1boutの単位で完結させ、ページ全体を跨ぐ複雑な境界検出を不要にする)。

## 発見・修正した副次バグ(実装過程で判明)

初回実装(段落内のどの位置からでもマッチ開始できる設計)は、対抗国名の告知文
「DEEP（日本） VS YFU（中国）」を選手名として誤認識するなど、複数の誤検出を
引き起こした。以下を修正した:

1. マッチ開始位置を段落先頭(`^`)に固定(段落内の任意のパイプ位置からの
   マッチ開始を禁止)。
2. 決着キーワードが1つも無いmethod欄(mark・勝者ヒントのどちらも無い候補のみ)
   を却下する安全弁を追加(対抗国名告知文の除去)。
3. VS型パターンにmark捕捉を追加(mark付きVS型「〇DJ.taiki VS ×鹿志村仁之助」
   でmarkが選手名に混入する事故を修正)。
4. `resolveOutcome()`をmark優先に修正(mark・勝者ヒントの両方を持つ候補で
   markを優先、ヒントは選手名との前方一致に依存し脆いため)。
5. フィールド区切りに空セル(連続する`|||`)許容を追加(HTML側の空セルで
   2人目の情報がmethod欄と入れ替わる事故を修正)。
6. 名前欄が決着キーワード(判定・失格・反則・ノーコンテスト等)や注記括弧
   (`[`・`【`)で始まる/含む候補を却下する検証を追加。

## 検証結果

- 回収bout数: **70件**(重複ゼロ、目視全件確認で不自然な値なし)
- 全件diff: 消失大会0・消失bout0・**既存boutのフィールド変更0**・新規追加70件
  のみ(`git diff`も追加行のみ)
- `computeMultiOrgRecord()`をfighters.ts全選手(361名)に対して実行し、
  **wins/losses/drawsいずれについても減少している選手が1名も無いことを確認**
  (増加のみ)
- 決定論的(パッチスクリプトを2回実行してSHA256完全一致)・冪等
  (パッチ済みデータへの再実行で追加0件)
- `npx tsc --noEmit -p .`・`npm run build`(139/139ページ)・
  `npm run test:mnews-rating`(220件)すべて成功
- `data/deepRecords.json`以外のdata/配下は無変更

### 対象2件の確認

- DEEP OSAKA IMPACT 2022 5th ROUND: 中本龍平 vs 牧野滉風、winner=牧野滉風
  (TKO)、正しく回収
- DEEP 130 IMPACT: 大原樹理(ohara-juri) vs 倉本大悟(kuramoto-daigo)、
  resultType=nc・winner=null、正しく回収

### 影響選手(2行目増減、25名・slug解決済み分)

| slug | 変更前 | 変更後 |
|---|---|---|
| aimoto-kazuki | 6-0-0 | 6-1-0 |
| enju-kenta | 7-6-0 | 8-6-0 |
| fukuda-machi | 10-2-0 | 11-2-0 |
| fukuda-ryuya | 17-6-1 | 18-6-1 |
| hibino-junya | 6-7-0 | 7-8-0 |
| hiramatsu-sho | 8-5-0 | 9-6-0 |
| hirata-naoki | 7-4-0 | 8-4-0 |
| honda-ryosuke | 10-5-1 | 10-6-1 |
| ishizaka-kushi | 7-1-0 | 8-1-0 |
| izumi-takeshi | 6-3-0 | 7-3-0 |
| kadono-kohei | 4-1-0 | 6-2-0 |
| kintaro | 9-14-1 | 10-14-1 |
| koya-kanda | 11-8-0 | 12-8-0 |
| kuramoto-daigo | 7-3-0 | 8-3-0 |
| miyabi-shunsuke | 8-3-0 | 9-3-0 |
| nakamura-daisuke | 9-11-0 | 10-11-1 |
| nomura-shunta | 8-0-0 | 9-0-0 |
| ohara-juri | 23-14-3 | 24-14-3 |
| park-siwoo | 13-3-0 | 13-4-0 |
| sarami | 12-10-0 | 13-10-0 |
| shimada-ibuki | 10-4-0 | 12-4-0 |
| shirakawa-rikuto | 9-7-1 | 10-7-1 |
| strasser-kiichi | 10-5-2 | 10-6-2 |
| takizawa-kenta | 14-11-0 | 14-12-0 |
| ushiku-juntaro | 24-12-1 | 24-14-1 |

(この他、fighterASlug/fighterBSlugが未解決(DB未収録選手)の回収boutが多数
あるが、それらは2行目表示に影響しない)

## ファイル

- `src/lib/mnewsRating/deepScraper.ts`: `recoverStructuralParagraphBouts()`
  (3.7節)追加。既存の抽出正規表現・`countBoutHeadings()`・
  `recoverHeadinglessBouts()`は無変更。`resolveOutcome()`はmark優先ロジックの
  追加のみ(group1_vsの既存挙動は不変)。
- `scripts/patch-deep-structural-paragraph-recovery.ts`(新規): 最小パッチ
  スクリプト。
- `data/deepRecords.json`: 70bout追加(既存データは完全に不変)。

# パンクラスクロスorg監査(131名/54名候補)報告

生成日時: 2026-08-04(JST)。read-only(投入・修正は一切行っていない)。

## 発端・スコープ

#420(funada-denchi修正PR)で、`FIGHTERS`全365名をパンクラス公式名簿1,683件
(指示書H成果物、`out/pancrase_name_reconciliation_table.json`)と名前一致させると
**131名**(うち`org!=="pancrase"`が**54名**)という母集団が判明した。本監査では
この131名について、公式プロフィール戦績表とmnewsのパンクラスboutを
①データに無い ②データにあるがslug未解決 ③既に反映済み の3分類で突合する。

## 手法

1. **母数確定**: `out/pancrase_name_reconciliation_table.json`(公式選手一覧3系統・日本人1,147+外国人415+女子121=1,683件、`{urlStem, href, displayName, listSource}`)を`FIGHTERS`全365名の`nameJa`/`aliases`と正規化完全一致(NFKC+異体字/同形字統一、`scripts/lib/fighterNameBackfill.ts`の`normalize()`を流用)で突合。既存artifactの再利用のため追加fetchなし。
2. **`data/prfl2/*.html`のローカル有無確認**: **存在しない**(`data/prfl2/`ディレクトリ自体が無い)。全プロフィールを都度fetchする必要があった。
3. **プロフィールfetch**: 一致した対象のみ`https://www.pancrase.co.jp/data/{prfl2|prfl-e|prfl-a}/{href}`を1.2秒間隔・`assertAllowedByRobots`経由で取得(上限200件、実際は136件で収まった。pancrase.co.jpのrobots.txtは404のためRFC 9309上「全許可」)。
4. **突合**: `data/pancraseRecords.json`の各boutが持つ`leftUrl`/`rightUrl`(相手選手の公式プロフィールURL、`../../../data/prfl2/xxx.html`形式)からbasenameを抽出し、対象選手の`href`と一致するboutを索引化。**さらに`fighterASlug`/`fighterBSlug`が対象selug自身と直接一致するboutをURLの有無に関わらず引ける索引も併用**(1,683件中322件のboutはURL情報自体が無いため、これが無いとslug解決済みのboutを誤って「missing」に分類してしまう不具合があり、実装途中で発見・修正した)。

修正・投入は一切行っていない。使用スクリプト: [scripts/investigate-pancrase-crossorg-audit-131.ts](../scripts/investigate-pancrase-crossorg-audit-131.ts)

### 実装上の教訓(本監査中に発見・修正した2件の不具合)

- **hrefがlistSourceのディレクトリと食い違うケース**: `kitaoka-satoru`(北岡悟)は`listSource: "japanese"`だが実際のhrefは`../prfl/kitaoka.html`(prfl2ではなく更に古いprflディレクトリ)。素のhref文字列をそのままキーにすると、fetch先URLは正しく解決されるのに突合キーがずれ、43戦全てが偽陽性の「missing」になっていた。`URL`クラスでの正規解決+basename抽出に修正。
- **相手名の異体字・同形字ゆれ未吸収**: 突合キーの正規化に空白除去のみの関数を使っていたため、「髙城光弘」⇔「高城光弘」「山﨑聖哉」⇔「山崎聖哉」等の異体字ゆれが偽陽性の「missing」を生んでいた(該当id特定と同じ`bfNormalize()`に統一し解消)。
- **leftUrl/rightUrlが両方null のbout(全4,573件中322件、約7%)**: URLベースの索引だけでは拾えず、`fighterASlug`/`fighterBSlug`が既に対象slugで解決済みでも「missing」誤判定になっていた(`kindaichi-kosuke`の2018-07-15戦で発覚)。slug直接索引を追加して解消。

## 結果1: id特定

| 区分 | 件数 |
|---|---|
| FIGHTERS総数 | 365 |
| **公式名簿1,683件と一致** | **136**(うち`org!=="pancrase"`: 57) |
| うちnameJa直接一致 | 135 |
| うちaliasesで一致(名寄せ軸ヒット) | 1 |
| 同名複数該当(ambiguous、要裏取り) | 1 |
| 未特定 | 228 |

#420時点の見積り(131名/54名)と近い値(136名/57名)が得られた。差分は#420実行時からの`fighters.ts`の追加・修正、および今回の正規化(異体字統一)がより広くマッチした分と見られる。

### org別内訳(id特定率)

| org | FIGHTERS数 | 一致数 | 一致率 |
|---|---|---|---|
| pancrase | 79 | 79 | **100%** |
| shooto | 101 | 20 | 19.8% |
| deep | 74 | 17 | 23.0% |
| rizin | 90 | 13 | 14.4% |
| one | 12 | 5 | 41.7% |
| ufc | 5 | 1 | 20.0% |
| nexus | 4 | 1 | 25.0% |

`org: "pancrase"`タグ付き79名は名簿一致率100%(想定通り)。他団体タグでもパンクラス経歴を持つ選手が一定数(shooto 20名・deep 17名・rizin 13名等)存在する。

### 名寄せ軸ヒット(1件、Cと同一人物)

| slug | fighters.ts nameJa | 一致したalias | 公式href |
|---|---|---|---|
| ohara-juri | 大原樹理 | 大原樹里 | ohara.html |

### 同名複数該当(ambiguous、要裏取り、1件)

| slug | nameJa | 該当href |
|---|---|---|
| taito-rangers | 泰斗 | taito.html, taitosc.html |

`out/pancrase_exact_name_collisions.json`(指示書H既存成果物)に記載済みの既知ケースと一致。

### 高衝突リスク(matched・要裏取り、27件)

正規化後3文字以下の名前(単独名・短い芸名的表記)を機械的に「要裏取り」対象とした: tsuruya-rei/takagi-ryo/kintaro/sekihara-sho/rikiya/karino-yu/goto-ryo/hayashi-genpei/hirata-akira/kanru/tajima-ryo/matsui-ryo/imura-rui/little/mori-subaru/tenya/kitaoka-satoru/hamada-takumi/salt/taira/zhangyuta/tou-hoiin/ryoa/sekisena/satoru/kanayumu/raika。うち`kanru`(敢流)・`tenya`(天弥)・`rikiya`(力也)は指示書H(`out/pancrase_name_reconciliation_report.md`)で個別裏取り済み(敢流は未確定のまま、天弥は確度高、力也は既知の同名別人「辻川力也」とは別人と確定済み)。

## 結果2: 136名・1,099bout突合

| 区分 | 件数 |
|---|---|
| ③反映済み(reflected) | 1,083 |
| ②データにあるがslug未解決 | 5 |
| ①データに無い(missing) | 11 |
| **完全反映済み選手(missing=0かつslug未解決=0)** | **125/136名(91.9%)** |
| 欠落・未解決のある選手 | 11/136名 |

想定より欠落は少なかった(pancrase org自体が母集団の過半数を占め、既にpancraseRecords.jsonへの投入対象だったため)。

### ②データにあるがslug未解決(2名・5件)

| 選手 | org | 日付 | 相手 | 原因 |
|---|---|---|---|---|
| 高城光弘(takashiro-mitsuhiro) | pancrase | 2021-12-12 | 水永将太 | mnews側の表記が「高城**弘光**」(光弘の字順が逆転した誤記)になっており、名前一致せずslug未解決 |
| ジェイク ムラタ(murata-jake) | shooto | 2016-03-13 | 金太郎 | 未解決 |
| 〃 | shooto | 2015-10-04 | 大橋悠一 | 未解決 |
| 〃 | shooto | 2015-03-15 | 神田T800 周一 | 未解決 |
| 〃 | shooto | 2014-02-02 | ライダーHIRO | 未解決 |

ジェイク ムラタは#396(公式ランキング未登録選手の候補生成)で新規発見された選手と同一人物とみられる。パンクラス参戦歴もあることが今回新たに判明した。

### ①データに無い(10名・11件)

| 選手 | org | 日付 | 相手 | 備考 |
|---|---|---|---|---|
| 新居すぐる(nii-suguru) | rizin | 2016-06-12 | 川那子祐輔 | **公式データでは「新居卓」という別表記で記録されており(`fighters.ts`のaliasesに未登録)、事実上は名寄せ軸のギャップ** |
| 〃 | rizin | 2016-03-13 | 渡慶次幸平 | 同上 |
| 阿部大治(abe-daiji) | deep | 2016-09-11 | 奈良貴明 | 近い日付(2016-06-12)に同一相手が別カードに登場するが、日付が一致せず要個別確認 |
| 村山暁洋(murayama-akihiro) | pancrase | 2020-12-13 | 菊入正行 | |
| 雑賀ヤン坊達也(saiga-yanbo-tatsuya) | pancrase | 2019-09-29 | トム・サントス | |
| 高城光弘(takashiro-mitsuhiro) | pancrase | 2018-09-09 | 飯嶋重樹 | |
| 山口怜臣(yamaguchi-satoshi) | pancrase | 2022-12-25 | 岡田嵐士 | 対戦相手側(岡田嵐士)のプロフィールでも同じ1戦がmissingと判定されており、双方から見て未収録と裏付けられる |
| 北岡悟(kitaoka-satoru) | deep | 2004-07-25 | カート・ペリグリーノ | mnews側は「カート・**ぺ**リグリーノ」(小書きの「ぺ」)表記になっており、表記ゆれによる偽陰性の可能性が高い(43戦中42戦は反映済み) |
| 岡田嵐士(okada-arashi) | shooto | 2022-12-25 | 山口怜臣 | 上記山口怜臣戦と同一bout(双方から未収録) |
| 荒井勇二(yuji-arai) | shooto | 2014-08-10 | エディ"ローニン"ジョシュア | 相手名に装飾ニックネームの引用符が含まれており、表記ゆれの可能性がある |
| 平信一(taira) | pancrase | 2020-07-24 | 葛西和希 | |

**新居すぐる(nii-suguru)の2件は、単純な欠落ではなく`fighters.ts`のaliasesに「新居卓」が未登録であることが原因の名寄せ軸ギャップ**(船田電池型と同種)。他の9件は概ね真正の未収録とみられるが、うち2件(北岡悟・荒井勇二)は表記ゆれによる偽陰性の可能性が残る。

## 出力ファイル

- [scripts/investigate-pancrase-crossorg-audit-131.ts](../scripts/investigate-pancrase-crossorg-audit-131.ts) — 本監査の実行スクリプト
- [out/pancrase-crossorg-id-matches.json](pancrase-crossorg-id-matches.json) — 365名全員の名簿突合結果(matched/ambiguous/unmatched全件)
- [out/pancrase-crossorg-per-fighter.json](pancrase-crossorg-per-fighter.json) — id特定できた136名の3分類内訳
- [out/pancrase-crossorg-audit-summary.json](pancrase-crossorg-audit-summary.json) — 集計サマリ
- [out/pancrase_name_reconciliation_table.json](pancrase_name_reconciliation_table.json) 等 — 指示書H既存成果物(参照のみ、本PRでは再生成せず main から複製)

## 次のステップ(本PRでは着手しない)

- 高城弘光→高城光弘の表記修正、ジェイク ムラタ4件の投入方針検討。
- 新居すぐるのaliasesに「新居卓」追加(その後の再生成で2件が自動解決される見込み)。
- 残る9件の欠落について、表記ゆれ(北岡悟・荒井勇二)か真正未収録かの個別裏取り。
- 「要裏取り」28名(高衝突リスク27名+ambiguous1名)の個別裏取り。
- C(修斗261名候補、#423)とDの結果を踏まえた投入優先順位の全体設計。

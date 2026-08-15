# /kick KNOCK OUT悉皆回収・旧字体統合・ONE再照合 反映 受入条件チェック

対象PR: feat/kick-ko-recovery-reflect(#526)

## 重要な訂正

ユーザー指示に記載の「19,798 → 19,870」という比較値は、私が先だってデータ側作業中に行った
**中間検証(K-1/KNOCK OUT/SB分のみを対象にした限定測定)の値**であり、ONE Championship再照合分・
Bigbang/JKA/KROSS×OVERの並行更新分を含んでいませんでした。mnews本番相当(現行main)を基準にした
**正しい最終値は 19,798 → 20,238(+440)** です。以下、正しい値で報告します。

## 受入条件1: 戦績の実測一致と内訳の残余ゼロ

`/kick`側の実測(`data/kick/generated/index.json`): **boutRowsCompleted = 20,238**。

```
生bout(boutRowsRaw)        21,763
− 重複統合(mergedDuplicateRows) 1,450
− 名簿未紐づけ(unmatchedBouts)     12
= 掲載bout(boutRows)          20,301
− 予定試合(boutRowsScheduled)      63
= 戦績（実施済み）(boutRowsCompleted) 20,238   ← 残余ゼロで説明可能
```

## 受入条件2: 19,798 → 20,238(+440)のソース別分解

main(現行)を起点に、変更ファイルを1つずつ順に適用し都度`boutRowsCompleted`を実測(限界効果法)。

| 段階 | 追加したファイル | boutRowsCompleted | 差分 | 内容 |
|---|---|---:|---:|---|
| 0 | (現行main) | 19,798 | — | 基準 |
| 1 | fighters.json/csv | 19,797 | **−1** | KNOCK OUT統合候補+旧字体統合によるfighters.json変化(この段階では対応するbout側はまだ旧のまま)。高山敦/髙山敦統合でSB×KNOCK OUT間の重複1件が新たに検出された分 |
| 2 | bouts_k1.json | 19,851 | **+54** | K-1側: 別セッションのambiguous再判定5件の統合＋null日付補完12件の恒久化 |
| 3 | bouts_knockout.json | 19,870 | **+19** | **KNOCK OUT悉皆回収**(生20件: 新規1名6件＋統合3名14件、うち1件が重複統合で相殺) |
| 4 | bouts_sb.json | 19,870 | **±0** | null日付補完3件の恒久化のみ(件数に影響なし) |
| 5 | bouts_one.json | 19,898 | **+28** | **ONE Championship再照合**(3,315人の名簿で戦績を再解決した分) |
| 6 | bouts_rise.json | 19,898 | **±0** | 内容差分は相手選手解決メタデータのみ(件数不変) |
| 7 | bouts_bigbang.json | 20,140 | **+242** | 対象外(下記「範囲外の変更」参照) |
| 8 | bouts_jka.json | 20,142 | **+2** | 同上 |
| 9 | bouts_krossover.json | 20,238 | **+96** | 同上 |
| **合計** | | **20,238** | **+440** | |

**範囲外の変更(段階7〜9、+340件)について**: `ingest_bigbang.py`・`ingest_jka.py`・
`ingest_krossover.py`が、私のK-1/KNOCK OUT/旧字体/ONE作業とは無関係に更新されていることを
確認した。これらは今回の指示(KNOCK OUT回収・旧字体統合・ONE再照合)のいずれにも該当せず、
私自身が検証した変更ではない。データ側の別作業(または別セッション)による更新と見られる。
渡された17ファイルの一部としてmd5照合済み・ユーザーからは「確定データ」との指示のため
そのまま取り込んだが、中身の妥当性は未検証である点を明記する。

## 受入条件3: 名簿人数・sitemap URL数

- 名簿: 3,316人 → **3,315人**(KNOCK OUT新規+1、旧字体統合で−2)
- `/kick/sitemap.xml`の`<url>`要素数: **3,317**(選手3,315 + 静的2)
- `/kick/fighters`生HTMLの`href`数: **3,315**(名簿人数と一致)

## 受入条件4: 旧字体統合で消えた2slugの確認

| 旧slug(統合前に個別に割り当て済みだった) | 現在の状態 |
|---|---|
| `watanabe-takeshi`(渡邉武、Wikipedia単独時代) | 索引・sitemap・対戦相手リンクのいずれにも0件 |
| `takayama-atsushi`(高山敦、SHOOT BOXING単独時代) | 同上、0件 |

統合後の表記は`watanabe-takeshi-2`・`takayama-atsushi-2`(先に`髙山 敦`のKNOCK OUT側が
`-2`を採番済みだったため)。`data/kick/slugs.json`に旧identityキーのエントリ自体は
残存する(識別子ごとの永続割当のため削除しない設計)が、現在のfighters.json側にそのidentityの
レコードが存在しないため、`generateStaticParams`が対象としない＝ページも生成されない。
直接アクセスすれば404になる想定(未実機確認、報告のみで対応不要との指示のため追加対応はせず)。

## 受入条件5: 波及確認

### 検索索引サイズ

`public/kick/search-index.json`: 457,033B → 457,605B(**+572B**、名簿+1人・−2人の統合差分)

### 勝敗集計(全選手合算)

| 区分 | 変更前 | 変更後 | 差分 |
|---|---:|---:|---:|
| 勝 | 10,475 | 10,737 | +262 |
| 敗 | 8,324 | 8,464 | +140 |
| 分 | 754 | 781 | +27 |
| 不明 | 57 | 66 | +9 |
| 対象外(no_contest/cancelled/walkover) | 188 | 190 | +2 |
| **合計** | **19,798** | **20,238** | **+440** |

### bout0件の選手数

565人 → **563人**(−2)

## 受入条件6: 実行時コスト

`npm run build`(check:route-rendering-mode含む全ゲート)通過。`/kick`・`/kick/fighters`は
○(Static)、`/kick/fighters/[slug]`は●(SSG、3,315ページ)のまま。**force-dynamicの追加は0件**。

## 受入条件7: birthdateの非表示

`scripts/build-kick-data.ts`のFighter型定義に`birthdate`フィールドは存在せず、出力オブジェクトも
明示的なフィールド列挙で構築しているため、fighters.json側にbirthdateが追加されても生成物・
画面には一切伝播しない(コード上grep 0件で確認済み)。

## 所属表示への出典時点明記

`/kick/fighters/[slug]`の「所属」欄に、値がある場合のみ
「(データ取得時点：YYYY年M月D日。移籍等で現在と異なる場合があります)」を追記。
既存の`sourceUpdatedAt`(トップページと同一の値)を再利用。

## トップ説明文の現在値反映

`/kick`・`/kick/fighters`の`description`はいずれも`stats.fighters`等を参照する動的生成のため、
コード変更不要で自動的に新しい値(3,315人・20,238件等)を反映することを確認済み。

# 指示書R-7/R-7b: 修斗選手プロフィールページ経由の全件dry-run

生成日時: 2026-08-02(JST)。read-only(投入・修正は一切行っていない)。

## 前提・スコープ

- 対象: `fighters.ts`の修斗系101名(`org: "shooto"` 98名 + `orgs`配列経由3名: KAREN/SARAMI/知名昴海)
- 取得元: 修斗公式サイトの選手プロフィールページ `https://www.shooto-mma.com/fighters/?id=NNN`
- 突合先: `data/shootoRecords.json`(大会アーカイブ由来) + `fighters.ts`の`history`配列
- 実行: `npx tsx scripts/investigate-shooto-profile-dryrun.ts`(1.2秒間隔・`assertAllowedByRobots`経由)

## a) 母数確定(id特定)

修斗公式サイトの選手一覧ページ(`/fighters/`)自体に埋め込まれているローマ字表記(`Name`列)を、`fighters.ts`側のnameJa/nameEnと正規化(空白除去)完全一致で突合した。

- **特定: 101/101(100%)、未特定0名**。推測によるid割当は無し。
- 停止条件(未特定3割超)には該当せず。
- 突合結果一覧: [out/r7-id-matches.json](r7-id-matches.json)

## b) 全件抽出

101名全員のプロフィールページを1.2秒間隔・`robotsGate`経由で取得完了(**fetchedCount: 101/101、unreachable: 0件**)。停止条件(食い違い20件超/ambiguous発生)のいずれにも該当せず最後まで完走した。

途中経過として、当初の実装には2つの不具合があり、修正の上で再実行している(詳細は後述の「実装上の教訓」参照)。

## c) 内訳(101名・884bout)

| 区分 | 件数 |
|---|---|
| 既存と一致(matched) | 773 |
| 新規①: 2012-12-24より前 | 43 |
| 新規②-a: 大会は既存だがbout自体が無い | 2 |
| 新規②-b: 大会自体が既存に無い/大会リンク無し | 54 |
| **★勝敗食い違い(mismatch)** | **12**(全件列挙) |
| 要確認(同一「日付+相手名」の複数マッチ) | 0 |

### ★勝敗食い違い12件(全件、既存noteRaw付き)

12件の生の食い違い行のうち、両当事者が101名の対象に含まれる4組(亮我×山口峻を除く3組)は同一bout片側ずつが二重に出現する。**実質的にユニークなbout数は8件**。

| # | 選手 | 日付 | 相手 | プロフィール | 既存result | 既存ソース/大会 | ジャッジ(人数/同点/多数決ドロー) | 分類 |
|---|---|---|---|---|---|---|---|---|
| 1 | 亮我(ryoga) | 2022-08-21 | 山口峻 | △(ドロー)「判定0-1」 | win | shootoRecords/越後風神祭り9 | 3人中2人同点 | **majority_draw_miscount** |
| 2 | 高岡宏気(takaoka-hiroki) | 2022-04-24 | 井口翔太 | △「判定1-0」 | win | shootoRecords/FORCE GIG 02 | 3人中2人同点 | **majority_draw_miscount** |
| 3 | 高岡宏気 | 2019-12-15 | 大竹陽 | △「判定1-0」 | win | shootoRecords/FORCE 12 | 3人中2人同点 | **majority_draw_miscount** |
| 4 | 高岡宏気 | 2019-04-07 | 西村大地 | △「判定1-0」(※同日同カードが本人プロフィールページに2行重複表示、詳細は制約参照) | win | shootoRecords/FORCE 11 | 3人中2人同点 | **majority_draw_miscount** |
| 5 | 新井丈(arai-jo) | 2016-03-21 | 小川竜輔 | △「2R 判定1-0」 | win | shootoRecords/プロフェッショナル修斗公式戦 | noteRaw無し(判定不能) | other |
| 6 | SASUKE / たてお(tateo) | 2016-07-17 | (相互) | △「判定1-0」 | SASUKE側loss、tateo側win | shootoRecords/プロフェッショナル修斗公式戦 | noteRaw="優勢ポイント1-2で飯田選手がトーナメント準決勝進出"(**別カードの注記が誤って紐付いている疑いあり**) | other |
| 7 | 青井太一(aoi-taichi) / たてお | 2026-02-28 | (相互) | △「判定1-0」 | aoi-taichi側loss、tateo側win | shootoRecords/SHOOTO GIG TOKYO Vol.40 | 3人中2人同点 | **majority_draw_miscount** |
| 8 | 徳本望愛(noa-tokumoto) / 片山智絵(katayama-tomoe) | 2024-08-03 | (相互) | △「判定0-1」 | noa側loss、katayama側win | fightersHistory/COLORS Produce by SHOOTO Vol.3 | noteRaw無し(fightersHistory由来のためnoteRaw自体を保持していない) | other |

**分類集計(ユニーク8件ベース): majority_draw_miscount 5件 / other 3件**(生の12行ベースでは majority_draw_miscount 7件・other 5件。差は上記の相互出現重複分)。

亮我の初回発見(#340のR-7初回セッション)と合わせ、**「多数決ドロー(3人中2人以上が同点スコア)を`resolveOutcome()`が誤って決着勝ちとして記録する」という同一パターンのバグが、少なくとも高岡宏気3件・青井太一/たてお1件で再現していることを確認した**。これは`亮我`固有の1件ではなく、`src/lib/mnewsRating/shootoScraper.ts`の`resolveOutcome()`に存在する構造的バグである可能性が高い。

「other」3件はジャッジスコアが取得できない(noteRaw無しまたは無関係な注記文)ため、多数決ドロー由来かどうかは未確定。特に#6(SASUKE/たてお)の`noteRaw`は「飯田選手がトーナメント準決勝進出」という、SASUKE・たてお本人とは無関係な選手名を含む注記であり、**既存アーカイブ側のnoteRawが別カードのものと取り違えられている可能性がある**(要個別確認、本dry-runでは修正していない)。

#8(徳本望愛/片山智絵)は`fighters.ts`の`history`配列(roster-injection-94由来)で解決した既存側であり、この投入元データ自体にジャッジスコアの記録が無い(`noteRaw`という概念自体を持たない構造)ため、多数決ドローかどうかの判定材料が無い。

### 新規②-a(大会は既存だがbout自体が無い): 2件

大会自体は`data/shootoRecords.json`に存在するが、その大会の中にこのbout自体が記録されていない(パース漏れの疑い)。

| 選手 | 日付 | 相手 | 大会(shootoEventId) |
|---|---|---|---|
| 後藤亮(goto-ryo) | 2023-04-09 | 石原匠 | shootoEventId=157 |
| 宇野薫(uno-caol) | 2024-07-14 | 岡田剛史 | shootoEventId=207 |

### 制約: プロフィールページ自体に重複行がある(#4の補足)

高岡宏気(id=1067)の2019-04-07 vs 西村大地は、**修斗公式サイトの生HTML自体に同一boutが2行重複して記載されている**ことをcurlで実測確認した(1行目は`/result/?id=149`へのリンク付き・method「判定 1-0」、2行目はリンク無し・method「2R 判定 1-0」)。これは本dry-runスクリプトのパース側の不具合ではなく、**取得元サイト自体のデータ品質問題**。投入設計では、プロフィールページ単体の中でも「日付+相手名」の重複除去が必要になる。

## d) eventNameの扱い(実測)

### 新規②(post-cutoff)のeventName取得

プロフィールページの生HTMLは、大会が既存archiveにある場合、日付セルが`<a href="/result/?id=NNN">`というリンクになっており、**日付からの推測は不要で大会idを直接取得できる**(101名・884bout中、matched773件全てで確認)。ただし新規②-b(54件)はリンク自体が無い、またはリンク先の大会がshootoRecords.jsonに存在しない。この54件はeventName補完不能。

### ★訂正(2026-08-02追記): 新規①・新規②-bの投入先は`FIGHTERS.history`ではない

前回版の本セクションは「`FIGHTERS[slug].history`(1行目相当)に`event: ""`で入れれば型・表示・ソートいずれも問題ない」という結論で終えていたが、これは**このトラックの出発点である「山上幹臣の2行目(RIZIN・DEEP・パンクラス・修斗通算)が3-1-0のまま」という問題を解決しない**。`src/lib/mnewsRating/multiOrgRecord.ts:5-8`のコメントに明記されている通り、2行目を計算する`computeMultiOrgRecord`/`computeMultiOrgBoutTable`は**`data/rizinRecords.json`・`data/shootoRecords.json`・`data/pancraseRecords.json`・`data/deepRecords.json`の4ファイルのみを入力とし、`fighters.ts`の`wins/losses/history`は一切参照しない**(`src/app/fighters/[slug]/page.tsx:315-317`の呼び出しコメントでも同旨を確認、実データの読み込みは`src/lib/multiOrgRecordsData.ts`の`fetchShootoRecords()`で、本番はGitHub raw経由・プレビュー/開発時はローカル`data/shootoRecords.json`にフォールバックする実装)。

つまり`history`に投入しても直るのは(SHOW_MULTI_ORG_RECORDと`noRecordData`の組み合わせ次第で表示されることのある)1行目相当の対戦テーブルだけで、**2行目自体(冒頭の勝敗数値)は`data/shootoRecords.json`(または`computeMultiOrgRecord`が読む何らかのソース)を経由しない限り変わらない**。前回のこの結論は誤りとして訂正する。

#### 設計オプション(実装はしていない、案の提示のみ)

`ShootoRecordsEvent`は「1大会=1要素、大会単位で`date`/`eventName`を持つ」構造だが、`computeFighterShootoRecord()`/`computeMultiOrgRecord()`自体は`ShootoRecordsEvent[]`を総なめしてbout単位に展開するだけの汎用ロジックであり、**「1大会=1bout」の疑似イベントを1件ずつ作って配列に混ぜても、集計ロジック自体には手を入れずに済む**ことをコードから確認した(`shootoRecordsAggregate.ts`のループはeventの中身の実在性を検証していない)。この前提で2案:

- **案A(疑似イベント方式)**: 新規①・新規②-bの97件(43+54)それぞれについて、1bout=1件の疑似`ShootoRecordsEvent`を作る。
  - `eventName`: `"大会名不明（修斗公式プロフィール由来）"`のような、事実に忠実な(捏造ではない)固定文言にする。実在しない大会名を作らない。
  - `date`: プロフィールページから実際に取れた正確な日付をそのまま使う(疑似イベント化しても日付の精度は落ちない)。
  - `sourceUrl`: 大会結果ページのURLではなく、実際の取得元である選手プロフィールページのURL(`https://www.shooto-mma.com/fighters/?id=<id>`)を入れる。これ自体が正直な出典表示になる。
  - `shootoEventId`: 実在id(現状1〜281程度)と衝突しない範囲の負数等をsentinelとして使う。
  - 格納先は`data/shootoRecords.json`に混在させるのではなく、**別ファイル(例: `data/shootoProfileBouts.json`、スキーマは`ShootoRecordsEvent[]`と同一)に分離**し、`fetchShootoRecords()`(または`multiOrgRecord.ts`の呼び出し元)を「2ファイルを取得してconcatする」よう小さく拡張する。ファイル自体が出所を語るため、案Bのフィールド追加と両方やるのが望ましい(下記参照)。
- **案B(専用フィールド追加方式)**: `ShootoRecordsBout`に`sourceType?: "archive" | "profile"`のような追加的(optional・既存データは省略のままで動く)フィールドを設け、疑似イベントかどうかをbout単位で明示する。案Aの別ファイル分離と併用すれば、ファイル単位・bout単位の二重の出所管理になり頑健。

いずれも本セッションでは実装していない(投入設計の選択肢の提示のみ)。

### 出所(provenance)タグ付けの必要性

97件(新規①43+新規②-b54)を`FIGHTERS[slug].history`(1行目)・上記の疑似イベント(2行目)いずれに入れる場合も、**Wikipedia由来・大会アーカイブ由来の既存データと見分けが付く印を明示的なフィールドとして持たせる**べきである(出所をテキストパターンや値の範囲だけで暗黙的に判別する設計は、将来の監査で見落とされるリスクがある)。

- `FightRecord`(`history`用)に`source?: "shooto-profile"`のような任意フィールドを追加する(既存のWikipedia由来エントリは省略のままで良い=後方互換)。
- `ShootoRecordsBout`(2行目用、案A/B)にも同様に`sourceType`を持たせる(上記案B)。
- 別ファイル化(案A)自体も、ファイルの存在そのものが一次的な出所マーカーとして機能する。

これらのフィールド追加自体は本セッションでは実装していない(次の投入設計フェーズで検討する)。

## 実装上の教訓(本dry-run自体で発見した2つの不具合)

このdry-runスクリプト自体の初回実装に2つの不具合があり、両方とも実行→原因調査→修正→再実行というサイクルで解消した(最終成果物である上記a)〜d)は修正後の値)。

1. **ジャッジスコア抽出の正規表現が空白の有無に非対応だった**: `noteRaw`の判定文で「片岡 誠人28-28 （」のように選手名とスコアの間に空白が無いケースがあり、当初の正規表現(`(\S+)\s+(\d+)-(\d+)`)は空白を必須としていたため検出漏れが発生した(青井太一/たておの一件が本来`majority_draw_miscount`のところ`other`扱いになっていた)。スコア数字と開き括弧の位置関係のみに着目する形に修正した。
2. **突合キーが「日付のみ」で「日付+相手名」になっていなかった**: 同一選手が同一大会で2試合出場するケース(例: エフェヴィガ雄志が2025-01-19に不戦勝+通常戦の2戦)を誤ってambiguous(要確認)判定してしまっていた。指示書どおり「日付+相手名(正規化)」の複合キーに変更して解消した。
   - さらに、`shootoRecords.json`由来と`fighters.ts`の`history`由来(roster-injection-94等で選手単位に事前投入済みの選手)が同一の実bout(例: asahina-ken 2026-01-18 vs 黒部和沙)を指すことがあり、これも複合キー化の過程で「既存側同士の重複」を統合する処理を追加して解消した(実データの重複ではなく、2つの既存ソースを単純結合した本スクリプト側の設計に起因)。

## R-5との合流について

R-5(1行目/4団体側の勝敗食い違い8件、うち6件が同種の多数決ドロー取りこぼしパターン、2件(ito-yuki・sekihara-sho)が純粋な勝敗逆転)は別セッションで作業中のため、本レポートには合流していない。R-5側の成果物がコミットされ次第、別途合流・再集計する。

## 出力ファイル

- 全884bout明細CSV: [out/r7-shooto-profile-dryrun.csv](r7-shooto-profile-dryrun.csv)
- 集計・食い違い詳細JSON: [out/r7-shooto-profile-dryrun-summary.json](r7-shooto-profile-dryrun-summary.json)
- id突合結果: [out/r7-id-matches.json](r7-id-matches.json)
- 実行スクリプト: [scripts/investigate-shooto-profile-dryrun.ts](../scripts/investigate-shooto-profile-dryrun.ts)

投入はしていない。

# DEEP見出しなしメインイベント欠落バグ修正(指示書②b・c、read-only調査PR #374の続き)

## 経緯

[out/motonomiki-multiorg-undercount-investigation.md](motonomiki-multiorg-undercount-investigation.md)・
[out/deep-headingless-mainevent-audit.md](deep-headingless-mainevent-audit.md)(指示a)で判明した
「メインイベント/セミファイナルに『第N試合』番号が無いDEEP公式ページでbout抽出が
丸ごと欠落し、内部の健全性チェックcountBoutHeadings()も同じ見出し表記しか
数えないため異常を検出できない」バグについて、b)抽出器と検査器の依存切り離し・
c)全件diff・影響選手確認を実施した。

## b) 抽出器と検査器の依存切り離し

### 検査器: `countStructuralBoutBlocks()`(新規、`deepScraper.ts`)

見出し文言を一切参照せず、DEEP公式サイト(WordPress生成)のDOM構造そのもの
(1boutが1つの`<p class="wp-block-paragraph">...</p>`要素に対応する、という
テンプレート上の構造的事実)を根拠に「本文中に存在するbout情報を持つ段落の数」
を数える。入力は生HTML(stripTags前)で、既存の`countBoutHeadings()`(stripTags後の
パイプ区切りテキストが入力)とは決定的に異なる独立した根拠を持つ。段落の中に
「ジム括弧」+「決着手がかり(mark文字またはVS)」があるかで判定するため、
見出しの文言が将来さらに別の表記ゆれ(例:「オープニングマッチ」等)に広がっても
影響を受けない。

`build-deep-records.ts`の大会別診断(`EventDiag`)に`structuralBoutCount`列として
追加し、レポートで参照できるようにした。ただしこの値は非プロ/非MMA混入bout・
地の文の誤検知を含みうるため(例: 計量結果再掲セクション)、最終bout数との単純な
差分だけでは停止条件にせず、大きく乖離した大会を目視確認する参考情報として扱う
(既存237件超のデータに対して急に厳格な停止条件を追加すると、今回のバグとは
無関係な既存の未解決ギャップ(後述)まで巻き込んで停止してしまうため)。

### 抽出器: `recoverHeadinglessBouts()`(新規、`deepScraper.ts`)

既存7フォーマットの正規表現定義(BOUT_RE_F1等)は一切変更していない
(238大会で実績のある抽出ロジックへの回帰リスクを避けるため)。同じ本文パターン
(MARK_OPT・NOT_METHOD_TEXT・KG_SUFFIX等の共有部品)を流用した「見出しなし版」を
独立した追加専用パスとして実装し、既存の抽出結果に無いbout(選手名の組で判定)
だけを追加する。

設計上の要点(初回実装で発覚した事故と対策):
- 見出し語ごとに対象テキストを「次の第N試合見出し、または次の見出しなしラベルの
  直前まで」に厳密にブロック分割してからパターンマッチを行う。ページ全体に対して
  グローバル正規表現を走らせる初回実装では、無関係な区画(計量結果の再掲・別boutの
  見出し等)にまで一致し、選手名欄に見出しテキストが丸ごと混入する事故(例:
  「吉田陸 vs 第9試合 フライ級 5分2R」)が発生した。ブロック単位に閉じ込めることで解消。
  - 参考: 初回実装(グローバル走査・複数パターン合算)77bout回収 → 精査の結果、
    同一boutの多重マッチ(最大3重複)・見出しテキスト混入が多数発覚 → ブロック分割版
    で49bout(重複ゼロ・全件が実在する対戦結果として妥当な形)に収束。
- 1ブロックにつき1パターンのみ採用(F1→F1_GLUED→F2→Group4の優先順)。複数パターンを
  合算すると同一boutが多重計上される。
- `hasGarbledContent()`(既存)に加え、名前欄がmark単体・見出しの通し番号・
  ラウンド表記そのものになっていないかの追加検証(`looksLikeGarbledHeadinglessBout`)
  を通過したもののみ採用する。

## c) 全件diff・影響確認

### データ反映方式: 最小パッチ(フル再クロールではない)

`build-deep-records.ts`自体には見出しなし回収・独立検査器を組み込み済み(将来の
定期バッチ実行では自動的に有効)だが、**今回`data/deepRecords.json`の更新には
これを使わなかった**。`out/deep-html-cache/`のキャッシュを使ってもfighters.ts側の
変化により無関係なwinnerSlug/fighterSlug解決の変動が発生することが実測で判明した
(フル再クロール1回目: 追加49bout以外に28件のslug関連フィールドが変動、うち27件は
既存nullから解決への改善、1件は既存の解決からnullへの退行)。これはPR #372が
DEEP45 IMPACT追加の際に直面したのと同じ現象(「フル再クロールは無関係な変更
(25件のwinnerSlug解決改善+1件の退行)を混入させる」)であり、同PRの前例に倣い、
新規スクリプト`scripts/patch-deep-headingless-recovery.ts`で**既存bout・既存
フィールドを一切変更せず、回収したbout(49件)だけを該当イベントの`bouts`配列に
追記する最小パッチ**として実装した。cardPositionは既存の最大値より大きい値を
新規bout側に割り当てる(メインイベント/セミファイナルは元々カードの最上位のため)。

### 全件diff結果

新旧`data/deepRecords.json`を選手名の組(fighterAName・fighterBName)をキーに
全件突合した:

| 項目 | 件数 |
|---|---|
| 対象大会数 | 238件(変化なし) |
| 消失した大会 | 0件 |
| 消失したbout | **0件** |
| 既存boutのフィールド変更 | **0件**(全フィールド完全一致) |
| 新規追加bout | **49件** |
| 非プロ/非MMA判定で除外された回収候補 | 0件 |
| キャッシュ不足でスキップした大会 | 0件 |

`git diff data/deepRecords.json`も1029行がすべて追加行(削除行0)であることを確認済み
(停止条件「差分に減少が1件でも出たとき」に該当なし)。

### motonomiki(本野美樹)の確認

`computeMultiOrgRecord("motonomiki", ...)`を実際に呼び出して検証:

```
{ "wins": 9, "losses": 2, "draws": 0, "orgsWithBouts": ["DEEP", "パンクラス"] }
```

DEEP9戦(7勝2敗)+パンクラス2戦(2勝)=11戦・9勝2敗。ユーザー指摘どおり
`/fighters/motonomiki`の2行目は8-1-0(9戦)→9-2-0(11戦)に修正される。

### キックルール除外の整合確認

回収49件のうち1件(DEEP HAMAMATSU IMPACT 2023、竹内賢一 vs としや、
`headingText: "DEEP 58kg以下 3分3R キックルール"`)は当初の指示書a)監査でも
名指しされていたキックボクシングルール戦。`classifyMmaRuleType()`
(PR #370で`deepRecordsAggregate.ts`に導入済み)に実際に通して確認した結果
`"キックボクシング"`と正しく判定され、`computeFighterDeepRecord()`の
`ruleType !== "MMA" && ruleType !== "unknown"`分岐によりMMA戦績集計から除外される
ことを確認した(現時点で両選手とも`fighterSlug`未解決のため実害は無いが、
仮に将来どちらかがDB収録されても勝敗集計に混入しない設計になっている)。

## 検証

- [x] `npx tsc --noEmit -p .` エラー0件
- [x] `npm run build` 成功(139/139ページ、`check:deep-contamination`等の既存ビルド内
      チェック含む)
- [x] `npm run test:mnews-rating` 220件成功/0件失敗
- [x] `scripts/patch-deep-headingless-recovery.ts`を2回実行してSHA256完全一致
      (決定論的)。さらに、パッチ済みデータに対する3回目の実行で追加0件を確認
      (冪等)。
- [x] `data/rankings.json`等、`deepRecords.json`以外のdata/配下ファイルは無変更
- [x] `git diff data/deepRecords.json`は追加行のみ(削除行0)

## スコープ外として記録した既知のギャップ(今回は対応しない)

調査の過程で、今回のバグとは異なる原因の既存ギャップも見つかった。指示範囲外の
ため修正はしていない:

- **DEEP JEWELS 31**: 生HTMLには「第1試合」〜「第7試合」(7件)の見出しがあるが、
  抽出結果は5boutのみ(構造カウントも8を示す)。番号付き見出しであるにも関わらず
  2bout相当が欠落しており、今回の「見出しなし」バグとは別原因。
- **DEEP OSAKA IMPACT 2022 5th ROUND**: Group1(VS型)フォーマットのbout境界検出が
  この大会では実質1boutしか捕捉できていない(該当大会の生カードは8試合前後)。
  「セミファイナル」ラベルはあるが、番号(「7.」)は元々ページ側に付与されており
  今回のバグの対象外(=見出しなし回収の対象にもならない)。
- 上記2件を含む「構造カウントが最終bout数を上回る大会」は125件(参考値、
  `structuralBoutCount`列で確認可能)。これらは非プロ/非MMA混入・地の文誤検知の
  可能性もあり、内訳の精査は本タスクのスコープ外。

## ファイル

- `src/lib/mnewsRating/deepScraper.ts`: `countStructuralBoutBlocks()`・
  `recoverHeadinglessBouts()`(+内部ヘルパ)追加。既存の抽出正規表現・
  `countBoutHeadings()`・`extractDeepBouts()`は無変更。
- `scripts/build-deep-records.ts`: HTMLキャッシュ対応(`out/deep-html-cache/`)・
  見出しなし回収の呼び出し・構造カウントの診断追加(将来の定期バッチ実行向け)。
- `scripts/patch-deep-headingless-recovery.ts`(新規): 今回`data/deepRecords.json`を
  実際に更新した最小パッチスクリプト。
- `data/deepRecords.json`: 49bout追加(既存データは完全に不変)。

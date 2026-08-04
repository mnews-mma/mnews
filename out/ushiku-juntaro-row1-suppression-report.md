# ushiku-juntaro 通算戦績1行目非表示の原因調査(read-only)

調査日: 2026-08-04 / ブランチ: `investigate/ushiku-juntaro-record-display` / PR #443

## 結論(先に)

- **原因は特定できた**(推測ではなく実値で示す。下記「原因」参照)。
- **指示書のSTOP条件の前提は誤りだった**: ja.wikipedia記事は2024-09-29で止まっていない。直近3戦(2025-05-05/2025-11-02/2026-05-04)は既にwiki側にも反映済みで、1行目に切り替えても消えない。
- ただし切り替えると **22-12-1(35戦) → 22-12-0(34戦)** に微減する(理由は後述、2013年の旧パンクラス戦2件の差)。
- 根本原因は `ushiku-juntaro` 固有のデータ欠損ではなく、`shouldPreferMultiOrgRecord()` の分岐ロジックの穴。**同じ穴に該当する選手が他に2名**いる(件数調査、下記)。
- 上記のためこのPRでは **コード変更はしていない**。判断点を報告し指示を待つ。

## 原因(実値)

`src/lib/fighters.ts:1178`
```
{ slug: "ushiku-juntaro", ..., wins: 0, losses: 0, draws: 0, ..., history: [], recordFromResults: true }
```
`recordFromResults: true` は本来「ja-wikipedia記事が無いDEEP選手のスタブ」用のフラグ(同ファイル50-52行目のコメント)。

しかし `resolveFighter()`(`src/lib/feeds/resolveFighter.ts:42-131`)は現在、`recordFromResults` 選手でも既定タイトル(nameJaのスペース除去)でja-wikipediaを試行し、自社EVENT_RESULTS由来の履歴と相手名が重なれば(同名別人ガード通過)採用する仕様に拡張済み(50-54行目コメント)。ushiku-juntaroはこの解決に成功している。実測(`resolveFighter(seed)` を直接呼び出して確認):

```
live: true
wins: 22, losses: 12, draws: 0 (34戦)
```

つまりこの選手は「1行目のデータが無い」のではなく **1行目は解決済み(live: true)**。それでも1行目が表示されないのは `shouldPreferMultiOrgRecord()`(`src/lib/mnewsRating/multiOrgRecord.ts:212-223`)の分岐が原因:

```ts
if (fighter.noRecordData) return true;
if (fighter.needsReview && !fighter.live) return record.wins + record.losses + record.draws > rowOneWins + rowOneLosses + rowOneDraws;
if (!fighter.recordFromResults) return false;
return record.wins + record.losses + record.draws > rowOneWins + rowOneLosses + rowOneDraws;
```

- `needsReview` の分岐(220行目)は `!fighter.live` を条件に含む — live解決済みなら比較自体をスキップして1行目を守る(SARAMI対応、2026-08-03に追加された仕組み)。
- `recordFromResults` の分岐(221-222行目)には **同じ `live` チェックが無い**。`fighter.recordFromResults` はシード側の静的フラグで、live解決の成否と無関係に常に `true` のまま。そのため無条件で「4団体合算の総試合数 > 1行目の総試合数」の比較に落ちる。
- 実測: 4団体合算 = 22-12-**1**(35戦) > wiki側 = 22-12-**0**(34戦)。35 > 34 のため常に4団体合算(2行目)が優先され、1行目(wiki)は表示されない。

この分岐(221-222行目)の設計コメント(210-211行目)は「recordFromResults選手の1行目は常に0」という前提を書いているが、これはresolveFighter.ts側の後発の拡張(50-54行目、live wiki解決を試みる仕様)によって既に成立しなくなっている。

## STOP条件の検証結果(想定と異なった)

指示書の前提:「ja.wikipedia記事は2024-09-29 RIZIN.48で止まっており、2025-05-05福田龍彌/2025-11-02椿飛鳥/2026-05-04水野新太の3戦が無い」

実機確認(本番と同じMediaWiki API `action=parse` を直接叩いて取得、キャッシュ経由ではない):

```
jaWiki.history 直近6件:
2026-05-04 水野新太 (DEEP 131 IMPACT)
2025-11-02 椿飛鳥   (DEEP 128 IMPACT)
2025-05-05 福田龍彌 (DEEP 125 IMPACT)
2024-09-29 佐藤将光 (RIZIN.48)
...
```

**3戦とも既にja.wikipedia側の戦績表に反映済み**。指示書のこの前提は誤り(いつの時点の閲覧に基づくかは不明。編集が指示書作成後に入った可能性、または当初の確認が不正確だった可能性のいずれか)。したがって「1行目に切り替えるとテーブルから3戦が消える」という懸念は成立しない。

### 実際の差分(1行目 vs 2行目、35戦 vs 34戦)

| ソース限定の試合 | 日付 | 相手 | 結果 | 大会 |
|---|---|---|---|---|
| 4団体合算のみ(wikiに無し) | 2013-09-07 | 柳井康作 | 勝ち | PANCRASE 251 |
| 4団体合算のみ(wikiに無し) | 2013-05-19 | 柳井康作 | 分け | PANCRASE247 |
| wikiのみ(4団体対象外) | 2019-01-12 | マルシオ・セザール | 勝ち | RFC WAY OF THE DRAGON CHAMPIONSHIPS 3(海外団体、ラベルの「他団体・海外での試合は含みません」注記どおり正しく対象外) |

(「2018-08-05 ユータ&ロック/ユータ＆ロック」戦は両ソースに存在。全角/半角アンパサンドの表記差で機械的な突合スクリプトが誤って差分検出しただけで実際の差ではない)

つまり2013年の古いパンクラス戦2件がja-wikipediaの戦績表に載っていないことが、35戦→34戦の差の実体。切り替えると直近の試合が消えるのではなく、2013年の2戦が(表示上は)消える形になる。

## 件数調査(修正なし、集計のみ)

`recordFromResults: true` の選手は `src/lib/fighters.ts` に198名。全員について `resolveFighter()` を実行し、live wiki解決の成否と、成功した場合の `shouldPreferMultiOrgRecord()` 判定を集計:

```
recordFromResults:true 選手 = 198名
live wikipedia解決成功    = 38名
そのうち1行目が2行目に総試合数で下回り抑制されている = 3名
  - ushiku-juntaro (牛久絢太郎): wiki 22-12-0 vs 4団体合算 22-12-1
  - kurobe-kazusa  (黒部和沙)  : wiki 6-1-1  vs 4団体合算 7-2-1
  - ryoga          (亮我)      : wiki 10-2-2 vs 4団体合算 14-7-2
```

3名とも同じ穴(`shouldPreferMultiOrgRecord`の`recordFromResults`分岐に`live`チェックが無い)に該当する可能性が高い(個別のwiki記事内容までは未検証)。

## 対応方針の選択肢(未実施・判断待ち)

1. **ushiku-juntaroだけ個別対応**: `wikiTitleJa` 明示指定や `recordFromResults` フラグの解除など選手単位のデータ修正。ただし2013年の2戦がwiki記事に無いため、単純に1行目へ切り替えると試合数が減る(35→34)という副作用がある。
2. **共通ロジックの穴を塞ぐ**: `shouldPreferMultiOrgRecord()` の `recordFromResults` 分岐にも `needsReview` 分岐と同様の `live` チェックを追加する。この場合ushiku-juntaro含む3名全員に影響が及ぶ(3名とも1行目に切り替わる想定)。`shouldPreferMultiOrgRecord` は選手ページ本体・次戦カード・同階級選手カード・meta description等、複数の消費箇所から共通で参照されている(`multiOrgRecord.ts`コメント437行目)ため、変更の影響範囲はushiku-juntaro単体PRの想定より広い。

どちらを取るか、または現状維持(2行目のみ表示のまま)かはユーザー判断が必要なため、このPRでは変更を加えていない。

## 波及確認(未実施)

上記の理由でコード変更をしていないため、meta title/description・`/api/og/fighter`・次戦カード・`/fighters`一覧カード・`/dream`・`/vs`の波及確認は対象外(変更なし)。

# 公式ランキング4名 未リンク解消フォローアップ(指示書F続き)

> **status: active(2026-08-03)** — cronの完了待ち。次のセッションはここから再開する。

## 背景

`data/orgRankings.json` 上で、以下4名がDBの選手ページにリンクされていない(`slug: null`、またはエントリ自体が無い)状態が2026-08-03時点で確認されている。

| 選手 | 団体・階級 | slug候補 | 状態(2026-08-03 07:00 UTC時点) |
|---|---|---|---|
| ガブリエル・レーベン | パンクラス/ウェルター級 | `levan-gabriel` | `slug: null` |
| 手塚晴希 | パンクラス/ミドル級 | `tezuka-haruki` | `slug: null` |
| エルナニ ペルペトゥオ | 修斗/ウェルター級 | `perpetuo-hernani` | `slug: null` |
| ジェイク ムラタ | 修斗 | `jake-murata` | エントリ自体が無い |

実ページ(`/ranking/pancrase`・`/ranking/shooto`)でも上記3名(ムラタは非掲載)がリンクなしのプレーンテキストとして表示されていることを`read_page`で確認済み(2026-08-03)。

## 事前診断(このセッションで実施済み)

`src/lib/orgRankings.ts` の `matchSlug()`/`nameIndex`(29〜43行目付近)を確認した結果:

- 名前正規化は空白・「・」・「☆」・括弧書きの除去のみ。**denylistの類の除外機構は存在しない**。
- `FIGHTERS`配列全件(hidden含む)を対象にした完全一致(正規化後)のみでslugを引く。
- `data/orgRankings.json`の`slug`はページ描画時のライブ再計算ではなく、cron実行時(`scripts/update-org-rankings.ts`→`parsePancrase`/`parseShooto`)にこの`matchSlug()`で**事前計算されGitHub raw経由でそのまま描画に使われる**(`src/lib/orgRankingsData.ts`、revalidate:3600)。

`src/lib/fighters.ts`(origin/main時点)を確認した結果、3名の`nameJa`は公式ランキングページ上の表記(`officialName`)と完全一致(文字列レベルで一致、正規化前から一致):

- `nameJa: "ガブリエル・レーベン"` (slug: `levan-gabriel`, 1317行目)
- `nameJa: "手塚晴希"` (slug: `tezuka-haruki`, 1309行目)
- `nameJa: "エルナニ ペルペトゥオ"` (slug: `perpetuo-hernani`, 2277-2278行目)

いずれも重複(同名の別エントリによるシャドーイング)なし。

**仮説**: 3名とも表記ゆれ・denylistが原因ではなく、**FIGHTERS配列への追加が直近のcron実行より後だった**ことによる時間差が原因。次回cron実行(今回分)で解消される見込みが高い。ジェイク ムラタはFIGHTERSには存在する(#398で追加済み)が、`data/orgRankings.json`側にエントリ自体が無いため、公式ランキングにまだ掲載されていないか、スクレイパー側の取りこぼしの可能性がある(未調査)。

この仮説は**未検証**。以下の手順で実測すること。

## 確認手順

### 1. cronの完了確認
`update-org-rankings.yml`のnominal実行はUTC 15:17(JST 0:17)。過去18回の実測遅延は中央値3.27時間・最大5.25時間(2026-07-07〜07-24計測、[project_mnews.md参照](../../CLAUDE.md)の「定期実行ジョブ一覧」)。2026-08-03分の完了は早くてUTC 18:00頃、遅ければ21:00過ぎの可能性がある。

```bash
gh run list --workflow=update-org-rankings.yml --json databaseId,status,conclusion,createdAt,updatedAt -L 5
```

本日分が`completed`/`success`になっているか確認。まだなら先に進まない。

### 2. `data/orgRankings.json`のslug確認
```bash
git pull origin main
grep -n 'ガブリエル・レーベン\|手塚晴希\|エルナニ ペルペトゥオ\|ジェイク ムラタ' data/orgRankings.json
```
各エントリの`slug`フィールドの値(1つ上の行、または`Read`で前後確認)を記録する。

### 3. 実ページでのリンク化確認
`/ranking/pancrase`・`/ranking/shooto`をブラウザ(またはWebFetch)でレンダリングし、4名が`<a href="/fighters/...">`になっているか確認する。**注意**: curlで取得した生HTMLはNext.jsのRSCペイロードでエスケープされておりgrepでは判定しづらい(このセッションで実際に読み取り失敗した)。ブラウザでレンダリングするか、`read_page`/`get_page_text`相当のツールを使うこと。手順2のJSONの`slug`が非nullなら、原則としてページ側もリンクになる(同じデータソースを直接描画しているため)。

### 4. 未解決が残った場合の切り分け
手順2・3で依然`null`/未リンクの選手が残った場合:
- `git pull origin main`後の`src/lib/fighters.ts`で該当選手の`nameJa`をgrepし、`data/orgRankings.json`の`officialName`と文字単位で突き合わせる → 不一致なら表記ゆれ。
- FIGHTERS配列に該当選手のエントリ自体が無ければ「選手DB未登録」が原因。
- ジェイク ムラタのように`data/orgRankings.json`にエントリ自体が無い場合は、公式ランキングページ(修斗: https://www.shooto-mma.com/ranking/ 、パンクラス: https://www.pancrase.co.jp/rls/ranking.html )を直接WebFetchし、本人が現時点で掲載されているか確認する。掲載されていなければ「まだ公式ランキングに未掲載」が原因(matchSlugとは無関係)。掲載されているのに`orgRankings.json`に出てこなければスクレイパー側の取りこぼしの疑いがあり、別途調査が必要。
- `src/lib/orgRankings.ts`のmatchSlug経路にdenylistは無いことは確認済みだが、念のため`grep -rn denylist src/lib`で他に除外機構が無いか一応確認してよい。

### 5. `/fighters/perpetuo-hernani`の戦績反映確認(cronと独立、先に確認可)
`data/shootoProfileBouts.json`(#399で12戦追加)はGitHub raw経由revalidate:3600(最大1時間)で取得されるため、Vercelの新規デプロイの成否とは無関係に反映される設計。ブラウザで確認し、「戦績データがありません」の文言が消えて対戦相手名・戦績が表示されているか確認する。

## 参考: Vercelビルド枠について(このセッションで判明・現在進行中の別件)

2026-08-03朝、Vercelのビルドが`retry in 24 hours`のレート制限に断続的に引っかかっている(`vercel ls`で`www.mnews.jp`エイリアスの向き先を都度確認可能)。07:16 UTC時点で本番は`dpl_C3TXgVEdTxoL8Lh72NQZWGkcUjxe`(コミット`addfc86`=#401)のまま。別セッションが#408で「retrigger deploy」コミットを試みているが、07:16 UTC時点ではまだ新しい本番デプロイには切り替わっていない。

**この件と本メモの4名リンク化確認は独立**: `data/orgRankings.json`・`data/shootoProfileBouts.json`の反映はいずれもGitHub raw参照+ISR revalidateの仕組みで、新規Vercelデプロイの成否に左右されない。ビルド枠の状況を待つ必要はない。

## 副次的なドキュメント不整合(未対応・単独PR化しない)

CLAUDE.mdの「デプロイ」節にある `POST /api/revalidate-rankings`(`REVALIDATE_TOKEN`)の記述は**実装からすでに撤去済み**(`src/lib/mnewsRatingData.ts`冒頭コメント参照)。GitHub raw参照によるデプロイ非依存の自動反映に置き換わっており、この即時反映エンドポイントは存在しない。次にCLAUDE.mdを触るPRで合わせて修正すること(このためだけの単独PRは立てない)。

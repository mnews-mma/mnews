# R-3: post-deploy翌日確認(読み取り専用)

読み取り専用。修正・PR作成は行っていない。本番サイト(www.mnews.jp)への閲覧アクセスとVercel/GitHub CLIの読み取りのみ実施。

## 1. `update-fighter-records` Actionの完了確認

- `gh run list --workflow=update-fighter-records.yml` で直近5回すべて `completed / success`。
- 最新実行: run 30128505420、2026-07-24T21:40:11Z開始、9m8s、success。
- 当該実行が `data/rankings.json` を更新してpush済みであることをログで確認(`git diff --quiet` の分岐で `git commit && git push` 側を実行し `e7c6868..b12c858 main -> main` を出力)。
- 前提クリア。以降の検証に進んだ。

## 2. 本番 `/rankings/*` ページタイトルの日付が `rankings.json` の `updatedAt`(JST変換)に追従しているか

- `origin/main`上の`data/rankings.json`(最新コミット`b12c858`, 2026-07-24T21:49:13Z)を確認: 全5階級(flyweight/bantamweight/featherweight/lightweight/heavyweight)とも`updatedAt: "2026-07-24T21:49:13.576Z"`で統一。
- JST変換: 2026-07-24T21:49:13.576Z UTC = 2026-07-25 06:49:13 JST。
- 本番ページタイトルを4階級で直接取得(`curl`):
  - flyweight: 「AI RIZINフライ級ランキング【2026年7月25日更新】｜...」
  - bantamweight: 「AI RIZINバンタム級ランキング【2026年7月25日更新】｜...」
  - featherweight: 「AI RIZINフェザー級ランキング【2026年7月25日更新】｜...」
  - lightweight: 「AI RIZINライト級ランキング【2026年7月25日更新】｜...」
- 4階級ともJST変換後の日付(2026年7月25日)と一致。heavyweightは今回未取得(未公開階級のため本確認の対象外、[mnewsレーティング(RIZIN独自Elo)]メモの既知事項)。

## 3. キャッシュバスティングの仕組み(コード確認)

`src/lib/mnewsRatingData.ts`:
- `RANKINGS_REVALIDATE = 900`(15分)
- `CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"` — GitHub raw取得URLに`?v=<デプロイ時点のcommit SHA>`として付与。新規デプロイのたびにURLが変わり、Vercel Data Cacheが強制的に再取得される。
- ページ側`export const revalidate = 900`(`src/app/rankings/[division]/page.tsx:18`)とデータ層の`RANKINGS_REVALIDATE`が同値で揃っている。

## 4. ISR revalidateが実際に日次で新鮮な出力を生んでいるか(実測)

- `curl -sI https://www.mnews.jp/rankings/flyweight` のレスポンスヘッダ: `x-vercel-cache: HIT`, `age: 655`(約11分)。
- 900秒(15分)のrevalidateウィンドウ内であり、キャッシュHITは仕組み通り。タイトルの日付も最新更新(2026-07-25 JST)と一致しており、スケール上「陳腐化して古い値が出続けている」状態ではないことを確認。

## 5. `archive-articles` のpushがVercel本番デプロイをトリガーしているか

- `.vercel/project.json`および`vercel.json`に`ignoreCommand`等のデプロイスキップ設定は無し。コミットメッセージの`[skip ci]`はGitHub Actions側の制御用タグであり、Vercelのgit連携デプロイを止める設定は本リポジトリには存在しない。
- `vercel ls --environment production -F json` で実測: 以下のbotコミットがいずれも個別のProduction deploymentとして記録されていることを直接確認。
  - `chore: archive new articles [skip ci]`(commit `4e785ea` 等) → 2026-07-25T15:48:18Z にProduction deploy
  - `chore: update fighter records + mnews rating [skip ci]`(commit `b12c858`) → 2026-07-24T21:49:17Z にProduction deploy
  - `chore: update org rankings [skip ci]`(commit `e7c6868`) → 2026-07-24T20:04:41Z にProduction deploy
- **結論: `archive-articles`を含む全てのbot自動コミットのpushはそのままVercel本番デプロイをトリガーしている(バッチ更新パス=デプロイパス)。** 「そうでなければ原因を特定」の分岐は該当なし(想定通り追従している)。

## まとめ

| 確認項目 | 結果 |
|---|---|
| update-fighter-records Action完了 | 済(2026-07-24T21:40:11Z, success) |
| ページタイトルのJST日付追従 | 一致(4/4階級で確認、2026年7月25日) |
| キャッシュバスティング(commit SHAクエリ) | 実装済み(コード確認) |
| ISR revalidate(900秒)の実動作 | 正常(x-vercel-cache: HIT, age=655s < 900s) |
| archive-articles push→本番デプロイ | 直結を確認(他2種のbotコミットも同様) |

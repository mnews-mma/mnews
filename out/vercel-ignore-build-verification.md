# Vercel Ignored Build Step 動作検証(PR #371)

このコミットは `out/` のみの変更で、Vercel本番デプロイのビルドがスキップされることを実測確認するための検証コミット。

- 対象PR: #371 (`vercel.json` に `ignoreCommand: bash scripts/vercel-ignore-build.sh` を追加)
- 期待挙動: `out/` のみの変更のためビルドはスキップされる

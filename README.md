# Mニュース

日本MMA特化のニュースキュレーションサイト（広告ゼロ）。RIZIN・UFC・修斗・DEEP・ONE FC・パンクラスの最新ニュースを一か所にまとめて表示し、選手戦績ページも提供する。

仕様は [`mnews-spec.md`](./mnews-spec.md) を参照。

## 技術スタック

- Next.js 15 (App Router) + TypeScript
- Vercel ホスティング

## ローカル開発

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できる。

## 現在のスコープ

- トップページ（mnews.html のデザインを再現）
- 選手戦績一覧 `/fighters` と個別ページ `/fighters/[slug]`
- 記事データは `src/lib/articles.ts` のシードデータ

以下は仕様書に記載のある将来フェーズで、未実装（バックエンド連携が必要）:

- RSS収集・スクレイピングによる記事の自動収集（30分おき）
- 記事DBと重複排除
- X（Twitter）API v2 への自動投稿
- Wikipedia API からの選手戦績自動取得

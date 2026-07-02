# PROGRESS.md — 2026-07-01 更新

## サイト概要
**Mニュース**（https://www.mnews.jp）
日本MMAニュース速報サイト。RIZIN・DEEP・パンクラス・修斗の公式フィード＋ゴング格闘技・MMAPLANET・イーファイトをRSSで集約。選手戦績・試合結果・X投稿用カードを提供。

## 直近のリリース（このセッション）

### ニュース品質改善
- X投稿ダイジェストのタイトル文字数制限を撤廃（30文字→全文）
- Fight&Life・TV番組系をLOW_VALUE_KEYWORDSに追加してニュース選出から排除
- 出場決定・撃破・勝利など高価値キーワードをIMPACT_KEYWORDSに追加
- フック（見出し）とニュースリストの重複を排除（4件取得して先頭をフック専用に）

### 選手戦績ページ改善
- KO/一本/判定の内訳を表示
- モバイルで「大会名」「ラウンド」列を非表示にして4列に収める
- 選手詳細ページから「→ X投稿用カード作成」リンクを追加（選手が自動選択される）

### X投稿用カードツール（/admin/og-card）
- 「OGカード」→「X投稿用カード作成」にリネーム
- 画像URLと選手URLを「シェアURL」1本に統合
- 選手AとBを入れ替えるボタン追加（VSモード）
- VSカード用に `/vs/[slugA]/[slugB]` ページを新設（OGP対応、Xに投稿ボタン付き）
- 「Xに投稿」ボタン追加（シングル・VS両対応）

### SEO
- トップページdescriptionに「格闘技」追加
- 大会結果ページのdescriptionを試合数入りに充実
- 選手ページのdescriptionにKO/一本数など詳細追加、h2見出し追加
- ナビバーに「日本MMAニュース速報」タグライン追加

### バグ修正
- pancrase-355の試合順が逆だったのを修正（王座決定戦を先頭に）
- OG画像キャッシュを1年→1時間に短縮
- VSカードヘッダーから「対戦カード予想」の文言を削除
- 選手カード右下の団体/階級表示を削除（左上と重複）

### インフラ
- `vercel deploy --prod --yes` で手動デプロイ運用を確立
- `vercel crons run /api/cron/daily-digest` でダイジェスト再送信可能

## 未対応・検討中

### 近い将来
- サイトマップ（sitemap.xml）自動生成 → Search Consoleに送信
- 大会結果ページ → 出場選手ページへの内部リンク
- 大会一覧ページの作成

### 将来的に
- PWAプッシュ通知（ユーザーが増えてリピーター施策が必要になったタイミング）
- React Nativeアプリ化（さらに先のフェーズ）

## デプロイ方法
```bash
git add -p && git commit -m "..." && git push origin main
vercel deploy --prod --yes
```

## ダイジェスト再送信
```bash
vercel crons run /api/cron/daily-digest
```

## 主要ファイル
| ファイル | 役割 |
|---|---|
| `src/lib/fighters.ts` | 選手マスターデータ |
| `src/lib/eventResults.ts` | 大会結果データ |
| `src/lib/tweetDigest.ts` | X投稿ダイジェスト生成ロジック |
| `src/lib/feeds/aggregate.ts` | RSSフィード集約 |
| `src/components/OgCardTool.tsx` | X投稿用カードツールUI |
| `src/app/api/og/fighter/[slug]/route.tsx` | 選手カード画像生成 |
| `src/app/api/og/vs/[slugA]/[slugB]/route.tsx` | VSカード画像生成 |
| `src/app/vs/[slugA]/[slugB]/page.tsx` | VSカードシェアページ |
| `src/app/api/cron/daily-digest/route.ts` | 朝刊ダイジェストcron |

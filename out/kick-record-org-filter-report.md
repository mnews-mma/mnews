# /kick 勝敗集計 + 検索団体フィルタ 受入条件チェック

対象PR: feat/kick-record-summary-org-filter
検証時点データ: 選手2,482人・戦績15,950件(15団体)

## 1. 勝敗集計の表示例3件

| 選手 | slug | 表示 |
|---|---|---|
| 阿部 晴翔(通常) | abe-haruka | 収録5試合: 2勝3敗0分 |
| 隼斗(unknownを含む、NKB由来) | hayato-3 | 収録9試合: 1勝7敗0分、ほか不明1件 |
| アラッサン・カマラ(scheduledを持つ) | arasan-kamara | 収録2試合: 1勝1敗0分(生bout4件中、予定1件・無効1件は対象外) |

## 2. 集計値の突合(トップの15,950件との整合)

全選手の `record` を合算:

```
勝(win)   8,830
敗(loss)  6,339
分(draw)    576
不明(unknown) 57
-----------------
小計     15,802
対象外(no_contest 84 + cancelled 2 + walkover 62) 148
=================
合計     15,950  ← stats.boutRowsCompleted と一致
```

不戦勝/不戦敗(method=walkover、62件)は SCHEMA.md(`/Users/kainakishiyoshi/立ち技/SCHEMA.md`)が
「不戦勝は…集計時に除外できるようにする」と明記して method=walkover を独立させた設計意図に従い、
勝敗集計(収録N試合)からは**除外**した。scheduled(61件)・no_contest(84件)・cancelled(2件)も
勝敗に数えない(要件どおり)。

`resultUnknownCount`(トップ/選手一覧の説明文が使う全体件数、57件)と、本機能の
`unknownCount` を全選手で合算した値が完全一致することを確認済み(どちらも57件)。
ハードコードではなく、同じビルドスクリプト内でbout実データから独立に集計している。

## 3. 「通算」という語の不使用

```
grep -rn "通算" src/app/kick/ src/lib/kick/ scripts/build-kick-data.ts
```
→ 0件(該当なし)。

## 4. 団体フィルタの動作例

- 単独: 出場団体=RISE のみ選択、テキスト未入力 → RISE出場選手のみ一覧表示
- 併用: 出場団体=RISE + テキスト「やまだ」 → 「山田洸誠(RISE)」に絞り込み

## 5. 検索インデックス / First Load JS の増分

| 項目 | 変更前 | 変更後 | 増分 |
|---|---|---|---|
| public/kick/search-index.json | 298,987 B | 339,602 B | +40,615 B(+13.6%) |
| /kick/fighters First Load JS | 107 kB | 108 kB | +1 kB |
| /kick/fighters/[slug] First Load JS | 106 kB | 106 kB | 変化なし(サーバー側で焼き込み済みのため) |

出場団体は短縮タグ(sb/rise/knockout/k1/rizin/one/deepkick/njkf/hoostcup/nkb/
bigbang/standup/krossover/snka/jka)で保持し、未出場選手(583人)はキー自体を省略。

## 6. /kick/fighters 生HTMLの回帰確認

```
curl -s http://localhost:4173/kick/fighters | grep -o 'href="/kick/fighters/[^"]*"' | sort -u | wc -l
```
→ 2,482件(変化なし)。フィルタ未選択時の静的リストは無変更。

## 7. 静的性・レンダリングモード

`npm run build`(check:route-rendering-mode含む全ゲート)が通過。
/kick, /kick/fighters は ○(Static)、/kick/fighters/[slug] は ●(SSG、2,482ページ
generateStaticParams)のまま。force-dynamicの追加なし。集計・団体タグ付けは
すべて scripts/build-kick-data.ts (ビルド時)で実行し、リクエスト時集計はゼロ。

## 8. 既存ルートへの影響

/kick, /kick/fighters, /kick/fighters/[slug], / (トップ), /rankings をローカルで
200応答確認。説明文PR(#521)由来のテキスト(「データの扱いについて」「収録していないもの」
「/kick/fighters の検索案内文」)はrebase後も維持されていることを確認済み。

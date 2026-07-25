# PR #177 (feat/p4p-production) コストレポート — P-1

数値のみ。推奨・判断は記載しない。ブランチ本体は一切checkout/rebase/変更していない（`git archive`によるread-only snapshot抽出と`git log`/`git diff`のみ使用）。

## 基礎情報

- 対象ブランチ: `origin/feat/p4p-production`（HEAD `a568384`）
- merge-base (main): `36628fa31b0d176ccfebc153a6bef14d3d82045d`（2026-07-22 21:47:46 JST）
- 最終コミット: `a568384`（2026-07-24 16:35:23 JST, "feat: P4Pのclampを閾値付きに変更(僅差の逆転のみ抑制)"）
- コミット数: 9
- diffstat（merge-base→HEAD）: 11 files changed, 2426 insertions(+), 9 deletions(-)
- 経過日数: 2026-07-24 16:35:23 JST 〜 2026-07-26 01:11:42 JST(確認時刻) = 1日8時間36分（約1.36日）

## (a) main側の変更ファイルとの交差（rebase時のコンフリクト面）

- main側変更ファイル数（merge-base以降）: 65
- #177変更ファイル数: 11
- 交差（両方に出現するファイル）: 3件
  - `src/app/page.tsx`
  - `src/app/rankings/page.tsx`
  - `src/lib/mnewsRatingData.ts`

#177の変更ファイル一覧（11件）: `data/p4p.json`, `scripts/generate-p4p.ts`, `src/app/page.tsx`, `src/app/rankings/methodology/page.tsx`, `src/app/rankings/page.tsx`, `src/app/rankings/pound-for-pound/page.tsx`, `src/components/MnewsRatingSection.tsx`, `src/lib/championDefenses.ts`, `src/lib/mnewsRating/p4pFile.ts`, `src/lib/mnewsRatingData.ts`, `src/lib/rankings/requiredInvariants.ts`

## (b) 交差ファイルが mnewsRating/ , app/rankings/ , 日付処理コードを含むか

- `mnewsRating/`配下: 交差ファイル自体はゼロ件だが、#177の変更ファイルには`src/lib/mnewsRating/p4pFile.ts`が含まれる（これは交差リストには入っていない＝main側では触られていないファイル）。`src/lib/mnewsRatingData.ts`は`mnewsRating/`の兄弟ファイルであり、ディレクトリ配下ではない。
- `app/rankings/`配下: `src/app/rankings/page.tsx`が交差に含まれる（該当あり）。
- 日付処理コード: `src/app/page.tsx`が交差に含まれる。main側の当該ファイル差分には日付処理変更（JST計算を`eventCountdown.ts`ヘルパーへ移行）が含まれる。#177側の同ファイル差分には日付関連の変更行はゼロ（`git diff`上で日付関連のtoken一致なし）。

## (c) PR-Fゲート（JST日付バイパス検出）のヒット件数

`git archive origin/feat/p4p-production -- src scripts`でread-only抽出したスナップショット（197ファイル）に対し、main上の現行`scripts/check-jst-date-bypass.ts`＋現行baseline(`jst-date-bypass-baseline.json`)を適用してスキャンした。

- スナップショット全体に対する生ヒット件数: **27件**
- そのうち #177の実際の変更ファイル（上記11件）内にあるヒット: **2件**
  - `scripts/generate-p4p.ts:111` `[date-only string passed to Date constructor]` `const FAR_FUTURE_PROBE = new Date("2999-01-01T00:00:00.000Z");`
  - `scripts/generate-p4p.ts:114` `[date-only string passed to Date constructor]` `const asOf = latestBoutDate ? new Date(latestBoutDate) : FAR_FUTURE_PROBE;`
  - 検証: `scripts/generate-p4p.ts`はmain上に存在しない（`git show origin/main:scripts/generate-p4p.ts`が失敗＝#177が新規作成したファイル）。baseline中に同ファイルのエントリは0件。→ この2件は#177の変更に帰属する。
- 残り **25件** は#177が変更していない8ファイル内（`src/app/admin/x-preview/page.tsx`, `src/app/events/[slug]/page.tsx`, `src/app/sitemap.ts`, `src/components/DigestPicker.tsx`, `src/components/EventRail.tsx`, `src/components/EventsFilterList.tsx`, `src/components/WeighInTool.tsx`, `scripts/update-fighter-records.ts`）。
  - 原因の切り分け（スポットチェック）: `src/app/events/[slug]/page.tsx`について、main現行baselineには`const d = new Date(dateStr);`という変数名`d`のコード文字列がlegacyエントリとして登録済み。一方#177のスナップショット中の同ファイル・同箇所は`const target = new Date(dateStr);`（変数名`target`）で、baselineのコード文字列と一致しないため未照合＝新規ヒット扱いになっていた。baselineはfile::pattern::codeの完全一致キーであり、#177分岐後にmain側で当該ファイルがリファクタされ変数名等が変わったことで、#177の古いスナップショットのコード文字列がbaselineの現行文字列と一致しなくなっている。
  - 25件が属する8ファイルはいずれも#177の変更ファイルリスト（11件）に含まれない。

## まとめ（数値のみ）

| 項目 | 値 |
|---|---|
| コミット数 | 9 |
| diffstat | 11 files, +2426/-9 |
| 経過日数 | 約1.36日（2026-07-24 16:35 JST → 2026-07-26 01:11 JST） |
| main側変更ファイル数 | 65 |
| #177変更ファイル数 | 11 |
| 交差ファイル数 | 3 |
| ゲート生ヒット数（スナップショット全体） | 27 |
| ゲートヒット数（#177変更ファイル内のみ） | 2（すべて`scripts/generate-p4p.ts`、新規作成ファイル） |
| ゲートヒット数（#177が触れていないファイル由来） | 25 |

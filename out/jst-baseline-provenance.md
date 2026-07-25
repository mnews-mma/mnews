# jst-baseline-provenance: PR-F2b baseline由来確認レポート

生成日時(JST): 2026-07-25

## 1. S1: 現状の事実(ブランチ実物から)

| 項目 | 実物での値 |
|---|---|
| `eventCountdown.ts` の export 関数(生カウント) | **8個**: `startOfTodayJstMs` / `daysUntilEventJstFromMidnight` / `daysUntilEventJst` / `toJstDateStr` / `formatEventDateJa` / `formatDateJa` / `formatEventYearMonthJa` / `shiftDateStr` |
| baseline ファイルの行数(violations件数) | **99件** |
| ゲートの検出パターン数 | **5つ**(既存4 + `split("-")`/`split("/")` ) |

### 過去2つの報告との差異

- **関数数(報告A「7」/報告B「6」)**: `daysUntilEventJstFromMidnight`と`daysUntilEventJst`は前者が後者に純粋委譲するペアであり、プロジェクトの慣例(#206)では1組として数える。この数え方だと8個中「ペア=1・単独6個」=**7個**(報告Aと一致)。私が以前提出した報告B(6個)はこのペアを2個として数えていたための表記ゆれで、実体の差ではない。
- **baseline件数(報告A「99」/報告B「101」)**: 現在のブランチ実物は**99件**で報告Aと一致。差異の原因はS2で確定(下記)。
- **`buildRankingsHubTitle`/`buildRankingsDivisionTitle`の処置**: 現在の`seoTemplates.ts`を確認したところ、両関数は`eventCountdown.ts`の新設関数`formatDateJa`を呼ぶ形に**修正済み**で、baselineには含まれていない。報告Aと一致。

**結論**: 現在のブランチは報告Aの状態と一致している。報告Bは、後述する「PR-Aの誤同定」により誤った判断をしていた(下記2節)。

## 2. 重要な訂正: 「PR-A」の誤同定について

S2(由来確認)を進める過程で、**私自身が当初「PR-A」を誤って特定していたことが判明した**。

- 誤: `4c61f47`/`13807f7`(2026-07-10、パンクラス/修斗ランキングpageのtitle動的化)をPR-Aと誤認していた。これはPR-I(#212)で扱った別機能(`orgRankings.ts`)であり、PR-Aとは無関係。
- 正: **PR-A = #199**(マージコミット`f48f3ff`のメッセージに明記: 「SEO: メタtitle/description改善(PR-A: 選手/VS/ランキング)」)。実体は`seoTemplates.ts`を新設する2コミット:
  - `b833665`(2026-07-25 12:03:17 JST)「feat(seo): メタtitle/descriptionをテンプレート化」
  - `11ff9fc`(2026-07-25 12:29:42 JST)「fix(seo): 選手descriptionにも文字数上限を実装」

この誤同定により、S2の初回試行では境界を2026-07-10として計算し、**57件が「new」に誤分類された**(mnewsレーティング機能の実装群が大量に該当。ただし同機能はPR-Aと無関係な別施策で、単に時期が7/11〜7/23と「7/10より後」だっただけ)。正しい境界(2026-07-25 12:03 JST)で再計算した結果は下記3節の通り。

## 3. S2: baseline 全99件の由来分類(訂正後・確定)

| origin | 件数 |
|---|---|
| legacy(PR-A着手前から存在) | **99** |
| new(PR-A以降に書かれた) | **0** |
| unknown(由来特定不能) | **0** |

**全99件がlegacyに分類された。** 最も新しい由来コミットでも2026-07-20(`rankAttribution.ts`)で、PR-A着手(2026-07-25 12:03 JST)より前。

### 名指し3件の由来と処置

| 関数/変数 | ファイル | 状態 | 由来 |
|---|---|---|---|
| `buildRankingsHubTitle` | `src/lib/seoTemplates.ts` | **baselineに無い(修正済み)** | PR-A本体(`b833665`, 2026-07-25)由来の新規コード。`formatDateJa`呼び出しに修正済み |
| `buildRankingsDivisionTitle` | `src/lib/seoTemplates.ts` | **baselineに無い(修正済み)** | 同上 |
| `twoYearsBefore` | `src/lib/mnewsRating/divisions.ts` | **baseline内(legacy)** | `c35ff2ac10`(2026-07-13、mnewsレーティングPhase3)由来。PR-Aより12日前に書かれた既存負債。baseline維持が正しい |

全99件の詳細な由来一覧(file / pattern / commit_sha / commit_date / origin)は以下の通り(全件、サンプリングなし)。

<details>
<summary>baseline全99件の由来(クリックで展開)</summary>

| file | pattern | commit_sha | commit_date | origin |
|---|---|---|---|---|
| scripts/check-h2h-invariant.ts | local getter .getFullYear() | 9995442fb4 | 2026-07-16 | legacy |
| scripts/check-h2h-invariant.ts | local getter .getMonth() | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/check-h2h-invariant.ts | toISOString().slice(0,10) | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/check-h2h-invariant.ts | toISOString().slice(0,10) | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/check-rizin-weightclass-null.ts | local getter .getMonth() | a5762a6b7a | 2026-07-19 | legacy |
| scripts/check-rizin-weightclass-null.ts | toISOString().slice(0,10) | a5762a6b7a | 2026-07-19 | legacy |
| scripts/check-rizin-weightclass-null.ts | toISOString().slice(0,10) | a5762a6b7a | 2026-07-19 | legacy |
| scripts/compute-mnews-rating.ts | toISOString().slice(0,10) | e0b539eef3 | 2026-07-11 | legacy |
| scripts/dump-ranking-p1-comparison.ts | local getter .getFullYear() | 735949deb8 | 2026-07-15 | legacy |
| scripts/dump-ranking-v9-comparison.ts | local getter .getFullYear() | 8256d34844 | 2026-07-16 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | a976c7c4b5 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | a976c7c4b5 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | a976c7c4b5 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | a976c7c4b5 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | fd24a4fa3f | 2026-07-13 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | fd24a4fa3f | 2026-07-13 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 18d832b1ce | 2026-07-16 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 272d2c79a2 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 0244b590ce | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | c39eb9c1c7 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | date-only string passed to Date constructor | 0244b590ce | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | toISOString().slice(0,10) | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | toISOString().slice(0,10) | 4827777b25 | 2026-07-12 | legacy |
| scripts/test-mnews-rating.ts | toISOString().slice(0,10) | e0b539eef3 | 2026-07-11 | legacy |
| scripts/test-mnews-rating.ts | toISOString().slice(0,10) | e0b539eef3 | 2026-07-11 | legacy |
| scripts/update-mnews-rating.ts | local getter .getFullYear() | a976c7c4b5 | 2026-07-12 | legacy |
| scripts/update-mnews-rating.ts | local getter .getMonth() | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/update-mnews-rating.ts | toISOString().slice(0,10) | d40b697ea5 | 2026-07-11 | legacy |
| scripts/update-mnews-rating.ts | toISOString().slice(0,10) | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/update-mnews-rating.ts | toISOString().slice(0,10) | d40b697ea5 | 2026-07-11 | legacy |
| scripts/update-mnews-rating.ts | toISOString().slice(0,10) | 6c37c4b4e6 | 2026-07-19 | legacy |
| scripts/update-mnews-rating.ts | toISOString().slice(0,10) | 5b0b2f6eee | 2026-07-19 | legacy |
| scripts/update-rizin-records.ts | toISOString().slice(0,10) | 3ec0957ec3 | 2026-07-13 | legacy |
| src/app/api/cron/countdown-post/route.ts | toISOString().slice(0,10) | 250a5bedd3 | 2026-07-04 | legacy |
| src/app/api/og/digest/route.tsx | date-only string passed to Date constructor | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/digest/route.tsx | date-only string passed to Date constructor | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/digest/route.tsx | local getter .getDate() | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/digest/route.tsx | local getter .getFullYear() | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/digest/route.tsx | local getter .getMonth() | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/event-card/[slug]/route.tsx | date-only string passed to Date constructor | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/event-card/[slug]/route.tsx | local getter .getDate() | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/event-card/[slug]/route.tsx | local getter .getMonth() | 51180a66ef | 2026-07-03 | legacy |
| src/app/api/og/event-result/[slug]/route.tsx | date-only string passed to Date constructor | 1293223ab3 | 2026-07-08 | legacy |
| src/app/api/og/event-result/[slug]/route.tsx | local getter .getDate() | 1293223ab3 | 2026-07-08 | legacy |
| src/app/api/og/event-result/[slug]/route.tsx | local getter .getMonth() | 1293223ab3 | 2026-07-08 | legacy |
| src/app/api/og/result/route.tsx | date-only string passed to Date constructor | 0a53c72880 | 2026-07-03 | legacy |
| src/app/api/og/result/route.tsx | local getter .getDate() | 0a53c72880 | 2026-07-03 | legacy |
| src/app/api/og/result/route.tsx | local getter .getFullYear() | 0a53c72880 | 2026-07-03 | legacy |
| src/app/api/og/result/route.tsx | local getter .getMonth() | 0a53c72880 | 2026-07-03 | legacy |
| src/app/events/[slug]/page.tsx | date-only string passed to Date constructor | 1ee937d16f | 2026-07-02 | legacy |
| src/app/events/[slug]/page.tsx | local getter .getDate() | 1ee937d16f | 2026-07-02 | legacy |
| src/app/events/[slug]/page.tsx | local getter .getDay() | 1ee937d16f | 2026-07-02 | legacy |
| src/app/events/[slug]/page.tsx | local getter .getFullYear() | 1ee937d16f | 2026-07-02 | legacy |
| src/app/events/[slug]/page.tsx | local getter .getMonth() | 1ee937d16f | 2026-07-02 | legacy |
| src/components/DataFreshness.tsx | toISOString().slice(0,10) | 63373ff04f | 2026-07-10 | legacy |
| src/components/UnifiedFeed.tsx | toISOString().slice(0,10) | ebce5253f3 | 2026-07-04 | legacy |
| src/lib/eventResults.ts | date-only string passed to Date constructor | 9537189a3f | 2026-07-02 | legacy |
| src/lib/eventResults.ts | local getter .getDate() | 9537189a3f | 2026-07-02 | legacy |
| src/lib/eventResults.ts | local getter .getFullYear() | 9537189a3f | 2026-07-02 | legacy |
| src/lib/eventResults.ts | local getter .getMonth() | 9537189a3f | 2026-07-02 | legacy |
| src/lib/feeds/aggregate.ts | date-only string passed to Date constructor | 1064d4a816 | 2026-07-08 | legacy |
| src/lib/feeds/aggregate.ts | date-only string passed to Date constructor | 3ab7a81499 | 2026-06-27 | legacy |
| src/lib/feeds/aggregate.ts | local getter .getFullYear() | 5c82930e6c | 2026-06-29 | legacy |
| src/lib/feeds/wikipedia.ts | date-only string passed to Date constructor | e7ed7fd876 | 2026-06-29 | legacy |
| src/lib/feeds/wikipedia.ts | date-only string passed to Date constructor | e7ed7fd876 | 2026-06-29 | legacy |
| src/lib/feeds/wikipedia.ts | regex date decomposition | 3c7aaeb8f7 | 2026-06-27 | legacy |
| src/lib/feeds/wikipedia.ts | regex date decomposition | e7ed7fd876 | 2026-06-29 | legacy |
| src/lib/feeds/wikipedia.ts | regex date decomposition | d02ad174bf | 2026-07-10 | legacy |
| src/lib/feeds/wikipedia.ts | regex date decomposition | 3c7aaeb8f7 | 2026-06-27 | legacy |
| src/lib/mnewsRating/divisions.ts | date string split("-") | c35ff2ac10 | 2026-07-13 | legacy |
| src/lib/mnewsRating/eligibilityRules.ts | date-only string passed to Date constructor | 1fb29ec40c | 2026-07-13 | legacy |
| src/lib/mnewsRating/eligibilityRules.ts | date-only string passed to Date constructor | cce4da7814 | 2026-07-13 | legacy |
| src/lib/mnewsRating/eligibilityRules.ts | date-only string passed to Date constructor | cce4da7814 | 2026-07-13 | legacy |
| src/lib/mnewsRating/engine.ts | date-only string passed to Date constructor | 8256d34844 | 2026-07-16 | legacy |
| src/lib/mnewsRating/engine.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| src/lib/mnewsRating/engine.ts | date-only string passed to Date constructor | e0b539eef3 | 2026-07-11 | legacy |
| src/lib/mnewsRating/engine.ts | toISOString().slice(0,10) | 3ec0957ec3 | 2026-07-13 | legacy |
| src/lib/mnewsRating/monotonicity.ts | local getter .getDate() | 18d832b1ce | 2026-07-16 | legacy |
| src/lib/mnewsRating/monotonicity.ts | toISOString().slice(0,10) | 18d832b1ce | 2026-07-16 | legacy |
| src/lib/mnewsRating/rankAttribution.ts | date-only string passed to Date constructor | 30ad6bd2d9 | 2026-07-20 | legacy |
| src/lib/mnewsRating/rankAttribution.ts | local getter .getMonth() | 30ad6bd2d9 | 2026-07-20 | legacy |
| src/lib/mnewsRating/rankAttribution.ts | toISOString().slice(0,10) | 30ad6bd2d9 | 2026-07-20 | legacy |
| src/lib/orgRankings.ts | toISOString().slice(0,10) | 2ec33a27ec | 2026-07-07 | legacy |
| src/lib/orgRankings.ts | toISOString().slice(0,10) | 2ec33a27ec | 2026-07-07 | legacy |
| src/lib/xPost.ts | date-only string passed to Date constructor | 51180a66ef | 2026-07-03 | legacy |
| src/lib/xPost.ts | date-only string passed to Date constructor | 0960778797 | 2026-07-04 | legacy |
| src/lib/xPost.ts | local getter .getDate() | 0960778797 | 2026-07-04 | legacy |
| src/lib/xPost.ts | local getter .getDate() | 51180a66ef | 2026-07-03 | legacy |
| src/lib/xPost.ts | local getter .getMonth() | 0960778797 | 2026-07-04 | legacy |
| src/lib/xPost.ts | local getter .getMonth() | 51180a66ef | 2026-07-03 | legacy |

(`commit_date`はUTC基準の暦日。baseline.json生成ツール自身がゲート対象内にあるため、JST変換ヘルパーではなく`getUTCXxx`のみで組み立てている。日付が前後1日ずれる可能性があるが、由来判定の大小関係には影響しない)

</details>

## 4. S3: `new` 分類の修正

**`new`分類は0件だったため、修正対象なし。** §5の停止条件(`new`が10件超)には該当しない(訂正前の誤集計では57件だったが、これはPR-Aの誤同定によるもので、正しい境界では0件)。

## 5. `unknown` 分類

**0件。** 全99件についてgit blameで由来コミットを特定できた。

## 6. S4: baselineに由来情報を残す仕組み

**選んだ方式**: baseline再生成時(`--write-baseline`)に、各違反行を自動でgit blameし、`commit_sha`・`commit_date`をJSONに埋め込む(`scripts/check-jst-date-bypass.ts`の`writeBaseline`を拡張)。

**理由**: 「ドキュメントに手順を書くだけ」も検討したが、今回の食い違いの実質的な原因は「由来確認の手順を知らなかった」ことではなく「PR-Aをどのコミットと同定するかで人(セッション)によって結果が変わり得た」ことだった。由来コミットのSHA・日付が**baselineファイル自体に機械的に記録されていれば**、次に誰か(次回のセッション含む)がbaseline追加分の由来を尋ねられたとき、`git blame`をゼロから打ち直す必要がなく、記録された日付とその時点のPR-A基準コミット日時を比べるだけで済む。生成はgit blameの自動呼び出しのみで、照合ロジック(`violationKey`)自体は変更していない(由来情報はkeyに含まれないため、ratchetの挙動は不変)。

## 7. 最終状態

- `eventCountdown.ts`: 8関数(慣例上「7」)。変更なし(このタスクでは追加関数なし)
- baseline: **99件**、全件`legacy`origin付き
- ゲート検出パターン: 5つ(変更なし)
- `seoTemplates.ts`に日付分解ロジックは残っていない(`buildRankingsHubTitle`/`buildRankingsDivisionTitle`とも`formatDateJa`呼び出しのみ)

## 8. 範囲外で見つけたが手を出さなかった事項

- なし(本タスクのスコープ内で完結した)。

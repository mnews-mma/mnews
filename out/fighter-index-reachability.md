# 公開選手ページのインデックス到達性 実測(read-only)

実測日: 2026-08-03(JST)。数値はすべて実測値。推測が混じる箇所は明記する。

## 手順1: 未マージPR・worktreeの確認

`gh pr list --state open`(36件、以下に全件列挙・判断は含まない):

| # | 状態 | タイトル |
|---|---|---|
| #394 | OPEN | feat: 未リンク3名を選手DBに追加(指示書A) |
| #393 | DRAFT | investigate: DEEP bout総数2473→2403(-70)の内訳調査(read-only) |
| #390 | DRAFT | investigate: 宝珠山桃花のカード/内訳バー勝敗数食い違い調査(read-only) |
| #388 | DRAFT | investigate: RIZINスクレイパーの検査器同型盲点監査(指示書①、read-only) |
| #369 | DRAFT | investigate: K-1ルール・SBルール等 非MMA判定漏れの横断調査(read-only) |
| #359 | DRAFT | 投稿: 選手ページのヘッダー戦績とテーブル行数の食い違いを悉皆調査(read-only) |
| #356 | DRAFT | fix: RIZINのwinnerSlug再計算漏れ(fujita-yamato 2件、#292と同型) |
| #354 | OPEN | investigate: ja.wikipedia戦績表の行取りこぼし監査(悉皆・修正なし) |
| #349 | DRAFT | docs: fighterRecords.json A/B/C型悉皆調査(指示書R-5、read-only) |
| #336 | DRAFT | docs: 4団体通算乖離45名の原因分類・調査(指示書R-1b、read-only) |
| #304 | DRAFT | resultType:unknown 全件監査(指示書M・read-only) |
| #291 | OPEN | 4団体構造化データ 悉皆突合調査(read-only) |
| #290 | OPEN | 4団体構造化データのパース失敗横断調査(read-only) |
| #277 | OPEN | docs: nishitani-taisei(DEEP)人物特定誤りの調査(read-only) |
| #274 | OPEN | docs: #252投入92名以外のhidden選手51名を洗い出し(read-only) |
| #248 | OPEN | パンクラス公式アーカイブから戦績データ構築を実証(必達35名・読み取り専用) |
| #247 | OPEN | 修斗公式アーカイブから必達60名のレコード+対戦テーブル構築を実証(読み取り専用) |
| #234 | OPEN | 修斗公式アーカイブ 出場選手データ信頼開始年の確定調査(読み取り専用) |
| #233 | OPEN | パンクラス公式アーカイブ 出場選手データ信頼開始年の確定調査(読み取り専用) |
| #232 | OPEN | DEEP結果ページ フォーマット種別の判定(読み取り専用) |
| #231 | OPEN | DEEP結果アーカイブ 遡り深度調査(読み取り専用) |
| #223 | DRAFT | 指示書④ Phase2: 選手DB収録基準の成文化+判定器実装 |
| #221 | DRAFT | 指示書 W-1: Wikidataカバー率測定(層1・層2完走・none率80%超の停止条件に該当) |
| #220 | DRAFT | docs: 選手DB収録基準 Phase1 判断材料づくり(読み取り専用分析) |
| #219 | DRAFT | feat: VSページindex条件拡張・sitemap lastmod修正・次戦句(置換方式) |
| #217 | DRAFT | chore: followups-2026-07-26d 調査レポート保全+C-1+baseline脆弱性+worktree棚卸し |
| #215 | DRAFT | feat(seo): AI RIZINランキング階級ページに固有テキストを追加(PR-B) |
| #208 | OPEN | DEEP名簿②-b残件処理・champions.ts未収録王座3件追加(指示書②-c) |
| #203 | OPEN | DEEP名簿の未開催イベント混入検証(指示書②-b) |
| #201 | OPEN | イベント起点の名簿発見・DEEPで試作(指示書②) |
| #198 | OPEN | hiddenフラグの意味確定と王者スナップショットの鮮度監査(指示書①-b) |
| #197 | OPEN | 選手DB網羅率監査: パンクラス/修斗/DEEP公式との突合(指示書①) |
| #172 | OPEN | feat: RIZIN P4P試算レポート生成スクリプトを追加(試算のみ・表示無変更) |
| #93 | OPEN | docs/instructions: 非RIZIN経験選手の表示戦績ラベルを未決事項として記録 |

**該当PRあり、続行指示を得て着手**: [#219](https://github.com/mnews-mma/mnews/pull/219)(`feat/vs-index-and-next-fight`)が`src/app/sitemap.ts`・`src/app/fighters/[slug]/page.tsx`を変更中(VSページのindex条件・sitemap lastmodが主対象)。ユーザーから「2026-07-26に据え置き(マージしない)と決定済み」との確認を得て、mainベースで本調査を続行した。

---

## 手順2: 公開選手数の実測

`src/lib/fighters.ts`(361行目〜、`export const FIGHTERS`)を`npx tsx`で直接importして実測(`getVisibleFighters()`はsitemap.ts・`/fighters`ページと同一関数)。2回実行し完全一致。

| 指標 | 値 |
|---|---|
| `FIGHTERS`総数 | **361件** |
| うち`hidden: true` | **0件** |
| 非hidden(`FIGHTERS.filter(f => !f.hidden)`) | **361件** |
| `getVisibleFighters()`(=`/fighters`・sitemapのVSルート・Xカードツール共通の「公開母集団」、コード内コメントで明記) | **359件** |

非hiddenだが`getVisibleFighters()`からは除外される2件(理由: `noRecordData`、表示できる戦績が何もない):
- `chiharu`(千春、org: nexus)
- `okumura-airu`(奥村アイル、org: deep)

※2026-08-01時点の記憶(357件)との差は+4件。本調査時点でのFIGHTERS総数増加によるもので、乖離の原因調査はスコープ外(指示書の「未確認」項目)。

---

## 手順3: 本番sitemap.xmlの取得・内訳

`https://www.mnews.jp/sitemap.xml`を2回取得。**md5完全一致**(`f9cd392be44c26e52f42f26781761b0f`)。

| 項目 | 値 |
|---|---|
| 収録URL総数 | **5,017件** |

ページ種別内訳:

| 種別 | 件数 |
|---|---|
| `/vs/[a]/[b]` | 4,527 |
| `/fighters/[slug]` | 361 |
| `/results/[slug]` | 88 |
| `/events/[slug]` | 18 |
| `/rankings/[division]` | 6 |
| `/ranking/[org]` | 5 |
| `/articles/[slug]` | 3 |
| トップ・`/archive`・`/fighters`・`/events`・`/results`・`/deep-2026`・`/about`・`/privacy`・`/contact`(静的ルート) | 9 |

合計 4,527+361+88+18+6+5+3+9 = 5,017(一致)。

---

## 手順4: sitemapに載っていない公開選手

`src/app/sitemap.ts`の`fighterRoutes`は`FIGHTERS.filter(f => !f.hidden)`(**361件**)を使用。これは`getVisibleFighters()`(359件、`/fighters`一覧が使う「公開母集団」)より**広い**集合であるため、以下の3方向で突合した。

| 突合 | 結果 |
|---|---|
| A: `getVisibleFighters()`(359件、公開母集団)のうちsitemapに無いもの | **0件** |
| B: sitemapにあるが`getVisibleFighters()`には含まれないもの | **2件**: `chiharu`, `okumura-airu`(手順2の非表示2件と同一) |
| C: 非hidden(361件)のうちsitemapに無いもの | **0件** |

「公開選手」を`/fighters`一覧の母集団(`getVisibleFighters()`)と定義した場合、sitemap未収録は**0件**。

一方、B(`chiharu`・`okumura-airu`)は**sitemapには載っているが`/fighters`一覧の公開母集団には含まれない**逆方向のギャップとして実測された(手順6で内部リンク到達性・indexability状態を追って確認する)。

---

## 手順5: `/fighters`一覧からの内部リンク到達性

- ページネーションは無し(`src/components/FighterFilterGrid.tsx`にPAGE_SIZE/slice/IntersectionObserver等の分割描画コードは無く、デフォルトフィルタ(重量級/団体/検索クエリすべて未指定)で全件を1画面に表示する設計)。
- **本番`/fighters`ページの生HTML(JS実行前)を実測したところ、選手カードへの実`<a href="/fighters/xxx">`タグは0件だった。**
  - 選手カードグリッド(`FighterFilterGrid`)は`"use client"`コンポーネントで、`/fighters/page.tsx`側は`export const revalidate = 3600`(ISR)。`useSearchParams()`を使うため`<Suspense fallback={null}>`で包まれており(該当コードのコメントには「fallbackは実質表示されない(SSR結果に含まれるため)見た目上の変化はない」とあるが)、実測した生HTMLでは`fallback={null}`の状態(=空)が配信されていた。
  - 実HTML中に存在する`/fighters/xxx`形式の文字列は2種類のみ:
    1. `<script type="application/ld+json">`内の`ItemList`構造化データ(359件、`"url":"https://www.mnews.jp/fighters/xxx"`形式)。これはJSON-LDでありクロール可能な`<a>`ハイパーリンクではない。
    2. Next.jsのRSCストリーミングペイロード(`__next_f`スクリプトタグ内)にクライアントコンポーネントへ渡す`props`として359件の`slug`が文字列で埋め込まれている(JS実行・ハイドレーション後に初めて実DOMの`<a>`要素として描画される)。
  - つまり、**359件の選手カードリンクは全件、静的HTML(JS未実行)の時点では実リンクとして存在せず、クライアント側JS実行(ハイドレーション)に依存している。** JSON-LD構造化データとしては359件全URLが記載されている。
- 上記は「/fightersからの到達性」の実測結果であり、他ページ(results/[slug]の対戦相手名リンク等)経由の到達性は本調査の対象範囲外(手順5の指示は`/fighters`一覧からの到達性のみ)。ただし手順6の`chiharu`/`okumura-airu`ケースで、他の代表的な内部リンク経路(results一覧の対戦相手名リンク)も同じ`getVisibleFighters()`由来のフィルタを共有していることが判明したため参考記載する。

---

## 手順6: noindex・canonical・robotsによる除外

- `robots.txt`(本番): `Disallow: /admin/`のみ。`/fighters/`配下への制限は無い。
- `src/app/fighters/[slug]/page.tsx`の`generateMetadata()`を確認したところ、`robots: { index: false, follow: false }`が設定される条件は次の2つのみ:
  1. `slug`が存在しない(404相当)
  2. `seed.hidden === true`
  - 手順2の実測で`hidden: true`の選手は**0件**のため、361件中noindexは**0件**(条件分岐ロジック上・かつ現在の実データ上の両方で確認)。
- canonicalタグ: 実測した4ページ(`akazawa-yukinori`・`rena`・`horiguchi-kyoji`・`?wc=`クエリ付き`horiguchi-kyoji`)すべてで`<link rel="canonical" href="https://www.mnews.jp/fighters/{slug}"/>`(クエリなし・自己参照)を確認。`?wc=`クエリ付きアクセスでもcanonicalはクエリなしURLを指しており、重複コンテンツ化の兆候は見られなかった。
- **`chiharu`・`okumura-airu`(手順2/4のB集合)を個別に実測**: 両者ともHTTP 200、`robots`メタタグ無し(=デフォルトindex,follow)、`<link rel="canonical">`は自己参照で正常。**noindexではなく、indexable(かつsitemap収録済み)だが`/fighters`一覧からは非表示**という状態。
  - `src/app/results/[slug]/page.tsx`の対戦相手名リンクも`getVisibleFighterSlugs()`(=`getVisibleFighters()`由来)でリンク可否を判定している(該当コードのコメントで明記)。`奥村アイル`は`src/lib/eventResults.ts`に1試合分の対戦相手として記載があるが、上記フィルタにより結果ページ上ではリンク化されない(プレーンテキスト表示)。`千春`は`eventResults.ts`内に該当記載なし。
  - この2件について、`/fighters`一覧・results一覧いずれからも内部リンクで到達できる経路は本調査で見つからなかった(2経路の確認に限定。全ページ横断の網羅確認はスコープ外)。sitemap経由でのみ到達可能な状態。

---

## 手順7: 3〜6以外でインデックス到達を阻む要因(事実の列挙、原因断定なし)

- `/fighters/[slug]`は`export const dynamic = "force-dynamic"`(該当ファイル42行目)。sitemap自体はISRキャッシュされる一方、選手個別ページはリクエストごとに動的レンダリングされる(Wikipediaへのライブfetchを含む設計、と該当コードのコメントに記載)。indexability自体への影響は確認していないが、事実として記録する。
- 上記以外に明確な追加の阻害要因は本調査の範囲では見つからなかった。

---

## sitemap実装箇所・実行タイミング・コスト(必須報告項目)

- 実装箇所: [`src/app/sitemap.ts`](../src/app/sitemap.ts)。Next.js App Routerの規約ファイル(`MetadataRoute.Sitemap`をデフォルトエクスポート)。
- `export const revalidate = 3600;`(1行目付近)によりISR。**リクエスト時に初回生成され、以後1時間キャッシュされる**(build-timeの静的生成ではない)。本番で実測したところ3回連続リクエストすべて`x-vercel-cache: HIT`で、エッジキャッシュから配信されていることを確認した。
- 実行時コストへの影響: `sitemap()`関数内で`/vs/{a}/{b}`ルートの生成に`getVisibleFighters()`(359件)の**全ペア総当たり**(359×358/2 ≈ 64,261通り)に対し`isVsPairIndexable()`判定を1件ずつ実行するループがある(該当ファイル93-106行目)。これはキャッシュ有効時間内(1時間)は再実行されず、キャッシュ切れ後の次回リクエスト1件のみがこのO(n²)計算のコストを負担する構成。

---

## 受入条件チェック

- `data/` `src/` `scripts/` 変更ゼロ: 満たす(このPRでの変更は`out/`配下のみ)。
- PRはdraftのまま: [#395](https://github.com/mnews-mma/mnews/pull/395)としてdraft作成・マージしない。
- 数値はすべて実測値: 満たす(推測箇所は明記なし=本文中に推測混入なし)。
- sitemap生成の実装箇所・build/request-time・コスト影響: 上記セクションに記載。
- 2回実行して出力が一致: sitemap.xml(md5一致)・選手数カウントスクリプト(出力JSON完全一致)の両方で確認。

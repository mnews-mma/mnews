# /fighters一覧の内部リンクSSR化 可否調査(read-only)

調査日: 2026-08-03
前提: PR #395(investigate/fighter-index-reachability)の実測結果を出発点とする。
- FIGHTERS総数361件(hidden 0件)、公開母集団(`getVisibleFighters()`)359件
- 公開母集団はsitemap.xmlに100%収録済み
- 逆にsitemapにはあるが公開母集団には含まれない選手2件(chiharu・okumura-airu)を検出
- `/fighters`一覧の選手カードグリッドは生HTML(JS実行前)に実`<a href>`が0件

`data/` `src/` `scripts/` は変更していない(読み取りのみ)。以下は事実の列挙であり、実装や修正は行っていない。

---

## 1. `/fighters`一覧の現行描画方式

[src/app/fighters/page.tsx](../src/app/fighters/page.tsx)はServer Componentで、`export const revalidate = 3600`によりISR(1時間キャッシュのRegenerate-on-request)。`force-dynamic`ではない(2026-07-30に切り替え済み、コード内コメントに経緯あり)。

しかし選手カードの実描画(`<a href="/fighters/{slug}">`を含む`.fighter-grid`)は、page.tsxではなく[src/components/FighterFilterGrid.tsx](../src/components/FighterFilterGrid.tsx)という`"use client"`コンポーネントの中で行われている(280〜370行目)。このコンポーネントは`useSearchParams()`(4, 120行目)を使って検索語・階級・団体フィルタの初期状態をURLクエリから読み、`useMemo`でフィルタ済み配列をReact stateから都度JSXにmapしている。

page.tsx側は`<Suspense fallback={null}><FighterFilterGrid .../></Suspense>`(81〜83行目)でこれを包んでいる。page.tsx内のコメントには「fallbackは実質表示されない(SSR結果に含まれるため)見た目上の変化はない」とあるが、**PR #395の実測(生HTMLに`<a href>`0件)はこれと矛盾する**。

Next.jsの実際の挙動は次の通りと判断できる: ルートが`force-dynamic`でない(=静的生成/ISR対象)場合、`useSearchParams()`を使うクライアントコンポーネントは静的レンダリング時点でURLクエリを知り得ないため、Suspense境界の**フォールバック側**が静的HTMLに焼き込まれ、実コンテンツはハイドレーション後にクライアント側でのみレンダリングされる。今回のfallbackは`null`なので、静的HTML上は空になる。これが生HTMLにカードのリンクが0件になっている直接原因と考えられる(**推測**: Next.jsの一般的な既知動作からの推論であり、Next.js側の内部実装を読んで確認したものではない)。

### 傍証: `/results`との比較(同一CSSクラスを使う類似コンポーネント)
[src/components/ResultsFilterList.tsx](../src/components/ResultsFilterList.tsx)は同じ`.fighter-filter-bar`/`.fighter-card`系のCSSクラスを使う類似の一覧フィルタだが、`useSearchParams()`を使わず(URLへの同期機能がない)、`/results`ページ側にも`revalidate`/`force-dynamic`の指定がない(デフォルトのSSG)。本番で実測したところ、`/results`の生HTMLには実`<a href="/results/...">`が88件含まれていた(`curl`実測、2026-08-03)。

この差分は「`"use client"`コンポーネントだから生HTMLに出ない」のではなく、**`useSearchParams()`使用に伴うSuspenseフォールバック処理が原因**であることを補強する。

---

## 2. SSR化に必要な変更箇所(実装はしない)

選手カードの実リンクを生HTMLに出すには、「カードグリッドの描画」と「URLクエリに依存するフィルタ状態の読み取り」を分離し、前者をSuspense境界の外(=`useSearchParams()`に依存しない場所)に置く必要がある。想定する変更範囲は以下の4ファイル(5ファイル以内):

1. **`src/components/FighterFilterGrid.tsx`**: 現状の「フィルタ条件→React stateで絞り込んだ配列をmap」という設計から、「検索入力・階級/団体チップ(UIとフィルタ状態管理のみ)」に縮小する。フィルタ適用は、別途サーバー側で全件描画されたDOMノードに対し、data属性(階級・団体タグ・正規化済み検索用文字列など)を見てクライアントJSで表示/非表示を切り替える方式に変更する必要がある。
2. **新規: `src/components/FighterCardGrid.tsx`(仮称)**: 現行`FighterFilterGrid.tsx`の280〜370行目(`.fighter-grid`と`<a className="fighter-card">`のmap部分)を、`"use client"`を付けないプレーンな関数/Server Componentとして切り出す。`fighters`(全件・未フィルタ)と`tagsBySlug`を受け取り、フィルタ用のdata属性を付与しつつ全件を無条件にレンダリングする。
3. **`src/app/fighters/page.tsx`**: `<FighterCardGrid>`をSuspense境界の外で直接呼び出し(全件を必ず静的HTMLに含める)、`useSearchParams()`に依存する検索/フィルタUI部分(上記1の縮小版)だけを`<Suspense>`で包む構成に変更する。
4. **`src/app/globals.css`**: フィルタで除外されたカードを隠すための新規CSSクラス(例: `.fighter-card.is-filtered-out{display:none}`)を追加する。既存の`.fighter-grid`/`.fighter-card`ルール(713・794行目付近)に影響しない形の追加のみ。

上記に加え、フィルタのマッチング処理(現在`FighterFilterGrid.tsx`内の`matchesWeightFilter`/`matchesNameSearch`/`buildSearchIndex`等、42〜93行目)を「ReactのstateからJSXを再構築する」方式から「既存DOMノードのdata属性を見て`classList`を操作する」方式に書き換える必要があるが、これは(1)のファイル内で完結するため、ファイル数には計上していない。

---

## 3. 実行時コストの見積もり

- **生成タイミング**: 変わらない。`/fighters`は現状すでに`revalidate = 3600`のISRであり、`getVisibleFighters()`・`computeFighterTags()`・`fetchOrgRankings()`などの重い処理は**既に**1時間に1回程度のペースでのみ実行されている(リクエスト毎ではない)。SSR化はこの生成タイミングを変えるものではなく、「同じ生成処理の中で、これまでクライアント専用だった359件分のカードJSXを、静的HTML側にも書き出す」変更に限られる。
- **359件描画コストの規模感**: 359件の単純な`.map()`によるJSX生成であり、PR #395が指摘した`sitemap.ts`のVSルート生成(359選手の全ペア総当たり、約64,261通りのO(n²)判定)のような組み合わせ爆発は伴わない。線形(O(n))の処理であり、既存のISR生成コストに対して大きな増分にはならないと考えられる(**推測**: 実際のレンダリング時間を計測したものではなく、計算量のオーダーからの推論)。
- **`sitemap.ts`のO(n²)と同一リクエストに乗るか**: 乗らない。`sitemap.ts`([src/app/sitemap.ts](../src/app/sitemap.ts))は`/sitemap.xml`という別ルートの別関数であり、`revalidate = 3600`も独立して設定されている(20行目)。`/fighters`ページの生成リクエストとは別のNext.jsルートハンドラ呼び出しになるため、両者のコストが同一リクエスト内で合算されることはない。
- **`/fighters`以外への波及(最低1項目)**: `.fighter-grid`/`.fighter-card`のCSSクラスは`/fighters`専用ではなく、[src/app/page.tsx](../src/app/page.tsx)(トップページ)・[src/app/vs/[slugA]/[slugB]/page.tsx](../src/app/vs/[slugA]/[slugB]/page.tsx)・[src/app/fighters/[slug]/page.tsx](../src/app/fighters/[slug]/page.tsx)・[src/app/deep-2026/page.tsx](../src/app/deep-2026/page.tsx)でも共有されている(`globals.css`の`grep`で確認)。上記2-4で追加するCSSクラス自体は新規クラス名の追加のみで既存ルールを変更しないため影響は限定的だが、`globals.css`というファイル自体はこれら他ページとも共有ファイルであり、変更時はこれらのページの表示崩れがないことも確認範囲に含める必要がある。
  - なお、ランキングページ(`/rankings/[division]`等)はこの一覧コンポーネント(`FighterFilterGrid`)を使っておらず、直接の描画依存はない(`grep`で使用箇所は`src/app/fighters/page.tsx`のみと確認)。

---

## 4. 孤立2件(chiharu・okumura-airu)が公開母集団から外れる条件

[src/lib/fighters.ts](../src/lib/fighters.ts)で該当2エントリを確認:
```
{ slug: "chiharu", nameJa: "千春", ..., wins: 0, losses: 0, draws: 0, history: [], recordFromResults: true }
{ slug: "okumura-airu", nameJa: "奥村アイル", ..., wins: 0, losses: 0, draws: 0, history: [], recordFromResults: true }
```
どちらも`hidden`フラグは付いていない(sitemap.tsは`FIGHTERS.filter(f => !f.hidden)`のみで判定するため収録される)。

一方、`/fighters`一覧・Xカードツールが使う公開母集団は[src/lib/visibleFighters.ts](../src/lib/visibleFighters.ts)の`getVisibleFighters()`が判定しており、`hidden`だけでなく「表示できる戦績が何かある」ことを追加で要求する:
1. `resolveFighter()`([src/lib/feeds/resolveFighter.ts](../src/lib/feeds/resolveFighter.ts)97〜111行目)が、`recordFromResults: true`の選手についてWikipedia戦績が取得できなければ`noRecordData: true`を返す。
2. `getVisibleFighters()`はさらに、4団体(RIZIN/DEEP/パンクラス/修斗)合算戦績(`multiOrgRecord`)を試すが、これも0-0-0であれば付与しない。
3. 最終的に`noRecordData: true`かつ`multiOrgRecord`なしの選手は`.filter((f) => !f.noRecordData || !!f.multiOrgRecord)`で除外される(38行目)。

`data/deepRecords.json`・`data/rizinRecords.json`・`data/pancraseRecords.json`・`data/shootoRecords.json`を検索したところ、「千春」「奥村アイル(奥村アイル/アイルランド表記等)」に一致する対戦記録は見つからなかった(奥村琉奈・奥村歩生・奥村マルシオ等の別人はヒットするが本人の記録なし)。つまりこの2名は**Wikipedia戦績もなく、4団体の構造化戦績データにも1件も試合記録がない、名前のみのロスターエントリ**であり、これが`noRecordData: true`かつ`multiOrgRecord`不成立で除外される直接原因。

要するに、**sitemap.tsは`hidden`のみを条件にし、`/fighters`(`getVisibleFighters()`)は`hidden`に加えて「戦績データの実在」を条件にしている**という、2つの独立したフィルタ条件の定義差が孤立の構造的原因。どちらのフィルタも「バグ」ではなく意図された仕様(sitemap.tsのコメント57行目「hidden選手はサイトマップに載せない」、visibleFighters.tsのコメント8〜14行目「公開条件=非hiddenかつ表示できる戦績が何かある」)だが、両者が独立して評価されているため、「hidden ではないが試合記録が一切ない」選手はsitemapには載るが一覧には出ない、という組み合わせが発生する。

---

## 5. `robots.txt`の`Sitemap:`ディレクティブ

[src/app/robots.ts](../src/app/robots.ts)で`sitemap: "https://www.mnews.jp/sitemap.xml"`を明示しており、本番`https://www.mnews.jp/robots.txt`を実測(2026-08-03)したところ以下が確認できた:

```
User-Agent: *
Allow: /
Disallow: /admin/

Sitemap: https://www.mnews.jp/sitemap.xml
```

`Sitemap:`ディレクティブは記述されている。

---

## まとめ

| 項目 | 結果 |
|---|---|
| 現行描画方式 | Server Component(ISR revalidate=3600)+ 内部の`"use client"`カードグリッドが`useSearchParams()`Suspenseフォールバックにより生HTMLでは空になる |
| SSR化の変更範囲 | 4ファイル(`FighterFilterGrid.tsx`縮小・新規`FighterCardGrid.tsx`・`page.tsx`配線変更・`globals.css`追加ルール) |
| 実行時コスト | 生成タイミング(1時間ISR)は不変、追加コストは359件のO(n)描画のみ。`sitemap.ts`のO(n²)とは別ルート・別リクエストで無関係 |
| 波及箇所 | `globals.css`はトップ/`/vs`/選手個別ページ/`deep-2026`とも共有ファイル(新規クラス追加のみで既存ルール非変更) |
| 孤立2件の条件 | sitemap.tsは`!hidden`のみ判定、`/fighters`は`!hidden`+戦績データ実在(Wikipedia or 4団体合算)を判定。chiharu・okumura-airuはどの戦績ソースにも試合記録が無く後者で除外 |
| robots.txt | `Sitemap:`ディレクティブあり(実測確認済み) |

本調査はread-onlyであり、`data/` `src/` `scripts/`への変更は行っていない。

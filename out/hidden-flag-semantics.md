# hidden-flag-semantics: hiddenフラグの意味確定と王者スナップショットの鮮度監査

生成日時(JST): 2026-07-25

本レポートは監査専用の出力。`fighters.ts`・`champions.ts`等への変更は行っていない(diffゼロ)。推奨・優先度づけは含まない。

## 1. hidden の意味の結論(トラックA)

### A1. 全参照箇所の挙動表

| 面 | 挙動 | 根拠(file:line) |
|---|---|---|
| /fighters 一覧 | 非掲載(行として出ない)。getVisibleFighters() = !hidden && !noRecordData が母集団。 | src/lib/visibleFighters.ts:15-16, src/app/fighters/page.tsx:24-25 |
| 選手個別ページ | 直リンク/URL直打ちでは200で表示される(hiddenによる404化はしていない)が、meta robots が noindex,follow=false になる。他のどのページからもリンクされないため実質「知っている人だけが辿り着ける」。 | src/app/fighters/[slug]/page.tsx:80-81,111(getFighterはhiddenを見ない/robots分岐のみ) |
| サイト内検索・サジェスト(ヒーロー検索) | HeroFighterSearchは/fightersへの入口リンクのみで検索ロジックはFighterFilterGrid側(=getVisibleFighters母集団)を再利用。hidden選手は候補に出ない。 | src/components/HeroFighterSearch.tsx, src/app/fighters/page.tsx:24-25 |
| AIランキング(mnewsレーティング) | 掲載除外(集計対象からも除外)。hiddenSlugsをisExcludedByFactの一部として明示的に除外。コード中で「事実オーバーレイ(引退)とは別軸だが同じ扱い」と明記。 | scripts/update-mnews-rating.ts:262-268 |
| VS/対戦カード(/vs, /dream)・選手選択候補 | 選択候補には出ない(getVisibleFighters()経由で!hidden)。ただしOGP画像API自体(/api/og/fighter/[slug]等)はgetFighter(slug)のみでhidden非チェックのため、slugを直接指定すれば画像は生成される(発見経路ではないが技術的には到達可能)。 | src/app/vs/[slugA]/[slugB]/page.tsx:128, src/app/dream/page.tsx:47, src/app/api/og/fighter/[slug]/route.tsx:39 |
| 関連選手チップ | 候補から除外(CANDIDATES = FIGHTERS.filter(f=>!f.hidden...))。 | src/lib/relatedFighterChips.ts:49 |
| sitemap.xml / 構造化データ | sitemapはURL非出力。公式ランキングページ(/ranking/pancrase等)は、公式ランキングにhidden選手がヒットしても linkableSlugsFor() が!hiddenで再フィルタするため名前のみ表示・リンク/構造化データのurlなし。 | src/app/sitemap.ts:50, src/app/ranking/pancrase/page.tsx:13-16, src/lib/orgRankings.ts:210-232 |
| (参考)管理画面 /admin/drafts の選手セレクタ | hidden含む全FIGHTERSが対象(スタッフ専用画面のため一般ユーザー動線ではない)。 | src/app/admin/drafts/page.tsx:17-20 |

**結論**: 個別ページの直リンク到達(noindex)と管理画面(スタッフ専用)を除き、hidden選手は一覧・検索・ランキング表示・AIランキング・VS/対戦カード候補・関連チップ・sitemapのすべてで missing と同一の扱い(発見不能)。挙動は面によってバラバラではなく一貫している。→ 網羅率A(listed基準)が「現在ユーザーが実際に発見できる選手」を正しく表す。網羅率Bは「データ投入済みで解除コストが低い候補」を示す別の指標であり、現在の公開網羅率としては使わない。

### A2. hidden の由来(git blame/log による証拠)

現在hiddenが立っている51名すべてについて、`hidden: true`を含む行の最終変更コミットをgit blameで特定した。6つのコミットに集約され、いずれも「新規選手のバッチ投入」時に一律`hidden: true`を付与したものだった(個別に後からhiddenへ変更されたケースはゼロ)。

| commit | date | 件数 | commit message(1行) |
|---|---|---|---|
| `46cf1bf7ed` | 2026-07-05 | 41 | 第2チャンク: 修斗/パンクラス現ランカー・NEXUS現王者75名を投入 |
| `bd7061dc02` | 2026-07-16 | 4 | 選手slug追加7件(確度A4+目視確定3)を修正+301(Next.js実装上は308)リダイレクト |
| `1fb68a1cb0` | 2026-07-05 | 3 | DEEP保留分から13名を読み確定して追加投入(計40名)、保留は3名に |
| `a6879a587f` | 2026-07-07 | 1 | feat: 選手18名追加(ONE9名・DEEP3名・新規)+既存5名Wiki URL補完、ONE団体タグ追加、/fighters階級・団体並び順変更、Xカードにフリーワード検索追加 |
| `9901534b73` | 2026-07-06 | 1 | A2+B+C+D+①: en-wiki補完/no-data範囲/ランキングtop5追加/RIZIN・UFCタグ復活/導線 |
| `7a801ff65c` | 2026-07-08 | 1 | 選手DBのメガトン級をヘビー級に統一(サイト内カテゴリ) |

`src/lib/fighters.ts`のFighter型コメント(44-47行)には「新規投入選手(DEEP等)を『表に出さない』ためのフラグ。…Mレーティング(序列)や自動文脈が乗るまで、戦績テーブルだけの薄いページを一斉公開しない(SEO保護)ための制御。データ自体は格納・保持する」と明記されている。`scripts/update-mnews-rating.ts:262-264`のコメントも「事実オーバーレイ(引退)とは別軸」と明記しており、hiddenは isRetired とは独立した軸であることがコード上で確認できる。

**A2の結論**: hidden ＝「引退・非現役」ではない。「戦績データ未整備」だけでもない(戦績データが揃っている選手も一律hiddenで投入されている、下記A4参照)。実態は**「新規投入バッチの公開審査待ち」**であり、SEO保護を目的として意図的に遅延公開する設計。§7の分岐でいう「一括投入時のデフォルトが残っただけ」に近いが、単なる残骸ではなく意図的な設計(コード上に目的が明記されている)。

### A3/A4. hidden 全体の内訳

- hidden総数(実測): 51
- うち必達セット内: 45 / 必達セット外: 6
- needsReview=true: 38 / needsReview無し: 13
- 戦績データあり(fighterRecords.jsonにhistory>0件): 8 / 戦績データなし: 43

必達セット内hidden45名に占める内訳(2軸クロス集計、いずれも客観的フラグ/データの有無のみに基づく。解釈は加えない):

| | needsReview=true | needsReview無し | 計 |
|---|---|---|---|
| 戦績あり | 5 | 2 | 7 |
| 戦績なし | 28 | 10 | 38 |
| 計 | 33 | 12 | 45 |

全件は `out/hidden-fighters.csv` を参照(必達セット内外を`in_necessary_set`列で区別)。

## 2. champions.ts 王者の鮮度(トラックB)

| org | weight_class | スナップショット | 判定 | ライブ詳細 | 出典 |
|---|---|---|---|---|---|
| deep | ストロー級 | 知名昴海 | **current** | 公式ページ最新世代: 第6代チャンピオン 知名昴海 | https://www.deep2001.com/champ/ |
| deep | フライ級 | 村元友太郎 | **current** | 公式ページ最新世代: 第7代チャンピオン 村元友太郎 | https://www.deep2001.com/champ/ |
| deep | バンタム級 | 福田龍彌 | **current** | 公式ページ最新世代: 第11代チャンピオン 福田龍彌 | https://www.deep2001.com/champ/ |
| deep | フェザー級 | 青井人 | **current** | 公式ページ最新世代: 第12代チャンピオン 青井人 | https://www.deep2001.com/champ/ |
| deep | ライト級 | 野村駿太 | **current** | 公式ページ最新世代: 第13代チャンピオン 野村駿太 | https://www.deep2001.com/champ/ |
| deep | ウェルター級 | 嶋田伊吹 | **current** | 公式ページ最新世代: 第14代チャンピオン 嶋田伊吹 | https://www.deep2001.com/champ/ |
| deep | ヘビー級 | 大成 | **current** | 公式ページ最新世代: 第7代チャンピオン 大成 | https://www.deep2001.com/champ/ |
| deep | 女子アトム級 | 伊澤星花 | **current** | 公式ページ最新世代: 第9代チャンピオン 伊澤 星花 | https://www.deep2001.com/champ/ |
| deep | 女子ストロー級 | 万智 | **current** | 公式ページ最新世代: 第5代チャンピオン 万智 | https://www.deep2001.com/champ/ |
| deep | 女子フライ級 | 中井りん | **current** | 公式ページ最新世代: 初代チャンピオン 中井りん | https://www.deep2001.com/champ/ |
| deep | 女子バンタム級 | 百湖 | **current** | 公式ページ最新世代: 第3代チャンピオン 百湖 | https://www.deep2001.com/champ/ |
| deep | 女子フェザー級 | 東ようこ | **current** | 公式ページ最新世代: 初代チャンピオン 東ようこ | https://www.deep2001.com/champ/ |
| rizin | フライ級 | 神龍誠(第3代) | **current** | 第3代 フライ級王者 | https://jp.rizinff.com/fighters |
| rizin | バンタム級 | ダニー・サバテロ(第8代) | **current** | 第8代 バンタム級王者 | https://jp.rizinff.com/fighters |
| rizin | フェザー級 | ラジャブアリ・シェイドゥラエフ(第7代) | **current** | 第7代 フェザー級王者 | https://jp.rizinff.com/fighters |
| rizin | ライト級 | ルイス・グスタボ(第3代) | **current** | 第3代 ライト級王者 | https://jp.rizinff.com/fighters |
| pancrase | ミドル級 | コシム・サルドロフ | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | ウェルター級 | ゴイチ・ヤマウチ | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | ライト級 | ラファエル・バルボーザ | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | フェザー級 | 栁川唯人 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | バンタム級 | 田嶋椋 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | フライ級 | 時田隆成 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | ストロー級 | 宮澤雄大 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | 女子フライ級 | 杉山しずか | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | 女子ストロー級 | 本野美樹 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| pancrase | 女子アトム級 | SARAMI | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.pancrase.co.jp/rls/ranking.html |
| shooto | ストロー級 | 田上 こゆる | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | フライ級 | 亮我 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | バンタム級 | 永井 奏多 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | フェザー級 | SASUKE | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | ライト級 | エフェヴィガ 雄志 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | ウェルター級 | 住村 竜市朗 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | 女子アトム級 | 青野 ひかる | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | 女子スーパーアトム級 | 渡辺 彩華 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |
| shooto | 女子ストロー級 | 藤野 恵実 | **current** | ライブ取得した公式ランキングそのものから抽出(静的スナップショットではない) | https://www.shooto-mma.com/ranking/ |

合計35件: current=35 / changed=0 / vacated=0 / not_found=0 / unfetchable=0

陳腐化・要確認は0件(champions.ts記載の王者は全件ライブ確認で現王者と一致)。

### 伊澤星花の確定

①(PR #197)では単純な部分文字列一致(`html.includes("伊澤星花")`)がDEEP公式ページで不一致となり「not_found」として報告した。本監査で原因を特定: **公式ページ上の表記は「伊澤 星花」(姓名間に半角スペース)** で、スペースなし表記の①の照合ロジックが検出できなかっただけの誤検知だった。

DEEP公式ページ(https://www.deep2001.com/champ/)は各階級見出し(`<h3>`)の直後に歴代チャンピオンを最新世代から降順で列挙する構造で、`DEEP JEWELS 女子アトム級(48kg以下)` の先頭(=最新世代)は「第9代チャンピオン 伊澤 星花」だった(2026-07-25ライブ確認)。よって**伊澤星花はDEEP JEWELS女子アトム級の現王者として確定(current)**。champions.tsの記載は正しい。

参考: Web検索では伊澤星花が2025年9月頃にDEEP JEWELS**ストロー級**(アトム級とは別の階級)の王座を返上したという報道が見つかったが、これはアトム級の現況には影響しない別階級の話であり、上記のアトム級=currentという結論と矛盾しない。

### DEEP JEWELSの所在確認(B4)

DEEPと DEEP JEWELS(女子)は**別ページではなく同一URL(https://www.deep2001.com/champ/)内の別セクション**として掲載されている。ただし champions.ts の DEEP_RANKING_CLASSES(12王座)に含まれない、公式ページ上でのみ確認できた王座が複数あった(=①の必達セットには含まれていない、真の取りこぼし):

- 女子無差別級: 初代チャンピオン アマンダ・ルーカス
- 女子アトム級(48kg以下): 空位
- 女子ミクロ級(44kg以下): 第2代チャンピオン 大島沙緒里
- DEEP JEWELS 女子ミクロ級(44kg以下): 第3代チャンピオン 大島沙緒里

これらは今回の必達セットの対象外(指示書①はchampions.tsのDEEP_RANKING_CLASSESを正としてスコープを確定しているため)。champions.ts自体を今回のスコープで変更することはしない。

また `src/lib/champions.ts` の `DEEP_CHAMPIONS` 配列(7名)は現在どのページからも参照されていない(dead code)。`/ranking/deep` は `deepRankingData()`(`DEEP_RANKING_CLASSES` 由来)のみを使用している。

## 3. トラックCの分母内訳

`weight_class_raw` のユニーク一覧(org:weight_class):

- deep:ウェルター級
- deep:ストロー級
- deep:バンタム級
- deep:フェザー級
- deep:フライ級
- deep:ヘビー級
- deep:ライト級
- deep:女子アトム級
- deep:女子ストロー級
- deep:女子バンタム級
- deep:女子フェザー級
- deep:女子フライ級
- pancrase:ウェルター級
- pancrase:ストロー級
- pancrase:バンタム級
- pancrase:フェザー級
- pancrase:フライ級
- pancrase:ミドル級
- pancrase:ライト級
- pancrase:女子アトム級
- pancrase:女子ストロー級
- pancrase:女子フライ級
- shooto:ウェルター級
- shooto:ストロー級
- shooto:バンタム級
- shooto:フェザー級
- shooto:フライ級
- shooto:ミドル級
- shooto:ライト級
- shooto:女子アトム級
- shooto:女子ストロー級
- shooto:女子スーパーアトム級

修斗の見出しIDは全て「世界○○級」(採用)または「環太平洋○○級」(parseShootoが除外)のいずれかのみで、アマチュア・クラスB等の混入は確認されなかった(修斗公式サイトのh4 id属性を全件目視)。よって①の修斗98件にプロランキング以外の混入はなし。パンクラスもh4見出し10件すべてが公式プロ階級(ミドル〜ストロー+アトム級)で、同様に混入なし。除外後の参考値の算出は不要。

## 4. 取得できなかったページとその理由

なし(全ページの取得に成功)。

## 5. 提案diffについて(§6条件の判定)

指示書は「A2でhiddenの意図が明確に割れた場合に限り、明白に解除してよいバケットについてのみ提案diffを用意してよい」としている。今回のA2の結論は単一(hidden=新規投入バッチの公開審査待ち、SEO保護のための意図的ゲート)であり、`needsReview`の有無は「ローマ字表記の確認可否」という限定的な一軸の情報でしかない(Fighter型コメントに「表示・戦績には影響しない」と明記)。`needsReview`無しの13名が他のあらゆる観点(Mレーティング整備状況等、コード上に明記されたhidden解除の本来条件)でも公開可能かは、今回集めた証拠だけでは確定できない。

**結論: 提案diffは作成しない。** 意図が「明確に割れた」とは言えず、`needsReview`無し=即解除可、という飛躍を避けるため。解除の要否は`out/hidden-fighters.csv`の全件データ(bucket区分含む)を見て人間が判断する。

## 6. 自己検証

- hidden総数(51) = 必達セット内(45) + 必達セット外(6): 一致
- champions.ts王者総数(35) = current+changed+vacated+not_found+unfetchable(35): 一致


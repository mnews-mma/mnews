# hidden選手の全件洗い出し(#252投入92名を除く)

生成日時(JST): 2026-07-30。**read-only調査。データの変更・hidden解除は一切行っていない。**

## 1. 全体件数

- `src/lib/fighters.ts`内の`hidden: true`は現在**51件**(#252投入92名は2026-07-30のPR #271で解除済みのため、この51件が現存する全hidden選手)。
- 51件の内訳: DEEP 4名・修斗19名・パンクラス25名・nexus3名。

## 2. #252投入92名との関係

#252(`feat/roster-injection-94`、2026-07-29マージ)の92名と、この51名は**重複ゼロ**(slugを突合して確認済み)。#252は修斗・パンクラスのみが対象で、投入元となる生成スクリプト(`scripts/roster-injection-94/`)による多行形式のオブジェクトだったのに対し、この51名は別の日付・別の投入経路(すべて単行形式のオブジェクト)で追加されたもの。

## 3. 51名の詳細

4団体通算はPR #261(DEEP戦績投入)・#265/#268/#269(アマチュア/非プロ混入除外)適用後の`data/{rizin,shooto,pancrase,deep}Records.json`を`computeMultiOrgRecord`で集計した実測値。「(未特定)」は無し、全件で投入元コミットを特定できた。

| slug | 選手名 | 団体 | 階級 | 4団体通算 | 投入元コミット |
|---|---|---|---|---|---|
| uoi-fullswing | 魚井フルスイング | deep | バンタム級 | 10-10-0 (DEEP,修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入); 1fb68a1c(2026-07-05,DEEP保留13名確定投入) |
| yamamoto-arihito | 山本有人 | deep | バンタム級 | 8-6-0 (DEEP) | 46cf1bf7(2026-07-05,第2チャンク75名投入); 1fb68a1c(2026-07-05,DEEP保留13名確定投入) |
| ishizaka-kushi | 石坂空志 | deep | バンタム級 | 7-2-0 (DEEP) | 46cf1bf7(2026-07-05,第2チャンク75名投入); 1fb68a1c(2026-07-05,DEEP保留13名確定投入) |
| tanoue-koyuru | 田上こゆる | shooto | ストロー級 | 10-4-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| naito-shoki | 内藤頌貴 | shooto | ストロー級 | 10-6-1 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| toma-yoshinao | 当真佳直 | shooto | ストロー級 | 10-3-1 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| hatakeyama-ryuya | 畠山隆称 | shooto | ストロー級 | 9-1-1 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入); bd7061dc(2026-07-16,slug誤読み修正) |
| kurobe-kazusa | 黒部和沙 | shooto | ストロー級 | 8-2-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| yamagami-mikihito | 山上幹臣 | shooto | ストロー級 | 3-1-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入); bd7061dc(2026-07-16,slug誤読み修正) |
| suzuki-simon | シモンスズキ | shooto | フライ級 | 7-1-1 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| sekiguchi-yuto | 関口祐冬 | shooto | フライ級 | 14-5-2 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| nakano-goki | 中野剛貴 | shooto | バンタム級 | 5-3-0 (パンクラス,修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入); bd7061dc(2026-07-16,slug誤読み修正) |
| sugino-kosei | 杉野光星 | shooto | バンタム級 | 4-1-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| baterdene-simbaatar | シンバートルバットエルデネ | shooto | バンタム級 | 1-2-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| horie-taishi | 堀江耐志 | shooto | フェザー級 | 1-0-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| im-kwangwoo | イムクァンウ | shooto | ライト級 | 1-0-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| shivaev | シヴァエフ | shooto | ライト級 | 5-1-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| desouza-marcel | デソウザマルセル | shooto | ウェルター級 | 2-1-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| sumiyoshi-ryota | 墨吉涼太 | shooto | ウェルター級 | 3-1-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| cooper-makoa | マコアクーパー | shooto | ウェルター級 | 1-0-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| saijo-hidenari | 西條英成 | shooto | ウェルター級 | 6-2-0 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| soki | ソーキ | shooto | ウェルター級 | 3-4-0 (DEEP,修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| sardorov-koshim | コシム・サルドロフ | pancrase | ミドル級 | 2-0-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| hayashi-genpei | 林源平 | pancrase | ミドル級 | 14-13-0 (DEEP,パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| hirata-akira | 平田旭 | pancrase | ミドル級 | 2-3-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| sato-ryutaro | 佐藤龍汰朗 | pancrase | ミドル級 | 6-2-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| okamura-toshiki | 岡村寿紀 | pancrase | ミドル級 | 2-3-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| naito-yura | 内藤由良 | pancrase | ウェルター級 | 8-1-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| musha-kotaro | 武者孝大郎 | pancrase | ウェルター級 | 3-0-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| murayama-akihiro | 村山暁洋 | pancrase | ウェルター級 | 12-10-3 (DEEP,パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| suzuki-chikaya | 鈴木慈也 | pancrase | ライト級 | 2-0-0 (パンクラス) | bd7061dc(2026-07-16,slug誤読み修正) |
| arzykul-kalybek | カリベク・アルジクルウール | pancrase | フェザー級 | 4-1-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| kanru | 敢流 | pancrase | フェザー級 | 6-1-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| kinoshita-naosuke | 木下尚祐 | pancrase | フェザー級 | 8-4-0 (DEEP,パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| miyagi-naraho | 宮城成歩滝 | pancrase | バンタム級 | 8-2-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| **takashiro-mitsuhiro** | **高城光弘** | pancrase | バンタム級 | **9-5-0 (パンクラス)** | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| yamaguchi-satoshi | 山口怜臣 | pancrase | バンタム級 | 5-2-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| tokida-takashige | 時田隆成 | pancrase | フライ級 | 5-0-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| kishida-hiroto | 岸田宙大 | pancrase | フライ級 | 6-3-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| shindo-genta | 眞藤源太 | pancrase | フライ級 | 6-5-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| tanimura-taika | 谷村泰嘉 | pancrase | フライ級 | 5-3-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| miyazawa-yuta | 宮澤雄大 | pancrase | ストロー級 | 7-5-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| sasaki-shunma | 佐々木瞬真 | pancrase | ストロー級 | 4-2-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| funada-denchi | 船田電池 | pancrase | ストロー級 | 3-1-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| little | リトル | pancrase | ストロー級 | 7-10-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| ujihara-kaisei | 氏原魁星 | pancrase | ストロー級 | 5-4-1 (DEEP,パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| nakagiri-ryosuke | 中桐涼輔 | nexus | バンタム級 | 0-1-1 (修斗) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| chiharu | 千春 | nexus | フェザー級 | 0-0-0 | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| mori-subaru | 森昴星 | nexus | ウェルター級 | 1-0-0 (パンクラス) | 46cf1bf7(2026-07-05,第2チャンク75名投入) |
| kanbe-atsubo | 神部篤坊 | pancrase | バンタム級 | 3-0-0 (パンクラス) | 9901534b(2026-07-06,top5未照合ランカー追加) |
| nishitani-taisei | 大成 | deep | ヘビー級 | 2-2-0 (DEEP) | 9901534b(2026-07-06,top5未照合ランカー追加) |

## 4. 投入元コミット一覧と「なぜhiddenか」

いずれも著者は`Kaina Kishiyoshi`(ユーザー本人)による直接コミット。#252のような生成スクリプト+PRレビューのフローではなく、手動での選手DB整備作業の一環。

### 46cf1bf7(2026-07-05)「第2チャンク: 修斗/パンクラス現ランカー・NEXUS現王者75名を投入」— 46名(このうち2名はmurayama-akihiro・arzykul-kalybekのように後続コミットで行が触られ`git blame`上は別コミット表示になるが、`git log -S`で追った本来の投入元はここ)

> ソース健全性: 修斗/パンクラス/NEXUS 3つとも実HTML描画・取得可(JS地雷なし)。fighters.ts: 75名をhidden=true/recordFromResults=trueで投入(shooto36/pancrase35/nexus4)。読み不確定39名はneedsReview=true。67/75名は自社EVENT_RESULTSで戦績が既に付く。読み裏取り不能の2名(佐藤生虎/猿飛流)はRANKER_HELD_FIGHTERSに保留。**全員hidden(noindex/サイトマップ非掲載/内部リンク非生成)。同名別人ガード継続**

→ hidden理由: 投入時点でローマ字表記の裏取りが不完全(読み不確定39名相当)な選手を含む一括投入のため、**個別の公開審査を経るまで一律hidden**にする設計方針。#252と同じ「新規投入バッチの公開審査待ち」パターン([[project_hidden_flag_semantics_audit]]で確定した意味と一致)。

### 1fb68a1c(2026-07-05)「DEEP保留分から13名を読み確定して追加投入(計40名)、保留は3名に」— 3名(uoi-fullswing・yamamoto-arihito・ishizaka-kushiが該当。46cf1bf7のDEEP分の後続確定バッチ)

> 中信頼2名(赤沢幸典/石坂空志)はneedsReview=true。魚井/山本有人も表記揺れ・過去スラッグ履歴のためneedsReview=true

→ hidden理由: 読みの確度が「中信頼」「表記揺れあり」のため、他の46cf1bf7投入分と同じくneedsReview扱いで一律hidden継続。

### bd7061dc(2026-07-16)「選手slug追加7件(確度A4+目視確定3)を修正+301リダイレクト」— 4名(hatakeyama-ryuya・yamagami-mikihito・nakano-goki・suzuki-chikaya)

このコミットはslug自体の誤読み訂正(例: `suzuki-tomoya`→`suzuki-chikaya`)であり、hiddenフラグの新規付与ではない。該当選手はすでに46cf1bf7で投入済みだったものの読み(slug)を修正しただけで、hidden状態自体はそのまま引き継がれている。

### 9901534b(2026-07-06)「A2+B+C+D+①: en-wiki補完/no-data範囲/ランキングtop5追加/RIZIN・UFCタグ復活/導線」— 2名(kanbe-atsubo・nishitani-taisei)

> B: 各階級top-5の未照合ランカーをDB追加(清水博人/大塚智貴=公開・**天弥/神部篤坊=needsReview hidden**)。猿飛流はローマ字取得不可→スタブ無しで名前のみ

→ hidden理由: 同コミットで追加された4名の未照合ランカーのうち、清水博人・大塚智貴は読み確定で即公開、神部篤坊(と天弥)は読み未確認のため`needsReview=true`かつhiddenで留め置き。nishitani-taiseiは同コミットでDEEP由来no-data選手として`/fighters`・`/deep-2026`から非表示にする方針(①)の対象になったと見られる(戦績が薄い=DEEP出場歴が少ないno-data相当だったため)。

## 5. 高城光弘(takashiro-mitsuhiro)個別の結論

- 2026-07-05のコミット46cf1bf7「第2チャンク: 修斗/パンクラス現ランカー・NEXUS現王者75名を投入」でパンクラス35名の一枠として投入。
- 投入時点で「現ランカー」として認識されていたが、**読み(ローマ字表記)の確度が低い側に分類され`needsReview: true`**が付与された(投入コミットの記述「読み不確定39名はneedsReview=true」に該当する1名と見られる)。
- 4団体通算は9-5-0(パンクラスのみ、DEEP/修斗/RIZIN出場歴なし)。戦績データ自体は健全で、非公開の理由はローマ字表記の最終確認待ちという運用上の保留であり、データ不備や品質問題ではない。
- 2026-07-05から2026-07-30(本調査時点)まで約25日間、`needsReview`状態のまま公開判断が持ち越されている。

## 6. 補足

- 51名のうち、`git blame`の直接結果と`git log -S`で追った「本来の投入元コミット」が食い違うケースが3件あった(murayama-akihiro・arzykul-kalybek・nishitani-taisei)。いずれも後続の別作業(Wiki URL補完・slugバックフィル・weightClass表記統一)がその行に触れたことで`git blame`の帰属が新しい方のコミットに移っていたためで、本レポートでは`git log -S`で確認した本来の投入元を採用している。
- 今回の51名はすべて`needsReview: true`または投入経緯から「読みの確認待ち」に分類できるものだった。データ破損・矛盾によるhiddenは見つかっていない。

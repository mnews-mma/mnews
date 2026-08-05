# RIZIN.54カード画像「AI予想%」出所調査 + seed機構の実測(Step 1、read-only)

作成日: 2026-08-05。`data/rankings.json`・`data/fighterRecords.json`・`data/rizinRecords.json`は
一切書き換えていない(diffゼロを確認済み)。使った一時スクリプトはすべて削除済み。

## 前提の確認結果

- 記事URL `/articles/rizin-54-full-card-predictions` は未マージ・未デプロイのためcurlで404になるのは想定通り(このセッションのローカル/worktree作業がまだmainに乗っていないだけ)。
- seed機構は実在する。`src/lib/mnewsRating/engine.ts`の`computePreDebutRecords`+`computeInitialRatingOverrides`、本番パラメータは`INITIAL_RATING_BOOST_PARAMS_V6`(`src/lib/mnewsRating/constants.ts:140`): `{ perNetWinPoints: 10, maxBoost: 80, minPreDebutFights: 3, shrinkageK: 5 }`、基準値`INITIAL_RATING = 1500`。
- **seed機構がゼロ戦績選手に適用できるか(未確認だった点)→ 不可、と実測で確定**。`computePreDebutRecords`は「RIZINで最低1戦のMMA公式戦(`isRizinMmaEvent`)がある選手」のみをMapに登録する(そのRIZIN初戦の日付を基準に、それより前の全団体戦績を数える設計のため)。RIZIN MMA戦績が1つも無い選手はMap自体に現れず、seedはおろか`rawRating`そのものが算出されない(1500すら入らない、"値が無い"状態)。

## Step 1: カード画像の現行10個の%の出所

| 対戦 | カードの数字 | 両者ともレート算出可能か(実測) | 実際の出所 |
|---|---|---|---|
| 秋元強真 55%(vs クレベル) | 55 | ○(後述の再計算値あり) | **レート由来ではない**。私(AI)の質的判断 |
| パッチー・ミックス 60%(vs 佐藤) | 60 | ○(パッチーは非公開だが内部レート算出可能、後述) | 同上 |
| 伊藤裕樹 55%(vs ガジャマトフ) | 55 | ○ | 同上 |
| 上田幹雄 57%(vs エドポロ) | 57 | ○(エドポロも内部レート算出可能、後述) | 同上 |
| スダリオ剛 73%(vs 酒井) | 73 | ○ | 同上 |
| 摩嶋一整 57%(vs 武田) | 57 | ○ | 同上 |
| 後藤丈治 60%(vs テミロフ) | 60 | ○ | 同上 |
| 平本丈 55%(vs ジョリー) | 55 | ○(前回誤って「階級不一致で算出不能」と報告していた。詳細後述) | 同上 |
| 直樹 85%(vs 細川一颯) | 85 | **×(細川側が算出不能)** | 同上 |
| 水野新太 68%(vs リー) | 68 | **×(水野側が算出不能)** | 同上 |

**結論: 現行カードの10個の%は、1つの例外もなくレート計算の直接出力ではない。** 全部が私(記事執筆時のAI)による質的判断の数字。これは前回(このセッションの数ターン前)にお伝えした内容と変わらないが、今回「レート側で計算できる試合の数」の見積もりが前回の調査(4/10)から誤りだったことが判明したので、それも合わせて報告する。

## 前回調査(4/10)の訂正: 実際は8/10が算出可能

前回の調査には2つの見落としがあった。

1. **ランキング非公開の選手でも、本番と同じ関数を再実行すれば内部レートが求まる場合がある**。`filterPublishableStates`による掲載可否と、`computeRawRatings`による内部レート算出は別工程で、後者は掲載可否と無関係に全選手ぶん計算される。前回は「rankings.jsonのentriesに載っていない=算出不能」と誤って同一視していた。
2. **階級(division)は表示上の分類にすぎず、レートそのものは階級横断で1本**(`scripts/update-mnews-rating.ts`のコメント「Elo算出は従来どおり階級横断で1本のまま」)。そのため前回「平本丈(フライ級)vsジョリー(バンタム級)は階級不一致で算出不能」としたのは誤り。同じrawRatingスケールで直接比較できる。

### 実測に使った方法(再現性の検証込み)

本番生成スクリプト(`scripts/update-mnews-rating.ts`)と同じ関数を同じ順序・同じパラメータで直接呼び出した(独自の再実装ロジックは書いていない):

```
records = applyRizinRecordsToHistory(fighterRecords.json の history, rizinRecords.json)  // 公式データで上書き
bouts = buildBouts(records, buildOpponentResolver(records), buildKnownNamesLookup(records), lookupWeighInMiss, asOf, isOpeningFightOverride)
preDebutRecords = computePreDebutRecords(records)
rizinFightCounts = 選手ごとのRIZIN実戦試合数(summarizeBoutsForFighter)
initialRatingOverrides = computeInitialRatingOverrides(preDebutRecords, INITIAL_RATING_BOOST_PARAMS_V6, rizinFightCounts)
states = computeRawRatings(bouts, ELO_PARAMS_V5, initialRatingOverrides)
effectiveRating(選手) = computeSigmaDiscountedRating(states.get(選手).rawRating, states.get(選手).fights, SIGMA_DISCOUNT_COEFFICIENT_V7=70)
```

最初の再実行では`computeSigmaDiscountedRating`(小標本を割り引くσ補正、係数70、`rawRating - 70/√max(fights,2)`)を漏らしており、既知の4選手(後藤・摩嶋・スダリオ・テミロフ)の公開値と一致しなかった(最大約50ポイントのズレ)。これを追加したところ、**`rankings.json`に掲載中の全15選手ぶんの`effectiveRating`が公開`rawRating`と完全一致(差0.1未満)した**。これで手法の再現性を確認できたので、非公開の5選手にも同じ式を適用した。

### 20選手ぶんの実測結果

| 選手 | RIZIN実戦数 | seed適用 | effectiveRating | rankings.json公開状況 |
|---|---|---|---|---|
| koike-kleber | 14 | 1558.9→減衰 | 1592.6 | 公開(一致) |
| akimoto-kyoma | 8 | 1530.8→減衰 | 1559.7 | 公開(一致) |
| sato-shoko | 6 | 1543.6→減衰 | 1551.4 | 公開(一致) |
| **patchy-mix** | 2 | 1522.9→減衰 | **1494.6** | **非公開**(掲載基準3戦未満のため。レート自体は算出可能) |
| ito-yuki | 13 | 1536.1→減衰 | 1514.9 | 公開(一致) |
| gadzhamatov-alibeg | 3 | 1515.0→減衰 | 1512.1 | 公開(一致) |
| ueda-mikio | 7 | 適用なし(参戦前0戦) | 1522.9 | 公開(一致) |
| **edpolo-king** | 2 | 適用なし(参戦前1戦、閾値3戦未満) | **1470.1** | **非公開**(掲載基準3戦未満) |
| sudario-tsuyoshi | 13 | 適用なし | 1476.0 | 公開(一致) |
| sakai-ryo | 2 | 1505.7→減衰 | 1420.8 | 公開(一致) |
| majima-kazumasa | 10 | 1553.3→減衰 | 1527.7 | 公開(一致) |
| takeda-koji | 16 | 1553.3→減衰 | 1515.7 | 公開(一致) |
| goto-joji | 6 | 1538.2→減衰 | 1532.0 | 公開(一致) |
| temirov-azizbek | 1 | 1505.0→減衰 | 1497.4 | 公開(一致) |
| hiramoto-jo | 4 | 適用なし | 1463.8 | 公開(一致、フライ級) |
| jolly | 2 | 適用なし(参戦前2戦、閾値未満) | 1470.5 | 公開(一致、バンタム級) |
| naoki | 2 | 適用なし(参戦前1戦、閾値未満) | 1450.5 | 公開(一致) |
| **hosokawa-issou** | **0** | **適用不可** | **算出不能** | 非公開(RIZIN MMA戦績自体が無い) |
| **mizuno-shinta** | **0** | **適用不可** | **算出不能** | 非公開(RIZINデビュー前のため) |
| **lee-kaiwen** | 1 | 1513.3→減衰 | **1447.1** | **非公開**(掲載基準3戦未満) |

### 10試合の算出可否(訂正後)

| 試合 | 算出可否 |
|---|---|
| 第10 クレベル vs 秋元 | ○(公開値同士) |
| 第9 佐藤 vs パッチー | **○(パッチーは非公開だが内部レートは算出可能)** |
| 第8 伊藤 vs ガジャマトフ | ○ |
| 第7 上田 vs エドポロ | **○(エドポロは非公開だが内部レートは算出可能)** |
| 第6 スダリオ vs 酒井 | ○ |
| 第5 摩嶋 vs 武田 | ○ |
| 第4 後藤 vs テミロフ | ○ |
| 第3 平本 vs ジョリー | **○(前回「階級不一致で算出不能」としたのは誤り。訂正)** |
| 第2 直樹 vs 細川一颯 | ×(細川がRIZIN MMA戦績ゼロ、seedも不可) |
| 第1 水野 vs リー | ×(水野がRIZINデビュー前、seedも不可) |

**8/10試合が機械算出可能(前回報告の4/10から訂正)。算出不能なのは2試合のみで、いずれも「片方がRIZIN MMA戦績ゼロで、seed機構の適用条件(RIZIN初戦の存在)自体を満たさない」ケース。**

## 参考: 期待勝率(expectedScore)を実際に計算した場合の値(算出可能な8試合のみ、まだ記事には未反映)

`expectedScore(rSelf, rOpp) = 1/(1+10^((rOpp-rSelf)/400))`(`engine.ts:409-410`と同一式)に上表のeffectiveRatingを入れた場合の値を参考として示す。**まだ記事・画像には一切反映していない。**

| 試合 | A | B | 期待勝率A | 現行カードの予想 |
|---|---|---|---|---|
| 第10 | クレベル(1592.6) | 秋元(1559.7) | クレベル54.7% | 秋元55%(逆) |
| 第9 | 佐藤(1551.4) | パッチー(1494.6) | 佐藤57.6% | パッチー60%(逆) |
| 第8 | 伊藤(1514.9) | ガジャマトフ(1512.1) | 伊藤50.4% | 伊藤55%(同方向) |
| 第7 | 上田(1522.9) | エドポロ(1470.1) | 上田57.5% | 上田57%(ほぼ一致) |
| 第6 | スダリオ(1476.0) | 酒井(1420.8) | スダリオ57.9% | スダリオ73%(同方向・大幅乖離) |
| 第5 | 摩嶋(1527.7) | 武田(1515.7) | 摩嶋51.7% | 摩嶋57%(同方向) |
| 第4 | 後藤(1532.0) | テミロフ(1497.4) | 後藤55.0% | 後藤60%(同方向) |
| 第3 | 平本(1463.8) | ジョリー(1470.5) | 平本49.0% | 平本55%(逆) |

50%未満=僅かにジョリー有利という結果になった試合が1件(第3)。これは前回報告に無かった新事実。

## この時点で止めます

上記は「出所の特定」と「算出可否の実測」まで。次の指示(全10試合の期待勝率を単一式で機械算出して記事・カードに反映する/しない、算出不能な2試合の扱い、番付表記の書き分け、等)を確認してから着手します。

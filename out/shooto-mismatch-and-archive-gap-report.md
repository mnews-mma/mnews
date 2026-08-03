# 修斗mismatch2件+archive収録漏れ3件の原因特定・修正(指示書F)報告

生成日時: 2026-08-04(JST)。

## 1. 121件の内訳「1件ずれ」の確認

指示書Eの報告で「要裏取り4名分22件」と「profile投入型94件」を単純に
足すと94+22=116となり115(profile投入型全体)と1件ずれて見える。原因は
「22件」がprofile投入型に限定した数字ではなく、要裏取り4名分の**全分類の
合計**(新規①4件+新規②-b17件+新規②-a1件=22件)だったため。

| 分類 | 身元確認済み19名分 | 要裏取り4名分 | 合計 |
|---|---|---|---|
| profile投入型(新規①+新規②-b) | 94 | **21**(4+17) | 115 |
| archive収録漏れ型(新規②-a) | 3 | 1 | 4 |
| mismatch | 2 | 0 | 2 |
| **合計** | **99** | **22** | **121** |

**profile投入型の正しい内訳は94(確認済み・投入済み)+21(要裏取り・未投入)=115**で、
115と一致する。1件のずれは無かった(#425の報告文中の「22件」という表記が
分類を跨いだ合計値であることの説明不足であり、データの誤りではない)。

## 2. mismatch(勝敗反転)の原因特定・修正

### 原因層の特定

#423で発見した野村駿太×宇佐美正パトリック(2021-11-06、VTJ 2021、
shootoEventId=122)の勝者反転を調査した結果、原因は**スクレイパー
(`resolveOutcome()`、`src/lib/mnewsRating/shootoScraper.ts`)のスコア
テキスト判定**にあった。

実測(`https://www.shooto-mma.com/result/?id=122`の生HTML):
- 公式ページの`center-block`装飾(opacity:0.3=敗者を示す)は宇佐美(fighterA)
  に付いておらず、野村(fighterB)にのみ付いている → **宇佐美が勝者**。
- 同ページの`methodRaw`は「判定 0-3」。`resolveOutcome()`はこれを
  「fighterAの得票0 - fighterBの得票3」と解釈し、winner=Bとしていた
  (実際の得票の向きが逆)。
- ジャッジ個別採点(noteRaw)も同じ誤った側を支持しており、独立した
  判定材料にはならなかった(同じ抽出元由来とみられる)。
- 両者それぞれの修斗公式プロフィールページ(`/fighters/?id=1366`
  宇佐美、`/fighters/?id=1374`野村)は共に宇佐美の勝利(○/×)で一致。

**原因層はスクレイパーのスコアテキスト解釈であり、元ページの表記自体は
opacity装飾・両者のプロフィールページで一貫して正しい勝者を示していた。**

### 修斗全boutでの同型走査

`scripts/scan-shooto-winner-reversal.ts`で修斗公式サイトの全231大会
(shootoRecords.json記載の全大会)を再取得し、`splitIntoBoutBoxes`・
`parseBoutBox`・`resolveOutcome`(いずれも既存export、ロジック複製はしない)
で再判定した結果と、bout chunkのopacity装飾から独立に導いた勝者を
突き合わせた。

- decisiveかつopacity信号あり(引き分け等を除く判定材料がある bout): **1,895件**
- score判定とopacity判定が食い違う候補: **6件**(0.32%)

6件全てについて当事者2名それぞれの公式プロフィールページを個別に実測し、
以下の通り全件でopacity側が正しい勝者と一致することを確認した(スコア判定は
6件全てで逆だった)。

| shootoEventId | 大会 | 日付 | 対戦 | 正しい勝者 | fighterASlug/fighterBSlug |
|---|---|---|---|---|---|
| 8 | プロフェッショナル修斗公式戦 | 2016-03-21 | 北原史寛 vs 梶川卓 | 北原史寛 | 両方null(FIGHTERS未登録) |
| 70 | THE SHOOTO OKINAWA vol.1 | 2018-11-25 | エダ塾長こうすけ vs 玉城優介 | 玉城優介 | 両方null |
| 79 | BORDER-season11-「The1st」 | 2019-01-20 | ハンセン玲雄 vs ガッツTakato | ガッツTakato | 両方null |
| 116 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA 第2部 | 2021-07-04 | ムテカツ vs 神武羅☆ヒカル | 神武羅☆ヒカル | 両方null |
| 122 | VTJ 2021 | 2021-11-06 | 宇佐美正パトリック vs 野村駿太 | 宇佐美正パトリック | usami-sho-patrick / nomura-shunta |
| 191 | 香川・高松シンボルタワー展示場 | 2024-09-08 | シン・ケンザン vs 高橋佑太 | 高橋佑太 | 両方null |

**★重要な追加発見**: `resolveOutcome()`のコード内コメントは
shootoEventId=191/bout=4069を「オラクルCSVとの照合でscore判定が正しいと
確認済みの事例」として明示的に引用していたが、今回両者のプロフィールページを
実測した結果、**実際にはopacity側が正しく、この既存コメントの前提自体が
誤りだった**ことが判明した(コメント文言の修正は本PRのスコープ外、
データの訂正のみ行った)。

6件のうちFIGHTERSに登録済みで実際にページ表示へ影響するのは
**野村駿太/宇佐美正パトリックの1組のみ**(他5組はFIGHTERS未登録の選手同士の
対戦のため、fighterASlug/fighterBSlugが両方nullで表示上の影響は無い)。

### 修正

`scripts/fix-shooto-winner-reversal-verified-bouts.ts`で6件の`winnerName`
/`winnerSlug`を直接パッチした(`resolveOutcome()`自体は変更していない。
検証済みの6件以外の約1,889件への未検証の副作用を避けるため、一般ロジックの
変更ではなく個別データパッチという最小スコープを選んだ)。投入前に
`resultType===decisive`・現在の勝者が期待通り誤っている側であることを
アサートし、期待と異なれば例外で停止する安全策あり。

## 3. archive収録漏れ3件の原因特定

`https://www.shooto-mma.com/result/?id={175,157,77}`の生HTMLを実測した
結果、3件全てが**アマチュア/キッズ・ジュニア修斗のbout**であることが
判明した(matchmake-titleに明記)。

| 選手 | 日付 | 相手 | 大会 | matchmake-title |
|---|---|---|---|---|
| NOEL | 2023-08-20 | 伊東侑姫 | 広島大会「TORAO | colors」 | 「50㎏以下級 第1試合**アマチュア修斗**3分2R」 |
| NOEL | 2023-04-09 | 丸山帆波 | SHOOTO GIG TOKYO Vol.34 | 「**アマチュア修斗**女子スーパーアトム 第1試合 3分2R」 |
| 佐々木瞬真 | 2019-11-24 | 赤羽幾也 | SHOOTO 30th ANNIVERSARY TOUR FINAL | 「**キッズ・ジュニア修斗** 3分1R」 |

3件とも`data/shootoRecords.json`の`nonProBoutFilter.ts`(アマ・非MMA bout
除外ロジック)により**意図通り除外**されていた。パーサの取りこぼしでも
大会ページに掲載が無いのでもなく、**修正不要**(除外が正しい動作)。
プロフィール型としての投入も行わない(アマ/キッズの試合を選手のプロ戦績に
混入させることになり、既存の除外方針と矛盾するため)。

## 4. 検証

### 4-1. 波及確認(全365名、shooto単体)

`computeFighterShootoRecord()`で全365名の投入前後diffを取った結果、
変化したのは**野村駿太・宇佐美正パトリックの2名のみ**(他363名は無変化)。
他5件のパッチはFIGHTERS未登録選手同士のためどの選手にも波及しない。

| 選手 | before(shooto単体) | after(shooto単体) |
|---|---|---|
| 野村駿太 | 1-0-0 | 0-1-0 |
| 宇佐美正パトリック | 2-1-0 | 3-0-0 |

### 4-2. 1行目/2行目(実測)

| 選手 | 1行目 | 2行目(投入前) | 2行目(投入後) |
|---|---|---|---|
| 野村駿太 | 10-2-0(12) | 9-0-0(9) | 8-1-0(9) |
| 宇佐美正パトリック | 9-5-0(14) | 7-5-0(12) | 8-4-0(12) |

両者とも総試合数(9件・12件)は不変(勝敗の帰属が変わっただけ)。1行目総数
(12・14)は2行目(9・12)を上回ったまま、「2行目が1行目を上回る」状態には
なっていない。

### 4-3. その他の受入条件

- **`data/rankings.json`**: 無変更(git diffで差分ゼロを確認)。`update-mnews-rating.ts`は`shootoRecords`をimportしていない。
- **波及範囲**: 変更したのは`data/shootoRecords.json`(`winnerName`/`winnerSlug`のみ、6件)。`shootoScraper.ts`・`multiOrgRecordsData.ts`等の集計層・配線コードは無変更。実行時コスト増なし(静的データの値変更のみ)。
- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: 成功

## 出力ファイル

- [scripts/scan-shooto-winner-reversal.ts](../scripts/scan-shooto-winner-reversal.ts) — 全231大会の走査スクリプト
- [scripts/fix-shooto-winner-reversal-verified-bouts.ts](../scripts/fix-shooto-winner-reversal-verified-bouts.ts) — 6件の個別パッチスクリプト
- `data/shootoRecords.json` — 6件パッチ(winnerName/winnerSlugのみ)
- [out/shooto-winner-reversal-scan.json](shooto-winner-reversal-scan.json) — 走査結果全件
- [out/shooto-winner-reversal-fix-log.json](shooto-winner-reversal-fix-log.json) — パッチ内容の記録

## 次のステップ(本PRでは着手しない)

- `resolveOutcome()`のscore判定ロジック自体の見直し(6件全てでscore判定が
  opacityと逆だった事実は、score優先という現在の優先順位の妥当性に
  疑問を投げかける。ただし約1,889件の未検証bout全てへの副作用リスクが
  あるため、個別の再検証無しに一般ロジックを変更すべきではない)。
- コード内コメント(shootoEventId=191を「score判定が正しい事例」として
  引用している箇所)の訂正。
- 要裏取り4名分22件の身元確認。

# nishitani-taisei(DEEP)人物特定誤りの調査

read-only調査。修正は行っていない(次の指示を待つ)。

## 結論(先出し)

**`nishitani-taisei` スラッグが現在保持している戦績(4件・DEEPメガトン級)はすべて「関野大成(Taisei Sekino)」のものであり、「西谷大成(Taisei Nishitani)」のものではない。**
`wikiTitleJa: "西谷大成"` は誤り。関野大成・西谷大成のどちらも、現状 `fighters.ts` に正しい単独エントリが存在しない(1つのエントリが両者を混同している)。

DEEP公式サイト(deep2001.com/fighters/)のロースターページで直接確認した。同ページ内で:

- アンカーテキスト **「大成」(裸の表記)** → `https://www.sherdog.com/fighter/Taisei-Sekino-379256`
- アンカーテキスト **「西谷大成」(フルネーム表記)** → `https://www.sherdog.com/fighter/Taisei-Nishitani-374609`

の2つが別々のリンクとして存在する。DEEP公式サイト自身が「大成」と「西谷大成」を別人として扱っている。

---

## 1. 現行 `nishitani-taisei` が持つ戦績(全件)

`fighters.ts` 上のエントリ(1348行目):
```
{ slug: "nishitani-taisei", nameJa: "大成", nameEn: "Taisei", org: "deep", weightClass: "ヘビー級",
  wins: 0, losses: 0, draws: 0, ko: 0, sub: 0, decision: 0, history: [],
  recordFromResults: true, wikiTitleJa: "西谷大成", hidden: true }
```

`data/deepRecords.json` 内で `fighterSlug: "nishitani-taisei"` が付与されているbout(4件、すべてDEEPメガトン級):

| 大会 | 日付 | 対戦相手 | 階級表記 | 結果 | 方法 |
|---|---|---|---|---|---|
| DEEP 105 IMPACT | 2021-12-12 | 赤沢幸典 | DEEPメガトン級 5分2R | 敗(判定3-0) | 20-18×2, 20-17 |
| DEEP TOKYO IMPACT 2022 2nd ROUND | 2022-03-13 | 酒井リョウ | DEEPメガトン級 5分2R | 敗(判定3-0) | 19-19×2マスト酒井, 19-18 |
| DEEP 121 IMPACT | 2024-09-16 | 水野竜也 | DEEPメガトン級 5分3R | 勝(TKO) | 1R 3'13" |
| DEEP 126 IMPACT | 2025-08-17 | 酒井リョウ(王座決定戦) | DEEPメガトン級王座決定戦 5分3R | 勝(TKO) | 3R 2'38" |

4戦2勝2敗、すべてメガトン級(重量級)。

---

## 2. 「大成」(関野大成)と「西谷大成」それぞれの正しい戦績(公式ソース照合)

### 大成 = 関野大成(Taisei Sekino) — Sherdog: `Taisei-Sekino-379256`

DEEP公式ロースターのリンク先(https://www.sherdog.com/fighter/Taisei-Sekino-379256)で確認:
- 所属: Battle Box、階級: **Heavyweight(102.51kg)**
- 通算 11勝7敗(Road FCなど海外遠征含む)

Sherdog記載のDEEP関連バウトを抽出(新しい順):

| 結果 | 相手 | 大会 | 日付 | 方法 |
|---|---|---|---|---|
| win | Ryo Sakai(酒井リョウ) | Deep - 126 Impact: Featherweight GP 2025 Final | 2025-08-17 | KO(Punches and Soccer Kicks) 3R 2:38 |
| win | Tatsuya Mizuno(水野竜也) | Deep - 121 Impact | 2024-09-16 | TKO(Soccer Kicks and Punches) 1R 3:13 |
| loss | Ryo Sakai(酒井リョウ) | Deep - Tokyo Impact 2022 2nd Round | 2022-03-13 | Decision(Unanimous) 2R 5:00 |
| loss | Yukinori Akazawa(赤沢幸典) | Deep - 105 Impact | 2021-12-12 | Decision(Unanimous) 2R 5:00 |
| win | Garry Garry | Deep - Tokyo Impact 2021 | 2021-03-13 | TKO(Punch) 1R |

→ **現行`nishitani-taisei`の4戦すべて(相手名・大会・日付・勝敗・方法)が完全一致**。加えて2021-03-13の「Garry」戦(`data/deepRecords.json`では「関野大成」のフル表記で記録、fighterSlug未解決)もSekinoの記録と一致。この時点では階級表記が「DEEPライトヘビー級」で、後年メガトン級まで増量したとみられる。

### 西谷大成(Taisei Nishitani) — Sherdog: `Taisei-Nishitani-374609`

DEEP公式ロースターのリンク先(https://www.sherdog.com/fighter/Taisei-Nishitani-374609)で確認:
- 所属: Japan Top Team、階級: **Featherweight(66.22kg)**
- 通算 6勝9敗

Sherdog記載の全バウト(新しい順、DEEP・RIZIN分):

| 結果 | 相手 | 大会 | 日付 |
|---|---|---|---|
| loss | Kyohei Hagiwara(萩原京平) | Rizin FF - Otoko Matsuri | 2025-05-04 |
| loss | Kaito Yoshimura(海飛) | Deep - Summer Festival 2024 in Odaiba | 2024-08-31 |
| loss | Ryo Takagi(高木凌) | Rizin FF - Rizin 46 | 2024-04-29 |
| loss | Hiroaki Suzuki(鈴木博昭) | Rizin FF - Rizin 43 | 2023-06-24 |
| win | Yuki Takano(高野優樹) | Deep - 113 Impact | 2023-05-07 |
| win | Daisuke Tatsumi(TATSUMI) | Deep - Tokyo Impact 2022 5th Round | 2022-09-11 |
| loss | Yutaka Hoshino(星野豊) | Deep - Tokyo Impact 2022 4th Round | 2022-05-29 |
| win | Tatsuya Takahashi(鷹辰) | Deep - Tokyo Impact 2022 1st Round | 2022-03-12 |
| loss | Michio Ito(鬼山班猫) | Deep - 105 Impact | 2021-12-12 |
| win | Kota Yamaguchi(山口コウタ) | Deep - Tokyo Impact 2021 1st Round | 2021-10-17 |
| loss | Ayumu Yamamoto(山本歩夢) | Deep - 101 Impact | 2021-05-05(Sherdog記載は06-20) |
| win | Yuto Inoue | Deep - 100 Impact: 20th Anniversary | 2021-02-21 |
| loss | Ryuji Takashio(高塩竜司) | Deep - Tokyo Impact 2020 | 2020-12-19 |
| loss | Takehiro Higuchi(樋口武大) | Deep - 98 Impact | 2020-11-01 |
| win | Shogo Iwanaga(岩永翔吾) | Deep - 96 Impact | 2020-08-23 |

→ 相手名・大会・日付が `data/deepRecords.json`・`data/rizinRecords.json` 内の「西谷大成」表記(未解決)のbout全件と一致。「鬼山班猫」「鷹辰」はリングネーム/略記と思われ、Sherdogの実名(Michio Ito / Tatsuya Takahashi)とは字面が異なるが、大会・日付・勝敗・ラウンドが完全一致するため同一bout。`Deep - 100 Impact: 20th Anniversary`(2021-02-21、勝ち)はこちらの現行データに欠落している(別件・カバレッジの穴)。

**両者は明確に別人**(階級が66kg級と102kg級で全く異なり、同一大会同日に別カードで同時出場している回もある。下記4参照)。

---

## 3. 判定: 現行戦績はどちらの人物のものか

**関野大成(Taisei Sekino)のもの。**

根拠:
1. DEEP公式サイト自身が「大成」(裸表記)と「西谷大成」(フル表記)を別リンク(別Sherdogプロフィール)として区別している。
2. 現行`nishitani-taisei`の4戦(赤沢幸典・酒井リョウ×2・水野竜也、すべてメガトン級)は、Sekinoの公式戦績と相手名・大会・日付・方法まで完全一致する。
3. `wikiTitleJa: "西谷大成"` が指す先(Sherdog `Taisei-Nishitani-374609`)は階級Featherweight(66kg)であり、`weightClass: "ヘビー級"`という現行データ自体の記載と矛盾する。
4. **決定的な物証**: 2021-12-12のDEEP 105 IMPACTで、同一大会・同一日に「大成」(メガトン級、対赤沢幸典)と「西谷大成」(フェザー級、対鬼山班猫)という**2つの別カード**が存在する。同一人物が同日に2階級で試合することは不可能なため、この時点で両者が別人であることが確定する。

---

## 4. fighters.ts に関野大成・西谷大成の別エントリは存在するか

**どちらも存在しない。**

`fighters.ts` 全体を検索した結果、「関野大成」というnameJaを持つエントリは無い。「西谷大成」は `nishitani-taisei` エントリの `wikiTitleJa` フィールドとしてのみ、また `suzuki-hiroaki`(鈴木博昭)エントリの `history` 配列内に対戦相手名の文字列として1件登場するのみで、独立したFighterエントリとしては存在しない。

つまり現状:
- 関野大成(Sekino、実際にメガトン級4戦を持つ人物)→ 対応するFighterエントリが無い。`nishitani-taisei`が事実上彼の戦績を保持しているが、slug名・wikiTitleJaは別人(西谷)を指している。
- 西谷大成(Nishitani、フェザー級11戦+RIZIN3戦を持つ人物)→ 対応するFighterエントリが完全に無い。彼の戦績はすべて`fighterSlug: null`のまま`data/deepRecords.json`・`data/rizinRecords.json`に未解決で残っている。

---

## 5. 4団体boutデータでの全bout列挙(resolved・unresolved 両方)

「大成」「西谷大成」「関野大成」のいずれかの表記、または`fighterSlug: "nishitani-taisei"`が付いているboutを4団体データ全件から抽出(パンクラス・修斗には該当なし)。日付順、計19件。

| # | データ元 | 大会 | 日付 | 表記 | slug解決 | 階級 | 対戦相手 | 勝者 |
|---|---|---|---|---|---|---|---|---|
| 1 | deep | DEEP 96 IMPACT | 2020-08-23 | 西谷大成 | 未解決 | フェザー級 | 岩永翔吾 | 西谷大成 |
| 2 | deep | DEEP 98 IMPACT | 2020-11-01 | 西谷大成 | 未解決 | フェザー級 | 樋口武大 | 樋口武大 |
| 3 | deep | DEEP TOKYO IMPACT 2020 | 2020-12-19 | 西谷大成 | 未解決 | フェザー級 | 高塩竜司 | 高塩竜司 |
| 4 | deep | DEEP TOKYO IMPACT 2021 | 2021-03-13 | 関野大成 | 未解決 | ライトヘビー級 | Garry | 関野大成 |
| 5 | deep | DEEP 101 IMPACT | 2021-05-05 | 西谷大成 | 未解決 | フェザー級 | 山本歩夢 | 山本歩夢 |
| 6 | deep | DEEP TOKYO IMPACT 2021 1st ROUND | 2021-10-17 | 西谷大成 | 未解決 | フェザー級 | 山口コウタ | 西谷大成 |
| 7 | deep | DEEP 105 IMPACT | 2021-12-12 | **大成** | **nishitani-taisei** | **メガトン級** | 赤沢幸典 | 赤沢幸典 |
| 8 | deep | DEEP 105 IMPACT | 2021-12-12 | 西谷大成 | 未解決 | フェザー級 | 鬼山班猫 | 鬼山班猫 |
| 9 | deep | DEEP TOKYO IMPACT 2022 1st ROUND | 2022-03-12 | 西谷大成 | 未解決 | フェザー級 | 鷹辰 | 西谷大成 |
| 10 | deep | DEEP TOKYO IMPACT 2022 2nd ROUND | 2022-03-13 | **大成** | **nishitani-taisei** | **メガトン級** | 酒井リョウ | 酒井リョウ |
| 11 | deep | DEEP TOKYO IMPACT 2022 4th ROUND | 2022-05-29 | 西谷大成 | 未解決 | フェザー級 | 星野豊 | 星野豊 |
| 12 | deep | DEEP TOKYO IMPACT 2022 5th ROUND | 2022-09-11 | 西谷大成 | 未解決 | フェザー級 | TATSUMI | 西谷大成 |
| 13 | deep | DEEP 113 IMPACT | 2023-05-07 | 西谷大成 | 未解決 | (記載なし) | 高野優樹 | 西谷大成 |
| 14 | rizin | RIZIN.43 | 2023-06-24 | 西谷大成 | 未解決 | (記載なし) | 鈴木博昭 | 鈴木博昭 |
| 15 | rizin | Yogibo presents RIZIN.46 | 2024-04-29 | 西谷大成 | 未解決 | (記載なし) | 高木凌 | 高木凌 |
| 16 | deep | DEEPサマーフェスティバル2024 inお台場 | 2024-08-31 | 西谷大成 | 未解決 | フェザー級 | 海飛 | 海飛 |
| 17 | deep | DEEP 121 IMPACT | 2024-09-16 | **大成** | **nishitani-taisei** | **メガトン級** | 水野竜也 | 大成 |
| 18 | rizin | RIZIN男祭り | 2025-05-04 | 西谷大成 | 未解決 | (記載なし) | 萩原京平 | 萩原京平 |
| 19 | deep | DEEP 126 IMPACT | 2025-08-17 | **大成** | **nishitani-taisei** | **メガトン級** | 酒井リョウ(王座決定戦) | 大成 |

内訳: 関野大成(メガトン級/ライトヘビー級、太字4+#4=5件、うちresolved 4件) / 西谷大成(フェザー級+RIZIN、14件、すべて未解決)。

---

## 補足: #260の距離1未解決リストにあった「大地」「大空」「大翔」「大貴」について

いずれも**nishitani-taiseiとは無関係の別人**。4団体データを全件検索した結果:

| 表記 | 出現データ | 大会 | 階級 | 対戦相手 |
|---|---|---|---|---|
| 大空 | pancrase / deep(重複記載) | PANCRASE大阪大会 2021-07-18 他計3件 | フライ級 | 當房桂・KARL・久保健太 |
| 大貴 | pancrase | PANCRASE 318 -Beyond317- 2020-09-27 | ストロー級 | 谷村泰嘉(#275で解除したパンクラス選手) |
| 大翔 | shooto | THE SHOOTO OKINAWA vol.2 2019-11-03 | フライ級 | 平良達郎(現UFC所属Tatsuro Taira) |
| 大地 | shooto | TORAO35/37/38(2025〜2026) 計3件 | ライト級 | はやぶさ・福田侑飛・平尾大和 |

いずれも団体(パンクラス/修斗)・階級(フライ/ストロー/ライト級)・時期のいずれかがnishitani-taisei(DEEP・メガトン級)と一致せず、同一人物とは考えにくい。「大成」と最初の1文字「大」が共通するだけで、#260の距離1(edit distance 1)マッチャーが2文字目の違いだけを許容する設計のため、意味的な関連性なしに機械的にクラスタリングされた**誤検知**と判断する。実際、この4名はそれぞれ別大会・別階級で活動する互いに無関係な4名の別選手であり、nishitani-taiseiの人物特定には使えない。

---

## まとめ(次のアクションへの申し送り)

- 現行`nishitani-taisei`エントリの戦績データ(4戦)は関野大成のものであり、`wikiTitleJa: "西谷大成"`は誤り。
- 修正するとしたら選択肢は大きく2つ:
  (a) `nishitani-taisei`をそのまま関野大成用のエントリとして確定させ、slug/nameJa/wikiTitleJaを関野大成に合わせて修正し、西谷大成は別途新規エントリを起こす
  (b) `nishitani-taisei`(西谷大成向けのslug)は西谷大成用に作り直し、関野大成の4戦は新規slugへ移し替える
  どちらもslug変更や新規エントリ作成を伴うため、影響範囲(既存リンク・名前解決)の確認が必要。本調査はread-onlyのため、修正方針は次の指示を待つ。

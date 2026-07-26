# Wikidata 日本人選手カバー率測定(指示書 W-1)

生成日時(JST): 2026-07-26

種別: 読み取り専用の監査。`data/`・`src/` への差分はゼロ(`src/lib/fighters.ts`から`FIGHTERS`を読み取りimportするのみで、ファイル自体は無変更)。`fighters.ts`への追加は行っていない。

## 結論(先頭に記載)

W1-1〜W1-6まで完走した。ただし**§3の停止条件の1つ(match_confidence=noneが8割を超える)に該当した**(484/523 = 92.5%)。

この条件は「正規化が効いていない疑い」を示唆するものだが、noneと判定された名前を`out/wikidata-jp-fighters.csv`(層1・751件)に対して個別に手作業で再確認した結果(例: 坂野周平・井上セナ・中尾響・朝比奈龍希・川口海翔)、いずれも層1データセット中に該当する`label_ja`/`alt_ja`が存在せず、**正規化ロジックの不具合ではなく、実際にWikidataがこれらの選手を収録していないため**とみられる(詳細は下記④・⑧)。exact 38件・alias 1件の正当な一致も見つかっており(下記④のサンプル参照)、突合ロジック自体は機能している。

とはいえ、指示書は本条件を「該当したらその場で止まる」停止条件として明示的に列挙しており、判断を代行しないという指示書の方針に従い、**この結果は『Wikidata案が(missingの)カバー手段としてどこまで有効か』の最終判断材料としてではなく、停止条件に該当した実測結果として報告する**。推奨・優先度づけは書かない。

---

## ① W1-1で確定したプロパティID・職業Q番号

推測(P2593 / P4802)ではなく、WDQSに以下のクエリを実行して確定した(結果は `out/wdqs-cache/w1-1-property-ids.json`、`out/wdqs-cache/w1-1-occupation-q.json` にキャッシュ済み)。

```sparql
SELECT ?p ?pLabel WHERE {
  ?p wikibase:propertyType wikibase:ExternalId ;
     rdfs:label ?l . FILTER(LANG(?l) = "en")
  FILTER(CONTAINS(LCASE(?l), "sherdog") || CONTAINS(LCASE(?l), "tapology"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
```

| 用途 | 推測値(指示書記載・未確認) | WDQS確定値 |
|---|---|---|
| Sherdog選手識別子 | P2593 | **P2818** |
| Tapology選手識別子 | P4802 | **P9728** |

職業「総合格闘家」のQ番号: **Q11607585**(「総合格闘技レフェリー」Q52008305、「総合格闘技ジャッジ」Q52008306、「総合格闘技コーチ」Q57997670 とは別)。以降のクエリはすべてこの確定値(P2818 / P9728 / Q11607585)を使用している。

---

## ② 層1の件数(ID保有ベース・職業ベース両方)

| 指標 | 全体 | うち日本国籍(P27=Q17) | うち日本語ラベルあり |
|---|---|---|---|
| Sherdog ID(P2818)保有 | 4,764 | 704 | 687 |
| Tapology ID(P9728)保有 | 2,364 | 122 | 113 |
| 職業=総合格闘家(Q11607585) かつ 日本国籍 | ― | 585 | 567 |

「IDを持っている数」(SherdogID 704 or TapologyID 122)と「職業で数えた数」(585)は一致しない。両者の和集合(日本国籍 かつ (総合格闘家 or SherdogIDあり or TapologyIDあり))は **751件**(`out/wikidata-jp-fighters.csv`)で、単純合計(704+122+585=1,411)より大幅に少ない。編集状況のばらつき(SherdogIDはあるが職業タグが無い、等)を示している。

---

## ③ 入力に使ったブランチと凍結値との一致確認結果

入力元: PR #208(`mnews-mma/mnews`、ブランチ `feat/roster-loose-ends`)の `out/` 配下。`git show origin/feat/roster-loose-ends:out/<file>` で取得し `out/pr208-input/` にコピー、CSVの行を直接カウントして一次情報とした(md要約は参考程度に留めた)。

**2026-07-26追記(ユーザー訂正)**: 指示書原文の凍結値「パンクラス・修斗missing 100名」は、PR #208(②-c)より前の値(必達セット186件・網羅率A 22.0%時点)であり、指示書執筆時に②-c後の値(189件/22.8%)と混在して古い数字が書かれていたと判明。②-c後の正しい凍結値は **101名**(差分1件はDEEP女子無差別級王者アマンダ・ルーカスの追加分)。ユーザー確認の上、以降は101を凍結値として扱う。

| | DEEP(イベント名簿) | パンクラス・修斗(+DEEP王座枠) |
|---|---|---|
| 実カウント合計 | 490 | 189 |
| listed | 64 | 43 |
| hidden | 4 | 45 |
| **missing** | **422** | **101** |

両方とも実ファイルのカウント結果が(訂正後の)凍結値と一致した。`scripts/audit-wikidata-coverage.ts`内でこの検算をコード上でも実行しており(`rosterCheck`/`deepCheck`)、不一致ならスクリプト自体が`process.exit(1)`する構造にしてある。

層2の対象母数は **DEEP 422名 + パンクラス・修斗101名 = 523名**。

---

## ④ 層2のカバー率

突合は`findFighterSlugByName`と同じ正規化ロジック(空白除去・かな⇔カナ変換・装飾ニックネーム除去。ただし同関数は`src/lib/fighters.ts`のprivate関数のためexportされておらず、`src/`を無変更にする制約上importできないので、同一ロジックを`scripts/audit-wikidata-coverage.ts`内に逐語コピーして使用。新規の・独自の正規化基準は追加していない)を通した完全一致でのみ判定した。部分一致・あいまい一致は一切使っていない。正規化後の同一文字列が複数の異なるWikidata QIDにまたがる場合(衝突)は自動確定させずnone扱いにしている。

| 母集団 | 総数 | exact | alias | none | hit(exact+alias) | カバー率 |
|---|---|---|---|---|---|---|
| 全体(523名) | 523 | 38 | 1 | 484 | 39 | 7.5% |
| DEEP(422名) | 422 | 24 | 0 | 398 | 24 | 5.7% |
| パンクラス・修斗(101名) | 101 | 14 | 1 | 86 | 15 | 14.9% |

停止条件チェック: DEEP カバー率5%未満で不成立、という条件に対しては **5.7% ≥ 5%のため不成立条件には該当しない**(僅差)。一方 **match_confidence=none比率(92.5%)は8割超の停止条件に該当する**(下記結論参照)。

**exact一致サンプル(先頭10件、全件は`out/wikidata-missing-match.csv`)**:

| org | name_mnews | label_ja | qid | sherdog_id |
|---|---|---|---|---|
| deep | 太田将吾 | 太田将吾 | Q131353598 | 410090 |
| deep | 横内三旺 | 横内三旺 | Q132432372 | 434731 |
| deep | 中井りん | 中井りん | Q3242787 | 18887 |
| deep | 古林礼名 | 古林礼名 | Q118726934 |  |
| deep | 大井すず | 大井すず | Q136338017 | 472119 |
| deep | 高橋遼伍 | 高橋遼伍 | Q126005793 | 84427 |
| deep | 長谷川賢 | 長谷川賢 | Q55536786 | 76908 |
| deep | 松場貴志 | 松場貴志 | Q121355278 | 129427 |
| deep | 関鉄矢 | 関鉄矢 | Q105704467 | 153571 |
| deep | 黒井海成 | 黒井海成 | Q112239204 |  |

**alias一致(全1件)**:

| org | name_mnews | label_ja(Wikidata正式) | qid | sherdog_id |
|---|---|---|---|---|
| pancrase | ライカ | 風神ライカ | Q5371137 | 176295 |

---

## ⑤ ブランド別・出場回数別のカバー率(DEEPのみ)

パンクラス・修斗側(公式ランキングのスナップショット)はブランド・出場回数のデータを持たないため対象外。

### ブランド別(本戦=DEEP IMPACT系列+DEEP JEWELS / 育成=DEEP FIGHT CHALLENGE+その他若手大会[フューチャーキングトーナメント等])

1人が複数ブランドに出場している場合、本戦経験が一度でもあれば「本戦」に分類した(育成→本戦昇格を本戦側に含める)。

| ブランド区分 | 総数 | hit | カバー率 |
|---|---|---|---|
| 本戦 | 400 | 24 | 6.0% |
| 育成 | 22 | 0 | 0.0% |
| 不明 | 0 | 0 | 0.0% |

### 出場回数別

| 出場回数 | 総数 | hit | カバー率 |
|---|---|---|---|
| 3回以上 | 69 | 3 | 4.3% |
| 2回 | 96 | 4 | 4.2% |
| 1回のみ | 257 | 17 | 6.6% |

**観察(数字のみ・推奨は書かない)**: ブランド別では本戦(6.0%)が育成(0.0%)よりカバー率が高い。出場回数別では1回のみ(6.6%)が3回以上(4.3%)・2回(4.2%)よりやや高いという、単純な「出場回数が多いほどWikidataに載っている」という予想とは逆の並びになっている。母数が523名中hit39名と絶対数が小さいため、この逆転が意味のある傾向か誤差の範囲か(例えば1回のみの層に、他競技で有名な選手や引退後にWikipedia/Wikidataが作られた例が偶然含まれている等)は、この件数では判別できない。

---

## ⑥ match_confidence=noneの全件(484件)

全件は `out/wikidata-missing-match.csv` にも保存済み。以下に全件を列挙する(黙殺しない)。

| org | 階級 | 出場回数 | name_mnews |
|---|---|---|---|
| deep | DEEPバンタム級 5分2R | 1 | 坂野周平 |
| deep | DEEPバンタム級 5分2R | 3 | 井上セナ |
| deep | DEEPフェザー級 5分2R | 3 | マイティ・saw |
| deep | DEEPフェザー級 5分2R | 3 | 中尾響 |
| deep | DEEPバンタム級 5分2R | 3 | 朝比奈龍希 |
| deep | DEEPバンタム級 5分2R | 2 | 川口海翔 |
| deep | DEEPフライ級 5分2R | 2 | 今野蓮弥 |
| deep | DEEPフライ級 5分2R | 2 | 今井風快 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 琥 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 渡部恵多 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 3 | 大越充悟 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 佐々木琢磨 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 森谷風真 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 齋藤未来 |
| deep | DEEPライト5分3R | 3 | 山田聖真 |
| deep | DEEPバンタム級 5分3R | 2 | 河村泰博 |
| deep | DEEPフェザー級 5分2R | 3 | 高橋正親 |
| deep | DEEＰフライ級 5分2R | 3 | マサト・ナカムラ |
| deep | DEEＰフライ級 5分2R | 1 | 斎藤璃貴 |
| deep | DEEPフライ級 5分2R | 4 | 松井優磨 |
| deep | DEEPフライ級 5分2R | 4 | 石原射 |
| deep | DEEPバンタム級 5分2R | 3 | 矢野武蔵 |
| deep | DEEPフライ級 5分2R | 2 | 武利侑都 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 3 | 秋元優志 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 3 | 荒井夕翔 |
| deep | DEEP JEWELSフライ級 5分3R | 3 | 栗山葵 |
| deep | DEEP JEWELSフライ級 5分3R | 1 | サラ・マフムード |
| deep | DEEPライト級 5分2R | 1 | Street♡★Bob洸助 |
| deep | DEEPライト級 5分2R | 3 | 河坂修斗 |
| deep | DEEPフェザー級 5分2R | 3 | 小川道的 |
| deep | DEEPフェザー級 5分2R | 4 | 澤田龍美 |
| deep | DEEPバンタム級 5分2R | 1 | フェルナンド |
| deep | DEEPバンタム級 5分2R | 2 | カーレッジユウキ |
| deep | DEEP JEWELSストロー級 5分2R | 2 | 橋本葵 |
| deep | DEEP JEWELSストロー級 5分2R | 3 | 渡辺真央 |
| deep | DEEPフェザー級 3分2RアマチュアSルール | 1 | 加藤憂也 |
| deep | DEEPフェザー級 3分2RアマチュアSルール | 1 | 大島伊玖都 |
| deep | DEEP WEST JAPAN BANTAMWEIHT GP 2026一回戦 5分3R | 1 | 切嶋龍輝 |
| deep | DEEP WEST JAPAN BANTAMWEIHT GP 2026一回戦 5分3R | 3 | 大空斗 |
| deep | DEEP WEST JAPAN BANTAMWEIHT GP 2026一回戦 5分3R | 3 | 谷岡祐樹 |
| deep | DEEP WEST JAPAN BANTAMWEIHT GP 2026一回戦 5分3R | 2 | MG眞介 |
| deep | DEEP WEST JAPAN BANTAMWEIHT GP 2026一回戦 5分3R | 1 | みやび |
| deep | DEEPウェルター級 5分2R | 2 | 虎鉄 |
| deep | DEEPウェルター級 5分2R | 2 | 窪田大羅 |
| deep | DEEP JEWELSフライ級 5分2R | 2 | 鈴木“QP”まい |
| deep | DEEP JEWELSフライ級 5分2R | 1 | ルリー・サンシャイン |
| deep | DEEPフェザー級 5分2R | 2 | 古根川充 |
| deep | DEEPフェザー級 5分2R | 1 | 権藤大剛 |
| deep | DEEPメガトン級 5分2R | 2 | ステファン“スマッシュ” |
| deep | DEEPメガトン級 5分2R | 3 | 酒井天佑 |
| deep | DEEPフェザー級 5分2R | 1 | TATSUMI |
| deep | DEEPフェザー級 5分2R | 4 | 加藤綾真 |
| deep | DEEPウェルター級 5分2R | 4 | 浅野功暉 |
| deep | DEEPウェルター級 5分2R | 1 | カーン・ソガズ |
| deep | DEEPバンタム級 5分2R | 2 | 時任流架 |
| deep | DEEPバンタム級 5分2R | 2 | 鈴木幹也 |
| deep | DEEPバンタム級 5分2R | 4 | 中川内羽矢斗 |
| deep | DEEPバンタム級 5分2R | 2 | 熊澤バイオレンス |
| deep | DEEPフェザー級 5分2R | 2 | 宜野座ケビン |
| deep | DEEPフェザー級 5分2R | 1 | 大澤空 |
| deep | MAXFCJAPAN公式戦 -48kg契約 3分3R（EX1R） | 1 | ユリカ・グラップリングシュートボクサーズジム |
| deep | MAXFCJAPAN公式戦 -48kg契約 3分3R（EX1R） | 1 | パク・ソヨン |
| deep | DEEPバンタム級 5分2R | 1 | SHOYA |
| deep | DEEPバンタム級 5分2R | 3 | 吉田翼 |
| deep | MAXFCJAPAN公式戦 -54kg契約 3分3R（EX1R） | 1 | 朱里グラップリングシュートボクサーズジム |
| deep | MAXFCJAPAN公式戦 -54kg契約 3分3R（EX1R） | 1 | チェ・ウンジ |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 青井佑磨 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 2 | 三島康貴 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 黒川晃司 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 早田大牙 |
| deep | DEEPフライ級 5分2R | 1 | 三ツ塚勇介 |
| deep | DEEPフライ級 5分2R | 3 | 永井宏人 |
| deep | DEEPフライ級 5分2R | 4 | 古市陸 |
| deep | DEEPフライ級 5分2R | 1 | 橋上壮馬 |
| deep | DEEPバンタム級 5分2R | 2 | 椿馨 |
| deep | DEEPバンタム級 5分2R | 1 | 青代享 |
| deep | DEEPフライ級 5分2 | 3 | 山田悠太 |
| deep | DEEPフライ級 5分2 | 1 | 川畑凜斗 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 内田菱牙 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 吉口聖也 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 真下健嗣 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 土屋太郎 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 細川晄希 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 倉冨立聖 |
| deep | DEEPバンタム級 5分2R | 2 | 内山拓真 |
| deep | DEEPメガトン級 5分2R | 2 | 奥野充貴 |
| deep | DEEPメガトン級 5分2R | 2 | 木之下喧壱 |
| deep | DEEPフライ級 5分2R | 1 | 青田剛 |
| deep | DEEPフライ級 5分2R | 1 | 大野勇斗 |
| deep | DEEPバンタム級 5分2R | 2 | AKIYOSHI |
| deep | DEEPバンタム級 5分2R | 1 | 西原大貴 |
| deep | DEEPバンタム級 5分2R | 3 | 伊藤一輝 |
| deep | DEEPバンタム級 5分2R | 1 | ルーク中村 |
| deep | DEEPウェルター級 5分2R | 3 | 小林ゆたか |
| deep | DEEPウェルター級 5分2R | 3 | 真野アミル |
| deep | DEEPフライ級 5分2R | 1 | 平井総一郎 |
| deep | DEEPフライ級 5分2R | 3 | マサムネ |
| deep | DEEPバンタム級 5分2R | 1 | 一輝 |
| deep | DEEPバンタム級 5分2R | 2 | 佐藤修斗 |
| deep | DEEPストロー級 3分2R アマチュアSルール | 3 | 加藤翔奏 |
| deep | DEEPストロー級 3分2R アマチュアSルール | 1 | ショーン・ホマレー |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 高田真音 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 石津隼人 |
| deep | DEEPストロー級 3分2R アマチュアSルール | 2 | 菊池創太 |
| deep | DEEPストロー級 3分2R アマチュアSルール | 2 | フェリペ・ハセヤマ |
| deep | DEEP JEWELS 49kg以下 5分2R | 3 | 上瀬あかり |
| deep | DEEP JEWELS 49kg以下 5分2R | 3 | 渡邊花美 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 和久田月聖 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 黒太翔人 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | トーマ |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | RYUA |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | ランボルギーニ |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 高橋典斗 |
| deep | DEEP 60kg以下 3分3R KICKルール | 1 | 金子徹哉 |
| deep | DEEP 60kg以下 3分3R KICKルール | 1 | 平田大地 |
| deep | DEEP 62.5kg以下 3分3R KICKルール | 1 | 久留拓磨 |
| deep | DEEP 62.5kg以下 3分3R KICKルール | 1 | 仁 |
| deep | DEEP 62kg以下2分3R アマチュアKICKルール | 1 | 熊谷輝彦 |
| deep | DEEP 62kg以下2分3R アマチュアKICKルール | 1 | 金城壮志 |
| deep | DEEP 60kg以下 2分3R アマチュアKICKルール | 1 | 津島忠彦 |
| deep | DEEP 60kg以下 2分3R アマチュアKICKルール | 1 | 中村大和 |
| deep | DEEP JEWELS ストロー級 2分2R アマチュアKICKルール | 1 | 比企那菜実 |
| deep | DEEP JEWELS ストロー級 2分2R アマチュアKICKルール | 1 | AKINA |
| deep | DEEP JEWELSフライ級タイトルマッチ 5分3R | 1 | 奥富夕夏 |
| deep | DEEP JEWELS 49kg以下 5分3R | 3 | 竹林エル |
| deep | DEEP JEWELSストロー級 5分3R | 2 | ののか |
| deep | DEEP JEWELSストロー級 5分3R | 1 | キム・ソユル |
| deep | DEEP JEWELSストロー級 5分2R | 3 | 桐生祐子 |
| deep | DEEP JEWELSストロー級 5分2R | 3 | 月井隼南 |
| deep | DEEP JEWELS 49kg以下 5分2R | 2 | 彩綺 |
| deep | DEEP JEWELS 49kg以下 5分2R | 3 | abbie |
| deep | DEEP JEWELS 65kg以下 5分2R | 4 | 樹季 |
| deep | DEEP JEWELS 65kg以下 5分2R | 1 | Te-a |
| deep | DEEP JEWELS 53kg以下 5分2R | 4 | SAAYA |
| deep | DEEP JEWELS 58kg以下 5分2R | 2 | 鈴木”BOSS”遥 |
| deep | DEEP JEWELS 58kg以下 5分2R | 2 | 田川真帆 |
| deep | DEEP JEWELS 60kg以下 5分2R | 2 | JUICY |
| deep | DEEP JEWELS 60kg以下 5分2R | 1 | うらら |
| deep | DEEP JEWELS 50kg以下 3分2R アマチュアSルール | 3 | 山吹マリン |
| deep | DEEP JEWELS 50kg以下 3分2R アマチュアSルール | 4 | 谷山心優 |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSルール | 4 | あきぴ |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSルール | 3 | 村松美直 |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSルール | 1 | 愛温 |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSルール | 1 | 山内梨緒 |
| deep | DEEP JEWELS 49kg 以下 3分2R アマチュアSルール | 3 | 横江明日香 |
| deep | DEEP JEWELS 49kg 以下 3分2R アマチュアSルール | 1 | デスティニー |
| deep | DEEPメガトン級 5分3R | 3 | ブラックタイガー |
| deep | DEEPフェザー級 5分2R | 2 | カンジ |
| deep | DEEPフェザー級 5分2R | 2 | KINNO |
| deep | DEEPバンタム級 5分2R | 3 | 黒岡裕真 |
| deep | DEEPバンタム級 5分2R | 2 | 笹崎健司 |
| deep | DEEPバンタム級 5分2R | 3 | 坂本岳 |
| deep | DEEPバンタム級 5分2R | 1 | ハム・ギワン |
| deep | DEEPフライ級 5分2R | 2 | 仁井田右楽 |
| deep | DEEPフライ級 5分2R | 5 | 廣瀬裕斗 |
| deep | DEEP 60kg以下 5分2R | 1 | 渡邉龍太郎 |
| deep | DEEP 60kg以下 5分2R | 1 | キンジ |
| deep | DEEPフェザー級 5分2R | 1 | ガブリエル |
| deep | DEEPフェザー級 5分2R | 1 | 尚太郎 |
| deep | DEEPウェルター級 3分2R アマチュアSルール | 2 | TAKUMA |
| deep | DEEPウェルター級 3分2R アマチュアSルール | 1 | 猿丸凛太朗 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 3 | 菊間瑛太 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 小嵐翔真 |
| deep | DEEPストロー級タイトルマッチ 5分3R | 3 | 知名昴海 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 今野連弥 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 武井大将 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | ショウエイ |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 矢代光 |
| deep | DEEPフェザー級 5分3R | 1 | 森俊樹 |
| deep | DEEPフェザー級 5分2R | 1 | 中村雄一 |
| deep | DEEPバンタム級 5分2R | 2 | 堂園悠 |
| deep | DEEPバンタム級 5分2R | 2 | 唐沢タツヤ |
| deep | DEEPフライ級 5分2R | 2 | 橋本優大 |
| deep | DEEPフライ級 5分2R | 1 | コビー・レオン |
| deep | DEEPフライ級 5分2R | 2 | 安永吏成 |
| deep | DEEPフライ級 5分2R | 1 | 高橋健斗 |
| deep | DEEPライト級 5分2R | 2 | トミー渡部 |
| deep | DEEPライト級 5分2R | 2 | 井上竜旗 |
| deep | DEEPバンタム級 5分2R | 3 | 寉岡樹記 |
| deep | DEEPフェザー級 5分2R | 2 | 藤井連 |
| deep | DEEPフェザー級 5分2R | 1 | 山田葵生 |
| deep | DEEP 64kg以下 3分2R アマチュアSルール | 3 | 佐藤聖優 |
| deep | DEEP 64kg以下 3分2R アマチュアSルール | 1 | サンシャイン |
| deep | DEEP 58kg以下 3分2R アマチュアSルール | 1 | ごとう瑠海 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 2 | 谷口仁歩 |
| deep | DEEPバンタム級3分2RアマチュアSルール | 3 | 高尾凌生 |
| deep | DEEPバンタム級3分2RアマチュアSルール | 1 | 河島ノブヒデ |
| deep | DEEPフライ級 5分3R | 2 | 濱口奏琉 |
| deep | DEEPフライ級 5分2R | 2 | 松原聖也 |
| deep | DEEPフェザー級 5分2R | 1 | 岩本達彦 |
| deep | DEEPフェザー級 5分2R | 3 | 藤田宇宙 |
| deep | DEEPバンタム級 5分2R | 2 | 木下竜馬 |
| deep | DEEPバンタム級 5分2R | 2 | 福田泰暉 |
| deep | DEEP JEWELS 50kg以下 5分2R | 1 | あー子 |
| deep | DEEPフェザー級 5分2R | 2 | 瀧口脩生 |
| deep | DEEPフェザー級 5分2R | 2 | 田中壱季 |
| deep | DEEPフェザー級 5分2R | 1 | 井康勢 |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSPルール | 2 | 大西未来 |
| deep | DEEP JEWELS 49kg以下 5分3R | 1 | HIME |
| deep | セミファイナル DEEPストロー級 5分2R | 3 | 武蔵 |
| deep | DEEPフライ級 5分2R | 2 | 太一 |
| deep | DEEPライト級 5分2R | 3 | 今村豊 |
| deep | DEEP JEWELSバンタム級5分2R | 1 | MANA |
| deep | DEEP JEWELSバンタム級5分2R | 1 | 中尾あづき |
| deep | DEEPライト級 5分2R | 3 | ベンジャミン |
| deep | DEEPライト級 5分2R | 1 | 武蔵坊慶輔 |
| deep | DEEPフライ級 5分2R | 2 | 米原剛希 |
| deep | DEEP 97kg以下 5分2R | 2 | 西川将輝 |
| deep | DEEP 97kg以下 5分2R | 2 | アモリン |
| deep | DEEP JEWELS 68kg以下5分2R | 2 | ぽちゃんZ |
| deep | DEEP JEWELS 68kg以下5分2R | 2 | Bobo飛鳥 |
| deep | DEEP JEWELSフェザー級5分2R | 2 | 近藤世里菜 |
| deep | DEEP メガトン級 3分2RアマチュアSルール | 2 | 佐藤勇真 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 2 | 朝井啓太 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 杉映都 |
| deep | DEEP JEWELSバンタム級王者決定戦 5分3R | 1 | 百湖 |
| deep | DEEP JEWELSストロー級 5分3R | 1 | 万智 |
| deep | DEEP JEWELSストロー級 5分3R | 1 | キム・ダンビ |
| deep | DEEP JEWELS 49kg以下 5分2R | 1 | 海咲イルカ |
| deep | DEEP JEWELSストロー級 5分2R | 3 | 堀井かりん |
| deep | DEEP JEWELS ストロー級 5分2R | 3 | 横瀬友愛 |
| deep | DEEP JEWELS ストロー級 5分2R | 2 | 岡美紀 |
| deep | DEEP JEWELSストロー級 2分2R KICKルール | 1 | 坂本瑠華 |
| deep | DEEP JEWELSストロー級 2分2R KICKルール | 1 | ダイナマイト♡ユラ |
| deep | DEEP JEWELS 50kg以下 2分2R KICKルール | 1 | 島村優花 |
| deep | DEEP JEWELS 50kg以下 2分2R KICKルール | 1 | 中澤諒香 |
| deep | DEEP JEWELS 49kg以下 3分2R アマチュアSルール | 1 | 村井成美 |
| deep | DEEP JEWELSストロー級 3分2R アマチュアSルール | 2 | ちゃんりな |
| deep | DEEP JEWELS 50kg以下 3分2R アマチュアSルール | 3 | せりな |
| deep | DEEP JEWELS 50kg以下 3分2R アマチュアSルール | 1 | 山岸佳音 |
| deep | DEEP JEWELSフライ級3分2R アマチュアSルール | 1 | たから |
| deep | DEEPフライ級 5分2R | 1 | 御代川敏志 |
| deep | DEEPフライ級 5分2R | 1 | 吉田悠太郎 |
| deep | DEEPライト級 5分2R | 1 | ウラケン |
| deep | DEEＰフライ級 5分2R | 1 | 平井聡一朗 |
| deep | DEEＰフライ級 5分2R | 2 | 石井涼馬 |
| deep | DEEPバンタム級 5分2R | 2 | 西山亮翔 |
| deep | DEEPバンタム級 5分2R | 1 | 小林よしずみ |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 小笠原孝成 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 須山豪 |
| deep | DEEPストロー級 3分2R アマチュアSルール | 1 | Michael北見 |
| deep | DEEPバンタム級 5分2R | 3 | 吉田陸 |
| deep | DEEPバンタム級 5分2R | 3 | 脇田仁 |
| deep | DEEPライト級 5分2R | 2 | 藤岡陸 |
| deep | DEEPライト級 5分2R | 1 | 田中慎一郎 |
| deep | DEEPライト級 5分2R | 2 | 平澤克明 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 小澤亮太 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 加藤颯 |
| deep | DEEPライトヘビー級 5分2R | 1 | 勇太 |
| deep | DEEPフライ級 5分2R | 3 | 大岩翔哉 |
| deep | DEEPフライ級 5分2R | 2 | 川崎ごうる |
| deep | DEEPフライ級 5分2R | 2 | 前田遊 |
| deep | DEEPライト級 3分2R アマチュアSルール | 1 | 出口誉 |
| deep | DEEPライト級 3分2R アマチュアSルール | 1 | 伊藤叶 |
| deep | ライト級決勝 | 2 | 権藤悠太郎 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 杉村祥真 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 2 | 切嶋黎 |
| deep | DEEPバンタム級 5分2R | 1 | 石田ガリット勝也 |
| deep | DEEPフライ級 5分2R | 2 | 村田和生 |
| deep | DEEPフェザー級 5分2R | 1 | 福山佳祐 |
| deep | DEEPフェザー級 5分2R | 2 | 濱本佳樹 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 武山詩音 |
| deep | DEEPフライ級 3分2RアマチュアSルール | 1 | 森大夢 |
| deep | DEEPフライ級 3分2RアマチュアSルール | 1 | 内野誠哉 |
| deep | DEEPフェザー級 5分2R | 2 | 佐々木耀 |
| deep | DEEPライト級 5分2R | 1 | トミー渡辺 |
| deep | DEEPライト級 5分2R | 2 | アニンタ・アリ |
| deep | DEEPメガトン級 5分2R | 1 | ホワイトベア |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 佐藤カナウ |
| deep | DEEPフライ級 3分2R アマチュアSルール | 2 | 佐藤照栄 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 福嶋司 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 2 | 金子蒼空 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 横山桔平 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | ランペイジ竜太 |
| deep | DEEPフライ級 5分2R | 3 | 松岡疾人 |
| deep | DEEPライト級 5分2R | 1 | 野尻大輔 |
| deep | DEEP 60kg以下 5分2R | 1 | 左京 |
| deep | DEEP JEWELS ストロー級 5分2R | 2 | 堀内美沙紀 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 国分獅斗 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 菊池佳歩 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 佐藤凛 |
| deep | DEEPメガトン級 5分3R | 1 | 稲田将 |
| deep | DEEPフライ級 5分2R | 1 | 橋本ユウタ |
| deep | DEEPライト級 5分2R | 1 | 荒井銀二 |
| deep | DEEPライト級 5分2R | 2 | 平石光一 |
| deep | DEEPメガトン級 3分2R アマチュアSルール | 1 | ハチミツ大魔王 |
| deep | DEEPフェザー級 5分3R | 1 | 延命そら |
| deep | DEEPフェザー級 5分3R | 1 | 牧野滉風 |
| deep | DEEPフェザー級 5分2R | 1 | 三村亘 |
| deep | DEEPフェザー級 5分2R | 2 | 鈴木琢仁 |
| deep | DEEPメガトン級 5分２R | 2 | 大家皆 |
| deep | DEEPバンタム級 5分2R | 2 | 山﨑鼓大 |
| deep | DEEPバンタム級 5分2R | 2 | 田口貴規 |
| deep | DEEPウェルター級 5分2R | 1 | 大澤将司 |
| deep | DEEPウェルター級 5分2R | 1 | 上田拳翔 |
| deep | DEEPストロー級 5分2R | 1 | 上村亮馬 |
| deep | DEEP 63kg以下 3分3R KICKルール | 1 | 原田闘鬼 |
| deep | DEEP 63kg以下 3分3R KICKルール | 1 | 丸山晃毅 |
| deep | DEEPフェザー級 5分2R | 1 | 石田拓己 |
| deep | DEEPフライ級 3分2RアマチュアSルール | 1 | 吉村凌仁郎 |
| deep | DEEP JEWELS 49kg以下 5分2R | 2 | サラ |
| deep | DEEP JEWELSミクロ級 5分2R | 1 | 小雪 |
| deep | DEEP JEWELS 49kg以下 3分2R アマチュアSルール | 1 | 五十嵐莉子 |
| deep | DEEP JEWELS 49kg以下 3分2R アマチュアSルール | 2 | 和智美音 |
| deep | DEEPメガトン級 5分3R | 1 | Guts |
| deep | DEEPバンタム級 5分2R | 1 | 湯浅帝蓮 |
| deep | DEEPストロー級 5分2R | 1 | 多湖力翔 |
| deep | DEEPフェザー級 5分2R | 1 | キム・ミンソク |
| deep | DEEPバンタム 5分2R | 1 | 山口コウタ |
| deep | DEEPバンタム級 5分2R | 2 | 丈太 |
| deep | DEEP 64kg以下 3分2R アマチュアSルール | 1 | 田中悠翔 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 池森ヨシキ |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 松元大樹 |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 上田遥斗 |
| deep | DEEPライト級 5分3R | 1 | 大木良太 |
| deep | DEEP 59kg以下 5分2R | 1 | 木村琉音 |
| deep | DEEPメガトン級 5分2R | 1 | バッファロー |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 大将 |
| deep | DEEPミドル級アマチュアSルール 3分2R | 1 | 桜井聡紀 |
| deep | DEEPフライ級アマチュアSルール 3分2R | 1 | 武田祈和 |
| deep | DEEPフライ級アマチュアSルール 3分2R | 1 | イトカズ・コウセイ |
| deep | DEEPストロー級アマチュアSPルール 3分2R | 1 | 小林桜太 |
| deep | DEEPバンタム級アマチュアSルール 3分2R | 1 | 南谷純也 |
| deep | DEEPメガトン級アマチュアKICKルール1分30秒2R | 1 | ドリーム★キミ |
| deep | DEEPメガトン級アマチュアKICKルール1分30秒2R | 1 | 喪黒★福蔵 |
| deep | DEEPライト級 5分2R | 1 | 胸毛ニキ |
| deep | DEEPバンタム級 5分2R | 1 | 切嶋龍希 |
| deep | DEEPバンタム級 5分2R | 2 | Akiyoshi |
| deep | DEEPストロー級 5分2R | 1 | 金光優真 |
| deep | DEEPフライ級 5分2R | 1 | 中野ハヤト |
| deep | DEEP54kg以下KICKルール2分３R | 1 | 高林和真 |
| deep | DEEP54kg以下KICKルール2分３R | 1 | 和泉直人 |
| deep | DEEP68kg以下KICKルール2分3R | 1 | WATARU |
| deep | DEEP68kg以下KICKルール2分3R | 1 | 中川北斗 |
| deep | DEEP65kg以下KICKルール2分３R | 1 | 小林直貴 |
| deep | DEEP65kg以下KICKルール2分３R | 1 | 伊藤陸都 |
| deep | DEEP56kg以下KICKルール2分３R | 1 | 高山敦 |
| deep | DEEP56kg以下KICKルール2分３R | 1 | 稲村健心 |
| deep | DEEP60kg以下KICKルール2分３R | 1 | 鈴木克彰 |
| deep | DEEP60kg以下KICKルール2分３R | 1 | 加藤宥希 |
| deep | DEEP49kg以下KICKルール2分3R | 1 | 大川怜輝 |
| deep | DEEP49kg以下KICKルール2分3R | 1 | 伊藤佑都 |
| deep | DEEP70kg以下KICKルール2分2R | 1 | 鈴木柚来 |
| deep | DEEP70kg以下KICKルール2分2R | 1 | 望月琉偉 |
| deep | DEEP60kg以下KICKルール2分2R | 1 | 袴田玲 |
| deep | DEEP60kg以下KICKルール2分2R | 1 | 浅野劉生 |
| deep | DEEP53kg以下KICKルール2分2R | 1 | 河合奏太朗 |
| deep | DEEP53kg以下KICKルール2分2R | 1 | 有村至恩 |
| deep | DEEP54kg以下KICKルール2分2R | 1 | 山本凌己 |
| deep | DEEP54kg以下KICKルール2分2R | 1 | 児玉英志朗 |
| deep | DEEPバンタム級 5分3R | 1 | 前園渓 |
| deep | DEEP フェザー級 5 分 2R | 1 | GINJI |
| deep | DEEPバンタム級 5分2R | 1 | 澄斗 |
| deep | DEEPアマチュアSルール フェザー級 3分2R | 1 | 大原宇竜 |
| deep | DEEP フェザー級 5分3R | 1 | チェ・ソンヒョク |
| deep | DEEP JEWELS 51kg以下 5分2R | 1 | サダエ☆マヌーフ |
| deep | DEEP ライト級 5 分2R | 1 | 大野“虎眼”賢良 |
| deep | DEEP フライ級 5分2R | 1 | 砂田華社 |
| deep | DEEP JEWELS アトム級 5分2R | 1 | 横瀬美久 |
| deep | DEEP JEWELS ストロー級 5分2R | 1 | 成本優良 |
| deep | DEEPライト級 5分2R | 1 | 石塚雄馬 |
| deep | DEEPフェザー級 5分2R | 1 | 菊川イサム |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | RYOTA |
| deep | DEEP JEWELS 52kg 2分3R KICKルール | 1 | きたりこ |
| deep | DEEP JEWELS 52kg 2分3R KICKルール | 1 | MANAKA |
| deep | DEEP JEWELSフェザー級 5分2R | 1 | 谷山瞳 |
| deep | DEEP JEWELSミクロ級 5分2R | 1 | ジャカ季美香 |
| deep | DEEP JEWELS 51kg以下 3分2R アマチュアSルール | 1 | 須山ゆな |
| deep | DEEPライト級 5分2R | 1 | アサン・ゲェイデ |
| deep | DEEPフライ級 5分2R | 1 | 颯斗 |
| deep | DEEPバンタム級 5分2R | 1 | 生田大雅 |
| deep | DEEPバンタム級 3分2R アマチュアSルール | 1 | 大和田龍斗 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | 菅涼星 |
| deep | DEEPフェザー級 3分2R アマチュアSルール | 1 | ダイア |
| deep | DEEPフライ級 3分2R アマチュアSルール | 1 | 岸翔大 |
| deep | DEEP フライ級 5 分 2R | 1 | 八尋大輝 |
| deep | DEEP バンタム級 5 分 2R | 1 | 草野ガブリエル |
| deep | DEEP フライ級 5 分 2R | 1 | 中西哲夫 |
| deep | バンタム級 5 分 2R | 1 | 野木崇政 |
| deep | DEEPライト級 5 分 2R | 1 | 河村嘉展 |
| deep | DEEP フライ級 5 分 2R | 1 | 髙村友晴 |
| deep | DEEPメガトン級 5 分 2R | 1 | もも太郎 |
| deep | DEEPバンタム級 5 分 2R | 1 | 福井達郎 |
| deep | DEEP バンタム級 3 分 2R アマチュア S ルール | 1 | 平山稔和 |
| deep | DEEP バンタム級 3 分 2R アマチュア S ルール | 1 | 河野太喜 |
| deep | DEEPバンタム級 3 分 2R アマチュア S ルール | 1 | 熊澤愛希也 |
| deep | DEEP フェザー級 3 分 2R アマチュア S ルール | 1 | 西川玲司 |
| deep | DEEP ストロー級 3 分 2R アマチュア S ルール | 1 | 大森仁 |
| deep | DEEP ストロー級 3 分 2R アマチュア S ルール | 1 | 西村凛惺 |
| deep | フライ級決勝 | 1 | 須田雄律 |
| deep | フライ級決勝 | 1 | 遠藤一心 |
| deep | バンタム級決勝 | 1 | ケンモーリス |
| deep | フェザー級決勝 | 1 | 鈴木覇 |
| deep | フェザー級決勝 | 1 | 青井佑 |
| deep | ライト級決勝 | 1 | 大澤伸明 |
| deep | ウェルター級決勝 | 1 | 羽江哲郎 |
| deep | ミドル級決勝 | 1 | 足立光弘 |
| deep | ミドル級決勝 | 1 | 早川豊司 |
| pancrase | ウェルター級 |  | 佐藤生虎 |
| pancrase | ライト級 |  | 平信一 |
| pancrase | ライト級 |  | 張豊 |
| pancrase | ライト級 |  | 鈴木悠斗 |
| pancrase | フェザー級 |  | 透暉鷹 |
| pancrase | フェザー級 |  | 岡田拓真 |
| pancrase | フェザー級 |  | Ryo |
| pancrase | フェザー級 |  | 遠藤来生 |
| pancrase | フェザー級 |  | 名田英平 |
| pancrase | フェザー級 |  | 関 翔渚 |
| pancrase | フェザー級 |  | 糸川義人 |
| pancrase | フェザー級 |  | 石田陸也 |
| pancrase | バンタム級 |  | 荒田大輝 |
| pancrase | バンタム級 |  | 佐藤ゆうじ |
| pancrase | バンタム級 |  | バラカトゥロ・アサドゥラエフ |
| pancrase | バンタム級 |  | 山木麻弥 |
| pancrase | バンタム級 |  | 前田浩平 |
| pancrase | バンタム級 |  | 合島大樹 |
| pancrase | バンタム級 |  | 白井誠司 |
| pancrase | フライ級 |  | 猿飛流 |
| pancrase | フライ級 |  | ラファエル・リベイロ |
| pancrase | フライ級 |  | 増田大河 |
| pancrase | フライ級 |  | 浜本キャット雄大 |
| pancrase | フライ級 |  | 植松洋貴 |
| pancrase | フライ級 |  | 小林了平 |
| pancrase | フライ級 |  | 菅歩夢 |
| pancrase | フライ級 |  | 山崎蒼空 |
| pancrase | フライ級 |  | 本川ハルアキ |
| pancrase | ストロー級 |  | 寺岡拓永 |
| pancrase | 女子フライ級 |  | 和田綾音 |
| shooto | ストロー級 |  | 旭那 拳 |
| shooto | ストロー級 |  | 田口 恵大 |
| shooto | ストロー級 |  | 友利 琉偉 |
| shooto | ストロー級 |  | 友利 幸汰 |
| shooto | ストロー級 |  | 梅木 勇徳 |
| shooto | フライ級 |  | 杉本 静弥 |
| shooto | フライ級 |  | 梅筋 毒一郎 |
| shooto | フライ級 |  | 山内 渉 |
| shooto | フライ級 |  | 岡田 嵐士 |
| shooto | フライ級 |  | 中池 武寛 |
| shooto | フライ級 |  | 鈴木 尊 |
| shooto | バンタム級 |  | 川北 晏生 |
| shooto | バンタム級 |  | チョウ スソン |
| shooto | バンタム級 |  | 藤井 伸樹 |
| shooto | バンタム級 |  | ダイキ ライトイヤー |
| shooto | バンタム級 |  | 中島 陸 |
| shooto | バンタム級 |  | 野尻 定由 |
| shooto | フェザー級 |  | パク ジョンジュン |
| shooto | フェザー級 |  | 齋藤 翼 |
| shooto | フェザー級 |  | 上原 平 |
| shooto | フェザー級 |  | 磯城嶋 一真 |
| shooto | フェザー級 |  | 飯野 雄斗 |
| shooto | フェザー級 |  | ネイン デイネッシュ |
| shooto | ライト級 |  | 結城 大樹 |
| shooto | ライト級 |  | 安海 健人 |
| shooto | ライト級 |  | マックス・ザ・ボディ |
| shooto | ライト級 |  | 大尊 伸光 |
| shooto | ライト級 |  | 田中 有 |
| shooto | ウェルター級 |  | ヴィクター バレンズエラ |
| shooto | ウェルター級 |  | エルナニ ペルペトゥオ |
| shooto | ウェルター級 |  | 田村 ヒビキ |
| shooto | ウェルター級 |  | グラップラー脇 |
| shooto | ミドル級 |  | 岩﨑 大河 |
| shooto | ミドル級 |  | 荒井 勇ニ |
| shooto | ミドル級 |  | 沙門 |
| shooto | ミドル級 |  | HENRY |
| shooto | ミドル級 |  | キム ジェヨン |
| shooto | 女子アトム級 |  | 徳本 望愛 |
| shooto | 女子アトム級 |  | 中村 未来 |
| shooto | 女子アトム級 |  | 杉本 恵 |
| shooto | 女子アトム級 |  | 平田 彩音 |
| shooto | 女子アトム級 |  | パク ソヨン |
| shooto | 女子アトム級 |  | ジェニー ファン |
| shooto | 女子アトム級 |  | 嶋屋 澪 |
| shooto | 女子スーパーアトム級 |  | 高本 千代 |
| shooto | 女子スーパーアトム級 |  | erika |
| shooto | 女子スーパーアトム級 |  | 片山 智絵 |
| shooto | 女子ストロー級 |  | 宝珠山 桃花 |
| shooto | 女子ストロー級 |  | パク ボヒョン |
| shooto | 女子ストロー級 |  | ハイライ ウーシャアモー |
| shooto | 女子ストロー級 |  | 高田 暖妃 |
| deep_champion_slot | ストロー級 |  | 知名昴海 |
| deep_champion_slot | 女子ストロー級 |  | 万智 |
| deep_champion_slot | 女子バンタム級 |  | 百湖 |
| deep_champion_slot | 女子フェザー級 |  | 東ようこ |
| deep_champion_slot | 女子無差別級 |  | アマンダ・ルーカス |

---

## ⑦ W1-6: Wikidataにいるがmnewsに無い日本人選手(640件)

FIGHTERS(listed+hidden両方。findFighterSlugByNameはhidden除外のため、`orgRankings.ts`と同型の理由で同じ正規化を使った別索引を構築)に、層1の751件のうちlabel_ja・alt_jaいずれも一切一致しなかったもの。全件は `out/wikidata-only-candidates.csv` にも保存済み。

| qid | label_ja | label_en | alt_ja | sherdog_id | tapology_id | birth_year |
|---|---|---|---|---|---|---|
| Q101200021 | 加藤ケンジ | Kenji Katō |  | 50244 |  | 1990 |
| Q104012994 | 安保瑠輝也 | Rukiya Anpo |  | 440165 |  | 1995 |
| Q104538734 | 弥益ドミネーター聡志 |  |  | 116745 |  | 1990 |
| Q104538858 | 芦田崇宏 | Takahiro Ashida |  | 72327 |  | 1989 |
| Q105258926 | 溝口勇児 | Yūji Mizoguchi | ミゾ |  | 456413-yuji-mizoguchi | 1984 |
| Q10566654 | カルロス天野 | Carlos Amano | 天野理恵子 | 48882 |  | 1976 |
| Q105704453 | 鈴木一史 | Kazuhito Suzuki |  | 189573 |  | 1978 |
| Q105704467 | 関鉄矢 | Tetsuya Seki |  | 153571 |  | 1994 |
| Q106479447 | 岡田遼 | Ryō Okada |  | 97145 |  | 1989 |
| Q106993277 | 渡部修斗 | Shooto Watanabe |  | 95987 |  | 1989 |
| Q106994215 | アキラ | Akira |  | 63782 |  | 1987 |
| Q106994310 | 井上雄策 | Yūsaku Inoue |  | 45670 |  | 1988 |
| Q10748038 | 日高郁人 | Ikuto Hidaka | ひだか いくと | 4678 |  | 1972 |
| Q108109301 | ANIMAL☆KOJI |  |  |  |  | 1991 |
| Q108110564 | 髙橋辰也 |  |  | 385962 |  |  |
| Q10854975 | 我龍真吾 | Shingo Garyū |  | 235035 |  | 1975 |
| Q109318886 | 石川真 |  |  |  |  |  |
| Q109594905 | 中嶋紳乃介 | Shinnosuke Nakajima |  |  |  | 1992 |
| Q109595024 | 竿本樹生 | Tatsuki Saomoto |  | 201119 |  | 1996 |
| Q109597344 | 西谷大成 | Taisei Nishitani |  | 374609 |  | 1996 |
| Q109599189 | ユータ&ロック | Yuta & Rock |  | 77324 |  | 1986 |
| Q110403105 | 三浦孝太 | Kōta Miura |  | 397029 |  | 2002 |
| Q110403137 | 中田大貴 | Hirotaka Nakada |  | 373058 |  | 1996 |
| Q110403724 | 祖根寿麻 | Kazuma Sone |  | 41120 |  | 1988 |
| Q111110044 | 伊藤空也 | Kūya Itō |  | 124673 |  | 1996 |
| Q111111971 | YUSHI | YUSHI |  | 397030 |  |  |
| Q111112651 | 宇田悠斗 | Yūto Uda |  | 321191 |  | 1997 |
| Q111112674 | 宮城友一 | Yūichi Miyagi |  | 18888 |  | 1983 |
| Q111112853 | 山本空良 | Sora Yamamoto |  | 239271 |  | 2000 |
| Q111113679 | 西川大和 | Yamato Nishikawa |  | 277109 |  | 2002 |
| Q111113726 | 近藤大耶 | Hiroya Kondo |  | 262395 |  | 1998 |
| Q111489066 |  | Namiko Kawabata |  | 357075 | 245554-hime | 1987 |
| Q111719217 | 原口央 | Akira Haraguchi |  | 337251 |  | 1995 |
| Q111719908 | 鈴木隼人 | Hayato Suzuki |  | 112221 |  | 1986 |
| Q11189850 | AZUMA | Azuma |  | 31845 |  | 1987 |
| Q11192033 | Barbaro44 | Barbaro44 | 富岡義宏 | 12072 |  | 1979 |
| Q11214259 | 玉海力剛 | Yukio Kawabe | 玉海力 剛 | 10505 |  | 1966 |
| Q11222258 | HARI | Hari | 張替美佳 | 5094 |  | 1982 |
| Q112237910 | 久保健太 | Kenta Kubo |  | 327057 |  | 1982 |
| Q112238050 | 木下憂朔 | Yūsaku Kinoshita |  | 382723 |  | 2000 |
| Q112238106 | 駒杵嵩大 | Takahiro Komakine |  | 259697 |  | 1991 |
| Q112238192 | 関根“シュレック”秀樹 | Hideki "Shrek" Sekine | 関根秀樹 | 53587 |  | 1973 |
| Q112238430 | 中澤達也 | Tatsuya Nakazawa |  | 50735 |  | 1979 |
| Q112238666 | 安谷屋智弘 | Tomohiro Adaniya |  | 36614 |  | 1987 |
| Q112238745 | グラント・ボグダノフ |  |  | 385965 |  | 1994 |
| Q112238795 | ZENKI | Zenki |  | 404656 |  | 1993 |
| Q112239204 | 黒井海成 | Kaisei Kuroi |  |  |  | 2001 |
| Q112239333 | 中務修良 | Nobuyoshi Nakatsukasa |  | 282783 |  | 1986 |
| Q11227821 | KG心斗 | KG Shinto |  | 30409 |  | 1982 |
| Q11235896 | NOZOMI | Nozomi Dai | だいのぞみ | 201815 |  | 1990 |
| Q11242377 | SACHI (格闘家) | Sachi | 山本幸子 | 19949 |  | 1980 |
| Q11252092 | URAKEN | URAKEN | 宇良健吾 | 7164 |  | 1981 |
| Q11264118 | 砂辺光久 | Mitsuhisa Sunabe |  | 2558 |  | 1979 |
| Q11270132 | せり | Seri | 斎藤せり | 10007 |  | 1975 |
| Q112762438 | 本野美樹 | Miki Motono |  | 317479 | 208989-miki-motono | 1994 |
| Q11300096 | グッドマン田中 | Goodman Tanaka |  | 14441 |  | 1979 |
| Q11301795 | ゲーリー・ノムライト | Yohei Nomura |  | 155769 |  | 1980 |
| Q11309232 | ジェット・イズミ | Izumi Noguchi |  | 7590 |  | 1975 |
| Q11309833 | ジャックナイフツネオ | Jackknife Tsuneo |  | 24406 |  | 1982 |
| Q11316001 | タカ・クノウ | Takanori Kuno | タカクノウ | 14535 |  | 1967 |
| Q11323927 | ナナチャンチン | Nana Chanchin | 市川奈々 | 7000 |  | 1978 |
| Q11338146 | ホワイト森山 | Moriyama Howaito | 森山大 | 8746 |  | 1978 |
| Q11341646 | マンモス佐々木 | Sasaki Manmosu | 浪速嘉則|佐々木嘉則 | 3717 |  | 1974 |
| Q11344676 | モンゴルマン | Asashi Saito | ザ・モンゴルマン | 49598 |  | 1970 |
| Q11347638 | ランボー宏輔 | Kosuke Suzuki |  | 58924 |  | 1984 |
| Q113566744 | 柴田"MONKEY"有哉 | Yūya "Monkey" Shibata |  | 78899 |  | 1992 |
| Q113566837 | 風我 |  |  | 385974 |  |  |
| Q113566892 | 原虎徹 | Kotetsu Hara |  | 375229 |  | 1997 |
| Q113567062 | 中原由貴 | Yoshiki Nakahara |  | 120707 |  | 1992 |
| Q113567140 | 菊入正行 |  |  | 226289 |  | 1995 |
| Q11358881 | 上山知暁 | Tomoaki Ueyama |  | 30993 |  | 1974 |
| Q11360885 | 下川雄生 | Yūsei Shimokawa |  | 11727 |  | 1981 |
| Q11361787 | 不死身夜天慶 | Tenkei Fujimiya |  | 10742 |  | 1980 |
| Q11361974 | 世IV虎 | Yoshiko |  | 244157 |  | 1993 |
| Q11363133 | 中原太陽 | Taiyō Nakahara |  | 4784 |  | 1982 |
| Q11365361 | 中村勇太 | Yūta Nakamura |  | 10038 |  | 1982 |
| Q11365794 | 中村浩士 | Hiroshi Nakamura | 中村"アイアン"浩士 | 12076 |  | 1981 |
| Q11367084 | 中西良行 | Yoshiyuki Nakanishi |  | 24234 |  | 1985 |
| Q11367087 | 中西裕一 | Yūichi Nakanishi |  | 4594 |  | 1981 |
| Q11369428 | 久松勇二 | Yūji Hisamatsu |  | 1731 |  | 1971 |
| Q11372955 | 井上学 | Manabu Inoue |  | 13116 |  | 1978 |
| Q11373036 | 井上明子 | Akiko Inoue |  | 10008 |  | 1985 |
| Q11373137 | 井上由美子 | Yumiko Inoue | 羽柴まゆみ | 9608 |  | 1980 |
| Q11379931 | 伊藤博之 | Hiroyuki Ito |  | 2279 |  | 1976 |
| Q11380061 | 伊藤崇文 | Takafumi Itō |  | 800 |  | 1972 |
| Q11382234 | 佐々木恭介 (格闘家) | Kyōsuke Sasaki |  | 3385 |  | 1979 |
| Q11382247 | 佐々木憂流迦 | Ulka Sasaki | 佐々木天狗|佐々木佑太 | 63070 | 19984-yuta-sasaki-ulka | 1989 |
| Q11383484 | 佐竹雅昭 | Masaaki Satake | 佐竹まさあき | 316 |  | 1965 |
| Q11383721 | 佐藤光芳 | Mitsuyoshi Satō |  | 1737 |  | 1977 |
| Q11383872 | 佐藤堅一 | Ken'ichi Satō |  | 4597 |  | 1971 |
| Q11384202 | 佐藤洋一郎 (格闘家) | Yōichirō Satō |  | 30407 |  | 1985 |
| Q11384975 | 佐野哲也 | Tetsuya Sano |  | 41738 |  | 1982 |
| Q11388645 | 児山佳宏 | Yoshihiro Koyama |  | 13391 |  | 1981 |
| Q11388963 | 入江秀忠 | Hidetada Irie | 琴入江秀忠|入江大和 | 6663 |  | 1969 |
| Q11391829 | 八隅孝平 | Kōhei Yasumi |  | 1285 | 4575-kohei-yasumi | 1978 |
| Q11394503 | 内藤征弥 | Yukiya Naitō |  | 4737 |  | 1977 |
| Q11395094 | 冨宅飛駈 | Takaku Fuke | 富宅飛駈|富宅祐輔|冨宅祐輔|ふけたかく | 669 |  | 1969 |
| Q11395119 | 冨樫健一郎 | Ken'ichirō Togashi | 富樫健一郎 | 2231 |  | 1980 |
| Q11399068 | 加藤友弥 | Tomoya Katō |  | 31191 |  | 1984 |
| Q11399528 | 加藤誠 | Makoto Kato |  | 1728 |  | 1976 |
| Q11400354 | 勝村周一朗 | Shūichirō Katsumura |  | 1291 |  | 1976 |
| Q11401948 | 北村克哉 | Katsuya Kitamura | きたむら かつや | 394289 |  | 1985 |
| Q11410246 | 及川千尋 | Chihiro Oikawa |  | 42436 |  | 1987 |
| Q11411276 | 古木克明 | Katsuaki Furuki |  | 74780 |  | 1980 |
| Q11413174 | 吉本光志 | Kōji Yoshimoto |  | 17290 |  | 1980 |
| Q11413376 | 吉永啓之輔 | Keinosuke Yoshinaga |  | 31182 |  | 1983 |
| Q11413769 | 吉田幸治 | Kōji Yoshida |  | 13343 |  | 1974 |
| Q11413924 | 吉田正子 | Masako Yoshida |  | 9610 |  | 1983 |
| Q11418012 | 和田拓也 | Takuya Wada |  | 1295 |  | 1978 |
| Q11418111 | 和田良覚 | Ryōgaku Wada |  | 4080 |  | 1963 |
| Q11418595 | 唐沢仁義 | Jingi Karasawa |  |  |  | 1969 |
| Q11423250 | 土屋大喜 | Taiki Tsuchiya |  | 29150 |  | 1984 |
| Q11427829 | 堀鉄平 | Teppei Hori |  | 31180 |  | 1976 |
| Q11429179 | 増山ともえ |  |  |  |  |  |
| Q11430022 | 夏樹☆たいよう | Natsuki Taiyo | 水嶋なつみ|夏樹☆ヘッド|夏樹☆qe94 | 19634 |  | 1984 |
| Q11430443 | 外岡真徳 | Masanori Tonooka |  | 25438 |  | 1973 |
| Q11430529 | 外薗晶敏 | Akitoshi Hokazono |  | 3608 |  | 1977 |
| Q11432602 | 大刀光電右エ門 | Den'emon Tachihikari | 太刀光修|大刀光修|大刀光 | 314 |  | 1963 |
| Q11434112 | 大塚隆史 | Takafumi Ōtsuka |  | 19056 | takafumi-otsuka | 1986 |
| Q11434365 | 大室奈緒子 | Naoko Ōmuro |  | 7002 |  | 1976 |
| Q11438201 | 大石幸史 | Koji Oishi |  | 249 |  | 1977 |
| Q11438240 | 大石真丈 | Masahiro Ōishi |  | 1200 |  | 1968 |
| Q11439822 | 大門まい子 | Maiko Ōkado |  | 10010 |  | 1977 |
| Q11441900 | 大飛翔誠志 | Seiji Daihishō | 小椋誠志 | 13369 |  | 1973 |
| Q11443331 | 天突頑丈 | Ganjō Tentsuku | 宮坂裕介 | 7717 |  | 1982 |
| Q11446038 | 奥田正勝 | Masakatsu Okuda |  | 8108 |  | 1976 |
| Q11451329 | 安藤晃司 | Kōji Andō |  | 34270 |  | 1985 |
| Q11451382 | 安藤純 | Jun Andō |  | 16801 |  |  |
| Q11453156 | 宮下トモヤ | Tomoya Miyashita | 宮下智也 | 6959 |  | 1981 |
| Q11455072 | 宮澤元樹 | Motoki Miyazawa | 宮沢元樹 | 13678 |  | 1985 |
| Q11456997 | 富松恵美 | Emi Tomimatsu |  | 19272 | 19822-emi-tomimatsu | 1982 |
| Q11457264 | 富田里奈 | Rina Tomita |  | 40764 |  | 1984 |
| Q11459799 | 亜利弥’ | Aliya | 小山亜矢 | 7004 |  | 1973 |
| Q11461703 | 小林歩 | Ayumu Kobayashi |  | 24245 |  | 1980 |
| Q11462068 | 小森亮介 | Ryōsuke Komori |  | 41766 |  | 1986 |
| Q11462300 | 小池秀信 | Hidenobu Koike |  | 5850 |  | 1976 |
| Q11463825 | 小路伸亮 | Shinsuke Shōji |  | 13120 |  | 1979 |
| Q11464138 | 小野武志 | Takeshi Ono |  | 8306 |  | 1974 |
| Q11465961 | 山下志功 | Shikō Yamashita |  | 1310 |  | 1973 |
| Q11466757 | 山口守 | Mamoru Yamaguchi |  | 1175 |  | 1977 |
| Q11467979 | 山崎剛 | Takeshi Yamazaki |  | 1359 |  | 1977 |
| Q11469277 | 山本篤 | Atsushi Yamamoto |  | 9634 |  | 1980 |
| Q11469295 | 山本美憂 | Miyū Yamamoto | 池田美憂|佐々木美憂|井上美憂 | 231061 | 138279-miyu-yamamoto | 1974 |
| Q11470265 | 山田哲也 | Tetsuya Yamada |  | 24901 |  | 1990 |
| Q11470302 | 山田学 | Manabu Yamada |  | 742 |  | 1969 |
| Q11473013 | 岡嵜康悦 | Kōetsu Okazaki |  | 10192 |  | 1979 |
| Q11473451 | 岡田円 | Madoka Okada |  | 13633 |  | 1988 |
| Q11474180 | 岩倉豪 | Tsuyoshi Iwakura |  | 45669 |  | 1970 |
| Q11474560 | 岩崎達也 | Tatsuya Iwasaki |  |  |  | 1969 |
| Q11477897 | 川原誠也 | Seiya Kawahara |  | 23708 |  | 1988 |
| Q11477938 | 川口健次 | Kenji Kawaguchi |  | 436 |  | 1968 |
| Q11479061 | 川畑千秋 | Chiaki Ota |  | 9603 |  | 1977 |
| Q11479325 | 川那子祐輔 | Yūsuke Kawanago |  | 22908 |  | 1983 |
| Q11479805 | 巨椋修 | Osamu Ogura |  |  |  | 1961 |
| Q11480055 | 市原海樹 | Minoki Ichihara |  | 35 |  | 1968 |
| Q11481212 | 帯谷信弘 | Nobuhiro Obiya | 土志田信弘 | 5793 |  | 1981 |
| Q11481795 | 幕大輔 | Daisuke Maku |  | 36440 |  | 1983 |
| Q11483432 | 平直行 | Naoyuki Taira |  | 1525 |  | 1963 |
| Q11486234 | 庵谷鷹志 | Takashi Iotani | 庵谷デビルマン鷹史 | 19595 |  | 1973 |
| Q11487189 | 弘中邦佳 | Kuniyoshi Hironaka |  | 2575 |  | 1976 |
| Q11490492 | 徹肌ィ郎 | Hadairō Tetsu | 徹肌イ郎 | 9578 |  | 1977 |
| Q11490810 | 志々目徹 | Tōru Shishime |  |  |  | 1992 |
| Q11491102 | 志田幹 | Miki Shida |  | 3659 |  | 1974 |
| Q11492511 | 悠羽輝 | Yuki Niimura | 新村優貴 | 83988 |  | 1982 |
| Q11496213 | 戸井田カツヤ | Katsuya Toida | 戸井田克也|といだ かつや|トイカツ | 1272 | katsuya-toida | 1977 |
| Q11497200 | 才賀紀左衛門 | Kizaemon Saiga |  | 175639 |  | 1989 |
| Q11503948 | 新美吉太郎 | Yoshitarō Niimi |  | 13390 |  | 1979 |
| Q11504913 | 日出ノ国太子郎 | Taishirō Hidenokuni | 太子郎 | 8796 |  | 1974 |
| Q11511282 | 早川光由 | Mitsuyoshi Hayakawa |  | 3742 |  | 1975 |
| Q11511909 | 昇侍 | Shoji Maruyama | 丸山昌治 | 18886 |  | 1983 |
| Q11513093 | 星野勇二 | Yūji Hoshino |  | 1730 |  | 1975 |
| Q11513109 | 星野大介 | Daisuke Hoshino |  | 23942 |  | 1981 |
| Q11513175 | 星野育蒔 | Ikuma Hoshino |  | 3735 |  | 1981 |
| Q11518167 | 木内崇雅 | Takamasa Kiuchi |  | 71317 |  | 1987 |
| Q11518463 | 木暮聡 | Satoru Kogure |  | 75041 |  | 1986 |
| Q11518991 | 木村浩一郎 | Koichiro Kimura | 木村浩一朗|スーパー宇宙パワー | 455 |  | 1969 |
| Q11519148 | 木村響子 | Kyōko Kimura |  | 86296 |  | 1977 |
| Q1151941 | 長南亮 | Ryo Chonan |  | 1831 |  | 1976 |
| Q11520423 | 本村康博 | Yasuhiro Motomura |  | 28154 |  | 1983 |
| Q11521006 | 本間祐輔 | Yūsuke Honma |  | 59966 |  | 1981 |
| Q11521734 | 杉内由紀 | Yuki Sugiuchi | 古舘由紀 | 11993 |  | 1980 |
| Q11522190 | 杉江大輔 | Daisuke Shiraki | 杉江アマゾン大輔 | 1352 |  | 1980 |
| Q11523346 | 村浜武洋 | Takehiro Murahama | 村濱武洋|村浜テイクヒーロー|村浜TAKE HERO | 1502 |  | 1974 |
| Q11523351 | 村濱天晴 | Takaharu Murahama | 村浜天晴 | 1246 |  | 1972 |
| Q11523421 | 村田夏南子 | Kanako Murata |  | 219081 | 129348-kanako-murata | 1992 |
| Q11531120 | 松本晃市郎 | Kōichirō Matsumoto | ジョビン | 22401 |  | 1986 |
| Q11531235 | 松本秀彦 | Hidehiko Matsumoto |  | 3653 |  | 1972 |
| Q11531511 | 松根良太 | Ryōta Matsune |  | 1340 |  | 1982 |
| Q11537417 | 桑原卓也 | Takuya Kuwabara |  | 1202 |  | 1972 |
| Q11538094 | 桜木裕司 | Yuji Sakuragi |  | 10749 |  | 1977 |
| Q11540305 | 森藤美樹 | Miki Morifuji |  | 14524 |  | 1977 |
| Q11540630 | 植松直哉 | Naoya Uematsu |  | 1174 |  | 1978 |
| Q11540727 | 植田豊 | Yutaka Ueda |  | 58004 |  | 1986 |
| Q11543870 | 橋本友彦 | Tomohiko Hashimoto | MAKEHEN | 4503 |  | 1977 |
| Q11546228 | 武田美智子 | Michiko Takeda |  | 11171 |  | 1975 |
| Q11547652 | 毛利昭彦 | Akihiko Mōri |  | 10044 |  | 1975 |
| Q1154771 | 桜庭和志 | Kazushi Sakuraba |  | 84 | kazushi-sakuraba-the-gracie-hunter | 1969 |
| Q11548892 | 水波綾 | Ryō Mizunami | 水村綾菜|水村綾 |  |  | 1988 |
| Q11552080 | 池田祥規 | Yoshinori Ikeda |  | 15395 |  | 1973 |
| Q115528950 | 涌井忍 |  |  | 191593 |  |  |
| Q115529575 | 上迫博仁 | Hiroto Uesako |  | 91247 |  |  |
| Q115530066 | 横山武司 | Takeji Yokoyama |  | 401325 |  | 1996 |
| Q115530136 | 川名TENCHO雄生 | Yūki "Tencho" Kawana |  | 53706 |  |  |
| Q11557313 | 浅野倫久 | Michihisa Asano |  | 13522 |  | 1980 |
| Q11557401 | 浅野篤司 | Atsushi Asano |  | 14159 |  | 1981 |
| Q11557673 | 浜崎朱加 | Ayaka Hamasaki |  | 45332 | 25649-ayaka-hamasaki | 1982 |
| Q11559119 | 海老原まどか | Madoka Ebihara | ♂ha@THE♀ | 19270 |  | 1986 |
| Q11559987 | 深岬パトラ | Patra Misaki | 小澤深岬 | 40763 |  | 1986 |
| Q11560271 | 深見智之 | Tomoyuki Fukami |  | 7693 |  | 1978 |
| Q11560791 | 清水俊一 | Shun'ichi Shimizu |  | 22677 | shunichi-shimizu | 1985 |
| Q11561682 | 渋谷修身 | Osami Shibuya |  | 801 |  | 1976 |
| Q11562168 | 渡辺大介 | Daisuke Watanabe |  | 1050 |  | 1977 |
| Q11565266 | 滝田J太郎 | Jeitarō Takita |  | 3989 |  | 1973 |
| Q11565961 | 澤田敦士 | Atsushi Sawada |  | 152807 |  | 1983 |
| Q11566182 | 濱村健 | Ken Hamamura | 浜村健 | 9719 |  | 1983 |
| Q11566305 | 瀧川リョウ | Ryō Takigawa | 瀧川りょう|滝川リョウ|滝川りょう | 19104 |  | 1970 |
| Q11566331 | 瀧本美咲 | Misaki Takimoto | 滝本美咲 | 6975 |  | 1980 |
| Q11566959 | 火若津将軍 | Shōgun Kawakatsu | 川勝将軍|川勝三朗|かわかつ しょうぐん|かわかつ さぶろう | 1251 |  | 1974 |
| Q11569668 | 片岡亮 | Ryō Kataoka | 片岡幻亮 |  |  | 1973 |
| Q11569782 | 片岡誠人 | Masato Kataoka |  | 51011 |  | 1977 |
| Q11572078 | 猿丸ジュンジ | Junji Ito |  | 23226 |  | 1986 |
| Q11574165 | 瓜田幸造 | Kozo Urita |  | 10387 |  | 1974 |
| Q11575371 | 田中半蔵 | Hanzō Tanaka | 田中宏茂 | 30643 |  | 1981 |
| Q11575813 | 田中章仁 | Akihito Tanaka |  | 41747 |  | 1983 |
| Q11577091 | 田沼良介 | Ryōsuke Tanuma |  | 30046 |  | 1981 |
| Q11577140 | 田澤和久 | Kazuhisa Tazawa |  | 23563 |  | 1979 |
| Q11577147 | 田澤聡 | Sō Tazawa |  | 8671 |  | 1982 |
| Q11584352 | 矢野卓見 | Takumi Yano | ヤノタク | 2280 |  | 1970 |
| Q11584363 | 矢野啓太 | Keita Yano |  | 197367 |  | 1988 |
| Q11585301 | 石原美和子 | Miwako Ishihara |  | 4233 |  | 1970 |
| Q11586348 | 石川英司 | Eiji Ishikawa |  | 1727 |  | 1979 |
| Q11586411 | 石川隆彦 | Takahiko Ishikawa |  |  |  | 1917 |
| Q11586414 | 石川雄規 | Yūki Ishikawa | 石川豊彦 | 3157 |  | 1967 |
| Q11586726 | 石毛大蔵 | Daizō Ishige |  | 11250 |  | 1980 |
| Q11590947 | 神酒龍一 | Ryūichi Miki | 三木龍一 | 13392 |  | 1983 |
| Q11596478 | 稲垣克臣 | Katsuomi Inagaki |  | 667 |  | 1969 |
| Q11596724 | 稲津航 | Wataru Inatsu |  | 15161 |  | 1984 |
| Q11598527 | 端貴代 | Takayo Hashi |  | 11605 | takayo-hashi | 1977 |
| Q11598836 | 竹内出 | Izuru Takeuchi |  | 1258 |  | 1974 |
| Q11599379 | 竹田誠志 | Masashi Takeda |  | 21212 |  | 1985 |
| Q11603564 | 篠原光 | Hikaru Shinohara |  | 6971 |  | 1974 |
| Q11606322 | 組坂幸喜 | Kōki Kumisaka | くみさか こうき |  |  | 1965 |
| Q11609117 | 美木航 | Wataru Miki |  | 3388 |  | 1980 |
| Q11609336 | 美花 | Mika | 林美花 | 17737 |  | 1976 |
| Q11610383 | 羽賀龍之介 | Ryūnosuke Haga |  |  |  | 1991 |
| Q11613306 | 臼田勝美 | Katsumi Usuda |  | 1990 |  | 1970 |
| Q11613309 | 臼田育男 | Ikuo Usuda |  | 35398 |  | 1980 |
| Q11613575 | 舞 (格闘家) | Maiko Takahashi |  | 9605 |  | 1973 |
| Q11615524 | 花澤大介 | Daisuke Hanazawa | 花澤大介13 | 7683 |  | 1976 |
| Q11616040 | 芹澤健市 | Ken'ichi Serizawa |  | 1830 |  | 1969 |
| Q11617095 | 茂木康子 | Yasuko Mogi |  | 14528 |  | 1969 |
| Q11619137 | 菅原伊織 | Iori Sugawara |  |  |  | 1978 |
| Q11619920 | 菊野克紀 | Katsunori Kikuno |  | 16806 | katsunori-kikuno | 1981 |
| Q11620755 | 葉山智昭 | Tomoaki Hayama |  | 446 |  | 1970 |
| Q11622899 | 藤井陸平 | Rikuhei Fujii |  | 19235 |  | 1984 |
| Q11629450 | 西良典 | Yoshinori Nishi |  | 472 |  | 1955 |
| Q11632181 | 謙吾 | Kengo | 渡部謙吾 | 1049 |  | 1976 |
| Q11633891 | 豊永稔 | Minoru Toyonaga |  | 320 |  | 1978 |
| Q11635321 | 赤井太志朗 | Tashirō Akai | 西内太志朗 | 1498 |  | 1980 |
| Q11638783 | 近藤定男 | Sadao Kondō |  | 28153 |  | 1979 |
| Q11642215 | 遠藤大翼 | Daisuke Endō |  | 26518 |  | 1982 |
| Q11642369 | 遠藤雄介 | Yūsuke Endō |  | 7519 |  | 1983 |
| Q11645165 | 野口悠介 | Yūsuke Noguchi |  | 43716 |  | 1983 |
| Q11645268 | 野地竜太 | Ryūta Noji |  | 10969 |  | 1978 |
| Q11646330 | 金井一朗 | Ichirō Kanai |  | 4502 |  | 1982 |
| Q11646595 | 金原泰義 | Yasunori Kanehara |  | 16529 |  | 1981 |
| Q11648147 | 釜谷真 | Makoto Kamaya |  | 19343 |  | 1983 |
| Q11651468 | 長井満也 | Mitsuya Nagai | 魔界5号|長井弘和 | 3352 |  | 1968 |
| Q11651878 | 長尾浩志 | Hiroshi Nagao | ジャイアント・バボ | 71288 |  | 1979 |
| Q11653831 | 長谷川悟史 | Satoshi Hasegawa |  | 883 |  | 1976 |
| Q11653941 | 長谷川秀彦 | Hidehiko Hasegawa |  | 5417 |  | 1978 |
| Q11655789 | 関忠則 | Tadanori Seki |  | 54790 |  | 1971 |
| Q11657778 | 阿部博之 | Hiroyuki Abe |  | 20221 |  | 1977 |
| Q11664622 | 須田匡昇 | Masanori Suda |  | 440 |  | 1973 |
| Q11667858 | 馬場勇気 | Yūki Baba |  | 22671 |  | 1987 |
| Q11670000 | 高木健太 | Kenta Takagi |  | 36173 |  | 1986 |
| Q11670520 | 高林恭子 | Kyōko Takabayashi |  | 13409 |  | 1981 |
| Q11675053 | 鳥生将大 | Masahiro Toryū |  | 20516 |  | 1983 |
| Q116752893 |  | Shohei Yamamoto |  |  |  |  |
| Q11676015 | 鶴巻伸洋 | Nobuhiro Tsurumaki |  | 1273 |  | 1971 |
| Q11677027 | 鹿又智成 | Tomonari Kanomata |  | 5792 |  | 1979 |
| Q11678755 | 黒石高大 | Takahiro Kuroishi |  | 36428 |  | 1986 |
| Q11679146 | 齋藤裕俊 | Hirotoshi Saitō | 斉藤裕俊 | 31881 |  | 1984 |
| Q116936024 | 春日井“寒天”たけし |  |  | 49771 |  | 1988 |
| Q116936029 | 江藤公洋 |  |  | 139631 |  | 1988 |
| Q116937109 | 鈴木槙吾 | Shingo Suzuki |  | 36613 |  | 1986 |
| Q116937230 | 谷山尚未 | Naomi Taniyama |  | 105591 |  | 1984 |
| Q116937325 | 三上ヘンリー大智 | Daichi Henry Mikami |  | 392951 |  | 1996 |
| Q117037901 | 信原空 | Sora Nobuhara | 勾配ニキ | 430071 |  |  |
| Q1171177 | 中邑真輔 | Shinsuke Nakamura |  | 6361 |  | 1980 |
| Q118697071 | 山本琢也 |  |  | 131399 |  | 1994 |
| Q118726934 | 古林礼名 | Rena Kobayashi |  |  |  | 1992 |
| Q118748153 | 亀田一鶴 | Ikkaku Kameda |  |  |  |  |
| Q1188451 | 髙田延彦 | Nobuhiko Takada | 髙田伸彦|高田延彦|高田伸彦 | 293 | nobuhiko-takada | 1962 |
| Q119345539 | 山本聖悟 |  |  | 192997 |  | 1995 |
| Q119517846 | 渡辺彩華 | Ayaka Watanabe |  | 376966 | 280986-ayaka-watanabe | 1997 |
| Q119929758 | 高橋雄己 | Yūki Takahashi |  | 382672 |  | 1999 |
| Q119930066 | 風間敏臣 | Toshiomi Kazama |  | 373059 |  | 1997 |
| Q119930067 | 木下タケアキ | Takeaki Kinoshita |  | 329741 |  | 1996 |
| Q119930070 | 星野豊 | Yutaka Hoshino |  | 128791 |  | 1994 |
| Q119930073 | 飯野健夫 | Tateo Iino |  | 120699 |  | 1986 |
| Q120402600 | 高野優樹 | Yūki Takano |  | 167485 |  |  |
| Q121354627 | ノッコン寺田 | Nokkon Tereda | 寺田幸司 |  | 456394-nokkon-terada | 1984 |
| Q121355278 | 松場貴志 |  |  | 129427 |  | 1991 |
| Q122945610 | 村上彩 | Aya Murakami |  | 373053 | 265120-aya-murakami | 1992 |
| Q123405825 | 樋口武大 |  |  | 46336 |  | 1988 |
| Q124096924 | YURA | Yura | 甲野裕頼 |  | 344239-yura | 2003 |
| Q124097324 | エスカル御殿 |  |  |  |  | 1970 |
| Q125324207 | 重田ホノカ | Honoka Shigeta |  | 422358 |  |  |
| Q125481634 | 小野正之助 | Masanosuke Ono |  |  | 571855-masanosuke-ono | 2004 |
| Q126005325 | 井原良太郎 | Ryotaro Ihara | 路上に花咲く天才喧嘩坊や|いはら りょうたろう|アンパンマンチョコニキ|キノコ |  |  | 1995 |
| Q126005409 |  |  |  | 400520 |  | 1990 |
| Q126005569 | RYOGA | RYOGA |  | 381199 |  |  |
| Q126005793 | 高橋遼伍 |  |  | 84427 |  | 1989 |
| Q126934596 |  | Tatsuya Ando |  | 174625 | 76663-tatsuya-ando | 1990 |
| Q130725813 | 宇佐美秀メイソン | Meison Hide Usami |  | 404657 | 307522-mason-shu-usami |  |
| Q131010569 | 赤田功輝 | Koki Akada | 赤田プレイボイ功輝 | 461153 |  | 1998 |
| Q131225954 |  |  |  | 96011 |  |  |
| Q131353598 | 太田将吾 |  | 太田　将吾|太田 将吾|オールドルーキー | 410090 |  | 1984 |
| Q131758269 |  | Shudai Harada |  |  | 406574-shudai-harada | 2001 |
| Q132431723 | 芦田和幸 | Kazuyuki Ashida |  |  |  | 1986 |
| Q132432372 | 横内三旺 | San'ō Yokouchi |  | 434731 |  | 2006 |
| Q133271441 | 渡邉史佳 | Fumika Watanabe |  | 421311 |  |  |
| Q1336512 | 須藤元気 | Genki Sudo |  | 1227 | genki-sudo-neo-samurai | 1978 |
| Q133826011 | 鮫島るい | Rui Samejima | 武村綾華 | 295585 | 195354-aya | 1992 |
| Q134508312 | 浦川大将 | Hiromasa Urakawa |  |  | 245386-hiromasa-urakawa | 1997 |
| Q134992743 | 池内紀子 | Noriko Ikeuchi |  |  | 285998-noriko-ikeuchi | 1999 |
| Q135687245 |  | Shigetoshi Kotari |  |  | 261371-shigetoshi-kotari | 1996 |
| Q135689416 | ソルト |  |  | 398309 |  | 1990 |
| Q135689441 |  |  | 成田柊 | 382139 |  |  |
| Q136298515 | 北本隼輔 | Shunsuke Kitamoto |  |  | 503236-shunsuke-kitamoto | 2000 |
| Q136338017 | 大井すず |  |  | 472119 |  | 2005 |
| Q136692912 | 中村京一郎 | Keiichirō Nakamura |  | 403670 |  |  |
| Q136692992 | ゴングマン | Gongman |  |  |  |  |
| Q1376088 | 小川直也 | Naoya Ogawa |  | 307 | naoya-ogawa | 1968 |
| Q138642071 | ジェリオ・サン・ピエール | Jerio San Pierre |  |  |  | 2002 |
| Q138808941 | 福元健史 | Takeshi Fukumoto | ふくもとたけし|Takeshi Fukumoto | Takeshi-Fukumoto-407981 | 503043-takeshi-fukumoto | 1976 |
| Q1395975 | 獣神サンダー・ライガー | Jushin Liger | 獣神ライガー|獣神サンダーライガー|山田惠一|山田恵一 | 5973 |  | 1964 |
| Q15395513 | 田中路教 | Michinori Tanaka |  | 71942 |  | 1990 |
| Q15984578 | 徳留一樹 | Kazuki Tokudome |  | 26192 | kazuki-tokudome | 1987 |
| Q15987739 | 鈴木信達 | Nobutatsu Suzuki |  | 15160 |  | 1977 |
| Q15987743 | 高田浩也 | Hiroya Takada |  | 1501 |  | 1977 |
| Q15987792 | 久米鷹介 | Takasuke Kume |  | 21731 | 8848-takasuke-kume | 1985 |
| Q16566256 | 倉本一真 | Kazuma Kuramoto |  | 269069 |  | 1986 |
| Q16770400 | 岸本泰昭 | Yasuaki Kishimoto |  | 21996 |  | 1984 |
| Q1705122 | 鈴木みのる | Minoru Suzuki | 鈴木実 | 666 |  | 1968 |
| Q1705780 | 佐山聡 | Satoru Sayama | 初代タイガーマスク|佐山サトル|サミー・リー |  |  | 1957 |
| Q17160466 | TAISHO | Tomomi Iwama |  | 6077 |  | 1977 |
| Q17224941 | 中井光義 | Mitsuyoshi Nakai |  | 54006 |  | 1989 |
| Q17349970 | 佐々木信治 | Sasaki Shinji |  | 14367 |  | 1980 |
| Q17349973 | 佐藤天 | Takashi Satō |  | 147403 |  | 1990 |
| Q1739023 | 佐々木健介 | Kensuke Sasaki | パワー・ウォリアー | 2641 |  | 1966 |
| Q17686925 | 巽宇宙 | Uchū Tatsumi |  | 430 |  | 1972 |
| Q18349579 | 菅野浩之 | Hiroyuki Kanno |  | 10871 | 86208-hiroyuki-kanno | 1969 |
| Q18353212 |  | Kyuhei Ueno |  | 1183 | 9728-kyuhei-ueno-mikage | 1971 |
| Q18383496 | 北田俊亮 | Toshiaki Kitada |  | 20561 |  | 1980 |
| Q18387703 |  | Takenori Ito |  | 1239 |  | 1993 |
| Q18390508 | スーパーライダー | Yuichi Watanabe | 渡部優一|仮面シューター・スーパーライダー|仮面シューター・スーパー・ライダー|ホッパー・キング|“仮面シューター”スーパー・ライダー | 8794 |  | 1962 |
| Q18390562 | 富士豊 | Yutaka Fuji |  | 10870 |  |  |
| Q18392990 | 小楠健志 | Kenji Ogusu | おぐすけんじ | 11112 | 109159-kenji-ogusu | 1971 |
| Q18545794 | 越智晴雄 | Haruo Ochi |  | 29147 |  | 1984 |
| Q18545803 | 金山亜莉紗 | Arisa Kanayama |  | 390313 |  | 1994 |
| Q18683761 |  | Kazuya Abe |  | 1279 | 9638-kazuya-abe-abkz | 1975 |
| Q18686228 | 藤崎聡 | Satoshi Fujisaki |  | 1242 | 9640-satoshi-fujisaki | 1974 |
| Q18686231 |  | Masato Fujiwara |  | 1222 |  | 1976 |
| Q18687926 | 井上和浩 | Kazuhiro Inoue |  | 1319 |  | 1973 |
| Q18687947 | 石川誠 | Makoto Ishikawa |  | 1277 | 5661-makoto-ishikawa | 1974 |
| Q18817645 | シバター | Shibatar | 齋藤光 | 78906 |  | 1985 |
| Q18817670 | 潤鎮魂歌 | Jun Requiem | 中村潤 | 79395 |  | 1984 |
| Q19364555 |  | Hiroki Kotani |  | 1245 | 3246-hiroki-kotani | 1971 |
| Q19364594 | 桜井隆多 | Ryuta Sakurai |  | 1270 | ryuta-sakurai | 1971 |
| Q19560557 | ジオ大森 | Geo Omori |  |  |  | 1898 |
| Q19561045 |  | Jun Kitagawa |  | 1260 |  | 1973 |
| Q19577433 |  | Masaki Nishizawa |  | 1268 |  | 1972 |
| Q19578015 |  | Kazumichi Takada |  | 1254 | 3497-kazumichi-takada | 1977 |
| Q19578017 | 高橋大児 | Daiji Takahashi |  | 1321 |  | 1977 |
| Q19578134 | 鶴屋浩 | Hiroshi Tsuruya |  | 1259 |  | 1970 |
| Q19578371 |  | Jinzaburo Yonezawa |  | 1284 |  | 1977 |
| Q19666844 | 小島弘之 | Hiroyuki Kojima |  | 1218 |  | 1975 |
| Q19666958 |  | Masato Suzuki |  | 1185 |  |  |
| Q19668591 |  | Kimihito Nonaka |  | 1199 | 2289-kimihito-nonaka | 1968 |
| Q20011567 | 松田干城 | Tateki Matsuda |  | 45607 |  | 1986 |
| Q20038580 | 安西信昌 | Shinsho Anzai |  | 47183 |  | 1985 |
| Q2069759 | 石井慧 | Satoshi Ishii | 石井彗 | 41887 | satoshi-ishii | 1986 |
| Q2073061 | 長島☆自演乙☆雄一郎 | Yuichiro Nagashima | 長島雄一郎|長島自演乙雄一郎|長島自演乙雄一朗 | 19340 |  | 1984 |
| Q20736459 |  | Hiroshi Umemura |  | 1308 |  | 1972 |
| Q20744802 | レッツ豪太 | Gota Yamashita | 山下豪太 | 62831 | 24160-gota-yamashita-lets-gota | 1989 |
| Q2080446 | 船木誠勝 | Masakatsu Funaki | 船木優治 | 671 |  | 1969 |
| Q2086223 | 藤田和之 | Kazuyuki Fujita |  | 315 | egidijus-valavicius | 1970 |
| Q2090890 | 近藤有己 | Yuki Kondo | 近藤 有|こんどう ゆうき | 263 | yuki-kondo | 1975 |
| Q21621538 | 石原夜叉坊 | Teruto Ishihara |  | 78898 |  | 1991 |
| Q21642647 | 加藤久輝 | Hisaki Kato |  | 125695 |  | 1982 |
| Q21700871 | 長倉立尚 | Tatsunao Nagakura | 長倉 立尚 | 41776 |  | 1984 |
| Q22119284 | 高森啓吾 | Keigo Takamori |  | 8583 |  | 1976 |
| Q22124707 | 宮崎直人 | Naoto Miyazaki |  | 30991 |  | 1983 |
| Q22124860 | MAX宮沢 | MAX Miyazawa |  | 4680 |  | 1971 |
| Q22124940 | 松本崇寿 | Takatoshi Matsumoto |  | 68682 |  | 1991 |
| Q22124960 | 松本天心 | Tenshin Matsumoto |  | 5908 |  | 1968 |
| Q22127042 | タケシマケンヂ | Kenji Takeshima |  |  |  | 1987 |
| Q22127407 | 岡田剛史 | Tsuyoshi Okada |  | 2359 |  | 1979 |
| Q22127911 | 平安孝行 | Takayuki Hirayasu |  | 18889 |  | 1980 |
| Q22128085 | 奥田啓介 | Keisuke Okuda |  | 213277 |  | 1991 |
| Q22128369 | 齊藤曜 | Yo Saito |  | 47931 |  | 1985 |
| Q22129903 | 篠宮敏久 | Toshihisa Shinomiya |  | 77347 |  |  |
| Q22131111 | 加賀谷大 | Hiroshi Kagaya |  | 77344 |  | 1985 |
| Q2271450 | 戦闘竜 | Sentoryū Henri | ヘンリー・アームストロング・ミラー|戦闘竜扁利|戦闘竜広光|ヘンリー・ミラー | 10217 |  | 1969 |
| Q2295056 | 吉田秀彦 | Hidehiko Yoshida |  | 5920 | hidehiko-yoshida | 1969 |
| Q22973417 | SARAMI | Satomi Takano |  | 93835 | 29938-satomi-takano | 1990 |
| Q2370844 | 緒方亜香里 | Akari Ogata |  | 415723 | 362906-akari-ogata | 1990 |
| Q23779749 | ジェイク・リー | Jake Lee |  | 130511 |  | 1989 |
| Q24283701 | 華 DATE | Hana DATE |  | 207261 |  | 1997 |
| Q24340629 | 里奈 | Rina | 法DATE|法 Date|NØRI | 207259 |  | 1998 |
| Q24859925 | 阿部貴広 | Takahiro Abe |  | 155707 |  | 1980 |
| Q24875170 | 五十嵐涼亮 | Ryosuke Igarashi |  | 220089 |  | 1993 |
| Q24875305 | 与国秀行 | Hideyuki Yokuni | 谷山秀行 | 31192 |  | 1976 |
| Q24876909 | 中村憲輔 | Kensuke Nakamura |  | 61951 |  | 1981 |
| Q24896955 | 山本裕次郎 | Yujiro Yamamoto |  | 25572 |  | 1978 |
| Q24897434 | 山崎悠輝 | Yuki Yamasaki |  | 113189 |  | 1992 |
| Q2525256 | 五味隆典 | Takanori Gomi |  | 425 | takanori-gomi-the-fireball-kid | 1978 |
| Q25266077 | 樋口黎 | Rei Higuchi |  |  | 563572-rei-higuchi | 1996 |
| Q25266091 | KAREN | Karen Date | 華蓮DATE | 225469 |  | 2003 |
| Q2605547 | 川尻達也 | Tatsuya Kawajiri | クラッシャー, | 1326 | tatsuya-kawajiri-crusher | 1978 |
| Q262690 | 水野竜也 | Tatsuya Mizuno |  | 18538 |  | 1981 |
| Q2699043 | 三崎和雄 | Kazuo Misaki |  | 1829 |  | 1976 |
| Q2703841 | 岡見勇信 | Yushin Okami |  | 5569 | yushin-okami-thunder | 1981 |
| Q27917440 | 蓮實光 | Hikaru Hasumi |  | 76194 |  | 1986 |
| Q27921254 | 貴源治賢 | Takagenji Satoshi |  | 402617 |  | 1997 |
| Q28069011 | 渡辺良知 | Yoshitomo Watanabe |  | 19226 |  | 1985 |
| Q28069164 | 増田裕介 | Yusuke Masuda |  | 12925 |  | 1980 |
| Q280763 | 藪下めぐみ | Megumi Yabushita |  | 5095 |  | 1972 |
| Q28687318 | 永江真也 | Shinya Nagae |  | 112219 |  | 1984 |
| Q289786 | 風香 | Fūka Kakimoto | 柿本風香 | 14525 |  | 1984 |
| Q3025614 | 永田裕志 | Yuji Nagata |  | 3422 | 2032-yuji-nagata | 1968 |
| Q3082436 | 宮田和幸 | Kazuyuki Miyata |  | 11707 |  | 1976 |
| Q30922488 | 藤田雅幸 | Masayuki Fujita |  | 157869 |  | 1975 |
| Q30927056 | 直DATE | Nao DATE |  | 209337 |  | 1997 |
| Q30931873 | 兼平大介 | Daisuke Kanehira |  | 64836 |  | 1984 |
| Q3098857 | 桜井速人 | Hayato Sakurai | 桜井マッハ速人|桜井"マッハ"速人 | 432 | hayato-sakurai-mach | 1975 |
| Q3098906 | ミノワマン | Ikuhisa Minowa | 美濃輪育久 | 250 |  | 1976 |
| Q3108267 | 泉浩 | Hiroshi Izumi |  | 52100 |  | 1982 |
| Q3136380 | 横井宏考 | Hirotaka Yokoi |  | 1334 |  | 1978 |
| Q3174577 | 中村和裕 | Kazuhiro Nakamura |  | 6943 |  | 1979 |
| Q323675 | 北尾光司 | Kōji Kitao | 双羽黒光司|双羽黒|北尾光覇 | 134 |  | 1963 |
| Q3242787 | 中井りん | Rin Nakai |  | 18887 | rin-nakai | 1986 |
| Q3275696 | 高山善廣 | Yoshihiro Takayama | 髙山善廣|髙山善広|高山善広 | 2209 |  | 1966 |
| Q3291394 | 高阪剛 | Tsuyoshi Kosaka |  | 190 | tsuyoshi-kosaka-tk | 1970 |
| Q3343678 | 山本徳郁 | Norifumi Yamamoto | 額少年|GAKUS|山本KID徳郁|山本“KID”徳郁|山本"KID"徳郁 | 1354 | norifumi-yamamoto-kid | 1977 |
| Q3453178 | 佐藤ルミナ | Rumina Sato |  | 421 |  | 1973 |
| Q3514206 | 杉浦貴 | Takashi Sugiura |  | 4837 |  | 1970 |
| Q3544327 | 桜庭あつこ | Atsuko Sakuraba | 櫻庭あつこ | 5098 |  | 1976 |
| Q3544655 | 坂井澄江 | Sumie Sakai |  | 19412 |  | 1971 |
| Q3573150 | 中井祐樹 | Yuki Nakai | 中井裕樹 | 429 |  | 1970 |
| Q3783656 | 日沖発 | Hatsu Hioki |  | 5466 |  | 1983 |
| Q378715 | 大沢ケンジ | Kenji Osawa |  | 6961 | kenji-osawa | 1976 |
| Q379021 | 石田光洋 | Mitsuhiro Ishida |  | 2225 |  | 1978 |
| Q38276105 | 風田陣 | Jin Kazeta |  | 3485 |  | 1971 |
| Q38277024 | サイレンサー | Silencer |  | 1790 |  | 1981 |
| Q38277033 | KINGレイナ | KING Reina |  | 209339 |  | 1996 |
| Q3874914 | 永田克彦 | Katsuhiko Nagata |  | 14811 |  | 1973 |
| Q3885314 | 垣原賢人 | Masahito Kakihara | ミヤマ仮面|ミヤマ☆仮面 | 11464 |  | 1972 |
| Q4057557 | 東孝 | Takashi Azuma |  |  |  | 1949 |
| Q41152 | 曙太郎 | Akebono Tarō | モンスターボノ|モンスター・ボノ|チャド・ローウェン・ジョージ・ハヘオ|グレート・ボノ|曙 | 11899 |  | 1969 |
| Q4120094 | 高瀬大樹 | Daiju Takase |  | 226 |  | 1978 |
| Q41693266 | 仙三 | Senzo Ikeda |  | 88753 |  | 1982 |
| Q42171690 | 武尊 | Takeru Segawa | 世川武尊 | 432093 |  | 1991 |
| Q4220449 | 菊地昭 | Akira Kikuchi |  | 3483 | 2348-akira-kikuchi | 1978 |
| Q42302288 | 那須川天心 | Tenshin Nasukawa |  | 241529 | 146669-tenshin-nasukawa | 1998 |
| Q43424936 | 論田愛空隆 | Akuri Ronda |  | 116747 |  | 1989 |
| Q4352443 | 廣田瑞人 | Mizuto Hirota |  | 12078 |  | 1981 |
| Q45207 | アントニオ猪木 | Antonio Inoki | 猪木寛至|猪木事務所|燃える闘魂|リトル・トーキョー・トム|モハメッド・フセイン|ミスター・カジモト|カンジ・イノキ|イノキ・ペールワン |  |  | 1943 |
| Q45819137 | 河名真寿斗 | Masuto Kawana |  | 387670 |  | 1995 |
| Q45819258 | 渡辺華奈 | Kana Watanabe | 渡辺 華奈 | 265441 | 168540-kana-watanabe | 1988 |
| Q461065 | 藤井惠 | Megumi Fujii | 秒殺女王|Mega Megu | 11512 |  | 1974 |
| Q4673000 | アレクサンダー大塚 | Alexander Otsuka | 大塚崇 | 5 | alexander-otsuka-the-diet-butcher | 1971 |
| Q4700906 | 安達明彦 | Akihiko Adachi |  | 2229 | 45686-akihiko-adachi | 1965 |
| Q4700928 | 郷野聡寛 | Akihiro Gono | DJ GOZMA | 1217 |  | 1974 |
| Q4701157 | 前田日明 | Akira Maeda | 前田明 | 5022 |  | 1959 |
| Q4701184 | 小路晃 | Akira Shoji |  | 10 | akira-shoji | 1974 |
| Q4701246 | 田村彰敏 | Akitoshi Tamura |  | 1365 | akitoshi-tamura-ironman | 1980 |
| Q4701279 | 西浦聡生 | Akiyo Nishiura | 西浦"ウィッキー"聡生|ウィッキー聡生 | 13085 |  | 1983 |
| Q47465007 | 藤田大和 | Yamato Fujita |  | 263877 |  | 1992 |
| Q47465008 | 浅倉カンナ | Kanna Asakura |  | 176903 | 79993-kanna-asakura | 1997 |
| Q4803483 | 小寺麻美 | Asami Kodera |  | 7087 |  | 1978 |
| Q484409 | 金泰泳 | Taiei Kin |  | 17381 |  | 1970 |
| Q4845534 | 瀧本誠 | Makoto Takimoto |  | 11814 | makoto-takimoto | 1974 |
| Q487335 | 秋山成勲 | Yoshihiro Akiyama | 秋成勲|チュ・ソンフン | 11895 | yoshihiro-akiyama-sexyama | 1975 |
| Q48749327 | 井土徹也 | Tetsuya Izuchi |  | 414644 |  | 2000 |
| Q4935436 | ボビー・オロゴン | Bobby Ologun | 近田ボビー|近田 ボビー|ボビーオロゴン|ジョイ・オロゴン|カリム・アルハジ・オロゴン | 11894 |  | 1966 |
| Q50641980 | 渋谷莉孔 | Riku Shibuya |  | 40488 |  | 1985 |
| Q510989 | 田村一聖 | Issei Tamura |  | 34371 |  | 1984 |
| Q5154955 | 山本喧一 | Kenichi Yamamoto | 山本健一 | 236 | kenichi-yamamoto | 1976 |
| Q5209148 | 松井大二郎 | Daijiro Matsui | 松井駿介 | 318 |  | 1972 |
| Q5209170 | DJ.taiki | Daiki Hata | 畑大樹 | 12315 |  | 1982 |
| Q5288771 | 三島☆ド根性ノ助 | Dokonjonosuke Mishima |  | 1170 | dokonjonosuke-mishima | 1972 |
| Q5349218 | 光岡映二 | Eiji Mitsuoka | 光岡エイジ | 2235 |  | 1976 |
| Q5371059 | 藤野恵実 | Emi Fujino |  | 10006 | emi-fujino | 1980 |
| Q5371137 | 風神ライカ | Emiko Raika | 来家恵美子|ライカ (ボクサー) | 176295 |  | 1975 |
| Q5371429 | 柳澤龍志 | Ryūshi Yanagisawa | 柳沢龍志 | 668 |  | 1972 |
| Q53764824 | 黒部三奈 | Mina Kurobe |  | 119851 |  | 1977 |
| Q542566 | 黒田エミ | Emi Kuroda | 秋本美鈴 | 13733 |  | 1978 |
| Q54293170 | 川村虹花 | Nanaka Kawamura |  | 270241 |  | 1995 |
| Q54867705 | 内藤のび太 | Yoshitaka Naito |  | 110387 |  | 1984 |
| Q55406545 | 青野ひかる | Hikaru Aono |  | 265437 |  | 1993 |
| Q55524466 | NavE | NavE |  | 115505 |  | 1990 |
| Q55536786 | 長谷川賢 | Ken Hasegawa |  | 76908 |  | 1987 |
| Q5558394 | ジャイアント落合 | Giant Ochiai |  | 322 |  | 1973 |
| Q56345927 | 山崎桃子 | Momoko Yamazaki |  | 253953 |  | 1992 |
| Q56354137 | 松本光史 | Kōshi Matsumoto |  | 42341 |  | 1983 |
| Q5639983 | 大原はじめ | Hajime Ohara | レイ大原 | 17919 |  | 1984 |
| Q5686120 | 碓氷早矢手 | Hayate Usui | 碓氷ハヤテ | 6783 |  | 1971 |
| Q5752381 | 門脇英基 | Hideki Kadowaki |  | 1345 |  | 1976 |
| Q5752709 | 門馬秀貴 | Hidetaka Monma |  | 2278 |  | 1973 |
| Q5760445 | 佐藤光留 | Hikaru Sato |  | 1716 |  | 1980 |
| Q5770376 | 北村ヒロコ | Hiroko Kitamura |  | 45331 |  | 1972 |
| Q5770440 | HIROKO | Hiroko Yamanaka | 山中裕子 | 20271 | hiroko-yamanaka | 1978 |
| Q5770599 | 金原弘光 | Hiromitsu Kanehara |  | 1441 |  | 1970 |
| Q5770605 | 三浦広光 | Hiromitsu Miura |  | 10971 |  | 1981 |
| Q5771472 | 阿部裕幸 | Hiroyuki Abe |  | 1293 |  | 1970 |
| Q5771594 | 高谷裕之 | Hiroyuki Takaya | 髙谷裕之 | 6782 | hiroyuki-takaya-streetfight-bancho | 1977 |
| Q5772256 | 渡辺久江 | Hisae Watanabe | 渡邊久江 | 6984 |  | 1980 |
| Q5872201 | 赤野仁美 | Hitomi Akano | 平岩仁美 | 11994 | hitomi-akano-girlfight-monster | 1974 |
| Q59135060 | 海人 | Kaito Ono |  |  |  | 1997 |
| Q59552216 | 大森北斗 | Hokuto Omori |  |  |  | 1995 |
| Q5965720 | 朱里 | Syuri | 近藤朱里 | 216929 | 128154-syuri-kondo | 1989 |
| Q5971139 | 川口雄介 | Yusuke Kawaguchi |  | 21975 | yusuke-kawaguchi | 1980 |
| Q61057310 | 小金翔 | Sho Kogane |  | 85904 |  | 1987 |
| Q6148257 | YAMATO | Masato Onodera | 小野寺大和 |  |  | 1981 |
| Q62018825 | パンチィー山内 | Panchii Yamauchi |  | 21038 |  | 1981 |
| Q62085277 | 杉山和史 | Katzushi Sugiyama |  | 4495 |  | 1976 |
| Q62085285 | 奥山貴大 | Takahiro Okuyama |  | 467504 |  | 1994 |
| Q62085384 | 下石康太 | Kota Shimoishi |  | 45947 |  | 1987 |
| Q62601649 | 奈部ゆかり | Yukari Nabe |  | 228623 |  | 1987 |
| Q63131335 | 福島秀和 | Hidekazu Fukushima |  | 62834 |  | 1984 |
| Q6313766 | 生駒純司 | Junji Ikoma |  | 2223 |  | 1970 |
| Q6314410 | KODO | Junya Kodo | 小堂準也 | 19376 |  | 1983 |
| Q6318684 | 中尾受太郎 | Jutaro Nakao |  | 438 |  | 1970 |
| Q6378095 | 藤井克久 | Katsuhisa Fujii | 藤井軍鶏侍|藤井勝久 | 234 | katsuhisa-fujii-shamoji | 1972 |
| Q6378220 | 井上克也 | Katsuya Inoue |  | 6940 |  | 1979 |
| Q6378241 | 柴田勝頼 | Katsuyori Shibata | 魔界4号 | 10434 |  | 1979 |
| Q6381456 | 浜中和宏 | Kazuhiro Hamanaka |  | 7684 |  | 1978 |
| Q6381485 | 渡邉一久 | Kazuhisa Watanabe | 渡邊一久 | 74595 |  | 1983 |
| Q6381619 | 横田一則 | Kazunori Yokota |  | 11335 |  | 1978 |
| Q6381671 | 高橋義生 | Kazuo Takahashi | 高橋“人喰い”義生|高橋和生|人喰い義生 | 153 |  | 1969 |
| Q6381685 | 山崎一夫 | Kazuo Yamazaki |  |  |  | 1962 |
| Q6383637 | 山宮恵一郎 | Keiichirō Yamamiya | KEI山宮 | 237 |  | 1972 |
| Q6383697 | たま☆ちゃん | Keiko Tamai | 玉井敬子 | 10702 |  | 1982 |
| Q6383882 | 藤原敬典 | Keisuke Fujiwara |  | 22680 |  | 1982 |
| Q6383921 | 中村K太郎 | Keita Nakamura |  | 9572 | keita-nakamura-k-taro | 1984 |
| Q6388985 | ケンドー・カシン | Kendo Kashin | 石澤常光|ケンドー・カ・シン | 329 |  | 1968 |
| Q6389247 | 緒形健一 | Kenichi Ogata | 緒方健一|尾形健一 | 2597 |  | 1975 |
| Q6405567 | 佐野巧真 | Naoki Sano | 佐野直喜|佐野友飛|佐野なおき | 295 |  | 1965 |
| Q6406441 | 石川菊代 | Kikuyo Ishikawa |  | 40760 |  | 1984 |
| Q6418717 | 國奥麒樹真 | Kiuma Kunioku |  | 864 |  | 1976 |
| Q6419127 | 田村潔司 | Kiyoshi Tamura | 田村潔 | 1451 |  | 1969 |
| Q6419152 | 清水清隆 | Kiyotaka Shimizu |  | 31882 |  | 1984 |
| Q6425967 | 佐藤耕平 | Kohei Sato |  | 1289 |  | 1977 |
| Q64784071 | 石川健太郎 | Kentaro Ishikawa |  |  |  | 1978 |
| Q65265424 | 岡野裕城 | Yūki Okano |  | 58925 |  | 1986 |
| Q65273488 | 猿田洋祐 | Yosuke Saruta |  | 28145 |  | 1987 |
| Q65275978 | 石橋佳大 | Keita Ishibashi |  | 51273 |  | 1986 |
| Q6535130 | キック | Kick | KICK☆ |  |  | 1979 |
| Q66480257 | 渡慶次幸平 | Kōhei Tokeshi | とけし こうへい | 74283 |  | 1988 |
| Q6735143 | 市井舞 | Mai Ichii |  | 20272 |  | 1980 |
| Q6746572 | 中西学 | Manabu Nakanishi | 明石家学 | 7515 |  | 1967 |
| Q6760911 | 金子真理 | Mari Kaneko |  | 6972 |  | 1972 |
| Q6782438 | 今成正和 | Masakazu Imanari | 足関十段 | 4862 | masakazu-imanari-ashikan-judan | 1976 |
| Q6782587 | 金原正徳 | Masanori Kanehara |  | 13767 | masanori-kanehara | 1982 |
| Q6782803 | 河野真幸 | Masayuki Kono |  | 13368 |  | 1980 |
| Q6782807 | 成瀬昌由 | Masayuki Naruse |  | 1529 |  | 1973 |
| Q6809947 | V.V Mei | Mei Yamaguchi | 山口芽生|V一 | 21461 | 12035-mei-yamaguchi-v-hajime | 1983 |
| Q6837866 | 小見川道大 | Michihiro Omigawa |  | 13005 | michihiro-omigawa | 1975 |
| Q6845539 | 長野美香 | Mika Nagano |  | 27106 | 10099-mika-nagano-future-princess | 1983 |
| Q6850242 | MIKU | Miku Matsumoto |  | 11195 |  | 1981 |
| Q6884821 | 魅津希 | Mizuki Inoue | 井上瑞樹 | 71390 | 25717-mizuki-inoue | 1994 |
| Q6935945 | 澤宗紀 | Munenori Sawa | ランジェリー武藤 | 19207 |  | 1979 |
| Q6959305 | 杉山直歩 | Naho Sugiyama | スギロック | 52522 | 15603-naho-sugiyama-sugi-rock | 1978 |
| Q6964771 | 小谷直之 | Naoyuki Kotani |  | 393 |  | 1981 |
| Q7046040 | 朝日昇 | Noboru Asahi | 朝日愼一 | 439 |  | 1968 |
| Q7046077 | 田原しんぺー | Noboru Tahara |  | 15244 |  | 1983 |
| Q71984 | 上田将勝 | Masakatsu Ueda |  | 14522 | masakatsu-ueda | 1977 |
| Q7334037 | 福田力 | Riki Fukuda |  | 10229 |  | 1981 |
| Q7385254 | 川村亮 | Ryo Kawamura |  | 13514 |  | 1981 |
| Q7385501 | 村田龍一 | Ryuichi Murata |  | 13413 | ryuichi-murata | 1976 |
| Q7385531 | 上山龍紀 | Ryuki Ueyama | うえやま りゅうき | 1479 |  | 1976 |
| Q7403168 | 能村さくら | Sakura Nomura |  | 61634 |  | 1976 |
| Q7415460 | 菊田早苗 | Sanae Kikuta |  | 252 |  | 1971 |
| Q7420869 | 石岡沙織 | Saori Ishioka |  | 21463 | 4162-saori-ishioka-shooting-star | 1987 |
| Q7426351 | しなしさとこ | Satoko Shinashi |  | 6974 |  | 1977 |
| Q7426402 | 本間聡 | Satoshi Honma |  | 251 |  | 1968 |
| Q7446613 | 池本誠知 | Seichi Ikemoto |  | 1315 |  | 1975 |
| Q7446684 | 井上誠午 | Seigo Inoue |  | 24230 |  | 1986 |
| Q7477629 | 中尾芳広 | Yoshihiro Nakao |  | 9397 |  | 1972 |
| Q7496341 | 大澤茂樹 | Shigeki Osawa |  | 44501 |  | 1986 |
| Q7497516 | 小島伸一 | Shinichi Kojima |  | 8669 |  | 1979 |
| Q7497713 | 神取忍 | Shinobu Kandori | 神取しのぶ | 19313 | 21616-shinobu-kandori | 1964 |
| Q7497781 | 石渡伸太郎 | Shintaro Ishiwatari |  | 15245 | shintaro-ishiwatari | 1985 |
| Q7499482 | 杉山しずか | Shizuka Sugiyama |  | 40759 |  | 1987 |
| Q7505055 | 大山峻護 | Shungo Oyama | おおやま しゅんご | 335 | shungo-oyama | 1974 |
| Q7674340 | 安田忠夫 | Tadao Yasuda | 富士の森忠雄|富士の森|孝乃富士忠雄|孝乃富士 | 584 |  | 1963 |
| Q7676422 | 小比類巻貴之 | Takayuki Kohiruimaki | 小比類巻太信|こひるいまき たかゆき|こひるいまき たいしん | 92397 |  | 1977 |
| Q7676451 | 奥野泰舗 | Taisuke Okuno | 奥野"轟天"泰舗 | 13389 |  | 1977 |
| Q7677355 | 中蔵隆志 | Takashi Nakakura |  | 5369 |  | 1977 |
| Q7678038 | 佐藤豪則 | Takenori Sato |  | 12196 |  | 1985 |
| Q7678115 | リオン武 | Takeshi Inoue | 井上武 | 7718 |  | 1980 |
| Q7678183 | 水垣偉弥 | Takeya Mizugaki |  | 12074 | takeya-mizugaki | 1983 |
| Q7678583 | 中山巧 | Takumi Nakayama | タクミ, | 1325 |  | 1973 |
| Q7706865 | 加藤鉄史 | Tetsuji Kato |  | 423 | tetsuji-kato | 1977 |
| Q7820181 | WINDY智美 | Windy Tomomi | 風智美|ウィンディ智美 | 6999 |  | 1976 |
| Q7827434 | 矢野通 | Toru Yano |  | 8317 |  | 1978 |
| Q7960773 | 鈴川真一 | Wakakirin Shinichi | 若麒麟真一|若麒麟 | 74753 |  | 1983 |
| Q7960843 | 馬場口洋一 | Wakashoyo Shunichi | 若翔洋俊一|若翔洋|WAKASYOYO|WAKASHOYO | 13345 |  | 1966 |
| Q7973015 | 坂田亘 | Wataru Sakata | ナットーマン | 1447 |  | 1973 |
| Q79815670 | 江畑秀範 | Hidenori Ebata |  | 422632 |  | 1992 |
| Q8012929 | 西島洋介 | Yōsuke Nishijima | 陽海山|西島洋介山 | 14884 |  | 1973 |
| Q8049996 | 漆谷康宏 | Yasuhiro Urushitani |  | 1349 |  | 1976 |
| Q8050001 | 滑川康仁 | Yasuhito Namekawa |  | 1462 |  | 1974 |
| Q8050031 | 玉田育子 | Yasuko Tamada |  | 14054 | 11914-yasuko-tamada-ikuko | 1967 |
| Q8054530 | 安生洋二 | Yoji Anjo | アン・ジョー司令長官 | 182 |  | 1967 |
| Q8054590 | 高橋洋子 | Yoko Takahashi |  | 1992 |  | 1973 |
| Q8054598 | 山田よう子 | Yoko Yamada |  | 7230 |  | 1979 |
| Q8055988 | 谷津嘉章 | Yoshiaki Yatsu | 津谷章嘉 | 326 |  | 1956 |
| Q8056079 | 山本宜久 | Yoshihisa Yamamoto | 山本憲尚 | 454 |  | 1970 |
| Q8056267 | 前田吉朗 | Yoshiro Maeda |  | 6887 | yoshiro-maeda | 1981 |
| Q8056339 | 吉田善行 | Yoshiyuki Yoshida |  | 12073 |  | 1974 |
| Q8060542 | KUSHIDA | Kushida | 櫛田雄二郎 | 8916 |  | 1983 |
| Q8060566 | 辻結花 | Yuka Tsuji |  | 6983 |  | 1974 |
| Q8060656 | 佐々木有生 | Yuki Sasaki |  | 1255 |  | 1976 |
| Q8060664 | 正城ユウキ | Yuki Shoujou |  | 9577 |  | 1980 |
| Q8060747 | 坂口征夫 | Yukio Sakaguchi | 坂口 征夫 | 22195 |  | 1973 |
| Q8061123 | 堀田祐美子 | Yumiko Hotta |  | 5968 |  | 1967 |
| Q8062130 | 久保田有希 | Yuuki Kondo | 近藤有希 | 5107 |  | 1974 |
| Q8062231 | 白井祐矢 | Yuya Shirai |  | 9532 |  | 1980 |
| Q81031257 | 前澤智 | Tomo Maesawa |  | 111831 | 34242-tomo-maesawa | 1987 |
| Q81783513 | 堤聖也 | Seiya Tsutsumi |  |  | 241478-seiya-tsutsumi | 1995 |
| Q8190488 | 村上和成 | Kazunari Murakami | 村上一成|ビッグ村上 | 288 |  | 1973 |
| Q83207060 | マドレーヌ |  |  |  |  |  |
| Q84580949 | あい | Ai |  | 237929 |  | 1989 |
| Q959636 | 中嶋勝彦 | Katsuhiko Nakajima |  | 8325 |  | 1988 |
| Q97031503 | 岩﨑正寛 |  |  | 54677 |  |  |
| Q98758004 | 出花崇太郎 |  |  | 261245 |  |  |

---

## ⑧ 参考: 集めたデータ・スクリプトの所在

- `out/wikidata-jp-fighters.csv` — 層1全件(751行、alt_ja列を含む)
- `out/wikidata-missing-match.csv` — 層2全行(523行)
- `out/wikidata-only-candidates.csv` — W1-6全行(640行)
- `out/wdqs-cache/*.json` — WDQSクエリの生レスポンス全キャッシュ(2回実行して3つのCSV全てが同一になることを確認済み)
- `out/wdqs-cache/*.rq` — 層1CSV生成に使ったバッチクエリ本文(VALUES句で751 QIDを150件ずつ6バッチに分割)
- `out/pr208-input/*.csv` — PR #208 `out/` から取得した一次情報(無加工のコピー)
- `scripts/audit-wikidata-coverage.ts` — 層1・層2・W1-6を再生成する再実行可能スクリプト(FIGHTERSをsrc/lib/fighters.tsから読み取りimportするのみ。書き込みはout/配下のみ)
- `scripts/_wdqs_run.sh` / `scripts/_wdqs_run_file.sh` — WDQSへのクエリ発行に使った補助スクリプト(User-Agent明示・GET/POST)

## 推奨や優先度づけ

本レポートには含めない(指示書の指定通り)。


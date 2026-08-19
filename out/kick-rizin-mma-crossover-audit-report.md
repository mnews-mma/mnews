# 立ち技名鑑：RIZIN/DEEP系大会での他競技(MMA)混入監査

## 発端

朝倉未来のページに RIZIN LANDMARK 5（2023-04-29 vs 牛久絢太郎）と RIZIN LANDMARK vol.1
（2021-10-02 vs 萩原京平）の2件が収録されていた。両方MMA。過去のPR #543(6cf0c6a)で朝倉未来の
MMA3件(斎藤裕/クレベル/ケラモフ、いずれもRIZIN本編ナンバリング大会)は除外済みだったが、この2件は
RIZIN LANDMARK(RIZINのキックボクシングブランド)側の大会だったため見落とされていた。

## 混入経路の特定

PR-8(#543)の除外対象抽出は `out/pr8-census/crossover-suspects-all28.tsv` という
**methodRawの寝技/サブミッション語彙(アームバー・チョーク等)を含む行のみを機械抽出**する
キーワードベースの手法で作られていた。朝倉未来のLANDMARK5・vol.1はいずれも決着が「3R 判定」
(判定)で、寝技/サブミッション語彙を一切含まないため、この抽出網に掛からなかった。

その後の「候補7名」個別確認もWikipedia本文に明記された特定bout(斎藤裕/クレベル/ケラモフ)の
確認に留まり、朝倉未来がRISE公式サイト(rise-rc.com、彼のキック掲載データの出典元)に掲載する
全boutを網羅的に他団体記録と突合するところまでは行っていなかった。

**教訓**: 決着方式のキーワードだけで他競技混入を検出する手法は、判定決着のMMA bout(グラウンド
制圧からの判定勝ちなど)を構造的に見逃す。

## 監査手法

1. `data/kick/generated/fighters/*.json`(全3,300選手・32,675bout、ビルド生成物)から
   大会名をユニーク抽出 → 9,117件(`out/kick-all-events-unique.tsv`)。
2. RIZIN・LANDMARK・DEEP(DEEP☆KICKという正規の別ブランドは除外)・PANCRASE・修斗・Bellator・
   PRIDE・巌流島など、MMA/キックが併催されうる大会名パターンに一致する行を抽出 → 344件
   (`out/kick-mma-crossover-candidates.tsv`)。
3. **大会名だけで一括判定せず**、`data/rizinRecords.json`・`data/pancraseRecords.json`
   (mnewsが別途保有する構造化MMA戦績DB、`ruleType`フィールドで試合ごとにMMA/キックボクシング/
   MIXルール等を区別)と日付+選手名+対戦相手名で突合し、行単位で根拠を得た
   (`out/kick-mma-crossover-xref.tsv`)。
   - RIZINのruleType分布は実態を反映(MMA 838 / キックボクシング156 / 女子MMA7 / MIXルール3等)
     しており信頼できたが、PANCRASEのruleTypeは4,495件中4,467件が"MMA"に偏っており
     (デフォルト値に近く、headingTextの「REBELSルール」「ムエタイ」等の注記を反映していない)、
     機械的なruleType一致だけでは信用できないと判明。PANCRASE由来の一致候補は個別に
     headingTextを確認し、2件(内藤大樹×渡辺優太=ONE SUPER SERIES ムエタイ、
     鈴木宙樹×宇野高弘=REBELSルール)を誤検知として除外した。
   - 全32,675bout全件を対象に、事前の正規表現フィルタに依存しない再突合も実施(見落とし防止)。
4. RIZIN/PANCRASE構造化DBで確認できない残り(DEEP系・PRIDE系・Bellator系など、
   `promotion:"Wikipedia(その他団体)"`でRIZIN/PANCRASE以外が出典の36件)は、代表的な事例を
   Web検索で個別に一次資料確認した(PRIDE.1・PRIDE.2・PANCRASE REBELS RING.1・
   PROFESSIONAL SHOOTO 2024・DEEP JEWELS 27・Bellator 157・INOKI BOM-BA-YE×巌流島・
   巌流島バーチャルファイト・DEEP 30 IMPACT・DEEP CAGE IMPACT 2011)。全件が「大会名は
   MMA団体だが当該一戦はキックボクシング/ムエタイ/REBELSルール等の立ち技ルール」と確認でき、
   除去対象なしと判定した。promotion欄がRISE/SHOOT BOXING/Bigbang等キックボクシング団体
   公式サイト由来の行(DEEP系の残り、独立したキック団体の公式記録に載っている=その団体が
   キックボクシング戦として認識している強い状況証拠)は個別Web確認を省略した。

## 除去結果: 19行(18bout、うち1boutは両者ページに掲載があり両側を除去)

| 選手 | 日付 | 大会名 | 対戦相手 | 根拠 |
|---|---|---|---|---|
| 朝倉未来 | 2023-04-29 | RIZIN LANDMARK 5 | 牛久絢太郎 | rizinRecords ruleType:MMA |
| 朝倉未来 | 2021-10-02 | RIZIN LANDMARK vol.1 | 萩原京平 | rizinRecords ruleType:MMA |
| 那須川天心 | 2017-04-16 | RIZIN.5 (YOKOHAMA -SAKURA-) | フランチェスコ・ギリオッティ | ruleType:MMA |
| 那須川天心 | 2017-07-30 | RIZIN.6 (バンタム級T 1st ROUND 夏の陣) | 才賀紀左衛門 | ruleType:MIXルール |
| 白川陸斗 | 2020-11-21 | RIZIN.25 | 朴 光哲 | ruleType:MMA、決着「サッカーボールキック」 |
| 白川陸斗 | 2021-06-27 | RIZIN.29 | 青井 人 | ruleType:MMA |
| 白川陸斗 | 2021-10-24 | RIZIN.31 | 山本琢也 | ruleType:MMA、決着「グラウンドキック」 |
| 白川陸斗 | 2023-09-24 | RIZIN.44 | 中原由貴 | ruleType:MMA |
| YA-MAN | 2023-05-06 | RIZIN.42 | 三浦孝太 | ruleType:MMA、決着「グラウンドパンチ」 |
| YA-MAN | 2023-12-31 | RIZIN.45(にゃんこ大戦争presents) | 平本蓮 | ruleType:MMA(平本蓮は総合格闘家) |
| YA-MAN | 2024-07-28 | 超RIZIN.3 | 鈴木博昭 | ruleType:MMA |
| 西谷大成 | 2023-06-24 | RIZIN.43 | 鈴木博昭 | ruleType:MMA、決着「グラウンドパンチ」 |
| "ブラックパンサー"ベイノア | 2021-06-13 | RIZIN.28 | 弥益ドミネーター聡志 | ruleType:MMA |
| "ブラックパンサー"ベイノア | 2021-11-20 | RIZIN.32 | ロクク・ダリ | ruleType:MMA |
| "ブラックパンサー"ベイノア | 2021-12-31 | RIZIN.33 | 武田光司 | ruleType:MMA、決着「アームバー」タップアウト |
| "ブラックパンサー"ベイノア | 2022-12-31 | RIZIN.40 | 宇佐美正パトリック | ruleType:MMA |
| 那須川龍心 | 2023-12-31 | RIZIN.45(にゃんこ大戦争presents) | シン・ジョンミン | ruleType:MMA、決着「グラウンドパンチ」(相手側も除去) |
| シン・ジョンミン | 2023-12-31 | RIZIN.45(にゃんこ大戦争presents) | 那須川龍心 | 同上bout、両側掲載のため両側除去 |
| モーリス・スミス | 1993-11-08 | パンクラス「YES, WE ARE HYBRID WRESTLERS」 | 鈴木みのる | pancraseRecords headingText「異種格闘技戦」(パンクラス旗揚げ当時のハイブリッドルール、純粋なキックボクシングルールではない) |

適用先: `data/kick/manualRuleExclusions.json`(既存251件 → 270件、既存の除外メカニズムに準拠)。

## 受入条件チェック

- **朝倉未来のページが「収録1試合(FIGHT CLUBのみ)」になる**: `npm run build` → `next start`
  でのローカル実機確認で確認済み(収録1試合：0勝1敗0分、FIGHT CLUB vs YA-MAN のみ)。
- **収録0試合になる選手**: 0名。今回除去対象になった9選手(朝倉未来・那須川天心・白川陸斗・
  YA-MAN・西谷大成・"ブラックパンサー"ベイノア・那須川龍心・シン・ジョンミン・モーリス・スミス)
  はいずれも除去後も1試合以上が残る(それぞれ1/46/2/21/13/23/27/1/52試合)。

## ファイル外への波及(1項目)

**ビルド時ゲート(カバレッジ測定のratchet基準)**: `check:kick-coverage-gap`
(`data/kick/kickCoverageGapBaseline.json`)は、各選手の掲載試合数を
ja.wikipedia記事の戦績表から独立再抽出した「外部基準」試合数と突き合わせ、掲載数が
外部基準を下回る選手数が増えるとビルドを止めるratchetゲート。"ブラックパンサー"ベイノアの
Wikipedia戦績表は彼のRIZIN(MMA)4戦を含む1本の合算表になっており(日本語版Wikipediaの
戦績表は競技種別を分けずに1つの表にまとめる慣習があるため)、今回MMA4戦を正しく除去した
結果、掲載数が外部基準を新たに下回る形になった(gapCount: 164→165)。これは外部基準側が
MMA試合を含んで数えていることによる副作用であり、データ欠落ではないため、baselineを165に
更新した(`npm run check:kick-coverage-gap`が自動的にokCount等の診断フィールドを再計算・
書き込み、ゲートは再度PASSすることを確認済み)。

## 検証

- `npm run kick:data`: manualExclusionCount 190→209(+19、想定と完全一致)、
  boutRows 32,675→32,656(-19)。新規の「0件マッチ」警告なし(全19件が想定通り1件ずつヒット)。
- `npm run check:kick-mma-contamination`: OK(MMA混入0件)
- `npm run check:kick-bout-count-consistency`: OK(不一致0件)
- `npm run build`(全ゲート+`next build`): 成功(exit 0)
- `next start`での実機確認: 朝倉未来・那須川天心・白川陸斗・YA-MAN・西谷大成・ベイノア・
  那須川龍心・シン・ジョンミン・モーリス・スミスの計9選手ページで掲載試合数を確認、
  全てHTTP 200・期待値と一致。

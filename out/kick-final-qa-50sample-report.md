# /kick 公開前最終検品(層化無作為50選手) 実施レポート

作成日: 2026-08(PR: `investigate/kick-final-qa-50sample`、PR #569、読み取り専用調査)

**本調査は修正を一切行わない。すべて本番URL(`https://www.mnews.jp/kick/fighters/[slug]`)を
実際にブラウザで開いて確認した(ローカルのdata/kick/generatedは読んでいない)。**

## 抽出方法

`random.seed(20260817)` を使用し、`data/kick/generated/index.json`(3,300選手)から
5カテゴリ各10人・計50人を層化無作為抽出した。カテゴリ間で選手が重複しないよう、
先に選ばれたカテゴリの選手は後続カテゴリの抽選プールから除外した。抽出スクリプトは
`scratch-sample.py`(本レポートと同時にコミット)。

- **A. Wikipedia記事あり**: `scripts/standup-pipeline/coverage_population.json`(833人)に
  表記名が含まれ、かつ `boutCount>0` の選手からランダム抽出。
- **B. Wikipedia記事なし**: 上記母集団に含まれず `boutCount>0` の選手からランダム抽出。
- **C. モノニム**: 区切り文字(空白・中黒等)を含まず、かつ4文字以下の表記名
  (PR #567の`out/kick-mononym-risk-survey.md`の実例(泰斗・大輝等、いずれも2〜3文字)に
  合わせた長さ制限。単純な「区切り文字なし」だけだと「北井智大」のような通常の氏名まで
  含んでしまうため)。
- **D. 外国人選手**: 表記名に漢字・ひらがなを一切含まない選手。
- **E. 収録試合数5戦以下**: `boutCount` が1〜5の選手。

## 50人の一覧

| # | カテゴリ | slug | 表記名 | 収録試合数 |
|---|---|---|---|---:|
| 1 | A | yoshimi | 443 | 4 |
| 2 | A | miran-peirusu | ミラン・ペイルス | 1 |
| 3 | A | iburahimu-eru-bouni | イブラヒム・エル・ボウニ | 6 |
| 4 | A | uiriamu-dinda | ウィリアム・ディンダー | 27 |
| 5 | A | ishiguro-tatsuya | 石黒竜也 | 19 |
| 6 | A | kohiruimaki-taishin | 小比類巻太信 | 62 |
| 7 | A | hayashi-kenta | 林 健太 | 42 |
| 8 | A | shimada-shouta | 嶋田翔太 | 13 |
| 9 | A | ryo-3 | 遼 | 1 |
| 10 | A | tanimoto-hiroyuki | 谷本弘行 | 2 |
| 11 | B | ashurafu-ashira | アシュラフ・アーシラ | 3 |
| 12 | B | fawado-sediki | ファワド・セディッキ | 1 |
| 13 | B | ichiyo-morimoto | 森本一陽 | 43 |
| 14 | B | hirahara-riku | 平原 陸 | 10 |
| 15 | B | katashima-satoshi | 片島 聡志 | 9 |
| 16 | B | nagai-takumi | 永井 卓海 | 3 |
| 17 | B | mizukami-haruki | 水上 陽生 | 8 |
| 18 | B | haseflyskygym | HASE・FLYSKYGYM | 1 |
| 19 | B | paburosu-kokuryariosu | パブロス・コクリャリオス | 1 |
| 20 | B | shotaro | 翔太郎 | 8 |
| 21 | C | makoto-2 | 真 | 1 |
| 22 | C | shishimaru | 獅子丸 | 8 |
| 23 | C | kuroudo | 蔵人 | 5 |
| 24 | C | koya | 光弥 | 4 |
| 25 | C | yushin | 優心 | 15 |
| 26 | C | tsubasa-2 | 大空 | 2 |
| 27 | C | yan-donshun | 楊東雄 | 1 |
| 28 | C | daiki-2 | 大輝 | 5 |
| 29 | C | kensuke | 健介 | 11 |
| 30 | C | tatsuto-2 | 龍翔 | 9 |
| 31 | D | marushio-de-jiezusu | マルシオ・デ・ジェズス | 2 |
| 32 | D | jabito-bairami | ジャビット・バイラミ | 39 |
| 33 | D | tien-shin | ティエン・シン | 1 |
| 34 | D | asa-meiya | アーサー・メイヤー | 2 |
| 35 | D | mohamedo-isuramu | モハメド・イスラム | 1 |
| 36 | D | novo | Novo | 7 |
| 37 | D | hamuza-hazaru | ハムザ・ハッザール | 3 |
| 38 | D | arekusei-kujin | アレクセイ・クジン | 54 |
| 39 | D | heruman-tabuenka | ヘルマン・タブエンカ | 1 |
| 40 | D | jien-junfen | ジェン・ジュンフェン | 1 |
| 41 | E | mafia-petomonkondi | マフィア・ペットモンコンディー | 1 |
| 42 | E | hakuto | 白虎 | 2 |
| 43 | E | din-nin | ディン・ニン | 1 |
| 44 | E | kimo-reoporudo | キモ・レオポルド | 3 |
| 45 | E | panato-kunkumeru | パナット・クンクメール | 1 |
| 46 | E | kurisutosu-miharutsuosu | クリストス・ミハルツォス | 1 |
| 47 | E | ren-tiger-reon-563 | Ren TIGER REON | 1 |
| 48 | E | lion-osafune | 長舩☆ライオン | 2 |
| 49 | E | yamaguchi-ryusei | 山口 琉聖 | 1 |
| 50 | E | ran-shanten | ラン・シャンテン | 1 |

## 致命的欠陥の有無: **1件確認(不合格に相当)**

50人中**1人**(#14 平原 陸)のページで、コーディネーターが定義した4カテゴリの1つ
「列ずれ(決着欄に相手名等が入っている)」に該当する**致命的欠陥を確認した**。
他の49人には致命的欠陥(誤統合・他競技混入・列ずれ・内部ラベル露出)は確認されなかった。

### 致命的欠陥の詳細

**選手**: `/kick/fighters/hirahara-riku`(平原 陸)
**該当行**: 2025-12-07 / KROSS×OVER.33 / 対戦相手: 酒井 柚樹(TEAM TEPPEN)
**壊れ方**: 決着(method)欄に、決着方法ではなく大会レポート記事の一節がそのまま
表示されている:

> 酒井柚樹はトーナメント初戦(HIROKAZU)と準決勝(大久保俊)戦と連続KOで決勝戦に駒を進めた。

**原因の特定**: この文字列は`src/lib/kick/data.ts`の`PROSE_METHOD_RAW`(決着欄に出すべき
でない大会レポート散文の除外リスト、6件登録済み)に**登録済みの文字列そのもの**である。
しかし登録されている文字列は全角括弧「（HIROKAZU）」「（大久保俊）」を使っているのに対し、
実際にこの選手のこの1行で使われている生データは半角括弧「(HIROKAZU)」「(大久保俊)」に
なっている。`methodLabel()`の除外判定は`PROSE_METHOD_RAW.has((raw ?? "").normalize("NFKC").trim())`
という**入力側だけをNFKC正規化**する実装になっており、**denylist(Setのリテラル文字列)側は
正規化されていない**ため、半角/全角の違いがあると一致せず除外が効かない。

この不一致は既存の除外リストの実装の穴であり、**同じ文言でも括弧の全角/半角が違う別の
出現箇所があれば同様に再発しうる**。修正は行っていない(読み取り専用調査のため)。

**受入条件への影響**: コーディネーターの受入条件「致命的欠陥1件でもあれば不合格」に照らし、
**本サンプルは不合格**。ただし致命的欠陥は50人・500件超のbout行中この1件のみで、
発生源(PROSE_METHOD_RAW denylistの正規化漏れ)も特定できているため、限定的な修正で
対応可能と考えられる。

## 選手ごとの欠陥件数一覧

| # | slug | 致命的欠陥 | 軽微な欠陥 | 備考 |
|---|---|---:|---:|---|
| 1 | yoshimi | 0 | 0 | — |
| 2 | miran-peirusu | 0 | 0 | — |
| 3 | iburahimu-eru-bouni | 0 | 0 | — |
| 4 | uiriamu-dinda | 0 | 0 | — |
| 5 | ishiguro-tatsuya | 0 | 0 | — |
| 6 | kohiruimaki-taishin | 0 | 0 | — |
| 7 | hayashi-kenta | 0 | 1 | 林京平戦が2件重複計上の疑い(下記参照) |
| 8 | shimada-shouta | 0 | 1 | 「2分 終了 判定」表記の残存(下記参照) |
| 9 | ryo-3 | 0 | 0 | — |
| 10 | tanimoto-hiroyuki | 0 | 1 | 「3分 終了 判定」表記の残存 |
| 11 | ashurafu-ashira | 0 | 0 | — |
| 12 | fawado-sediki | 0 | 0 | — |
| 13 | ichiyo-morimoto | 0 | 3 | 相手名末尾のコンマ残存/大会名末尾の全角引用符残存/決着・R欄の空欄(下記参照) |
| **14** | **hirahara-riku** | **1** | **2** | **致命的欠陥(上記)**+決着欄の括弧閉じ忘れ+note欄の途中切れ |
| 15 | katashima-satoshi | 0 | 0 | — |
| 16 | nagai-takumi | 0 | 0 | — |
| 17 | mizukami-haruki | 0 | 0 | — |
| 18 | haseflyskygym | 0 | 0 | — |
| 19 | paburosu-kokuryariosu | 0 | 0 | — |
| 20 | shotaro | 0 | 1 | 決着スコアと勝敗マーカーの不整合疑い1件(下記「追加の重要な論点」参照) |
| 21 | makoto-2 | 0 | 0 | — |
| 22 | shishimaru | 0 | 1 | 決着スコアと勝敗マーカーの不整合疑い1件 |
| 23 | kuroudo | 0 | 0 | — |
| 24 | koya | 0 | 0 | — |
| 25 | yushin | 0 | 4 | 決着スコアと勝敗マーカーの不整合疑い4件 |
| 26 | tsubasa-2 | 0 | 0 | — |
| 27 | yan-donshun | 0 | 0 | — |
| 28 | daiki-2 | 0 | 0 | — |
| 29 | kensuke | 0 | 0 | — |
| 30 | tatsuto-2 | 0 | 0 | — |
| 31 | marushio-de-jiezusu | 0 | 0 | — |
| 32 | jabito-bairami | 0 | 1 | 大会名欄が「?」のみの行が2件 |
| 33 | tien-shin | 0 | 0 | — |
| 34 | asa-meiya | 0 | 0 | — |
| 35 | mohamedo-isuramu | 0 | 0 | — |
| 36 | novo | 0 | 0 | — |
| 37 | hamuza-hazaru | 0 | 0 | — |
| 38 | arekusei-kujin | 0 | 0 | — |
| 39 | heruman-tabuenka | 0 | 0 | — |
| 40 | jien-junfen | 0 | 0 | — |
| 41 | mafia-petomonkondi | 0 | 0 | — |
| 42 | hakuto | 0 | 0 | — |
| 43 | din-nin | 0 | 0 | — |
| 44 | kimo-reoporudo | 0 | 0 | — |
| 45 | panato-kunkumeru | 0 | 0 | — |
| 46 | kurisutosu-miharutsuosu | 0 | 0 | — |
| 47 | ren-tiger-reon-563 | 0 | 0 | — |
| 48 | lion-osafune | 0 | 0 | — |
| 49 | yamaguchi-ryusei | 0 | 0 | — |
| 50 | ran-shanten | 0 | 0 | — |
| **合計** | | **1** | **14** | |

## 欠陥の型ごとの分類集計

| 型 | 件数 | 該当選手 |
|---|---:|---|
| **致命的: 列ずれ(決着欄への大会レポート散文の混入)** | 1 | hirahara-riku |
| 軽微: 決着欄の重複計上疑い | 1 | hayashi-kenta |
| 軽微: 決着表記の残存ノイズ(「N分 終了 判定」等、Wikipedia由来の未クリーニング語) | 2 | shimada-shouta, tanimoto-hiroyuki |
| 軽微: 相手名/大会名への記号の残存(コンマ・全角引用符) | 2 | ichiyo-morimoto(2件) |
| 軽微: 決着・R欄の空欄(データ欠落) | 1 | ichiyo-morimoto |
| 軽微: 括弧の閉じ忘れ(決着スコア表記) | 1 | hirahara-riku |
| 軽微: note欄の途中切れ(スクレイプ由来の文字列切断) | 1 | hirahara-riku |
| 軽微: 大会名欄が「?」のみ | 1 | jabito-bairami(2行) |
| **(参考・所定4カテゴリ外)決着スコアと勝敗マーカーの不整合疑い** | **6** | shotaro(1), shishimaru(1), yushin(4) |

致命的欠陥に該当する4カテゴリ(誤統合・他競技混入・列ずれ・内部ラベル露出)のうち、
**誤統合・他競技混入・内部ラベル露出は50人全員で0件**だった。特に内部ラベル露出は
PR #567で`check-kick-label-text-leak-gate.ts`を新設した直後の初回本番検証だったが、
50人・全bout行を目視した範囲でバッジと本文の連結漏れ(「〜のため未リンク」等の内部文言の
そのままの露出)は見つからなかった。

## 追加の重要な論点(所定の4カテゴリには該当しないが看過できない)

### 決着スコアと勝敗マーカーの不整合疑い(6件)

サンプル50人中3人(shotaro・shishimaru・yushin)のページで、決着欄に表示されている
個別ジャッジのスコア内訳(例:「判定0-3(29-30、29-30、28-29)」)が**相手優勢を示している
にもかかわらず、勝敗欄が「勝」になっている**(または逆にスコアが自分優勢なのに「敗」に
なっている)行が計6件見つかった。

具体例:
- `shotaro`: 2019-11-24 DEEP☆KICK 41 vs 小山丈一郎「判定0-3(29-30、29-30、28-29)」→勝敗欄「勝」
- `shishimaru`: 2022-07-31 KROSS×OVER 18 vs 齊藤 友「判定0-3(27:29 27:29 27:29)」→勝敗欄「勝」
- `yushin`: 2020-02-16「判定0-3(28-30、28-30、27-30)」→「勝」/ 2019-09-22「判定0-3(28-30、
  28-29、28-30)」→「勝」/ 2018-11-25「判定2-0(29-28、28-28、29-28)」→「敗」(逆方向)/
  2018-08-19「判定0-3(27-30、27-30、28-30)」→「勝」

**この論点をコーディネーターの「致命的欠陥」4カテゴリには含めなかった理由**:
`scripts/standup-pipeline/SCHEMA.md`に「`result`はマークから、`method`は文字列から、
独立に取る…両者が食い違うレコードは`result_mark`と`method_raw`の両方を残してあるので
後から検証できる」という設計方針が明記されており、**mark(勝敗)とdecision文字列
(スコア内訳)が稀に食い違うことは既知・許容された仕様**とされている(mark側を正とする)。
そのため今回発見した不整合が「mnews側のバグ」なのか「出典サイト自身のスコア表記と
勝敗マークの食い違いをそのまま反映しているだけ」なのかは、この読み取り専用調査の範囲では
判別できなかった。

ただし、50人という限定サンプルの中で3人・6件という頻度は「稀に」と言うにはやや高く、
系統的な要因(特定の団体・特定の時期の取り込みロジックの問題等)が無いか、別途の調査が
必要と考える。次PRへの申し送り事項として記録する。

## 完了確認

- コード変更・`data/kick/*.json`の変更は一切行っていない。
- 全50人を`https://www.mnews.jp/kick/fighters/[slug]`で実際に開き、`get_page_text`で
  全行・全フィールドを目視確認した(抜き取りにしていない)。

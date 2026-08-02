# RIZIN構造的カバレッジ不足3大会とPR #367の突き合わせ

生成日時(JST): 2026-08-02

## 結論: 「残る1大会」は存在しない。3大会という数え方自体が表記ゆれによる誤カウント

[[c-type-structural-gap-71-scale-measurement]]でRIZINを「3大会(6bout)」と
数えたが、これは大会名の文字列違いをそのまま数えた結果であり、実際の大会数は
**2つ**(SARABAの宴・IZAの舞、いずれも2015年12月のRIZIN旗揚げ興行)のみ。
12/28中止分に該当するboutはCSV中に存在しない。

## 突き合わせの詳細

`out/c-type-residual-structural-gap.csv`のRIZIN行(6bout)全件を、PR #367
(`feat/rizin-2015-saitama-2days`、`src/lib/mnewsRating/rizinRecordOverrides.ts`)
の`RIZIN_SARABA_BOUTS`(14試合)・`RIZIN_IZA_BOUTS`(13試合)と対戦相手名まで
突合した。

| slug | 対戦相手 | 結果 | 71件CSV側の大会名表記 | PR#367側の所属大会 | 一致 |
|---|---|---|---|---|---|
| motoya-yuki | フェリペ・エフライン | nc | さいたま3DAYS(2015-12-29) | SARABAの宴 cardPosition3 | ✓ |
| tokoro-hideo | 才賀紀左衛門 | win | さいたま3DAYS(2015-12-29) | SARABAの宴 cardPosition7 | ✓ |
| shinya-aoki | 桜庭和志 | win | さいたま3DAYS(2015-12-29) | SARABAの宴 cardPosition14(メインイベント) | ✓ |
| rena | イリアーナ・ヴァレンティーノ | win | さいたま3DAYS(2015-12-31) | IZAの舞 cardPosition1 | ✓ |
| kim-soochul | マイケ・リニャーレス | win | IZAの舞(2015-12-31) | IZAの舞 cardPosition5 | ✓ |
| yamamoto-arsen | クロン・グレイシー | loss | さいたま3DAYS(2015-12-31) | IZAの舞 cardPosition11 | ✓ |

**6bout全件が、PR #367のオーバーライドデータに既に登録済みであることを確認した。**
新規に対応が必要なboutはゼロ。

## 「3大会」に見えた理由(表記ゆれの内訳)

RIZIN旗揚げ興行は「RIZIN FIGHTING WORLD GRAND-PRIX 2015 さいたま3DAYS」という
名称で告知されたが、当初の3日間興行(12/28・12/29・12/31)のうち12/28が
中止となり、実施されたのは2日間(12/29=SARABAの宴、12/31=IZAの舞)のみ
だった(PR #367本文より)。

Wikipedia側の選手個別戦績表では、この2日間を記録する際に**告知時の総称
「さいたま3DAYS」をそのまま使う選手**と、**当日の実際のカード名(SARABAの宴/
IZAの舞)を使う選手**が混在していた。71件CSVは「大会名の文字列」をキーに
ユニーク化していたため、同じ12/31開催のIZAの舞が「さいたま3DAYS」表記
(rena・yamamoto-arsen)と「IZAの舞」表記(kim-soochul)の2通りに分裂して
見えていた。実大会は2つ(SARABAの宴12/29・IZAの舞12/31)のみで、
**12/28中止分に該当する記録はCSV中に存在しない**(ユーザーの仮説は
不成立、中止分は元々開催されていないため誰の戦績にも記録されようがない)。

## 今回の作業で新たに必要になったもの

なし。PR #367がマージされ次第、`fighterRecords.json`の再生成でこの6件の
「構造的カバレッジ不足」は自動的に解消される見込み。本レポートは
突き合わせの記録のみで、`data/`・`src/`への変更は行っていない。

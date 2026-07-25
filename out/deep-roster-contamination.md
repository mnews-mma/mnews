# deep-roster-contamination: DEEP名簿の未開催イベント混入検証(指示書②-b)

生成日時(JST): 2026-07-25

②(`out/deep-event-roster.md`・PR #201)の対象期間内40大会・延べ782出場を対象に、本文の勝敗表記から実判定した。②の元出力は上書きしていない。推奨・優先度づけは含まない。

> ## ⚠️ 停止条件に該当(指示書②-b§5)
>
> - ②の停止条件は解消していない: 汚染除外後もユニーク選手数が400件を超過(481件)
> - content_state=undeterminedが5大会を超過(9件)。判定ロジックが機能していない疑い

## 1. 40大会のcontent_state内訳

held_state: held=30 / unheld=6 / date_unknown=4(計40)

content_state: result=20 / partial_result=10 / card_only=1 / undetermined=9(計40)

| event_id | held_state | content_state | header_bout_count | bout_count |
|---|---|---|---|---|
| deep-osaka-impact-2026-5th-round | unheld | undetermined | 0 | 0 |
| deep-osaka-impact-2026-4th-round | unheld | undetermined | 0 | 0 |
| deep-133-impact | unheld | undetermined | 0 | 0 |
| deep-jewels-54 | unheld | undetermined | 0 | 0 |
| deep-tokyo-impact-2026-4th-round | unheld | undetermined | 0 | 0 |
| grasp-the-future-cage2 | unheld | card_only | 1 | 0 |
| deep-fight-challenge-2026-2nd-round | held | partial_result | 8 | 7 |
| deep-132-impact | held | result | 11 | 11 |
| deep-osaka-impact-2026-3rd-round | held | partial_result | 20 | 13 |
| deep-nagoya-impact-2026-2nd-round | held | partial_result | 19 | 17 |
| deep-hamamatsu-impact-2026-1st-round | held | partial_result | 21 | 20 |
| deep-jewels-52-2 | held | result | 12 | 14 |
| deep-tokyo-impact-2026-3rd-round | held | result | 10 | 11 |
| deep-131-impact | held | result | 15 | 17 |
| deep-tokyo-impact-2026-2nd-round | held | result | 11 | 13 |
| %e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025 | held | undetermined | 0 | 0 |
| deep-130-impact | held | partial_result | 10 | 9 |
| deep-osaka-impact-2026-2nd-round | held | partial_result | 11 | 10 |
| deep-osaka-impact-2026-1st-round | held | result | 12 | 14 |
| deep-jewels-52 | held | result | 11 | 12 |
| deep-tokyo-impact-2026-1st-round | held | result | 11 | 13 |
| deep-nagoya-impact-2026-1st-round | held | partial_result | 23 | 22 |
| deep-fight-challenge-2026-1st-round | held | result | 7 | 7 |
| deep-tokyo-impact-2025-6th-round | held | result | 11 | 12 |
| deep-129-impact | held | result | 9 | 9 |
| deep-osaka-impact-2025-5th-round | held | partial_result | 21 | 20 |
| deep-jewels-51 | held | result | 10 | 10 |
| deep-tokyo-impact-2025-5th-round | held | result | 10 | 13 |
| deep-128-impact | held | result | 9 | 11 |
| deep-hamamatsu-impact-2025-2nd-round | held | result | 10 | 27 |
| deep-osaka-impact-2025-4th-round | held | result | 8 | 9 |
| deep-osaka-impact-2025-3rd-round | held | result | 10 | 10 |
| deep-127-impact-2 | held | result | 10 | 12 |
| deep-jewels-50 | held | result | 10 | 11 |
| deep-tokyo-impact-2025-4th-round | held | partial_result | 11 | 10 |
| deep-126-impact | held | result | 9 | 9 |
| deep-nagoya-impact-2025-1st-round | date_unknown | partial_result | 19 | 18 |
| deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88 | date_unknown | undetermined | 0 | 0 |
| deep-osaka-impact-2023-2nd-round | date_unknown | undetermined | 0 | 0 |
| deep-x-nariagari | date_unknown | undetermined | 0 | 0 |

undetermined(9件)の内訳(判断は加えず事実のみ): held_state=unheld(未来の大会・「第N試合」ではなく「・選手名 VS 選手名」という別テンプレートで書かれておりheader_bout_count=0になる)が5件、held_state=held/date_unknown(過去または日付不明で「第N試合」自体が本文に見つからない)が4件。後者は本文の構造が本監査の想定パターンと異なる可能性があり、個別確認が必要。

held/date_unknownなのにundeterminedだった大会:

- %e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025(DEEPフューチャーキングトーナメント2025): held_state=held / event_date=2026-04-19
- deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88(DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND): held_state=date_unknown / event_date=(不明)
- deep-osaka-impact-2023-2nd-round(DEEP OSAKA IMPACT 2023 2nd ROUND): held_state=date_unknown / event_date=(不明)
- deep-x-nariagari(DEEP X NARIAGARI): held_state=date_unknown / event_date=(不明)

## 2. 汚染イベント・汚染行の全件

汚染の定義: `held_state=unheld`(本文から開催日が確認でき、かつfetched_at以降=未来の日付)**なのに**bout(勝敗確定済み試合)が抽出できてしまっている大会。`date_unknown`(開催日が確認できない)は汚染に含めない(下記§2b参照。指示書S1で「date_unknownをheldに寄せない」= unheldとして扱わないことが明示されているため、判定できない=未開催とみなす、という飛躍はしない)。

**なし。** held_state=unheldなのにbout(勝敗確定済み試合)が抽出された大会は0件だった。②が抽出した延べ782行のうち、開催日が確認できた分はすべて「開催日がfetched_at以前」の大会に由来する。

### §2b. date_unknownだがboutが抽出できたイベント(汚染ではないが要個別確認・除外していない)

本文から`YYYY年M月D日`形式の日付を検出できなかったが、勝敗記号付きの試合結果は抽出できているイベント。個別に確認したところ(`deep-nagoya-impact-2025-1st-round`)、日付が別形式で書かれている/欠落しているだけで大会名の連番や文脈から見て実際には開催済みと判断できたため、**汚染とはせずクリーン版に残している**。ただし機械的に確定はしていないため、全件を個別に列挙する(黙殺しない)。

- deep-nagoya-impact-2025-1st-round(DEEP NAGOYA IMPACT 2025 1st ROUND): content_state=partial_result / bout_count=18

## 3. 再集計(481 → 481)

| | 元(②) | 汚染除外後 |
|---|---|---|
| イベント数 | 40 | 40 |
| 延べ出場 | 782 | 782 |
| ユニーク選手数 | 481 | 481 |
| listed | 64 | 64 |
| hidden | 4 | 4 |
| missing | 413 | 413 |

## 4. 汚染によってのみ出現していた選手(除外すると名簿から消える選手)

なし。

## 5. S4: 逆方向の取りこぼし(開催済みなのに結果未反映の可能性があるページ、再取得はしない)

| event_id | event_date | content_state | header_bout_count | bout_count |
|---|---|---|---|---|
| deep-fight-challenge-2026-2nd-round | 2026-07-24 | partial_result | 8 | 7 |
| deep-osaka-impact-2026-3rd-round | 2026-06-21 | partial_result | 20 | 13 |
| deep-nagoya-impact-2026-2nd-round | 2026-06-14 | partial_result | 19 | 17 |
| deep-hamamatsu-impact-2026-1st-round | 2026-05-31 | partial_result | 21 | 20 |
| %e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025 | 2026-04-19 | undetermined | 0 | 0 |
| deep-130-impact | 2026-03-20 | partial_result | 10 | 9 |
| deep-osaka-impact-2026-2nd-round | 2026-03-08 | partial_result | 11 | 10 |
| deep-nagoya-impact-2026-1st-round | 2026-02-23 | partial_result | 23 | 22 |
| deep-osaka-impact-2025-5th-round | 2025-12-07 | partial_result | 21 | 20 |
| deep-tokyo-impact-2025-4th-round | 2025-09-07 | partial_result | 11 | 10 |

## 6. 自己検証

- 40 = held(30)+unheld(6)+date_unknown(4): 一致
- 40 = result(20)+partial_result(10)+card_only(1)+undetermined(9): 一致
- 782 = 採用行(782)+汚染行(0): 一致
- 再集計後ユニーク数(481) = listed+hidden+missing(481): 一致


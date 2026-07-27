# deep-archive-depth: DEEP結果アーカイブ 遡り深度調査

生成日時(JST): 2026-07-27

本レポートは監査専用の出力。`data/`・`src/`等への変更は行っていない(diffゼロ)。指示書②(PR #201)・②-b(PR #203)の3段構成(アーカイブ一覧→個別結果ページ→本文正規表現抽出)をそのまま再利用し、直近12ヶ月フィルタのみを外した。名前照合は`findFighterSlugByName`のみ使用。

> ## ⚠️ 停止条件に該当
>
> 以下の条件に該当したため停止条件を満たしている。判断は代行していない。
>
> - §停止条件: 抽出失敗(old_format_suspected+no_marks_found+unfetchable)が全体の1割を超過(221/281 = 78.6%)

## 1. 結論: 最古の大会

確認できた最古の大会: **DEEPフューチャーキングトーナメント2002**(2002-12-08、https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882002/)

アーカイブの辿り方について: `/result/` はページネーション・無限スクロールが一切ない単一の静的ページで、2002年(DEEPフューチャーキングトーナメント2002)相当まで全件が1ページにリストされていることを事前調査(curl取得と実ブラウザでのスクロール後DOM取得の件数一致)で確認済み。本スクリプトも実行時に同一ページ内の`/result/page/N/`リンクの有無を検査しており、検出された場合は新規実装が必要と判断して処理を打ち切る(該当していれば本レポート冒頭に停止条件として表示される)。

## 2. 年別集計(大会数 / 延べ出場 / ユニーク選手数)

| year | 大会数 | parsed | failed | 延べ出場 | ユニーク選手数 | listed | hidden | missing |
|---|---|---|---|---|---|---|---|---|
| 2002 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2003 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 2004 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2005 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2006 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2007 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2008 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 2009 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2010 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 2011 | 6 | 0 | 6 | 0 | 0 | 0 | 0 | 0 |
| 2012 | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| 2013 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| 2014 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| 2015 | 13 | 0 | 13 | 0 | 0 | 0 | 0 | 0 |
| 2016 | 10 | 0 | 10 | 0 | 0 | 0 | 0 | 0 |
| 2017 | 11 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| 2018 | 13 | 0 | 13 | 0 | 0 | 0 | 0 | 0 |
| 2019 | 18 | 0 | 18 | 0 | 0 | 0 | 0 | 0 |
| 2020 | 17 | 0 | 17 | 0 | 0 | 0 | 0 | 0 |
| 2021 | 23 | 0 | 23 | 0 | 0 | 0 | 0 | 0 |
| 2022 | 22 | 0 | 22 | 0 | 0 | 0 | 0 | 0 |
| 2023 | 19 | 1 | 18 | 20 | 20 | 9 | 1 | 10 |
| 2024 | 28 | 19 | 9 | 368 | 276 | 54 | 6 | 216 |
| 2025 | 24 | 23 | 1 | 506 | 364 | 56 | 4 | 304 |
| 2026 | 17 | 16 | 1 | 420 | 338 | 50 | 3 | 285 |

「failed」の内訳は旧フォーマット疑い(`old_format_suspected`)・勝敗記号自体が本文にない(`no_marks_found`)・取得失敗(`unfetchable`)の合計。failedが多い年は延べ出場・ユニーク選手数が実態より過少になっている(0人ではなく「抽出できなかった」ことを意味する)。

## 3. 抽出に失敗した大会の全件列挙(黙殺禁止)

| event_id | event_name | event_date | outcome | 詳細 |
|---|---|---|---|---|
| %e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025 | DEEPフューチャーキングトーナメント2025 | 2026-04-19 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882024 | DEEPフューチャーキングトーナメント2024 | 2025-04-13 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2024-5th-round | DEEP OSAKA IMPACT 2024 5th ROUND | 2024-12-22 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2024-4th-round | DEEP OSAKA IMPACT 2024 4th ROUND | 2024-12-22 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2024-3rd-round | DEEP OSAKA IMPACT 2024 3rd ROUND | 2024-09-22 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-nagoya-impact-2024-4th-round | DEEP NAGOYA IMPACT 2024 4th ROUND | 2024-08-25 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-nagoya-impact-2024-3rd-round | DEEP NAGOYA IMPACT 2024 3rd ROUND | 2024-08-25 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2024-2nd-round | DEEP OSAKA IMPACT 2024 2nd ROUND | 2024-06-02 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-cage-impact-2024-in-hamamatsu | DEEP CAGE IMPACT 2024 in HAMAMATSU | 2024-05-12 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882023 | DEEPフューチャーキングトーナメント2023 | 2024-04-13 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-nagoya-impact-2024-1st-2nd-round | DEEP NAGOYA IMPACT 2024 1st/2nd ROUND | 2024-04-07 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2023-7th-round | DEEP TOKYO IMPACT 2023 7th ROUND | 2023-12-10 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-117-impact | DEEP 117 IMPACT | 2023-12-10 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2023-3rd-round | DEEP OSAKA IMPACT 2023 3rd ROUND | 2023-11-26 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-43 | DEEP JEWELS 43 | 2003-11-23 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2023-6th-round | DEEP TOKYO IMPACT 2023 6th ROUND | 2023-11-23 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| %e3%82%a2%e3%83%a1%e3%83%aa%e3%82%ab%e3%83%b3%e3%83%88%e3%83%83%e3%83%97%e3%83%81%e3%83%bc%e3%83%a0%ef%bc%88att%ef%bc%89%e3%81%ae%e6%89%80%e5%b1%9e%e3%81%a8%e3%81%aa%e3%81%a3%e3%81%9f%e5%85%83 | DEEP 116 IMPACT | 2023-11-11 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-hamamatsu-2023 | DEEP HAMAMATSU IMPACT 2023 | 2023-09-24 | old_format_suspected | 第N試合見出し21件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-42-10th-anniversary%ef%bd%9e | DEEP JEWELS 42 ~10th Anniversary～ | 2023-09-10 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2023-5th-round-2 | DEEP TOKYO IMPACT 2023 5th ROUND | 2023-09-10 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88 | DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2023-2nd-round | DEEP OSAKA IMPACT 2023 2nd ROUND | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-x-nariagari | DEEP X NARIAGARI | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-114-impact | DEEP 114 IMPACT | 2023-07-02 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-41 | DEEP JEWELS 41 | 2023-05-28 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2023-4th-round | DEEP TOKYO IMPACT 2023 4th ROUND | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-113-impact | DEEP 113 IMPACT | 2023-05-07 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2023-3rd-round | DEEP TOKYO IMPACT 2023 3rd ROUND | 2023-05-07 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-nagoya-impact-2023%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%882nd-round | DEEP NAGOYA IMPACT 2023公武堂ファイト2nd ROUND | 2023-04-16 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-nagoya-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%881st-round | DEEP NAGOYA 2023 公武堂ファイト1st ROUND | 2023-04-16 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-osaka-impact-2023-1st | DEEP OSAKA IMPACT 2023 1st ROUND | 2023-04-02 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2023-2nd-round | DEEP TOKYO IMPACT 2023 2nd ROUND | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2023-1st-round | DEEP TOKYO IMPACT 2023 1st ROUND | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-40 | DEEP JEWELS 40 | 2023-02-18 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882022 | DEEPフューチャーキングトーナメント2022 | 2023-02-18 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-112-impact | DEEP 112 IMPACT | 2023-02-11 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2022-5th-round | DEEP OSAKA IMPACT 2022 5th ROUND | 2022-12-18 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-osaka-impact-2022-4th-round | DEEP OSAKA IMPACT 2022 4th ROUND | 2022-12-18 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-111-impact | DEEP 111 IMPACT | 2022-12-11 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2022-7th-ro | DEEP TOKYO IMPACT 2022 7th ROUND | (不明) | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-39 | DEEP JEWELS 39 | 2022-11-23 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-nagoya-impact%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88 | DEEP NAGOYA IMPACT公武堂ファイト | 2022-11-20 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-6th-round | DEEP TOKYO IMPACT 2022 6th ROUND | (不明) | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-110-impact | DEEP 110 IMPACT | 2022-11-12 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-okinawa-impact-2022 | DEEP OKINAWA IMPACT 2022 | 2022-10-30 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-hamamatsu-impact-2022 | DEEP HAMAMATSU IMPACT 2022 | 2022-09-25 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-5th-round | DEEP TOKYO IMPACT 2022 5th ROUND | (不明) | old_format_suspected | 第N試合見出し15件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-osaka-impact-2022-3rd-round | DEEP OSAKA IMPACT 2022 3rd ROUND | 2022-08-28 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-osaka-impact-2022-2nd-round | DEEP OSAKA IMPACT 2022 2nd ROUND | 2022-08-28 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-38 | DEEP JEWELS 38 | 2022-09-11 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-109-impact | DEEP 109 IMPACT | 2022-08-21 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-nagoya-impact-2022%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88 | DEEP NAGOYA IMPACT 2022公武堂ファイト | 2022-07-24 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-108-impact | DEEP 108 IMPACT | 2022-07-10 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2022-4th-round | DEEP TOKYO IMPACT 2022 4th ROUND | (不明) | no_marks_found | 開催日・勝敗記号とも本文に見つからない(構造不明) |
| deep-tokyo-impact-2022-3rd-round | DEEP TOKYO IMPACT 2022 3rd ROUND | (不明) | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| %e6%a0%bc%e9%97%98%e6%8a%80%e3%83%95%e3%82%a7%e3%82%b9%e3%83%86%e3%82%a3%e3%83%90%e3%83%abdeep%e6%b9%98%e5%8d%97-2022 | 格闘技フェスティバルDEEP湘南 2022 | 2022-05-18 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-107-impact | DEEP 107 IMPACT | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-37 | DEEP JEWELS 37 | 2022-05-08 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| %e5%89%8d%e7%94%b0%e5%90%89%e6%9c%97%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c | 前田吉朗引退興行 | 2022-04-10 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-cage-impact-in-osaka-2022 | DEEP CAGE IMPACT IN OSAKA 2022 | 2022-04-10 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882021 | DEEPフューチャーキングトーナメント2021 | 2022-03-13 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-2022-2nd-round | DEEP TOKYO IMPACT 2022 2nd ROUND | (不明) | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2 | DEEP JEWELSアマチュア | 2022-03-13 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-36 | DEEP JEWELS 36 | 2022-03-12 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2022-1st-round | DEEP TOKYO IMPACT 2022 1st ROUND | (不明) | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-106-impact | DEEP 106 IMPACT | (不明) | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-35 | DEEP JEWELS 35 | 2021-12-11 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2021 | DEEP TOKYO IMPACT 2021 | 2021-12-12 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-105-impact | DEEP 105 IMPACT | 2021-12-12 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-2 | DEEP JEWELSアマチュア | 2021-12-11 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-osaka-impact-2021-3 | DEEP OSAKA IMPACT 2021 | 2021-11-21 | old_format_suspected | 第N試合見出し1件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-104-impact | DEEP 104 IMPACT | 2021-10-23 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-tokyo-impact-2021-2nd-round | DEEP TOKYO IMPACT 2021 2nd ROUND | 2021-10-17 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2021-1st-round | DEEP TOKYO IMPACT 2021 1st ROUND | 2021-10-17 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-103-impact | DEEP 103 IMPACT ～20th Anniversary～ | 2021-09-23 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-34 | DEEP JEWELS 34 | 2021-09-04 | old_format_suspected | 第N試合見出し4件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-3 | DEEP JEWELSアマチュア | 2021-09-04 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-osaka-impact-2021-2 | DEEP OSAKA IMPACT 2021 | 2021-07-18 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-102-impact | DEEP 102 IMPACT | 2021-07-04 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-33 | DEEP JEWELS 33 | 2021-06-20 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2nd-round | DEEP TOKYO IMPACT 2nd ROUND | 2021-06-19 | old_format_suspected | 第N試合見出し3件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-1st-round | DEEP TOKYO IMPACT 1st ROUND | 2021-06-19 | old_format_suspected | 第N試合見出し2件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-101-impact | DEEP 101 IMPACT | 2021-05-05 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-osaka-impact-2021 | DEEP OSAKA IMPACT 2021 | 2021-04-04 | old_format_suspected | 第N試合見出し1件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882020 | DEEPフューチャーキングトーナメント2020 | 2021-03-13 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-2021-2 | DEEP TOKYO IMPACT 2021 | 2021-03-13 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-4 | DEEP JEWELSアマチュア | 2021-03-13 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-32 | DEEP JEWELS 32 | 2021-03-07 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-100-impact | DEEP 100 IMPACT ～20th Anniversary～ | 2021-02-21 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-tokyo-impact-2020 | DEEP TOKYO IMPACT 2020 | 2020-12-19 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-31 | DEEP JEWELS 31 | 2020-12-19 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%ef%bc%86pancrase%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a-2 | DEEP＆PANCRASE大阪大会 | 2020-11-29 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%ef%bc%86pancrase%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a | DEEP＆PANCRASE大阪大会 | 2020-11-29 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-99-impact | DEEP 99 IMPACT | 2020-11-01 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-98-impact | DEEP 98 IMPACT | 2020-11-01 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-30 | DEEP JEWELS 30 | 2020-10-31 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-5 | DEEP JEWELSアマチュア | 2020-10-31 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-97-impact | DEEP 97 IMPACT | 2020-09-20 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| skyticket-presents-deep-96-impact | DEEP 96 IMPACT | 2020-08-23 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-96-impact | DEEP 95 IMPACT | 2020-08-23 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-osaka-impact-2020 | DEEP OSAKA IMPACT 2020 | 2020-08-09 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-29 | DEEP JEWELS 29 | 2020-07-23 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-94-impact | DEEP 94 IMPACT | 2020-03-01 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882019 | DEEPフューチャーキングトーナメント2019 | 2020-02-24 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-28 | DEEP JEWELS 28 | 2020-02-24 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-6 | DEEP JEWELSアマチュア | 2020-02-24 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-27 | DEEP JEWELS 27 | 2019-12-22 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-93-impact | DEEP 93 IMPACT | 2019-12-15 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| pancrase-vs-deep-%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a | PANCRASE vs DEEP 大阪大会 | 2019-11-17 | old_format_suspected | 第N試合見出し16件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-92-impact | DEEP 92 IMPACT | 2019-10-22 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-26 | DEEP JEWELS 26 | 2019-10-22 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-91-impact | DEEP 91 IMPACT | 2019-09-08 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-2019 | DEEP TOKYO IMPACT 2019 | 2019-09-01 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-25 | DEEP JEWELS 25 | 2019-09-01 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-7 | DEEP JEWELSアマチュア | 2019-09-01 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-90-impact | DEEP 90 IMPACT | 2019-06-29 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-24 | DEEP JEWELS 24 | 2019-06-09 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2-2 | DEEP JEWELS アマチュア | 2019-06-09 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-89-impact | DEEP 89 IMPACT | 2019-05-12 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2019-in-%e5%a4%a7%e9%98%aa | DEEP CAGE IMPACT 2019 in 大阪 | 2019-04-28 | old_format_suspected | 第N試合見出し15件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882018 | DEEPフューチャーキングトーナメント2018 | 2019-03-16 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-tokyo-impact-2019-2 | DEEP TOKYO IMPACT 2019 | 2019-03-16 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-88-impact | DEEP 88 IMPACT | 2019-03-09 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-23 | DEEP JEWELS 23 | 2019-03-09 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-87-impact | DEEP 87 IMPACT | 2018-12-22 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-22 | DEEP JEWELS 22 | 2018-12-01 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-86-impact | DEEP 86 IMPACT | 2022-10-27 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2018-in%e5%a4%a7%e9%98%aa | DEEP CAGE IMPACT 2018 in大阪 | 2018-10-08 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-jewels-21 | DEEP JEWELS 21 | 2018-09-16 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-%e3%82%a2%e3%83%9e%e3%83%81%e3%83%a5%e3%82%a2 | DEEP JEWELS アマチュア | 2018-09-16 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-85-impact | DEEP 85 IMPACT | 2018-08-26 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-84-impact | DEEP 84 IMPACT | 2018-06-30 | old_format_suspected | 第N試合見出し17件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-20 | DEEP JEWELS 20 | 2018-06-09 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-83-impact | DEEP 83 IMPACT | 2018-04-28 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2018-in%e5%a4%a7%e9%98%aa-2 | DEEP CAGE IMPACT 2018 in大阪 | 2018-04-08 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-19 | DEEP JEWELS 19 | 2018-03-10 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882017 | DEEPフューチャーキングトーナメント2017 | 2018-02-24 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-82-impact | DEEP 82 IMPACT | 2018-02-24 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| pancrase-vs-deep-%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a-2 | PANCRASE vs DEEP 大阪大会 | 2017-12-24 | old_format_suspected | 第N試合見出し16件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-81-impact | DEEP 81 IMPACT | 2017-12-23 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-18 | DEEP JEWELS 18 | 2017-12-03 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-80-impact | DEEP 80 IMPACT | 2017-10-21 | old_format_suspected | 第N試合見出し20件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-79-impact | DEEP 79 IMPACT | 2017-09-16 | old_format_suspected | 第N試合見出し19件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-17 | DEEP JEWELS 17 | 2017-08-26 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2017 | DEEP CAGE IMPACT 2017 | 2017-07-15 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-16 | DEEP JEWELS 16 | (不明) | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2017-2 | DEEP CAGE IMPACT 2017 | 2017-05-13 | old_format_suspected | 第N試合見出し12件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-78-impact | DEEP 78 IMPACT | 2017-03-18 | old_format_suspected | 「第N試合」見出しなし・勝敗記号ありのため現行BOUT_REの前提(見出し構造)自体が異なる疑い |
| deep-jewels-15 | DEEP JEWELS 15 | 2017-02-25 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882016 | DEEPフューチャーキングトーナメント2016 | 2017-02-12 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-cage-impact-2016%ef%bd%9edeep-vs-wsof-gc%ef%bd%9e | DEEP CAGE IMPACT 2016～DEEP VS WSOF-GC～ | 2016-12-17 | old_format_suspected | 第N試合見出し18件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-14 | DEEP JEWELS 14 | 2016-11-03 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2016-in-korakuen-hall | DEEP CAGE IMPACT 2016 in KORAKUEN HALL | 2016-10-18 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-13 | DEEP JEWELS 13 | 2016-08-27 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-77-impact | DEEP 77 IMPACT | 2016-08-27 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-76-impact | DEEP 76 IMPACT | 2016-06-26 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-12 | DEEP JEWELS 12 | 2016-06-05 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2016 | DEEP CAGE IMPACT 2016 | 2016-04-23 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-11 | DEEP JEWELS 11 | 2016-03-06 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-75-impact | DEEP 75 IMPACT | 2016-02-27 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882015 | DEEPフューチャーキングトーナメント2015 | 2015-12-20 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-74-impact | DEEP 74 IMPACT | 2015-12-20 | old_format_suspected | 第N試合見出し15件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-10 | DEEP JEWELS 10 | 2015-11-23 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-73-impact | DEEP 73 IMPACT | 2015-10-17 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-9 | DEEP JEWELS 9 | 2015-08-29 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2015 | DEEP CAGE IMPACT 2015 | 2015-08-29 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-8 | DEEP JEWELS 8 | 2015-05-31 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-72-impact | DEEP 72 IMPACT | 2015-05-16 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| funabashi-bom-ba-ye | FUNABASHI BOM-BA-YE | 2015-05-09 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-osaka-impact-2015 | DEEP OSAKA IMPACT 2015 | 2015-04-29 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-71-impact | DEEP 71 IMPACT | 2015-02-28 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-7 | DEEP JEWELS 7 | 2015-02-21 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882014 | DEEPフューチャーキングトーナメント2014 | 2015-02-01 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-dream-impact-2014%e5%a4%a7%e6%99%a6%e6%97%a5%e3%82%b9%e3%83%9a%e3%82%b7%e3%83%a3%e3%83%ab | DEEP DREAM IMPACT 2014～大晦日special～ | 2014-12-31 | old_format_suspected | 第N試合見出し18件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-70-impact | DEEP 70 IMPACT | 2014-12-21 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-6 | DEEP JEWELS 6 | 2014-11-03 | old_format_suspected | 第N試合見出し6件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-69-impact | DEEP 69 IMPACT | 2014-10-26 | old_format_suspected | 第N試合見出し16件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-68-impact | DEEP 68 IMPACT | 2014-08-23 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-5 | DEEP JEWELS 5 | 2014-08-09 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2014%ef%bd%9e%e3%83%9f%e3%82%b9%e3%82%bf%e3%83%bc%e3%83%a1%e3%82%ac%e3%83%88%e3%83%b3%e8%aa%a0%e6%82%9f%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c%ef%bd%9e | DEEP CAGE IMPACT 2014 | 2014-07-21 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-67-impact | DEEP 67 IMPACT | 2014-06-22 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-4 | DEEP JEWELS 4 | 2014-05-18 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-66-impact | DEEP 66 IMPACT | 2014-04-29 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-65-impact | DEEP 65 IMPACT | 2014-03-22 | old_format_suspected | 第N試合見出し18件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-3 | DEEP JEWELS 3 | 2014-02-16 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882013 | DEEPフューチャーキングトーナメント2013 | 2013-12-22 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-64-impact | DEEP 64 IMPACT | 2013-12-22 | old_format_suspected | 第N試合見出し16件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2013-in-tdc-hall | DEEP CAGE IMPACT 2013 in TDC HALL | 2013-11-24 | old_format_suspected | 第N試合見出し12件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-2 | DEEP JEWELS 2 | 2013-11-04 | old_format_suspected | 第N試合見出し7件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| tribe-tokyo-fight%ef%bd%9e%e9%95%b7%e5%8d%97%e4%ba%ae%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c%ef%bd%9e | TRIBE TOKYO FIGHT～長南亮引退興行～ | 2013-10-20 | old_format_suspected | 第N試合見出し8件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-jewels-%e6%97%97%e6%8f%9a%e3%81%92%e6%88%a6 | DEEP JEWELS ~旗揚げ戦~ | 2013-08-31 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-63-impact | DEEP 63 IMPACT | 2013-08-25 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-cage-impact-2013-in-korakuen-hall | DEEP CAGE IMPACT 2013 in KORAKUEN HALL | 2013-06-15 | old_format_suspected | 第N試合見出し12件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-osaka-impact-2013 | DEEP OSAKA IMPACT 2013 | 2013-04-28 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-62-impact | DEEP 62 IMPACT | 2013-04-26 | old_format_suspected | 第N試合見出し12件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-61-impact | DEEP 61 IMPACT | 2013-02-16 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882012 | DEEPフューチャーキングトーナメント2012 | 2013-01-26 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-haleo-impact-%ef%bd%9e%e4%b8%89%e5%b4%8e%e5%92%8c%e9%9b%84%e5%bc%95%e9%80%80%e3%82%bb%e3%83%ac%e3%83%a2%e3%83%8b%e3%83%bc%ef%bd%9e | DEEP HALEO IMPACT ～三崎和雄引退セレモニー～ | 2012-12-22 | old_format_suspected | 第N試合見出し5件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-60-impact | DEEP 60 IMPACT | 2012-10-19 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-59-impact | DEEP 59 IMPACT | 2012-08-18 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-58-impact | DEEP 58 IMPACT | 2012-06-15 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-57-impact | DEEP 57 IMPACT | 2012-02-18 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-56-impact | DEEP 56 IMPACT | 2011-12-16 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882011 | DEEPフューチャーキングトーナメント2011 | 2011-12-10 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-55-impact | DEEP 55 IMPACT | 2011-08-26 | old_format_suspected | 第N試合見出し10件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-54-impact | DEEP 54 IMPACT | 2011-06-24 | old_format_suspected | 第N試合見出し13件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-53-impact | DEEP 53 IMPACT | 2011-04-22 | old_format_suspected | 第N試合見出し9件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-52-impact | DEEP 52 IMPACT | 2011-02-25 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882010 | DEEPフューチャーキングトーナメント2010 | 2010-12-11 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-51-impact | DEEP 51 IMPACT | 2010-12-11 | old_format_suspected | 第N試合見出し16件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep-50-impact | DEEP 50 IMPACT | 2010-10-24 | old_format_suspected | 第N試合見出し14件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882009 | DEEPフューチャーキングトーナメント2009 | 2009-12-27 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882008 | DEEPフューチャーキングトーナメント2008 | 2008-12-28 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-protect-impact-2008 | DEEP PROTECT IMPACT 2008 | 2008-12-22 | old_format_suspected | 第N試合見出し11件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882007 | DEEPフューチャーキングトーナメント2007 | 2008-01-14 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep-protect-impact-in-osaka | DEEP PROTECT IMPACT 2007 in OSAKA | 2007-12-22 | old_format_suspected | 第N試合見出し12件・勝敗記号ありだが現行BOUT_REで0件抽出(旧フォーマットの疑い) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882006 | DEEPフューチャーキングトーナメント2006 | 2006-12-09 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882005 | DEEPフューチャーキングトーナメント2005 | 2005-12-25 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882004 | DEEPフューチャーキングトーナメント2004 | 2004-12-18 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882003 | DEEPフューチャーキングトーナメント2003 | 2003-11-24 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |
| deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882002 | DEEPフューチャーキングトーナメント2002 | 2002-12-08 | no_marks_found | 開催日は確認できたが勝敗記号(●/○/〇/△)が本文に見つからない(結果未掲載ページの可能性) |

失敗件数: 221 / 集計対象281件(78.6%)

## 4. 開催日を抽出できなかった大会(rawのまま列挙・年集計から除外)

| event_id | event_name | raw_date_snippet(診断専用・未パース) |
|---|---|---|
| deep-nagoya-impact-2025-1st-round | DEEP NAGOYA IMPACT 2025 1st ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88 | DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-osaka-impact-2023-2nd-round | DEEP OSAKA IMPACT 2023 2nd ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-x-nariagari | DEEP X NARIAGARI | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2023-4th-round | DEEP TOKYO IMPACT 2023 4th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2023-2nd-round | DEEP TOKYO IMPACT 2023 2nd ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2023-1st-round | DEEP TOKYO IMPACT 2023 1st ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2022-7th-ro | DEEP TOKYO IMPACT 2022 7th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-6th-round | DEEP TOKYO IMPACT 2022 6th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-5th-round | DEEP TOKYO IMPACT 2022 5th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2022-4th-round | DEEP TOKYO IMPACT 2022 4th ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2022-3rd-round | DEEP TOKYO IMPACT 2022 3rd ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-107-impact | DEEP 107 IMPACT | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2022-2nd-round | DEEP TOKYO IMPACT 2022 2nd ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-tokyo-impact-2022-1st-round | DEEP TOKYO IMPACT 2022 1st ROUND | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-106-impact | DEEP 106 IMPACT | |NEWS| | | | |2026/07/27| |DEEP FI |
| deep-jewels-16 | DEEP JEWELS 16 | |NEWS| | | | |2026/07/27| |DEEP FI |

## 5. 開催前(未来大会)として除外したイベント(参考・集計対象外)

| event_id | event_name | event_date |
|---|---|---|
| deep-osaka-impact-2026-5th-round | DEEP OSAKA IMPACT 2026 5th ROUND | 2026-09-20 |
| deep-osaka-impact-2026-4th-round | DEEP OSAKA IMPACT 2026 4th ROUND | 2026-09-20 |
| deep-133-impact | DEEP 133 IMPACT | 2026-09-14 |
| deep-jewels-54 | DEEP JEWELS 54 | 2026-09-06 |
| deep-tokyo-impact-2026-4th-round | DEEP TOKYO IMPACT 2026 4th ROUND | 2026-09-06 |
| grasp-the-future-cage2 | Grasp the future cage2 | 2026-08-30 |

## 6. ブランド分類が既知パターンに一致しなかったイベント(`other`。黙って除外していない)

- Grasp the future cage2(https://www.deep2001.com/grasp-the-future-cage2/)
- DEEPフューチャーキングトーナメント2025(https://www.deep2001.com/%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025/)
- DEEPフューチャーキングトーナメント2024(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882024/)
- DEEPサマーフェスティバル2024 inお台場(https://www.deep2001.com/deep%e3%82%b5%e3%83%9e%e3%83%bc%e3%83%95%e3%82%a7%e3%82%b9%e3%83%86%e3%82%a3%e3%83%90%e3%83%ab2024-in%e3%81%8a%e5%8f%b0%e5%a0%b4/)
- DEEP CAGE IMPACT 2024 in HAMAMATSU(https://www.deep2001.com/deep-cage-impact-2024-in-hamamatsu/)
- DEEPフューチャーキングトーナメント2023(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882023/)
- DEEP X NARIAGARI(https://www.deep2001.com/deep-x-nariagari/)
- DEEP NAGOYA 2023 公武堂ファイト1st ROUND(https://www.deep2001.com/deep-nagoya-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%881st-round/)
- DEEPフューチャーキングトーナメント2022(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882022/)
- DEEP OKINAWA IMPACT 2022(https://www.deep2001.com/deep-okinawa-impact-2022/)
- 格闘技フェスティバルDEEP湘南 2022(https://www.deep2001.com/%e6%a0%bc%e9%97%98%e6%8a%80%e3%83%95%e3%82%a7%e3%82%b9%e3%83%86%e3%82%a3%e3%83%90%e3%83%abdeep%e6%b9%98%e5%8d%97-2022/)
- 前田吉朗引退興行(https://www.deep2001.com/%e5%89%8d%e7%94%b0%e5%90%89%e6%9c%97%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c/)
- DEEP CAGE IMPACT IN OSAKA 2022(https://www.deep2001.com/deep-cage-impact-in-osaka-2022/)
- DEEPフューチャーキングトーナメント2021(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882021/)
- DEEPフューチャーキングトーナメント2020(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882020/)
- DEEP＆PANCRASE大阪大会(https://www.deep2001.com/deep%ef%bc%86pancrase%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a-2/)
- DEEP＆PANCRASE大阪大会(https://www.deep2001.com/deep%ef%bc%86pancrase%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a/)
- DEEPフューチャーキングトーナメント2019(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882019/)
- PANCRASE vs DEEP 大阪大会(https://www.deep2001.com/pancrase-vs-deep-%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a/)
- DEEP CAGE IMPACT 2019 in 大阪(https://www.deep2001.com/deep-cage-impact-2019-in-%e5%a4%a7%e9%98%aa/)
- DEEPフューチャーキングトーナメント2018(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882018/)
- DEEP CAGE IMPACT 2018 in大阪(https://www.deep2001.com/deep-cage-impact-2018-in%e5%a4%a7%e9%98%aa/)
- DEEP CAGE IMPACT 2018 in大阪(https://www.deep2001.com/deep-cage-impact-2018-in%e5%a4%a7%e9%98%aa-2/)
- DEEPフューチャーキングトーナメント2017(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882017/)
- PANCRASE vs DEEP 大阪大会(https://www.deep2001.com/pancrase-vs-deep-%e5%a4%a7%e9%98%aa%e5%a4%a7%e4%bc%9a-2/)
- DEEP CAGE IMPACT 2017(https://www.deep2001.com/deep-cage-impact-2017/)
- DEEP CAGE IMPACT 2017(https://www.deep2001.com/deep-cage-impact-2017-2/)
- DEEPフューチャーキングトーナメント2016(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882016/)
- DEEP CAGE IMPACT 2016～DEEP VS WSOF-GC～(https://www.deep2001.com/deep-cage-impact-2016%ef%bd%9edeep-vs-wsof-gc%ef%bd%9e/)
- DEEP CAGE IMPACT 2016 in KORAKUEN HALL(https://www.deep2001.com/deep-cage-impact-2016-in-korakuen-hall/)
- DEEP CAGE IMPACT 2016(https://www.deep2001.com/deep-cage-impact-2016/)
- DEEPフューチャーキングトーナメント2015(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882015/)
- DEEP CAGE IMPACT 2015(https://www.deep2001.com/deep-cage-impact-2015/)
- FUNABASHI BOM-BA-YE(https://www.deep2001.com/funabashi-bom-ba-ye/)
- DEEPフューチャーキングトーナメント2014(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882014/)
- DEEP DREAM IMPACT 2014～大晦日special～(https://www.deep2001.com/deep-dream-impact-2014%e5%a4%a7%e6%99%a6%e6%97%a5%e3%82%b9%e3%83%9a%e3%82%b7%e3%83%a3%e3%83%ab/)
- DEEP CAGE IMPACT 2014(https://www.deep2001.com/deep-cage-impact-2014%ef%bd%9e%e3%83%9f%e3%82%b9%e3%82%bf%e3%83%bc%e3%83%a1%e3%82%ac%e3%83%88%e3%83%b3%e8%aa%a0%e6%82%9f%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c%ef%bd%9e/)
- DEEPフューチャーキングトーナメント2013(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882013/)
- DEEP CAGE IMPACT 2013 in TDC HALL(https://www.deep2001.com/deep-cage-impact-2013-in-tdc-hall/)
- TRIBE TOKYO FIGHT～長南亮引退興行～(https://www.deep2001.com/tribe-tokyo-fight%ef%bd%9e%e9%95%b7%e5%8d%97%e4%ba%ae%e5%bc%95%e9%80%80%e8%88%88%e8%a1%8c%ef%bd%9e/)
- DEEP CAGE IMPACT 2013 in KORAKUEN HALL(https://www.deep2001.com/deep-cage-impact-2013-in-korakuen-hall/)
- DEEPフューチャーキングトーナメント2012(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882012/)
- DEEP HALEO IMPACT ～三崎和雄引退セレモニー～(https://www.deep2001.com/deep-haleo-impact-%ef%bd%9e%e4%b8%89%e5%b4%8e%e5%92%8c%e9%9b%84%e5%bc%95%e9%80%80%e3%82%bb%e3%83%ac%e3%83%a2%e3%83%8b%e3%83%bc%ef%bd%9e/)
- DEEPフューチャーキングトーナメント2011(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882011/)
- DEEPフューチャーキングトーナメント2010(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882010/)
- DEEPフューチャーキングトーナメント2009(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882009/)
- DEEPフューチャーキングトーナメント2008(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882008/)
- DEEP PROTECT IMPACT 2008(https://www.deep2001.com/deep-protect-impact-2008/)
- DEEPフューチャーキングトーナメント2007(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882007/)
- DEEP PROTECT IMPACT 2007 in OSAKA(https://www.deep2001.com/deep-protect-impact-in-osaka/)
- DEEPフューチャーキングトーナメント2006(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882006/)
- DEEPフューチャーキングトーナメント2005(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882005/)
- DEEPフューチャーキングトーナメント2004(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882004/)
- DEEPフューチャーキングトーナメント2003(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882003/)
- DEEPフューチャーキングトーナメント2002(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882002/)

## 8. 自己検証

- 参加者行数 = 各イベント試合数×2: 全イベントで一致(不一致があれば実行時にexit 1)
- 年別集計対象イベント数(264) + 開催日不明(17) = 集計対象全体(281): 一致
- アーカイブ総リンク数: 287(未来大会6件・MMA対象外0件を含む)


# deep-records-data-ingest-report

生成日時(JST): 2026-08-08

- アーカイブ総リンク数: 288
- 候補大会数(開催済・KICK/アマチュア除く): 267
- 投入大会数: 239
- bout数: 2480
- parseFailures(F1見出し数との差分。第N試合見出しはあるが抽出できなかった件数): 1件
- 見出しなしメインイベント/セミファイナル回収bout数(PR #374): 49件
- 構造段落回収bout数(PR #381、recoverStructuralParagraphBouts): 82件
- 構造カウント(独立検査、countStructuralBoutBlocks)が最終bout数を上回る大会: 105件(参考値。非プロ/非MMA混入bout・地の文誤検知を含みうるため停止条件には使わない。乖離が大きい大会は大会別内訳のstructural列で個別確認する)
- resultType=unknown: 23件
- 選手名未解決(fighterASlug/fighterBSlug null): 3941件
- 除外(bout単位の非プロ/非MMA混入。PR #265の共有判定器を流用): 250件
- 除外(アマチュア大会): 9件
- 除外(抽出0件・F7/F11相当): 28件
- 除外(DEEP＆PANCRASE共催大会・PANCRASE側を正とする): 5件
- 除外(開催日不明): 1件

## 手入力boutの補完(data/deepManualBouts.json)
| 大会名 | 日付 | 補完出典 | bout数(前→後) | 追加 | 重複スキップ | 非プロ/非MMA除外 | slug未解決 |
|---|---|---|---|---|---|---|---|
| DEEP TOKYO IMPACT 1st ROUND | 2021-06-19 | https://www.mmaofficials.jp/20210619_deep1/ | 1 → 11 | 10 | 1 | 1 | 18 |

## 除外(アマチュア大会。大会名に「アマチュア」を含むもの)
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELSアマチュア
- DEEP JEWELS アマチュア
- DEEP JEWELS アマチュア

## 除外(DEEP＆PANCRASE共催大会。PANCRASE公式側がより網羅的なため除外・二重計上防止)
- 前田吉朗引退興行(2022-04-10)
- DEEP＆PANCRASE大阪大会(2020-11-29)
- DEEP＆PANCRASE大阪大会(2020-11-29)
- PANCRASE vs DEEP 大阪大会(2019-11-17)
- PANCRASE vs DEEP 大阪大会(2017-12-24)

## 除外(抽出0件・個別結果データ無し)
| 大会名 | 日付 | URL | 推定理由 |
|---|---|---|---|
| DEEPフューチャーキングトーナメント2025 | 2026-04-19 | https://www.deep2001.com/%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025/ | 全bout(6件)が非プロ/非MMA混入判定(アマチュア・キッズ・トライアウト・寝試合等)により除外 |
| DEEPフューチャーキングトーナメント2024 | 2025-04-13 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882024/ | 全bout(6件)が非プロ/非MMA混入判定(アマチュア・キッズ・トライアウト・寝試合等)により除外 |
| DEEPフューチャーキングトーナメント2023 | 2024-04-13 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882023/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2022 | 2023-02-18 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882022/ | 全bout(62件)が非プロ/非MMA混入判定(アマチュア・キッズ・トライアウト・寝試合等)により除外 |
| DEEPフューチャーキングトーナメント2021 | 2022-03-13 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882021/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEP OSAKA IMPACT 2021 | 2021-04-04 | https://www.deep2001.com/deep-osaka-impact-2021/ | F11相当(本文に個別結果が見つからない。想定済みフォーマット7種のいずれにも一致しなかった) |
| DEEPフューチャーキングトーナメント2020 | 2021-03-13 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882020/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEP OSAKA IMPACT 2020 | 2020-08-09 | https://www.deep2001.com/deep-osaka-impact-2020/ | F11相当(本文に個別結果が見つからない。想定済みフォーマット7種のいずれにも一致しなかった) |
| DEEPフューチャーキングトーナメント2019 | 2020-02-24 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882019/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2018 | 2019-03-16 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882018/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEP CAGE IMPACT 2018 in大阪 | 2018-10-08 | https://www.deep2001.com/deep-cage-impact-2018-in%e5%a4%a7%e9%98%aa/ | F11相当(本文に個別結果が見つからない。想定済みフォーマット7種のいずれにも一致しなかった) |
| DEEPフューチャーキングトーナメント2017 | 2018-02-24 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882017/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2016 | 2017-02-12 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882016/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2015 | 2015-12-20 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882015/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEP OSAKA IMPACT 2015 | 2015-04-29 | https://www.deep2001.com/deep-osaka-impact-2015/ | F11相当(本文に個別結果が見つからない。想定済みフォーマット7種のいずれにも一致しなかった) |
| DEEPフューチャーキングトーナメント2014 | 2015-02-01 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882014/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2013 | 2013-12-22 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882013/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2012 | 2013-01-26 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882012/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2011 | 2011-12-10 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882011/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2010 | 2010-12-11 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882010/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2009 | 2009-12-27 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882009/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2008 | 2008-12-28 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882008/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2007 | 2008-01-14 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882007/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2006 | 2006-12-09 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882006/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2005 | 2005-12-25 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882005/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2004 | 2004-12-18 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882004/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2003 | 2003-11-24 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882003/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |
| DEEPフューチャーキングトーナメント2002 | 2002-12-08 | https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882002/ | F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない) |

## 除外(開催日不明)
- DEEP JEWELS 16: https://www.deep2001.com/deep-jewels-16/

## 大会別内訳
| 大会名 | 日付 | bout数 | フォーマット | parseFailures | unknown | 未解決名 | 非プロ除外bout | 見出しなし回収 | 構造段落回収 | 構造カウント |
|---|---|---|---|---|---|---|---|---|---|---|
| DEEP FIGHT CHALLENGE 2026 2nd ROUND | 2026-07-24 | 4 | F1 | 0 | 0 | 8 | 4 | 0 | 0 | 21 |
| DEEP 132 IMPACT | 2026-07-05 | 10 | F1 | 0 | 0 | 11 | 1 | 0 | 0 | 28 |
| DEEP OSAKA IMPACT 2026 3rd ROUND | 2026-06-21 | 19 | F1 | 0 | 0 | 37 | 2 | 0 | 0 | 61 |
| DEEP NAGOYA IMPACT 2026 2nd ROUND | 2026-06-14 | 13 | F1 | 1 | 0 | 26 | 5 | 0 | 0 | 42 |
| DEEP HAMAMATSU IMPACT 2026 1ST ROUND | 2026-05-31 | 12 | F1 | 0 | 1 | 24 | 9 | 0 | 0 | 45 |
| DEEP JEWELS 53 | 2026-05-24 | 10 | F1 | 0 | 0 | 18 | 4 | 0 | 0 | 31 |
| DEEP TOKYO IMPACT 2026 3rd ROUND | 2026-05-24 | 10 | F1 | 0 | 0 | 17 | 2 | 0 | 0 | 26 |
| DEEP 131 IMPACT 25th Anniversary | 2026-05-04 | 15 | F1 | 0 | 0 | 0 | 2 | 0 | 0 | 39 |
| DEEP TOKYO IMPACT 2026 2nd ROUND | 2026-04-19 | 11 | F1 | 0 | 0 | 21 | 2 | 0 | 0 | 29 |
| DEEP 130 IMPACT | 2026-03-20 | 10 | F1 | 0 | 0 | 1 | 2 | 0 | 2 | 25 |
| DEEP OSAKA IMPACT 2026 2nd ROUND | 2026-03-08 | 11 | F1 | 0 | 0 | 22 | 2 | 0 | 0 | 16 |
| DEEP OSAKA IMPACT 2026 1st ROUND | 2026-03-08 | 12 | F1 | 0 | 0 | 21 | 2 | 0 | 0 | 19 |
| DEEP JEWELS 52 | 2026-02-23 | 8 | F1 | 0 | 0 | 14 | 5 | 0 | 0 | 28 |
| DEEP TOKYO IMPACT 2026 1st ROUND | 2026-02-23 | 11 | F1 | 0 | 0 | 14 | 3 | 0 | 1 | 30 |
| DEEP NAGOYA IMPACT 2026 1st ROUND | 2026-02-23 | 15 | F1 | 0 | 1 | 30 | 8 | 0 | 0 | 48 |
| DEEP FIGHT CHALLENGE 2026 1st ROUND | 2026-01-23 | 3 | F1 | 0 | 0 | 5 | 4 | 0 | 0 | 17 |
| DEEP TOKYO IMPACT 2025 6th ROUND | 2025-12-14 | 11 | F1 | 0 | 0 | 17 | 3 | 0 | 0 | 30 |
| DEEP 129 IMPACT | 2025-12-14 | 9 | group4_detached_mark | 0 | 0 | 11 | 2 | 0 | 0 | 26 |
| DEEP OSAKA IMPACT 2025 5th ROUND | 2025-12-07 | 18 | F1 | 0 | 0 | 35 | 3 | 0 | 0 | 44 |
| DEEP JEWELS 51 | 2025-11-23 | 6 | F1 | 0 | 0 | 10 | 5 | 0 | 1 | 24 |
| DEEP TOKYO IMPACT 2025 5th ROUND | 2025-11-23 | 9 | F1 | 0 | 0 | 13 | 4 | 0 | 0 | 29 |
| DEEP 128 IMPACT | 2025-11-02 | 9 | F1 | 0 | 0 | 6 | 2 | 0 | 0 | 25 |
| DEEP HAMAMATSU IMPACT 2025 2nd ROUND | 2025-10-05 | 19 | F1 | 0 | 0 | 38 | 8 | 0 | 0 | 56 |
| DEEP OSAKA IMPACT 2025 4th ROUND | 2025-09-21 | 8 | F1 | 0 | 0 | 13 | 2 | 0 | 1 | 19 |
| DEEP OSAKA IMPACT 2025 3rd ROUND | 2025-09-21 | 10 | F1 | 0 | 0 | 19 | 1 | 0 | 1 | 22 |
| DEEP 127 IMPACT | 2025-09-15 | 11 | F1 | 0 | 0 | 11 | 1 | 0 | 0 | 26 |
| DEEP JEWELS 50 | 2025-09-07 | 8 | F1 | 0 | 0 | 13 | 4 | 0 | 1 | 26 |
| DEEP TOKYO IMPACT 2025 4th ROUND | 2025-09-07 | 11 | group2_no_heading | 0 | 0 | 17 | 3 | 0 | 0 | 34 |
| DEEP 126 IMPACT | 2025-08-17 | 10 | F1 | 0 | 0 | 6 | 0 | 0 | 1 | 33 |
| DEEP OSAKA IMPACT 2025 2nd ROUND | 2025-06-29 | 17 | F1 | 0 | 0 | 30 | 0 | 1 | 0 | 36 |
| DEEP TOKYO IMPACT 2025 3rd ROUND | 2025-05-25 | 10 | group2_no_heading | 0 | 0 | 15 | 2 | 0 | 0 | 26 |
| DEEP JEWELS 49 | 2025-05-25 | 5 | F1 | 0 | 0 | 10 | 3 | 0 | 0 | 22 |
| DEEP 125 IMPACT | 2025-05-05 | 7 | group4_detached_mark | 0 | 0 | 3 | 2 | 0 | 2 | 28 |
| DEEP HAMAMATSU IMPACT 2025 1st ROUND | 2025-04-27 | 10 | F1 | 0 | 0 | 19 | 9 | 0 | 1 | 40 |
| DEEP NAGOYA IMPACT 2025 1st ROUND | 2025-04-20 | 13 | F1 | 0 | 0 | 26 | 6 | 0 | 0 | 44 |
| DEEP TOKYO IMPACT 2025 2nd ROUND | 2025-04-13 | 10 | F1 | 0 | 0 | 15 | 3 | 0 | 0 | 29 |
| DEEP OSAKA IMPACT 2025 1st ROUND | 2025-04-06 | 18 | F1 | 0 | 0 | 34 | 1 | 0 | 0 | 23 |
| DEEP TOKYO IMPACT 2025 1st ROUND | 2025-03-23 | 9 | group4_detached_mark | 0 | 0 | 13 | 3 | 0 | 0 | 26 |
| DEEP JEWELS 48 | 2025-03-23 | 10 | F1 | 0 | 1 | 17 | 1 | 0 | 0 | 26 |
| DEEP 124 IMPACT | 2025-03-15 | 11 | F1 | 0 | 0 | 7 | 0 | 0 | 5 | 24 |
| DEEP OSAKA IMPACT 2024 5th ROUND | 2024-12-22 | 9 | group1_vs | 0 | 0 | 16 | 0 | 0 | 0 | 12 |
| DEEP OSAKA IMPACT 2024 4th ROUND | 2024-12-22 | 8 | group1_vs | 0 | 0 | 11 | 0 | 0 | 0 | 11 |
| DEEP 123 IMPACT | 2024-12-08 | 9 | F1 | 0 | 0 | 8 | 2 | 0 | 0 | 24 |
| DEEP TOKYO IMPACT 2024 6th ROUND | 2024-12-08 | 10 | F1 | 0 | 0 | 16 | 3 | 0 | 0 | 29 |
| DEEP JEWELS 47 | 2024-11-23 | 6 | F1 | 0 | 0 | 10 | 3 | 0 | 0 | 23 |
| DEEP TOKYO IMPACT 2024 5th ROUND | 2024-11-23 | 11 | F1 | 0 | 0 | 13 | 3 | 0 | 0 | 30 |
| DEEP 122 IMPACT | 2024-11-04 | 8 | F1 | 0 | 0 | 10 | 2 | 0 | 0 | 24 |
| DEEP HAMAMATSU IMPACT 2024 | 2024-10-06 | 15 | group4_detached_mark | 0 | 1 | 28 | 5 | 0 | 0 | 20 |
| DEEP OSAKA IMPACT 2024 3rd ROUND | 2024-09-22 | 15 | group1_vs | 0 | 2 | 24 | 0 | 0 | 0 | 18 |
| DEEP 121 IMPACT | 2024-09-16 | 9 | F1 | 0 | 1 | 6 | 2 | 0 | 1 | 25 |
| DEEP JEWELS 46 | 2024-09-08 | 9 | F1 | 0 | 0 | 15 | 3 | 0 | 1 | 27 |
| DEEP TOKYO IMPACT 2024 4th ROUND | 2024-09-08 | 12 | F1 | 0 | 0 | 22 | 2 | 0 | 0 | 30 |
| DEEPサマーフェスティバル2024 inお台場 | 2024-08-31 | 7 | F1 | 0 | 0 | 9 | 1 | 0 | 0 | 19 |
| DEEP 120 IMPACT | 2024-07-14 | 10 | F1 | 0 | 0 | 7 | 1 | 0 | 1 | 24 |
| DEEP NAGOYA IMPACT 2024 4th ROUND | 2024-08-25 | 7 | group1_vs | 0 | 0 | 14 | 0 | 0 | 0 | 10 |
| DEEP NAGOYA IMPACT 2024 3rd ROUND | 2024-08-25 | 10 | group1_vs | 0 | 1 | 19 | 0 | 0 | 0 | 12 |
| DEEP OSAKA IMPACT 2024 2nd ROUND | 2024-06-02 | 19 | group1_vs | 0 | 1 | 33 | 0 | 0 | 0 | 32 |
| DEEP JEWELS 45 | 2024-05-26 | 5 | F1 | 0 | 0 | 3 | 2 | 0 | 0 | 19 |
| DEEP TOKYO IMPACT 2024 3rd ROUND | 2024-05-26 | 9 | group2_no_heading | 0 | 0 | 12 | 2 | 0 | 0 | 26 |
| DEEP CAGE IMPACT 2024 in HAMAMATSU | 2024-05-12 | 8 | group4_detached_mark | 0 | 1 | 13 | 4 | 0 | 1 | 14 |
| DEEP 119 IMPACT | 2024-05-03 | 7 | F1 | 0 | 0 | 4 | 1 | 0 | 1 | 18 |
| DEEP TOKYO IMPACT 2024 2nd ROUND | 2024-04-13 | 10 | F1 | 0 | 0 | 19 | 0 | 2 | 0 | 22 |
| DEEP NAGOYA IMPACT 2024 1st/2nd ROUND | 2024-04-07 | 14 | group1_vs | 0 | 1 | 28 | 0 | 0 | 0 | 17 |
| DEEP JEWELS 44 | 2024-03-24 | 9 | F1 | 0 | 0 | 15 | 1 | 2 | 1 | 26 |
| DEEP TOKYO IMPACT 2024 1st ROUND | 2024-03-24 | 12 | F1 | 0 | 1 | 19 | 1 | 2 | 0 | 28 |
| DEEP OSAKA IMPACT 2024 1st ROUND | 2024-03-17 | 12 | f4_detached_mark_label | 0 | 0 | 21 | 4 | 0 | 0 | 38 |
| DEEP 118 IMPACT | 2024-03-09 | 7 | F1 | 0 | 0 | 4 | 1 | 2 | 0 | 23 |
| DEEP TOKYO IMPACT 2023 7th ROUND | 2023-12-10 | 9 | f4_detached_mark_label | 0 | 0 | 15 | 3 | 0 | 0 | 14 |
| DEEP 117 IMPACT | 2023-12-10 | 6 | f4_detached_mark_label | 0 | 0 | 8 | 4 | 0 | 0 | 16 |
| DEEP OSAKA IMPACT 2023 3rd ROUND | 2023-11-26 | 16 | f4_detached_mark_label | 0 | 0 | 29 | 1 | 0 | 0 | 18 |
| DEEP JEWELS 43 | 2023-11-23 | 10 | f4_detached_mark_label | 0 | 0 | 16 | 1 | 0 | 0 | 11 |
| DEEP TOKYO IMPACT 2023 6th ROUND | 2023-11-23 | 10 | f4_detached_mark_label | 0 | 0 | 18 | 2 | 0 | 0 | 12 |
| DEEP 116 IMPACT | 2023-11-11 | 9 | group2_no_heading | 0 | 0 | 8 | 2 | 0 | 0 | 14 |
| DEEP HAMAMATSU IMPACT 2023 | 2023-09-24 | 19 | group4_detached_mark | 0 | 1 | 35 | 4 | 2 | 1 | 26 |
| DEEP 115 IMPACT～DEEP VS BLACK COMBAT～ | 2023-09-18 | 11 | F1 | 0 | 0 | 12 | 1 | 0 | 2 | 15 |
| DEEP JEWELS 42 ~10th Anniversary～ | 2023-09-10 | 11 | f2_method_middle | 0 | 0 | 16 | 2 | 0 | 2 | 17 |
| DEEP TOKYO IMPACT 2023 5th ROUND | 2023-09-10 | 13 | f2_method_middle | 0 | 0 | 22 | 1 | 0 | 0 | 18 |
| DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND | 2023-08-06 | 11 | f10_vs_and_mark | 0 | 0 | 22 | 4 | 0 | 1 | 17 |
| DEEP OSAKA IMPACT 2023 2nd ROUND | 2023-07-30 | 14 | group2_no_heading | 0 | 0 | 24 | 0 | 0 | 0 | 15 |
| DEEP X NARIAGARI | 2023-07-23 | 9 | f8_fully_separated | 0 | 0 | 14 | 0 | 0 | 0 | 0 |
| DEEP 114 IMPACT | 2023-07-02 | 8 | f8_fully_separated | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| DEEP JEWELS 41 | 2023-05-28 | 6 | f2_method_middle | 0 | 0 | 8 | 2 | 0 | 0 | 8 |
| DEEP TOKYO IMPACT 2023 4th ROUND | 2023-05-28 | 9 | f8_fully_separated | 0 | 0 | 17 | 0 | 0 | 0 | 0 |
| DEEP 113 IMPACT | 2023-05-07 | 8 | f8_fully_separated | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| DEEP TOKYO IMPACT 2023 3rd ROUND | 2023-05-07 | 9 | f8_fully_separated | 0 | 0 | 13 | 0 | 0 | 0 | 0 |
| DEEP NAGOYA IMPACT 2023公武堂ファイト2nd ROUND | 2023-04-16 | 12 | group1_vs | 0 | 0 | 23 | 0 | 0 | 0 | 12 |
| DEEP NAGOYA 2023 公武堂ファイト1st ROUND | 2023-04-16 | 10 | group1_vs | 0 | 1 | 18 | 0 | 0 | 0 | 10 |
| DEEP OSAKA IMPACT 2023 1st ROUND | 2023-04-02 | 15 | f10_vs_and_mark | 0 | 0 | 26 | 0 | 0 | 0 | 15 |
| DEEP TOKYO IMPACT 2023 2nd ROUND | 2023-03-25 | 8 | f10_vs_and_mark | 0 | 0 | 11 | 1 | 0 | 0 | 9 |
| DEEP TOKYO IMPACT 2023 1st ROUND | 2023-03-25 | 7 | f10_vs_and_mark | 0 | 0 | 10 | 1 | 0 | 0 | 8 |
| DEEP JEWELS 40 | 2023-02-18 | 9 | f2_method_middle | 0 | 0 | 14 | 1 | 0 | 1 | 10 |
| DEEP 112 IMPACT | 2023-02-11 | 9 | f8_fully_separated | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| DEEP OSAKA IMPACT 2022 5th ROUND | 2022-12-18 | 8 | group1_vs | 0 | 0 | 14 | 0 | 0 | 7 | 8 |
| DEEP OSAKA IMPACT 2022 4th ROUND | 2022-12-18 | 7 | group1_vs | 0 | 0 | 13 | 0 | 0 | 0 | 7 |
| DEEP 111 IMPACT | 2022-12-11 | 10 | f8_fully_separated | 0 | 0 | 13 | 0 | 0 | 0 | 0 |
| DEEP TOKYO IMPACT 2022 7th ROUND | 2022-12-11 | 11 | f2_method_middle | 0 | 0 | 16 | 1 | 0 | 0 | 12 |
| DEEP JEWELS 39 | 2022-11-23 | 9 | f2_method_middle | 0 | 0 | 13 | 2 | 0 | 0 | 11 |
| DEEP NAGOYA IMPACT公武堂ファイト | 2022-11-20 | 8 | group1_vs | 0 | 0 | 16 | 0 | 0 | 0 | 8 |
| DEEP TOKYO IMPACT 2022 6th ROUND | 2022-11-23 | 9 | f2_method_middle | 0 | 0 | 13 | 2 | 0 | 2 | 11 |
| DEEP 110 IMPACT | 2022-11-12 | 8 | f8_fully_separated | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| DEEP OKINAWA IMPACT 2022 | 2022-10-30 | 10 | f8_fully_separated | 0 | 0 | 16 | 0 | 0 | 0 | 0 |
| DEEP HAMAMATSU IMPACT 2022 | 2022-09-25 | 22 | group1_vs | 0 | 0 | 41 | 1 | 0 | 1 | 23 |
| DEEP TOKYO IMPACT 2022 5th ROUND | 2022-09-11 | 14 | f2_method_middle | 0 | 0 | 18 | 0 | 0 | 2 | 15 |
| DEEP OSAKA IMPACT 2022 3rd ROUND | 2022-08-28 | 8 | group1_vs | 0 | 0 | 15 | 0 | 0 | 0 | 8 |
| DEEP OSAKA IMPACT 2022 2nd ROUND | 2022-08-28 | 8 | group1_vs | 0 | 0 | 15 | 0 | 0 | 0 | 7 |
| DEEP JEWELS 38 | 2022-09-11 | 5 | f2_method_middle | 0 | 0 | 9 | 4 | 0 | 0 | 6 |
| DEEP 109 IMPACT | 2022-08-21 | 11 | f8_fully_separated | 0 | 0 | 14 | 0 | 0 | 0 | 0 |
| DEEP NAGOYA IMPACT 2022公武堂ファイト | 2022-07-24 | 10 | f1_method_glued | 0 | 0 | 20 | 0 | 1 | 0 | 10 |
| DEEP 108 IMPACT | 2022-07-10 | 13 | f8_fully_separated | 0 | 0 | 13 | 0 | 0 | 0 | 0 |
| DEEP TOKYO IMPACT 2022 4th ROUND | 2022-05-29 | 9 | f2_method_middle | 0 | 0 | 13 | 2 | 0 | 0 | 11 |
| DEEP TOKYO IMPACT 2022 3rd ROUND | 2022-05-29 | 11 | f2_method_middle | 0 | 0 | 20 | 2 | 0 | 0 | 13 |
| 格闘技フェスティバルDEEP湘南 2022 | 2022-05-18 | 1 |  | 0 | 1 | 2 | 0 | 0 | 1 | 1 |
| DEEP 107 IMPACT | 2022-05-08 | 8 | f8_fully_separated | 0 | 0 | 8 | 0 | 0 | 0 | 0 |
| DEEP JEWELS 37 | 2022-05-08 | 7 | f2_method_middle | 0 | 0 | 6 | 1 | 2 | 1 | 8 |
| DEEP CAGE IMPACT IN OSAKA 2022 | 2022-04-10 | 7 | group1_vs | 0 | 0 | 12 | 0 | 0 | 0 | 7 |
| DEEP TOKYO IMPACT 2022 2nd ROUND | 2022-03-13 | 8 | f2_method_middle | 0 | 0 | 12 | 0 | 0 | 0 | 9 |
| DEEP JEWELS 36 | 2022-03-12 | 7 | f2_method_middle | 0 | 0 | 8 | 1 | 2 | 0 | 8 |
| DEEP TOKYO IMPACT 2022 1st ROUND | 2022-03-12 | 9 | f2_method_middle | 0 | 0 | 13 | 0 | 0 | 0 | 9 |
| DEEP 106 IMPACT | 2022-02-26 | 6 | f8_fully_separated | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| DEEP JEWELS 35 | 2021-12-11 | 10 | f2_method_middle | 0 | 0 | 16 | 1 | 2 | 0 | 11 |
| DEEP TOKYO IMPACT 2021 | 2021-12-12 | 10 | f2_method_middle | 0 | 0 | 18 | 1 | 2 | 0 | 11 |
| DEEP 105 IMPACT | 2021-12-12 | 11 | f2_method_middle | 0 | 0 | 9 | 0 | 2 | 0 | 11 |
| DEEP OSAKA IMPACT 2021 | 2021-11-21 | 1 | f2_method_middle | 0 | 0 | 2 | 0 | 0 | 0 | 1 |
| DEEP 104 IMPACT | 2021-10-23 | 7 | f2_method_middle | 0 | 0 | 6 | 0 | 0 | 0 | 7 |
| DEEP TOKYO IMPACT 2021 2nd ROUND | 2021-10-17 | 7 | f2_method_middle | 0 | 0 | 10 | 1 | 0 | 0 | 8 |
| DEEP TOKYO IMPACT 2021 1st ROUND | 2021-10-17 | 6 | f2_method_middle | 0 | 0 | 8 | 1 | 0 | 0 | 7 |
| DEEP 103 IMPACT ～20th Anniversary～ | 2021-09-23 | 9 | F1 | 0 | 0 | 8 | 0 | 0 | 0 | 9 |
| DEEP JEWELS 34 | 2021-09-04 | 5 | f2_method_middle | 0 | 0 | 8 | 1 | 2 | 1 | 7 |
| DEEP OSAKA IMPACT 2021 | 2021-07-18 | 9 | group1_vs | 0 | 0 | 17 | 0 | 0 | 0 | 9 |
| DEEP 102 IMPACT | 2021-07-04 | 6 | group2_no_heading | 0 | 0 | 6 | 0 | 0 | 0 | 9 |
| DEEP JEWELS 33 | 2021-06-20 | 8 | f2_method_middle | 0 | 0 | 9 | 0 | 2 | 0 | 10 |
| DEEP TOKYO IMPACT 2nd ROUND | 2021-06-19 | 1 | f2_method_middle | 0 | 0 | 2 | 2 | 0 | 0 | 3 |
| DEEP TOKYO IMPACT 1st ROUND | 2021-06-19 | 1 | f2_method_middle | 0 | 0 | 2 | 1 | 0 | 0 | 2 |
| DEEP 101 IMPACT | 2021-05-05 | 8 | f2_method_middle | 0 | 0 | 8 | 0 | 0 | 1 | 8 |
| DEEP TOKYO IMPACT 2021 | 2021-03-13 | 10 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 10 |
| DEEP JEWELS 32 | 2021-03-07 | 8 | f2_method_middle | 0 | 0 | 9 | 2 | 0 | 0 | 10 |
| DEEP 100 IMPACT ～20th Anniversary～ | 2021-02-21 | 17 | f2_method_middle | 0 | 3 | 18 | 0 | 0 | 1 | 16 |
| DEEP TOKYO IMPACT 2020 | 2020-12-19 | 9 | f2_method_middle | 0 | 0 | 14 | 0 | 0 | 0 | 9 |
| DEEP JEWELS 31 | 2020-12-19 | 5 | f2_method_middle | 0 | 1 | 5 | 1 | 0 | 1 | 8 |
| DEEP 99 IMPACT | 2020-11-01 | 9 | f2_method_middle | 0 | 0 | 13 | 0 | 2 | 4 | 9 |
| DEEP 98 IMPACT | 2020-11-01 | 7 | f2_method_middle | 0 | 0 | 8 | 0 | 1 | 1 | 7 |
| DEEP JEWELS 30 | 2020-10-31 | 7 | f2_method_middle | 0 | 0 | 10 | 1 | 0 | 0 | 8 |
| DEEP 97 IMPACT | 2020-09-20 | 6 | f2_method_middle | 0 | 0 | 7 | 0 | 1 | 0 | 7 |
| DEEP 96 IMPACT | 2020-08-23 | 8 | f2_method_middle | 0 | 0 | 12 | 0 | 0 | 0 | 8 |
| DEEP 95 IMPACT | 2020-08-23 | 9 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 1 | 9 |
| DEEP JEWELS 29 | 2020-07-23 | 5 | f2_method_middle | 0 | 0 | 6 | 1 | 0 | 0 | 8 |
| DEEP 94 IMPACT | 2020-03-01 | 11 | f2_method_middle | 0 | 0 | 16 | 0 | 0 | 1 | 12 |
| DEEP JEWELS 28 | 2020-02-24 | 8 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 8 |
| DEEP JEWELS 27 | 2019-12-22 | 5 | f2_method_middle | 0 | 0 | 10 | 6 | 0 | 1 | 12 |
| DEEP 93 IMPACT | 2019-12-15 | 24 | f2_method_middle | 0 | 1 | 35 | 1 | 0 | 1 | 25 |
| DEEP 92 IMPACT | 2019-10-22 | 10 | f2_method_middle | 0 | 0 | 13 | 0 | 0 | 1 | 10 |
| DEEP JEWELS 26 | 2019-10-22 | 9 | f2_method_middle | 0 | 0 | 17 | 0 | 0 | 0 | 9 |
| DEEP 91 IMPACT | 2019-09-08 | 14 | f2_method_middle | 0 | 0 | 21 | 0 | 0 | 0 | 14 |
| DEEP TOKYO IMPACT 2019 | 2019-09-01 | 3 | f2_method_middle | 0 | 0 | 5 | 8 | 0 | 0 | 23 |
| DEEP JEWELS 25 | 2019-09-01 | 7 | f2_method_middle | 0 | 0 | 12 | 0 | 0 | 0 | 7 |
| DEEP 90 IMPACT | 2019-06-29 | 12 | f2_method_middle | 0 | 0 | 19 | 0 | 0 | 0 | 12 |
| DEEP JEWELS 24 | 2019-06-09 | 9 | f2_method_middle | 0 | 0 | 15 | 1 | 0 | 0 | 10 |
| DEEP 89 IMPACT | 2019-05-12 | 14 | f2_method_middle | 0 | 0 | 25 | 0 | 0 | 0 | 14 |
| DEEP CAGE IMPACT 2019 in 大阪 | 2019-04-28 | 17 | F1 | 0 | 0 | 32 | 0 | 0 | 2 | 17 |
| DEEP TOKYO IMPACT 2019 | 2019-03-16 | 9 | f2_method_middle | 0 | 0 | 17 | 2 | 0 | 0 | 39 |
| DEEP 88 IMPACT | 2019-03-09 | 12 | f2_method_middle | 0 | 0 | 16 | 0 | 0 | 0 | 12 |
| DEEP JEWELS 23 | 2019-03-09 | 11 | f2_method_middle | 0 | 0 | 21 | 0 | 0 | 1 | 11 |
| DEEP 87 IMPACT | 2018-12-22 | 10 | f2_method_middle | 0 | 0 | 16 | 0 | 0 | 1 | 10 |
| DEEP JEWELS 22 | 2018-12-01 | 11 | f2_method_middle | 0 | 0 | 20 | 0 | 0 | 0 | 11 |
| DEEP 86 IMPACT | 2022-10-27 | 16 | f2_method_middle | 0 | 0 | 22 | 0 | 2 | 0 | 16 |
| DEEP JEWELS 21 | 2018-09-16 | 7 | f2_method_middle | 0 | 0 | 13 | 0 | 0 | 0 | 9 |
| DEEP 85 IMPACT | 2018-08-26 | 11 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 11 |
| DEEP 84 IMPACT | 2018-06-30 | 18 | f2_method_middle | 0 | 0 | 29 | 0 | 0 | 1 | 18 |
| DEEP JEWELS 20 | 2018-06-09 | 8 | f2_method_middle | 0 | 0 | 14 | 0 | 0 | 0 | 8 |
| DEEP 83 IMPACT | 2018-04-28 | 13 | f2_method_middle | 0 | 0 | 19 | 0 | 0 | 0 | 13 |
| DEEP CAGE IMPACT 2018 in大阪 | 2018-04-08 | 14 | f2_method_middle | 0 | 0 | 26 | 0 | 0 | 0 | 14 |
| DEEP JEWELS 19 | 2018-03-10 | 9 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 9 |
| DEEP 82 IMPACT | 2018-02-24 | 11 | f2_method_middle | 0 | 0 | 18 | 0 | 2 | 0 | 11 |
| DEEP 81 IMPACT | 2017-12-23 | 15 | f2_method_middle | 0 | 0 | 22 | 0 | 1 | 1 | 15 |
| DEEP JEWELS 18 | 2017-12-03 | 10 | f2_method_middle | 0 | 0 | 18 | 1 | 0 | 0 | 11 |
| DEEP 80 IMPACT | 2017-10-21 | 20 | f2_method_middle | 0 | 0 | 37 | 0 | 0 | 0 | 20 |
| DEEP 79 IMPACT | 2017-09-16 | 19 | f2_method_middle | 0 | 0 | 33 | 0 | 0 | 0 | 19 |
| DEEP JEWELS 17 | 2017-08-26 | 4 | f2_method_middle | 0 | 0 | 6 | 2 | 0 | 0 | 6 |
| DEEP CAGE IMPACT 2017 | 2017-07-15 | 9 | f2_method_middle | 0 | 0 | 13 | 0 | 0 | 1 | 9 |
| DEEP CAGE IMPACT 2017 | 2017-05-13 | 14 | f2_method_middle | 0 | 0 | 26 | 0 | 2 | 0 | 14 |
| DEEP 78 IMPACT | 2017-03-18 | 9 | f2_method_middle | 0 | 0 | 14 | 0 | 0 | 0 | 11 |
| DEEP JEWELS 15 | 2017-02-25 | 7 | f2_method_middle | 0 | 0 | 10 | 0 | 0 | 0 | 7 |
| DEEP CAGE IMPACT 2016～DEEP VS WSOF-GC～ | 2016-12-17 | 18 | f2_method_middle | 0 | 0 | 30 | 0 | 0 | 0 | 18 |
| DEEP JEWELS 14 | 2016-11-03 | 7 | f2_method_middle | 0 | 0 | 10 | 0 | 0 | 0 | 8 |
| DEEP CAGE IMPACT 2016 in KORAKUEN HALL | 2016-10-18 | 8 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 9 |
| DEEP JEWELS 13 | 2016-08-27 | 7 | f2_method_middle | 0 | 0 | 13 | 0 | 0 | 0 | 7 |
| DEEP 77 IMPACT | 2016-08-27 | 24 | f2_method_middle | 0 | 0 | 42 | 0 | 0 | 0 | 24 |
| DEEP 76 IMPACT | 2016-06-26 | 11 | f2_method_middle | 0 | 0 | 17 | 0 | 0 | 0 | 11 |
| DEEP JEWELS 12 | 2016-06-05 | 8 | f2_method_middle | 0 | 0 | 15 | 0 | 1 | 0 | 8 |
| DEEP CAGE IMPACT 2016 | 2016-04-23 | 18 | f2_method_middle | 0 | 0 | 33 | 0 | 0 | 0 | 18 |
| DEEP JEWELS 11 | 2016-03-06 | 6 | f2_method_middle | 0 | 0 | 10 | 1 | 0 | 0 | 7 |
| DEEP 75 IMPACT | 2016-02-27 | 14 | f2_method_middle | 0 | 0 | 25 | 0 | 0 | 0 | 14 |
| DEEP 74 IMPACT | 2015-12-20 | 15 | f2_method_middle | 0 | 0 | 29 | 0 | 0 | 0 | 15 |
| DEEP JEWELS 10 | 2015-11-23 | 6 | f2_method_middle | 0 | 0 | 9 | 1 | 0 | 0 | 7 |
| DEEP 73 IMPACT | 2015-10-17 | 12 | f2_method_middle | 0 | 0 | 22 | 0 | 0 | 1 | 12 |
| DEEP JEWELS 9 | 2015-08-29 | 4 | f2_method_middle | 0 | 0 | 6 | 0 | 0 | 0 | 5 |
| DEEP CAGE IMPACT 2015 | 2015-08-29 | 12 | f2_method_middle | 0 | 0 | 21 | 0 | 0 | 2 | 12 |
| DEEP JEWELS 8 | 2015-05-31 | 5 | f2_method_middle | 0 | 0 | 7 | 0 | 0 | 0 | 6 |
| DEEP 72 IMPACT | 2015-05-16 | 10 | f2_method_middle | 0 | 0 | 17 | 0 | 0 | 0 | 10 |
| FUNABASHI BOM-BA-YE | 2015-05-09 | 5 | f2_method_middle | 0 | 1 | 9 | 0 | 0 | 0 | 5 |
| DEEP 71 IMPACT | 2015-02-28 | 14 | f2_method_middle | 0 | 0 | 27 | 0 | 0 | 1 | 14 |
| DEEP JEWELS 7 | 2015-02-21 | 4 | f2_method_middle | 0 | 0 | 6 | 0 | 0 | 1 | 5 |
| DEEP DREAM IMPACT 2014～大晦日special～ | 2014-12-31 | 22 | f2_method_middle | 0 | 0 | 36 | 0 | 0 | 0 | 21 |
| DEEP 70 IMPACT | 2014-12-21 | 15 | f2_method_middle | 0 | 0 | 26 | 0 | 0 | 1 | 16 |
| DEEP JEWELS 6 | 2014-11-03 | 7 | f2_method_middle | 0 | 1 | 9 | 0 | 1 | 0 | 7 |
| DEEP 69 IMPACT | 2014-10-26 | 15 | f2_method_middle | 0 | 0 | 29 | 0 | 0 | 2 | 16 |
| DEEP 68 IMPACT | 2014-08-23 | 11 | f2_method_middle | 0 | 0 | 18 | 0 | 0 | 0 | 12 |
| DEEP JEWELS 5 | 2014-08-09 | 8 | f2_method_middle | 0 | 0 | 13 | 0 | 1 | 0 | 8 |
| DEEP CAGE IMPACT 2014 | 2014-07-21 | 15 | f2_method_middle | 0 | 0 | 28 | 0 | 0 | 0 | 15 |
| DEEP 67 IMPACT | 2014-06-22 | 11 | f2_method_middle | 0 | 0 | 20 | 0 | 0 | 0 | 11 |
| DEEP JEWELS 4 | 2014-05-18 | 9 | f2_method_middle | 0 | 0 | 15 | 0 | 1 | 1 | 9 |
| DEEP 66 IMPACT | 2014-04-29 | 10 | f2_method_middle | 0 | 0 | 18 | 0 | 0 | 0 | 10 |
| DEEP 65 IMPACT | 2014-03-22 | 18 | f2_method_middle | 0 | 0 | 30 | 0 | 0 | 0 | 18 |
| DEEP JEWELS 3 | 2014-02-16 | 7 | f2_method_middle | 0 | 0 | 12 | 0 | 1 | 2 | 7 |
| DEEP 64 IMPACT | 2013-12-22 | 16 | f2_method_middle | 0 | 0 | 29 | 0 | 0 | 0 | 16 |
| DEEP CAGE IMPACT 2013 in TDC HALL | 2013-11-24 | 16 | f2_method_middle | 0 | 0 | 26 | 0 | 2 | 0 | 16 |
| DEEP JEWELS 2 | 2013-11-04 | 7 | f2_method_middle | 0 | 0 | 11 | 0 | 1 | 0 | 8 |
| TRIBE TOKYO FIGHT～長南亮引退興行～ | 2013-10-20 | 11 | f2_method_middle | 0 | 0 | 21 | 0 | 1 | 0 | 11 |
| DEEP JEWELS ~旗揚げ戦~ | 2013-08-31 | 10 | f2_method_middle | 0 | 0 | 19 | 0 | 1 | 0 | 12 |
| DEEP 63 IMPACT | 2013-08-25 | 14 | f2_method_middle | 0 | 0 | 25 | 0 | 0 | 0 | 14 |
| DEEP CAGE IMPACT 2013 in KORAKUEN HALL | 2013-06-15 | 15 | f2_method_middle | 0 | 1 | 28 | 0 | 0 | 2 | 15 |
| DEEP OSAKA IMPACT 2013 | 2013-04-28 | 11 | f2_method_middle | 0 | 0 | 19 | 0 | 0 | 1 | 11 |
| DEEP 62 IMPACT | 2013-04-26 | 14 | f2_method_middle | 0 | 0 | 24 | 0 | 0 | 0 | 14 |
| DEEP 61 IMPACT | 2013-02-16 | 5 | f2_method_middle | 0 | 0 | 9 | 0 | 0 | 0 | 5 |
| DEEP HALEO IMPACT ～三崎和雄引退セレモニー～ | 2012-12-22 | 8 | f2_method_middle | 0 | 0 | 16 | 0 | 0 | 0 | 9 |
| DEEP 60 IMPACT | 2012-10-19 | 11 | f2_method_middle | 0 | 0 | 18 | 0 | 0 | 0 | 11 |
| DEEP 59 IMPACT | 2012-08-18 | 12 | f2_method_middle | 0 | 0 | 21 | 0 | 0 | 2 | 12 |
| DEEP 58 IMPACT | 2012-06-15 | 11 | f2_method_middle | 0 | 0 | 19 | 0 | 0 | 0 | 11 |
| DEEP 57 IMPACT | 2012-02-18 | 15 | f2_method_middle | 0 | 0 | 27 | 0 | 0 | 0 | 16 |
| DEEP 56 IMPACT | 2011-12-16 | 10 | f2_method_middle | 0 | 0 | 17 | 0 | 0 | 0 | 10 |
| DEEP 55 IMPACT | 2011-08-26 | 10 | f2_method_middle | 0 | 0 | 19 | 0 | 0 | 0 | 10 |
| DEEP 54 IMPACT | 2011-06-24 | 13 | f2_method_middle | 0 | 0 | 25 | 0 | 0 | 0 | 13 |
| DEEP 53 IMPACT | 2011-04-22 | 9 | f2_method_middle | 0 | 0 | 15 | 0 | 0 | 0 | 9 |
| DEEP 52 IMPACT | 2011-02-25 | 11 | f2_method_middle | 0 | 0 | 21 | 0 | 0 | 1 | 12 |
| DEEP 51 IMPACT | 2010-12-11 | 16 | f2_method_middle | 0 | 0 | 28 | 0 | 0 | 0 | 16 |
| DEEP 50 IMPACT | 2010-10-24 | 17 | f2_method_middle | 0 | 0 | 30 | 0 | 0 | 1 | 17 |
| DEEP PROTECT IMPACT 2008 | 2008-12-22 | 11 | group4_detached_mark | 0 | 0 | 20 | 0 | 0 | 0 | 29 |
| DEEP PROTECT IMPACT 2007 in OSAKA | 2007-12-22 | 13 | f2_method_middle | 0 | 0 | 26 | 0 | 2 | 0 | 14 |
| DEEP 45 IMPACT | 2010-01-24 | 17 | group2_no_heading | 0 | 0 | 32 | 0 | 0 | 0 | 0 |

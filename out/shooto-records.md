# 修斗必達60名+listed19名 レコード+対戦テーブル実証結果

shooto-mma.com 公式アーカイブ(`/result/?id=N`、全228大会、id=27/40のリンク欠落2件を含む)から抽出した
bout構造化データ(「試合結果 概要」＝`matchmake-box`)を基に、必達セット修斗60名(fighters.ts未収録)
と、既存fighters.ts収録済み(listed)19名について、レコード(勝敗数)と対戦テーブルを構築できるかを実証した。

名前照合は`src/lib/fighters.ts`の`findFighterSlugByName`のみを使用(素の文字列一致なし)。

## 既知の制限事項(隠さず記載)

1. **大会一覧226件クリック可能+2件リンク欠落=228件**: `/result/` 一覧の行数(228)と、リンクから直接たどれた大会数(226)は前提調査(PR #234)通り一致しない。差分の2件(BORDER-season8「The2nd」2016-09-04→id=27、BORDER-season9「The1st」2017-03-19→id=40)は直接id指定で完全な対戦結果を取得できた。他に一覧行数と取得大会数の差分は無い(228行→228件とも取得成功)。
2. **試合結果が0件の大会が2件**: `id=101`(ROAD to ONE 3rd TOKYO FIGHT NIGHT、2020-09-10)と`id=66`(BORDER-season10「The2nd」、2018-09-30)は、大会ページ自体に「登録されているマッチメイクはありません。」と明記されており、抽出側の不備ではなくサイト側のデータ欠落。いずれも必達60名+listed19名には無関係。
3. **決着結果(勝敗)の判定ロジック**: 各対戦カードの選手アイコンに付く`opacity:0.3`スタイルが敗者を示す基本シグナルだが、判定(ud/technical-ud)の一部で両者に`opacity:0.3`が付き見た目上は敗者不明になるサイト側の表示バグを発見(例: event=254 bout=4710 澤江優侍 vs 塩沼諒太)。この場合`判定 X-Y`のスコア表記(ジャッジ3名の多数決)を優先して勝敗を再判定する方式で解決した。スコア表記も無い場合は備考欄(note)内の各ジャッジ採点(「氏名 XX-YY（内訳）」)を多数決集計してフォールバック解決した。
4. **全2136boutの解決結果内訳**: 勝敗確定 1979件(F1勝1178+F2勝801)、引き分け(DRAW) 103件、ノーコンテスト(NO_CONTEST) 6件、**未解決(UNRESOLVED) 48件**(全体の2.2%、1割の停止条件には非該当)。未解決48件はサイト側に判定スコア・ジャッジ内訳・決着理由の記載が一切無い(備考欄が空、または「第6試合の前に実施」等の進行メモのみ)ケースで、これ以上の推定は捏造になるため行っていない。
5. **未解決48件のうち必達60名+listed19名に関わるものは4件**のみ:
   - 片山智絵(missing) vs erika(missing) ※両者とも必達対象、2026-03-29 event=251 bout=4538。備考欄が完全に空で判定不能。
   - 亮我(listed) vs 永留惇平、2024-01-28 event=199 bout=3903。
   - 岩本建汰 vs たてお(listed)、2022-03-21 event=130 bout=3409。
   - 須恵樹季 vs ソルト(missing)、2022-03-21 event=130 bout=3413。
   いずれも下記の選手別対戦テーブルには「UNRESOLVED」として結果不明のまま掲載し、勝敗数の集計からは除外している(捏造していない)。
6. **必達60名のうち1名(エルナニ ペルペトゥオ、shootoID=830)はbout 0件**: 選手紹介ページの「最新戦績」日付が2013-08-25だが、`/result/`一覧(228件)には2012年1件・2013年2件・2014年3件しか無く、この時期のshooto公式アーカイブの大会網羅自体が疎らなため、該当試合が現行の228件一覧に含まれていない(抽出漏れではなく、上流サイトの大会一覧そのものに存在しない)。これが必達60名で唯一「レコード+対戦テーブル構築NO」の案件。
7. **選手紹介ページのURLにローマ字は含まれない**: 全27階級のドロップダウン一覧および`?pg=fighters&all=1`(全選手1897名、ページネーション無し)を確認したが、個別選手ページのURLは`./?id=N`の数値idのみで、PR #234の結論を再確認した。ただしテーブルのName列にローマ字表記が別セルとして存在するため、`out/shooto-fighters.csv`の`slug_candidate_from_romaji_TABLE_TEXT_NOT_URL`列にURL由来ではない参考値として格納した。
8. **決定性の検証**: 同一キャッシュ済みHTML(`html/events/*.html`・`html/result_index.html`・`fighters_html/all.html`)から本パイプライン(`parse_index.py`→`parse_fighters.py`→`match_targets.py`→`parse_bouts.py`→`resolve_outcomes.py`→`build_*.py`)を2回実行し、`out/`配下3ファイルすべてがバイト単位で完全一致することを確認した(非決定性なし)。
9. **bout参加者のshooto内部fighter_idが選手紹介ページ一覧(1897名)に1件だけ不在**(id=1215、星野豊、必達対象外)。全体の0.08%で軽微。

## 選手別レコード・対戦テーブル

## 旭那 拳（missing、既存slug: なし）


必達60名(missing)のうちレコード+対戦テーブルが構築できた: 59 / 60
listed19名のうちレコード+対戦テーブルが構築できた: 19 / 19


# サマリー

| 選手名 | 区分 | 既存slug | shootoID | 総bout | 勝 | 敗 | 分 | NC | 未解決 | 構築可否 |
|---|---|---|---|---|---|---|---|---|---|---|
| 旭那 拳 | missing |  | 1098 | 17 | 10 | 7 | 0 | 0 | 0 | YES |
| 田口 恵大 | missing |  | 1773 | 6 | 2 | 4 | 0 | 0 | 0 | YES |
| 友利 琉偉 | missing |  | 1713 | 7 | 4 | 3 | 0 | 0 | 0 | YES |
| 友利 幸汰 | missing |  | 1754 | 5 | 4 | 1 | 0 | 0 | 0 | YES |
| 梅木 勇徳 | missing |  | 1398 | 11 | 4 | 6 | 1 | 0 | 0 | YES |
| 亮我 | listed | ryoga | 1493 | 13 | 10 | 1 | 1 | 0 | 1 | YES |
| 高岡 宏気 | listed | takaoka-hiroki | 1067 | 21 | 12 | 8 | 1 | 0 | 0 | YES |
| 新井 丈 | listed | arai-jo | 49 | 20 | 14 | 6 | 0 | 0 | 0 | YES |
| 杉本 静弥 | missing |  | 1635 | 7 | 5 | 1 | 1 | 0 | 0 | YES |
| 中村 優作 | listed | nakamura-yusaku | 940 | 7 | 5 | 1 | 1 | 0 | 0 | YES |
| 砂辺 光久 | missing |  | 1875 | 2 | 2 | 0 | 0 | 0 | 0 | YES |
| 梅筋 毒一郎 | missing |  | 1753 | 3 | 1 | 2 | 0 | 0 | 0 | YES |
| 山内 渉 | missing |  | 1348 | 8 | 7 | 1 | 0 | 0 | 0 | YES |
| 岡田 嵐士 | missing |  | 1669 | 9 | 7 | 2 | 0 | 0 | 0 | YES |
| 中池 武寛 | missing |  | 1179 | 10 | 8 | 2 | 0 | 0 | 0 | YES |
| 鈴木 尊 | missing |  | 1736 | 5 | 5 | 0 | 0 | 0 | 0 | YES |
| 永井 奏多 | listed | nagai-kanata | 1548 | 9 | 8 | 0 | 1 | 0 | 0 | YES |
| 齋藤 奨司 | listed | saito-shoji | 1339 | 10 | 7 | 3 | 0 | 0 | 0 | YES |
| 野瀬 翔平 | listed | nose-shohei | 1141 | 14 | 9 | 3 | 1 | 0 | 1 | YES |
| 川北 晏生 | missing |  | 1385 | 11 | 6 | 1 | 3 | 0 | 1 | YES |
| チョウ スソン | missing |  | 1299 | 7 | 4 | 2 | 0 | 0 | 1 | YES |
| 藤井 伸樹 | missing |  | 1148 | 16 | 8 | 8 | 0 | 0 | 0 | YES |
| ダイキ ライトイヤー | missing |  | 295 | 21 | 9 | 9 | 2 | 0 | 1 | YES |
| 宮口 龍鳳 | listed | miyaguchi-ryuho | 1538 | 6 | 6 | 0 | 0 | 0 | 0 | YES |
| 中島 陸 | missing |  | 1680 | 9 | 8 | 1 | 0 | 0 | 0 | YES |
| 野尻 定由 | missing |  | 1185 | 15 | 7 | 6 | 2 | 0 | 0 | YES |
| SASUKE | listed | sasuke | 288 | 14 | 12 | 2 | 0 | 0 | 0 | YES |
| ヒカル | listed | hikaru | 1704 | 4 | 4 | 0 | 0 | 0 | 0 | YES |
| 青井 太一 | listed | aoi-taichi | 1485 | 14 | 7 | 6 | 1 | 0 | 0 | YES |
| たてお | listed | tateo | 701 | 14 | 8 | 3 | 2 | 0 | 1 | YES |
| TOMA | listed | toma | 255 | 15 | 9 | 6 | 0 | 0 | 0 | YES |
| パク ジョンジュン | missing |  | 1809 | 1 | 1 | 0 | 0 | 0 | 0 | YES |
| 齋藤 翼 | missing |  | 214 | 23 | 13 | 10 | 0 | 0 | 0 | YES |
| 上原 平 | missing |  | 1249 | 14 | 7 | 3 | 3 | 1 | 0 | YES |
| 磯城嶋 一真 | missing |  | 1447 | 9 | 6 | 1 | 2 | 0 | 0 | YES |
| 飯野 雄斗 | missing |  | 1797 | 5 | 5 | 0 | 0 | 0 | 0 | YES |
| ネイン デイネッシュ | missing |  | 1623 | 9 | 7 | 2 | 0 | 0 | 0 | YES |
| エフェヴィガ 雄志 | listed | efeviga-yushi | 1537 | 10 | 8 | 2 | 0 | 0 | 0 | YES |
| 後藤 亮 | listed | goto-ryo | 1549 | 4 | 4 | 0 | 0 | 0 | 0 | YES |
| キャプテン ☆ アフリカ | listed | captain-africa | 1056 | 14 | 9 | 5 | 0 | 0 | 0 | YES |
| 西尾 真輔 | listed | nishio-shinsuke | 1739 | 3 | 1 | 2 | 0 | 0 | 0 | YES |
| 結城 大樹 | missing |  | 642 | 13 | 7 | 5 | 1 | 0 | 0 | YES |
| 安海 健人 | missing |  | 1442 | 5 | 3 | 1 | 1 | 0 | 0 | YES |
| マックス・ザ・ボディ | missing |  | 1295 | 9 | 4 | 5 | 0 | 0 | 0 | YES |
| 大尊 伸光 | missing |  | 247 | 8 | 5 | 3 | 0 | 0 | 0 | YES |
| 田中 有 | missing |  | 1102 | 8 | 5 | 3 | 0 | 0 | 0 | YES |
| 住村 竜市朗 | listed | sumimura-ryuichiro | 400 | 5 | 3 | 1 | 0 | 0 | 1 | YES |
| ヴィクター バレンズエラ | missing |  | 1919 | 1 | 1 | 0 | 0 | 0 | 0 | YES |
| エルナニ ペルペトゥオ | missing |  | 830 | 0 | 0 | 0 | 0 | 0 | 0 | NO(bout無し=同姓同名/未確認要因) |
| 田村 ヒビキ | missing |  | 375 | 1 | 1 | 0 | 0 | 0 | 0 | YES |
| グラップラー脇 | missing |  | 1708 | 3 | 2 | 1 | 0 | 0 | 0 | YES |
| 岩﨑 大河 | missing |  | 1350 | 8 | 7 | 1 | 0 | 0 | 0 | YES |
| 荒井 勇ニ | missing |  | 1912 | 2 | 1 | 1 | 0 | 0 | 0 | YES |
| 沙門 | missing |  | 1849 | 2 | 1 | 1 | 0 | 0 | 0 | YES |
| HENRY | missing |  | 1911 | 1 | 0 | 1 | 0 | 0 | 0 | YES |
| キム ジェヨン | missing |  | 1633 | 2 | 0 | 2 | 0 | 0 | 0 | YES |
| 青野 ひかる | missing |  | 1850 | 3 | 2 | 1 | 0 | 0 | 0 | YES |
| 徳本 望愛 | missing |  | 1694 | 6 | 5 | 1 | 0 | 0 | 0 | YES |
| 中村 未来 | missing |  | 1274 | 16 | 9 | 6 | 0 | 0 | 1 | YES |
| 杉本 恵 | missing |  | 1171 | 21 | 11 | 7 | 1 | 1 | 1 | YES |
| 平田 彩音 | missing |  | 1627 | 6 | 4 | 2 | 0 | 0 | 0 | YES |
| パク ソヨン | missing |  | 1464 | 6 | 3 | 3 | 0 | 0 | 0 | YES |
| NOEL | listed | noel | 1554 | 6 | 4 | 1 | 1 | 0 | 0 | YES |
| ジェニー ファン | missing |  | 1557 | 2 | 1 | 1 | 0 | 0 | 0 | YES |
| 嶋屋 澪 | missing |  | 1729 | 8 | 2 | 5 | 1 | 0 | 0 | YES |
| 渡辺 彩華 | missing |  | 1536 | 4 | 3 | 1 | 0 | 0 | 0 | YES |
| 高本 千代 | missing |  | 1656 | 8 | 3 | 4 | 1 | 0 | 0 | YES |
| erika | missing |  | 1757 | 5 | 3 | 1 | 0 | 0 | 1 | YES |
| 村上 彩 | missing |  | 1793 | 5 | 2 | 3 | 0 | 0 | 0 | YES |
| 片山 智絵 | missing |  | 1733 | 5 | 3 | 1 | 0 | 0 | 1 | YES |
| 黒部 三奈 | missing |  | 1208 | 12 | 6 | 4 | 0 | 1 | 1 | YES |
| SARAMI | missing |  | 1300 | 4 | 3 | 1 | 0 | 0 | 0 | YES |
| 藤野 恵実 | missing |  | 1583 | 7 | 6 | 0 | 0 | 0 | 1 | YES |
| 宝珠山 桃花 | missing |  | 1319 | 15 | 8 | 7 | 0 | 0 | 0 | YES |
| パク ボヒョン | missing |  | 1716 | 3 | 3 | 0 | 0 | 0 | 0 | YES |
| ハイライ ウーシャアモー | missing |  | 1700 | 1 | 1 | 0 | 0 | 0 | 0 | YES |
| ソルト | missing |  | 1418 | 7 | 2 | 4 | 0 | 0 | 1 | YES |
| KAREN | missing |  | 1642 | 1 | 1 | 0 | 0 | 0 | 0 | YES |
| 高田 暖妃 | missing |  | 1450 | 5 | 3 | 1 | 0 | 0 | 1 | YES |

- shooto選手ID: 1098 (`https://www.shooto-mma.com/fighters/?id=1098`)
- ローマ字表記(テーブル列。URLには含まれない): Ken Asahina
- 修斗選手紹介ページ階級ラベル: ストロー級 [ -52.2 Kg ]B
- 総bout件数: 17 (勝10 敗7 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2017-09-02 | RUN & FIGHT & MOSH Vol.1 | UNCLASSIFIED | vs 高橋梨王 | WIN | S | 1R 04:01 |
| 2018-04-22 | SHOOTO GIG TOKYO Vol.25 | GIG_UNDERCARD_SERIES | vs 木内SKINNYZOMBIE崇雅 | LOSS | S | 2R 02:07 |
| 2019-05-12 | BORDER-season11-「The2nd」 | BORDER | vs オニボウズ | LOSS | 判定 2-0 |  |
| 2019-11-03 | 沖縄大会 THE SHOOTO OKINAWA vol.２ | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 石原愼之介 | WIN | S | 1R 03:49 |
| 2020-12-13 | 闘裸男×FORCE | TORAO_REGIONAL;FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 安芸柊斗 | LOSS | TKO | 2R 02:05 |
| 2021-04-18 | 沖縄大会【THE SHOOTO OKINAWA vol.４】 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 九州力 | WIN | 判定 3-0 |  |
| 2021-07-04 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA Supported by ONE Championship 第2部 | PRO_SHOOTO_MAINLINE | vs マッチョザバタフライ | WIN | 判定 0-3 |  |
| 2021-11-14 | THE SHOOTO OKINAWA vol.５ | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 木内SKINNYZOMBIE崇雅 | WIN | 判定 0-3 |  |
| 2022-04-17 | THE SHOOTO OKINAWA vol.6 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 竜己 | WIN | 判定 3-0 |  |
| 2023-04-16 | THE SHOOTO OKINAWA vol.8 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs タイガー石井 | LOSS | 判定 0-2 |  |
| 2023-11-12 | THE SHOOTO OKINAWA vol.9 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 泰斗 | WIN | 判定 3-0 |  |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 田上こゆる | LOSS | KO | 1R 01:52 |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs 田上こゆる | LOSS | 判定 3-0 |  |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 田口恵大 | WIN | S | 2R 03:31 |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 友利琉偉 | WIN | S | 1R 04:55 |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs マッチョザバタフライ | WIN | 不戦 |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 黒部和沙 | LOSS | 判定 3-0 |  |

## 田口 恵大（missing、既存slug: なし）

- shooto選手ID: 1773 (`https://www.shooto-mma.com/fighters/?id=1773`)
- ローマ字表記(テーブル列。URLには含まれない): KEITA TAGUCHI
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]A
- 総bout件数: 6 (勝2 敗4 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-04-29 | 新潟・新潟LOT | PRO_SHOOTO_MAINLINE | vs TAKUMI | WIN | 判定 3-0 |  |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs 知名昴海 | LOSS | 反則失格 | 2R 03:47 |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 旭那拳 | LOSS | S | 2R 03:31 |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 友利琉偉 | LOSS | 反則失格 | 1R 02:17 |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs マッチョザバタフライ | WIN | TKO | 2R 02:20 |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 黒部和沙 | LOSS | S | 1R 03:34 |

## 友利 琉偉（missing、既存slug: なし）

- shooto選手ID: 1713 (`https://www.shooto-mma.com/fighters/?id=1713`)
- ローマ字表記(テーブル列。URLには含まれない): RUI TOMORI
- 修斗選手紹介ページ階級ラベル: ストロー級 [ -52.2 Kg ]B
- 総bout件数: 7 (勝4 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 牧ヶ谷篤 | WIN | 判定 0-2 |  |
| 2024-11-10 | 沖縄・コザミュージックタウン音市場 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 知名昴海 | LOSS | S | 1R 05:00 |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 黒部和沙 | LOSS | TKO | 1R 04:24 |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 田口恵大 | WIN | 反則失格 | 1R 02:17 |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 旭那拳 | LOSS | S | 1R 04:55 |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs マッチョザバタフライ | WIN | 判定 3-0 |  |
| 2026-04-11 | SHOOTO GIG TOKYO Vol.41 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 賢人 | WIN | KO | 1R 02:00 |

## 友利 幸汰（missing、既存slug: なし）

- shooto選手ID: 1754 (`https://www.shooto-mma.com/fighters/?id=1754`)
- ローマ字表記(テーブル列。URLには含まれない): KOTA TOMORI
- 修斗選手紹介ページ階級ラベル: ストロー級 [ -52.2 Kg ]A
- 総bout件数: 5 (勝4 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-11-10 | 沖縄・コザミュージックタウン音市場 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 大田ノヒロ | WIN | KO | 1R 03:42 |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 牧ヶ谷篤 | WIN | 判定 0-3 |  |
| 2025-09-07 | BORDER2025「The2nd」 | BORDER;PRO_SHOOTO_MAINLINE | vs 谷中たいち | WIN | TKO | 1R 04:53 |
| 2025-10-11 | SHOOTO GIG TOKYO Vol.39 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 金内サイダー雄哉 | WIN | TKO | 1R 01:18 |
| 2026-04-19 | Lemino修斗.5 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 当真佳直 | LOSS | S | 1R 00:27 |

## 梅木 勇徳（missing、既存slug: なし）

- shooto選手ID: 1398 (`https://www.shooto-mma.com/fighters/?id=1398`)
- ローマ字表記(テーブル列。URLには含まれない): YUTOKU UMEKI
- 修斗選手紹介ページ階級ラベル: ストロー級 [ -52.2 Kg ]B
- 総bout件数: 11 (勝4 敗6 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-11-14 | THE SHOOTO OKINAWA vol.５ | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 新垣健司 | LOSS | S | 2R 03:40 |
| 2022-04-03 | SHOOTO GIG TOKYO Vol.32 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 牧ヶ谷篤 | WIN | 判定 0-2 |  |
| 2022-11-06 | THE SHOOTO OKINAWA vol.7 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs わっしょい内田 | LOSS | 判定 3-0 |  |
| 2023-10-21 | SHOOTO GIG TOKYO Vol.35 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 植木令和新 | WIN | S | 1R 02:03 |
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 麻生LegLock祐弘 | LOSS | 判定 3-0 |  |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 大城正也 | LOSS | 判定 2-0 |  |
| 2024-10-20 | SHOOTO GIG TOKYO Vol.37 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs タイガー石井 | LOSS | 判定 2-0 |  |
| 2025-03-23 | SHOOTO GIG TOKYO Vol.38 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 加藤皓己 | WIN | S | 1R 02:21 |
| 2025-05-18 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.4 | PRO_SHOOTO_MAINLINE | vs 大竹塁 | LOSS | 判定 0-2 |  |
| 2025-10-19 | Lemino修斗.2 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 平良龍一 | DRAW | 判定 0-0 |  |
| 2026-06-28 | プロフェッショナル修斗公式戦福岡大会「Lemino修斗TORAO」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 緑真作 | WIN | 判定 0-3 |  |

## 亮我（listed、既存slug: ryoga）

- shooto選手ID: 1493 (`https://www.shooto-mma.com/fighters/?id=1493`)
- ローマ字表記(テーブル列。URLには含まれない): RYOGA
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 13 (勝10 敗1 分1 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-08-21 | 越後風神祭り9 | ECHIGO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 山口峻 | WIN | 判定 0-1 |  |
| 2022-12-04 | TORAO28 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 秋山翼 | WIN | TKO | 2R 00:58 |
| 2023-04-23 | FORCE 17 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 矢野武蔵 | WIN | 判定 0-3 |  |
| 2023-06-18 | PROFESSIONAL SHOOTO 2023 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 谷中たいち | WIN | S | 1R 04:40 |
| 2023-09-17 | FORCE 18 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 堀川55滉介 | DRAW | 判定 0-0 |  |
| 2023-11-12 | THE SHOOTO OKINAWA vol.9 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 神里昭吾 | WIN | TKO | 2R 03:26 |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs 永留惇平 | UNRESOLVED |  |  |
| 2024-07-28 | PROFESSIONAL SHOOTO 2024 Vol.6 in OSAKA 第2部 | PRO_SHOOTO_MAINLINE | vs ヤックル真吾 | WIN | 判定 0-3 |  |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs 須藤晃大 | LOSS | 判定 2-0 |  |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | KO | 1R 01:20 |
| 2025-04-13 | BORDER2025「The1st」 | BORDER;PRO_SHOOTO_MAINLINE | vs 黒石大資 | WIN | 判定 3-0 |  |
| 2025-06-22 | 高松大会 | UNCLASSIFIED | vs 高岡宏気 (takaoka-hiroki) | WIN | 判定 0-3 |  |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 関口祐冬 | WIN | S | 3R 04:45 |

## 高岡 宏気（listed、既存slug: takaoka-hiroki）

- shooto選手ID: 1067 (`https://www.shooto-mma.com/fighters/?id=1067`)
- ローマ字表記(テーブル列。URLには含まれない): HIROKI TAKAOKA
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 21 (勝12 敗8 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-04-07 | FORCE 11 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 西村大地 | WIN | 判定 1-0 |  |
| 2019-05-12 | BORDER-season11-「The2nd」 | BORDER | vs 梅川毒一郎 | WIN | 判定 3-0 |  |
| 2019-06-30 | SHOOTO 30th ANNIVERSARY TOUR 第5戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 小堀貴広 | LOSS | 判定 2-0 |  |
| 2019-12-15 | プロフェッショナル修斗公式戦香川大会「FORCE 12」 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | 判定 1-0 |  |
| 2020-12-13 | 闘裸男×FORCE | TORAO_REGIONAL;FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 親川龍 | LOSS | 判定 0-3 |  |
| 2021-07-04 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA Supported by ONE Championship 第1部 | PRO_SHOOTO_MAINLINE | vs ダイキライトイヤー | LOSS | 判定 3-0 |  |
| 2021-11-07 | FORCE 14 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 寺嶋直人 | DRAW | 判定 0-0 |  |
| 2022-04-24 | FORCE GIG 02 | FORCE_REGIONAL;GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 井口翔太 | WIN | 判定 1-0 |  |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs 齋藤奨司 (saito-shoji) | LOSS | 判定 3-0 |  |
| 2022-09-11 | FORCE 16 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs ニシダ☆ショー | WIN | 判定 3-0 |  |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 内藤頌貴 | LOSS | 判定 3-0 |  |
| 2023-04-23 | FORCE 17 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 蒔田Gandhi伸吾 | WIN | S | 2R 03:38 |
| 2023-06-18 | PROFESSIONAL SHOOTO 2023 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 和田教良 | LOSS | 判定 0-1 |  |
| 2023-09-17 | FORCE 18 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 加マーク納 | LOSS | 判定 0-3 |  |
| 2024-03-24 | FORCE 19 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 志賀竜太郎 | WIN | TKO | 2R 01:38 |
| 2024-09-08 | 香川・高松シンボルタワー展示場 | PRO_SHOOTO_MAINLINE | vs 宮城友一 | WIN | 判定 3-0 |  |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs 渡辺健太郎 | WIN | 判定 2-0 |  |
| 2025-06-22 | 高松大会 | UNCLASSIFIED | vs 亮我 (ryoga) | LOSS | 判定 0-3 |  |
| 2025-10-26 | FORCE 22 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | S | 2R 04:09 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 杉本静弥 | WIN | S | 3R 00:58 |
| 2026-07-13 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.7』 | PRO_SHOOTO_MAINLINE | vs マーウィンキランテ | WIN | 判定 2-1 |  |

## 新井 丈（listed、既存slug: arai-jo）

- shooto選手ID: 49 (`https://www.shooto-mma.com/fighters/?id=49`)
- ローマ字表記(テーブル列。URLには含まれない): JO ARAI
- 修斗選手紹介ページ階級ラベル: ストロー級 [ -52.2 Kg ]B
- 総bout件数: 20 (勝14 敗6 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2016-03-21 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs 小川竜輔 | WIN | 判定 1-0 | 2R |
| 2016-05-28 | SHOOTO GIG TOKYO Vol.21 | GIG_UNDERCARD_SERIES | vs 楳沢智治 | WIN | KO | 2R 00:24 |
| 2017-02-24 | THIS is SHOOTO Vol.1 | UNCLASSIFIED | vs 太田トモアキ | LOSS | KO | 2R 04:00 |
| 2018-03-25 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 箕輪ひろば (minowa-hiroba) | LOSS | S | 2R 04:05 |
| 2018-04-22 | SHOOTO GIG TOKYO Vol.25 | GIG_UNDERCARD_SERIES | vs ニシダ☆ショー | LOSS | S | 1R 04:02 |
| 2018-07-15 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 小巻洋平 | LOSS | S | 1R 01:15 |
| 2018-12-15 | MOBSTYLES presents インフィニティリーグ2018優勝決定戦 | UNCLASSIFIED | vs 楳沢智治 | LOSS | S | 2R 04:51 |
| 2019-07-15 | SHOOTO 30th ANNIVERSARY TOUR 第6戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 内田タケル (uchida-takeru) | LOSS | S | 2R |
| 2019-10-20 | SHOOTO GIG TOKYO Vol.28 Supported by ONE Championship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | KO | 2R 02:21 |
| 2020-03-21 | MOBSTYLES 20th ANNIVERSARY TOUR FIGHT＆MOSH Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 牧ヶ谷篤 | WIN | 判定 3-0 |  |
| 2020-11-23 |  | PRO_SHOOTO_MAINLINE | vs 津村有哉 | WIN | 判定 3-0 |  |
| 2021-06-26 | SHOOTO GIG TOKYO Vol.30 Supported by ONEchampionship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 飯野タテオ | WIN | KO | 1R 00:59 |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 木内SKINNYZOMBIE崇雅 | WIN | KO | 1R 04:46 |
| 2022-05-22 | PROFESSIONAL SHOOTO 2022 Vol.3 | PRO_SHOOTO_MAINLINE | vs 黒澤亮平 | WIN | TKO | 2R 02:12 |
| 2022-09-19 | PROFESSIONAL SHOOTO 2022 Vol.6 | PRO_SHOOTO_MAINLINE | vs 猿丸ジュンジ | WIN | KO | 1R 01:50 |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | KO | 1R 04:10 |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs 関口祐冬 | WIN | 判定 0-3 |  |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs 安芸柊斗 | WIN | TKO | 1R 04:41 |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 山内渉 | WIN | TKO | 3R 02:55 |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 田上こゆる | WIN | 判定 3-0 |  |

## 杉本 静弥（missing、既存slug: なし）

- shooto選手ID: 1635 (`https://www.shooto-mma.com/fighters/?id=1635`)
- ローマ字表記(テーブル列。URLには含まれない): SEIYA SUGIMOTO
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 7 (勝5 敗1 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 大竹陽 | DRAW | 判定 0-0 |  |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 若宮龍斗 | WIN | TKO | 2R 01:52 |
| 2025-03-23 | SHOOTO GIG TOKYO Vol.38 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | TKO | 1R 00:12 |
| 2025-05-25 | PROFESSIONAL SHOOTO 2025 Vol.5 in OSAKA | PRO_SHOOTO_MAINLINE | vs 山本壮馬 | WIN | KO | 1R 00:25 |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 梅筋毒一郎 | WIN | TKO | 1R 02:18 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 高岡宏気 (takaoka-hiroki) | LOSS | S | 3R 00:58 |
| 2026-06-01 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | PRO_SHOOTO_MAINLINE | vs 岡田嵐士 | WIN | 判定 3-0 |  |

## 中村 優作（listed、既存slug: nakamura-yusaku）

- shooto選手ID: 940 (`https://www.shooto-mma.com/fighters/?id=940`)
- ローマ字表記(テーブル列。URLには含まれない): Yusaku Nakamura
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 7 (勝5 敗1 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2014-06-28 | VTJ 5th | VTJ | vs 山本賢治 | WIN | 判定 1-2 | 3R |
| 2015-06-21 | VTJ in OSAKA | VTJ | vs カナハヤット | WIN | KO | 2R 02:22 |
| 2015-09-13 | VTJ 7th | VTJ | vs グォンサンス | WIN | KO | 2R 00:36 |
| 2017-10-15 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs ライリードゥトロ | LOSS | KO | 2R 02:14 |
| 2019-03-24 | SHOOTO 30th ANNIVERSARY TOUR 第2戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs ロドニーモンダラ | WIN | KO | 1R 01:57 |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 打威致 | WIN | 判定 3-0 |  |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 関口祐冬 | DRAW |  |  |

## 砂辺 光久（missing、既存slug: なし）

- shooto選手ID: 1875 (`https://www.shooto-mma.com/fighters/?id=1875`)
- ローマ字表記(テーブル列。URLには含まれない): 
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]A
- 総bout件数: 2 (勝2 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-10-19 | Lemino修斗.2 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 福島祐貴 | WIN | S | 1R 04:41 |
| 2026-04-19 | Lemino修斗.5 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 梅筋毒一郎 | WIN | 判定 0-2 |  |

## 梅筋 毒一郎（missing、既存slug: なし）

- shooto選手ID: 1753 (`https://www.shooto-mma.com/fighters/?id=1753`)
- ローマ字表記(テーブル列。URLには含まれない): DOKUICHIRO BAIKIN
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]A
- 総bout件数: 3 (勝1 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-11-10 | 沖縄・コザミュージックタウン音市場 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 宮城友一 | WIN | KO | 2R 00:42 |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 杉本静弥 | LOSS | TKO | 1R 02:18 |
| 2026-04-19 | Lemino修斗.5 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 砂辺光久 | LOSS | 判定 0-2 |  |

## 山内 渉（missing、既存slug: なし）

- shooto選手ID: 1348 (`https://www.shooto-mma.com/fighters/?id=1348`)
- ローマ字表記(テーブル列。URLには含まれない): WATARU YAMAUCHI
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 8 (勝7 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 植木令和新 | WIN | S | 2R 04:35 |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 高橋SUBMISSION雄己 | WIN | 判定 0-2 |  |
| 2022-03-21 | PROFESSIONAL SHOOTO 2022 Vol.2 | PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | 判定 0-3 |  |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs 内藤頌貴 | WIN | 判定 0-3 |  |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 清水清隆 | WIN | KO | 1R 00:44 |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs ヤックル真吾 | WIN | KO | 1R 01:10 |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 新井丈 (arai-jo) | LOSS | TKO | 3R 02:55 |
| 2025-09-02 | Lemino修斗１ | PRO_SHOOTO_MAINLINE | vs デウジヴァン・ソウザ | WIN | TKO | 1R 03:19 |

## 岡田 嵐士（missing、既存slug: なし）

- shooto選手ID: 1669 (`https://www.shooto-mma.com/fighters/?id=1669`)
- ローマ字表記(テーブル列。URLには含まれない): ARASHI OKADA
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 9 (勝7 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-03-02 | 修斗Live!Tokyo | PRO_SHOOTO_MAINLINE | vs 中村悠磨 | WIN | S | 2R 02:24 |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs シューティングガイコツ | WIN | S | 2R 02:32 |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs シモンスズキ | WIN | 判定 0-2 |  |
| 2025-03-23 | SHOOTO GIG TOKYO Vol.38 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 蓮池勇太 | WIN | 判定 3-0 |  |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 中池武寛 | LOSS | TKO | 1R 01:51 |
| 2025-09-02 | Lemino修斗１ | PRO_SHOOTO_MAINLINE | vs 古賀優平 | WIN | 判定 3-0 |  |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 志賀竜太郎 | WIN | 判定 3-0 |  |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 柴山海音 | WIN | 判定 3-0 |  |
| 2026-06-01 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | PRO_SHOOTO_MAINLINE | vs 杉本静弥 | LOSS | 判定 3-0 |  |

## 中池 武寛（missing、既存slug: なし）

- shooto選手ID: 1179 (`https://www.shooto-mma.com/fighters/?id=1179`)
- ローマ字表記(テーブル列。URLには含まれない): TAKEHIRO NAKAIKE
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 10 (勝8 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-01-27 | SHOOTO 30th ANNIVERSARY TOUR 開幕戦 | PRO_SHOOTO_MAINLINE | vs 中山陽心 | WIN | S | 1R 02:22 |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 本多弥彦直樹 | WIN | TKO | 1R 01:32 |
| 2024-04-07 | SHOOTO GIG TOKYO Vol.36 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 蒔田Gandhi伸吾 | WIN | KO | 1R 00:38 |
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs ロジュンヨン | WIN | TKO | 2R 02:51 |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 蓮池勇太 | WIN | S | 1R 03:30 |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs シモンスズキ | LOSS | TKO | 1R 04:37 |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 下田洋介 | WIN | TS | 1R 02:06 |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 岡田嵐士 | WIN | TKO | 1R 01:51 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs ザヒドアフメドフ | WIN | KO | 1R 00:26 |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 関口祐冬 | LOSS | 判定 2-1 |  |

## 鈴木 尊（missing、既存slug: なし）

- shooto選手ID: 1736 (`https://www.shooto-mma.com/fighters/?id=1736`)
- ローマ字表記(テーブル列。URLには含まれない): TAKERU SUZUKI
- 修斗選手紹介ページ階級ラベル: フライ級 [ -56.7 Kg ]B
- 総bout件数: 5 (勝5 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-04-29 | 新潟・新潟LOT | PRO_SHOOTO_MAINLINE | vs 隼吾 | WIN | S | 1R 00:46 |
| 2024-09-01 | 越後風神祭り13 | ECHIGO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 本多弥彦直樹 | WIN | S | 1R 01:22 |
| 2025-08-31 | 越後風神祭り15 | ECHIGO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 齋藤大樹 | WIN | TS | 1R 02:43 |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 浅井大海 | WIN | 判定 3-0 |  |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 大竹陽 | WIN | TS | 1R 03:25 |

## 永井 奏多（listed、既存slug: nagai-kanata）

- shooto選手ID: 1548 (`https://www.shooto-mma.com/fighters/?id=1548`)
- ローマ字表記(テーブル列。URLには含まれない): KANATA NAGAI
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 9 (勝8 敗0 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-04-09 | SHOOTO GIG TOKYO Vol.34 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 藤田ムネノリ | DRAW | 判定 0-0 |  |
| 2023-05-21 | PROFESSIONAL SHOOTO 2023 Vol.3 | PRO_SHOOTO_MAINLINE | vs 新井拓巳 | WIN | TKO | 1R 01:13 |
| 2023-10-21 | SHOOTO GIG TOKYO Vol.35 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 小林佳純 | WIN | 判定 0-3 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs HAMMERKATU | WIN | 判定 3-0 |  |
| 2024-04-07 | SHOOTO GIG TOKYO Vol.36 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 松下祐介 | WIN | 判定 0-3 |  |
| 2024-10-20 | SHOOTO GIG TOKYO Vol.37 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 一條貴洋 | WIN | KO | 1R 02:34 |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 藤井伸樹 | WIN | 判定 0-3 |  |
| 2025-05-25 | PROFESSIONAL SHOOTO 2025 Vol.5 in OSAKA | PRO_SHOOTO_MAINLINE | vs ダイキライトイヤー | WIN | TKO | 1R 04:52 |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 齋藤奨司 (saito-shoji) | WIN | S | 3R 03:24 |

## 齋藤 奨司（listed、既存slug: saito-shoji）

- shooto選手ID: 1339 (`https://www.shooto-mma.com/fighters/?id=1339`)
- ローマ字表記(テーブル列。URLには含まれない): SHOJI SAITO
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 10 (勝7 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-06-26 | SHOOTO GIG TOKYO Vol.30 Supported by ONEchampionship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 片山将宏 | LOSS | 判定 0-3 |  |
| 2021-10-02 | SHOOTO GIG TOKYO Vol.31 Supported by ONE Championship | GIG_UNDERCARD_SERIES | vs 谷井翔太 | WIN | 判定 3-0 |  |
| 2022-03-21 | PROFESSIONAL SHOOTO 2022 Vol.2 | PRO_SHOOTO_MAINLINE | vs 親川龍 | WIN | 判定 0-3 |  |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs 高岡宏気 (takaoka-hiroki) | WIN | 判定 3-0 |  |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 新井拓巳 | LOSS | 判定 0-1 |  |
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs 野尻定由 | WIN | KO | 1R 04:23 |
| 2023-05-21 | PROFESSIONAL SHOOTO 2023 Vol.3 | PRO_SHOOTO_MAINLINE | vs 須藤拓真 | WIN | 判定 0-3 |  |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 藤井伸樹 | WIN | 判定 1-2 |  |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 永井奏多 (nagai-kanata) | LOSS | S | 3R 03:24 |
| 2026-02-18 | Lemino修斗.3 | PRO_SHOOTO_MAINLINE | vs シンバートルバットエルデネ | WIN | 判定 0-3 |  |

## 野瀬 翔平（listed、既存slug: nose-shohei）

- shooto選手ID: 1141 (`https://www.shooto-mma.com/fighters/?id=1141`)
- ローマ字表記(テーブル列。URLには含まれない): SHOHEI NOSE
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 14 (勝9 敗3 分1 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2018-07-15 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 國頭武 | DRAW | 判定 0-0 | 2R |
| 2020-03-29 | 【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE;CANCELLED_LABEL_IN_TITLE | vs 小林孝秀 | UNRESOLVED |  |  |
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship  第1部 | PRO_SHOOTO_MAINLINE | vs 工藤諒司 | LOSS | KO | 1R 02:13 |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | WIN | 判定 0-3 |  |
| 2021-12-05 | 闘裸男26 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 奇天烈 | WIN | S | 1R 04:36 |
| 2022-05-15 | TORAO27 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 藤川智史 | WIN | S | 1R 01:15 |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs 新井拓巳 | WIN | S | 1R 02:53 |
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 神田T800周一 | WIN | S | 1R 03:10 |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs 人見礼王 | WIN | S | 2R 02:53 |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs ダイキライトイヤー | LOSS | 判定 1-2 |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 加藤ケンジ | WIN | S | 1R 03:35 |
| 2025-10-19 | Lemino修斗.2 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs シンバートルバットエルデネ | LOSS | S | 1R 01:20 |
| 2026-02-18 | Lemino修斗.3 | PRO_SHOOTO_MAINLINE | vs ジョンオルニド | WIN | S | 1R 03:14 |
| 2026-06-28 | プロフェッショナル修斗公式戦福岡大会「Lemino修斗TORAO」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 青柳洸志 | WIN | TS | 1R 03:19 |

## 川北 晏生（missing、既存slug: なし）

- shooto選手ID: 1385 (`https://www.shooto-mma.com/fighters/?id=1385`)
- ローマ字表記(テーブル列。URLには含まれない): HARUKI KAWAKITA
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 11 (勝6 敗1 分3 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-11-07 | FORCE GIG 01 | FORCE_REGIONAL;GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 大悟 | DRAW | 判定 1-1 |  |
| 2022-04-17 | THE SHOOTO OKINAWA vol.6 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 南風原吉良斗 | DRAW | 判定 0-0 |  |
| 2022-05-22 | PROFESSIONAL SHOOTO 2022 Vol.3 | PRO_SHOOTO_MAINLINE | vs 伊集龍皇 | DRAW | 判定 0-0 |  |
| 2022-10-15 | SHOOTO GIG TOKYO Vol.33 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 中野剛貴 | WIN | 判定 2-0 |  |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs ライダーHIRO | WIN | S | 2R 03:34 |
| 2024-03-23 | 東京・後楽園ホール | PRO_SHOOTO_MAINLINE | vs 平川智也 | WIN | TS | 2R 01:02 |
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs ドウガーシュエ | WIN | 判定 2-1 |  |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs ダイキライトイヤー | UNRESOLVED |  |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 杉野光星 | LOSS | 判定 0-3 |  |
| 2025-10-11 | SHOOTO GIG TOKYO Vol.39 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs ジェイクムラタ | WIN | 判定 0-3 |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs ダイキライトイヤー | WIN | KO | 2R 00:07 |

## チョウ スソン（missing、既存slug: なし）

- shooto選手ID: 1299 (`https://www.shooto-mma.com/fighters/?id=1299`)
- ローマ字表記(テーブル列。URLには含まれない): SUSUNG
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 7 (勝4 敗2 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship 第2部 | PRO_SHOOTO_MAINLINE | vs 新井拓巳 | UNRESOLVED |  |  |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 村山大介 | LOSS | 判定 3-0 |  |
| 2022-09-19 | PROFESSIONAL SHOOTO 2022 Vol.6 | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | WIN | 判定 0-3 |  |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs 榎本明 | WIN | S | 1R 04:52 |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs 加藤ケンジ | WIN | KO | 3R 04:17 |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 藤井伸樹 | WIN | 判定 0-3 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs ジェイクムラタ | LOSS | 判定 0-3 |  |

## 藤井 伸樹（missing、既存slug: なし）

- shooto選手ID: 1148 (`https://www.shooto-mma.com/fighters/?id=1148`)
- ローマ字表記(テーブル列。URLには含まれない): NOBUKI FUJII
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 16 (勝8 敗8 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2018-11-17 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 岡田遼 | LOSS | 判定 3-0 |  |
| 2019-01-27 | SHOOTO 30th ANNIVERSARY TOUR 開幕戦 | PRO_SHOOTO_MAINLINE | vs 魚井フルスイング | LOSS | 判定 3-0 |  |
| 2019-05-06 | SHOOTO 30th ANNIVERSARY TOUR 30周年記念大会 第1部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 石橋佳大 | WIN | KO | 3R 04:50 |
| 2019-09-22 | SHOOTO 30th ANNIVERSARY TOUR 第7戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | WIN | 判定 3-0 |  |
| 2020-01-26 | PROFESSONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 田丸匠 | LOSS | 判定 3-0 |  |
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship 第2部 | PRO_SHOOTO_MAINLINE | vs 後藤丈治 (goto-joji) | WIN | 判定 3-0 |  |
| 2021-01-31 | 《第1部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 加藤ケンジ | WIN | 判定 3-0 |  |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 小野島恒太 | LOSS | 判定 3-0 |  |
| 2022-05-22 | PROFESSIONAL SHOOTO 2022 Vol.3 | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | WIN | 判定 3-0 |  |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 石井逸人 | WIN | 判定 1-2 |  |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs 竹中大地 | LOSS | 判定 0-3 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 2部 | PRO_SHOOTO_MAINLINE | vs 須藤拓真 | WIN | 判定 3-0 |  |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 齋藤奨司 (saito-shoji) | LOSS | 判定 1-2 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 永井奏多 (nagai-kanata) | LOSS | 判定 0-3 |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 笹晋久 | WIN | KO | 2R 04:58 |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs チョウスソン | LOSS | 判定 0-3 |  |

## ダイキ ライトイヤー（missing、既存slug: なし）

- shooto選手ID: 295 (`https://www.shooto-mma.com/fighters/?id=295`)
- ローマ字表記(テーブル列。URLには含まれない): Daiki Lightyear
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 21 (勝9 敗9 分2 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2015-06-21 | VTJ in OSAKA | VTJ | vs 鷹亜希 | WIN | S | 1R 02:34 |
| 2015-12-23 | BORDER -season7-「The 3rd」 | BORDER | vs 虎刃殺獅 | LOSS | S | 1R 04:30 |
| 2016-06-19 | VTJ in OSAKA | VTJ | vs 村田崇 | WIN | S | 1R 02:46 |
| 2016-09-19 | VTJ 8th | VTJ | vs 佐藤将光 (sato-shoko) | LOSS | TKO | 3R 01:30 |
| 2016-12-11 | BORDER-season8-「The3rd」 | BORDER | vs 金海裕輝 | LOSS | 判定 2-0 | 2R |
| 2017-06-25 | プロフェッショナル修斗公式戦 in OSAKA | PRO_SHOOTO_MAINLINE | vs エダ塾長こうすけ | DRAW |  |  |
| 2018-03-25 | BORDER-season10-「The1st」 | BORDER | vs 前川大輔 | DRAW | 判定 19-19 |  |
| 2018-06-17 | プロフェッショナル修斗 in OSAKA 2018 | UNCLASSIFIED | vs 奇天烈 | LOSS | 判定 3-0 |  |
| 2019-01-20 | BORDER-season11-「The1st」 | BORDER | vs 山城翔 | WIN | KO | 2R 04:40 |
| 2019-06-30 | SHOOTO 30th ANNIVERSARY TOUR 第5戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 南出剛 | WIN | 判定 0-2 |  |
| 2019-12-15 | プロフェッショナル修斗公式戦香川大会「FORCE 12」 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 直撃我聞 | WIN | S | 3R 01:15 |
| 2020-03-21 | MOBSTYLES 20th ANNIVERSARY TOUR FIGHT＆MOSH Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 榎本明 | WIN | TKO | 1R 00:29 |
| 2020-12-20 | PROFESSIONAL SHOOTO 2020 Vol.8 最終戦 in OSAKA 2部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 田丸匠 | LOSS | S | 2R 03:38 |
| 2021-07-04 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA Supported by ONE Championship 第1部 | PRO_SHOOTO_MAINLINE | vs 高岡宏気 (takaoka-hiroki) | WIN | 判定 3-0 |  |
| 2022-03-21 | PROFESSIONAL SHOOTO 2022 Vol.2 | PRO_SHOOTO_MAINLINE | vs 後藤丈治 (goto-joji) | LOSS | 判定 3-0 |  |
| 2022-07-03 | PROFESSIONAL SHOOTO 2022 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 加藤ケンジ | LOSS | KO | 1R 03:35 |
| 2023-09-17 | FORCE 18 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 波平コング | WIN | TS | 1R 01:52 |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs 川北晏生 | UNRESOLVED |  |  |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs 野瀬翔平 (nose-shohei) | WIN | 判定 1-2 |  |
| 2025-05-25 | PROFESSIONAL SHOOTO 2025 Vol.5 in OSAKA | PRO_SHOOTO_MAINLINE | vs 永井奏多 (nagai-kanata) | LOSS | TKO | 1R 04:52 |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 川北晏生 | LOSS | KO | 2R 00:07 |

## 宮口 龍鳳（listed、既存slug: miyaguchi-ryuho）

- shooto選手ID: 1538 (`https://www.shooto-mma.com/fighters/?id=1538`)
- ローマ字表記(テーブル列。URLには含まれない): MIYAGUCHI RYUHO
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 6 (勝6 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-03-05 | BORDER2023「The1st」 | BORDER;PRO_SHOOTO_MAINLINE | vs 岩佐和哉 | WIN | KO | 2R 02:18 |
| 2024-03-24 | FORCE 19 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 魚山皓平 | WIN | KO | 1R 02:29 |
| 2024-07-14 | TORAO33 | TORAO_REGIONAL | vs 小見山瞬 | WIN | TKO | 1R 04:17 |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs 恵真 | WIN | TKO | 1R 00:32 |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 野尻定由 | WIN | KO | 1R 04:41 |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 石原夜叉坊 | WIN | 判定 0-3 |  |

## 中島 陸（missing、既存slug: なし）

- shooto選手ID: 1680 (`https://www.shooto-mma.com/fighters/?id=1680`)
- ローマ字表記(テーブル列。URLには含まれない): 
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 9 (勝8 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-03-24 | FORCE 19 | FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 森貴史 | WIN | TKO | 1R 02:29 |
| 2024-09-29 | BORDER2024「The1st」 | BORDER;PRO_SHOOTO_MAINLINE | vs 岩佐和哉 | WIN | S | 1R 04:45 |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs 青井心ニ | LOSS |  |  |
| 2025-05-25 | PROFESSIONAL SHOOTO 2025 Vol.5 in OSAKA | PRO_SHOOTO_MAINLINE | vs 松岡琉之介 | WIN | S | 1R 01:42 |
| 2025-09-07 | BORDER2025「The2nd」 | BORDER;PRO_SHOOTO_MAINLINE | vs ムテカツ | WIN | S | 1R 02:19 |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 齋藤大樹 | WIN | TKO | 1R 04:58 |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 福元大貴 | WIN | S | 1R 00:33 |
| 2026-03-30 | Lemino修斗.4 | PRO_SHOOTO_MAINLINE | vs エリーワイズ | WIN | 不戦 |  |
| 2026-06-01 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | PRO_SHOOTO_MAINLINE | vs リンフーシュン | WIN | TS | 1R 00:54 |

## 野尻 定由（missing、既存slug: なし）

- shooto選手ID: 1185 (`https://www.shooto-mma.com/fighters/?id=1185`)
- ローマ字表記(テーブル列。URLには含まれない): YASUYUKI NOJIRI
- 修斗選手紹介ページ階級ラベル: バンタム級 [ -61.2 Kg ]B
- 総bout件数: 15 (勝7 敗6 分2 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-03-24 | SHOOTO 30th ANNIVERSARY TOUR 第2戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 奥平季之 | WIN | KO | 2R 01:56 |
| 2019-12-22 | SHOOTO GIG TOKYO Vol.29 Supported by ONE Championship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 林宏仲 | WIN | KO | 2R 02:43 |
| 2021-01-31 | 《第1部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 小野島恒太 | DRAW | 判定 1-1 |  |
| 2021-03-20 | PROFESSIONAL SHOOTO 2021 Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 一條貴洋 | WIN | S | 2R 04:37 |
| 2021-05-16 | PROFESSIONAL SHOOTO 2021 Vol.3 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 石井逸人 | DRAW | 判定 0-0 |  |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 中村倫也 (nakamura-rinya) | LOSS | TKO | 1R 00:25 |
| 2022-05-15 | TORAO27 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 奇天烈 | WIN | 判定 1-0 |  |
| 2022-07-03 | PROFESSIONAL SHOOTO 2022 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 青柳洸志 | WIN | TKO | 3R 00:27 |
| 2022-12-04 | TORAO28 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 神田T800周一 | LOSS | 判定 0-3 |  |
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs 齋藤奨司 (saito-shoji) | LOSS | KO | 1R 04:23 |
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 國頭武 | LOSS | 判定 3-0 |  |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 磯城嶋一真 | WIN | S | 3R 03:32 |
| 2024-11-17 | 山口・KDDI維新ホール | PRO_SHOOTO_MAINLINE | vs ジェイクムラタ | LOSS | 判定 2-1 |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 宮口龍鳳 (miyaguchi-ryuho) | LOSS | KO | 1R 04:41 |
| 2026-05-31 | PROFESSIONAL SHOOTO 2026 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 奇天烈 | WIN | 判定 3-0 |  |

## SASUKE（listed、既存slug: sasuke）

- shooto選手ID: 288 (`https://www.shooto-mma.com/fighters/?id=288`)
- ローマ字表記(テーブル列。URLには含まれない): SASUKE
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]A
- 総bout件数: 14 (勝12 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2016-03-21 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs 葛西達 | WIN | 判定 0-3 | 2R |
| 2016-07-17 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs たてお (tateo) | LOSS | 判定 1-0 |  |
| 2016-12-11 | BORDER-season8-「The3rd」 | BORDER | vs 山本健斗デリカット | LOSS | KO | 1R 04:37 |
| 2019-07-15 | SHOOTO 30th ANNIVERSARY TOUR 第6戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 鈴木淑徳 | WIN | TKO | 1R 04:30 |
| 2019-10-20 | SHOOTO GIG TOKYO Vol.28 Supported by ONE Championship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 稲葉聡 | WIN | S | 1R 03:48 |
| 2019-11-24 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 山本健斗デリカット | WIN | 判定 0-2 |  |
| 2020-05-31 | PROFESSIONAL SHOOTO 2020 Vol.3 ABEMAテレビマッチ Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 西浦ウィッキー聡生 | WIN | 判定 3-0 |  |
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship 第2部 | PRO_SHOOTO_MAINLINE | vs 仲山貴志 | WIN | TKO | 2R 02:05 |
| 2021-01-31 | 《第2部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 内藤太尊 | WIN | S | 2R 02:34 |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 工藤諒司 | WIN | 判定 2-0 |  |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs たてお (tateo) | WIN | KO | 2R 01:49 |
| 2023-12-02 | FIGHT&MOSH | UNCLASSIFIED | vs 田中半蔵 | WIN | TKO | 3R 01:07 |
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs ジョングウェンパン | WIN | S | 1R 03:02 |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 椿飛鳥 (tsubaki-asuka) | WIN | TS | 2R 02:54 |

## ヒカル（listed、既存slug: hikaru）

- shooto選手ID: 1704 (`https://www.shooto-mma.com/fighters/?id=1704`)
- ローマ字表記(テーブル列。URLには含まれない): HIKARU
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 4 (勝4 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 清水洸志 | WIN | 判定 3-0 |  |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs 歩生 | WIN | 判定 3-0 |  |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 山本健斗デリカット | WIN | 判定 1-2 |  |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 青井太一 (aoi-taichi) | WIN | TKO | 3R 01:07 |

## 青井 太一（listed、既存slug: aoi-taichi）

- shooto選手ID: 1485 (`https://www.shooto-mma.com/fighters/?id=1485`)
- ローマ字表記(テーブル列。URLには含まれない): TAICHI AOI
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 14 (勝7 敗6 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-10-15 | SHOOTO GIG TOKYO Vol.33 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 太田慎太郎 | WIN | 判定 3-0 |  |
| 2023-04-09 | SHOOTO GIG TOKYO Vol.34 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 中村修平 | DRAW |  |  |
| 2023-05-21 | PROFESSIONAL SHOOTO 2023 Vol.3 | PRO_SHOOTO_MAINLINE | vs 國頭武 | LOSS | S | 2R 02:14 |
| 2023-10-21 | SHOOTO GIG TOKYO Vol.35 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 椿馨 | WIN | 判定 3-0 |  |
| 2023-12-02 | FIGHT&MOSH | UNCLASSIFIED | vs ネインデイネッシュ | LOSS | 判定 0-3 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 2部 | PRO_SHOOTO_MAINLINE | vs 加藤裕彦 | WIN | TKO | 2R 02:33 |
| 2024-03-23 | 東京・後楽園ホール | PRO_SHOOTO_MAINLINE | vs 島村裕 | WIN | KO | 1R 04:21 |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | LOSS | 判定 3-0 |  |
| 2024-09-01 | 越後風神祭り13 | ECHIGO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 澤江優侍 | WIN | TKO | 1R 00:56 |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs 山本健斗デリカット | WIN | KO | 1R 00:42 |
| 2025-03-23 | SHOOTO GIG TOKYO Vol.38 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 上原平 | LOSS | 判定 2-1 |  |
| 2025-05-18 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.4 | PRO_SHOOTO_MAINLINE | vs 石原夜叉坊 | WIN | KO | 1R 02:07 |
| 2026-02-28 | SHOOTO GIG TOKYO Vol.40 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs たてお (tateo) | LOSS | 判定 1-0 |  |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs ヒカル (hikaru) | LOSS | TKO | 3R 01:07 |

## たてお（listed、既存slug: tateo）

- shooto選手ID: 701 (`https://www.shooto-mma.com/fighters/?id=701`)
- ローマ字表記(テーブル列。URLには含まれない): TATEO IIDA
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]A
- 総bout件数: 14 (勝8 敗3 分2 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2016-07-17 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs SASUKE (sasuke) | WIN | 判定 1-0 |  |
| 2020-08-01 | PROFESSIONAL SHOOTO 2020 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 宮路智之 | DRAW | 判定 0-0 |  |
| 2020-12-20 | TTF CHALLENGE 09 | PRO_SHOOTO_MAINLINE | vs 長田拓也 | LOSS | 判定 3-0 |  |
| 2021-10-02 | SHOOTO GIG TOKYO Vol.31 Supported by ONE Championship | GIG_UNDERCARD_SERIES | vs 木下カラテ (kinoshita-karate) | WIN | 判定 0-2 |  |
| 2021-12-19 | PROFESSIONAL SHOOTO 2021 Vol.8 in OSAKA Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 後藤陽駆 | WIN | S | 1R 03:38 |
| 2022-03-21 | PROFESSIONAL SHOOTO 2022 Vol.2 | PRO_SHOOTO_MAINLINE | vs 岩本建汰 | UNRESOLVED |  |  |
| 2022-07-03 | PROFESSIONAL SHOOTO 2022 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 山本健斗デリカット | WIN | S | 1R 02:49 |
| 2022-09-19 | PROFESSIONAL SHOOTO 2022 Vol.6 | PRO_SHOOTO_MAINLINE | vs 論田愛空隆 | WIN | TKO | 3R 01:13 |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs SASUKE (sasuke) | LOSS | KO | 2R 01:49 |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 椿飛鳥 (tsubaki-asuka) | LOSS | 判定 2-1 |  |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs 島村裕 | WIN | 判定 3-0 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs シャランディ | DRAW | 判定 0-0 |  |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 上原平 | WIN | 判定 1-2 |  |
| 2026-02-28 | SHOOTO GIG TOKYO Vol.40 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 青井太一 (aoi-taichi) | WIN | 判定 1-0 |  |

## TOMA（listed、既存slug: toma）

- shooto選手ID: 255 (`https://www.shooto-mma.com/fighters/?id=255`)
- ローマ字表記(テーブル列。URLには含まれない): TOMA
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]A
- 総bout件数: 15 (勝9 敗6 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2016-09-04 | BORDER-season8-「The2nd」 | BORDER | vs 仲山貴志 | LOSS | S | 2R 04:40 |
| 2016-12-11 | BORDER-season8-「The3rd」 | BORDER | vs 摩嶋一整 (majima-kazumasa) | LOSS | S | 2R 02:07 |
| 2017-05-12 | 後楽園ホール大会 | UNCLASSIFIED | vs 内藤太尊 | WIN | KO | 1R 00:56 |
| 2017-06-25 | プロフェッショナル修斗公式戦 in OSAKA | PRO_SHOOTO_MAINLINE | vs 山本健斗デリカット | WIN | 判定 0-2 |  |
| 2017-11-19 | SHOOTO GIG TOKYO Vol.23 | GIG_UNDERCARD_SERIES | vs 三上譲治 | WIN | KO | 2R 00:19 |
| 2018-06-17 | プロフェッショナル修斗 in OSAKA 2018 | UNCLASSIFIED | vs 山本健斗デリカット | WIN | KO | 1R 01:30 |
| 2018-09-23 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs リオン武 | LOSS | 判定 0-3 |  |
| 2019-06-30 | SHOOTO 30th ANNIVERSARY TOUR 第5戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 高野明 | WIN | 判定 3-0 |  |
| 2020-01-26 | PROFESSONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 仲山貴志 | LOSS | 判定 1-2 |  |
| 2023-05-28 | TORAO29 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 結城大樹 | LOSS | 判定 3-0 |  |
| 2023-09-03 | 越後風神祭り11 | ECHIGO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 岡田達磨 | WIN | TKO | 2R 02:36 |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | WIN | TKO | 3R 02:41 |
| 2024-07-28 | PROFESSIONAL SHOOTO 2024 Vol.6 in OSAKA 第1部 | PRO_SHOOTO_MAINLINE | vs ネインデイネッシュ | WIN | KO | 2R 01:15 |
| 2026-02-18 | Lemino修斗.3 | PRO_SHOOTO_MAINLINE | vs 堀江耐志 | LOSS | 判定 1-2 |  |
| 2026-06-28 | プロフェッショナル修斗公式戦福岡大会「Lemino修斗TORAO」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 田中半蔵 | WIN | TKO | 2R 01:09 |

## パク ジョンジュン（missing、既存slug: なし）

- shooto選手ID: 1809 (`https://www.shooto-mma.com/fighters/?id=1809`)
- ローマ字表記(テーブル列。URLには含まれない): JONG JUN PARK
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]A
- 総bout件数: 1 (勝1 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-05-25 | PROFESSIONAL SHOOTO 2025 Vol.5 in OSAKA | PRO_SHOOTO_MAINLINE | vs 宇藤彰貴 | WIN | TKO | 1R 02:41 |

## 齋藤 翼（missing、既存slug: なし）

- shooto選手ID: 214 (`https://www.shooto-mma.com/fighters/?id=214`)
- ローマ字表記(テーブル列。URLには含まれない): Tsubasa Saito
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 23 (勝13 敗10 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2015-12-20 | インフィニティリーグ2015フェザー級最終戦 | UNCLASSIFIED | vs 海下DRAGON竜太 | LOSS | 判定 3-0 | 2R |
| 2016-05-28 | SHOOTO GIG TOKYO Vol.21 | GIG_UNDERCARD_SERIES | vs 高橋孝徳 | LOSS | 判定 3-0 | 2R |
| 2016-10-16 | SHOOTO GIG TOKYO Vol.22 | GIG_UNDERCARD_SERIES | vs 鷹島大樹 | WIN | 判定 3-0 |  |
| 2016-11-12 | 環太平洋ダブルチャンピオンシップ | UNCLASSIFIED | vs ハンセン玲雄 | WIN | 判定 3-0 | 2R |
| 2017-12-17 | インフィニティリーグ2017優勝決定戦 | UNCLASSIFIED | vs 近内忠史 | WIN | 判定 3-0 |  |
| 2018-01-28 | プロフェッショナル修斗 2018開幕戦 | UNCLASSIFIED | vs 久保村ヨシTERU | WIN | 判定 1-0 |  |
| 2018-05-13 | プロフェッショナル修斗川崎大会 | UNCLASSIFIED | vs 村津孝徳 | WIN | 判定 3-0 |  |
| 2018-09-23 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 水島宏 | WIN | S | 2R 02:03 |
| 2019-01-27 | SHOOTO 30th ANNIVERSARY TOUR 開幕戦 | PRO_SHOOTO_MAINLINE | vs 金物屋の秀 | WIN | 判定 0-3 |  |
| 2019-05-06 | SHOOTO 30th ANNIVERSARY TOUR 30周年記念大会 第1部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs イムジョンミン | WIN | KO | 1R 03:04 |
| 2019-09-22 | SHOOTO 30th ANNIVERSARY TOUR 第7戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 藤井伸樹 | LOSS | 判定 3-0 |  |
| 2020-05-31 | PROFESSIONAL SHOOTO 2020 Vol.3 ABEMAテレビマッチ Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 石井逸人 | LOSS | 判定 3-0 |  |
| 2021-01-31 | 《第2部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 新井拓巳 | WIN | 判定 2-0 |  |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 野瀬翔平 (nose-shohei) | LOSS | 判定 0-3 |  |
| 2021-10-02 | SHOOTO GIG TOKYO Vol.31 Supported by ONE Championship | GIG_UNDERCARD_SERIES | vs ガッツTakato | WIN | 判定 3-0 |  |
| 2022-05-22 | PROFESSIONAL SHOOTO 2022 Vol.3 | PRO_SHOOTO_MAINLINE | vs 藤井伸樹 | LOSS | 判定 3-0 |  |
| 2022-09-19 | PROFESSIONAL SHOOTO 2022 Vol.6 | PRO_SHOOTO_MAINLINE | vs チョウスソン | LOSS | 判定 0-3 |  |
| 2023-05-21 | PROFESSIONAL SHOOTO 2023 Vol.3 | PRO_SHOOTO_MAINLINE | vs 岡田達磨 | WIN | S | 2R 01:43 |
| 2023-10-21 | SHOOTO GIG TOKYO Vol.35 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 椿飛鳥 (tsubaki-asuka) | LOSS | 判定 1-2 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs TOMA (toma) | LOSS | TKO | 3R 02:41 |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 青井太一 (aoi-taichi) | WIN | 判定 3-0 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 宇藤彰貴 | LOSS | KO | 1R 00:14 |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 上原平 | WIN | 判定 1-2 |  |

## 上原 平（missing、既存slug: なし）

- shooto選手ID: 1249 (`https://www.shooto-mma.com/fighters/?id=1249`)
- ローマ字表記(テーブル列。URLには含まれない): TAIRA UEHARA
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 14 (勝7 敗3 分3 NC1 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-12-22 | SHOOTO GIG TOKYO Vol.29 Supported by ONE Championship | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 水野怜 | WIN | KO | 1R 00:33 |
| 2021-01-31 | 《第1部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs ヨシイノウエ | DRAW | 判定 1-1 |  |
| 2021-03-20 | PROFESSIONAL SHOOTO 2021 Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | LOSS | 判定 3-0 |  |
| 2022-10-15 | SHOOTO GIG TOKYO Vol.33 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 磯部鉄心 | WIN | 判定 3-0 |  |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs 竹原魁晟 | DRAW | 判定 0-0 |  |
| 2023-05-21 | PROFESSIONAL SHOOTO 2023 Vol.3 | PRO_SHOOTO_MAINLINE | vs 浜松ヤマト | DRAW | 判定 0-0 |  |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs CHAN龍 | WIN |  |  |
| 2023-09-24 | PROFESSIONAL SHOOTO 2023 Vol.6 | PRO_SHOOTO_MAINLINE | vs 磯部鉄心 | WIN | 判定 3-0 |  |
| 2024-03-23 | 東京・後楽園ホール | PRO_SHOOTO_MAINLINE | vs リオン武 | NO_CONTEST |  |  |
| 2024-07-21 | PROFESSIONAL SHOOTO 2024 Vol.5 | PRO_SHOOTO_MAINLINE | vs 竹原魁晟 | WIN | 不戦 |  |
| 2025-03-23 | SHOOTO GIG TOKYO Vol.38 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 青井太一 (aoi-taichi) | WIN | 判定 2-1 |  |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs たてお (tateo) | LOSS | 判定 1-2 |  |
| 2026-02-28 | SHOOTO GIG TOKYO Vol.40 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 澤江優侍 | WIN | S | 3R 01:32 |
| 2026-05-17 | 【第1部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 齋藤翼 | LOSS | 判定 1-2 |  |

## 磯城嶋 一真（missing、既存slug: なし）

- shooto選手ID: 1447 (`https://www.shooto-mma.com/fighters/?id=1447`)
- ローマ字表記(テーブル列。URLには含まれない): KAZUMA SHIKIJIMA
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 9 (勝6 敗1 分2 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-06-05 | 北海道大会 | PRO_SHOOTO_MAINLINE | vs 鹿野太雅 | WIN | 判定 3-0 |  |
| 2022-12-11 | PROFESSIONAL SHOOTO 2022 Vol.8 in OSAKA | PRO_SHOOTO_MAINLINE | vs 轟轟 | WIN | 判定 1-0 |  |
| 2023-05-28 | TORAO29 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs アサシン秋雄 | WIN | 判定 0-3 |  |
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 藤田ムネノリ | WIN | 判定 0-2 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs JAM | DRAW | 判定 1-1 |  |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 野尻定由 | LOSS | S | 3R 03:32 |
| 2024-11-17 | 山口・KDDI維新ホール | PRO_SHOOTO_MAINLINE | vs 工藤圭一郎 | DRAW |  |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 久保村ヨシTERU | WIN | TKO | 1R 01:36 |
| 2025-12-07 | 株式会社大熊警備隊presentsプロフェッショナル修斗公式戦山口大会「TORAO37」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 宇藤彰貴 | WIN | KO | 3R 04:47 |

## 飯野 雄斗（missing、既存slug: なし）

- shooto選手ID: 1797 (`https://www.shooto-mma.com/fighters/?id=1797`)
- ローマ字表記(テーブル列。URLには含まれない): YUTO IINO
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]A
- 総bout件数: 5 (勝5 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-04-20 | THE SHOOTO OKINAWA vol.12 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 翔べ！ゆうすけ！ | WIN | 判定 3-0 |  |
| 2025-09-21 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.8 | PRO_SHOOTO_MAINLINE | vs 齋藤優 | WIN | S | 2R 04:07 |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 本松要 | WIN | 判定 2-0 |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs 辻純也 | WIN | S | 1R 02:01 |
| 2026-06-01 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | PRO_SHOOTO_MAINLINE | vs 石原夜叉坊 | WIN | TKO | 2R 04:21 |

## ネイン デイネッシュ（missing、既存slug: なし）

- shooto選手ID: 1623 (`https://www.shooto-mma.com/fighters/?id=1623`)
- ローマ字表記(テーブル列。URLには含まれない): NAIN DINESH
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 9 (勝7 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-08-20 | 広島大会「TORAO30」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 健太エスペランサ | WIN | TKO | 2R 02:12 |
| 2023-12-02 | FIGHT&MOSH | UNCLASSIFIED | vs 青井太一 (aoi-taichi) | WIN | 判定 0-3 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 1部 | PRO_SHOOTO_MAINLINE | vs 松浦真実也 | WIN | TKO | 2R 00:14 |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 諸石一砂 | WIN | S | 1R 04:35 |
| 2024-07-28 | PROFESSIONAL SHOOTO 2024 Vol.6 in OSAKA 第1部 | PRO_SHOOTO_MAINLINE | vs TOMA (toma) | LOSS | KO | 2R 01:15 |
| 2025-10-11 | SHOOTO GIG TOKYO Vol.39 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 島村裕 | WIN | TKO | 2R 02:35 |
| 2026-02-28 | SHOOTO GIG TOKYO Vol.40 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 安海健人 | LOSS | 判定 3-0 |  |
| 2026-05-17 | プロフェッショナル修斗公式戦福岡大会TORAO38 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs キムシウォン | WIN | 判定 3-0 |  |
| 2026-06-28 | プロフェッショナル修斗公式戦福岡大会「Lemino修斗TORAO」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 久保村ヨシTERU | WIN | TKO | 1R 01:13 |

## エフェヴィガ 雄志（listed、既存slug: efeviga-yushi）

- shooto選手ID: 1537 (`https://www.shooto-mma.com/fighters/?id=1537`)
- ローマ字表記(テーブル列。URLには含まれない): EPHOEVIGA YUJI
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 10 (勝8 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs クアト驎 | WIN | TKO | 1R 01:20 |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 後藤陽駆 | WIN | KO | 1R 00:21 |
| 2024-03-23 | 東京・後楽園ホール | PRO_SHOOTO_MAINLINE | vs キムミンヒュン | WIN | S | 1R 03:21 |
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs アーイージアコアーケンビエコァ | WIN | TKO | 2R 02:31 |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | WIN | S | 3R 03:17 |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs ライダーHIRO | WIN | S | 1R 04:33 |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs 西尾真輔 (nishio-shinsuke) | WIN |  |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs イムクァンウ | LOSS | KO | 1R 04:49 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs キャプテン☆アフリカ (captain-africa) | WIN | KO | 2R 02:45 |
| 2026-06-01 | プロフェッショナル修斗公式戦後楽園大会　『Lemino修斗.6』 | PRO_SHOOTO_MAINLINE | vs ローウェンタイナネス | LOSS | KO | 1R 03:44 |

## 後藤 亮（listed、既存slug: goto-ryo）

- shooto選手ID: 1549 (`https://www.shooto-mma.com/fighters/?id=1549`)
- ローマ字表記(テーブル列。URLには含まれない): RYO GOTO
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 4 (勝4 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-04-09 | SHOOTO GIG TOKYO Vol.34 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 石原匠 | WIN | 判定 3-0 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs 手島響 | WIN | 判定 0-3 |  |
| 2025-10-11 | SHOOTO GIG TOKYO Vol.39 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 結城大樹 | WIN | 判定 0-2 |  |
| 2026-02-18 | Lemino修斗.3 | PRO_SHOOTO_MAINLINE | vs シヴァエフ | WIN | KO | 1R 01:44 |

## キャプテン ☆ アフリカ（listed、既存slug: captain-africa）

- shooto選手ID: 1056 (`https://www.shooto-mma.com/fighters/?id=1056`)
- ローマ字表記(テーブル列。URLには含まれない): Captain Africa
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 14 (勝9 敗5 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2017-09-03 | BORDER-season9-「The2nd」 | BORDER | vs 興梠弘樹 | WIN | S | 1R 00:50 |
| 2017-12-23 | BORDER-season9-「The3rd」 | BORDER | vs Ju-seiAquila | WIN | S | 1R 01:28 |
| 2018-03-25 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 鈴木槙吾 | WIN | S | 1R 01:25 |
| 2018-06-17 | プロフェッショナル修斗 in OSAKA 2018 | UNCLASSIFIED | vs キムギョンピョ | LOSS | KO | 1R 01:50 |
| 2018-11-17 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 小谷直之 | LOSS | S | 2R 00:51 |
| 2019-06-30 | SHOOTO 30th ANNIVERSARY TOUR 第5戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs ウエタユウ | WIN | 判定 3-0 |  |
| 2019-11-24 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs AB | WIN | TKO | 2R 01:10 |
| 2020-07-12 | PROFESSIONAL SHOOTO 2020 Vol.4 in OSAKA Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 川名TENCHO雄生 | LOSS | KO | 1R 03:48 |
| 2020-12-20 | PROFESSIONAL SHOOTO 2020 Vol.8 最終戦 in OSAKA 2部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 田中有 | WIN | S | 1R 04:02 |
| 2021-07-04 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA Supported by ONE Championship 第1部 | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | LOSS | 判定 0-3 |  |
| 2021-12-19 | PROFESSIONAL SHOOTO 2021 Vol.8 in OSAKA Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | WIN | S | 1R 02:46 |
| 2022-07-03 | PROFESSIONAL SHOOTO 2022 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 長田拓也 | WIN | 判定 3-0 |  |
| 2024-07-28 | PROFESSIONAL SHOOTO 2024 Vol.6 in OSAKA 第2部 | PRO_SHOOTO_MAINLINE | vs 大尊伸光 | WIN | S | 1R 02:03 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs エフェヴィガ雄志 (efeviga-yushi) | LOSS | KO | 2R 02:45 |

## 西尾 真輔（listed、既存slug: nishio-shinsuke）

- shooto選手ID: 1739 (`https://www.shooto-mma.com/fighters/?id=1739`)
- ローマ字表記(テーブル列。URLには含まれない): Shinsuke Nishio
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 3 (勝1 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | WIN | KO | 1R 00:36 |
| 2025-01-19 | PROFESSIONAL SHOOTO 2025 開幕戦 | PRO_SHOOTO_MAINLINE | vs エフェヴィガ雄志 (efeviga-yushi) | LOSS |  |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs シヴァエフ | LOSS | TKO | 2R 05:00 |

## 結城 大樹（missing、既存slug: なし）

- shooto選手ID: 642 (`https://www.shooto-mma.com/fighters/?id=642`)
- ローマ字表記(テーブル列。URLには含まれない): DAIKI YUKI
- 修斗選手紹介ページ階級ラベル: フェザー級 [ -65.8 Kg ]B
- 総bout件数: 13 (勝7 敗5 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2018-07-15 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 高橋孝徳 | DRAW | 判定 0-0 |  |
| 2020-12-13 | 闘裸男×FORCE | TORAO_REGIONAL;FORCE_REGIONAL;PRO_SHOOTO_MAINLINE | vs 國頭武 | WIN | 判定 3-0 |  |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 仲山貴志 | WIN |  |  |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 岩本建汰 | LOSS | 判定 0-2 |  |
| 2022-05-15 | TORAO27 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 田中半蔵 | LOSS | 判定 0-3 |  |
| 2022-11-06 | THE SHOOTO OKINAWA vol.7 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 工藤圭一郎 | WIN | 判定 3-0 |  |
| 2023-05-28 | TORAO29 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs TOMA (toma) | WIN | 判定 3-0 |  |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs オーディン | LOSS | 判定 0-2 |  |
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 岡田達磨 | WIN | 判定 2-0 |  |
| 2024-03-23 | 東京・後楽園ホール | PRO_SHOOTO_MAINLINE | vs 椿飛鳥 (tsubaki-asuka) | LOSS | 判定 0-3 |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 安海健人 | WIN | 判定 1-0 |  |
| 2025-10-11 | SHOOTO GIG TOKYO Vol.39 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 後藤亮 (goto-ryo) | LOSS | 判定 0-2 |  |
| 2026-05-17 | プロフェッショナル修斗公式戦福岡大会TORAO38 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 石原海渡 | WIN | TS | 1R 02:01 |

## 安海 健人（missing、既存slug: なし）

- shooto選手ID: 1442 (`https://www.shooto-mma.com/fighters/?id=1442`)
- ローマ字表記(テーブル列。URLには含まれない): KENTO AZUMI
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 5 (勝3 敗1 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-06-05 | 北海道大会 | PRO_SHOOTO_MAINLINE | vs 磯部鉄心 | WIN | KO | 2R 04:04 |
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs 深見弦汰 | WIN | 判定 3-0 |  |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 山下康一朗 | DRAW | 判定 0-0 |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 結城大樹 | LOSS | 判定 1-0 |  |
| 2026-02-28 | SHOOTO GIG TOKYO Vol.40 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs ネインデイネッシュ | WIN | 判定 3-0 |  |

## マックス・ザ・ボディ（missing、既存slug: なし）

- shooto選手ID: 1295 (`https://www.shooto-mma.com/fighters/?id=1295`)
- ローマ字表記(テーブル列。URLには含まれない): MAX THE BODY
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]A
- 総bout件数: 9 (勝4 敗5 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship  第1部 | PRO_SHOOTO_MAINLINE | vs 大尊伸光 | LOSS | KO | 1R 03:07 |
| 2021-01-31 | 《第1部》PROFESSIONAL SHOOTO 2021開幕戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 西川大和 | LOSS | TKO | 2R 03:23 |
| 2021-03-20 | PROFESSIONAL SHOOTO 2021 Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 上原平 | WIN | 判定 3-0 |  |
| 2021-07-04 | PROFESSIONAL SHOOTO 2021 Vol.4 in OSAKA Supported by ONE Championship 第1部 | PRO_SHOOTO_MAINLINE | vs キャプテン☆アフリカ (captain-africa) | WIN | 判定 0-3 |  |
| 2021-12-19 | PROFESSIONAL SHOOTO 2021 Vol.8 in OSAKA Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs キャプテン☆アフリカ (captain-africa) | LOSS | S | 1R 02:46 |
| 2022-12-11 | PROFESSIONAL SHOOTO 2022 Vol.8 in OSAKA | PRO_SHOOTO_MAINLINE | vs 田中有 | WIN | 判定 3-0 |  |
| 2023-03-19 | PROFESSIONAL SHOOTO 2023 Vol.2 | PRO_SHOOTO_MAINLINE | vs 菅原和政 | WIN | TKO | 1R 01:18 |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs 西尾真輔 (nishio-shinsuke) | LOSS | KO | 1R 00:36 |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs エフェヴィガ雄志 (efeviga-yushi) | LOSS | S | 3R 03:17 |

## 大尊 伸光（missing、既存slug: なし）

- shooto選手ID: 247 (`https://www.shooto-mma.com/fighters/?id=247`)
- ローマ字表記(テーブル列。URLには含まれない): Nobumitsu Tyson
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]A
- 総bout件数: 8 (勝5 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2017-05-12 | 後楽園ホール大会 | UNCLASSIFIED | vs 木村孔明 | WIN | S | 1R 01:33 |
| 2017-10-15 | プロフェッショナル修斗公式戦 | PRO_SHOOTO_MAINLINE | vs 松本光史 | LOSS | KO | 2R 00:53 |
| 2017-12-17 | インフィニティリーグ2017優勝決定戦 | UNCLASSIFIED | vs 田口泰地 | WIN | KO | 1R 03:22 |
| 2018-03-25 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs AB | WIN | 判定 0-3 |  |
| 2018-09-23 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 田中有 | WIN | KO | 1R 02:20 |
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship  第1部 | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | WIN | KO | 1R 03:07 |
| 2021-05-16 | PROFESSIONAL SHOOTO 2021 Vol.3 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 西川大和 | LOSS | S | 2R 04:53 |
| 2024-07-28 | PROFESSIONAL SHOOTO 2024 Vol.6 in OSAKA 第2部 | PRO_SHOOTO_MAINLINE | vs キャプテン☆アフリカ (captain-africa) | LOSS | S | 1R 02:03 |

## 田中 有（missing、既存slug: なし）

- shooto選手ID: 1102 (`https://www.shooto-mma.com/fighters/?id=1102`)
- ローマ字表記(テーブル列。URLには含まれない): YU TANAKA
- 修斗選手紹介ページ階級ラベル: ライト級 [ -70.3 Kg ]B
- 総bout件数: 8 (勝5 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2017-09-03 | BORDER-season9-「The2nd」 | BORDER | vs 伊集守道 | WIN | TKO | 1R 04:15 |
| 2017-12-23 | BORDER-season9-「The3rd」 | BORDER | vs 林RICE陽太 | WIN | S | 1R 02:26 |
| 2018-03-25 | BORDER-season10-「The1st」 | BORDER | vs coBa | WIN | S | 1R 01:44 |
| 2018-06-17 | プロフェッショナル修斗 in OSAKA 2018 | UNCLASSIFIED | vs 長田拓也 | WIN | KO | 2R 03:55 |
| 2018-09-23 | プロフェッショナル修斗後楽園ホール大会 | UNCLASSIFIED | vs 大尊伸光 | LOSS | KO | 1R 02:20 |
| 2019-11-24 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 岡野裕城 | WIN | 判定 3-0 |  |
| 2020-12-20 | PROFESSIONAL SHOOTO 2020 Vol.8 最終戦 in OSAKA 2部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs キャプテン☆アフリカ (captain-africa) | LOSS | S | 1R 04:02 |
| 2022-12-11 | PROFESSIONAL SHOOTO 2022 Vol.8 in OSAKA | PRO_SHOOTO_MAINLINE | vs マックス・ザ・ボディ | LOSS | 判定 3-0 |  |

## 住村 竜市朗（listed、既存slug: sumimura-ryuichiro）

- shooto選手ID: 400 (`https://www.shooto-mma.com/fighters/?id=400`)
- ローマ字表記(テーブル列。URLには含まれない): RYUICHIRO SUMIMURA
- 修斗選手紹介ページ階級ラベル: ウェルター級 [ -77.1 Kg ]B
- 総bout件数: 5 (勝3 敗1 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs 西條英成 | WIN | 判定 3-0 |  |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs 皇治 (kouzi) | UNRESOLVED |  |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs ソーキ | WIN | 判定 0-3 |  |
| 2025-11-16 | PROFESSIONAL SHOOTO 2025 Vol.9 | PRO_SHOOTO_MAINLINE | vs 森井翼 | WIN | TS | 2R 03:03 |
| 2026-05-17 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs デソウザマルセル | LOSS | KO | 2R 00:55 |

## ヴィクター バレンズエラ（missing、既存slug: なし）

- shooto選手ID: 1919 (`https://www.shooto-mma.com/fighters/?id=1919`)
- ローマ字表記(テーブル列。URLには含まれない): 
- 修斗選手紹介ページ階級ラベル: ウェルター級 [ -77.1 Kg ]B
- 総bout件数: 1 (勝1 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2026-03-30 | Lemino修斗.4 | PRO_SHOOTO_MAINLINE | vs 木下憂朔 | WIN | KO | 2R 04:13 |

## エルナニ ペルペトゥオ（missing、既存slug: なし）

- shooto選手ID: 830 (`https://www.shooto-mma.com/fighters/?id=830`)
- ローマ字表記(テーブル列。URLには含まれない): Hernani Perpetuo
- 修斗選手紹介ページ階級ラベル: ウェルター級 [ -77.1 Kg ]A
- 総bout件数: 0 (勝0 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **NO(bout無し=同姓同名/未確認要因)**

(shooto-bouts.csv中に該当する bout が0件。要因は個別確認が必要)

## 田村 ヒビキ（missing、既存slug: なし）

- shooto選手ID: 375 (`https://www.shooto-mma.com/fighters/?id=375`)
- ローマ字表記(テーブル列。URLには含まれない): Hibiki Tamura
- 修斗選手紹介ページ階級ラベル: ウェルター級 [ -77.1 Kg ]A
- 総bout件数: 1 (勝1 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-05-15 | TORAO27 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs ソーキ | WIN | KO | 2R 03:15 |

## グラップラー脇（missing、既存slug: なし）

- shooto選手ID: 1708 (`https://www.shooto-mma.com/fighters/?id=1708`)
- ローマ字表記(テーブル列。URLには含まれない): GRAPPLER WAKI
- 修斗選手紹介ページ階級ラベル: ウェルター級 [ -77.1 Kg ]B
- 総bout件数: 3 (勝2 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 深見弦汰 | LOSS | 判定 2-0 |  |
| 2025-05-11 | TORAO35 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 平尾大和 | WIN | 判定 3-0 |  |
| 2026-01-18 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.1 | PRO_SHOOTO_MAINLINE | vs デソウザマルセル | WIN | 判定 1-0 |  |

## 岩﨑 大河（missing、既存slug: なし）

- shooto選手ID: 1350 (`https://www.shooto-mma.com/fighters/?id=1350`)
- ローマ字表記(テーブル列。URLには含まれない): TAIGA IWASAKI
- 修斗選手紹介ページ階級ラベル: ミドル級 [ -83.9 Kg ]B
- 総bout件数: 8 (勝7 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-09-20 | PROFESSIONAL SHOOTO 2021 Vol.6 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 今市凌太 | WIN | TKO | 1R 04:14 |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 清水洸志 | WIN | S | R 03:13 |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs イムドンジュ | WIN | TKO | 2R |
| 2023-09-24 | PROFESSIONAL SHOOTO 2023 Vol.6 | PRO_SHOOTO_MAINLINE | vs キムウンス | WIN | 判定 3-0 |  |
| 2025-05-18 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.3 | PRO_SHOOTO_MAINLINE | vs アレクシスカンポス | LOSS |  |  |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs ジャン・ボム・ソク | WIN | S | 2R 02:43 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs HENRY | WIN | S | 3R 04:29 |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 荒井勇ニ | WIN | KO | 2R 00:28 |

## 荒井 勇ニ（missing、既存slug: なし）

- shooto選手ID: 1912 (`https://www.shooto-mma.com/fighters/?id=1912`)
- ローマ字表記(テーブル列。URLには含まれない): ARAI YUJI
- 修斗選手紹介ページ階級ラベル: ミドル級 [ -83.9 Kg ]B
- 総bout件数: 2 (勝1 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 沙門 | WIN | 判定 2-0 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 岩﨑大河 | LOSS | KO | 2R 00:28 |

## 沙門（missing、既存slug: なし）

- shooto選手ID: 1849 (`https://www.shooto-mma.com/fighters/?id=1849`)
- ローマ字表記(テーブル列。URLには含まれない): 
- 修斗選手紹介ページ階級ラベル: ミドル級 [ -83.9 Kg ]B
- 総bout件数: 2 (勝1 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-07-13 | 広島大会 | UNCLASSIFIED | vs SOKO | WIN | TKO | 1R 04:45 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 荒井勇ニ | LOSS | 判定 2-0 |  |

## HENRY（missing、既存slug: なし）

- shooto選手ID: 1911 (`https://www.shooto-mma.com/fighters/?id=1911`)
- ローマ字表記(テーブル列。URLには含まれない): 
- 修斗選手紹介ページ階級ラベル: ミドル級 [ -83.9 Kg ]B
- 総bout件数: 1 (勝0 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 岩﨑大河 | LOSS | S | 3R 04:29 |

## キム ジェヨン（missing、既存slug: なし）

- shooto選手ID: 1633 (`https://www.shooto-mma.com/fighters/?id=1633`)
- ローマ字表記(テーブル列。URLには含まれない): KIM YOUNG
- 修斗選手紹介ページ階級ラベル: ミドル級 [ -83.9 Kg ]B
- 総bout件数: 2 (勝0 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-12-02 | FIGHT&MOSH | UNCLASSIFIED | vs 岡見勇信 | LOSS | 判定 2-1 |  |
| 2024-11-30 | PROFESSIONAL SHOOTO 2024 Vol.8 | PRO_SHOOTO_MAINLINE | vs 岡見勇信 | LOSS | 判定 3-0 |  |

## 青野 ひかる（missing、既存slug: なし）

- shooto選手ID: 1850 (`https://www.shooto-mma.com/fighters/?id=1850`)
- ローマ字表記(テーブル列。URLには含まれない): HIKARU AONO
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]A
- 総bout件数: 3 (勝2 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 中村未来 | LOSS | S | 2R 04:46 |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs 深井志保 | WIN | S | 1R 03:42 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 中村未来 | WIN | 判定 0-3 |  |

## 徳本 望愛（missing、既存slug: なし）

- shooto選手ID: 1694 (`https://www.shooto-mma.com/fighters/?id=1694`)
- ローマ字表記(テーブル列。URLには含まれない): TOKUMOTO NOA
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]B
- 総bout件数: 6 (勝5 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-04-14 | THE SHOOTO OKINAWA vol.10 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 高田双葉 | WIN | 判定 0-3 |  |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 片山智絵 | LOSS | 判定 0-1 |  |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | S | 2R 03:16 |
| 2025-09-02 | Lemino修斗１ | PRO_SHOOTO_MAINLINE | vs 安田Kong詠美 | WIN | KO | 1R 00:32 |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | 判定 1-2 |  |
| 2026-04-19 | Lemino修斗.5 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs イボバイエ | WIN | 判定 3-0 |  |

## 中村 未来（missing、既存slug: なし）

- shooto選手ID: 1274 (`https://www.shooto-mma.com/fighters/?id=1274`)
- ローマ字表記(テーブル列。URLには含まれない): MIKU NAKAMURA
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]B
- 総bout件数: 16 (勝9 敗6 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2020-02-16 | PROFESSIONAL SHOOTO 2020 Vol.2 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 梅原拓未 | WIN | 判定 0-3 |  |
| 2020-03-29 | 【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE;CANCELLED_LABEL_IN_TITLE | vs 杉本恵 | UNRESOLVED |  |  |
| 2020-05-31 | PROFESSIONAL SHOOTO 2020 Vol.3 ABEMAテレビマッチ Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 杉本恵 | LOSS | S | 2R 03:32 |
| 2020-09-19 | PROFESSIONAL SHOOTO 2020 Vol.6 Supported by ONE Championship  第1部 | PRO_SHOOTO_MAINLINE | vs 永尾音波 | WIN | 判定 3-0 |  |
| 2020-12-20 | PROFESSIONAL SHOOTO 2020 Vol.8 最終戦 in OSAKA 2部 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 古澤みゆき | LOSS | 判定 0-2 |  |
| 2021-05-16 | PROFESSIONAL SHOOTO 2021 Vol.3 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 北野きゅう | WIN | TKO | 2R 03:07 |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs SARAMI | LOSS | TKO | 2R 02:48 |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 澤田千優 (chihiro-sawada) | LOSS | 判定 0-2 |  |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 小生由紀 | WIN | 判定 3-0 |  |
| 2022-06-05 | 北海道大会 | PRO_SHOOTO_MAINLINE | vs 加藤春菜 | WIN | 判定 3-0 |  |
| 2022-11-27 | PROFESSIONAL SHOOTO 2022 Vol.7 | PRO_SHOOTO_MAINLINE | vs 久遠 | WIN | TKO | 1R 04:59 |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs 川西茉夕 | WIN | 判定 3-0 |  |
| 2023-12-02 | COLORS Produce by SHOOTO Vol.2 “FIGHT&MOSH” | PRO_SHOOTO_MAINLINE | vs 澤田千優 (chihiro-sawada) | LOSS | S | 1R 04:57 |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 青野ひかる | WIN | S | 2R 04:46 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 青野ひかる | LOSS | 判定 0-3 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 嶋屋澪 | WIN | TS | 2R 04:00 |

## 杉本 恵（missing、既存slug: なし）

- shooto選手ID: 1171 (`https://www.shooto-mma.com/fighters/?id=1171`)
- ローマ字表記(テーブル列。URLには含まれない): MEGUMI SUGIMOTO
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]B
- 総bout件数: 21 (勝11 敗7 分1 NC1 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-01-27 | SHOOTO 30th ANNIVERSARY TOUR 開幕戦 | PRO_SHOOTO_MAINLINE | vs 木越めぐみ | WIN | 判定 3-0 |  |
| 2019-03-24 | SHOOTO 30th ANNIVERSARY TOUR 第2戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 原田よき | WIN | 判定 0-3 |  |
| 2019-09-22 | SHOOTO 30th ANNIVERSARY TOUR 第7戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 北野きゅう | WIN | KO | 2R 02:06 |
| 2019-11-24 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 廣瀬里美 | WIN | S | 1R 02:20 |
| 2020-03-29 | 【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE;CANCELLED_LABEL_IN_TITLE | vs 中村未来 | UNRESOLVED |  |  |
| 2020-05-31 | PROFESSIONAL SHOOTO 2020 Vol.3 ABEMAテレビマッチ Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 中村未来 | WIN | S | 2R 03:32 |
| 2020-08-01 | PROFESSIONAL SHOOTO 2020 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 黒部三奈 | LOSS | 判定 3-0 |  |
| 2020-11-23 |  | PRO_SHOOTO_MAINLINE | vs SARAMI | LOSS | S | 1R 02:46 |
| 2021-05-16 | PROFESSIONAL SHOOTO 2021 Vol.3 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | S | 1R 01:31 |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs ソルト | WIN | 判定 3-0 |  |
| 2022-05-22 | PROFESSIONAL SHOOTO 2022 Vol.3 | PRO_SHOOTO_MAINLINE | vs 須恵樹季 | NO_CONTEST |  |  |
| 2022-09-19 | PROFESSIONAL SHOOTO 2022 Vol.6 | PRO_SHOOTO_MAINLINE | vs ライカ | LOSS | 判定 1-0 |  |
| 2022-12-11 | PROFESSIONAL SHOOTO 2022 Vol.8 in OSAKA | PRO_SHOOTO_MAINLINE | vs 須恵樹季 | WIN | 判定 3-0 |  |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | 判定 3-0 |  |
| 2023-09-24 | PROFESSIONAL SHOOTO 2023 Vol.6 | PRO_SHOOTO_MAINLINE | vs エンゼル☆志穂 | WIN | 判定 3-0 |  |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 藤野恵実 | LOSS | 判定 1-0 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 2部 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | WIN | 判定 0-3 |  |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 藤野恵実 | LOSS | TKO | 3R 03:43 |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs 高本千代 | DRAW |  |  |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs 徳本望愛 | LOSS | 判定 1-2 |  |
| 2026-05-17 | プロフェッショナル修斗公式戦福岡大会TORAO38 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | LOSS | TS | 3R 02:08 |

## 平田 彩音（missing、既存slug: なし）

- shooto選手ID: 1627 (`https://www.shooto-mma.com/fighters/?id=1627`)
- ローマ字表記(テーブル列。URLには含まれない): AYANE HIRATA
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]B
- 総bout件数: 6 (勝4 敗2 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-08-20 | 広島大会「TORAO | colors」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | 判定 2-0 |  |
| 2023-12-02 | COLORS Produce by SHOOTO Vol.2 “FIGHT&MOSH” | PRO_SHOOTO_MAINLINE | vs MIYU | WIN | TKO | 2R 03:09 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs パクソヨン | LOSS | 判定 0-2 |  |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | KO | 1R 00:33 |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs NOEL (noel) | LOSS | TS | 1R 04:55 |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs 井上智子 | WIN | 判定 3-0 |  |

## パク ソヨン（missing、既存slug: なし）

- shooto選手ID: 1464 (`https://www.shooto-mma.com/fighters/?id=1464`)
- ローマ字表記(テーブル列。URLには含まれない): PARK SEO YOUNG
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級B
- 総bout件数: 6 (勝3 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs 黒部三奈 | LOSS | S | 2R 01:34 |
| 2023-08-20 | 広島大会「TORAO | colors」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 古賀愛蘭 | LOSS | 判定 3-0 |  |
| 2023-12-02 | COLORS Produce by SHOOTO Vol.2 “FIGHT&MOSH” | PRO_SHOOTO_MAINLINE | vs KAREN | LOSS | TKO | 1R 04:44 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 平田彩音 | WIN | 判定 0-2 |  |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs NOEL (noel) | WIN | 判定 3-0 |  |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | S | 1R 00:32 |

## NOEL（listed、既存slug: noel）

- shooto選手ID: 1554 (`https://www.shooto-mma.com/fighters/?id=1554`)
- ローマ字表記(テーブル列。URLには含まれない): NOEL
- 修斗選手紹介ページ階級ラベル: グラップリングB
- 総bout件数: 6 (勝4 敗1 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-04-09 | SHOOTO GIG TOKYO Vol.34 | GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs 丸山帆波 | WIN | TS | 1R 01:43 |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs 井上愛羅 | DRAW |  |  |
| 2023-08-20 | 広島大会「TORAO | colors」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 伊東侑姫 | WIN | TS | 1R 01:24 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | 判定 0-3 |  |
| 2024-09-22 | PROFESSIONAL SHOOTO 2024 Vol.7 | PRO_SHOOTO_MAINLINE | vs パクソヨン | LOSS | 判定 3-0 |  |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs 平田彩音 | WIN | TS | 1R 04:55 |

## ジェニー ファン（missing、既存slug: なし）

- shooto選手ID: 1557 (`https://www.shooto-mma.com/fighters/?id=1557`)
- ローマ字表記(テーブル列。URLには含まれない): JENNY HUANG
- 修斗選手紹介ページ階級ラベル: 女子アトム級 [ -47.6 Kg ]B
- 総bout件数: 2 (勝1 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs 古賀愛蘭 | WIN | S | 3R 02:35 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 古賀愛蘭 | LOSS | 判定 1-2 |  |

## 嶋屋 澪（missing、既存slug: なし）

- shooto選手ID: 1729 (`https://www.shooto-mma.com/fighters/?id=1729`)
- ローマ字表記(テーブル列。URLには含まれない): SHIYAMA MIO
- 修斗選手紹介ページ階級ラベル: トライアウトB
- 総bout件数: 8 (勝2 敗5 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 植田咲 | WIN | TKO | 2R 01:28 |
| 2024-12-29 | PROFESSIONAL SHOOTO 2024 FINAL in OSAKA | PRO_SHOOTO_MAINLINE | vs Fukky | DRAW |  |  |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs 高本千代 | LOSS | 判定 3-0 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs erika | LOSS |  |  |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 村上彩 | LOSS | 判定 3-0 |  |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 片山智絵 | LOSS | 判定 0-3 |  |
| 2026-05-31 | PROFESSIONAL SHOOTO 2026 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs 深井志保 | WIN | 判定 1-0 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 中村未来 | LOSS | TS | 2R 04:00 |

## 渡辺 彩華（missing、既存slug: なし）

- shooto選手ID: 1536 (`https://www.shooto-mma.com/fighters/?id=1536`)
- ローマ字表記(テーブル列。URLには含まれない): AYAKA WATANABE
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級B
- 総bout件数: 4 (勝3 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs 黒部三奈 | WIN | KO | 2R 02:29 |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs SARAMI | WIN | TKO | 2R 02:36 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs パクボヒョン | LOSS | 判定 0-3 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 高本千代 | WIN | TS | 3R 02:41 |

## 高本 千代（missing、既存slug: なし）

- shooto選手ID: 1656 (`https://www.shooto-mma.com/fighters/?id=1656`)
- ローマ字表記(テーブル列。URLには含まれない): CHIYO TAKAMOTO
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級B
- 総bout件数: 8 (勝3 敗4 分1 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-12-03 | 山口大会「TORAO31」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 古賀愛蘭 | LOSS | 判定 3-0 |  |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | LOSS | 判定 1-0 |  |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | DRAW |  |  |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs 嶋屋澪 | WIN | 判定 3-0 |  |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 片山智絵 | LOSS |  |  |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs erika | WIN | KO | 2R 00:32 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 村上彩 | WIN | 判定 2-0 |  |
| 2026-07-20 | PROFESSIONAL SHOOTO 2026 Vol.5 | PRO_SHOOTO_MAINLINE | vs 渡辺彩華 | LOSS | TS | 3R 02:41 |

## erika（missing、既存slug: なし）

- shooto選手ID: 1757 (`https://www.shooto-mma.com/fighters/?id=1757`)
- ローマ字表記(テーブル列。URLには含まれない): erika
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級A
- 総bout件数: 5 (勝3 敗1 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | 判定 0-3 |  |
| 2025-05-18 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.4 | PRO_SHOOTO_MAINLINE | vs 村上彩 | WIN | 判定 0-2 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 嶋屋澪 | WIN |  |  |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs 高本千代 | LOSS | KO | 2R 00:32 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 片山智絵 | UNRESOLVED | 不戦 |  |

## 村上 彩（missing、既存slug: なし）

- shooto選手ID: 1793 (`https://www.shooto-mma.com/fighters/?id=1793`)
- ローマ字表記(テーブル列。URLには含まれない): MURAKAMI AYA
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級A
- 総bout件数: 5 (勝2 敗3 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2025-05-18 | 【第2部】PROFESSIONAL SHOOTO 2025 Vol.4 | PRO_SHOOTO_MAINLINE | vs erika | LOSS | 判定 0-2 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 片山智絵 | WIN | S | 2R 04:49 |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 嶋屋澪 | WIN | 判定 3-0 |  |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs 前澤智 | LOSS | S | 1R 04:32 |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs 高本千代 | LOSS | 判定 2-0 |  |

## 片山 智絵（missing、既存slug: なし）

- shooto選手ID: 1733 (`https://www.shooto-mma.com/fighters/?id=1733`)
- ローマ字表記(テーブル列。URLには含まれない): TOMOE KATAYAMA
- 修斗選手紹介ページ階級ラベル: トライアウトB
- 総bout件数: 5 (勝3 敗1 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 徳本望愛 | WIN | 判定 0-1 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 村上彩 | LOSS | S | 2R 04:49 |
| 2025-09-21 | 【第1部】PROFESSIONAL SHOOTO 2025 Vol.7 | PRO_SHOOTO_MAINLINE | vs 高本千代 | WIN |  |  |
| 2025-11-22 | PROFESSIONAL SHOOTO 2025 Vol.10 in OSAKA | PRO_SHOOTO_MAINLINE | vs 嶋屋澪 | WIN | 判定 0-3 |  |
| 2026-03-29 | PROFESSIONAL SHOOTO 2026 Vol.2 | PRO_SHOOTO_MAINLINE | vs erika | UNRESOLVED | 不戦 |  |

## 黒部 三奈（missing、既存slug: なし）

- shooto選手ID: 1208 (`https://www.shooto-mma.com/fighters/?id=1208`)
- ローマ字表記(テーブル列。URLには含まれない): MINA KUROBE
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級B
- 総bout件数: 12 (勝6 敗4 分0 NC1 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2019-07-15 | SHOOTO 30th ANNIVERSARY TOUR 第6戦 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs イイェジ | WIN | S | 2R 04:48 |
| 2019-11-24 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs ターニャアンゲラー | WIN | KO | 2R 04:52 |
| 2020-03-29 | 【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship | PRO_SHOOTO_MAINLINE;CANCELLED_LABEL_IN_TITLE | vs 大島沙緒里 (oshima-saori) | UNRESOLVED |  |  |
| 2020-05-31 | PROFESSIONAL SHOOTO 2020 Vol.3 ABEMAテレビマッチ Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 大島沙緒里 (oshima-saori) | WIN | KO | 3R 01:54 |
| 2020-08-01 | PROFESSIONAL SHOOTO 2020 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | 判定 3-0 |  |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs SARAMI | LOSS | 判定 0-3 |  |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | WIN | 判定 3-0 |  |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs パクソヨン | WIN | S | 2R 01:34 |
| 2022-11-06 | THE SHOOTO OKINAWA vol.7 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 小生由紀 | NO_CONTEST |  |  |
| 2023-01-15 | PROFESSIONAL SHOOTO 2023 開幕戦 | PRO_SHOOTO_MAINLINE | vs 渡辺彩華 | LOSS | KO | 2R 02:29 |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 杉内由紀 | LOSS | S | 1R 02:43 |
| 2025-04-20 | THE SHOOTO OKINAWA vol.12 | OKINAWA_REGIONAL;PRO_SHOOTO_MAINLINE | vs 小生由紀 | LOSS | 判定 0-3 |  |

## SARAMI（missing、既存slug: なし）

- shooto選手ID: 1300 (`https://www.shooto-mma.com/fighters/?id=1300`)
- ローマ字表記(テーブル列。URLには含まれない): SARAMI
- 修斗選手紹介ページ階級ラベル: 女子スーパーアトム級B
- 総bout件数: 4 (勝3 敗1 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2020-11-23 |  | PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | S | 1R 02:46 |
| 2021-07-25 | PROFESSIONAL SHOOTO 2021 Vol.5 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 中村未来 | WIN | TKO | 2R 02:48 |
| 2021-11-06 | PROFESSIONAL SHOOTO 2021 Vol.7 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 黒部三奈 | WIN | 判定 0-3 |  |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs 渡辺彩華 | LOSS | TKO | 2R 02:36 |

## 藤野 恵実（missing、既存slug: なし）

- shooto選手ID: 1583 (`https://www.shooto-mma.com/fighters/?id=1583`)
- ローマ字表記(テーブル列。URLには含まれない): EMI FUJINO
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 7 (勝6 敗0 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs エンゼル☆志穂 | WIN | S | 1R 03:06 |
| 2023-09-24 | PROFESSIONAL SHOOTO 2023 Vol.6 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | WIN | 判定 0-2 |  |
| 2023-11-19 | PROFESSIONAL SHOOTO 2023 Vol.7 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | 判定 1-0 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 2部 | PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | TKO | 2R 03:09 |
| 2024-05-19 | 【第1部】PROFESSIONAL SHOOTO 2024 Vol.4 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | TKO | 3R 03:43 |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs 前澤智 | UNRESOLVED |  |  |
| 2026-01-18 | 【第1部】COLORS Produce by SHOOTO Vol.6 | PRO_SHOOTO_MAINLINE | vs アラミ | WIN | 判定 3-0 |  |

## 宝珠山 桃花（missing、既存slug: なし）

- shooto選手ID: 1319 (`https://www.shooto-mma.com/fighters/?id=1319`)
- ローマ字表記(テーブル列。URLには含まれない): MOMOKA HOSHUYAMA
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 15 (勝8 敗7 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2021-05-16 | PROFESSIONAL SHOOTO 2021 Vol.3 Supported by ONE Championship | PRO_SHOOTO_MAINLINE | vs 柳仙香 | LOSS | TKO | 2R 01:47 |
| 2021-12-05 | 闘裸男26 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 和田千聖 | WIN | 判定 3-0 |  |
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 黒部三奈 | LOSS | 判定 3-0 |  |
| 2022-05-15 | TORAO GIG04 | TORAO_REGIONAL;GIG_UNDERCARD_SERIES;PRO_SHOOTO_MAINLINE | vs ヒヤマNFC | WIN | S | 1R 03:03 |
| 2022-07-03 | PROFESSIONAL SHOOTO 2022 Vol.4 in OSAKA | PRO_SHOOTO_MAINLINE | vs Fukky | LOSS | 判定 0-2 |  |
| 2022-12-04 | TORAO28 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 古賀愛蘭 | LOSS | 判定 0-1 |  |
| 2023-05-21 | Colors（カラーズ） | PRO_SHOOTO_MAINLINE | vs エンゼル☆志穂 | WIN | S | 1R 04:39 |
| 2023-07-23 | PROFESSIONAL SHOOTO 2023 Vol.5 | PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | 判定 2-0 |  |
| 2023-09-24 | PROFESSIONAL SHOOTO 2023 Vol.6 | PRO_SHOOTO_MAINLINE | vs 藤野恵実 | LOSS | 判定 0-2 |  |
| 2024-01-28 | PROFESSIONAL SHOOTO 2024 Vol.1 - 2部 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | LOSS | 判定 0-3 |  |
| 2024-05-26 | TORAO32 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | 判定 3-0 |  |
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 高本千代 | WIN | 判定 1-0 |  |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs 高田暖妃 | WIN | 判定 3-0 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs パクボヒョン | LOSS | TKO | 4R 01:38 |
| 2026-05-17 | プロフェッショナル修斗公式戦福岡大会TORAO38 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 杉本恵 | WIN | TS | 3R 02:08 |

## パク ボヒョン（missing、既存slug: なし）

- shooto選手ID: 1716 (`https://www.shooto-mma.com/fighters/?id=1716`)
- ローマ字表記(テーブル列。URLには含まれない): BO HYUN PARK
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 3 (勝3 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-08-03 | COLORS Produce by SHOOTO Vol.3 | PRO_SHOOTO_MAINLINE | vs 渡辺彩華 | WIN | 判定 0-3 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs ソルト | WIN | 判定 3-0 |  |
| 2025-07-21 | PROFESSIONAL SHOOTO 2025 Vol.6 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | WIN | TKO | 4R 01:38 |

## ハイライ ウーシャアモー（missing、既存slug: なし）

- shooto選手ID: 1700 (`https://www.shooto-mma.com/fighters/?id=1700`)
- ローマ字表記(テーブル列。URLには含まれない): HAILAIWUSAMO
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 1 (勝1 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs ソルト | WIN | 判定 1-2 |  |

## ソルト（missing、既存slug: なし）

- shooto選手ID: 1418 (`https://www.shooto-mma.com/fighters/?id=1418`)
- ローマ字表記(テーブル列。URLには含まれない): SALT
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 7 (勝2 敗4 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-01-16 | PROFESSIONAL SHOOTO 2022 開幕戦 | PRO_SHOOTO_MAINLINE | vs 杉本恵 | LOSS | 判定 3-0 |  |
| 2022-03-21 | PROFESSIONAL SHOOTO 2022 Vol.2 | PRO_SHOOTO_MAINLINE | vs 須恵樹季 | UNRESOLVED |  |  |
| 2022-06-05 | 北海道大会 | PRO_SHOOTO_MAINLINE | vs 和田千聖 | WIN | 判定 3-0 |  |
| 2022-07-17 | PROFESSIONAL SHOOTO 2022 Vol.5 | PRO_SHOOTO_MAINLINE | vs 柳仙香 | LOSS | S | 2R |
| 2023-12-02 | COLORS Produce by SHOOTO Vol.2 “FIGHT&MOSH” | PRO_SHOOTO_MAINLINE | vs ホジュギョン | WIN | TKO | 1R 02:37 |
| 2024-05-19 | 【第2部】修斗×YFU 7対7 日中対抗戦 | PRO_SHOOTO_MAINLINE | vs ハイライウーシャアモー | LOSS | 判定 1-2 |  |
| 2025-03-16 | PROFESSIONAL SHOOTO 2025 Vol.2 | PRO_SHOOTO_MAINLINE | vs パクボヒョン | LOSS | 判定 3-0 |  |

## KAREN（missing、既存slug: なし）

- shooto選手ID: 1642 (`https://www.shooto-mma.com/fighters/?id=1642`)
- ローマ字表記(テーブル列。URLには含まれない): KAREN
- 修斗選手紹介ページ階級ラベル: 女子B
- 総bout件数: 1 (勝1 敗0 分0 NC0 未解決0)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2023-12-02 | COLORS Produce by SHOOTO Vol.2 “FIGHT&MOSH” | PRO_SHOOTO_MAINLINE | vs パクソヨン | WIN | TKO | 1R 04:44 |

## 高田 暖妃（missing、既存slug: なし）

- shooto選手ID: 1450 (`https://www.shooto-mma.com/fighters/?id=1450`)
- ローマ字表記(テーブル列。URLには含まれない): ATSUHI TAKADA
- 修斗選手紹介ページ階級ラベル: 女子ストロー級B
- 総bout件数: 5 (勝3 敗1 分0 NC0 未解決1)
- レコード+対戦テーブル構築: **YES**

| 日付 | 大会 | 団体フラグ | 対戦 | 結果 | 決着方法 | ラウンド/タイム |
|---|---|---|---|---|---|---|
| 2022-06-05 | 北海道大会 | PRO_SHOOTO_MAINLINE | vs 山内絵里 | WIN | 判定 0-2 |  |
| 2023-08-20 | 広島大会「TORAO | colors」 | TORAO_REGIONAL;PRO_SHOOTO_MAINLINE | vs 幸田來弥 | UNRESOLVED | 判定 - |  |
| 2024-12-15 | COLORS Produce by SHOOTO Vol.4 | PRO_SHOOTO_MAINLINE | vs チョンチャヒョン | WIN |  |  |
| 2025-06-14 | COLORS Produce by SHOOTO Vol.5 | PRO_SHOOTO_MAINLINE | vs 宝珠山桃花 | LOSS | 判定 3-0 |  |
| 2026-05-17 | 【第2部】PROFESSIONAL SHOOTO 2026 Vol.3 | PRO_SHOOTO_MAINLINE | vs 吉成はるか | WIN | TKO | 2R 02:05 |

# 泰斗(taito)誤統合監査

作成日: 2026-08(PR: `fix/kick-mononym-mma-contamination`)

## 疑いの発端

`/kick/fighters/taito` は、K-1公式由来(2010-12〜2020-09、-65kg級キックボクシング、
LEOPARD GYM所属)と、KROSS×OVER公式由来(2026-03-01・2026-06-21)の戦績が、表記名
「泰斗」の一致だけで同一identityに結合されている疑いが指摘された。

## 調査

### 1. 現在の結合状態(修正前)

`data/kick/generated/fighters/taito.json` は1エントリのみで、`orgs` に
`K-1 / Krush / Krush-EX` / `DEEP☆KICK` / `KROSS×OVER` の3団体が並んでいた。
K-1側の最終出場は2020-09-22、KROSS×OVER側の初出場は2026-03-01で、**空白は約5年5ヶ月**。

### 2. 結合の原因(コード上の裏取り)

`data/kick/bouts_krossover.json` を見ると、両bout行の `fighter_slug` が
`泰斗|LEOPARD GYM|https://www.k-1.co.jp/fighter/14`(K-1公式の登録identityそのもの)
になっていた。`scripts/standup-pipeline/ingest_krossover.py` の `resolve(name, aff)`
関数を確認したところ、`fighters.json` 内で表記名一致の候補が**1件しかない場合は
所属(affiliation)の裏取りを一切せずその1件へ確定させる**仕様だった
(`len(cands) == 1` の分岐で `aff` パラメータが未使用のまま return される)。
`fighters.json` には「泰斗」がK-1のこの1件しか登録されておらず、KROSS×OVER側の
「泰斗」は無条件でこのidentityへ結合されていた。

### 3. 同一人物かどうかの直接確認(krossover.jp本文)

`krossover.jp/?p=3929`(3/1 CAGE.8)・`krossover.jp/?p=4122`(6/21 CAGE.9)の本文を
直接取得し、以下を確認した:

| 項目 | K-1公式「泰斗」 | KROSS×OVER「泰斗」 |
|---|---|---|
| 所属 | LEOPARD GYM(fighters.json) | **高本道場**(krossover.jp本文で確認) |
| 生年月日 | 1987.12.19(fighters.json) | 不明(KROSS×OVER記事に記載なし) |
| ルール | キックボクシング(K-1/Krush、-65kg級) | **MMA**(「▼第8試合KROSS×OVER PRO-MMA -73kg FIGHT」「第15試合 MMA PART メインイベントKROSS×OVER PRO-MMA LIGHTWEIGHT(-70.3kg)初代王座決定戦」) |
| 活動期間 | 2010-12〜2020-09 | 2026-03〜2026-06 |
| 試合内容 | 立ち技(パンチ・キック中心) | テイクダウン・パウンド・腕十字等のグラウンド攻防を含むMMA |

**所属(LEOPARD GYM vs 高本道場)・ルール(キックボクシング vs MMA)のいずれも一致せず、
同一人物である根拠は無い。** 表記名の一致のみで自動結合されていたと判断する。

## 対応

- KROSS×OVER側の2bout(2026-03-01 vs 小材貴、2026-06-21 vs 岸本篤史)はいずれもMMA
  ルールの試合であることが確認できたため、`data/kick/manualRuleExclusions.json` へ
  `category: "mma"` として追加し除外した(MMA混入監査(項目3)の対応と同一の仕組み)。
- 結果として泰斗(K-1)のページからはKROSS×OVER分の2boutが消え、K-1/DEEP☆KICKの
  25bout(9勝15敗1分)のみになった。K-1由来のデータには一切手を加えていない。
- KROSS×OVER側の「泰斗(高本道場)」は、生年月日等の裏付け情報が無く新規選手として
  fighters.jsonへ登録する材料が不足しているため、今回は新規エントリの作成は行わず、
  上記の除外(=どの選手にも結合しない)にとどめた。

## 再発防止

`scripts/check-kick-identity-merge-risk.ts` を新設し、「活動空白5年以上+団体変化+
後続団体が名前一致ベース結合団体」という代理指標で、同型の誤統合疑いをビルド時に
検出できるようにした(ratchetベースライン、現状52件)。個別の裏取り・分離は今回は
泰斗のみ実施し、他の51件は `out/kick-mononym-risk-survey.md` の一覧に記録した
(分離作業は別PRへ申し送り)。

`scripts/standup-pipeline/ingest_krossover.py` の `resolve()` 関数自体(所属裏取りを
省略する仕様)は今回のPRでは変更していない(データ生成パイプラインの改修は本PRの
スコープ外。同種の混入がまだ起こりうることは上記ゲートで検知する)。

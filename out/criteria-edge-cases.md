# 境界事例(実名、35件)

`scripts/analyze-inclusion-criteria.ts`の出力をそのまま整形したもの。**どう扱うべきかは書いていない。** 各行は候補基準F/A/B1/B2/C/D/Eそれぞれでの採否のみを示す。カテゴリをまたいで重複する選手(例: 中井りん、大成)は各カテゴリに実データのまま重複掲載している(実際に複数の類型に該当する実例であるため)。

## デビュー戦1回のみ(以降出場記録なし・5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 坂野周平 | missing | 1 | DEEP FIGHT CHALLENGE | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 琥 | missing | 1 | DEEP FIGHT CHALLENGE | 採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 |
| 渡部恵多 | missing | 1 | DEEP FIGHT CHALLENGE | 採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 |
| 佐々木琢磨 | missing | 1 | DEEP FIGHT CHALLENGE | 採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 |
| 森谷風真 | missing | 1 | DEEP FIGHT CHALLENGE | 採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 | 非採用 |

## 若手育成イベント(DEEP FIGHT CHALLENGE)中心で複数回出場(5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| マイティ・saw | missing | 3 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT/DEEP IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |
| 中尾響 | missing | 3 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT/DEEP IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |
| 朝比奈龍希 | missing | 3 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT/DEEP HAMAMATSU IMPACT | 採用 | 非採用 | 採用 | 採用 | 採用 | 非採用 | 非採用 |
| 川口海翔 | missing | 2 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT | 採用 | 非採用 | 採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 今野蓮弥 | missing | 2 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT | 採用 | 非採用 | 採用 | 非採用 | 採用 | 非採用 | 非採用 |

## DEEP JEWELS(女子)のみの出場(5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 中井りん | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 奥富夕夏 | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 竹林エル | missing | 3 | DEEP JEWELS | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |
| イ・イェジ | **listed** | 2 | DEEP JEWELS | 採用 | 採用 | 採用 | 非採用 | 採用 | 非採用 | 採用 |
| ののか | missing | 2 | DEEP JEWELS | 採用 | 採用 | 採用 | 非採用 | 採用 | 非採用 | 採用 |

## 外国人選手層(name_confidence=foreign、1件のみ検出)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| マイティ・saw | missing | 3 | DEEP FIGHT CHALLENGE/DEEP TOKYO IMPACT/DEEP IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |

`name_confidence=foreign`が立っている行はCSV全体で3行(1名分)のみだった。層として薄いため、次の「kana_only」層も外国人選手推定の補助材料として併記する。

## カタカナ表記のみ(name_confidence=kana_only、外国人選手推定の補助層・5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| ケンシロウ | **listed** | 3 | DEEP IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |
| マサト・ナカムラ | missing | 3 | DEEP IMPACT/DEEP TOKYO IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 非採用 | 採用 |
| サラ・マフムード | missing | 1 | DEEP OSAKA IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| フェルナンド | missing | 1 | DEEP OSAKA IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| カーレッジユウキ | missing | 2 | DEEP OSAKA IMPACT | 採用 | 非採用 | 採用 | 非採用 | 採用 | 非採用 | 非採用 |

## 装飾リングネーム(decorated_suspect、1件のみ検出)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 石田ガリット勝也 | missing | 1 | DEEP NAGOYA IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |

## DEEPとパンクラス/修斗の両方に出場(8件、全件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 中井りん | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 村元友太郎 | **listed** | 2 | DEEP IMPACT | 採用 | 採用 | 採用 | 非採用 | 採用 | 採用 | 採用 |
| 知名昴海 | missing | 3 | DEEP IMPACT/DEEP OSAKA IMPACT/DEEP TOKYO IMPACT | 採用 | 採用 | 採用 | 採用 | 採用 | 採用 | 採用 |
| 百湖 | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 非採用 | 採用 |
| 万智 | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 非採用 | 採用 |
| 青井人 | **listed** | 1 | DEEP OSAKA IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 大島沙緒里 | **listed** | 1 | DEEP IMPACT | 採用 | 採用 | 非採用 | 非採用 | 採用 | 非採用 | 採用 |
| 大成 | **hidden** | 1 | DEEP IMPACT | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |

## タイトル戦出場歴はあるが収集期間内の出場は少ない(1回・5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 中井りん | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 奥富夕夏 | missing | 1 | DEEP JEWELS | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 越智晴雄 | missing | 1 | DEEP TOKYO IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| KENTA | **listed** | 1 | DEEP IMPACT | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |
| 大成 | **hidden** | 1 | DEEP IMPACT | 採用 | 採用 | 非採用 | 非採用 | 採用 | 採用 | 採用 |

## listed済みだが基準Fを除く全候補で非採用

**該当0件。** listed64名のうち、A/B1/B2/C/D/Eの全てで非採用になる選手は見つからなかった(該当なしという結果自体をそのまま報告する)。

## listed済みだが基準A(DEEP IMPACT/JEWELS本戦のみ)では非採用(5件)

| 選手名 | status | 出場回数 | ブランド | F | A | B1 | B2 | C | D | E |
|---|---|---|---|---|---|---|---|---|---|---|
| 中島太一 | listed | 1 | DEEP TOKYO IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 安井飛馬 | listed | 1 | DEEP TOKYO IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 飴山聖也 | listed | 1 | DEEP OSAKA IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 海飛 | listed | 1 | DEEP TOKYO IMPACT | 採用 | 非採用 | 非採用 | 非採用 | 採用 | 非採用 | 非採用 |
| 山崎弥十朗 | listed | 2 | DEEP TOKYO IMPACT | 採用 | 非採用 | 採用 | 非採用 | 採用 | 非採用 | 非採用 |

---

カテゴリ横断の重複を除いたユニーク人数: **35名**。

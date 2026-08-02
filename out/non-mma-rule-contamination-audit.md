# K-1ルール・SBルール等 非MMA判定漏れの横断調査(read-only)

調査日: 2026-08-02

## 背景

PR #367(RIZIN 2015年旗揚げ興行「IZAの舞」の追加、未マージ)で、`parseRuleInfo()`
(`src/lib/mnewsRating/rizinScraper.ts`)が「K-1ルール」(武尊 vs ヤン・ミン)・
「SBルール」(シュートボクシングの略記、曙太郎 vs ボブ・サップ)を非MMAと判定
できないギャップが発覚した。同PRでは手動書き起こしで回避し、パーサー本体の
修正は「他78大会への影響があるためスコープ外」として見送っている。

本調査は、この種の「ルール表記があるのに自動パースでMMA戦績に混入する」問題が、

1. RIZINの既存78大会(自動パース済み分)
2. DEEP・パンクラス・修斗

に実害を出していないかを確認するもの。**修正は行わず、件数と影響選手の報告のみ**。

## 手法

### RIZIN

`data/rizinRecords.json`のboutは、パース済みの`ruleType`(enum)しか保持しておらず、
`parseRuleInfo()`の入力であるルール原文(`ruleLineRaw`)自体は保存されていない。
そのため、既存78大会(RIZIN.1・RIZIN.2は手動書き起こしのため対象外、77大会)に
ついては、RIZIN公式サイトを実際に再取得し、現行の`splitIntoBoutChunks`→
`parseBoutChunk`→`parseRuleInfo`をそのまま通して`ruleLineRaw`を復元・検査した
(`scripts/audit-non-mma-rule-gap-rizin-refetch.ts`、data/は書き換えない)。

### DEEP・パンクラス・修斗

3団体のboutは`headingText`・`namedDivision`にルール原文がそのまま残っているため、
再取得はせず既存`data/*.json`を直接キーワード検索した
(`scripts/audit-non-mma-rule-contamination.ts`)。

検索キーワードは、RIZINの`NON_MMA_RULE_PATTERNS`とパンクラスの`NON_MMA_PATTERNS`
(いずれもソース中の既存定義)を合成し、「K-1」「SBルール」(略記)を追加したもの:

```
K-?1(?!グ) | SB\s*ルール | キックボクシ | キック(ルール|戦) | Kickboxing | ISKA |
シュートボクシング | グラップリング | ベアナックル | スタンディングバウト |
エキシビ | エキジビ | MIXルール | チャレンジ\s*ルール | プロレスルール
```

`methodRaw`・`noteRaw`は検索対象から外した。「柔術」を含めて全文検索した初回試行で、
修斗の`noteRaw`(次戦告知文)に登場する対戦相手の**所属ジム名**(「柔術&MMA
アカデミーG-face」)を誤ってヒットさせる事故が実際に発生したため
(該当選手はMMAの試合であり非MMA混入ではない)。

抽出したbout全件について、実際の集計関数(`computeFighterDeepRecord`・
`computeFighterShootoRecord`・`computeFighterPancraseRecord`・
`computeMultiOrgRecord`)に通し、`.bouts`(集計に算入)側に入るか`.excluded`
(除外)側に入るかを実測した。

## 結果サマリ

| 団体 | キーワード該当bout数(全体) | うちslug解決済み(選手記録に影響し得る) | 実際の混入 |
|---|---|---|---|
| RIZIN(既存77大会・再取得) | K-1/SBルール(略記)一致: **0件** | - | **なし**(下記参照) |
| RIZIN(既存データ内) | 4件 | 2件 | **なし**(既存ロジックで正しく除外済み) |
| パンクラス | 28件 | 4件 | **なし**(既存ロジックで正しく除外済み) |
| 修斗 | 63件 | 9件(7名) | **あり・全件混入**(フィルタ機構が存在しない) |
| DEEP | 41件 | 7件(6名) | **あり・全件混入**(フィルタ機構が存在しない) |

## RIZIN: 既存77大会に「K-1/SBルール」ギャップの再現なし

77大会(RIZIN.3〜RIZIN.53系列、LANDMARK・TRIGGER・超RIZIN等含む)をすべて
再取得し、現行`parseRuleInfo()`にそのまま通した結果、ルール原文に
「K-1」「SBルール」を含むbout自体が0件だった。PR #367で見つかった
IZAの舞(2015年、RIZIN旗揚げ興行の一つ)は、既存の自動パース対象78大会には
含まれない独立した大会であり、このギャップが実際に影響するのはIZAの舞
単体(同PRで手動書き起こし済み)のみと確認できた。**既存データへの実害なし。**

なお、既存データの`headingText`ベースの検索でも4件ヒットしたが、いずれも
「柔術エキシビジョンイリミネーションマッチ」(グラップリング、正しく除外済み)・
「スペシャルエキシビジョンマッチ」(那須川天心プロデュース、朝倉未来 vs
フロイド・メイウェザー、スタンディングバウトとして正しく除外済み)で、
K-1/SBルールとは無関係かつ既存ロジックで正しく処理されている。

## パンクラス: 既存フィルタは正常動作。ただし別種のギャップを1件発見

パンクラスは`computeFighterPancraseRecord`内に`MMA_RULE_TYPES = new Set(["MMA"])`
による絞り込みが既にあり(RIZINと同じ設計)、キーワードヒットした選手解決済み
4件(北方大地・砂辺光久・伊澤星花・北岡悟)は**全件正しく`excluded`側に入り、
戦績に混入していない**ことを実測で確認した。

一方、パンクラスの非MMA判定パターン(`scripts/build-pancrase-records.ts`の
`NON_MMA_PATTERNS`)にはRIZIN側にある`ISKA`パターンが無く、
「PANCRASE 252 / レオ・ズーリック vs 小西拓槙 / ISKAオリエンタル・
インターコンチネンタル・スーパーウェルター級タイトルマッチ...ISKAオリエンタル・
ルール」が`ruleType: "MMA"`に誤分類されていた。両選手とも現時点でslug未解決
(選手DB未登録)のため**現在の戦績への実害はゼロ**だが、将来この2選手が
DBに追加されればそのまま混入する。K-1/SBルールとは別種だが同じ「キーワード
リスト漏れ」というカテゴリの問題として記録しておく。

## 修斗: 「異種目カードを持たない」という設計前提が誤り。7名に実害

`shootoRecordsAggregate.ts`のコメントは「修斗はキックボクシング等の異種目
カードを持たない」ため`ruleType`による絞り込みを行わない、としている。
実際には63件のキックボクシング・グラップリング・エキシビジョン等のbout
が確認でき、**この前提は誤り**。`computeFighterShootoRecord`にルール種別
フィルタが存在しないため、slug解決済みの7名は該当boutが無条件で
`.bouts`(集計対象)に算入されていた(`excluded`は全員0件)。

| 選手 | slug | 混入bout数 | 修斗単体戦績(混入込み) | 該当大会・ルール |
|---|---|---|---|---|
| 黒部三奈 | kurobe-mina | 3 | 6勝4敗1NC(11戦中3戦が非MMA) | THE SHOOTO OKINAWA vol.7(NC・エキシビジョン)、COLORS Vol.3(敗・グラップリング)、THE SHOOTO OKINAWA vol.12(敗・グラップリング) |
| 上原平 | uehara-taira | 1 | 7勝3敗3分1NC | 東京・後楽園ホール(NC・エキシビジョン) |
| NOEL | noel | 1 | 4勝1敗1分 | Colors（カラーズ）(分・グラップリング) |
| 藤野恵実 | fujino-emi | 1 | 5勝0敗2分 | COLORS Vol.4(勝・グラップリング) |
| 中島陸 | nakajima-riku | 1 | 8勝0敗1分 | BORDER2025「The2nd」(勝・エキシビジョン) |
| 村上彩 | aya-murakami | 1 | 2勝3敗 | 【第1部】COLORS Vol.6(敗・グラップリング) |
| 平田彩音 | hirata-ayane | 1 | 4勝2敗 | COLORS Vol.5(勝・グラップリング) |

## DEEP: bout単位のルール種別フィルタが存在しない。6名に実害

DEEPは`ruleType`が常に`"unknown"`で入り(`deepRecordsAggregate.ts`のコメント
どおり)、既存の除外機構は(1)イベントタイトルに"KICK"を含む大会をまるごと
除外する`isKickEvent()`(イベント単位)、(2)`KNOWN_NON_PROFESSIONAL_BOUTS`
(未解決bout1件のみの手書きdenylist、`scripts/backfill-shooto-pancrase-slugs.ts`)
の2つだけで、**いずれもbout単位の混在カード(大会タイトルはMMA本戦だが
一部undercardのみキック/グラップリングルール)を捕捉できない**。

実例: 「DEEP HAMAMATSU IMPACT 2023」はタイトルに"KICK"を含まないため
`isKickEvent()`を通過するが、実際には全15試合中9試合が「DEEP◯◯kg以下
キックルール」の完全なキックボクシング undercard だった。

`computeFighterDeepRecord`にもルール種別フィルタが無いため、slug解決済みの
6名は該当boutが無条件で算入されていた(`excluded`は全員0件)。

| 選手 | slug | 混入bout数 | DEEP単体戦績(混入込み) | 該当大会・ルール |
|---|---|---|---|---|
| 三浦彩佳 | ayaka-miura | 2 | 3勝2敗(5戦中2戦が非MMA) | DEEP JEWELS 2(勝・グラップリング)、DEEP JEWELS 5(敗・グラップリング) |
| SARAMI | sarami | 2 | 6勝9敗(15戦中2戦が非MMA) | DEEP JEWELS 5(勝・グラップリング)、DEEP JEWELS 11(敗・キックルール) |
| 杉本恵 | sugimoto-megumi | 2 | **0勝3敗(3戦中2戦が非MMA)** | DEEP JEWELS 9(敗・グラップリング)、DEEP JEWELS 32(敗・グラップリング) |
| 伊澤星花 | izawa-seika | 1 | 5勝0敗 | DEEP JEWELS 32(勝・グラップリング) |
| タンク内藤 | naito-tank | 1 | **2勝0敗(2勝中1勝が非MMA)** | DEEP HAMAMATSU IMPACT 2023(勝・キックルール) |
| 青野ひかる | aono-hikaru | 1 | 13勝6敗 | DEEP JEWELS 45(勝・グラップリング) |

特に杉本恵(DEEP単体3戦中2戦が非MMA、しかも両方敗)とタンク内藤
(DEEP単体2勝のうち1勝がキックボクシングルール)は、非MMA bout の
比重が高く、除外した場合に戦績の見え方が変わる可能性がある。

## 4団体通算(`computeMultiOrgRecord`)への波及

上記の混入は、DEEP/修斗の単体集計を経由してそのまま4団体通算にも算入
されていることを実測で確認した(例: 伊澤星花は4団体通算17勝0敗のうち
DEEP側1勝がグラップリングルール、杉本恵は4団体通算11勝8敗3分のうち
DEEP側の敗2つが非MMA)。

## 調査手法の限界

- DEEP/パンクラス/修斗のキーワード検索は`headingText`/`namedDivision`の
  テキストマッチであり、ルール表記が完全に省略されている・独自の言い回しを
  している非MMA boutは捕捉できない(悉皆ではなく既知パターンの横断確認)。
- RIZIN既存77大会の再取得はK-1/SBルール(略記)に絞った検索であり、
  他の未知の非MMAキーワードについては別途`headingText`ベースの4件確認に
  留まる(全ルール原文の再点検はスコープ外)。

## 修正について

本調査は現状確認のみで、コード修正・データ修正は一切行っていない。

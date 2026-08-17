# /kick モノニム誤統合+MMA混入+表示層混入 修正レポート

作成日: 2026-08(PR: `fix/kick-mononym-mma-contamination`、ブランチ
`fix/kick-mononym-mma-contamination`、PR #567)

**本PRはPR-G(#564)・項目4カバレッジPR(#566)とは別の新規PR。PR-G/#566が
「ゲート追加のみ・データ無変更」だったのに対し、本PRは**実際にデータを修正**する
(誤統合の分離・MMA戦の除外・表示バグの修正)。CLAUDE.mdの原則どおり、修正した各項目に
再発防止ゲートを1つずつ付けた。

## 全体サマリー

| 項目 | 内容 | 修正 | ゲート |
|---|---|---|---|
| 1 | 泰斗(taito)の誤統合 | KROSS×OVER側2boutを除外して分離 | `check-kick-identity-merge-risk.ts` |
| 2 | モノニム全体のリスク測定 | 分離作業は無し(調査のみ) | (item 1のゲートを流用、分離作業自体は次PRへ) |
| 3 | MMA混入(全DB) | 7bout(4選手+泰斗)を除外 | `check-kick-mma-contamination-gate.ts` |
| 4-1 | 大会名欄への散文混入 | DEEP☆KICK 10行の大会名を修正 | `check-kick-event-title-prose-gate.ts` |
| 4-2 | 対戦相手欄の所属連結(PR-9残り) | 56件中42件を追加分離 | `check-kick-opponent-gym-suffix-gate.ts` |
| 4-3 | 対戦相手欄への内部ラベル露出(3度目) | JSXにバッジ用スペース挿入(4箇所) | `check-kick-label-text-leak-gate.ts` |

---

## 項目1: 泰斗(taito)の誤統合

### 判断: **別人と確定、分離した**

K-1公式「泰斗」(LEOPARD GYM、1987.12.19生、活動2010-12〜2020-09、-65kg級キック
ボクシング)と、KROSS×OVER公式「泰斗」(krossover.jp本文で所属確認: **高本道場**、
活動2026-03〜2026-06、MMAルール)は、**所属(LEOPARD GYM vs 高本道場)・競技
(キックボクシング vs MMA)のいずれも一致せず**、表記名の一致だけで自動結合されていた。

原因: `scripts/standup-pipeline/ingest_krossover.py`の`resolve()`関数が、
`fighters.json`内で候補が1件しかない場合は所属の裏取りを一切せずその1件へ確定させる
実装だった。

対応: KROSS×OVER側の2bout(2026-03-01 vs 小材貴、2026-06-21 vs 岸本篤史)は、
一次資料で確認したところいずれもMMAルールの試合だったため、
`data/kick/manualRuleExclusions.json`へ`category:"mma"`として追加し除外した
(項目3のMMA混入対応と同一の仕組みで実施)。結果、泰斗(K-1)のページは
K-1/DEEP☆KICKの25bout(9勝15敗1分)のみになった。

詳細は `out/kick-taito-misidentification-audit.md` 参照。

---

## 項目2: モノニム全体のリスク測定(調査のみ、分離作業は次PR)

`scripts/check-kick-identity-merge-risk.ts`(新設、活動空白5年以上+団体変化+後続団体が
名前一致ベース結合、という代理指標)で全3,300選手を機械走査した結果、**52件**を検出
(ベースラインとして記録、ratchet)。

このうちモノニム的な表記名(単一トークン)42件を抽出し、`out/kick-mononym-risk-survey.md`
に一覧化した。分類内訳:

| 分類 | 件数 |
|---|---:|
| 統合可(参考) | 6 |
| 別人の疑い | 9 |
| 判定不能 | 27 |
| **合計** | **42** |

**この回では分離作業を行わない**(泰斗のみ項目1で個別対応)。「別人の疑い」9件を
優先候補として次PRへ申し送る。

---

## 項目3: MMA混入(全DB監査)

### 発見手法

`event`/`note`/`method_raw`フィールドに「MMA」「ケージ」を含む行を全15団体
(bouts_*.json)+Wikipedia経由から機械抽出し(64件の候補)、それぞれ一次資料
(krossover.jp・deep-kick.com等)で個別確認した。

### 確定した混入7bout(いずれも除外済み)

| slug | 日付 | 相手 | 出典 | 根拠 |
|---|---|---|---|---|
| taito | 2026-03-01 | 小材 貴 | KROSS×OVER | 「PRO-MMA -73kg FIGHT」と明記、所属は高本道場(項目1と同一事案) |
| taito | 2026-06-21 | 岸本 篤史 | KROSS×OVER | 「MMA PART メインイベント...PRO-MMA LIGHTWEIGHT」と明記 |
| sakamoto-juki | 2025-07-13 | 森本 直哉 | KROSS×OVER | 「KROSS×OVER MMA Sクラス -56.7kg FIGHT」と明記(同一カードの他試合はKICK PART) |
| morimoto-naoya | 2025-07-13 | 坂本 寿希 | KROSS×OVER | 同上 |
| kikuchi-minori | 2022-12-14 | 福田茉耶 | RISE/SB(重複掲載) | 大会名「GLEAT MMA Ver.0」に明記 |
| i-sufan | 2011-04-30 | XUE GUO BIN | Wikipedia経由 | 大会名「KF-1 MMA WORLD COMPETITION」に明記 |
| remigiusu-morikabyuchisu | 2008-11-08 | レオ・ボニンゲール | Wikipedia経由 | 大会名「MMA BUSHIDO HERO'S 2008」(HERO'SはMMA団体)に明記 |

**KROSS×OVERは判定が団体単位ではできない**(キック興行とMMA興行の混在カード)ことを
krossover.jp本文で確認済み(例: CAGE.6は第1〜12試合がMMA/グラップリング、第13〜18試合が
KICKという構成)。bout単位で個別に一次資料を確認して判定した。

### ゲート

`scripts/check-kick-mma-contamination-gate.ts`(ゼロ件ゲート)。event/noteフィールドの
MMA/ケージ語をSHOOT BOXING公式の正当な「※MMA」ルールセット注記(既にバッジ表示済み)と
KROSS×OVERの複合カード表記(「KICK PART・MMA PART」、既知の限界)を除いて機械検出する。

**★既知の限界**: KROSS×OVERのスクレイパーがカード単位の大会名しか保持しておらず
(個別試合の見出しを構造化データとして残していない)、「大会名にMMAを含むが当該bout自体は
KICK PART」というケースをevent/noteフィールドの機械判定だけでは区別できない
(坂本寿希×森本直哉戦はnote/eventのどちらにもMMAの語が無く、krossover.jp本文の
個別見出し確認でのみ発見できた)。根本対応(スクレイパーが試合単位の見出しを保持する
ようにする)は本PRのスコープ外(次PRへの申し送り)。

---

## 項目4: 表示層の混入3件

### 4-1. 大会名欄への注記散文の混入

`data/kick/bouts_deepkick.json`の10行で、大会名が「いつでもやってやる。でも今日の
試合内容では、次も俺の1ラウンドKO勝ち」(63kg王者山口裕人の試合後マイクでの発言)に
なっていた(出典: deep-kick.com/posts/4233860、正しい大会名は「DEEP☆KICK 27」)。
`scripts/standup-pipeline/ingest_deepkick.py`の`extract_event_name()`が記事冒頭8行以内の
最初の『...』を無条件で大会名として採用する実装で、今回はその括弧が偶然選手の発言を
囲んでいたため誤って抽出された。該当10行の`event`値を「DEEP☆KICK 27」に修正した。

**なお、同じ検査で見つかったNJKF「NJKF王者たちよ。俺か？おまえ達か？"真の主役"は
誰だ？！」は、njkf.info自身がこの扇情的なフレーズを大会ページの`<title>`としてそのまま
使っている正当な大会名と確認したため、修正していない**(ゲートのALLOWLISTに登録)。

ゲート: `scripts/check-kick-event-title-prose-gate.ts`(ゼロ件、句点「。」が末尾以外に
出現する大会名を候補にし、確認済みの正当な大会名はALLOWLISTで除外)。

### 4-2. 対戦相手欄への所属の連結(PR-9残り)

PR-9(`0bb7873`、#544)は「区切り文字が無く直接連結している行(47件)」を機械分離できず
対象外のまま残していた。再調査の結果、現在の該当件数は56件(ユニーク35表記)に増えており、
内訳は以下の2種類の追加パターンで説明できた:

1. 区切り文字自体はあるが`GYM_SUFFIX_BREAK_CHARS`に含まれていなかった異体字
   (半角中点"･"・中黒"·"・ビュレット"•")。5件。
2. 区切り文字が無いが、末尾が既知の固定ジム名(「センチャイジム」16件・
   「ヨックタイジム」3件・「K.T.ジム」「KTジム」2件)と完全一致するもの。21件。

`scripts/build-kick-data.ts`の`splitOpponentGymSuffix()`に上記2パターンを追加し、
56件中42件を新たに正しく分離した(表示のみの変更、`opponent_name`の生データは
変更していない)。残る14件(ユニーク8表記)は、未知のジム名・外国人選手のファースト
ネームに「ジム」が偶然含まれるもの(誤って別人の所属を捏造しないため意図的に非分割)・
PR-18で既に「文字化け・対応不要」と確定済みのものを含む。

ゲート: `scripts/check-kick-opponent-gym-suffix-gate.ts`(ratchet、現状14件)。

**★サンチャイ・TEPPENGYMの誤分割バグ(PR-G調査で発見済み)には触れていない**
(別PRのスコープ、ユーザー指示どおり)。今回の修正(区切り文字異体字追加・固定ジム名辞書)は
このケースの分岐条件(空白区切りでの複数語ジム名の曖昧性)には影響しないことを確認済み
(`test:kick-gym-suffix-split`で既存の固定テストが変化なく通過)。

### 4-3. 対戦相手欄への内部但し書きの露出(3度目)

`src/app/kick/fighters/[slug]/page.tsx`の`OpponentCell()`で、選手名の`<span>`と
「同姓同名のため未リンク」バッジの`<span>`が直接隣接しており、CSSに依存しない
テキスト抽出経路(スクリーンリーダー・自動テキスト監査等)では「一輝同姓同名のため
未リンク」のように連結して読まれる状態だった。同型の隣接(デビュー戦・延長・
タイトル種別バッジ・ルールバッジ)も同時に修正した(バッジ直前に`{" "}`を挿入)。

ゲートは単発の文言一致では大会名中の自然な語(例:「K-1ライト級タイトルマッチ」)を
誤検知するため、**サーバーレンダリングされた実HTML上でバッジの開始タグ直前に空白文字が
無い(閉じタグと直接隣接している)**という構造的なパターンのみを検査するよう設計した
(`scripts/check-kick-label-text-leak-gate.ts`、ゼロ件ゲート)。`next build`の生成物
(`.next/server/app/kick/`)を対象にするため、buildチェーンでは`next build`の**後**に
実行する(他のkick関連ゲートとは配置が異なる)。

---

## boutRows残余ゼロの確認

| 段階 | boutRows | 差分 |
|---|---:|---:|
| 本PR着手前(このworktreeでの最初のビルド) | 32,616 | — |
| 全修正後 | 32,609 | **-7** |

差分-7は、項目1・3で`manualRuleExclusions.json`に追加した**7件のMMA除外
(泰斗×2・坂本寿希×1・森本直哉×1・菊地美乃里×1・イ・スファン×1・
レミギウス・モリカビュチス×1)と完全に一致する**(`manualExclusionCount`も
183→190で+7、内訳: official由来5件[泰斗×2・坂本寿希・森本直哉・菊地美乃里] +
Wikipedia由来2件[イ・スファン・レミギウス・モリカビュチス]で、
`boutRowsOfficial`−5・`boutRowsWikipedia`−2の内訳とも整合)。

項目4(表示層3件の修正)はいずれも表示・分割ロジックのみの変更で、戦績データの行数
(`boutRows`)には一切影響していないことを確認した。`boutRowsRaw`(35,057、パース直後の
生行数)は本PR着手前後で不変であり、除外はすべて表示前フィルタ層(dedupe後の
manualRuleExclusions適用)で行われている。

**残余は完全にゼロで説明できる。**

---

## 副次的な影響(既存の他ゲートへの波及)

項目3のMMA除外により、一部の選手の掲載数(prod_total)が減少したため、PR-G/#566で
導入済みの2つのカバレッジratchetゲートの値が小幅に変化した(いずれも凍結済みの外部基準
スナップショットには影響しない、正当な変化):

| ゲート | 修正前 | 修正後 | 差分 |
|---|---:|---:|---:|
| `check-kick-coverage-gap.ts`(Wikipedia基準、差分あり人数) | 161人 | 162人 | +1(イ・スファンの掲載数減少による) |
| `check-kick-official-profile-coverage.ts`(公式プロフィール基準、欠落候補差合計) | 34,817 | 34,820 | +3(欠落候補**人数**は1,452人で不変) |

両ゲートのベースラインファイルをこの新しい正当な値に更新した。

---

## ゲート破壊テストの結果(全6ゲート)

- `check-kick-identity-merge-risk.ts`: taito.jsonに合成bout(2026年KROSS×OVER)を注入 →
  52→53件の増加を検知しビルド失敗(exit 1)を確認。復元でOK(52件)に復帰。
- `check-kick-mma-contamination-gate.ts`: i-sufan.jsonに合成MMA大会名を注入 →
  1件検知しビルド失敗を確認。復元でOK(0件)に復帰。
- `check-kick-event-title-prose-gate.ts`: taito.jsonのevent値を散文に書き換え →
  1件検知しビルド失敗を確認。復元でOKに復帰。
- `check-kick-opponent-gym-suffix-gate.ts`: taito.jsonのopponentNameを未知のジム名連結に
  書き換え → 14→15件の増加を検知しビルド失敗を確認。復元でOK(14件)に復帰。
- `check-kick-label-text-leak-gate.ts`: 実際のビルド済みHTML(aiko.html)からバッジ直前の
  空白を削除して隣接させる → 1件検知しビルド失敗を確認。復元でOKに復帰。
- `test:kick-gym-suffix-split`(既存テスト、項目4-2向けに更新): 異体字統一マップ等の
  既存ケースに加え、新規辞書ケース(センチャイジム等)を追加し全件成功を確認。

---

## npm run build の成否

`npm run build`(kick:data → 全check:kick-* → 全test:kick-* → next build →
check:kick-label-text-leak)をローカルでフルパス実行し、**全工程が成功することを
確認した**(`next build` は3,819ページを生成)。

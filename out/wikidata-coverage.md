# Wikidata 日本人選手カバー率測定(指示書 W-1)

生成日時(JST): 2026-07-26

種別: 読み取り専用の監査。`data/`・`src/` への差分はゼロ。`fighters.ts` への追加は行っていない。

## 結論(先頭に記載): 途中停止

指示書 §3 の停止条件「入力のmissing件数が凍結値と一致しない」に該当したため、
**W1-4(層2: missingとの突合)以降は実行していない。** 層2のカバー率(本命の数字)は測定できていない。
理由の詳細は「③ 入力に使ったブランチと凍結値との一致確認結果」を参照。

以下、指示書の項目順に報告する。

---

## ① W1-1で確定したプロパティID・職業Q番号

推測(P2593 / P4802)ではなく、WDQSに以下のクエリを実行して確定した(結果は `out/wdqs-cache/w1-1-property-ids.json`、`out/wdqs-cache/w1-1-occupation-q.json` にキャッシュ済み)。

```sparql
SELECT ?p ?pLabel WHERE {
  ?p wikibase:propertyType wikibase:ExternalId ;
     rdfs:label ?l . FILTER(LANG(?l) = "en")
  FILTER(CONTAINS(LCASE(?l), "sherdog") || CONTAINS(LCASE(?l), "tapology"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
```

**確定結果(指示書の推測値とは異なった)**:

| 用途 | 推測値(指示書記載・未確認) | WDQS確定値 |
|---|---|---|
| Sherdog選手識別子 | P2593 | **P2818** |
| Tapology選手識別子 | P4802 | **P9728** |

職業「総合格闘家」のQ番号も同様に確定: **Q11607585**(「総合格闘技レフェリー」Q52008305、「総合格闘技ジャッジ」Q52008306、「総合格闘技コーチ」Q57997670 とは別)。

以降のクエリはすべてこの確定値(P2818 / P9728 / Q11607585)を使用している。

---

## ② 層1の件数(ID保有ベース・職業ベース両方)

| 指標 | 全体 | うち日本国籍(P27=Q17) | うち日本語ラベルあり |
|---|---|---|---|
| Sherdog ID(P2818)保有 | 4,764 | 704 | 687 |
| Tapology ID(P9728)保有 | 2,364 | 122 | 113 |
| 職業=総合格闘家(Q11607585) かつ 日本国籍 | ― | 585 | 567 |

**「IDを持っている数」と「職業で数えた数」の差**: Sherdog IDを持つ日本国籍選手(704)と、職業=総合格闘家で数えた日本国籍選手(585)は一致しない。両者の和集合(日本国籍 かつ (総合格闘家 or SherdogIDあり or TapologyIDあり))でCSVを作ると **751件**(`out/wikidata-jp-fighters.csv`)になり、単純合計(704+122+585=1,411)より大幅に少ない。これは「SherdogIDはあるが職業タグが無い」「職業タグはあるがSherdogID未整備」という編集状況のばらつきを示している。個々の重複度合いの内訳(3集合のベン図)までは今回算出していない(層1は絶対数の把握が目的で、これ以上の分解は層2突合が本題のため省略した)。

層1CSV全件(alt_ja=skos:altLabel全件を含む)は `out/wikidata-jp-fighters.csv`(751行+ヘッダー)。

---

## ③ 入力に使ったブランチと凍結値との一致確認結果 — **不一致あり(停止条件に該当)**

入力元: PR #208(`mnews-mma/mnews`、ブランチ `feat/roster-loose-ends`、`gh pr view 208`で確認)の `out/` 配下。
`git show origin/feat/roster-loose-ends:out/<file>` で取得し、`out/pr208-input/` にコピーして一次情報として実カウントした(md要約は信用せず、CSVの行を直接カウント)。

### DEEP側: 一致(422)

`out/pr208-input/deep-event-participants-updated.csv`(795行、うちデータ行794)を `name_normalized` でユニーク化した結果:

| status | 件数 |
|---|---|
| listed | 64 |
| hidden | 4 |
| missing | **422** |
| 合計(ユニーク選手数) | 490 |

指示書記載の凍結値「DEEP missing 422名」と**一致**。

### パンクラス・修斗側: **不一致(101、凍結値100ではない)**

`out/pr208-input/roster-coverage-updated.csv`(190行、うちデータ行189)を org × status で実カウントした結果:

| org | listed | hidden | missing |
|---|---|---|---|
| pancrase | 16 | 25 | 35 |
| shooto | 19 | 19 | 60 |
| deep(champions王座枠。DEEPイベント名簿とは別集計) | 8 | 1 | 6 |
| **合計** | **43** | **45** | **101** |

指示書記載の凍結値は「パンクラス・修斗 missing 100名」だが、PR #208(`feat/roster-loose-ends`、②-c完了後)の実ファイルを一次情報として数えた結果は **101名**(org=pancrase/shootoのみに限定しても95名で、いずれにせよ100とは一致しない)。

これはPR #208自身の `out/loose-ends-report.md` 内でも「①(PR #197): missing 100 → ②-c後: missing **101**」と明記されている変化であり、指示書が事前に警告していた「既知の不一致」のケースそのものだった。

**指示書§3の停止条件に該当**: 「入力のmissing件数が凍結値と一致しない(422 / 100との不一致。上記の既知の101件疑惑を含む)」。
自分で数字を訂正して先に進むことはせず、ここで停止した。

---

## ④ 層2のカバー率

**未測定(停止のため)。**

---

## ⑤ ブランド別・出場回数別のカバー率

**未測定(停止のため)。**

---

## ⑥ match_confidence=noneの全件

**未測定(停止のため)。層2突合自体を実行していないため match_confidence を持つ行が存在しない。**

---

## ⑦ W1-6(逆方向候補)の件数と全件リスト

**未測定(停止のため)。**

W1-6は層2の`missing`側名寄せ(`findFighterSlugByName`によるmnews側名簿との突合)を前提にした逆方向抽出であり、層2自体を実行していないため未着手。

---

## 参考: 集めたデータ・スクリプトの所在

- `out/wikidata-jp-fighters.csv` — 層1全件(751行、alt_ja列を含む)
- `out/wdqs-cache/*.json` — WDQSクエリの生レスポンス全キャッシュ(2回実行して`out/wikidata-jp-fighters.csv`が同一になることを確認済み)
- `out/wdqs-cache/*.rq` — 層1CSV生成に使ったバッチクエリ本文(VALUES句で751 QIDを150件ずつ6バッチに分割)
- `out/pr208-input/*.csv` — PR #208 `out/` から取得した一次情報(無加工のコピー)
- `scripts/audit-wikidata-coverage.ts` — 上記キャッシュから層1件数・CSVを再生成する再実行可能スクリプト(W1-4以降は停止条件のためスタブ)
- `scripts/_wdqs_run.sh` / `scripts/_wdqs_run_file.sh` — WDQSへのクエリ発行に使った補助スクリプト(User-Agent明示・GET/POST)

## 推奨・優先度づけ

本レポートには含めない(指示書の指定通り)。停止条件に該当した事実と、そこまでに測定できた数字のみを報告する。

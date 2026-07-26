# 選手DB収録基準(指示書④ Phase2 成果物)

生成日: 2026-07-26
本文書は指示書④ Phase1(PR #220 `feat/inclusion-criteria-analysis`、追補含む)の判断材料をもとに人間が下した決定を成文化したものであり、指示書ではなく成果物(基準の正式文書)。基準そのものの再検討は行っていない。

## 1. メタルール(決定2)

団体横断の収録可否は、以下の単一のメタルールで判定する。**「団体ごとに別基準」ではなく、単一のメタルールとして成文化する**(団体ごとに個別の基準を作るのではなく、下記1文がすべての団体に共通して適用される)。

> その団体が公式に序列(ランキング)を出していれば、それに従う。出していなければ、出場記録で判定する。

このメタルールの適用結果として、団体ごとに実際に参照するデータソースが変わる(§3・§4)。基準が団体ごとに異なって見えるのは、メタルールの適用結果であって、団体ごとに別々の基準を設計したからではない。

## 2. DEEPに適用する基準C(プロ戦の記録がない選手を除外)

DEEPは公式ランキングを持たないため、メタルールの後段(出場記録で判定)を適用する。採用した基準は**候補C: プロ戦の記録がない選手(全出場がアマチュア戦のみの選手)を除外**。

### 「プロ戦」の判定方法(実装から読み取った定義)

判定器の実装(`scripts/apply-inclusion-criteria.ts`、Phase1の`scripts/analyze-inclusion-criteria.ts`の集計ロジックを移植)は、DEEP参加者データセット(`out/_input-deep-event-participants-updated.csv`、選手ごとに1試合1行)の`weight_class_raw`列を対象に、以下の正規表現で「アマチュア」の文字列を検出する。移植元はPhase1(PR #220)の`scripts/analyze-inclusion-criteria.ts:146`(`AMATEUR_RE`定義)。

```ts
const AMATEUR_RE = /アマチュア/;
```
(`scripts/apply-inclusion-criteria.ts:188`)

選手1名の全出場行のうち、`weight_class_raw`に「アマチュア」を含む行数(`amateurCount`)が、その選手の総出場行数(`rows.length`)と一致する場合にのみ「全出場がアマチュア(`isAllAmateur`)」と判定する。移植元はPhase1`scripts/analyze-inclusion-criteria.ts:195`(`isAllAmateur: datedAppearances > 0 ? amateurCount === rows.length : amateurCount === rows.length && rows.length > 0`)。全選手が1件以上の出場行を持つため`rows.length > 0`は常に真であり、両分岐は機能的に同一のため、Phase2では単純化して移植した(判定内容に変更なし)。

```ts
isAllAmateur: amateurCount === rows.length
```
(`scripts/apply-inclusion-criteria.ts:224`)

判定関数はこの`isAllAmateur`をそのまま使う二値判定である。候補C自体の定義はPhase1`scripts/analyze-inclusion-criteria.ts:250`(`{ id: "C", label: "プロ戦基準: アマチュア戦のみの選手を除外", test: (f) => !f.isAllAmateur }`)。

```ts
function decideCriterionC(f: FighterAgg): Decision {
  if (f.isAllAmateur) {
    return { adopted: false, reasonCode: "C_ALL_AMATEUR" };
  }
  return { adopted: true, reasonCode: "C_HAS_PRO_APPEARANCE" };
}
```
(`scripts/apply-inclusion-criteria.ts:236-241`)

**重要な限界(推測ではなく実装の性質として明記する)**: 本判定は「プロ」を示す明示的な表記を検出しているのではなく、「アマチュア」表記の**不在**をもってプロ戦とみなす、消去法の判定である。Phase1の分析(`out/inclusion-criteria-analysis.md` §7)でも「エキシビション試合を示す明示的な表記は`weight_class_raw`から検出できなかった(判定不能)」と記録されている。したがって、エキシビション等アマチュアともプロとも表記されない出場があった場合、本判定はそれを「プロ」側に分類する(アマチュア表記がないため)。この限界は残ったままである。

### 適用結果

DEEP参加者490名全件に適用した結果(`out/inclusion-decision.csv`):

| 区分 | 件数 |
|---|---|
| 採用 | 371 |
| 非採用 | 119 |
| 計 | 490 |
| 新規採用(missing422名中) | 303 |
| 既存除外(listed64名中) | 0 |

非採用119名は理由コード`C_ALL_AMATEUR`付きで`out/inclusion-decision.csv`に全件列挙している(件数を削っていない)。採用371名は`C_HAS_PRO_APPEARANCE`。

## 3. パンクラス・修斗の扱い(公式ランキング掲載をもって採用)

パンクラス・修斗はメタルールの前段(公式ランキングに従う)を適用する。両団体とも公式サイトにランキングページを持つため、**そのランキングページに掲載されている選手 = 採用**として扱う。

これは指示書①(PR #197 `feat/roster-coverage-audit`)・②-c(PR #208 `feat/roster-loose-ends`)で作られた「必達セット189件」の作り方そのものと一致する。`out/_input-roster-coverage-updated.csv`(PR #208由来)は、パンクラス公式ランキング(https://www.pancrase.co.jp/rls/ranking.html)・修斗公式ランキングを直接スクレイプして作られたデータセットであり、この189件は「ランキングに掲載されているか」という一点で抽出された母集団である(org内訳: pancrase 76件・shooto 98件・deep 15件〈王座、§4参照〉)。

このデータセットの性質上、「ランキング外の選手」はそもそもデータセットに含まれない(ランキングページ自体に載っていない選手の情報は収集していない)。したがって、パンクラス・修斗については「出場記録に基づく採否判定」という概念自体が本データでは適用できない(判定材料が公式ランキング掲載の有無以外に存在しない)。指示書④Phase2ではパンクラス・修斗への出場ベース基準(基準C相当)の適用は行っていない(決定2により不要、§6参照)。

## 4. 王者の扱い(champions.tsは基準にかかわらず採用)

`src/lib/champions.ts`(`DEEP_CHAMPIONS`および`DEEP_RANKING_CLASSES`)に掲載されている現王者は、基準C(プロ/アマ判定)にかかわらず採用する。これは指示書①の必達セット設計(PR #197/#208)の追認であり、Phase2で新たに決めた事項ではない。

`out/_input-roster-coverage-updated.csv`のorg=deep行(15件、`rank`列は全件`C`〈王者を意味する〉、`source_url`は`https://www.deep2001.com/champ/`)がこれに対応する。内訳は男子7階級(ヘビー級・ウェルター級・ライト級・フェザー級・バンタム級・フライ級・ストロー級)+女子8階級(女子アトム級・女子ストロー級・女子フライ級・女子バンタム級・女子フェザー級・女子無差別級・女子ミクロ級・DEEP JEWELS 女子ミクロ級)で15件。このうちlisted8/hidden1/missing6であり、missing6が必達セット189件の内訳表にある「deep-champion 6」に対応する。

## 5. 非機械可読団体は対象外(限界の明記)

GLADIATOR・ZST・地方大会主催団体等、公式ランキングも大会結果一覧も機械可読な形で取得できない団体は、メタルールのどちらの経路(ランキング/出場記録)も適用できない。**判定材料そのものが存在しないため、これらの団体の選手は現時点で本基準の対象外**である。「対象外」は「除外する」という決定ではなく、「判定できない」という限界の表明である。将来これらの団体のランキングまたは結果データが機械可読な形で入手可能になった場合は、メタルールに従ってどちらの経路を適用するか再検討することになる(本文書では再検討していない)。

## 6. 棄却した候補と理由

決定1(基準Cを採用)にあたり、以下の候補は棄却された。棄却理由も含めて記録する(数字ごと)。

| 候補 | 内容 | 既存除外 | 対listed64名 | 棄却理由 |
|---|---|---|---|---|
| B1 | 収集期間内2回以上出場 | 30 | 47% | 閾値13名を大幅超過。基準側の誤り |
| B2 | 収集期間内3回以上出場 | 49 | 77% | 同上 |
| D | タイトル戦出場歴のある選手 | 57 | 89% | 同上。現行DBのほぼ全否定になる |
| E | 複合(AまたはD) | 7 | 11% | Aに対し採用が1名増えるだけ(172→173)。複合化の利がない |
| A | 本戦(DEEP IMPACT/JEWELS)出場者のみ | 7 | 11% | §7の定義不整合が未解消。解消せずには採らない |
| F | 基準なし(全件採用) | 0 | 0% | 「アマチュア戦のみの選手119名」の線引きは残す |

採用した基準Cは既存除外0(0%)。既存除外0=現行の編集判断と一度も衝突しない候補はCとFのみであり、そのうち線引きとして原理的に説明できるCを採った。

## 7. 記録のみ・修正しない事項(基準AとW-1のブランド定義の不整合)

Phase1の基準A(採用172)と、W-1(PR #221)のブランド別集計(missing422のうち本戦IMPACT/JEWELS400名・育成FIGHT CHALLENGE等22名)は、同じ「本戦」という語で異なる集合を指している。Aは`DEEP IMPACT`/`DEEP JEWELS`の完全一致のみを本戦とし、地方IMPACT(TOKYO/OSAKA/NAGOYA/HAMAMATSU)を落としている疑いがある。

根拠: Aで非採用になるlisted選手5名(中島太一/安井飛馬/飴山聖也/海飛/山崎弥十朗)が全員DEEP TOKYO/OSAKA IMPACT出場者である。

Aは不採用のため実害はない。**ブランド名の完全一致で本戦を判定してはならない。** 今後ブランド列を条件に使う場面でこの1行を参照すること。Aの再実装・再集計・原因調査は本文書・Phase2のいずれでも行っていない。

## 8. 採否(軸1)と公開タイミング(軸3)は別軸。軸2(存続基準)は未決

選手DBの扱いには複数の独立した軸がある。混同しないこと。

- **軸1(採否)**: 本文書が扱う基準。「そもそも選手DBの収録対象にするか」の判定。
- **軸3(公開タイミング/hidden)**: `fighters.ts`の`hidden`フラグの意味は指示書①-b(PR #198)で決着済み。「新規投入バッチの公開審査待ち」を意味するフラグであり、採否(軸1)とは独立した別軸である。軸1で「採用」と判定された選手が、実際に`fighters.ts`へ追加される際に`hidden: true`か`false`かは、軸3の運用(公開審査)側の話であり、本文書は関与しない。
- **軸2(存続基準)**: 「一度採用した選手を、その後どの条件で選手DBに残し続けるか(例: 一定期間出場がない選手をどう扱うか)」の基準。**本文書では未決**。Phase1(§6)でも「listedのうち直近12ヶ月に出場記録がない選手」の判定は元データの収集範囲外により判定不能と記録されており、Phase2でもこの軸には着手していない(指示書④Phase2 §6でスコープ外と明記)。

## 9. データソース・入力値の追跡

- DEEP参加者データ: `out/_input-deep-event-participants-updated.csv`(PR #208 `feat/roster-loose-ends`の`out/deep-event-participants-updated.csv`を`git show`でread-only複製)。794行、ユニーク選手490名(listed64/hidden4/missing422)。
- パンクラス・修斗・DEEP王者ランキング: `out/_input-roster-coverage-updated.csv`(同PR #208の`out/roster-coverage-updated.csv`を複製)。189行(listed43/hidden45/missing101、missing内訳pancrase35/shooto60/deep-champion6)。
- 判定器: `scripts/apply-inclusion-criteria.ts`。
- 適用結果: `out/inclusion-decision.csv`(490行、決定+理由コード付き)。

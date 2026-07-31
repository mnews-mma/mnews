# パトリッキー・ピットブル RIZIN欠落調査(指示書O)

## 1. RIZIN.19 / RIZIN.20 の収録状況

両イベントとも `data/rizinRecords.json` に存在する(パース漏れ・収録範囲外ではない)。

- RIZIN.19 (2019-10-12): 13 bouts収録
- RIZIN.20 (2019-12-31): 15 bouts収録

対象3boutは全て bout配列内に存在していた(bout自体の抽出漏れではない)。ただし
`fighterASlug`/`fighterBSlug` はいずれも `null`。

| イベント | cardPosition | 生表記(fighterAName/fighterBName) | slug |
|---|---|---|---|
| RIZIN.19 2019-10-12 | 8 | fighterA: `パトリッキー・"ピットブル"・フレイレ` / fighterB: `川尻達也` | fighterASlug=null, fighterBSlug=null |
| RIZIN.20 2019-12-31 | 10 | fighterA: `トフィック・ムサエフ` / fighterB: `パトリッキー・"ピットブル"・フレイレ` | fighterASlug=null, fighterBSlug=null |
| RIZIN.20 2019-12-31 | 2 | fighterA: `ルイス・グスタボ` / fighterB: `パトリッキー・"ピットブル"・フレイレ` | fighterBSlug=null(fighterAは`gustavo-luis`で解決済み) |

(注: 実際の生データは全角引用符 `“ ”` を使用。ここでは表記の都合上 `"` `"` に置換して記載。)

## 2. 原因の分類: 名前解決失敗(表記ゆれ)

`src/lib/fighters.ts` 内のpatricky-pitbullの定義:

```
{ slug: "patricky-pitbull", nameJa: "パトリッキー・ピットブル", nameEn: "Patricky Pitbull", ... }
```
(aliasesフィールドなし)

一方、対象3boutの生表記は `パトリッキー・"ピットブル"・フレイレ`(姓フレイレ付き・ニックネームを引用符で囲む表記)。

`scripts/lib/fighterNameBackfill.ts` の `normalize()` は引用符・中黒(`・`)は除去するが、
文字列自体の差分(「フレイレ」の有無)は吸収しない。正規化後の比較:

- fighters.ts側: `パトリッキーピットブル`
- 対象3bout側: `パトリッキーピットブルフレイレ`

「フレイレ」4文字分の差があり完全一致しない。近似照合(`findNearMisses`、編集距離1〜2のみ拾う)の
閾値も超えるため(距離4)、近似候補としても検出されない。

同一リポジトリに実在する `scripts/backfill-rizin-slugs.ts`(2026-07-31に新規実装・2回実行済み、
コミット `7fef0fb` `28eed4f`)は、まさにこの種のnull slug再解決を行うスクリプトだが、その出力
`out/rizin-slug-backfill.md` の「依然未解決の生表記一覧」に

```
- パトリッキー・"ピットブル"・フレイレ (3件)
```

として掲載されている(=3件=今回の対象3boutと一致)。つまりこのバックフィルは既に実行済みだが、
上記の理由でパトリッキー・ピットブルは解決できていない。

結論: **名前解決失敗**。「パトリッキー・"ピットブル"・フレイレ」という2019年時点特有の生表記
(フレイレ姓付き)に対応するaliasがfighters.tsに存在しないため。2022年以降のRIZIN.40等では
生表記が `パトリッキー・ピットブル`(フレイレ姓なし)に変わっており、これは正しく解決されている
(下記参照)。

## 3. 同一原因の他選手への影響

`data/rizinRecords.json` 全体でパトリッキー・ピットブル関連の生表記を横断確認した結果:

| イベント | 生表記 | 解決状況 |
|---|---|---|
| RIZIN.19 2019-10-12 | `パトリッキー・"ピットブル"・フレイレ` | 未解決(null) |
| RIZIN.20 2019-12-31 ×2 | `パトリッキー・"ピットブル"・フレイレ` | 未解決(null) |
| RIZIN.40 2022-12-31 | `パトリシオ・ピットブル` | 未解決(null、別表記。本人か別人か本調査では未判定) |
| 超RIZIN.2 2023-07-30 | `パトリシオ・ピットブル` | 未解決(null、同上) |
| 超RIZIN.2 2023-07-30 | `パトリッキー・ピットブル` | **解決済み**(patricky-pitbull) |
| 超RIZIN.4 2025-07-27 | `パトリッキー・ピットブル` | 解決済み(patricky-pitbull) |
| RIZIN LANDMARK 13 2026-04-12 | `パトリッキー・ピットブル` | 解決済み(patricky-pitbull) |

→ 「パトリッキー・"ピットブル"・フレイレ」表記による未解決は3件のみ(=今回の対象3boutと一致、
他に追加で見つかった同一表記のboutはない)。よってこの特定の表記ゆれによる被害選手はパトリッキー・
ピットブル1名・3boutに限定される。

なお「パトリシオ・ピットブル」表記(RIZIN.40, 超RIZIN.2)は本調査のスコープ外(ブラジル人選手の
兄弟にPatrício "Pitbull" Freireが実在するため、表記ゆれか別人かは未判定・「不明」)。

### イベント全体のnull slug状況(参考、事故の切り分け用)

RIZIN.19/RIZIN.20は他の多くのboutでもfighterA/BSlugがnullだが(RIZIN.19: 13bout中nullA7件/
nullB12件、RIZIN.20: 15bout中nullA10件/nullB13件)、抜き取り確認した限り原因は別。例えば
RIZIN.19の川尻達也は `src/lib/fighters.ts` に該当エントリ自体が存在しない(`grep -n "川尻達也"`で
0件)。これは「fighters.tsに未収録の選手」であり名前解決の失敗ではなく、そもそもDB対象外
(想定通りの挙動)。したがって「このイベント自体が名前解決に失敗しやすい構造」ではなく、
パトリッキー・ピットブル個別の表記ゆれ問題と、それとは別に多数存在する「単純にfighters.ts未収録の
選手」が混在しているだけと判定できる。

### 指示書J(差分上位20名・RIZIN分9件)との関係

`out/wiki_vs_multiorg_diff.json` / `out/J_event_unexplained.json` は本worktreeに存在せず
(gitignore対象・前回セッションの一時生成物のため未取得)、再生成もスコープ外につき参照できなかった。
今回特定できたのはパトリッキー・ピットブルの3boutのみ。J調査で言う「RIZIN分9件」との対応関係
(全9件のうち3件がこれに該当するのか、別事象なのか)は本調査の範囲では確認不可(不明)。

## まとめ

1. RIZIN.19/RIZIN.20は`data/rizinRecords.json`に存在し、対象3boutも抽出済み(パース漏れではない)。
2. 原因は**名前解決失敗**。生表記「パトリッキー・"ピットブル"・フレイレ」がfighters.tsの
   nameJa「パトリッキー・ピットブル」と完全一致せず(フレイレ姓の有無)、近似照合の距離閾値(2)も
   超えるため自動解決されない。既存の`backfill-rizin-slugs.ts`(2026-07-31実行済み)でも未解決
   のまま`out/rizin-slug-backfill.md`に記録されている。
3. 同一表記ゆれの影響はパトリッキー・ピットブル1名・3boutのみ(他に該当bout無し)。RIZIN.19/20の
   他の多数のnull slugは別原因(fighters.ts未収録選手)であり、イベント構造自体の欠陥ではない。
4. 修正には、fighters.tsのpatricky-pitbullエントリに`aliases: ["パトリッキー・\"ピットブル\"・フレイレ"]`
   等を追加した上でbackfill-rizin-slugsを再実行する対応が考えられるが、本タスクはread-only調査の
   ためsrc/・dataの変更は行っていない。

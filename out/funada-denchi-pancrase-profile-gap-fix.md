# 船田電池(funada-denchi) パンクラス戦績3件未反映の修正

生成日時: 2026-08-03(JST)。

## 発端

`/fighters/funada-denchi`は4戦3-1-0だったが、公式プロフィール
(`prfl2/funadakanji.html`)は7戦6勝1敗。太字3件が未反映だった。

## 着手前の対象人数調査

粕谷優介(#418)で「修斗org 101名限定」という母集団前提に構造的な抜けが
あったため、着手前にパンクラス側の数え方を確認した(詳細はPR #420参照)。

| 数え方 | 人数 |
|---|---|
| `org: "pancrase"`限定 | 79名 |
| 全365名を公式名簿1,683件(指示書H既存成果物)と名前一致 | 131名 |
| └ うち`org!=="pancrase"`(粕谷型候補) | 54名 |

結論: 131名(または裏取り後の実数)が正しい母集団。ただし今回のスコープは
**船田電池1名の修正まで**。131名・54名(パンクラス)/261名(修斗、#418で判明)の
クロスorg監査は別日にまとめて指示書を出す方針のため、本PRでは着手しない。

## 原因(1種類、3件とも同一)

`data/pancraseRecords.json`には該当3boutが**既に正しく記録されている**
(大会レベル・bout単位のいずれの収録漏れでもない)。問題は名前解決のみ:

- パンクラス公式戦績表は船田電池の**本名**「船田侃志」(プロフィールURL stem
  `funadakanji.html`)で記録されている。
- `fighters.ts`の`nameJa`は**リングネーム**「船田電池」。
- `scripts/build-pancrase-records.ts`が使う`findFighterSlugByName()`は
  文字列完全一致(nameJa→aliasesの2パス)のため、「船田侃志」は
  どちらの選手にも一致せず`fighterSlug`がnullのまま残っていた。

対象3件(いずれも`leftUrl`/`rightUrl`が`funadakanji.html`であることを実測確認、
同名衝突なし):

| 日付 | 大会 | 対戦 | 結果 |
|---|---|---|---|
| 2024-02-25 | PANCRASE BLOOD.2 | 船田侃志 vs 日向優希 | 船田侃志 TKO勝ち |
| 2024-05-25 | PANCRASE 343(第30回ネオブラッドトーナメント決勝) | 織部修也 vs 船田侃志 | 船田侃志 判定勝ち |
| 2024-09-29 | PANCRASE 347 | 野田遼介 vs 船田侃志 | 船田侃志 判定勝ち |

## 対応

1. `src/lib/fighters.ts`のfunada-denchiに`aliases: ["船田侃志"]`を追加。
   将来`data/pancraseRecords.json`が再生成された際、この3件が自動解決されるようにする。
2. `scripts/backfill-funada-denchi-pancrase-slugs.ts`を新設し、既存の
   `data/pancraseRecords.json`側3件を直接パッチ(`fighterASlug`/`fighterBSlug`/
   `winnerSlug`を`funada-denchi`に設定)。全418大会の再スクレイピングは行っていない。
   対戦相手側(野田遼介/織部修也/日向優希)のslugはスコープ外のため変更していない。
   パッチ件数が期待値3件と一致しない場合はエラー終了する安全策あり。

## 検証結果

- `computeFighterPancraseRecord()`: 投入前 3-1-0(4戦) → 投入後 **6-1-0(7戦)**。公式プロフィールの「6勝1敗7戦」と完全一致。
- **波及確認**: `FIGHTERS`全365名で前後差分を突合。**変化したのはfunada-denchi 1名のみ**。
- **null-slugゲート**(`scripts/check-null-slug-baseline.ts`): パンクラス比率87.9%→87.16%(閾値90.00%以下、悪化なし。3bout-side解決で分子のみ減少)。RIZIN/修斗/DEEPも閾値以下。
- **`data/rankings.json`**: 無変更(バイト比較で完全一致)。`scripts/update-mnews-rating.ts`は`pancraseRecords`をimportしていない。
- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: 成功

## 出力ファイル

- [scripts/backfill-funada-denchi-pancrase-slugs.ts](../scripts/backfill-funada-denchi-pancrase-slugs.ts)
- `data/pancraseRecords.json`(3件パッチ)
- `src/lib/fighters.ts`(alias追加)

# C-2a: VSページのindex条件に実カード判定を追加

## 実装内容

[src/lib/vsPairing.ts](../src/lib/vsPairing.ts) `isVsPairIndexable()`に4つ目のOR条件を追加した。

```ts
if (findMatchupEvent(fighterA.nameJa, fighterB.nameJa)) return true;
```

- **既存3条件(同一団体同一階級・過去対戦・共通対戦相手)は削っていない。追加のみ。**
- `findMatchupEvent`は既に同ファイルでimport済み(`buildVsShareText`が使用)。新規importは無い。
- `fighterA`/`fighterB`は既に`nameJa`を持つ型(`Pick<Fighter, "org" | "weightClass" | "nameJa">`)のため、関数シグネチャ自体の変更は不要だった。呼び出し側([src/app/vs/[slugA]/[slugB]/page.tsx](../src/app/vs/[slugA]/[slugB]/page.tsx)・[src/app/sitemap.ts](../src/app/sitemap.ts))は無変更。
- 日付処理・新規importなし。`npx tsx scripts/check-jst-date-bypass.ts`は新規違反0件(既知の99件のみ)。`npx tsc --noEmit`はエラーなし。

## A/B/C 3集合の件数(実データ)

`getVisibleFighters()`(sitemap.tsと同じ可視選手母集団、170名)の全ペア総当たり(170×169/2 = 14,365ペア)に対し、変更前ロジック(既存3条件)と`findMatchupEvent`ヒットの有無で分類した。

| 集合 | 定義 | 件数 |
|---|---|---|
| A | 実カード判定のみでヒット(既存3条件では拾えていなかった) | **3件** |
| B | 既存3条件のみでヒット(実カードではない) | **2,465件** |
| C | 両方でヒット | **18件** |
| 旧合計(index対象URL数、変更前) | B+C | 2,483件 |
| 新合計(実カード追加後) | A+B+C | 2,486件 |

**B(既存3条件を削った場合に失う面)の規模は2,465件。** A(3件)・C(18件)と比べて2桁以上大きい。既存3条件を削るかどうかは本書の対象外(§9で人間判断)だが、削減時の影響規模としてこの数字を記録する。

## 代表例

**A(実カードのみ、既存3条件では拾えていなかった。全3件を記載)**:
- `/vs/asakura-mikuru/shinya-aoki`(朝倉未来 vs 青木真也、超RIZIN.5)
- `/vs/ameyama-seiya/kubota-taito`(飴山聖也 vs 窪田泰斗、DEEP TOKYO IMPACT 2026 4th ROUND)
- `/vs/arai-jo/kitakata-daichi`(新井丈 vs 北方大地、DEEP 133 IMPACT)

**B(既存3条件のみ、代表10件)**:
`/vs/horiguchi-kyoji/taira-tatsuro`, `/vs/taira-tatsuro/tsuruya-rei`, `/vs/koike-kleber/taira-tatsuro`, `/vs/inoue-naoki/taira-tatsuro`, `/vs/hiroya/taira-tatsuro`, `/vs/shinryu-makoto/taira-tatsuro`, `/vs/ougikubo-hiromasa/taira-tatsuro`, `/vs/motoya-yuki/taira-tatsuro`, `/vs/ashizawa-ryusei/taira-tatsuro`, `/vs/fukuda-ryuya/taira-tatsuro`

**C(両方、代表10件)**:
`/vs/hiramoto-ren/karshyga-dautbek`, `/vs/akimoto-kyoma/koike-kleber`, `/vs/kuzyutina-natasha/rena`, `/vs/saito-yutaka/ya-man`, `/vs/majima-kazumasa/takeda-koji`, `/vs/hiramoto-jo/jolly`, `/vs/karamov-vugar/takagi-ryo`, `/vs/kate-lotus/noel`, `/vs/patchy-mix/sato-shoko`, `/vs/goto-joji/temirov-azizbek`

## canonicalの確認(C-2a-3、報告のみ・修正しない)

[src/lib/seo.ts](../src/lib/seo.ts) `pageMetadata()`と[src/app/vs/[slugA]/[slugB]/page.tsx](../src/app/vs/[slugA]/[slugB]/page.tsx)を再確認した。

- canonical: `path: /vs/${norm.a}/${norm.b}`(page.tsx、正規化後=辞書順のスラッグ)を常に使用。`?red=`等のクエリは含めない(page.tsx内のコメントで明記)。
- `{a}/{b}`(正規順)と`{b}/{a}`(非正規順): 非正規順でアクセスされた場合、page.tsx 117-122行目で`permanentRedirect()`(308)により正規順URLへ転送。転送先のcanonicalも同じ正規順を指す。
- **今回のコード再確認で、canonicalとリダイレクトの不整合は見つからなかった。** 両者は同じ`normalizeVsSlugs()`(1関数)を単一ソースとして使っており、二重実装によるズレの余地が無い設計になっている。
- 今回の実カード判定追加はcanonical生成ロジックに一切触れていない(`isVsPairIndexable`の戻り値はrobots判定にのみ使われ、canonical生成は別の独立したコードパス)。

## 見送った項目

- 既存3条件の削減: **実施しない(§9で人間判断)**。B集合(2,465件)の規模を出すことが本項の目的。
- canonicalの修正: **不整合が見つからなかったため対象なし**。

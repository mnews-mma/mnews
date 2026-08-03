# パンクラスゲート系262bout除外 実測レポート(指示書④)

対象: `src/lib/mnewsRating/nonProBoutFilter.ts` に `not_pro_pancrase_gate` カテゴリを追加し、
`data/pancraseRecords.json` からパンクラスゲート系boutを除外する。

2026-07-30の調査(`out/amateur-contamination-audit.md` 7章)では「除外しない」と結論していたが、
2026-08-03の `/fighters/sato-shoko` 戦績調査(`out/sato-shoko-record-mismatch-report.md`)で
ja.wikipediaがパンクラスゲート表記の試合を独立した「アマチュア総合格闘技」節(プロ集計対象外)に
分類している実例が見つかったため、ユーザー判断でこの結論を上書きし除外に倒した。

実行コマンド:
```
npx tsx out/investigate-pancrase-gate-affected.ts   # 実測(data/は変更しない)
npx tsx scripts/apply-pancrase-gate-exclusion.ts    # 適用(data/pancraseRecords.jsonのみ書き換え)
```

---

## 1. 表記ゆれ内訳(実測262件、2026-07-30実測と一致)

指示書④の記載は「表記ゆれ3種(パンクラスゲート／パンクラス・ゲート／PANCRASEゲート)」だったが、
この3種だけでは261件にしかならず、2026-07-30実測の262件と1件差が出た。原因を辿ると、
`out/amateur-contamination-audit.md` 7-1節の原表記は実際には**4種**(パンクラスゲート／
パンクラス ゲート(半角/全角スペース)／パンクラス・ゲート／PANCRASEゲート)であり、指示書④の
要約時にスペース区切り表記が脱落していた。原調査(4種)を正として採用する。

| 表記 | 件数 |
|---|---|
| パンクラスゲート | 256 |
| パンクラス・ゲート(中黒) | 3 |
| パンクラス ゲート(半角/全角スペース) | 1 |
| PANCRASEゲート | 2 |
| **合計** | **262** |

年代分布: 2002年〜2021年(2026-07-30実測と同じレンジ)。0boutになる大会は無し。

## 2. NEO BLOOD!同居の例外(#269 Bayside FIGHT.3と同型)

262件中1件、パンクラスゲート表記と「ネオブラッド・トーナメント」表記が同一bout内に同居する例が
見つかった:

> PANCRASE 2005 SPIRAL TOUR(2005-05-01)「パンクラスゲート」ウェルター級戦 5分2ラウンド
> 『ネオブラッド・トーナメント〜ウェルター級〜』出場選手選考試合最終戦

`nonProBoutFilter.ts` の `isNeoBloodBout()` ガードはカテゴリ判定より先に走る汎用ガードであり、
CAGE GATE専用ではなく全カテゴリに効くため、**コード変更なしでこの1件は自動的に除外対象から
外れる**(#269のBayside FIGHT.3と同じ扱い)。コメントをカテゴリ非依存の記述に更新した。

**実際に除外されるbout数: 262 − 1(NEO BLOODガード) = 261件**

## 3. 0boutになる大会・0-0-0になる選手

- 0boutになる大会: **0件**
- 0-0-0になる選手: **0名**(影響選手7名は全員、除外後も4団体通算で正の試合数が残る。詳細は5節)

停止条件3件のうち、1件(NEO BLOOD同居)は該当したが#269と同型の既存ガードで解消済み。
残り2件(0-0-0選手・0boutイベント)は非該当。よって実装を継続した。

## 4. 影響選手(slug解決済み、全7名)

261bout中、`fighterASlug`/`fighterBSlug`が解決しているのは以下7名のみ(残りは無名選手同士の
undercardで対戦相手側が未収録)。

| slug | パンクラス単独(前→後) | 4団体通算(前→後) | needsReview | recordFromResults | 1行目(fighterRecords.json) |
|---|---|---|---|---|---|
| `fujii-nobuki` | 13-8-3→13-8-2 | 21-16-3→21-16-2 | **true** | false | 8-8-0(修斗のみ、パンクラス側は投入済み数値に影響なし) |
| `goto-joji` | 9-3-1→8-3-0 | 18-8-1→17-8-0 | false | false | 19-9-0 |
| `isao` | 23-4-4→23-4-2 | 25-6-4→25-6-2 | false | false | 27-9-2 |
| `nada` | 10-9-2→9-9-1 | 11-9-2→10-9-1 | **true** | false | 10-9-2 |
| `sato-shoko` | 11-9-2→9-8-1 | 26-12-3→**24-11-2** | false | false | 38-17-2 |
| `tokoro-hideo` | 0-0-1→0-0-0 | 6-7-1→6-7-0 | false | false | 36-34-1 |
| `ushiku-juntaro` | 14-7-1→12-5-1 | 24-14-1→22-12-1 | false | **true** | 22-12-0 |

0-0-0化した選手: **なし**。

## 5. sato-shoko詳細(受入条件の想定値と食い違う点の説明)

指示書④の受入条件は「2行目が26-12-3→26-12-2になり、1行目のdraws=2と一致することを確認」だった。
これは`out/sato-shoko-record-mismatch-report.md`が発見した1件(2007-05-06の引き分け)だけを根拠に
した想定だったが、実際にはsato-shokoのパンクラスゲート表記boutは**4件**あった:

| 日付 | 大会 | 相手 | 結果 |
|---|---|---|---|
| 2008-10-01 | PANCRASE 2008 SHINING TOUR | 上田優 | 敗(TKO) |
| 2007-11-28 | PANCRASE 2007 RISING TOUR(プロ昇格T準決勝) | 佐々木亮太 | 勝(判定) |
| 2007-10-14 | PANCRASE 2007 RISING TOUR(プロ昇格T1回戦) | 江泉卓哉 | 勝(判定) |
| 2007-05-06 | PANCRASE 2007 RISING TOUR(ネオブラッドT準決勝) | 佐々木亮太 | 引分 |

実測値は **26-12-3 → 24-11-2**(想定と異なり勝敗数も変わる)。ja.wikipedia「佐藤将光」の生
Wikitextを直接取得して確認したところ、**この4件全てが「アマチュア総合格闘技」節に分類されており、
「プロ総合格闘技」節(infobox集計対象)には一切含まれていなかった**。したがって1行目
(Wikipedia infobox、38-17-2)は今回の変更で無変化(元々これらのbout自体をプロ集計に含んでいない
ため)。2行目のみ変化し、Wikipediaの区分と完全に整合する形になった。

想定と実際の数値が異なる理由は「元の受入条件が1件しか把握していなかった」ためであり、実装や
判定ロジックの誤りではない。むしろ4件全てでWikipediaの節分類と一致したことは、除外判断の
妥当性をより強く裏付ける結果になった。

## 6. 副次的な検証: tokoro-hideo(所英男)でも同じ整合を確認

`tokoro-hideo`は唯一のパンクラス戦(2002-02-17 パンクラスゲート、△志田幹)がパンクラス単独の
全戦績であり、除外により4団体通算draws=1→0になる。ja.wikipedia「所英男」の生Wikitextを直接
取得したところ、この1件も「アマチュア総合格闘技」節に分類されていた(プロ側infoboxのdraws=1は
2005年のホイス・グレイシー戦を指しており、別の試合)。sato-shokoに続き2件目の独立した
Wikipedia整合確認になった。

## 7. draws超過24名との照合

`out/sato-shoko-record-mismatch-report.md` が特定した「2行目draws > 1行目draws」24名のうち、
今回の除外で解消したのは **3名**:

- `goto-joji`: 1→0(1行目draws=0と一致)
- `isao`: 4→2(1行目draws=2と一致)
- `sato-shoko`: 3→2(1行目draws=2と一致)

残り21名は今回のパンクラスゲート除外の対象bout(fujii-nobuki・nada・tokoro-hideo・
ushiku-juntaroの4名分)を含まないか、含んでいても1行目と一致するところまでは解消しないため
超過が継続する(別原因の可能性。本調査のスコープ外)。

## 8. needsReview / fighters.ts直書き反映の確認

影響選手7名中、`needsReview: true` は2名(`fujii-nobuki`・`nada`)、`recordFromResults: true`は
1名(`ushiku-juntaro`)。PR #377(2026-08-02マージ済み)により `shouldPreferMultiOrgRecord()` は
`needsReview`選手について4団体合算に1件でも試合があれば常に優先するため、この2名の1行目表示は
除外後の値へ確実に反映される。`recordFromResults`選手(ushiku-juntaro)も1行目が常に0のスタブ
設計のため同様に反映される。

残り4名(goto-joji・isao・sato-shoko・tokoro-hideo)は1行目が`data/fighterRecords.json`
(Wikipedia infobox由来)で確定しており、`fighters.ts`への直書き値は使われていない。この4名の
1行目は今回のデータ変更と無関係(元々パンクラスデータを参照しない)なので反映漏れの懸念自体が
発生しない。2行目(`computeMultiOrgRecord()`)は`shouldPreferMultiOrgRecord`の判定を経由せず
常にライブ計算のため、7名全員について確実に反映される。

**結論: 反映漏れは無い。**

## 9. 波及確認

| 対象 | 結果 |
|---|---|
| `data/shootoRecords.json` | 無変更(パンクラスゲートのキーワードは修斗データに1件もヒットしないことを確認済み) |
| `data/deepRecords.json` | 無変更(このPRでは触れていない) |
| `data/rizinRecords.json` | 無変更(このPRでは触れていない) |
| `data/rankings.json` | 無変更(`update-mnews-rating.ts`/`engine.ts`は`data/pancraseRecords.json`を一切参照しない。RIZIN開催試合のみをEloに使う設計のため、構造的に無関係) |
| `/methodology/records`の除外基準文言 | 変更不要。既存の「アマチュア大会は含みません」という一般的な記述の範囲内(個別カテゴリ名を列挙していないため) |

## 10. 【本PRのスコープ外・別途要対応】data/の非プロbout除外が日次で巻き戻る構造的な問題

実測の過程で、本PRとは無関係な既存の問題を発見した。着手前の`data/pancraseRecords.json`
(HEAD時点)を確認したところ、**既に一度PR #269でマージ済みのはずのCAGE GATE除外(37bout)・
PR #265/#268でマージ済みのはずのamateur除外(7bout)が両方とも巻き戻っており**、全bout数が
未フィルタ時点の4,877件になっていた。`data/shootoRecords.json`も同様に、karate/kids/
submission_only/amateur/tryoutの5カテゴリ計190boutが再混入していた。

原因: `.github/workflows/update-org-records.yml`(cron: 毎日JST 23:00、直近実行は
2026-08-03 03:13 UTC=12:13 JST、コミット`678f908`)が`build-shooto-records.ts`・
`build-pancrase-records.ts`(生スクレイパー)を直接実行してcommitしており、
`scripts/filter-nonpro-bouts.ts`を一度も呼んでいない。このため日次実行のたびに過去の除外PRの
内容が silently 巻き戻る。

本PRでは意図的にこの再混入分(CAGE GATE 37bout・amateur 7bout・修斗側190bout)を触っていない。
理由:
1. 指示書④のスコープはパンクラスゲートのみ。
2. `update-org-records.yml`は現在別セッションが`fix/update-org-records-rebase-autostash`
   ブランチ(PR #402)で作業中であり、同一ファイルへの並行編集を避ける必要がある(CLAUDE.md記載の
   衝突防止ルール)。
3. 一時的にdataだけ直しても次回の日次実行(最短で本日23:00 JST)で再度巻き戻るため、pipeline側
   (workflow内で`filter-nonpro-bouts.ts`を呼ぶ)の恒久修正が必要で、データの一時修正だけでは
   解決しない。

このPRでは`scripts/apply-pancrase-gate-exclusion.ts`という専用スクリプトで
`not_pro_pancrase_gate`カテゴリのboutだけを取り除き、他カテゴリの再混入分には触れていない。
別途、`update-org-records.yml`のフェッチ後に`filter-nonpro-bouts.ts`を呼ぶ恒久対応が必要。

## 11. 実行コスト・検証

- 判定はビルド時のデータ生成(`scripts/apply-pancrase-gate-exclusion.ts`)に閉じており、
  ページ側の毎リクエスト計算量は増えない(既存の`classifyMmaRuleType`と同じ設計)。
- 2回実行してバイト完全一致を確認。
- `tsc --noEmit`: エラー0件(このPRのために`scripts/filter-nonpro-bouts.ts`・
  `scripts/filter-deep-futureking-bouts.ts`の`removedByCategory`初期化オブジェクトへ
  `not_pro_pancrase_gate: 0`を追加する型合わせが必要だった)。
- `npm run build`: exit 0(143ページ生成)。ローカルbuildは`data/`をGitHub raw経由(origin/main)
  で取得する設計のため、ローカルの`data/pancraseRecords.json`編集はページ描画には反映されない
  (既知の制約)。ページ側の実際の反映確認はマージ後の本番/プレビューで行う必要がある。
- `npx tsx scripts/test-mnews-rating.ts`: 220件成功/0件失敗。

## 変更ファイル

- `src/lib/mnewsRating/nonProBoutFilter.ts`: `not_pro_pancrase_gate`カテゴリ追加、コメント更新
- `scripts/filter-nonpro-bouts.ts`: コメント更新、型合わせ
- `scripts/filter-deep-futureking-bouts.ts`: 型合わせのみ(挙動変化なし。DEEPデータにパンクラス
  ゲート表記はヒットしない)
- `scripts/apply-pancrase-gate-exclusion.ts`(新規): 本PR専用の適用スクリプト。
  `filter-nonpro-bouts.ts`を使わなかった理由は10節参照
- `data/pancraseRecords.json`: 4,877 → 4,616bout(261件除外)
- `out/investigate-pancrase-gate-affected.ts`(新規): 実測スクリプト(再現用)
- `out/pancrase-gate-exclusion-measurement.md`(新規): 本レポート

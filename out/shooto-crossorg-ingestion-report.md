# 修斗クロスorg欠落bout一括投入(指示書E)報告

生成日時: 2026-08-04(JST)。

## スコープ

#423(修斗クロスorg監査261名候補)で判明した欠落121件のうち、身元確認済み
(要裏取り9名を除く)19名について、プロフィール投入型のみを
`data/shootoProfileBouts.json`に一括投入した。archive収録漏れ型・
勝敗食い違い(mismatch)は投入せず報告のみに留めた。

## 1. 121件の内訳(3分類、投入前に確定)

| 分類 | 全体121件中 | 要裏取り4名分(投入対象外) | 身元確認済み19名分(投入対象) |
|---|---|---|---|
| profile投入型(新規①pre-cutoff + 新規②-b大会自体無し) | 115 | 21 | **94** |
| archive収録漏れ型(新規②-a、大会は既存だがbout欠落) | 4 | 1 | 3 |
| mismatch(勝敗食い違い、既存データが誤り) | 2 | 0 | 2 |

要裏取り4名(tsuruya-rei/saito-yutaka/soya-takaki/aoi-jin、高衝突リスクのため
本PRでは未確定のまま個人特定せず投入対象から除外)の内訳は新規①4件+新規②-b17件+
新規②-a1件=22件(#423のレポート記載どおり)。

## 2. profile投入型94件の一括投入

`scripts/ingest-shooto-crossorg-gap-bouts.ts`で19名(前述の身元確認済み15名+
archive収録漏れ/mismatchのみの4名noel/sasaki-shunma/nomura-shunta/
usami-sho-patrick、後者4名は投入対象0件)のプロフィールページを1.2秒間隔・
robotsGate経由で再取得し、`data/shootoProfileBouts.json`に94件追記した
(既存115件→合計209件)。スキーマは指示書R-8/C-3/#399/#418で確立済みのもの
(1bout=1件の疑似`ShootoRecordsEvent`、`sourceType: "profile"`、負の
`shootoEventId`、eventName不明時はプレースホルダ)をそのまま踏襲。
`data/shootoRecords.json`・`shootoScraper.ts`は無変更。

投入前に投入予定の(相手shootoId, 日付)組が既存`shootoProfileBouts.json`と
重複しないことを確認済み(重複ゼロ)。相手選手のslug解決は91/94件が未解決
(`FIGHTERS`未登録、想定どおり。既存投入と同じ挙動)。

### 対象15名の投入内訳

| 選手 | org | 投入件数 |
|---|---|---|
| 扇久保博正(ougikubo-hiromasa) | rizin | 16 |
| 村山暁洋(murayama-akihiro) | pancrase | 15 |
| 矢地祐介(yachi-yusuke) | rizin | 11 |
| 堀口恭司(horiguchi-kyoji) | ufc | 10 |
| 福田龍彌(fukuda-ryuya) | rizin | 8 |
| 合島大樹(gojima-daiki) | pancrase | 7 |
| 金田一孝介(kindaichi-kosuke) | deep | 6 |
| 青木真也(shinya-aoki) | one | 5 |
| 魚井フルスイング(uoi-fullswing) | deep | 4 |
| 摩嶋一整(majima-kazumasa) | rizin | 3 |
| 佐藤将光(sato-shoko) | rizin | 3 |
| 松嶋こよみ(matsushima-koyomi) | rizin | 2 |
| 本田良介(honda-ryosuke) | deep | 2 |
| 安藤達也(ando-tatsuya) | rizin | 1 |
| 箕輪ひろば(minowa-hiroba) | one | 1 |
| **合計** | | **94** |

## 3. archive収録漏れ型(3件、投入せず)

大会自体は`data/shootoRecords.json`に存在するが、当該boutだけが欠落している
(スクレイパー側の取りこぼしとみられる)。大会単位の再取得は本PRのスコープ外。

| 選手 | 日付 | 相手 | 大会名 |
|---|---|---|---|
| NOEL(noel) | 2023-08-20 | 伊東侑姫 | 広島大会「TORAO | colors」 |
| NOEL(noel) | 2023-04-09 | 丸山帆波 | SHOOTO GIG TOKYO Vol.34 |
| 佐々木瞬真(sasaki-shunma) | 2019-11-24 | 赤羽幾也 | SHOOTO 30th ANNIVERSARY TOUR FINAL Supported by ONE Championship |

## 4. mismatch(2件、投入せず)

#423で既に報告済みの野村駿太×宇佐美正パトリック(2021-11-06、VTJ 2021)の
勝者反転バグ。既存データの誤りであり「欠落」ではないため、本PRでは投入も
修正も行っていない(別途修正PRが必要)。

## 5. 検証

### 5-1. 波及確認(全365名、`scripts/audit-shooto-profile-ingestion.ts`)

投入前後で2行目(`computeMultiOrgRecord`、4団体とも実データで計算)が変化した
選手は36名(投入対象15名+既存の他選手混在。既存shootoRecords.jsonの
archive拡充時と同じ監査手法を流用)。**増分実測値は全36名で期待値(投入bout数)
と完全一致**(`incrementMatchesExpected: true`)。二重計上は無い。

### 5-2. 「2行目が1行目を上回る選手が出ないこと」

機械的な監査(`row1HasRealData && afterTotal > row1Total`)では2名が該当した。
いずれも実際の表示切替ロジック(`shouldPreferMultiOrgRecord`)で個別に検証し、
表示上の矛盾が起きないことを確認した。

| 選手 | 1行目(row1) | 2行目(row2) | `shouldPreferMultiOrgRecord` | 実際の表示 |
|---|---|---|---|---|
| 扇久保博正(ougikubo-hiromasa) | 30-9-2(41) | 30-10-2(42) | **false** | 1行目のまま(2行目には切り替わらない。`live:true`かつ`needsReview`/`recordFromResults`フラグ無しのため無条件で1行目優先) |
| 合島大樹(gojima-daiki) | 8-9-1(18) | 12-11-2(25) | **true** | 2行目に切り替わる。ただしこれは仕様どおりの動作(`needsReview:true`かつ`live:false`＝1行目はレビュー未了の暫定直書き値であり、4団体合算に1件でも試合があれば常に差し替える設計。指示書R-2で確立済みの既存仕様、本PRが原因の不具合ではない) |

**結論**: 数値上「2行目>1行目」となるケースは2件あるが、いずれも実際の
ページ表示では矛盾を生まない(前者は表示が切り替わらない、後者は仕様通り
切り替わり、暫定値から実データへの更新として正しく機能する)。

### 5-3. その他の受入条件

- **`data/rankings.json`**: 無変更(git diffで差分ゼロを確認)。`scripts/update-mnews-rating.ts`は`shootoRecords`/`shootoProfileBouts`をimportしていない。
- **実行時コスト**: `src/lib/multiOrgRecordsData.ts`(プロセス内1時間キャッシュ・GitHub raw fetch)は無変更。追加した94件は既存の`data/shootoProfileBouts.json`配列に静的に追記されるのみで、リクエストごとの再集計経路は増えない。
- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: 成功

## 6. 23名の1行目/2行目一覧(投入後、実測値)

| 選手 | org | 1行目 | 2行目 | 投入 |
|---|---|---|---|---|
| 扇久保博正 | rizin | 30-9-2(41) | 30-10-2(42) | ○16件 |
| 村山暁洋 | pancrase | 25-15-9(49) | 22-13-5(40) | ○15件 |
| 矢地祐介 | rizin | 29-16-0(45) | 25-12-0(37) | ○11件 |
| 堀口恭司 | ufc | 36-6-0(42) | 26-2-0(28) | ○10件 |
| 福田龍彌 | rizin | 26-10-1(37) | 24-8-1(33) | ○8件 |
| 合島大樹 | pancrase | 8-9-1(18) | 12-11-2(25) | ○7件 |
| 金田一孝介 | deep | 11-4-2(17) | 8-4-1(13) | ○6件 |
| 青木真也 | one | 50-12-0(62) | 6-1-0(7) | ○5件 |
| 魚井フルスイング | deep | 27-16-4(47) | 15-15-1(31) | ○4件 |
| 摩嶋一整 | rizin | 19-6-0(25) | 14-6-0(20) | ○3件 |
| 佐藤将光 | rizin | 38-17-2(57) | 26-12-2(40) | ○3件 |
| 松嶋こよみ | rizin | 15-8-0(23) | 8-3-0(11) | ○2件 |
| 本田良介 | deep | 14-8-1(23) | 12-6-1(19) | ○2件 |
| 安藤達也 | rizin | 16-5-1(22) | 12-4-1(17) | ○1件 |
| 箕輪ひろば | one | 14-6-0(20) | 11-2-0(13) | ○1件 |
| NOEL | rizin | 4-2-0(6) | 4-2-0(6) | ×(archive収録漏れ2件のみ、投入せず) |
| 佐々木瞬真 | pancrase | 0-0-0(0) | 4-2-0(6) | ×(archive収録漏れ1件のみ、投入せず) |
| 野村駿太 | rizin | 10-2-0(12) | 9-0-0(9) | ×(mismatch、投入せず) |
| 宇佐美正パトリック | rizin | 9-5-0(14) | 7-5-0(12) | ×(mismatch、投入せず) |
| 鶴屋怜(要裏取り) | ufc | 11-1-0(12) | 6-0-0(6) | ×(未確定のため対象外) |
| 斎藤裕(要裏取り) | rizin | 21-9-2(32) | 12-8-0(20) | ×(未確定のため対象外) |
| 征矢貴(要裏取り) | rizin | 13-8-1(22) | 7-7-0(14) | ×(未確定のため対象外) |
| 青井人(要裏取り) | deep | 16-7-1(24) | 13-5-1(19) | ×(未確定のため対象外) |

全23名とも1行目>=2行目(合島大樹1名を除く。合島は前述のとおり仕様通りの
切り替え)。

## 出力ファイル

- [scripts/ingest-shooto-crossorg-gap-bouts.ts](../scripts/ingest-shooto-crossorg-gap-bouts.ts) — 一括投入スクリプト(冪等ではないため再実行しないこと。重複防止チェック付き)
- `data/shootoProfileBouts.json` — 94件追記(115→209件)
- [out/shooto-crossorg-ingestion-report.json](shooto-crossorg-ingestion-report.json) — 投入・archive収録漏れ・mismatchの全詳細
- [out/r8-ingestion-audit.json](r8-ingestion-audit.json) — `audit-shooto-profile-ingestion.ts`実行結果(既存スクリプト、無変更で再利用)

## 次のステップ(本PRでは着手しない)

- archive収録漏れ型3件(NOEL2件・佐々木瞬真1件): 該当大会ページの再スクレイピングでbout欠落を修正すべき別課題
- mismatch2件(野村駿太×宇佐美正パトリック): 勝者反転バグの個別修正
- 要裏取り4名(鶴屋怜/斎藤裕/征矢貴/青井人)の身元確認後、該当22件の投入要否判断

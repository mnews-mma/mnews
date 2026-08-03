# 修斗クロスorg監査(261名候補)報告

生成日時: 2026-08-04(JST)。read-only(投入・修正は一切行っていない)。

## 発端・スコープ

#418(kasuya-yusuke修正PR)で、指示書R-7/R-8の修斗プロフィール監査が
`fighters.ts`の`org: "shooto"`101名(現104名)限定だったため、
「修斗org以外にタグ付けされているが実際は修斗歴を持つ選手」が丸ごと
未監査という構造的な抜けが判明した。`FIGHTERS`全365名のうち該当する
**261名**について、id特定→プロフィール突合→欠落件数集計を行う。

対象261名の定義: `FIGHTERS.filter(f => f.org !== "shooto" && !(f.orgs ?? []).includes("shooto"))`

## 手法

1. **id特定(追加fetch無し)**: 修斗公式選手一覧ページ(`https://www.shooto-mma.com/fighters/`、1ページのみ、robots.txt許可済み)を1回取得し、1,909行(id・日本語表記・ローマ字表記・所属ジム・最新戦績日・階級)を抽出。261名の`nameJa`をまず正規化完全一致(NFKC+異体字/同形字統一、`scripts/lib/fighterNameBackfill.ts`の`normalize()`を流用)で突合し、不一致の場合のみ`aliases`配列でも試行(**名寄せ軸**)。
2. **プロフィールfetch**: id特定できた対象のみ`https://www.shooto-mma.com/fighters/?id=NNN`を1.2秒間隔・`assertAllowedByRobots`経由で取得(上限300件、実際は44件で収まった)。
3. **突合**: mnews側の既存修斗boutは`computeFighterShootoRecord()`(slug完全一致、`data/shootoRecords.json`+`data/shootoProfileBouts.json`結合)+`fighters.ts`の`history`配列を「日付+相手名(正規化)」複合キーで統合し、プロフィール表の各行と突合。R-7と同じ区分(matched/新規①pre-cutoff/新規②-a/新規②-b/mismatch)を使用。

修正・投入は一切行っていない。使用スクリプト: [scripts/investigate-shooto-crossorg-audit-261.ts](../scripts/investigate-shooto-crossorg-audit-261.ts)

## 結果1: id特定

| 区分 | 件数 |
|---|---|
| 候補総数 | 261 |
| **id特定** | **44**(16.9%) |
| うちnameJa直接一致 | 43 |
| うちaliasesで一致(名寄せ軸ヒット) | 1 |
| 同名複数該当(ambiguous、要裏取り) | 1 |
| 未特定 | 216 |

id特定できた44名はfetch上限300件を大きく下回ったため、全件プロフィール取得を完走した(unreachable 0件)。

### org別の内訳(id特定率)

| org | 候補数 | id特定数 | 特定率 |
|---|---|---|---|
| rizin | 90 | 17 | 18.9% |
| pancrase | 77 | 7 | 9.1% |
| deep | 73 | 10 | 13.7% |
| one | 12 | 5 | 41.7% |
| ufc | 5 | 4 | 80.0% |
| nexus | 4 | 1 | 25.0% |

RIZIN/UFC/ONE所属選手の方がpancrase所属選手よりも修斗経歴を持つ確率が高い傾向(サンプル数の小さいufc/oneは参考値)。

### 名寄せ軸ヒット(1件)

| slug | fighters.ts nameJa | 一致したalias | 修斗公式siteNameJa |
|---|---|---|---|
| ohara-juri | 大原樹理 | 大原樹里 | 大原  樹里 |

「理」と「里」の字体差(異体字ではなく別字)がnameJa側では吸収できず、`aliases`に登録済みの表記で解決した。船田電池型(本名⇔リングネーム)の完全な事例ではないが、同じ「nameJa直接一致では解決できずaliasesで初めて解決する」パターン。

### 同名複数該当(ambiguous、要裏取り、1件)

| slug | nameJa | 該当する公式id |
|---|---|---|
| kintaro | 金太郎 | 423, 962 |

単独名(単一の芸名的表記)のため、公式サイト側に同名の別人が複数登録されている。id断定はしていない(未確定のまま)。

### 高衝突リスク(matched・要裏取り、9件)

正規化後3文字以下の名前は`fighterNameBackfill.ts`の既存基準(近似候補ノイズ抑制の閾値)を流用し、機械的に「要裏取り」対象とした。実際には以下のうち複数は既に著名選手で誤認の可能性は低いとみられるが、機械的な完全一致のみで断定はしていない。

| slug | nameJa | org | 公式id |
|---|---|---|---|
| kouzi | 皇治 | rizin | 1829 |
| raika | ライカ | pancrase | 1481 |
| tsubaki-asuka | 椿飛鳥 | deep | 1296 |
| aoi-jin | 青井人 | deep | 267 |
| tou-hoiin | 透暉鷹 | pancrase | 1260 |
| saito-yutaka | 斎藤 裕 | rizin | 5 |
| soya-takaki | 征矢 貴 | rizin | 102 |
| tokoro-hideo | 所 英男 | rizin | 992 |
| tsuruya-rei | 鶴屋 怜 | ufc | 1072 |

### 未特定216名

内訳・全リストは[out/shooto-crossorg-id-matches.json](shooto-crossorg-id-matches.json)(`matched:false, ambiguous:false`のエントリ)を参照。抜き取りで数件(浜本キャット雄大/杉山しずか等)を公式一覧ページに対して個別grepで再確認し、正規化バグではなく実際に一覧に存在しないことを確認した。ただし**この一覧ページ自体が現在の登録選手のスナップショットである可能性があり**(古い戦績のみの選手が一覧から外れている可能性を否定できない)、「未特定=修斗歴が絶対に無い」とは言い切れない点に注意。

## 結果2: 44名・301bout突合

| 区分 | 件数 |
|---|---|
| 一致(matched) | 180 |
| 新規①: 2012-12-24より前 | 71 |
| 新規②-a: 大会は既存だがbout自体が無い | 4 |
| 新規②-b: 大会自体が既存に無い/大会リンク無し | 44 |
| **★勝敗食い違い(mismatch)** | **2** |
| **欠落合計(gapCount)** | **121**(301中40.2%) |
| 欠落が1件以上ある選手 | 23/44名 |
| 欠落0件(完全反映済み) | 21/44名 |

### 欠落件数上位(gapCount順、抜粋)

| 選手 | org | プロフィール戦数 | mnews反映済み | 欠落 |
|---|---|---|---|---|
| 扇久保博正(ougikubo-hiromasa) | rizin | 21 | 5 | **16** |
| 村山暁洋(murayama-akihiro) | pancrase | 15 | 0 | **15** |
| 斎藤裕(saito-yutaka) | rizin | 23 | 11 | **12** |
| 矢地祐介(yachi-yusuke) | rizin | 12 | 1 | **11** |
| 堀口恭司(horiguchi-kyoji) | ufc | 12 | 2 | **10** |
| 福田龍彌(fukuda-ryuya) | rizin | 16 | 8 | **8** |
| 合島大樹(gojima-daiki) | pancrase | 7 | 0 | **7** |
| 征矢貴(soya-takaki)※要裏取り | rizin | 12 | 6 | **6** |
| 金田一孝介(kindaichi-kosuke) | deep | 6 | 0 | **6** |
| 青木真也(shinya-aoki) | one | 5 | 0 | **5** |
| 魚井フルスイング(uoi-fullswing) | deep | 19 | 15 | 4 |
| 摩嶋一整(majima-kazumasa) | rizin | 9 | 6 | 3 |
| 佐藤将光(sato-shoko) | rizin | 16 | 13 | 3 |
| 青井人(aoi-jin)※要裏取り | deep | 11 | 8 | 3 |
| (以下9名は欠落1〜2件、[out/shooto-crossorg-per-fighter.json](shooto-crossorg-per-fighter.json)参照) | | | | |

RIZINの著名選手(堀口恭司・矢地祐介・青木真也・扇久保博正等)にも修斗時代の戦績がmnews側に反映されていないケースが多数見つかった。特に堀口恭司・青木真也は他団体戦績が既に相当数DB化されている選手であるにもかかわらず、修斗分は今回の突合まで一件も監査対象になっていなかった(#418と同じ「母集団スコープ漏れ」構造)。

### ★勝敗食い違い(mismatch、2件・実質1bout)

| 選手 | 日付 | 相手 | 公式プロフィール(両者一致) | mnews既存(shootoRecords.json) |
|---|---|---|---|---|
| 野村駿太(nomura-shunta) | 2021-11-06 | 宇佐美正パトリック | 野村×(判定0-3)/宇佐美○ | `winnerName: "野村 駿太"`(逆) |
| 宇佐美正パトリック(usami-sho-patrick) | 2021-11-06 | 野村駿太 | 同上 | 同上(相互出現の同一bout) |

VTJ 2021(shootoEventId=122)第1試合。**野村駿太・宇佐美正パトリック双方の公式プロフィールページが一致して「宇佐美が判定0-3で勝利」としており、mnews側に埋め込み済みのジャッジスコア(`noteRaw`: 片岡誠人20-17・豊永稔20-18・福田正人20-17、いずれも宇佐美=fighterA優勢)も同じ結論を示している**にもかかわらず、`winnerName`/`winnerSlug`が逆の「野村駿太」になっている。過去の勝敗マーカー誤読(RIZIN resultType/winnerSlug系、#292・#293等)と同種の、集計層側での勝者反転バグの可能性が高い。本監査では修正していない。

## 出力ファイル

- [scripts/investigate-shooto-crossorg-audit-261.ts](../scripts/investigate-shooto-crossorg-audit-261.ts) — 本監査の実行スクリプト
- [out/shooto-crossorg-listing-raw.json](shooto-crossorg-listing-raw.json) — 公式選手一覧1,909行の生データ
- [out/shooto-crossorg-id-matches.json](shooto-crossorg-id-matches.json) — 261名全員の突合結果(matched/ambiguous/unmatched全件)
- [out/shooto-crossorg-per-fighter.json](shooto-crossorg-per-fighter.json) — id特定できた44名の欠落件数内訳
- [out/shooto-crossorg-audit-summary.json](shooto-crossorg-audit-summary.json) — 集計サマリ

## 次のステップ(本PRでは着手しない)

- 欠落121件(23名)の個別投入方針の検討。ボリュームが大きいため#418/#420と同じ「プロフィール由来の疑似イベント」形式(`sourceType: "profile"`)での一括投入か、優先順位付け(著名選手のRIZIN/UFC/ONE所属者を先に等)が必要。
- mismatch 2件(実質1bout、野村駿太×宇佐美正パトリック)の勝者反転バグ修正。
- 「要裏取り」10名(高衝突リスク9名+ambiguous1名)の個別裏取り。
- 未特定216名について、一覧ページが現行登録者のスナップショットである可能性の検証(別の取得経路が無いか)。
- D: パンクラス側(131名/54名候補)の同種監査。

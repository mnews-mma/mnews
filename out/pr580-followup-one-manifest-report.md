# PR#580フォローアップ①②③⑤⑥ 実施報告

## ①: manifest機械生成化 + 再現テスト

### 発見経路の明記
`https://www.onefc.com/athletes/` の絞り込みセレクトに `Country` optgroupがあり、
`https://www.onefc.com/athletes/country/jp/` (ページネーション `/page/N/`) で
ONE公式が国籍タグ「日本」を付けている選手一覧を取得できる。実測でページ11が404となり
全10ページ・233人が母集団として確定した(`scripts/standup-pipeline/discover_one_jp_athletes.py`)。

233人それぞれの `https://www.onefc.com/jp/athletes/{slug}/` を取得し、`<h1>` の
表記名(引用符ニックネーム除去・空白除去で正規化)を `fighters.json` の選手名と
完全一致で突合した(`scripts/standup-pipeline/build_one_manifest.py`)。
結果: 一致85人・同名で複数候補のため不採用1人(「龍聖」)・名簿に無し146人・取得失敗1人(404)。

### 既知の限界(実測で判明): country=jpタグの非網羅性
ONE公式の国籍タグは不完全。明らかに日本人名の選手でもタグが付いていない実例を確認した:
- `takahashi-kiyoto`(髙橋聖人、RISE所属の実在選手)
- `akito-nakashima`(中嶋愛樹斗)
- 他、既存bouts_one.json(PR#580時点の122件・40人)のうち24人がcountry=jpフィルタでは
  再発見できないが、いずれも`fighters.json`への一致確認済みの実在選手だった。

このため、machine生成manifest = 「country=jp発見85人」∪「PR#580時点で既に確認済みの
再発見不能25人(legacy_verified、`fighters.json`一致は事前確認済み)」の**union方式(計110人)**
とした。和島大海(hiromi-wajima)・安保瑠輝也(rukiya-anpo)はcountry=jp側で正しく再発見された
(手書きmanifestは不要になった)。

### 再現テスト結果(実測)
`fetch_one_manifest_pages.py`を新manifest(110人)で1回実行し、PR#580マージ直後の
bouts_one.json(125件・40人)と比較:

| | PR#580時点 | 本フォローアップ後 |
|---|---:|---:|
| bout件数 | 125 | 272 |
| 選手数 | 40 | 106 |

**バイト単位・件数では一致しない。差分の全件内訳(残余ゼロで説明):**
- 削除された選手: **0人**(既存データの喪失なし)
- 共通する40人: 試合数変化ゼロ(再取得しても既存データと完全に一致、決定性を確認)
- 新規追加: **66人**(country=jpフィルタで新たに発見・fighters.json一致した選手)

つまり差分は完全に追加のみで構成され、既存データへの悪影響(残余)はゼロと実測で確認した。

## ②: 新設ゲートの欠落検知能力の実測

PR#580で新設した`check-kick-one-official-source-precedence.ts`は`data/kick/oneOfficialSourceRegistry.json`
に個別登録した3試合のみを検査するゼロ件ゲートであり、それ以外の(当時)38人・
(現在)106人のONE公式データが丸ごと消失しても検知できないことを実測で確認した
(`data/kick/bouts_one.json`を空にして検証: 登録3件は検知したが、ビルド全体としては
他選手の消失を検知する仕組みが無かった)。

この穴を塞ぐため`scripts/check-kick-one-manifest-coverage.ts`を新設し、`npm run build`に配線した:
- **検査A(zeroOfficialCount)**: manifest登録選手のうち、生成データにonefc.com由来のbout行が
  1件も無い選手数。ratchet(悪化のみ検知)。現状値=4人(いずれもONE側プロフィールに
  対象スポーツ(キックボクシング/ムエタイ)の試合が無い正当なケースと確認済み)。
- **検査B(residualWikipediaCount)**: manifest登録選手のONE Championship行のうち、なお
  Wikipedia出典のままの行数。ratchet(悪化のみ検知、ゼロを強制しない)。現状値=21件。
  ゼロを強制しない理由(実測で確認): ONE公式プロフィールの戦績表自体が選手の全キャリアを
  表示しない構造的制約がある(例: 秋元皓貴はWikipediaに2019年からの記録があるが、
  ONE公式の戦績表は2022年11月以降の6試合しか表示しない。GLORY公式で既知の同型事象と同じ)。

破壊テスト実施済み: `bouts_one.json`を空にする→検査A=110人(全員)・検査B=40件に悪化→exit 1→
復元→OKに復帰、を実測で確認。

## ③: 安保瑠輝也の全行突合

ONE公式プロフィール(`https://www.onefc.com/jp/athletes/rukiya-anpo/`)の戦績表を実測で
全行取得した結果、**1行のみ**(2025-11-16 ONE 173 vs マラット・グレゴリアン、敗)。

`/kick/fighters/anpo-rukiya`のONE Championship行は2件:
| 日付 | 相手 | 結果 | 出典 |
|---|---|---|---|
| 2025-11-16 | マラット・グレゴリアン | 敗 | ONE公式(公式1行と1:1で完全一致、alsoFromにWikipedia URLも保持) |
| 2026-10-17 | ボグダン・シュマロフ | 未定(試合前) | Wikipedia(公式戦績表に存在しない予定試合。未開催のため公式側に反映されないのは正当) |

**残余ゼロで説明**: 公式戦績表1行 = 公式出典として掲載された1行(完全一致)。もう1行は
未来の予定試合であり公式の「戦績」表(完了試合のみ掲載)には構造上載らない。欠落ではない。

## ⑤: 「公式ソースが取得対象に含まれているのにWikipedia出典」の指標化

②のゲート検査Bとして実装(上記参照)。現状21件、内訳(代表例):
- �538秋元皓貴(7件): ONE公式戦績表が2022年11月以降しか表示しない構造的制約
- マラット・グレゴリアン(10件、安保瑠輝也の対戦相手としても登場): 同じくプロフィール
  表示の切り詰め
- 安保瑠輝也の2026-10-17予定試合(1件): 未開催のため公式側未反映(構造的、正当)
- ジョルジオ・ペトロシアン等: 同型の表示切り詰め

いずれも個別確認の結果、ONE公式サイト自身の戦績表表示範囲の制約であり、取得パイプライン側の
不具合ではないと判断した。

## ⑥: 全16ソースのbouts_*.json再生成可能性監査

`scripts/standup-pipeline/`配下の`ingest_*.py`・`bouts.py`を全数確認。`raw/`ディレクトリは
`.gitignore`で除外されており(意図的、巨大な生HTMLをコミットしないため)、各ソースが
「`raw/`を再取得するネットワーク取得スクリプトを持つか」で再生成可能性を判定した。

| ソース | bouts_*.json | 再生成可能性 | 詳細 |
|---|---|:---:|---|
| ONE Championship | bouts_one.json | ✅ 再生成可能 | 本PR以降。`fetch_one_manifest_pages.py`(ネットワーク取得あり)+manifest。ただしmanifest未登録の新規選手発見は別途手動調査が必要(county=jpフィルタの非網羅性、①参照) |
| Wikipedia | bouts_wikipedia.json | ✅ 再生成可能 | `fetch_wikitext_cache_v2.py`(ネットワーク取得)→`ingest_wikipedia.py`。候補母集団`coverage_population.json`はコミット済み |
| RIZIN | bouts_rizin.json | 🟡 間接的に再生成可能 | `raw/rizinRecords.json`はmnews本体の`data/rizinRecords.json`(`scripts/update-rizin-records.ts`で再生成可能)のコピーと推定。standup-pipeline側への複写は手動 |
| SHOOT BOXING | bouts_sb.json | ❌ 再生成不可 | `raw/sb_bouts/*.html`依存、取得スクリプトなし |
| K-1/Krush/Krush-EX | bouts_k1.json | ❌ 再生成不可 | `raw/k1_bouts/*.html`・`raw/k1_parsed.json`依存、取得スクリプトなし |
| RISE | bouts_rise.json | ❌ 再生成不可 | `raw/rise_bouts/*.html`・`raw/rise_parsed.json`・`raw/rise_dob.json`依存、取得スクリプトなし |
| KNOCK OUT | bouts_knockout.json | ❌ 再生成不可 | `raw/ko_parsed.json`依存、取得スクリプトなし |
| DEEP☆KICK | bouts_deepkick.json | ❌ 再生成不可 | `raw/deepkick_events/`・`raw/deepkick_index/index.json`依存、取得スクリプトなし |
| NJKF | bouts_njkf.json | ❌ 再生成不可 | `raw/njkf_events/*.html`・`raw/njkf_index/event_urls.json`依存、取得スクリプトなし |
| HoostCup | bouts_hoostcup.json | ❌ 再生成不可 | `raw/hoostcup_events/*.html`依存、取得スクリプトなし |
| NKB | bouts_nkb.json | ❌ 再生成不可 | `raw/nkb_index/all_posts.json`・`raw/nkb_old_events/*.html`依存、取得スクリプトなし |
| Bigbang | bouts_bigbang.json | ❌ 再生成不可 | `raw/bigbang_fighters/`依存、取得スクリプトなし |
| Stand up | bouts_standup.json | ❌ 再生成不可 | `raw/standup_pro_results/`依存、取得スクリプトなし |
| KROSS×OVER | bouts_krossover.json | ❌ 再生成不可 | `raw/kross_results/`依存、取得スクリプトなし |
| SNKA | bouts_snka.json | ❌ 再生成不可 | `raw/snka_ameblo/`依存、取得スクリプトなし |
| JKA | bouts_jka.json | ❌ 再生成不可 | `raw/jka_results/`依存、取得スクリプトなし |

**結論**: 16ソース中、真に再生成可能なのはONE(本PR)とWikipediaの2つのみ。RIZINはmnews本体の
別パイプライン経由で間接的に再生成可能。残り13ソース(SB/K-1/RISE/KNOCK OUT/DEEP☆KICK/NJKF/
HoostCup/NKB/Bigbang/Stand up/KROSS×OVER/SNKA/JKA)は取得スクリプトが repo 内に一切存在せず、
現在の`bouts_*.json`は過去セッションでの一回限りの取得結果がそのまま固定化された状態にある。
これはONEが抱えていたのと同じ構造的リスク(データの追加・修正には毎回アドホックな再取得が
必要)であり、13ソース分の取得スクリプト新設は今回のスコープ外(ONEトラック終了の対象外、
別タスクとして扱うべき規模)と判断し、実装せず本報告のみとする。

## 波及確認

- `npm run build`(kick:data全ゲート+全テスト+`next build`+最終ゲート)成功
- 新設ゲート`check-kick-one-manifest-coverage.ts`を`npm run build`に配線、破壊テスト実測済み
- `check-kick-identity-merge-risk.ts`のratchetが50→52に増加(70人の新規発見に伴う副作用)。
  ONE関連8件を個別確認: いずれも`fighters.json`側で(名前・所属・出典)三点一致の単一候補への
  厳密照合であり、旧KROSS×OVER問題(名前一致のみで結合)と異なり誤統合リスクは低いと判断し、
  基準値を52へ更新した
- PR#580の回帰ゲート(`check-kick-one-official-source-precedence.ts`)は引き続きOK

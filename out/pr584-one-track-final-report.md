# PR#580/#582フォローアップ⑦⑧⑨⑩ 実施報告(ONEトラック最終)

## ⑦: manifest未登録42件を発見経路として使う

`check-kick-one-manifest-coverage.ts`検査Bの「manifest未登録選手分42件」を洗い出した結果、
**13人**が該当(合計42件)。全員についてONE公式サイトでのプロフィール実在を個別調査した。

### 発見・manifestに追加した6人(合計24件)

| 発見経路 | one_slug | fighters.json | 備考 |
|---|---|---|---|
| bouts_one.json内の対戦相手slugから直接判明 | giorgio-petrosyan | ジョルジオ・ペトロシアン | |
| 同上 | marat-grigorian | マラット・グレゴリアン | |
| 同上 | denis-puric | デニス・ピューリック | |
| 同上 | wang-junguang | ワン・ジュングァン | |
| ローマ字slug推測 | keisuke-monguchi | 門口佳佑 | ONE公式`<h1>`は「佳佑門口」(同じ4文字の並び順違い) |
| country=jpフィルタの233人候補に含まれていたが自動マッチ漏れ | banna-hayashi | 繁那 | `<h1>`は「林繁那」(姓+リングネーム)。年齢表示(22歳)がfighters.json生年月日(2004.1.28)と一致し本人確認 |

### 「ONE公式にページ無し」等、理由付きで一覧に残した7人

`data/kick/oneUnregisteredExceptionsRegistry.json`に登録:

| 選手 | 理由 | 詳細 |
|---|---|---|
| 辻井和奏 | official_page_exists_but_no_data_rows | プロフィール(wakana-tsujii)は実在・`<h1>`完全一致だが戦績表が0行 |
| 弘・センチャイジム | no_official_page_found | 複数のローマ字パターンで探索、全て404 |
| 貴センチャイジム | no_official_page_found | 同上 |
| 壱・センチャイジム | no_official_page_found | 同上 |
| Little Tiger | no_official_page_found | 同上 |
| 龍聖(RISE版) | ambiguous_same_name_in_roster | fighters.jsonに同名2人存在、機械的に一意特定不可 |
| 龍聖(KNOCK OUT版) | ambiguous_same_name_in_roster | 同上 |

## ⑧: 「manifest未登録なのにONE試合行を持つ選手数」のゼロratchet新設

`check-kick-one-manifest-coverage.ts`に検査Cを追加。生成データ全体をスキャンし、
manifest未登録かつ例外レジストリにも無い選手が1人でもいれば**常にゼロ**を要求してビルドを
失敗させる(検査A・Bと異なり基準値を持たない絶対ゼロゲート)。

**破壊テスト2種類を実測**:
1. 例外レジストリを空にする → 7人検知・exit 1 → 復元 → OK
2. **和島大海をmanifestから削除する(=当初の欠陥そのものを再現)** → `wajima-hiromi(和島 大海, 2件)`として検知・exit 1 → 復元 → OK

②のコード冒頭コメントを更新し、限界の記述を修正: 「Wikipedia出典等で既にmnewsのデータに
取り込まれている選手」に限り検知可能、ONE公式にしかプロフィールが無くWikipedia側にも
情報が無い選手(mnewsが一度も認知していない選手)は依然として検知不可、と明記した。

## ⑨: 検査A(4人)と「manifest未登録選手分42件」の関係

**完全に別勘定、重複ゼロ**。

- 検査A(4人): **manifest登録済み**選手(hyuma-hitachi・raize・shoa-arii・yugo-kato)のうち、
  ONE公式プロフィールを取得したが対象スポーツ(キックボクシング/ムエタイ)の試合が
  1件も無かった選手。「manifestに載っているが公式データが空」という母集団。
- 「42件」(⑤検査Bの残存Wikipedia出典の内訳): **manifest未登録**の13人が持つONE
  Championship行の合計。「manifestに載っていないのにONE戦がある」という別の母集団。

両者は「manifest登録済み/未登録」という軸そのものが逆であり、対象選手の重なりもゼロ。

## ⑩: ⑦増加分の全数監査+ONEトラック終了

新規追加24件・6選手の全27フィールドを監査(サンプリング無し)。監査中に**実在のパーサー
不具合を1件発見・修正した**:

### 発見: `ingest_one.py`がNo Contest(is-muted)を未対応だった

`result`フィールドに前回監査には無かった`'unknown'`値が2件出現。生HTML確認の結果、
ONE公式サイトは通常の勝敗(`is-positive`/`is-negative`/`is-neutral`)とは別に、
No Contest用の`is-muted`というCSSクラスバリエーションを使っており(中身は
「ノーコンテスト」という日本語テキストのみ、英語大文字ラベルが無い)、既存の
`ingest_one.py`の正規表現がこれを一切捕捉できていなかった。

**影響範囲を確認**: この不具合は⑦の新規発見分だけでなく、**PR#580から存在していた
既存登録選手(エリアス・マムーディ)にも影響していた**(デニス・ピューリック×
エリアス・マムーディ戦は両者の視点から2行存在し、両方とも影響を受けていた)。
全体で影響行数3件(実試合2件: デニス・ピューリック×エリアス・マムーディ、
ジョルジオ・ペトロシアン×ペットモラコット・ペッティンディー)。

`ingest_one.py`を修正(`is-muted`の中身が「ノーコンテスト」の場合のみ`no_contest`と
判定、未知のバリエーションは推測せず従来通り`unknown`のまま)し、全116人分を再取得。
修正後、`result='unknown'`は0件に復帰、該当3行は正しく`no_contest`/`one:NC`になった。

修正後の24件を再監査した結果、異常0件(全フィールド整合)。

### 波及確認
- `npm run build`(kick:data全ゲート+全テスト+`next build`+最終ゲート)成功
- 検査Cのゼロゲート、破壊テスト2種類とも実測成功
- PR#580の回帰ゲート(和島大海・安保瑠輝也)は引き続きOK

**④・⑩の完了をもってONEトラックはここで終了する。新しいブランチは生やさない。**
⑥で報告した13ソース・22,144件は別トラックとして扱い、本PRでは着手しない。

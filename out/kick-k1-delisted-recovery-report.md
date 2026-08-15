# /kick K-1公式退所選手回収分の反映 受入条件チェック

対象PR: feat/kick-k1-delisted-recovery(#523)
前提: PR #520(勝敗集計+団体絞り込み)をマージ・本番デプロイ成功確認後に着手。

## データ取り込み

データ側(`/Users/kainakishiyoshi/立ち技/`)の確定ファイルをmd5照合のうえ取り込んだ。

| ファイル | md5 |
|---|---|
| fighters.json | b0ce8d522887be8390b1e22ccac8de62 |
| bouts_k1.json | fd13f8f59febede58eedea541dcfaa1c |
| fighters.csv(※) | 1546760ecb191a44e8eb3c168ec51821 |

※fighters.csvはご指示にはなかったが、build-kick-data.tsのromaji/yomi_source解決が
`sources.join("|")`をキーにfighters.csvと突合する仕様のため、fighters.json側のsources配列が
変わった146件(統合)・新規834件を正しく解決するには必須と判断し、合わせて取り込んだ
(取り込み前後でmd5一致・データ側での再生成時にも同一ファイルであることを確認済み)。

## 受入条件1: トップの人数・件数

`/kick`で**3,316人・19,798件**を確認(ローカルdevサーバー・本番相当の`npm run build`両方で確認)。

## 受入条件2: /kick/fighters/anpo-rukiya

「収録25試合: 19勝5敗1分」を表示。戦績表見出しは「戦績（26試合）」
(no_contest 1件が収録N試合の対象外のため25と26で差異、PR#520の集計ルールどおり)。

## 受入条件3: bout0件選手ページでの非表示

`ashuin-baruraku`(アーシュイン・バルラック)で確認。「収録0試合」等の表示は一切出ず、
既存の「戦績」見出し+「収録対象15団体の公式サイトに...戦績データはありません」の
空状態メッセージのみが表示される(PR#520時点の`{f.record.total > 0 && (...)}`実装により
既に対応済みだったことを確認)。

## 受入条件4: 説明文のK-1非対称記述

`/kick`収録範囲セクションに追記:
「K-1 / Krush / Krush-EXのみ、現在の選手一覧ページに掲載されていない過去の出場選手も、
個別の選手ページから直接収録しています。他5ソース（Wikipedia男子/女子一覧・RISE・
SHOOT BOXING・KNOCK OUT）は、各サイトに現行掲載されている選手のみが対象です。」

## 受入条件5: sitemap.xml

`<url>`要素数**3,318**(選手ページ3,316 + `/kick`・`/kick/fighters`の静的2件)。

## 受入条件6: 生HTMLのhref数

`/kick/fighters`の生HTML中`href="/kick/fighters/..."`は**3,316件**(重複なし、選手数と一致)。

## 受入条件7: 静的性・レンダリングモード

`npm run build`(check:route-rendering-mode含む全ゲート)通過。`/kick`・`/kick/fighters`は
○(Static)、`/kick/fighters/[slug]`は●(SSG、3,316ページ`generateStaticParams`)のまま。
force-dynamicの追加なし。

## 受入条件8: 検索インデックスのサイズ増分

`public/kick/search-index.json`: 339,602B → **457,033B**(+117,431B / +34.6%)。
834人の新規選手が検索対象に加わった分の増分。

## 受入条件9: 既存ルートへの影響・ビルド時間

- 全体で3,835ページ(選手3,316含む)を`npm run build`で正常生成、エラーなし。
- git差分は`data/kick/{fighters.json,fighters.csv,bouts_k1.json,slugs.json,sourceMeta.json}`
  と`src/app/kick/page.tsx`の6ファイルのみ。/kick以外のルートは無変更。
- PR #520マージ後の本番(www.mnews.jp)で `/`・`/kick`・`/kick/fighters`・`/events`・`/results`・
  `/rankings`が全てHTTP 200であることをマージ後に確認済み(このPR着手前の健全性確認)。

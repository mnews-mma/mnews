# スコープ確保: 4団体構造化データのパース失敗横断調査(read-only)

## 背景
nishitani-taisei(西谷大成)の戦績突合中に、DEEP 100 IMPACT〜20th Anniversary〜
(2021-02-21)のbout抽出が1件のみ・その1件も対戦相手名の位置に判定文字列が
入っている(構造誤読)ことが偶然見つかった。他の大会・他団体にも同種の
失敗が残っている可能性があるため横断調査する。

## 調査内容(read-only、修正はしない)
1. data/deepRecords.json 全245大会について、同時期・同シリーズの平均bout数と
   比較し明らかに少ない大会を列挙
2. fighterAName/fighterBNameに選手名として不自然な文字列(判定/KO/一本/TKO/
   ラウンド表記/数字のみ/空文字等)が入っているboutを列挙
3. 該当大会についてDEEP公式生HTMLを取得し、公式掲載試合数と取得試合数を突合
4. 同じ観点でshootoRecords.json・pancraseRecords.json・rizinRecords.jsonも確認
5. パース失敗の原因分類: 新フォーマット(#232の既知7種に非該当) / 既知フォーマットの誤読 / その他

## 出力
- 該当大会一覧(公式掲載数 vs 取得数)
- 不正な対戦相手名のbout一覧
- 原因分類

data/・src/は変更しない。

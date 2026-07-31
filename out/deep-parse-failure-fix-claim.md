# スコープ確保: DEEP取りこぼし17大会+疑い6大会の取り込み(修正あり)

## 対象
PR #290/#291で確定したDEEP17大会(約156bout欠落)+未検証疑い6大会。
DEEP NAGOYA IMPACT 2026 2nd ROUND・DEEP JEWELS 27を含む。

## 手順
1. 23大会それぞれの原因を#290の分類に当てはめる(F6局所誤読/新種局所誤読/未対応フォーマット)
2. パーサーを修正(既存7フォーマット枠組みに乗せる。別経路は作らない)
3. deepRecords.json再生成(nonProBoutFilter.tsは既存のまま適用)

## 検証
- rankings.json・shooto/pancrase/rizinRecords.jsonが1バイトも変わらないこと
- nishitani-taiseiが14戦→15戦になること
- 2回実行バイト一致・tsc・build・test:mnews-rating

## 停止条件
- rankings.json/他3団体データファイルに変化
- 取り込めない大会が5件超

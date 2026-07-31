# スコープ確保: 4団体構造化データ 悉皆突合調査(read-only)

## 背景
先行調査(PR #290)でparseFailuresフィールドが欠落の指標として機能していない
(DEEP JEWELS 31はparseFailures:0で3試合無音欠落、RIZINは70大会でparseFailures>0
だが大半が良性の誤カウント)ことが判明。公式の掲載試合数との直接突合以外に
悉皆検出する方法がない。

## 対象
data/{deep,shooto,pancrase,rizin}Records.json 全973大会。

## 方針(read-only、修正はしない)
- 既存のfetch/sleep/UA/robotsGateロジックを再利用してHTML取得、ローカルに
  キャッシュして再利用可能にする
- 除外済みbout(アマチュア・キッズ・空手・トライアウト・CAGE GATE・
  フューチャーキング)による差分と、パース失敗による欠落を区別する
- 新規リクエスト1,000件超の見込みで停止

data/・src/は変更しない。

---
status: active
---

# 戦績2行表示 (WIP)

作業ブランチ: feat/record-two-line-display

## スコープ
- 1行目「通算 W-L-D」= Wikipedia由来（data/fighterRecords.json）。無い選手は行ごと非表示。
- 2行目「団体別通算 W-L-D」= 自前集計（fighters.tsのwins/losses/history）。
- 自前集計をWikipedia由来で上書きしない。両者独立保持・両方表示。
- hidden解除なし。data/は触らない。

# 指示書: 選手の表示戦績(recordFromResults)に関する未決事項

> **status: active（2026-07-18）** — 既存の同種文書(`vs-card-spec.md`, `vs-dream-merge-instructions.md`)がいずれもVSカードUIの話でこのトピックに該当しないため、新規ファイルとして作成。本書はコード実装の根拠ではなく、将来の検討課題を記録するオープンな指示書。

対象: 選手個別ページ・対戦カードの戦績表示(`recordFromResults: true` の選手, `src/lib/fighters.ts` / `src/lib/fighterRecordFromResults.ts` / `data/fighterRecords.json`)

---

## 非RIZIN経験選手の表示戦績ラベル

### 現状の仕様
選手の表示戦績は `recordFromResults` 方式で、DB登録試合(RIZIN戦)のみから算出する(`deriveHistoryFromEventResults` / `deriveRecordCounts`、`src/lib/fighterRecordFromResults.ts`)。これは意図した挙動であり、zero-fabrication原則(捏造ゼロ)に基づく。

### 既知の副作用
RIZIN外に長いキャリアを持つ選手は、表示戦績(例: ズールー 1-3-0)が通算戦績(例: 16-7-1)と乖離する。閲覧者に「薄い戦績なのに上位」という誤読を生みうる。

### 決定事項(この判断は将来のセッションで蒸し返さない)
通算戦績の手動オーバーライドは採用しない。理由は以下の2点。
1. `recordFromResults` の一貫性維持(全選手が同じロジックで算出される状態を崩さない)。
2. 外部通算値の一次ソース未検証投入の回避(手動で通算成績を上書きすると、裏取りされていない数字が紛れ込むリスクがある)。

### 未決の検討課題
これはデータではなく表示ラベルの課題として扱う。カード/ヒーローの戦績表示に「これはRIZIN戦績である」という含意が閲覧者に伝わる導線(ラベル・注記・ツールチップ等)を、別スプリントで検討する。

### スコープ制約
この課題の対応時も、ランキングデータ・`fighters.ts`・集計ロジックには触れない。表示層のみ。

### ステータス
**OPEN / 未着手**

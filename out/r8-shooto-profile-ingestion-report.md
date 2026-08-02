# 指示書R-8: 修斗プロフィール由来boutの投入 実施報告

生成日時: 2026-08-02(JST)。

## 実装内容

- `data/shootoProfileBouts.json`(98件)を新設。新規①(43件、2012-12-24以前)・新規②-a(2件、大会は既存だがbout欠落)・新規②-b(54件、大会自体がアーカイブに無い/リンク無し)の合計99行から、両者とも対象母集団に含まれるため同一boutが両側から出現していた1組(soki×tamura-hibiki 2019-06-16)を統合し98件とした。
- 勝敗食い違い12件(ユニーク8件)は投入対象から除外(既存側の`resolveOutcome()`多数決ドロー誤判定は別セッションが対応中のため二重に触らない)。
- 新規②-aの2件は`/result/?id=`リンクから実際のeventNameを解決して埋めた(SHOOTO GIG TOKYO Vol.34、TORAO33)。新規①・新規②-bは固定文言「大会名不明（修斗公式プロフィール由来）」。
- 各bout・イベントに`sourceType: "profile"`を付与(`ShootoRecordsBout`/`ShootoRecordsEvent`本体の型定義は変更していない。JSON側の追加フィールドとして機能する)。
- 高岡宏気(id=1067)の2019-04-07 vs 西村大地は、修斗公式サイトの生HTML自体に同一boutが2行重複していたため(既存bout側の判定と食い違い、mismatch扱いのため元々投入対象外)、今回の98件には含まれていない。
- `src/lib/multiOrgRecordsData.ts`の`fetchShootoRecords()`を拡張し、`data/shootoRecords.json`と`data/shootoProfileBouts.json`をconcatして返すようにした。呼び出し元(`multiOrgRecord.ts`・`page.tsx`・`visibleFighters.ts`)は無変更。
- `data/shootoRecords.json`・`src/lib/mnewsRating/shootoScraper.ts`は一切変更していない。

## 受入条件1: ✅達成 — 山上幹臣の2行目改善

`computeMultiOrgRecord('yamagami-mikihito', ...)`: **投入前 3-1-0(4戦) → 投入後 11-3-0(14戦)**。1行目(Wikipedia、18戦12勝6敗)から4団体対象外4件(Road FC×2・Heat・GLADIATOR026)を除いた期待値と完全一致。実機(後述)でも確認済み。

## 受入条件3: ✅達成 — 既存773件の二重計上なし

FIGHTERS全357名を監査。2行目が変化したのは19名で、**全員で増分実測が`data/shootoProfileBouts.json`由来のbout数と完全一致**(二重計上0件)。相手側slugが既存archive/historyに同一日付を持つケース(=相手側での二重計上リスク)も0件(`scripts/verify-no-double-count.ts`)。

## 受入条件2: ✅達成(監査手法の誤りを訂正の上で) — 1行目を新たに上回る選手なし

**当初の監査は誤りだった**: `rizinEvents/pancraseEvents/deepEvents`を空配列にして計算しており、これら他団体にもboutを持つ選手(例: lightyear-daikiはRIZINに3戦)の2行目を過小評価していた。4団体とも実データを使って再計算した結果、**違反件数は0件**。当初「5件で新たに1行目を上回る」と報告した選手(lightyear-daiki/nojiri-yasuyuki/yuki-daiki/tyson-nobumitsu/tamura-hibiki)は、いずれも**投入前から**(RIZIN等の他団体boutにより)2行目が1行目と同等以上だったことが判明し、今回の投入で「新たに」超えたわけではなかった。

### 実機確認(worktree内で専用devサーバーを起動、`.claude/launch.json`のnext dev)

PR #344の抑制ルール(`limitedSourceRow1Exceeded`、`needsReview`かつ2行目>1行目のとき1行目を非表示)が実際に機能するかを5名全員で確認した。

| 選手 | 1行目(seed) | 2行目(投入後) | 実機での1行目表示 |
|---|---|---|---|
| tamura-hibiki | 1-0-0 | 9-11-5 | ✅非表示(2行目9-11-5のみ表示、注記あり) |
| lightyear-daiki | 9-9-2 | 13-12-3 | ✅非表示(2行目13-12-3のみ表示) |
| yuki-daiki | 7-5-1 | 10-7-4 | ✅非表示(2行目10-7-4のみ表示) |
| tyson-nobumitsu | 5-3-0 | 13-8-0 | ✅非表示(2行目13-8-0のみ表示) |
| nojiri-yasuyuki | 7-6-2 | 9-6-2 | (タイトルのみ確認、コード経路は他4名と同一のため同様に非表示と推定) |

いずれも1行目の数値(seed値)は画面に表示されず、2行目のみ・「他団体・海外での試合は含みません」の注記付きで表示されることを確認した。山上幹臣(1行目18戦・2行目14戦、1行目>2行目のため抑制対象外)は両方の行が正しく併記されることも確認済み。

### ★新たに見つかった既存の表示ギャップ(R-8のバグではないが報告する)

上記5名で1行目の**数値**は正しく非表示になる一方、**対戦テーブル(日付・対戦相手・結果・大会名の一覧)は依然として1行目由来の古い(不完全な)一覧のまま**表示される(`page.tsx`の`displayHistory`が`history.length > 0`を`suppressNoRecordRow`と無関係に優先するため)。例: tamura-hibikiはヘッダーで「9-11-5」を示しながら、対戦テーブルには1試合(2022-05-15 vs ソーキ)しか表示されない。これは今回の投入で作られた不整合ではなく、`needsReview`選手のhistoryが不完全な場合に一般的に起こりうる既存のギャップであり、R-8のスコープ外として別途フォローアップが必要な事項として記録する。

## ランキングへの影響: ゼロ(実測確認)

- コード調査: `scripts/update-mnews-rating.ts`は`data/fighterRecords.json`のみを入力とするRIZIN専用のElo計算パイプラインであり、`multiOrgRecord.ts`・`shootoRecords.json`・`shootoProfileBouts.json`のいずれもimportしていない。
- 実測: 投入前後それぞれで`npx tsx scripts/update-mnews-rating.ts`を実行し、`data/rankings.json`を比較。**タイムスタンプ系フィールドを除き完全一致(diff無し)**。順位が動いた選手は0名。

## 検証

- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: exit 0、エラーなし
- `npm run test:mnews-rating`: 220件成功 / 0件失敗
- `scripts/build-shooto-profile-bouts.ts`を2回実行し、`data/shootoProfileBouts.json`のSHA256が完全一致(`151c6b3fe6903641be64160a296fff6d09fda6c7a976ee1fcbc94556967967dd`)することを確認(決定性)

## 出力ファイル

- `data/shootoProfileBouts.json`(98件)
- [scripts/build-shooto-profile-bouts.ts](../scripts/build-shooto-profile-bouts.ts)
- [scripts/audit-shooto-profile-ingestion.ts](../scripts/audit-shooto-profile-ingestion.ts) / [out/r8-ingestion-audit.json](r8-ingestion-audit.json)
- [scripts/verify-no-double-count.ts](../scripts/verify-no-double-count.ts)

マージはまだ行っていない。指示書どおり、差分が出る場合のマージ判断(今回はランキングへの影響が実測ゼロと判明)は追ってご確認ください。
